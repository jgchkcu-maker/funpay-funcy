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

    // The bulk editor's find/replace, templates and price rules live in content/features/bulk_lot_editor.js.
    const bulkEditor = () => root.FPTBulkLotEditor;
    const buildFindRegex = findReplace => bulkEditor().buildFindRegex(findReplace);
    const formatRub = value => `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
    // Amounts are typed into text fields (no spinner, no wheel changes); a comma works as the decimal point.
    const parseAmount = value => {
        const text = String(value).trim().replace(/\s+/g, '').replace(',', '.');
        return text && /^\d*\.?\d+$|^\d+\.$/.test(text) ? Number(text) : NaN;
    };

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
        helpPanel.id = 'fpt-lot-help';
        helpPanel.hidden = true;
        helpPanel.setAttribute('role', 'region');
        helpPanel.setAttribute('aria-label', 'Справка по управлению лотами');
        helpPanel.appendChild(node('h2', '', 'Управление лотами'));
        const helpList = node('ul');
        [
            'Экспорт сохраняет лоты выбранных категорий в файл JSON — это резервная копия и способ перенести лоты.',
            'Импорт создаёт лоты из такого файла. Ход сохраняется: импорт можно отложить, продолжить или пропустить проблемный лот.',
            'Файл можно перетащить прямо на карточку «Импорт из файла».',
            'Массовое редактирование меняет название, описание, цену или активирует выбранные лоты за один запуск.',
            'Расписание — вкладка массового редактора: оно включает и выключает выбранные лоты по недельным окнам.',
            'Лоты в редакторе сгруппированы по категориям: раскройте категорию или отметьте её целиком.'
        ].forEach(text => helpList.appendChild(node('li', '', text)));
        helpPanel.appendChild(helpList);

        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Управление лотами', {
            onHelp: event => {
                const open = helpPanel.hidden;
                helpPanel.hidden = !open;
                event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
        });
        const helpAnchor = node('span', 'fpt-ad-help-anchor');
        header.helpButton.setAttribute('aria-controls', helpPanel.id);
        header.helpButton.before(helpAnchor);
        helpAnchor.append(header.helpButton, helpPanel);

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
        const metricDone = metric('check_circle', 'Обработано');
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
        const bulkTool = tool('bulk', 'edit_note', 'Массовое редактирование', 'Название, описание, цена (в т. ч. от себестоимости) и активация сразу для многих лотов.');
        bulkTool.appendChild(bulkButton);
        const fileInput = node('input', 'fpt-lot-file-input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.id = 'lot-io-import-file';
        fileInput.setAttribute('aria-label', 'Файл резервной копии лотов');
        // Расписание — только вкладка массового редактора (lot_automation_page.js), отдельной карточки
        // на странице нет. Цена от себестоимости — режим «Себестоимость + N ₽» на вкладке «Цена».
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
                if (currentLot?.status === 'uncertain') {
                    kind = 'warning';
                    text = `Нужна проверка · ${currentIndex} из ${total}: ${currentLot.error || 'Лот мог создаться.'}`;
                } else if (currentLot?.status === 'error') {
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
            if (currentLot && ['pending', 'error', 'uncertain'].includes(currentLot.status)) addAction('Пропустить текущий лот', 'skip');
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
            // uncertain: FunPay не подтвердил создание — лот мог появиться, повтор только по решению продавца.
            const isUncertain = currentLot?.status === 'uncertain';
            const hasError = currentLot?.status === 'error' || isUncertain;
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
            const statusText = isUncertain
                ? `Нужна проверка · ${completed} из ${total}`
                : hasError
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
                node('span', '', isUncertain ? 'Повторить лот' : isPostponed || hasError ? 'Продолжить' : 'Импорт идёт')
            );
            continueButton.id = 'lot-io-continue-btn';
            continueButton.disabled = !(isPostponed || hasError);
            continueButton.addEventListener('click', async () => {
                if (isUncertain && !window.confirm('FunPay не подтвердил создание этого лота — он мог уже появиться. Проверьте список лотов: если лот есть, выберите «Пропустить текущий лот». Создать его ещё раз?')) return;
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

        // The schedule card opens the same editor on its «Расписание» tab.
        async function openBulkEditor({ tab = 'text', trigger = bulkButton } = {}) {
            trigger.disabled = true;
            trigger.setAttribute('aria-busy', 'true');
            try {
                const response = await root.fptPopupActions.run(PAGE_ID, 'fp-bulk-edit-btn');
                const lots = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
                if (!lots.length) throw new Error('Активные лоты не найдены.');
                // Себестоимость, указанная в лотах, нужна для режима «Себестоимость + N ₽».
                let costs = {};
                try { costs = (await root.FPTCostBasis?.getAll()) || {}; } catch (_) {}
                renderBulkDialog(lots, costs, { initialTab: tab });
            } catch (error) {
                showToast(popup, error.message || 'Не удалось загрузить лоты.', 'error');
            } finally {
                trigger.disabled = false;
                trigger.removeAttribute('aria-busy');
            }
        }

        function renderBulkDialog(lots, costs = {}, { initialTab = 'text' } = {}) {
            const costOf = offerId => {
                const cost = costs[String(offerId)];
                return cost && Number(cost.amount) > 0 && (!cost.currency || cost.currency === 'RUB') ? Number(cost.amount) : null;
            };
            // Lots on top, the changes split into tabs below, the summary and the apply button in the footer.
            const dialog = createDialog(popup, 'Массовое редактирование лотов', { wide: true });
            const form = document.createElement('form');
            form.className = 'fpt-bulk-form';
            form.noValidate = true;
            form.innerHTML = `
                <section class="fpt-bulk-lots" aria-label="Лоты">
                    <div class="fpt-bulk-lot-tools">
                        <span class="fpt-bulk-lots-summary"><strong>Лоты</strong> выбрано <strong data-lot-selected>0</strong> из <span data-lot-total></span></span>
                        <input class="fpt-bulk-lot-filter" type="search" placeholder="Фильтр лотов…" aria-label="Фильтр лотов">
                        <button type="button" class="fpt-lot-dialog-button" data-select-visible>Выбрать все</button>
                        <button type="button" class="fpt-lot-dialog-button fpt-bulk-activate-selected" data-activate-selected="true" disabled>Активировать выбранные</button>
                    </div>
                    <div class="fpt-bulk-lots-list" role="group" aria-label="Выберите лоты"></div>
                    <p class="fpt-bulk-filter-empty" hidden>Лоты не найдены.</p>
                </section>
                <div class="fpt-bulk-tabs-row">
                    <div class="fpt-bulk-tabs" role="tablist" aria-label="Что изменить">
                        <span class="fpt-bulk-tabs-pill" aria-hidden="true"></span>
                        <button type="button" class="fpt-bulk-tab" role="tab" id="fptBulkTabText" aria-controls="fptBulkPaneText" data-pane="text">Тексты</button>
                        <button type="button" class="fpt-bulk-tab" role="tab" id="fptBulkTabPrice" aria-controls="fptBulkPanePrice" data-pane="price">Цена</button>
                        <button type="button" class="fpt-bulk-tab" role="tab" id="fptBulkTabFind" aria-controls="fptBulkPaneFind" data-pane="find">Найти и заменить</button>
                        <button type="button" class="fpt-bulk-tab" role="tab" id="fptBulkTabSchedule" aria-controls="fptBulkPaneSchedule" data-pane="schedule">Расписание</button>
                    </div>
                    <button type="button" class="fpt-lot-dialog-button fpt-bulk-reset" disabled>Очистить</button>
                </div>
                <div class="fpt-bulk-panes">
                <div class="fpt-bulk-pane" id="fptBulkPaneText" role="tabpanel" aria-labelledby="fptBulkTabText" data-pane="text">
                    <div class="fpt-bulk-dialog-grid">
                        <div class="fpt-bulk-field"><label for="fptBulkName">Название</label><input id="fptBulkName" type="text" placeholder="Например: {current} — Premium" title="{current} — текущее значение поля, {lotname} — исходное название лота"></div>
                        <div class="fpt-bulk-field"><label for="fptBulkMessage">Сообщение покупателю</label><input id="fptBulkMessage" type="text" placeholder="Не менять"></div>
                        <div class="fpt-bulk-field fpt-bulk-field--wide"><label for="fptBulkDescription">Описание</label><textarea id="fptBulkDescription" rows="3" placeholder="Не менять"></textarea></div>
                    </div>
                </div>
                <div class="fpt-bulk-pane" id="fptBulkPanePrice" role="tabpanel" aria-labelledby="fptBulkTabPrice" data-pane="price" hidden>
                    <div class="fpt-bulk-dialog-grid">
                        <div class="fpt-bulk-field"><label for="fptBulkPriceMode">Как изменить</label>
                            <select id="fptBulkPriceMode">
                                <option value="none">Не менять</option>
                                <option value="set">Установить цену</option>
                                <option value="cost_plus">Себестоимость + N ₽</option>
                                <option value="buyer_set">Цена покупателя с учётом комиссии</option>
                                <option value="round_flat">Округлить</option>
                                <option value="add">Прибавить</option>
                                <option value="sub">Вычесть</option>
                                <option value="pct_up">Поднять на %</option>
                                <option value="pct_down">Снизить на %</option>
                            </select>
                        </div>
                        <div class="fpt-bulk-field"><label for="fptBulkPriceValue" data-price-value-label>Сумма</label>
                            <span class="fpt-bulk-suffix fpt-bulk-price-value"><input id="fptBulkPriceValue" type="text" inputmode="decimal" autocomplete="off" placeholder="0" disabled><span class="fpt-bulk-suffix-unit fpt-bulk-price-unit" aria-hidden="true">₽</span></span>
                            <select id="fptBulkPriceStep" hidden>
                                <option value="1">до 1 ₽</option><option value="5">до 5 ₽</option><option value="10" selected>до 10 ₽</option>
                                <option value="50">до 50 ₽</option><option value="100">до 100 ₽</option><option value="500">до 500 ₽</option><option value="1000">до 1000 ₽</option>
                            </select>
                        </div>
                        <div class="fpt-bulk-field"><label for="fptBulkPriceMinimum">Не ниже</label>
                            <span class="fpt-bulk-suffix"><input id="fptBulkPriceMinimum" type="text" inputmode="decimal" autocomplete="off" placeholder="Без ограничения"><span class="fpt-bulk-suffix-unit" aria-hidden="true">₽</span></span>
                        </div>
                        <div class="fpt-bulk-field fpt-bulk-field--check"><label class="fpt-lot-check-row"><input id="fptBulkPriceRound" type="checkbox"> Округлять до целого</label></div>
                    </div>
                    <p class="fpt-bulk-price-hint" aria-live="polite" hidden></p>
                </div>
                <div class="fpt-bulk-pane" id="fptBulkPaneFind" role="tabpanel" aria-labelledby="fptBulkTabFind" data-pane="find" hidden>
                    <div class="fpt-bulk-dialog-grid">
                        <div class="fpt-bulk-field"><label for="fptBulkFind">Найти</label><input id="fptBulkFind" type="text" placeholder="Фрагмент текста"></div>
                        <div class="fpt-bulk-field"><label for="fptBulkReplace">Заменить на</label><input id="fptBulkReplace" type="text" placeholder="Новый текст"></div>
                        <div class="fpt-bulk-field"><span class="fpt-bulk-field-label">Где искать</span>
                            <div class="fpt-bulk-checks">
                                <label class="fpt-lot-check-row"><input id="fptBulkFindName" type="checkbox" checked> Название</label>
                                <label class="fpt-lot-check-row"><input id="fptBulkFindDesc" type="checkbox" checked> Описание</label>
                                <label class="fpt-lot-check-row"><input id="fptBulkFindMessage" type="checkbox"> Сообщение</label>
                            </div>
                        </div>
                        <div class="fpt-bulk-field"><span class="fpt-bulk-field-label">Как искать</span>
                            <div class="fpt-bulk-checks">
                                <label class="fpt-lot-check-row"><input id="fptBulkRegex" type="checkbox"> RegEx</label>
                                <label class="fpt-lot-check-row"><input id="fptBulkCase" type="checkbox"> Регистр</label>
                                <label class="fpt-lot-check-row"><input id="fptBulkWholeWord" type="checkbox"> Целые слова</label>
                                <label class="fpt-lot-check-row"><input id="fptBulkAll" type="checkbox" checked> Все совпадения</label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="fpt-bulk-pane fpt-bulk-pane--schedule" id="fptBulkPaneSchedule" role="tabpanel" aria-labelledby="fptBulkTabSchedule" data-pane="schedule" hidden></div>
                </div>
                <p class="fpt-bulk-validation-error" role="alert" hidden></p>
                <div class="fpt-bulk-preview" aria-live="polite" hidden>
                    <strong class="fpt-bulk-preview-title">Название после изменений</strong>
                    <div class="fpt-bulk-preview-items"></div>
                    <p class="fpt-bulk-preview-more"></p>
                </div>
                <div class="fpt-bulk-progress" hidden>
                    <div class="fpt-bulk-progress-track" role="progressbar" aria-label="Ход массового редактирования" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="fpt-bulk-progress-fill"></div></div>
                    <div class="fpt-bulk-progress-text" role="status" aria-live="polite"></div>
                    <div class="fpt-bulk-log" aria-live="polite"></div>
                </div>`;
            dialog.body.appendChild(form);

            const activateButton = form.querySelector('.fpt-bulk-activate-selected');
            const filterEmpty = form.querySelector('.fpt-bulk-filter-empty');
            const resetButton = form.querySelector('.fpt-bulk-reset');
            const preview = form.querySelector('.fpt-bulk-preview');
            const previewItems = form.querySelector('.fpt-bulk-preview-items');
            const previewMore = form.querySelector('.fpt-bulk-preview-more');
            const panes = form.querySelector('.fpt-bulk-panes');
            // Text-like change fields only; the lot filter is type="search" and is not a change,
            // and the schedule tab saves its own rules.
            const changeFields = () => Array.from(form.querySelectorAll('.fpt-bulk-pane:not([data-pane="schedule"]) :is(input[type="text"], textarea)'));
            const reviewSummary = node('p', 'fpt-bulk-review-summary', 'Выберите лоты');
            reviewSummary.setAttribute('role', 'status');
            dialog.footer.appendChild(reviewSummary);

            const tabList = form.querySelector('.fpt-bulk-tabs');
            const tabs = Array.from(form.querySelectorAll('.fpt-bulk-tab'));
            let activePane = 'text';
            const selectTab = (pane, focus = false) => {
                activePane = pane;
                form.dataset.pane = pane;
                tabs.forEach((tab, index) => {
                    const active = tab.dataset.pane === pane;
                    tab.setAttribute('aria-selected', String(active));
                    tab.tabIndex = active ? 0 : -1;
                    if (!active) return;
                    tabList.style.setProperty('--bulk-tab-index', String(index));
                    if (focus) tab.focus();
                });
                form.querySelectorAll('.fpt-bulk-pane').forEach(element => { element.hidden = element.dataset.pane !== pane; });
                panes.scrollTop = 0;
                refreshReview();
            };
            tabs.forEach((tab, index) => {
                tab.addEventListener('click', () => selectTab(tab.dataset.pane));
                tab.addEventListener('keydown', event => {
                    const last = tabs.length - 1;
                    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
                    if (next === undefined) return;
                    event.preventDefault();
                    selectTab(tabs[next].dataset.pane, true);
                });
            });
            const totalElement = form.querySelector('[data-lot-total]');
            const selectedElement = form.querySelector('[data-lot-selected]');
            const list = form.querySelector('.fpt-bulk-lots-list');
            let refreshReview = () => {};
            let syncSelection = () => {};
            const selectedCount = () => {
                selectedElement.textContent = String(list.querySelectorAll('.fpt-bulk-lot-check:checked').length);
                syncSelection();
                refreshReview();
            };

            // Lots are grouped by category; groups start collapsed and open on click or on a filter match.
            const groups = new Map();
            let filterQuery = '';
            const groupRows = group => Array.from(group.body.querySelectorAll('.fpt-bulk-lot-row'));
            const isChecked = row => row.querySelector('.fpt-bulk-lot-check').checked;
            const renderGroup = group => {
                const rows = groupRows(group);
                const visible = rows.filter(row => !row.hidden);
                const checked = rows.filter(isChecked).length;
                group.element.hidden = Boolean(filterQuery) && !visible.length;
                const expanded = filterQuery ? group.filterOpen ?? visible.length > 0 : group.open;
                group.body.hidden = !expanded;
                group.toggle.setAttribute('aria-expanded', String(expanded));
                group.element.dataset.open = String(expanded);
                group.element.dataset.hasError = String(rows.some(row => row.dataset.result === 'error'));
                group.check.checked = rows.length > 0 && checked === rows.length;
                group.check.indeterminate = checked > 0 && checked < rows.length;
                group.count.textContent = checked ? `${checked} из ${rows.length}` : String(rows.length);
            };
            const groupFor = categoryName => {
                const key = categoryName || 'Без категории';
                if (groups.has(key)) return groups.get(key);
                const element = node('div', 'fpt-bulk-group');
                element.dataset.category = key;
                const head = node('div', 'fpt-bulk-group-head');
                const check = node('input', 'fpt-bulk-group-check');
                check.type = 'checkbox';
                check.setAttribute('aria-label', `Выбрать все лоты категории «${key}»`);
                const toggle = node('button', 'fpt-bulk-group-toggle');
                toggle.type = 'button';
                const chevron = icon('chevron_right');
                chevron.classList.add('fpt-bulk-group-chevron');
                const count = node('span', 'fpt-bulk-group-count');
                const name = node('span', 'fpt-bulk-group-name', key);
                name.title = key;
                toggle.append(chevron, name, count);
                const body = node('div', 'fpt-bulk-group-body');
                body.id = `fptBulkGroup${groups.size + 1}`;
                body.setAttribute('role', 'group');
                body.setAttribute('aria-label', key);
                toggle.setAttribute('aria-controls', body.id);
                head.append(check, toggle);
                element.append(head, body);
                list.appendChild(element);
                const group = { key, element, body, check, toggle, count, open: false, filterOpen: undefined };
                toggle.addEventListener('click', () => {
                    const expanded = toggle.getAttribute('aria-expanded') === 'true';
                    if (filterQuery) group.filterOpen = !expanded;
                    else group.open = !expanded;
                    renderGroup(group);
                });
                // The list's change listener recounts after the rows are updated here.
                check.addEventListener('change', () => {
                    groupRows(group).filter(row => !row.hidden).forEach(row => { row.querySelector('.fpt-bulk-lot-check').checked = check.checked; });
                });
                groups.set(key, group);
                return group;
            };
            const openGroupsWith = predicate => groups.forEach(group => {
                if (!groupRows(group).some(predicate)) return;
                group.open = true;
                group.filterOpen = filterQuery ? true : undefined;
            });
            const addLotRow = (lot, { hiddenFromProfile = false } = {}) => {
                const label = node('label', 'fpt-bulk-lot-row');
                const checkbox = node('input', 'fpt-bulk-lot-check');
                checkbox.type = 'checkbox';
                checkbox.dataset.offerId = String(lot.offerId ?? lot.id ?? '');
                checkbox.dataset.nodeId = String(lot.nodeId ?? '');
                const name = node('span', 'fpt-bulk-lot-name', lot.title || 'Лот без названия');
                name.title = lot.title || '';
                const schedule = node('span', 'fpt-bulk-lot-schedule');
                schedule.hidden = true;
                const cost = costOf(lot.offerId ?? lot.id);
                const costTag = node('span', 'fpt-bulk-lot-cost', cost === null ? '' : `себест. ${formatRub(cost)}`);
                costTag.hidden = cost === null;
                const status = node('span', 'fpt-bulk-lot-status');
                status.hidden = true;
                const category = hiddenFromProfile ? 'Не на витрине' : lot.categoryName || '';
                label.dataset.category = category;
                label.append(checkbox, name, schedule, costTag, status);
                label.dataset.search = `${lot.title || ''} ${lot.categoryName || ''} ${lot.offerId || lot.id || ''}`.toLocaleLowerCase('ru');
                const group = groupFor(category);
                group.body.appendChild(label);
                return label;
            };
            lots.forEach(lot => addLotRow(lot));
            const renderGroups = () => groups.forEach(renderGroup);
            const updateTotal = () => { totalElement.textContent = String(list.querySelectorAll('.fpt-bulk-lot-row').length); };
            updateTotal();
            if (groups.size === 1) groups.forEach(group => { group.open = true; });
            const lotRows = () => Array.from(list.querySelectorAll('.fpt-bulk-lot-row'));
            list.addEventListener('change', selectedCount);
            form.querySelector('.fpt-bulk-lot-filter').addEventListener('input', event => {
                filterQuery = event.target.value.trim().toLocaleLowerCase('ru');
                lotRows().forEach(row => {
                    row.hidden = Boolean(filterQuery) && !row.dataset.search.includes(filterQuery);
                });
                groups.forEach(group => { group.filterOpen = undefined; });
                filterEmpty.hidden = lotRows().some(row => !row.hidden);
                syncSelection();
                refreshReview();
            });
            const selectVisible = form.querySelector('[data-select-visible]');
            selectVisible.addEventListener('click', () => {
                const rows = lotRows().filter(row => !row.hidden);
                const shouldCheck = rows.some(row => !isChecked(row));
                rows.forEach(row => { row.querySelector('.fpt-bulk-lot-check').checked = shouldCheck; });
                selectedCount();
            });
            syncSelection = () => {
                renderGroups();
                const rows = lotRows().filter(row => !row.hidden);
                selectVisible.textContent = rows.length && rows.every(isChecked)
                    ? 'Снять выделение' : 'Выбрать все';
                schedulePane?.refreshSelection();
            };
            const selectedLotPayload = () => Array.from(list.querySelectorAll('.fpt-bulk-lot-check:checked')).map(input => ({
                id: input.dataset.offerId,
                offerId: input.dataset.offerId,
                nodeId: input.dataset.nodeId,
                title: input.closest('.fpt-bulk-lot-row')?.querySelector('.fpt-bulk-lot-name')?.textContent || input.dataset.offerId
            }));

            // «Расписание» tab: rules from lot_automation_page.js, bound to the lots checked above.
            // Each row shows the rule it is bound to; lots the schedule switched off are not on the
            // public profile, so they are added from the bindings.
            const schedulePaneElement = form.querySelector('#fptBulkPaneSchedule');
            const applyScheduleState = state => {
                const bindings = Array.isArray(state.bindings) ? state.bindings : [];
                const ruleOf = new Map(bindings.filter(binding => binding.ruleId).map(binding => [String(binding.offerId), binding]));
                ruleOf.forEach((binding, offerId) => {
                    if (rowByOfferId(offerId)) return;
                    const lot = { offerId, nodeId: binding.nodeId || '', title: binding.title || `Лот #${offerId}` };
                    lots.push(lot);
                    addLotRow(lot, { hiddenFromProfile: true });
                });
                lotRows().forEach(row => {
                    const binding = ruleOf.get(row.querySelector('.fpt-bulk-lot-check').dataset.offerId);
                    const badge = row.querySelector('.fpt-bulk-lot-schedule');
                    const ruleName = binding ? state.ruleName(binding.ruleId) : '';
                    badge.hidden = !ruleName;
                    badge.replaceChildren(...(ruleName ? [icon('schedule'), node('span', '', ruleName)] : []));
                    badge.title = ruleName ? `Расписание: ${ruleName}` : '';
                });
                updateTotal();
                selectedCount();
            };
            let schedulePane = null;
            if (root.FPTLotAutomationPage?.mountSchedulePane && root.FPTAutomationUI) {
                schedulePane = root.FPTLotAutomationPage.mountSchedulePane(schedulePaneElement, {
                    dialog, getSelectedLots: selectedLotPayload, onState: applyScheduleState
                });
            } else {
                schedulePaneElement.appendChild(node('p', 'fpt-bulk-schedule-unavailable', 'Расписание недоступно. Обновите страницу FunPay.'));
            }
            const priceMode = form.querySelector('#fptBulkPriceMode');
            const priceValue = form.querySelector('#fptBulkPriceValue');
            const priceStep = form.querySelector('#fptBulkPriceStep');
            const priceUnit = form.querySelector('.fpt-bulk-price-unit');
            const priceValueWrap = form.querySelector('.fpt-bulk-price-value');
            const priceValueLabel = form.querySelector('[data-price-value-label]');
            // The label names the number for the chosen mode, so no separate hint is needed.
            const PRICE_VALUE_LABELS = { set: 'Новая цена', cost_plus: 'Сколько добавить', buyer_set: 'Цена для покупателя', round_flat: 'Округлить до',
                add: 'Сколько прибавить', sub: 'Сколько вычесть', pct_up: 'На сколько процентов', pct_down: 'На сколько процентов' };
            priceMode.addEventListener('change', () => {
                const flat = priceMode.value === 'round_flat';
                priceValue.disabled = priceMode.value === 'none' || flat;
                priceValueWrap.hidden = flat;
                priceStep.hidden = !flat;
                priceUnit.textContent = ['pct_up', 'pct_down'].includes(priceMode.value) ? '%' : '₽';
                priceValueLabel.textContent = PRICE_VALUE_LABELS[priceMode.value] || 'Сумма';
                priceValueLabel.htmlFor = flat ? 'fptBulkPriceStep' : 'fptBulkPriceValue';
                if (priceMode.value === 'none' || flat) priceValue.value = '';
                refreshReview();
            });

            const progress = form.querySelector('.fpt-bulk-progress');
            const progressBar = form.querySelector('.fpt-bulk-progress-fill');
            const progressTrack = form.querySelector('.fpt-bulk-progress-track');
            const progressText = form.querySelector('.fpt-bulk-progress-text');
            const log = form.querySelector('.fpt-bulk-log');
            const applyButton = addDialogButton(dialog.footer, 'Применить изменения', { primary: true });
            addDialogButton(dialog.footer, 'Закрыть', { onClick: dialog.close });
            const retryFailed = node('button', 'fpt-lot-dialog-button fpt-bulk-retry', 'Выбрать лоты с ошибками');
            retryFailed.type = 'button';
            retryFailed.hidden = true;
            progress.appendChild(retryFailed);
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
                    const price = { mode };
                    if (mode === 'round_flat') price.step = Number(priceStep.value) || 1;
                    else {
                        // An empty amount only blocks «Применить»; it is not an error worth a message.
                        if (!priceValue.value.trim()) throw Object.assign(new Error('Укажите сумму.'), { quiet: true });
                        price.value = parseAmount(priceValue.value);
                        if (!Number.isFinite(price.value) || price.value < 0) throw new Error('Сумма должна быть положительным числом.');
                        if (mode === 'pct_down' && price.value > 100) throw new Error('Снизить цену можно не больше чем на 100%.');
                    }
                    if (form.querySelector('#fptBulkPriceRound').checked) price.round = true;
                    const minimum = form.querySelector('#fptBulkPriceMinimum').value.trim();
                    if (minimum) {
                        price.minimum = parseAmount(minimum);
                        if (!Number.isFinite(price.minimum) || price.minimum < 0) throw new Error('«Не ниже» должно быть положительным числом.');
                    }
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
                        try { buildFindRegex(changes.findReplace); }
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
                    buildFindRegex({
                        find, regex: true,
                        wholeWord: form.querySelector('#fptBulkWholeWord').checked,
                        caseSensitive: form.querySelector('#fptBulkCase').checked
                    });
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
                let blocked = false;
                try { changes = makeChangePayload(); }
                catch (error) { changes = {}; blocked = true; validationMessage = error.quiet ? '' : error.message || 'Проверьте введённые значения.'; }
                if (!validRegex && !validationMessage) validationMessage = regexError.textContent;
                regexError.hidden = !validationMessage;
                if (validationMessage) regexError.textContent = validationMessage;
                const changeLabels = [];
                if (changes.name) changeLabels.push('название');
                if (changes.description) changeLabels.push('описание');
                if (changes.message) changeLabels.push('сообщение');
                if (changes.price) {
                    const modeNames = { set: 'цена', cost_plus: 'цена от себестоимости', buyer_set: 'цена покупателя', round_flat: 'округление цены', add: 'прибавка к цене', sub: 'вычет из цены', pct_up: `цена +${changes.price.value}%`, pct_down: `цена −${changes.price.value}%` };
                    changeLabels.push(modeNames[changes.price.mode] || 'цена');
                }
                if (changes.findReplace) changeLabels.push('поиск и замена');
                const lotsText = `${selectedCountValue} ${root.FPTPopupUI.pluralize(selectedCountValue, ['лот', 'лота', 'лотов'])}`;
                reviewSummary.textContent = !selectedCountValue ? 'Выберите лоты'
                    : changeLabels.length ? `Будет изменено ${lotsText} · ${changeLabels.join(', ')}` : `Выбрано ${lotsText} · укажите изменения`;
                activateButton.disabled = selectedCountValue === 0;
                applyButton.disabled = selectedCountValue === 0 || changeLabels.length === 0 || !validRegex || blocked;
                // The schedule tab writes through its own buttons; «Применить» and «Очистить» belong to the edit tabs.
                const onSchedule = activePane === 'schedule';
                applyButton.hidden = onSchedule;
                resetButton.hidden = onSchedule;
                if (onSchedule) {
                    reviewSummary.textContent = selectedCountValue ? `Выбрано ${lotsText} · привязка к правилу расписания` : 'Выберите лоты для расписания';
                }

                // A dot on a tab keeps changes on the hidden tabs visible.
                const filled = selector => Boolean(form.querySelector(selector).value.trim());
                const dirty = {
                    text: filled('#fptBulkName') || filled('#fptBulkDescription') || filled('#fptBulkMessage'),
                    price: priceMode.value !== 'none',
                    find: filled('#fptBulkFind'),
                    schedule: false
                };
                tabs.forEach(tab => { tab.dataset.dirty = String(dirty[tab.dataset.pane]); });
                resetButton.disabled = !hasFormChanges();
                renderPreview(selectedInputs, changes);
            };
            const hasFormChanges = () => changeFields().some(field => field.value.trim()) || priceMode.value !== 'none';

            // Mirrors bulk_lot_editor.js: find/replace first, then {current} is the replaced value and {lotname} the original title.
            const nextTitle = (title, changes) => {
                let current = title;
                if (changes.findReplace?.fields?.name) {
                    try {
                        const regex = buildFindRegex(changes.findReplace);
                        current = current.replace(regex, changes.findReplace.replace ?? '');
                    } catch (_) {}
                }
                return changes.name ? bulkEditor().applyTemplate(changes.name, current, title) : current;
            };
            const PREVIEW_LIMIT = 3;
            // Only titles get a before/after preview, and only when a change touches the title.
            function renderPreview(selectedInputs, changes) {
                previewItems.replaceChildren();
                const selectedLots = selectedInputs.map(input => lots.find(lot => String(lot.offerId ?? lot.id ?? '') === input.dataset.offerId)).filter(Boolean);
                const touchesTitle = Boolean(changes.name || changes.findReplace?.fields?.name);
                preview.hidden = !touchesTitle || !selectedLots.length;
                (preview.hidden ? [] : selectedLots.slice(0, PREVIEW_LIMIT)).forEach(lot => {
                    const before = lot.title || lot.name || `Лот #${lot.offerId ?? lot.id}`;
                    const after = nextTitle(before, changes);
                    const item = node('div', 'fpt-bulk-preview-item');
                    item.dataset.changed = String(after !== before);
                    item.append(node('p', 'fpt-bulk-preview-before', `До: ${before}`), node('p', 'fpt-bulk-preview-after', `После: ${after}`));
                    previewItems.appendChild(item);
                });
                const rest = preview.hidden ? 0 : selectedLots.length - PREVIEW_LIMIT;
                previewMore.textContent = rest > 0 ? `и ещё ${rest} ${root.FPTPopupUI.pluralize(rest, ['лот', 'лота', 'лотов'])}` : '';
                // Подсказка о цене показывается один раз — под полем цены.
                priceHint.hidden = !changes.price;
                priceHint.textContent = changes.price ? describePrice(changes.price, selectedLots) : '';
            }
            const priceHint = form.querySelector('.fpt-bulk-price-hint');
            // Current seller prices are only known after a lot is opened, so the rule is shown on an example price.
            function describePrice(price, selectedLots = []) {
                if (!price) return '';
                if (price.mode === 'cost_plus') {
                    const withCost = selectedLots.filter(lot => costOf(lot.offerId ?? lot.id) !== null);
                    const exampleCost = withCost.length ? costOf(withCost[0].offerId ?? withCost[0].id) : 100;
                    const missing = selectedLots.length - withCost.length;
                    const text = `Себестоимость ${formatRub(exampleCost)} → цена ${formatRub(bulkEditor().computePrice(0, price, exampleCost))}`;
                    return missing ? `${text}. Без себестоимости: ${missing} — пропустим.` : text;
                }
                if (price.mode === 'buyer_set') {
                    return `Покупатель увидит ${formatRub(price.value)}; ваша цена посчитается с учётом комиссии раздела каждого лота.`;
                }
                if (price.mode === 'set') {
                    return `Цена всех выбранных лотов станет ${formatRub(bulkEditor().computePrice(0, price))}.`;
                }
                const example = 1000;
                return `Пример: ${formatRub(example)} → ${formatRub(bulkEditor().computePrice(example, price))}.`;
            }
            form.addEventListener('input', refreshReview);
            form.addEventListener('change', refreshReview);
            resetButton.addEventListener('click', () => {
                changeFields().forEach(field => { field.value = ''; });
                priceMode.value = 'none';
                priceMode.dispatchEvent(new Event('change', { bubbles: true }));
                selectTab('text');
                form.querySelector('#fptBulkName').focus();
            });
            const rowByOfferId = offerId => list.querySelector(`.fpt-bulk-lot-check[data-offer-id="${CSS.escape(String(offerId))}"]`)?.closest('.fpt-bulk-lot-row');
            const markRow = (result, activate) => {
                const row = rowByOfferId(result.offerId);
                if (!row) return;
                const status = row.querySelector('.fpt-bulk-lot-status');
                row.dataset.result = result.success ? 'success' : 'error';
                status.hidden = false;
                status.replaceChildren(icon(result.success ? 'check_circle' : 'error'));
                status.title = result.success ? (activate ? 'Активирован' : 'Сохранено') : result.error || 'Ошибка';
                if (result.success && typeof result.title === 'string' && result.title.trim()) {
                    const lot = lots.find(item => String(item.offerId ?? item.id ?? '') === String(result.offerId));
                    if (lot) lot.title = result.title;
                    const name = row.querySelector('.fpt-bulk-lot-name');
                    name.textContent = result.title;
                    name.title = result.title;
                    row.dataset.search = `${result.title} ${row.dataset.category} ${result.offerId}`.toLocaleLowerCase('ru');
                }
            };
            retryFailed.addEventListener('click', () => {
                lotRows().forEach(row => {
                    row.querySelector('.fpt-bulk-lot-check').checked = row.dataset.result === 'error';
                });
                openGroupsWith(row => row.dataset.result === 'error');
                selectedCount();
            });
            selectTab(['text', 'price', 'find', 'schedule'].includes(initialTab) ? initialTab : 'text');
            syncSelection();

            async function applyToSelected(activate) {
                const selectedLots = selectedLotPayload();
                if (!selectedLots.length) throw new Error('Выберите хотя бы один лот.');
                const changes = activate ? {} : makeChangePayload();
                if (!activate && !Object.keys(changes).length) throw new Error('Укажите хотя бы одно изменение.');

                if (selectedLots.length > 10) {
                    const countText = `${selectedLots.length} ${root.FPTPopupUI.pluralize(selectedLots.length, ['лот', 'лота', 'лотов'])}`;
                    const summaryText = activate
                        ? `Будет активировано ${countText}. Продолжить?`
                        : `${reviewSummary.textContent}. Продолжить?`;
                    if (!window.confirm(summaryText)) return;
                }

                const runButton = activate ? activateButton : applyButton;
                const controller = new AbortController();
                dialog.setBusy(true, { onStop: () => controller.abort() });
                runButton.textContent = activate ? 'Активируем…' : 'Применяем…';
                progress.hidden = false;
                retryFailed.hidden = true;
                log.replaceChildren();
                lotRows().forEach(row => {
                    delete row.dataset.result;
                    row.querySelector('.fpt-bulk-lot-status').hidden = true;
                });
                const titleOf = offerId => selectedLots.find(lot => String(lot.offerId) === String(offerId))?.title || `Лот ${offerId}`;
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
                                markRow(state.result, activate);
                                const note = state.result.note ? ` ${state.result.note}` : '';
                                appendLog(state.result.success
                                    ? `${titleOf(state.result.offerId)}: готово${note}`
                                    : `${titleOf(state.result.offerId)}: ${state.result.error || 'ошибка'}`,
                                !state.result.success);
                            }
                        }
                    });
                    if (!response?.results) throw new Error(response?.error || 'Не удалось обработать выбранные лоты.');
                    const failed = response.results.length - response.successCount;
                    response.results.forEach(result => markRow(result, activate));
                    retryFailed.hidden = failed === 0;
                    progressText.textContent = failed
                        ? `Готово: ${response.successCount} из ${response.results.length}, ошибок: ${failed}`
                        : `Готово: ${response.successCount} из ${response.results.length}`;
                    showToast(popup, failed
                        ? `Обработано ${response.successCount} ${root.FPTPopupUI.pluralize(response.successCount, ['лот', 'лота', 'лотов'])}; ошибок: ${failed}.`
                        : `Готово: ${response.successCount} ${root.FPTPopupUI.pluralize(response.successCount, ['лот', 'лота', 'лотов'])} обработано.`,
                    failed ? 'warning' : 'success');
                    runButton.textContent = activate ? 'Активировать выбранные' : 'Применить изменения';
                } catch (error) {
                    appendLog(error.message || 'Не удалось применить изменения.', true);
                    progressText.textContent = 'Обработка остановлена.';
                    retryFailed.hidden = !list.querySelector('.fpt-bulk-lot-row[data-result="error"]');
                    runButton.textContent = activate ? 'Повторить активацию' : 'Повторить изменения';
                    showToast(popup, error.message || 'Не удалось применить изменения.', error?.name === 'AbortError' ? 'warning' : 'error');
                } finally {
                    dialog.setBusy(false);
                    openGroupsWith(row => row.dataset.result === 'error');
                    syncSelection();
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
        bulkButton.addEventListener('click', () => openBulkEditor());
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
