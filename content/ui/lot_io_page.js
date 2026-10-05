// Category view for lot import/export. Data work stays behind fptPopupActions.
(function (root) {
    'use strict';

    const PAGE_ID = 'lot_io';
    const PROCESS_ACTION = 'renderPendingImports';
    const IMPORT_ACTIONS = Object.freeze({
        continue: 'lot-io-continue-btn',
        cancel: 'lot-io-cancel-btn',
        postpone: 'lot-io-postpone-btn',
        skip: 'skipLotImportItem'
    });

    function node(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = String(text);
        return element;
    }

    function icon(name) {
        const element = node('span', 'material-symbols-rounded', name);
        element.setAttribute('aria-hidden', 'true');
        return element;
    }

    function button(label, className, iconName, actionId) {
        const element = node('button', className);
        element.type = 'button';
        if (actionId) element.id = actionId;
        if (iconName) element.appendChild(icon(iconName));
        element.appendChild(node('span', '', label));
        return element;
    }

    function showToast(popup, message, kind = 'success') {
        return root.FPTPopupUI.showToast(popup, message, kind);
    }

    function assertSuccessfulResponse(response) {
        if (response && response.success === false) {
            throw new Error(response.error || 'Не удалось выполнить действие.');
        }
        return response;
    }

    function createDialog(popup, title, { wide = false, description = '' } = {}) {
        return root.FPTPopupUI.createDialog(popup, title, { wide, description });
    }

    function downloadJson(contents, fileName) {
        const blob = new Blob([JSON.stringify(contents, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function mountLotIOCategory(popup) {
        if (!popup || !root.FPTPopupUI || typeof root.FPTPopupUI.ensureCategoryHeader !== 'function') {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        const page = popup.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptLotIoMounted === 'true') return;
        page.dataset.fptLotIoMounted = 'true';

        let importRefreshVersion = 0;
        let currentTask = null;

        const view = node('div', 'fpt-lot-io');
        const helpPanel = node('aside', 'fpt-lot-help-popover');
        helpPanel.hidden = true;
        helpPanel.setAttribute('role', 'region');
        helpPanel.setAttribute('aria-label', 'Справка по управлению лотами');
        helpPanel.appendChild(node('h2', '', 'Управление лотами'));
        const helpList = node('ul');
        [
            'Экспорт сохраняет лоты выбранных категорий в файл JSON — это резервная копия и способ перенести лоты.',
            'Импорт создаёт лоты из такого файла. Ход сохраняется: импорт можно отложить, продолжить или пропустить проблемный лот.',
            'Файл можно перетащить прямо на карточку «Импорт из файла».',
            'Массовое редактирование меняет название, описание, цену или активирует выбранные лоты за один запуск.'
        ].forEach(text => helpList.appendChild(node('li', '', text)));
        helpPanel.appendChild(helpList);

        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Управление лотами', {
            onHelp: event => {
                const open = helpPanel.hidden;
                helpPanel.hidden = !open;
                event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
        });
        view.append(helpPanel);

        const metric = (iconName, label) => {
            const element = node('div', 'fpt-qr-metric fpt-lot-metric');
            const badge = node('span', 'fpt-qr-metric-icon');
            badge.appendChild(icon(iconName));
            const copy = node('div', 'fpt-qr-metric-copy');
            const value = node('strong', 'fpt-qr-metric-value', '—');
            copy.append(node('span', 'fpt-qr-metric-label', label), value);
            element.append(badge, copy);
            return { element, value };
        };
        const hero = node('section', 'fpt-qr-hero fpt-lot-hero');
        hero.setAttribute('aria-labelledby', 'fpt-lot-hero-title');
        const heroMain = node('div', 'fpt-qr-hero-main');
        const heroIcon = node('span', 'fpt-qr-hero-icon');
        heroIcon.appendChild(icon('inventory_2'));
        const heroCopy = node('div', 'fpt-qr-hero-copy');
        const heroTitleRow = node('div', 'fpt-qr-hero-title-row');
        const heroTitle = node('h2', 'fpt-qr-hero-title', 'Лоты под контролем');
        heroTitle.id = 'fpt-lot-hero-title';
        const heroPill = node('span', 'fpt-qr-pill fpt-lot-hero-pill', 'Проверяем импорт…');
        heroPill.setAttribute('role', 'status');
        heroTitleRow.append(heroTitle, heroPill);
        heroCopy.append(heroTitleRow, node('p', 'fpt-qr-hero-description',
            'Резервная копия в JSON, перенос лотов из файла и правка многих лотов за один запуск.'));
        heroMain.append(heroIcon, heroCopy);
        const metricImport = metric('description', 'Импорт');
        const metricDone = metric('task_alt', 'Обработано');
        const metricProblems = metric('report', 'Ошибки и пропуски');
        const metrics = node('div', 'fpt-qr-metrics fpt-lot-metrics');
        metrics.append(metricImport.element, metricDone.element, metricProblems.element);
        hero.append(heroMain, metrics);
        view.appendChild(hero);

        const tool = (modifier, iconName, title, description) => {
            const card = node('article', `fpt-lot-tool fpt-lot-tool--${modifier}`);
            const head = node('div', 'fpt-lot-tool-head');
            const emblem = node('span', 'fpt-qr-emblem fpt-lot-tool-emblem');
            emblem.appendChild(icon(iconName));
            const copy = node('div', 'fpt-lot-tool-copy');
            copy.append(node('h3', '', title), node('p', '', description));
            head.append(emblem, copy);
            card.appendChild(head);
            return card;
        };
        const actionBand = node('section', 'fpt-lot-action-band');
        actionBand.setAttribute('aria-label', 'Действия с лотами');
        const exportButton = button('Экспорт в JSON', 'fpt-lot-action-button fpt-lot-action-button--primary', 'download', 'lot-io-export-btn');
        const importButton = button('Выбрать файл', 'fpt-lot-action-button fpt-lot-action-button--import', 'upload_file', 'lot-io-import-btn');
        importButton.setAttribute('aria-describedby', 'fpt-lot-import-status');
        const importControl = node('div', 'fpt-lot-import-control');
        const importStatus = node('span', 'fpt-lot-import-status');
        importStatus.id = 'fpt-lot-import-status';
        importStatus.setAttribute('aria-live', 'polite');
        importControl.append(importButton, importStatus);
        const bulkButton = button('Открыть редактор', 'fpt-lot-action-button fpt-lot-action-button--bulk', 'edit_note', 'fp-bulk-edit-btn');
        const exportTool = tool('export', 'cloud_download', 'Резервная копия', 'Сохраните лоты выбранных категорий в JSON-файл.');
        exportTool.appendChild(exportButton);
        const importTool = tool('import', 'upload', 'Импорт из файла', 'Перетащите JSON сюда или выберите файл резервной копии.');
        importTool.appendChild(importControl);
        const dropHint = node('div', 'fpt-lot-drop-hint');
        dropHint.setAttribute('aria-hidden', 'true');
        dropHint.append(icon('file_download'), node('span', '', 'Отпустите, чтобы начать импорт'));
        importTool.appendChild(dropHint);
        const bulkTool = tool('bulk', 'edit_note', 'Массовое редактирование', 'Название, описание, цена и активация сразу для многих лотов.');
        bulkTool.appendChild(bulkButton);
        const fileInput = node('input', 'fpt-lot-file-input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.id = 'lot-io-import-file';
        fileInput.setAttribute('aria-label', 'Файл резервной копии лотов');
        actionBand.append(exportTool, importTool, bulkTool, fileInput);
        view.appendChild(actionBand);

        const section = node('section', 'fpt-lot-import-section');
        section.setAttribute('aria-labelledby', 'fpt-lot-import-title');
        const sectionHeading = node('div', 'fpt-lot-section-heading');
        const sectionTitle = node('h2', '', 'Текущий импорт');
        sectionTitle.id = 'fpt-lot-import-title';
        const taskCount = node('span', 'fpt-qr-pill fpt-lot-task-count', '0 задач');
        taskCount.setAttribute('aria-live', 'polite');
        sectionHeading.append(sectionTitle, taskCount);
        const taskContent = node('div', 'fpt-lot-task-content');
        section.append(sectionHeading, taskContent);

        view.append(section);
        page.replaceChildren(view);
        page.prepend(header.element);

        // Hero summary of the import that is running, paused or just finished.
        function updateHero({ state = 'idle', name = '', done = 0, total = 0, errors = 0, skipped = 0 } = {}) {
            const pill = {
                loading: ['Проверяем импорт…', ''],
                idle: ['Готово к работе', 'success'],
                running: [`Импорт идёт · ${done} из ${total}`, ''],
                postponed: [`Приостановлен · ${done} из ${total}`, 'warning'],
                error: ['Ошибка импорта', 'error'],
                finished: ['Импорт завершён', errors ? 'warning' : 'success']
            }[state] || ['Готово к работе', 'success'];
            heroPill.textContent = pill[0];
            if (pill[1]) heroPill.dataset.kind = pill[1];
            else delete heroPill.dataset.kind;
            hero.dataset.state = ['running', 'postponed', 'error'].includes(state) ? 'on' : 'off';
            const hasResult = ['running', 'postponed', 'error', 'finished'].includes(state);
            metricImport.value.textContent = hasResult ? shortenFileName(name || 'Импорт лотов', 28) : state === 'loading' ? '…' : 'Нет активного';
            metricImport.value.title = hasResult ? name || '' : '';
            metricDone.value.textContent = hasResult ? `${done} из ${total}` : '—';
            const problems = [
                errors ? `${errors} ${root.FPTPopupUI.pluralize(errors, ['ошибка', 'ошибки', 'ошибок'])}` : '',
                skipped ? `${skipped} ${root.FPTPopupUI.pluralize(skipped, ['пропуск', 'пропуска', 'пропусков'])}` : ''
            ].filter(Boolean).join(' · ');
            metricProblems.value.textContent = hasResult ? problems || 'Нет' : '—';
            metricProblems.value.title = hasResult ? `Ошибок: ${errors}, пропущено: ${skipped}` : '';
            metricProblems.element.dataset.tone = hasResult && errors ? 'error' : '';
        }

        const shortenFileName = (name, maxLength = 44) => {
            const value = String(name || 'Импорт лотов');
            if (value.length <= maxLength) return value;
            const tailLength = Math.min(18, Math.floor(maxLength / 2));
            const startLength = Math.max(8, maxLength - tailLength - 1);
            return `${value.slice(0, startLength)}…${value.slice(-tailLength)}`;
        };
        const importCounts = lots => {
            const list = Array.isArray(lots) ? lots : [];
            return {
                success: list.filter(lot => lot?.status === 'success').length,
                errors: list.filter(lot => lot?.status === 'error').length,
                skipped: list.filter(lot => lot?.status === 'skipped').length
            };
        };

        function updateImportStatus(task, loading = false, loadingText = 'Проверяем импорт…') {
            importStatus.replaceChildren();
            importButton.disabled = Boolean(task) || loading;
            if (!task && !loading) return;

            let kind = 'loading';
            let text = loadingText;
            if (task) {
                const total = Array.isArray(task.lots) ? task.lots.length : 0;
                const currentIndex = Math.max(0, Math.min(total, Number(task.currentIndex) || 0));
                const currentLot = task.lots?.[currentIndex];
                if (currentLot?.status === 'error') {
                    kind = 'error';
                    text = `Ошибка · ${currentIndex} из ${total}: ${currentLot.error || 'Проверьте текущий лот.'}`;
                } else if (task.state === 'postponed') {
                    kind = 'warning';
                    text = `Приостановлен · ${currentIndex} из ${total}`;
                } else {
                    text = `Выполняется · ${currentIndex} из ${total}`;
                }
            }
            importStatus.appendChild(root.FPTPopupUI.statusPill(kind, text));
        }

        function createTaskSkeleton() {
            const skeleton = node('div', 'fpt-lot-task-skeleton');
            skeleton.setAttribute('aria-hidden', 'true');
            skeleton.append(
                node('span', 'fpt-lot-task-skeleton-icon'),
                node('span', 'fpt-lot-task-skeleton-copy'),
                node('span', 'fpt-lot-task-skeleton-progress'),
                node('span', 'fpt-lot-task-skeleton-continue'),
                node('span', 'fpt-lot-task-skeleton-menu')
            );
            return skeleton;
        }

        const showTaskEmpty = (loading = false) => {
            currentTask = null;
            updateImportStatus(null, loading);
            updateHero({ state: loading ? 'loading' : 'idle' });
            taskCount.textContent = loading ? 'Загрузка…' : '0 задач';
            if (loading) {
                taskContent.replaceChildren(createTaskSkeleton());
                return;
            }
            const empty = node('div', 'fpt-lot-empty');
            empty.appendChild(icon('inbox'));
            empty.appendChild(node('span', '', 'Нет незавершённых импортов. Выберите или перетащите JSON-файл в карточку «Импорт из файла».'));
            taskContent.replaceChildren(empty);
        };

        function renderTaskMenu(task, currentLot, hasError) {
            const wrap = node('div', 'fpt-lot-task-menu-wrap');
            const trigger = node('button', 'fpt-lot-task-menu-trigger');
            trigger.type = 'button';
            trigger.setAttribute('aria-label', 'Действия с импортом');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.appendChild(icon('more_vert'));
            const menu = node('div', 'fpt-lot-task-menu');
            menu.hidden = true;

            const addAction = (label, action, className = '') => {
                const menuButton = node('button', className);
                menuButton.type = 'button';
                menuButton.dataset.taskAction = action;
                menuButton.textContent = label;
                menu.appendChild(menuButton);
            };
            if (task.state === 'running' && !hasError) addAction('Отложить импорт', 'postpone');
            if (currentLot && ['pending', 'error'].includes(currentLot.status)) addAction('Пропустить текущий лот', 'skip');
            addAction('Отменить импорт', 'cancel', 'fpt-lot-danger-item');

            trigger.addEventListener('click', () => {
                menu.hidden = !menu.hidden;
                trigger.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
            });
            menu.addEventListener('click', async event => {
                const item = event.target.closest('[data-task-action]');
                if (!item) return;
                const action = item.dataset.taskAction;
                if (action === 'cancel' && !window.confirm('Отменить импорт лотов?')) return;
                item.disabled = true;
                try {
                    const actionId = IMPORT_ACTIONS[action];
                    const payload = action === 'skip' ? { index: task.currentIndex || 0 } : {};
                    assertSuccessfulResponse(await root.fptPopupActions.run(PAGE_ID, actionId, payload));
                    await refreshPendingImports();
                    if (action === 'cancel') showToast(popup, 'Импорт отменён.');
                    else if (action === 'postpone') showToast(popup, 'Импорт отложен.');
                    else showToast(popup, 'Текущий лот пропущен.');
                } catch (error) {
                    showToast(popup, error.message || 'Не удалось выполнить действие.', 'error');
                }
            });
            wrap.append(trigger, menu);
            return wrap;
        }

        function renderTask(task) {
            currentTask = task || null;
            updateImportStatus(currentTask);
            if (!task || !Array.isArray(task.lots) || !task.lots.length) {
                showTaskEmpty(false);
                return;
            }
            taskCount.textContent = 'Активный импорт';
            const total = task.lots.length;
            const currentIndex = Math.max(0, Math.min(total, Number(task.currentIndex) || 0));
            const currentLot = task.lots[currentIndex] || null;
            const completed = currentIndex;
            const percent = Math.max(0, Math.min(100, Math.round(completed / total * 100)));
            const isPostponed = task.state === 'postponed';
            const hasError = currentLot?.status === 'error';
            const card = node('article', 'fpt-lot-import-card');
            card.dataset.state = hasError ? 'error' : isPostponed ? 'postponed' : 'running';
            card.setAttribute('aria-label', `Импорт ${task.name || 'лотов'}`);

            const fileTile = node('span', 'fpt-lot-file-icon');
            fileTile.setAttribute('aria-hidden', 'true');
            fileTile.appendChild(icon('description'));

            const fileCopy = node('div', 'fpt-lot-file-copy');
            const fileName = node('h3', 'fpt-lot-file-name', shortenFileName(task.name));
            fileName.title = task.name || 'Импорт лотов';
            const status = node('div', 'fpt-lot-file-status');
            const dot = node('span', `fpt-lot-status-dot${hasError ? ' fpt-lot-status-dot--error' : !isPostponed ? ' fpt-lot-status-dot--running' : ''}`);
            dot.setAttribute('aria-hidden', 'true');
            const statusText = hasError
                ? `Ошибка · ${completed} из ${total}`
                : `${isPostponed ? 'Приостановлен' : 'Выполняется'} · ${completed} из ${total}`;
            status.append(dot, node('span', '', statusText));
            fileCopy.append(fileName, status);
            const counts = importCounts(task.lots);
            updateHero({
                state: hasError ? 'error' : isPostponed ? 'postponed' : 'running',
                name: task.name, done: completed, total, errors: counts.errors, skipped: counts.skipped
            });
            const outcomeSummary = node('p', 'fpt-lot-task-outcomes');
            outcomeSummary.setAttribute('aria-live', 'polite');
            for (const [kind, label, value] of [['success', 'Добавлено', counts.success], ['error', 'Ошибки', counts.errors], ['skipped', 'Пропущено', counts.skipped]]) {
                const chip = node('span', `fpt-lot-outcome fpt-lot-outcome--${kind}`);
                chip.append(node('span', '', label), node('strong', '', String(value)));
                outcomeSummary.appendChild(chip);
            }
            fileCopy.appendChild(outcomeSummary);
            if (hasError) {
                const errorText = node('p', 'fpt-lot-task-error', currentLot.error || 'Не удалось обработать этот лот.');
                errorText.setAttribute('role', 'alert');
                fileCopy.appendChild(errorText);
            }

            const progress = node('div', 'fpt-lot-progress');
            progress.setAttribute('role', 'progressbar');
            progress.setAttribute('aria-label', 'Ход импорта');
            progress.setAttribute('aria-valuemin', '0');
            progress.setAttribute('aria-valuemax', '100');
            progress.setAttribute('aria-valuenow', String(percent));
            // One segment per outcome, in the order the lots were processed.
            const track = node('div', 'fpt-lot-progress-track');
            const share = value => `${Math.max(0, Math.min(100, value / total * 100))}%`;
            const pending = Math.max(0, completed - counts.success - counts.errors - counts.skipped);
            for (const [kind, value] of [['success', counts.success + pending], ['skipped', counts.skipped], ['error', counts.errors]]) {
                if (!value) continue;
                const segment = node('div', `fpt-lot-progress-fill fpt-lot-progress-fill--${kind}`);
                segment.style.width = share(value);
                track.appendChild(segment);
            }
            progress.append(track, node('span', 'fpt-lot-progress-value', `${percent}%`));

            const continueButton = node('button', 'fpt-lot-continue');
            continueButton.type = 'button';
            continueButton.append(
                icon(isPostponed || hasError ? 'play_arrow' : 'progress_activity'),
                node('span', '', isPostponed || hasError ? 'Продолжить' : 'Импорт идёт')
            );
            continueButton.id = 'lot-io-continue-btn';
            continueButton.disabled = !(isPostponed || hasError);
            continueButton.addEventListener('click', async () => {
                continueButton.disabled = true;
                try {
                    assertSuccessfulResponse(await root.fptPopupActions.run(PAGE_ID, IMPORT_ACTIONS.continue));
                    await refreshPendingImports();
                    showToast(popup, 'Импорт продолжен.');
                } catch (error) {
                    continueButton.disabled = false;
                    showToast(popup, error.message || 'Не удалось продолжить импорт.', 'error');
                }
            });

            card.append(fileTile, fileCopy, progress, continueButton, renderTaskMenu(task, currentLot, hasError));
            taskContent.replaceChildren(card);
        }

        function renderCompletedImport(lots) {
            currentTask = null;
            updateImportStatus(null);
            const counts = importCounts(lots);
            const total = Array.isArray(lots) ? lots.length : 0;
            taskCount.textContent = 'Последний импорт';
            updateHero({ state: 'finished', name: 'Последний импорт', done: total, total, errors: counts.errors, skipped: counts.skipped });
            const report = node('article', 'fpt-lot-import-report');
            report.dataset.state = counts.errors ? 'warning' : 'success';
            report.setAttribute('aria-live', 'polite');
            const reportIcon = node('span', 'fpt-lot-report-icon');
            reportIcon.appendChild(icon(counts.errors ? 'warning' : 'task_alt'));
            const reportCopy = node('div', 'fpt-lot-report-copy');
            reportCopy.appendChild(node('strong', '', `Импорт завершён: ${counts.success} ${root.FPTPopupUI.pluralize(counts.success, ['лот добавлен', 'лота добавлено', 'лотов добавлено'])}`));
            reportCopy.appendChild(node('p', '', `Ошибок: ${counts.errors} · пропущено: ${counts.skipped} · всего: ${total} ${root.FPTPopupUI.pluralize(total, ['лот', 'лота', 'лотов'])}.`));
            report.append(reportIcon, reportCopy);
            const problems = (Array.isArray(lots) ? lots : []).filter(lot => ['error', 'skipped'].includes(lot?.status));
            if (problems.length) {
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                summary.textContent = `Показать ошибки и пропуски (${problems.length})`;
                const list = document.createElement('ul');
                problems.forEach(lot => {
                    const row = document.createElement('li');
                    const title = lot.title || lot.name || lot.offerId || lot.id || 'Лот без названия';
                    row.textContent = `${lot.status === 'skipped' ? 'Пропущен' : 'Ошибка'}: ${title}${lot.error ? ` — ${lot.error}` : ''}`;
                    list.appendChild(row);
                });
                details.append(summary, list);
                reportCopy.appendChild(details);
            }
            taskContent.replaceChildren(report);
        }

        async function refreshPendingImports() {
            const version = ++importRefreshVersion;
            try {
                const process = await root.fptPopupActions.run(PAGE_ID, PROCESS_ACTION);
                if (version === importRefreshVersion) renderTask(process);
            } catch (error) {
                if (version !== importRefreshVersion) return;
                showTaskEmpty(false);
                showToast(popup, error.message || 'Не удалось загрузить состояние импорта.', 'error');
            }
        }

        function addDialogButton(footer, label, { primary = false, danger = false, onClick } = {}) {
            const buttonClass = ['fpt-lot-dialog-button', primary ? 'fpt-lot-dialog-button--primary' : '', danger ? 'fpt-lot-dialog-button--danger' : ''].filter(Boolean).join(' ');
            const actionButton = node('button', buttonClass, label);
            actionButton.type = 'button';
            if (onClick) actionButton.addEventListener('click', onClick);
            footer.appendChild(actionButton);
            return actionButton;
        }

        async function openExportDialog() {
            exportButton.disabled = true;
            try {
                const categories = await root.fptPopupActions.run(PAGE_ID, 'lot-io-export-btn');
                if (!Array.isArray(categories) || !categories.length) throw new Error('Не удалось найти категории для экспорта.');
                const dialog = createDialog(popup, 'Экспорт лотов', {
                    description: 'Выберите категории, которые нужно сохранить в резервную копию JSON.'
                });
                const selectTools = node('div', 'fpt-lot-selection-tools');
                const selectAll = node('button', 'fpt-lot-dialog-button', 'Выбрать / снять все');
                selectAll.type = 'button';
                selectTools.appendChild(selectAll);
                dialog.body.appendChild(selectTools);
                const list = node('div', 'fpt-lot-category-list');
                const checkboxByIndex = [];
                categories.forEach((category, index) => {
                    const label = node('label', 'fpt-lot-category-row');
                    const input = node('input');
                    input.type = 'checkbox';
                    input.value = String(index);
                    input.disabled = !Array.isArray(category.lots) || category.lots.length === 0;
                    const name = node('span', 'fpt-lot-category-name', category.name || 'Категория без названия');
                    const lotCount = Array.isArray(category.lots) ? category.lots.length : 0;
                    const count = node('span', 'fpt-lot-category-count', `${lotCount} ${root.FPTPopupUI.pluralize(lotCount, ['лот', 'лота', 'лотов'])}`);
                    if (!lotCount) {
                        input.title = 'В этой категории нет лотов для экспорта.';
                        label.title = input.title;
                        label.append(input, name, count, node('span', 'fpt-lot-category-empty', 'Пустая'));
                    } else {
                        label.append(input, name, count);
                    }
                    list.appendChild(label);
                    checkboxByIndex.push(input);
                });
                if (categories.length > 8) {
                    const filter = node('input', 'fpt-lot-category-search');
                    filter.type = 'search';
                    filter.placeholder = 'Найти категорию…';
                    filter.setAttribute('aria-label', 'Поиск категории');
                    filter.addEventListener('input', () => {
                        const query = filter.value.trim().toLocaleLowerCase('ru');
                        list.querySelectorAll('.fpt-lot-category-row').forEach(row => {
                            row.hidden = Boolean(query) && !row.textContent.toLocaleLowerCase('ru').includes(query);
                        });
                    });
                    selectTools.prepend(filter);
                }
                dialog.body.appendChild(list);
                const selectionSummary = node('p', 'fpt-lot-export-summary', 'Выберите категории для экспорта.');
                selectionSummary.setAttribute('aria-live', 'polite');
                dialog.body.appendChild(selectionSummary);
                const exportProgress = node('div', 'fpt-lot-export-progress');
                exportProgress.hidden = true;
                const exportProgressBar = document.createElement('progress');
                exportProgressBar.max = 1;
                exportProgressBar.value = 0;
                exportProgressBar.setAttribute('aria-label', 'Экспорт лотов');
                const exportProgressText = node('span', '', 'Подготавливаем файл…');
                exportProgress.append(exportProgressBar, exportProgressText);
                dialog.body.appendChild(exportProgress);
                const note = node('p', 'fpt-lot-dialog-hint', 'Не закрывайте вкладку FunPay, пока идёт подготовка файла.');
                dialog.body.appendChild(note);
                addDialogButton(dialog.footer, 'Отмена', { onClick: dialog.close });
                const confirm = addDialogButton(dialog.footer, 'Экспортировать', { primary: true });
                const updateExportSelection = () => {
                    const selectedInputs = checkboxByIndex.filter(input => input.checked && !input.disabled);
                    const selectedLots = selectedInputs.reduce((sum, input) => sum + (categories[Number(input.value)].lots?.length || 0), 0);
                    const selected = selectedInputs.length;
                    selectionSummary.textContent = selected
                        ? `Выбрано ${selected} ${root.FPTPopupUI.pluralize(selected, ['категория', 'категории', 'категорий'])} · ${selectedLots} ${root.FPTPopupUI.pluralize(selectedLots, ['лот', 'лота', 'лотов'])}`
                        : 'Выберите категории для экспорта.';
                    confirm.disabled = selected === 0;
                    confirm.dataset.selectedLotCount = String(selectedLots);
                };
                checkboxByIndex.forEach(input => input.addEventListener('change', updateExportSelection));
                updateExportSelection();

                selectAll.addEventListener('click', async () => {
                    try {
                        const available = categories.filter(category => Array.isArray(category.lots) && category.lots.length > 0);
                        const selected = checkboxByIndex.filter(input => input.checked && !input.disabled).map(input => categories[Number(input.value)].id);
                        const next = await root.fptPopupActions.run(PAGE_ID, 'lot-io-select-all', {
                            categories: available,
                            selectedCategoryIds: selected
                        });
                        const selectedSet = new Set(next);
                        checkboxByIndex.forEach((input, index) => { input.checked = selectedSet.has(categories[index].id); });
                        updateExportSelection();
                    } catch (error) {
                        showToast(popup, error.message || 'Не удалось выбрать категории.', 'error');
                    }
                });

                confirm.addEventListener('click', async () => {
                    const selectedCategoryIds = checkboxByIndex
                        .map((input, index) => input.checked ? categories[index].id : null)
                        .filter(id => id !== null);
                    if (!selectedCategoryIds.length) {
                        showToast(popup, 'Выберите хотя бы одну категорию.', 'error');
                        return;
                    }
                    const controller = new AbortController();
                    dialog.setBusy(true, { onStop: () => controller.abort() });
                    confirm.textContent = 'Подготовка…';
                    exportProgress.hidden = false;
                    const selectedTotal = Number(confirm.dataset.selectedLotCount) || 0;
                    exportProgressBar.max = Math.max(1, selectedTotal);
                    exportProgressBar.value = 0;
                    const errors = [];
                    try {
                        const exported = await root.fptPopupActions.run(PAGE_ID, 'lot-io-export-confirm', {
                            categories,
                            selectedCategoryIds,
                            delayMs: 300,
                            signal: controller.signal,
                            onProgress: progress => {
                                confirm.textContent = `Экспорт ${progress.current}/${progress.total}`;
                                exportProgressBar.max = Math.max(1, Number(progress.total) || 1);
                                exportProgressBar.value = Math.min(exportProgressBar.max, Number(progress.current) || 0);
                                exportProgressText.textContent = `Экспортировано ${progress.current} из ${progress.total}`;
                            },
                            onError: error => errors.push(error)
                        });
                        if (!Array.isArray(exported) || !exported.length) throw new Error('Не удалось экспортировать лоты.');
                        const date = new Date().toISOString().slice(0, 10);
                        downloadJson(exported, `funpay_lots_export_${date}.json`);
                        dialog.setBusy(false);
                        dialog.close();
                        const failed = errors.length;
                        showToast(popup, failed
                            ? `Экспортировано ${exported.length} ${root.FPTPopupUI.pluralize(exported.length, ['лот', 'лота', 'лотов'])}; ошибок: ${failed}.`
                            : `Экспортировано ${exported.length} ${root.FPTPopupUI.pluralize(exported.length, ['лот', 'лота', 'лотов'])}.`);
                    } catch (error) {
                        dialog.setBusy(false);
                        confirm.textContent = 'Повторить экспорт';
                        const message = error?.name === 'AbortError' ? 'Экспорт остановлен. Файл не сохранён.' : error.message || 'Не удалось экспортировать лоты.';
                        showToast(popup, message, error?.name === 'AbortError' ? 'warning' : 'error');
                    }
                });
                dialog.focusInitial();
            } catch (error) {
                showToast(popup, error.message || 'Не удалось загрузить категории.', 'error');
            } finally {
                exportButton.disabled = false;
            }
        }

        async function openBulkEditor() {
            bulkButton.disabled = true;
            bulkButton.setAttribute('aria-busy', 'true');
            try {
                const response = await root.fptPopupActions.run(PAGE_ID, 'fp-bulk-edit-btn');
                const lots = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
                if (!lots.length) throw new Error('Активные лоты не найдены.');
                renderBulkDialog(lots);
            } catch (error) {
                showToast(popup, error.message || 'Не удалось загрузить лоты.', 'error');
            } finally {
                bulkButton.disabled = false;
                bulkButton.removeAttribute('aria-busy');
            }
        }

        function renderBulkDialog(lots) {
            const dialog = createDialog(popup, 'Массовое редактирование лотов', {
                wide: true,
                description: 'Изменяются только заполненные поля. В шаблонах доступны переменные {current} и {lotname}.'
            });
            const form = document.createElement('form');
            form.className = 'fpt-bulk-form';
            form.noValidate = true;
            form.innerHTML = `
                <div class="fpt-bulk-dialog-grid">
                    <div class="fpt-bulk-field"><label for="fptBulkName">Новое название</label><input id="fptBulkName" type="text" placeholder="Например: {current} — Premium"></div>
                    <div class="fpt-bulk-field"><label for="fptBulkMessage">Сообщение покупателю</label><input id="fptBulkMessage" type="text" placeholder="Оставьте пустым, чтобы не менять"></div>
                    <div class="fpt-bulk-field fpt-bulk-field--wide"><label for="fptBulkDescription">Новое описание</label><textarea id="fptBulkDescription" rows="3" placeholder="Оставьте пустым, чтобы не менять"></textarea></div>
                </div>
                <section class="fpt-bulk-group" aria-labelledby="fptBulkFindTitle">
                    <strong class="fpt-bulk-group-title" id="fptBulkFindTitle">Найти и заменить</strong>
                    <div class="fpt-bulk-dialog-grid">
                        <div class="fpt-bulk-field"><label for="fptBulkFind">Найти</label><input id="fptBulkFind" type="text" placeholder="Фрагмент текста"></div>
                        <div class="fpt-bulk-field"><label for="fptBulkReplace">Заменить на</label><input id="fptBulkReplace" type="text" placeholder="Новый текст"></div>
                    </div>
                    <div class="fpt-bulk-checks">
                        <label class="fpt-lot-check-row"><input id="fptBulkFindName" type="checkbox" checked> Название</label>
                        <label class="fpt-lot-check-row"><input id="fptBulkFindDesc" type="checkbox" checked> Описание</label>
                        <label class="fpt-lot-check-row"><input id="fptBulkFindMessage" type="checkbox"> Сообщение</label>
                    </div>
                    <div class="fpt-bulk-checks">
                        <label class="fpt-lot-check-row"><input id="fptBulkRegex" type="checkbox"> RegEx</label>
                        <label class="fpt-lot-check-row"><input id="fptBulkCase" type="checkbox"> Учитывать регистр</label>
                        <label class="fpt-lot-check-row"><input id="fptBulkWholeWord" type="checkbox"> Целые слова</label>
                        <label class="fpt-lot-check-row"><input id="fptBulkAll" type="checkbox" checked> Все совпадения</label>
                    </div>
                    <p class="fpt-lot-dialog-hint">Сначала применяется поиск и замена, затем новые значения из полей выше.</p>
                    <p class="fpt-bulk-validation-error" role="alert" hidden></p>
                </section>
                <section class="fpt-bulk-group" aria-labelledby="fptBulkPriceTitle">
                    <strong class="fpt-bulk-group-title" id="fptBulkPriceTitle">Изменение цены</strong>
                    <div class="fpt-bulk-inline-fields">
                        <select id="fptBulkPriceMode" aria-label="Режим цены">
                            <option value="none">Не менять</option>
                            <option value="set">Установить цену</option>
                            <option value="buyer_set">Цена покупателя с учётом комиссии</option>
                            <option value="round_flat">Округлить до</option>
                            <option value="add">Прибавить</option>
                            <option value="sub">Вычесть</option>
                            <option value="pct_up">Поднять на %</option>
                            <option value="pct_down">Снизить на %</option>
                        </select>
                        <input id="fptBulkPriceValue" type="number" min="0" step="0.01" placeholder="Значение" aria-label="Значение цены" disabled>
                        <select id="fptBulkPriceStep" aria-label="Шаг округления" hidden>
                            <option value="1">до 1</option><option value="5">до 5</option><option value="10" selected>до 10</option>
                            <option value="50">до 50</option><option value="100">до 100</option><option value="500">до 500</option><option value="1000">до 1000</option>
                        </select>
                    </div>
                    <div class="fpt-bulk-checks">
                        <label class="fpt-lot-check-row"><input id="fptBulkPriceRound" type="checkbox"> Округлять до целого</label>
                        <label class="fpt-lot-check-row fpt-lot-check-row--minimum"><span>Не ниже</span><input id="fptBulkPriceMinimum" type="number" min="0" step="0.01" placeholder="Мин."></label>
                    </div>
                </section>
                <div class="fpt-bulk-lot-tools">
                    <span class="fpt-bulk-lots-summary">Лоты: <strong data-lot-total></strong> · выбрано: <strong data-lot-selected>0</strong></span>
                    <input class="fpt-bulk-lot-filter" type="search" placeholder="Фильтр лотов…" aria-label="Фильтр лотов">
                    <button type="button" class="fpt-lot-dialog-button" data-select-visible>Выбрать все</button>
                </div>
                <div class="fpt-bulk-lots-list" role="group" aria-label="Выберите лоты"></div>
                <div class="fpt-bulk-progress" hidden>
                    <div class="fpt-bulk-progress-track" role="progressbar" aria-label="Ход массового редактирования" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="fpt-bulk-progress-fill"></div></div>
                    <div class="fpt-bulk-progress-text" role="status" aria-live="polite"></div>
                    <div class="fpt-bulk-log" aria-live="polite"></div>
                </div>`;
            dialog.body.appendChild(form);

            const initialFields = form.querySelector('.fpt-bulk-dialog-grid');
            const changeGroups = Array.from(form.querySelectorAll('.fpt-bulk-group'));
            const lotTools = form.querySelector('.fpt-bulk-lot-tools');
            const lotsList = form.querySelector('.fpt-bulk-lots-list');
            const progressPanel = form.querySelector('.fpt-bulk-progress');
            const activateButton = node('button', 'fpt-lot-dialog-button fpt-bulk-activate-selected', 'Активировать выбранные');
            activateButton.type = 'button';
            activateButton.disabled = true;
            activateButton.dataset.activateSelected = 'true';
            lotTools.appendChild(activateButton);
            const filterEmpty = node('p', 'fpt-bulk-filter-empty', 'Лоты не найдены. Измените поисковый запрос.');
            filterEmpty.hidden = true;
            const stepLots = node('section', 'fpt-bulk-step fpt-bulk-step--lots');
            stepLots.append(node('h3', '', '1. Выберите лоты'), node('p', 'fpt-bulk-step-hint', 'Отметьте лоты, к которым нужно применить действие.'), lotTools, lotsList, filterEmpty);
            const stepChanges = node('section', 'fpt-bulk-step fpt-bulk-step--changes');
            stepChanges.append(node('h3', '', '2. Что изменить'), node('p', 'fpt-bulk-step-hint', 'Пустые поля останутся без изменений.'), initialFields, ...changeGroups);
            const stepReview = node('section', 'fpt-bulk-step fpt-bulk-step--review');
            stepReview.appendChild(node('h3', '', '3. Проверьте изменения'));
            const reviewSummary = node('p', 'fpt-bulk-review-summary', 'Выберите лоты и укажите изменения.');
            reviewSummary.setAttribute('role', 'status');
            const preview = node('div', 'fpt-bulk-preview');
            preview.setAttribute('aria-live', 'polite');
            const previewTitle = node('strong', '', 'Предпросмотр первого выбранного лота');
            const previewBefore = node('p', 'fpt-bulk-preview-before', 'До: —');
            const previewAfter = node('p', 'fpt-bulk-preview-after', 'После: —');
            const previewPrice = node('p', 'fpt-bulk-preview-price', '');
            preview.append(previewTitle, previewBefore, previewAfter, previewPrice);
            stepReview.append(reviewSummary, preview, progressPanel);
            form.replaceChildren(stepLots, stepChanges, stepReview);

            const totalElement = form.querySelector('[data-lot-total]');
            const selectedElement = form.querySelector('[data-lot-selected]');
            const list = form.querySelector('.fpt-bulk-lots-list');
            let refreshReview = () => {};
            const selectedCount = () => {
                selectedElement.textContent = String(form.querySelectorAll('.fpt-bulk-lot-check:checked').length);
                refreshReview();
            };
            totalElement.textContent = `${lots.length} ${root.FPTPopupUI.pluralize(lots.length, ['лот', 'лота', 'лотов'])}`;
            lots.forEach(lot => {
                const label = node('label', 'fpt-bulk-lot-row');
                const checkbox = node('input', 'fpt-bulk-lot-check');
                checkbox.type = 'checkbox';
                checkbox.dataset.offerId = String(lot.offerId ?? lot.id ?? '');
                checkbox.dataset.nodeId = String(lot.nodeId ?? '');
                const name = node('span', 'fpt-bulk-lot-name', lot.title || 'Лот без названия');
                const category = node('span', 'fpt-bulk-lot-category', lot.categoryName || '');
                label.append(checkbox, name, category);
                label.dataset.search = `${lot.title || ''} ${lot.categoryName || ''} ${lot.offerId || lot.id || ''}`.toLocaleLowerCase('ru');
                list.appendChild(label);
            });
            list.addEventListener('change', selectedCount);
            form.querySelector('.fpt-bulk-lot-filter').addEventListener('input', event => {
                const query = event.target.value.trim().toLocaleLowerCase('ru');
                list.querySelectorAll('.fpt-bulk-lot-row').forEach(row => {
                    row.hidden = Boolean(query) && !row.dataset.search.includes(query);
                });
                filterEmpty.hidden = Array.from(list.querySelectorAll('.fpt-bulk-lot-row')).some(row => !row.hidden);
                refreshReview();
            });
            form.querySelector('[data-select-visible]').addEventListener('click', event => {
                const rows = Array.from(list.querySelectorAll('.fpt-bulk-lot-row')).filter(row => !row.hidden);
                const shouldCheck = rows.some(row => !row.querySelector('.fpt-bulk-lot-check').checked);
                rows.forEach(row => { row.querySelector('.fpt-bulk-lot-check').checked = shouldCheck; });
                event.currentTarget.textContent = shouldCheck ? 'Снять выделение' : 'Выбрать все';
                selectedCount();
            });

            const priceMode = form.querySelector('#fptBulkPriceMode');
            const priceValue = form.querySelector('#fptBulkPriceValue');
            const priceStep = form.querySelector('#fptBulkPriceStep');
            priceMode.addEventListener('change', () => {
                const flat = priceMode.value === 'round_flat';
                priceValue.disabled = priceMode.value === 'none' || flat;
                priceStep.hidden = !flat;
                if (priceMode.value === 'none' || flat) priceValue.value = '';
                refreshReview();
            });

            const progress = form.querySelector('.fpt-bulk-progress');
            const progressBar = form.querySelector('.fpt-bulk-progress-fill');
            const progressTrack = form.querySelector('.fpt-bulk-progress-track');
            const progressText = form.querySelector('.fpt-bulk-progress-text');
            const log = form.querySelector('.fpt-bulk-log');
            const applyButton = addDialogButton(dialog.footer, 'Применить изменения', { primary: true });
            const cancelButton = addDialogButton(dialog.footer, 'Отмена', { onClick: dialog.close });
            applyButton.classList.add('fpt-bulk-apply');

            const makeChangePayload = () => {
                const changes = {};
                const name = form.querySelector('#fptBulkName').value.trim();
                const description = form.querySelector('#fptBulkDescription').value.trim();
                const message = form.querySelector('#fptBulkMessage').value.trim();
                if (name) changes.name = name;
                if (description) changes.description = description;
                if (message) changes.message = message;

                const mode = priceMode.value;
                if (mode !== 'none') {
                    if (mode !== 'round_flat' && !priceValue.value.trim()) throw new Error('Введите цену для выбранного режима.');
                    const price = { mode };
                    if (mode === 'round_flat') price.step = Number(priceStep.value) || 1;
                    else price.value = Number(priceValue.value);
                    if (form.querySelector('#fptBulkPriceRound').checked) price.round = true;
                    const minimum = form.querySelector('#fptBulkPriceMinimum').value.trim();
                    if (minimum) price.minimum = Number(minimum);
                    changes.price = price;
                }

                const find = form.querySelector('#fptBulkFind').value;
                if (find) {
                    changes.findReplace = {
                        find,
                        replace: form.querySelector('#fptBulkReplace').value,
                        regex: form.querySelector('#fptBulkRegex').checked,
                        caseSensitive: form.querySelector('#fptBulkCase').checked,
                        wholeWord: form.querySelector('#fptBulkWholeWord').checked,
                        all: form.querySelector('#fptBulkAll').checked,
                        fields: {
                            name: form.querySelector('#fptBulkFindName').checked,
                            desc: form.querySelector('#fptBulkFindDesc').checked,
                            msg: form.querySelector('#fptBulkFindMessage').checked
                        }
                    };
                    if (changes.findReplace.regex) {
                        try { new RegExp(find, `${changes.findReplace.all ? 'g' : ''}${changes.findReplace.caseSensitive ? '' : 'i'}`); }
                        catch (error) { throw new Error(`Ошибка в регулярном выражении: ${error.message}`); }
                    }
                }
                return changes;
            };

            const regexError = form.querySelector('.fpt-bulk-validation-error');
            const validateRegex = () => {
                const find = form.querySelector('#fptBulkFind').value;
                if (!find || !form.querySelector('#fptBulkRegex').checked) {
                    regexError.hidden = true;
                    regexError.textContent = '';
                    form.querySelector('#fptBulkFind').removeAttribute('aria-invalid');
                    return true;
                }
                try {
                    const pattern = form.querySelector('#fptBulkWholeWord').checked ? `\\b(?:${find})\\b` : find;
                    new RegExp(pattern, form.querySelector('#fptBulkCase').checked ? '' : 'i');
                    regexError.hidden = true;
                    regexError.textContent = '';
                    form.querySelector('#fptBulkFind').removeAttribute('aria-invalid');
                    return true;
                } catch (error) {
                    regexError.hidden = false;
                    regexError.textContent = `Проверьте RegEx: ${error.message}`;
                    form.querySelector('#fptBulkFind').setAttribute('aria-invalid', 'true');
                    return false;
                }
            };

            refreshReview = () => {
                const selectedInputs = Array.from(list.querySelectorAll('.fpt-bulk-lot-check:checked'));
                const selectedCountValue = selectedInputs.length;
                const validRegex = validateRegex();
                let changes = {};
                let validationMessage = '';
                try { changes = makeChangePayload(); }
                catch (error) { changes = {}; validationMessage = error.message || 'Проверьте введённые значения.'; }
                if (!validRegex && !validationMessage) validationMessage = regexError.textContent;
                regexError.hidden = !validationMessage;
                if (validationMessage) regexError.textContent = validationMessage;
                const changeLabels = [];
                if (changes.name) changeLabels.push('название');
                if (changes.description) changeLabels.push('описание');
                if (changes.message) changeLabels.push('сообщение');
                if (changes.price) {
                    const modeNames = { set: 'цена', buyer_set: 'цена покупателя', round_flat: 'округление цены', add: 'прибавка к цене', sub: 'вычет из цены', pct_up: `цена +${changes.price.value}%`, pct_down: `цена −${changes.price.value}%` };
                    changeLabels.push(modeNames[changes.price.mode] || 'цена');
                }
                if (changes.findReplace) changeLabels.push('поиск и замена');
                reviewSummary.textContent = selectedCountValue
                    ? `Будет изменено ${selectedCountValue} ${root.FPTPopupUI.pluralize(selectedCountValue, ['лот', 'лота', 'лотов'])}${changeLabels.length ? ` · ${changeLabels.join(', ')}` : ' · изменения не заданы'}`
                    : 'Выберите лоты и укажите изменения.';
                activateButton.disabled = selectedCountValue === 0;
                applyButton.disabled = selectedCountValue === 0 || changeLabels.length === 0 || !validRegex || Boolean(validationMessage);

                const firstId = selectedInputs[0]?.dataset.offerId;
                const firstLot = lots.find(lot => String(lot.offerId ?? lot.id ?? '') === String(firstId)) || null;
                const beforeTitle = firstLot?.title || firstLot?.name || (firstLot ? `Лот #${firstId}` : '—');
                let afterTitle = beforeTitle;
                if (changes.findReplace?.fields?.name) {
                    try {
                        let pattern = changes.findReplace.regex ? changes.findReplace.find : String(changes.findReplace.find).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        if (changes.findReplace.wholeWord) pattern = `\\b${pattern}\\b`;
                        const flags = `${changes.findReplace.all ? 'g' : ''}${changes.findReplace.caseSensitive ? '' : 'i'}`;
                        afterTitle = afterTitle.replace(new RegExp(pattern, flags), changes.findReplace.replace ?? '');
                    } catch (_) {}
                }
                if (changes.name) afterTitle = changes.name.replace(/{current}/gi, beforeTitle).replace(/{lotname}/gi, beforeTitle);
                previewBefore.textContent = `До: ${beforeTitle}`;
                previewAfter.textContent = `После: ${afterTitle}`;
                previewPrice.textContent = changes.price
                    ? `Цена: ${firstLot?.price ?? '—'} → ${changes.price.mode === 'pct_up' ? `+${changes.price.value}%` : changes.price.mode === 'pct_down' ? `−${changes.price.value}%` : changes.price.mode === 'set' ? `${changes.price.value} ₽` : 'по выбранному правилу'}`
                    : '';
            };
            form.addEventListener('input', refreshReview);
            form.addEventListener('change', refreshReview);
            refreshReview();

            async function applyToSelected(activate) {
                const selectedInputs = Array.from(list.querySelectorAll('.fpt-bulk-lot-check:checked'));
                if (!selectedInputs.length) throw new Error('Выберите хотя бы один лот.');
                const selectedLots = selectedInputs.map(input => ({
                    id: input.dataset.offerId,
                    offerId: input.dataset.offerId,
                    nodeId: input.dataset.nodeId,
                    title: input.closest('.fpt-bulk-lot-row')?.querySelector('.fpt-bulk-lot-name')?.textContent || input.dataset.offerId
                }));
                const changes = activate ? {} : makeChangePayload();
                if (!activate && !Object.keys(changes).length) throw new Error('Укажите хотя бы одно изменение.');

                if (selectedLots.length > 10) {
                    const countText = `${selectedLots.length} ${root.FPTPopupUI.pluralize(selectedLots.length, ['лот', 'лота', 'лотов'])}`;
                    const summaryText = activate
                        ? `Будет активировано ${countText}. Продолжить?`
                        : `Будет изменено ${countText}. ${reviewSummary.textContent}. Продолжить?`;
                    if (!window.confirm(summaryText)) return;
                }

                const runButton = activate ? activateButton : applyButton;
                const controller = new AbortController();
                dialog.setBusy(true, { onStop: () => controller.abort() });
                runButton.textContent = activate ? 'Активируем…' : 'Применяем…';
                progress.hidden = false;
                log.replaceChildren();
                const appendLog = (message, isError = false) => {
                    const row = node('div', isError ? 'fpt-bulk-log-row--error' : '', message);
                    log.appendChild(row);
                    log.scrollTop = log.scrollHeight;
                };

                try {
                    const actionId = activate ? 'fp-bulk-activate-btn' : 'fp-bulk-apply-btn';
                    const response = await root.fptPopupActions.run(PAGE_ID, actionId, {
                        lots: selectedLots,
                        changes,
                        signal: controller.signal,
                        onProgress: state => {
                            const current = Number(state.processed) || 0;
                            const total = Number(state.total) || selectedLots.length;
                            const percent = Math.round(current / Math.max(1, total) * 100);
                            progressBar.style.width = `${percent}%`;
                            progressTrack.setAttribute('aria-valuenow', String(percent));
                            progressText.textContent = `${activate ? 'Активировано' : 'Обработано'} ${current} из ${total}`;
                            if (state.result) {
                                appendLog(state.result.success
                                    ? `Лот ${state.result.offerId}: готово`
                                    : `Лот ${state.result.offerId}: ${state.result.error || 'ошибка'}`,
                                !state.result.success);
                            }
                        }
                    });
                    if (!response?.results) throw new Error(response?.error || 'Не удалось обработать выбранные лоты.');
                    const failed = response.results.length - response.successCount;
                    progressText.textContent = `Готово: ${response.successCount} из ${response.results.length}`;
                    showToast(popup, failed
                        ? `Обработано ${response.successCount} ${root.FPTPopupUI.pluralize(response.successCount, ['лот', 'лота', 'лотов'])}; ошибок: ${failed}.`
                        : `Готово: ${response.successCount} ${root.FPTPopupUI.pluralize(response.successCount, ['лот', 'лота', 'лотов'])} обработано.`);
                    runButton.textContent = activate ? 'Активировать' : 'Применить изменения';
                } catch (error) {
                    appendLog(error.message || 'Не удалось применить изменения.', true);
                    progressText.textContent = 'Обработка остановлена.';
                    runButton.textContent = activate ? 'Повторить активацию' : 'Повторить изменения';
                    showToast(popup, error.message || 'Не удалось применить изменения.', error?.name === 'AbortError' ? 'warning' : 'error');
                } finally {
                    dialog.setBusy(false);
                }
            }

            applyButton.addEventListener('click', async () => {
                try { await applyToSelected(false); }
                catch (error) { showToast(popup, error.message || 'Проверьте настройки изменений.', 'error'); }
            });
            activateButton.addEventListener('click', async () => {
                try { await applyToSelected(true); }
                catch (error) { showToast(popup, error.message || 'Выберите лоты для активации.', 'error'); }
            });
            dialog.focusInitial();
        }

        exportButton.addEventListener('click', openExportDialog);
        importButton.addEventListener('click', () => {
            if (currentTask) {
                showToast(popup, 'Сначала завершите текущий импорт.', 'warning');
                return;
            }
            fileInput.click();
        });
        bulkButton.addEventListener('click', openBulkEditor);
        const startImport = async file => {
            if (!file) return;
            if (currentTask) {
                showToast(popup, 'Сначала завершите текущий импорт.', 'warning');
                fileInput.value = '';
                return;
            }
            importButton.disabled = true;
            updateImportStatus(null, true, 'Запускаем импорт…');
            try {
                const lots = JSON.parse(await file.text());
                if (!Array.isArray(lots) || !lots.length) throw new Error('Файл пуст или имеет неверный формат.');
                const response = await root.fptPopupActions.run(PAGE_ID, 'lot-io-import-btn', {
                    lots,
                    fileName: file.name
                });
                assertSuccessfulResponse(response);
                await refreshPendingImports();
                showToast(popup, `Импорт запущен: ${lots.length} ${root.FPTPopupUI.pluralize(lots.length, ['лот', 'лота', 'лотов'])}.`);
            } catch (error) {
                showToast(popup, error.message || 'Не удалось прочитать файл импорта.', 'error');
            } finally {
                importButton.disabled = Boolean(currentTask);
                if (!currentTask) updateImportStatus(null, false);
                fileInput.value = '';
            }
        };
        fileInput.addEventListener('change', () => startImport(fileInput.files?.[0]));
        let dragDepth = 0;
        const hasFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files');
        const setDragOver = active => importTool.classList.toggle('is-dragover', active);
        importTool.addEventListener('dragenter', event => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            dragDepth += 1;
            setDragOver(!importButton.disabled);
        });
        importTool.addEventListener('dragover', event => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = importButton.disabled ? 'none' : 'copy';
        });
        importTool.addEventListener('dragleave', () => {
            dragDepth = Math.max(0, dragDepth - 1);
            if (!dragDepth) setDragOver(false);
        });
        importTool.addEventListener('drop', event => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            dragDepth = 0;
            setDragOver(false);
            if (importButton.disabled && !currentTask) return;
            const file = event.dataTransfer.files?.[0];
            if (file && !/\.json$/i.test(file.name) && file.type !== 'application/json') {
                showToast(popup, 'Нужен файл резервной копии в формате JSON.', 'error');
                return;
            }
            startImport(file);
        });

        const onProgress = event => {
            const detail = event?.detail;
            if (!detail) return;
            if (detail.finished) {
                importRefreshVersion++;
                renderCompletedImport(detail.lots);
                const counts = importCounts(detail.lots);
                showToast(popup, `Импорт завершён: добавлено ${counts.success} ${root.FPTPopupUI.pluralize(counts.success, ['лот', 'лота', 'лотов'])}; ошибок ${counts.errors}; пропущено ${counts.skipped}.`, counts.errors ? 'warning' : 'success');
                return;
            }
            if (Array.isArray(detail.lots)) {
                importRefreshVersion++;
                renderTask(detail);
            }
        };
        const onRootPointerDown = event => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target?.closest('.fpt-lot-task-menu-wrap')) {
                const menu = page.querySelector('.fpt-lot-task-menu');
                if (menu && !menu.hidden) {
                    menu.hidden = true;
                    page.querySelector('.fpt-lot-task-menu-trigger')?.setAttribute('aria-expanded', 'false');
                }
            }
            if (!target?.closest('.fpt-category-header') && !target?.closest('.fpt-lot-help-popover') && !helpPanel.hidden) {
                helpPanel.hidden = true;
                header.helpButton?.setAttribute('aria-expanded', 'false');
            }
        };
        root.addEventListener('fpt:lot-import-progress', onProgress);
        root.addEventListener('pointerdown', onRootPointerDown);

        showTaskEmpty(true);
        await refreshPendingImports();
        window.addEventListener('pagehide', () => {
            root.removeEventListener('fpt:lot-import-progress', onProgress);
            root.removeEventListener('pointerdown', onRootPointerDown);
        }, { once: true });
    }

    root.FPTLotIOPage = Object.freeze({ mount: mountLotIOCategory });
})(window);
