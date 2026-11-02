// content/features/buyer_price_field.js
// Живое поле «Цена покупателю» на странице создания/редактирования лота.
// Показывает, сколько заплатит покупатель, и обновляется сразу при вводе цены.
// Основной инструмент расчёта цены с двусторонним пересчётом.

(function () {
  'use strict';

  const TEST_PRICE = 100000;
  let multiplier = null; // 1 + комиссия/100 (рублёвая)

  function isEditPage() {
    const h = document.querySelector('h1.page-header');
    return !!h && (h.textContent.includes('Редактирование предложения') || h.textContent.includes('Добавление предложения'));
  }

  function getNodeId() {
    const ni = document.querySelector('input[name="node_id"]');
    if (ni && ni.value) return ni.value;
    const m = (location.search.match(/node=(\d+)/) || location.pathname.match(/\/lots\/(\d+)\//));
    return m ? m[1] : null;
  }

  function parseMoney(v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return NaN;
    return parseFloat(v.replace(/\s/g, '').replace(/[^\d.,]/g, '').replace(',', '.'));
  }

  function setBuyerPriceActiveState(active) {
    window.FPTBuyerPriceActive = !!active;
    const exactBtn = document.querySelector('.set-exact-price');
    if (exactBtn) {
      exactBtn.style.display = active ? 'none' : '';
    }
    window.dispatchEvent(new CustomEvent('fptBuyerPriceStateChange', { detail: { active: !!active } }));
  }

  async function fetchMultiplier(nodeId) {
    try {
      const body = new URLSearchParams();
      body.append('nodeId', String(nodeId));
      body.append('price', String(TEST_PRICE));
      const r = await fetch('/lots/calc', {
        method: 'POST', credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body,
      });
      if (!r.ok) return null;
      const j = await r.json();
      const methods = Array.isArray(j.methods) ? j.methods : null;
      if (!methods) return null;
      const rub = methods.filter((x) => {
        const u = (x && x.unit ? String(x.unit) : '').trim();
        return u === '₽' || /руб/i.test(u);
      });
      // Исключаем подстановку USD/EUR: если рублёвого способа нет, возвращаем null
      if (!rub.length) return null;
      const prices = rub.map((x) => parseMoney(x && x.price)).filter((n) => Number.isFinite(n) && n > 0);
      if (!prices.length) return null;
      const minBuyer = Math.min(...prices);
      return minBuyer / TEST_PRICE;
    } catch { return null; }
  }

  function buildField(priceInput) {
    if (document.getElementById('fpt-buyer-price-group')) return document.getElementById('fpt-buyer-price-input');
    const group = document.createElement('div');
    group.className = 'form-group has-feedback w-200px';
    group.id = 'fpt-buyer-price-group';
    const label = document.createElement('label');
    label.className = 'control-label';
    label.textContent = 'Цена покупателю';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control';
    input.id = 'fpt-buyer-price-input';
    input.placeholder = '—';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    const feedback = document.createElement('span');
    feedback.className = 'form-control-feedback';
    feedback.textContent = '₽';
    const help = document.createElement('p');
    help.className = 'help-block';
    help.textContent = 'Сколько заплатит покупатель.';

    group.appendChild(label);
    group.appendChild(input);
    group.appendChild(feedback);
    group.appendChild(help);

    const priceGroup = priceInput.closest('.form-group') || priceInput.parentElement;
    priceGroup.parentElement.insertBefore(group, priceGroup.nextSibling);
    return input;
  }

  let syncing = false;

  function sellerToBuyer(priceInput, buyerInput) {
    if (multiplier == null || syncing) return;
    syncing = true;
    const seller = parseMoney(priceInput.value);
    if (!Number.isFinite(seller) || seller <= 0) buyerInput.value = '';
    else buyerInput.value = (Math.round(seller * multiplier * 100) / 100).toFixed(2).replace('.', ',');
    syncing = false;
  }

  function buyerToSeller(priceInput, buyerInput) {
    if (multiplier == null || syncing) return;
    syncing = true;
    const buyer = parseMoney(buyerInput.value);
    if (Number.isFinite(buyer) && buyer > 0) {
      const seller = Math.round((buyer / multiplier) * 100) / 100;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(priceInput, String(seller)); else priceInput.value = String(seller);
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    syncing = false;
  }

  async function init() {
    if (!isEditPage()) return;
    const priceInput = document.querySelector('input[name="price"]');
    if (!priceInput || document.getElementById('fpt-buyer-price-group')) return;
    const nodeId = getNodeId();
    if (!nodeId) {
      setBuyerPriceActiveState(false);
      return;
    }

    const buyerInput = buildField(priceInput);
    if (!buyerInput) {
      setBuyerPriceActiveState(false);
      return;
    }

    multiplier = await fetchMultiplier(nodeId);
    if (multiplier == null || !Number.isFinite(multiplier) || multiplier <= 0) {
      const help = document.querySelector('#fpt-buyer-price-group .help-block');
      if (help) help.textContent = 'Комиссия раздела недоступна (нет рублёвого способа оплаты).';
      setBuyerPriceActiveState(false);
      return;
    }

    const syncAvailability = () => {
      const group = document.getElementById('fpt-buyer-price-group');
      const style = group && getComputedStyle(group);
      const available = Boolean(group?.isConnected && group.getClientRects().length
        && style.display !== 'none' && style.visibility !== 'hidden');
      if (window.FPTBuyerPriceActive !== available) setBuyerPriceActiveState(available);
    };
    syncAvailability();
    sellerToBuyer(priceInput, buyerInput);
    priceInput.addEventListener('input', () => sellerToBuyer(priceInput, buyerInput));
    priceInput.addEventListener('keyup', () => sellerToBuyer(priceInput, buyerInput));
    buyerInput.addEventListener('input', () => buyerToSeller(priceInput, buyerInput));
    buyerInput.addEventListener('keyup', () => buyerToSeller(priceInput, buyerInput));

    // Feature settings change a stylesheet in <head>, outside the form observer.
    document.addEventListener('fptDisabledFeaturesApplied', syncAvailability);
    const observer = new MutationObserver(syncAvailability);
    const formRoot = document.querySelector('form.form-offer-editor') || document.body;
    observer.observe(formRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  }

  function boot() {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (isEditPage() && document.querySelector('input[name="price"]')) {
        init();
        clearInterval(iv);
      } else if (tries > 40) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
