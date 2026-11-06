(() => {
  const STORAGE_KEY = 'farnava-premium-v020';
  const defaultState = () => ({
    settings: {
      businessName: 'فرنوا',
      managerName: '',
      phone: '',
      address: '',
      paperSize: 'A4',
      soundEnabled: window.FarnavaConfig?.soundDefault ?? true,
      animationsEnabled: window.FarnavaConfig?.animationsDefault ?? true,
    },
    invoices: [],
    expenses: []
  });

  let state = loadState();
  let currentView = 'dashboard';

  const els = {
    statsGrid: $('#statsGrid'),
    recentInvoices: $('#recentInvoices'),
    recentExpenses: $('#recentExpenses'),
    invoiceList: $('#invoiceList'),
    expenseList: $('#expenseList'),
    invoiceSearch: $('#invoiceSearch'),
    statsChart: $('#statsChart'),
    modalBackdrop: $('#modalBackdrop'),
    modalTitle: $('#modalTitle'),
    modalEyebrow: $('#modalEyebrow'),
    modalBody: $('#modalBody'),
    modalFooter: $('#modalFooter'),
    closeModalBtn: $('#closeModalBtn'),
    quickAddBtn: $('#quickAddBtn'),
    toastRegion: $('#toastRegion'),
    settingsForm: $('#settingsForm'),
    backupFileInput: $('#backupFileInput'),
  };

  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
  function id(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function loadState(){
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return saved ? { ...defaultState(), ...saved, settings: { ...defaultState().settings, ...(saved.settings || {}) } } : defaultState();
    } catch {
      return defaultState();
    }
  }
  function toNum(v){ return Number(String(v ?? '').replace(/,/g,'').trim()) || 0; }
  function formatMoney(v){
    try { return new Intl.NumberFormat('fa-IR').format(Math.round(v || 0)) + ' تومان'; }
    catch { return `${Math.round(v || 0)} تومان`; }
  }
  function formatDate(v){
    const d = v ? new Date(v) : new Date();
    try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'medium'}).format(d); }
    catch { return d.toLocaleDateString('fa-IR'); }
  }
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function monthKey(date){
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function beep(type='ok'){
    if (!state.settings.soundEnabled) return;
    try{
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type === 'error' ? 'sawtooth' : 'sine';
      o.frequency.value = type === 'error' ? 180 : 680;
      g.gain.value = 0.02;
      o.connect(g); g.connect(ac.destination);
      o.start();
      o.frequency.exponentialRampToValueAtTime(type === 'error' ? 120 : 880, ac.currentTime + .12);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + .16);
      o.stop(ac.currentTime + .16);
    } catch {}
  }
  function toast(msg, type='info'){
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    if (type === 'error') div.style.background = '#9f2d2a';
    els.toastRegion.appendChild(div);
    setTimeout(() => div.remove(), 2600);
  }
  function openModal({ title, eyebrow='فرنوا', body='', footer='' }){
    els.modalTitle.textContent = title;
    els.modalEyebrow.textContent = eyebrow;
    els.modalBody.innerHTML = body;
    els.modalFooter.innerHTML = footer;
    els.modalBackdrop.classList.remove('hidden');
  }
  function closeModal(){ els.modalBackdrop.classList.add('hidden'); els.modalBody.innerHTML=''; els.modalFooter.innerHTML=''; }
  function switchView(view){
    currentView = view;
    $all('.view').forEach(x => x.classList.toggle('active', x.dataset.view === view));
    $all('.nav-btn').forEach(x => x.classList.toggle('active', x.dataset.target === view));
  }

  function calcInvoice(inv){
    const items = inv.items || [];
    const subtotal = items.reduce((s, it) => s + toNum(it.qty) * toNum(it.price), 0);
    const discount = toNum(inv.discount);
    const tax = Math.max(0, subtotal - discount) * (toNum(inv.taxPercent) / 100);
    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, total };
  }
  function nextInvoiceNo(){
    const n = state.invoices.length + 1;
    return 'FN-' + String(n).padStart(5,'0');
  }

  function render(){
    renderDashboard();
    renderInvoices();
    renderExpenses();
    renderSettings();
  }

  function renderDashboard(){
    const sales = state.invoices.filter(x => x.type === 'sale').reduce((s, x) => s + calcInvoice(x).total, 0);
    const purchases = state.invoices.filter(x => x.type === 'purchase').reduce((s, x) => s + calcInvoice(x).total, 0);
    const expenses = state.expenses.reduce((s, x) => s + toNum(x.amount), 0);
    const net = sales - purchases - expenses;
    const stats = [
      ['فروش کل', sales, `${state.invoices.filter(x => x.type === 'sale').length} فاکتور فروش`],
      ['خرید کل', purchases, `${state.invoices.filter(x => x.type === 'purchase').length} فاکتور خرید`],
      ['هزینه‌ها', expenses, `${state.expenses.length} هزینه ثبت‌شده`],
      ['سود/مانده', net, 'فروش - خرید - هزینه']
    ];
    els.statsGrid.innerHTML = stats.map(([label,val,hint]) => `
      <div class="stat-card">
        <div class="label">${esc(label)}</div>
        <div class="value">${esc(formatMoney(val))}</div>
        <div class="hint">${esc(hint)}</div>
      </div>
    `).join('');

    const recentInv = [...state.invoices].sort((a,b)=> new Date(b.date)-new Date(a.date)).slice(0,5);
    els.recentInvoices.innerHTML = recentInv.length ? recentInv.map(inv => {
      const c = calcInvoice(inv);
      return `<div class="invoice-card">
        <div class="invoice-head">
          <div>
            <div class="invoice-title">${esc(inv.number)} — ${esc(inv.customerName || 'بدون نام')}</div>
            <div class="invoice-meta">${esc(formatDate(inv.date))}</div>
          </div>
          <div class="badge ${esc(inv.type)}">${inv.type==='purchase'?'خرید':'فروش'}</div>
        </div>
        <div class="invoice-total">${esc(formatMoney(c.total))}</div>
      </div>`;
    }).join('') : '<div class="empty-state">هنوز فاکتوری ثبت نشده است.</div>';

    const recentExp = [...state.expenses].sort((a,b)=> new Date(b.date)-new Date(a.date)).slice(0,5);
    els.recentExpenses.innerHTML = recentExp.length ? recentExp.map(exp => `
      <div class="expense-card">
        <div class="expense-head">
          <div>
            <div class="expense-title">${esc(exp.title)}</div>
            <div class="expense-meta">${esc(formatDate(exp.date))}</div>
          </div>
          <div class="expense-amount">${esc(formatMoney(exp.amount))}</div>
        </div>
      </div>`).join('') : '<div class="empty-state">هنوز هزینه‌ای ثبت نشده است.</div>';

    drawChart();
  }

  function renderInvoices(){
    const q = els.invoiceSearch.value.trim();
    let list = [...state.invoices].sort((a,b)=> new Date(b.date)-new Date(a.date));
    if (q) {
      const query = q.toLowerCase();
      list = list.filter(inv => [inv.number, inv.customerName, ...(inv.items||[]).map(i=>i.title)].join(' ').toLowerCase().includes(query));
    }
    els.invoiceList.innerHTML = list.length ? list.map(inv => {
      const c = calcInvoice(inv);
      return `<article class="invoice-card">
        <div class="invoice-head">
          <div>
            <div class="invoice-title">${esc(inv.number)} — ${esc(inv.customerName || 'بدون نام')}</div>
            <div class="invoice-meta">
              <div>${esc(formatDate(inv.date))}</div>
              <div>${esc((inv.items||[]).length)} قلم • ${esc(inv.paperSize || state.settings.paperSize)}</div>
            </div>
          </div>
          <span class="badge ${esc(inv.type)}">${inv.type==='purchase'?'خرید':'فروش'}</span>
        </div>
        <table class="table-mini"><thead><tr><th>شرح</th><th>تعداد</th><th>قیمت</th></tr></thead><tbody>
          ${(inv.items||[]).slice(0,3).map(it=>`<tr><td>${esc(it.title)}</td><td>${esc(it.qty)}</td><td>${esc(formatMoney(it.price))}</td></tr>`).join('')}
        </tbody></table>
        <div class="invoice-total">${esc(formatMoney(c.total))}</div>
        <div class="stack-actions">
          <button class="secondary-btn" data-action="edit-invoice" data-id="${inv.id}">ویرایش</button>
          <button class="secondary-btn" data-action="export-invoice" data-id="${inv.id}">خروجی</button>
          <button class="secondary-btn" data-action="duplicate-invoice" data-id="${inv.id}">کپی</button>
          <button class="danger-btn" data-action="delete-invoice" data-id="${inv.id}">حذف</button>
        </div>
      </article>`;
    }).join('') : '<div class="empty-state">فاکتوری برای نمایش وجود ندارد.</div>';
  }

  function renderExpenses(){
    const list = [...state.expenses].sort((a,b)=> new Date(b.date)-new Date(a.date));
    els.expenseList.innerHTML = list.length ? list.map(exp => `
      <article class="expense-card">
        <div class="expense-head">
          <div>
            <div class="expense-title">${esc(exp.title)}</div>
            <div class="expense-meta">
              <div>${esc(formatDate(exp.date))}</div>
              <div>${esc(exp.category || 'عمومی')}</div>
            </div>
          </div>
          <div class="expense-amount">${esc(formatMoney(exp.amount))}</div>
        </div>
        <div class="stack-actions">
          <button class="secondary-btn" data-action="edit-expense" data-id="${exp.id}">ویرایش</button>
          <button class="danger-btn" data-action="delete-expense" data-id="${exp.id}">حذف</button>
        </div>
      </article>`).join('') : '<div class="empty-state">هزینه‌ای ثبت نشده است.</div>';
  }

  function renderSettings(){
    const f = els.settingsForm;
    for (const [k,v] of Object.entries(state.settings)) {
      if (!f.elements[k]) continue;
      if (f.elements[k].type === 'checkbox') f.elements[k].checked = !!v;
      else f.elements[k].value = v ?? '';
    }
  }

  function drawChart(){
    const canvas = els.statsChart;
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(320, rect.width * ratio);
    canvas.height = 240 * ratio;
    ctx.scale(ratio, ratio);

    const w = rect.width || canvas.width/ratio;
    const h = 240;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#fbfdff';
    ctx.fillRect(0,0,w,h);

    const months = [];
    const now = new Date();
    for (let i=5;i>=0;i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const key = monthKey(d);
      const label = new Intl.DateTimeFormat('fa-IR-u-ca-persian',{month:'short'}).format(d);
      const sales = state.invoices.filter(x => x.type==='sale' && monthKey(x.date)===key).reduce((s,x)=>s+calcInvoice(x).total,0);
      const expenses = state.expenses.filter(x => monthKey(x.date)===key).reduce((s,x)=>s+toNum(x.amount),0);
      months.push({label,sales,expenses});
    }
    const maxVal = Math.max(1,...months.flatMap(m => [m.sales,m.expenses]));
    const pad = {top:20,right:12,bottom:36,left:12};
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;
    const groupW = innerW / months.length;

    ctx.strokeStyle = '#dce8f2';
    ctx.lineWidth = 1;
    for (let i=0;i<4;i++){
      const y = pad.top + innerH * (i/3);
      ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(w-pad.right,y); ctx.stroke();
    }

    months.forEach((m, idx) => {
      const baseX = pad.left + idx*groupW + groupW*0.18;
      const barW = groupW*0.24;
      const saleH = (m.sales/maxVal)*innerH;
      const expH = (m.expenses/maxVal)*innerH;
      ctx.fillStyle = '#1fb79f';
      roundRect(ctx, baseX, pad.top + innerH - saleH, barW, saleH, 8, true);
      ctx.fillStyle = '#12314e';
      roundRect(ctx, baseX + barW + 8, pad.top + innerH - expH, barW, expH, 8, true);

      ctx.fillStyle = '#60758c';
      ctx.font = '12px Tahoma';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, pad.left + idx*groupW + groupW/2, h - 12);
    });

    ctx.fillStyle='#1fb79f'; ctx.fillRect(14,8,12,12); ctx.fillStyle='#12314e'; ctx.fillRect(82,8,12,12);
    ctx.fillStyle='#60758c'; ctx.font='12px Tahoma'; ctx.textAlign='right';
    ctx.fillText('فروش', 74, 18); ctx.fillText('هزینه', 144, 18);
  }
  function roundRect(ctx,x,y,w,h,r,fill){
    const radius = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.arcTo(x+w,y,x+w,y+h,radius);
    ctx.arcTo(x+w,y+h,x,y+h,radius);
    ctx.arcTo(x,y+h,x,y,radius);
    ctx.arcTo(x,y,x+w,y,radius);
    ctx.closePath();
    if (fill) ctx.fill();
  }

  function invoiceFormHTML(inv = null){
    const invoice = inv || {
      id:'', number: nextInvoiceNo(), type:'sale', date: todayISO(), customerName:'', customerPhone:'', discount:0, taxPercent:9,
      notes:'', paperSize: state.settings.paperSize, items:[{id:id(), title:'', qty:1, price:0}]
    };
    return `
      <form id="invoiceForm" class="form-grid">
        <div class="inline-grid-2">
          <label class="field"><span>شماره فاکتور</span><input class="text-input" name="number" value="${esc(invoice.number)}"></label>
          <label class="field"><span>تاریخ</span><input class="text-input" type="date" name="date" value="${esc(invoice.date)}"></label>
        </div>
        <div class="inline-grid-2">
          <label class="field"><span>نوع</span><select class="text-input" name="type">
            <option value="sale" ${invoice.type==='sale'?'selected':''}>فروش</option>
            <option value="purchase" ${invoice.type==='purchase'?'selected':''}>خرید</option>
          </select></label>
          <label class="field"><span>اندازه خروجی</span><select class="text-input" name="paperSize">
            ${['A4','A5','80mm'].map(s=>`<option value="${s}" ${invoice.paperSize===s?'selected':''}>${s}</option>`).join('')}
          </select></label>
        </div>
        <div class="inline-grid-2">
          <label class="field"><span>نام مشتری/تأمین‌کننده</span><input class="text-input" name="customerName" value="${esc(invoice.customerName)}"></label>
          <label class="field"><span>شماره تماس</span><input class="text-input" name="customerPhone" value="${esc(invoice.customerPhone)}"></label>
        </div>
        <div class="panel" style="padding:12px">
          <div class="panel-head" style="margin-bottom:10px">
            <h3>اقلام فاکتور</h3>
            <button type="button" class="primary-btn" id="addItemBtn">افزودن قلم</button>
          </div>
          <div id="invoiceItems">
            ${(invoice.items||[]).map((it, idx) => itemRowHTML(it, idx)).join('')}
          </div>
        </div>
        <div class="inline-grid-2">
          <label class="field"><span>تخفیف (تومان)</span><input class="text-input" type="number" min="0" name="discount" value="${esc(invoice.discount)}"></label>
          <label class="field"><span>مالیات (%)</span><input class="text-input" type="number" min="0" name="taxPercent" value="${esc(invoice.taxPercent)}"></label>
        </div>
        <label class="field"><span>یادداشت</span><textarea class="text-input" name="notes" rows="3">${esc(invoice.notes)}</textarea></label>
        <div class="print-note">خروجی فاکتور با فونت رسمی و استایل جدا از ظاهر برنامه تولید می‌شود و برای موبایل روی اندازه‌های A4، A5 و 80mm قابل انتخاب است.</div>
      </form>`;
  }
  function itemRowHTML(item, idx){
    return `<div class="item-row" data-item-id="${item.id || id()}">
      <div class="item-row-top">
        <strong>قلم ${idx + 1}</strong>
        <button type="button" class="del-btn" data-action="remove-item">🗑</button>
      </div>
      <label class="field"><span>شرح کالا/خدمت</span><input class="text-input" name="title" value="${esc(item.title || '')}"></label>
      <div class="inline-grid-2">
        <label class="field"><span>تعداد</span><input class="text-input" type="number" min="0" step="0.01" name="qty" value="${esc(item.qty ?? 1)}"></label>
        <label class="field"><span>قیمت واحد (تومان)</span><input class="text-input" type="number" min="0" step="0.01" name="price" value="${esc(item.price ?? 0)}"></label>
      </div>
    </div>`;
  }

  function openInvoiceForm(existingId = null){
    const inv = existingId ? state.invoices.find(x => x.id === existingId) : null;
    openModal({
      title: existingId ? 'ویرایش فاکتور' : 'فاکتور جدید',
      eyebrow: 'فاکتورها',
      body: invoiceFormHTML(inv),
      footer: `<button class="secondary-btn" id="cancelInvoiceBtn">انصراف</button><button class="primary-btn" id="saveInvoiceBtn">ذخیره فاکتور</button>`
    });
    bindInvoiceForm(existingId);
  }
  function bindInvoiceForm(existingId){
    const itemsWrap = $('#invoiceItems');
    $('#addItemBtn').addEventListener('click', () => {
      const idx = itemsWrap.children.length;
      itemsWrap.insertAdjacentHTML('beforeend', itemRowHTML({id:id(), title:'', qty:1, price:0}, idx));
    });
    itemsWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove-item"]');
      if (!btn) return;
      const rows = itemsWrap.querySelectorAll('.item-row');
      if (rows.length <= 1) return toast('حداقل یک قلم باید وجود داشته باشد', 'error');
      btn.closest('.item-row').remove();
      reindexItems();
    });
    $('#cancelInvoiceBtn').onclick = closeModal;
    $('#saveInvoiceBtn').onclick = () => {
      const form = $('#invoiceForm');
      const data = {
        id: existingId || id(),
        number: form.number.value.trim() || nextInvoiceNo(),
        date: form.date.value || todayISO(),
        type: form.type.value,
        customerName: form.customerName.value.trim(),
        customerPhone: form.customerPhone.value.trim(),
        discount: toNum(form.discount.value),
        taxPercent: toNum(form.taxPercent.value),
        notes: form.notes.value.trim(),
        paperSize: form.paperSize.value,
        items: Array.from(itemsWrap.querySelectorAll('.item-row')).map(row => ({
          id: row.dataset.itemId || id(),
          title: row.querySelector('[name="title"]').value.trim(),
          qty: toNum(row.querySelector('[name="qty"]').value),
          price: toNum(row.querySelector('[name="price"]').value)
        })).filter(it => it.title || it.qty || it.price)
      };
      if (!data.customerName) return toast('نام مشتری را وارد کن', 'error');
      if (!data.items.length) return toast('حداقل یک قلم وارد کن', 'error');
      const idx = state.invoices.findIndex(x => x.id === data.id);
      if (idx >= 0) state.invoices[idx] = data; else state.invoices.unshift(data);
      saveState(); render(); closeModal(); toast('فاکتور ذخیره شد'); beep();
      switchView('invoices');
    };
  }
  function reindexItems(){
    Array.from($('#invoiceItems').children).forEach((row, idx) => {
      const strong = row.querySelector('strong');
      if (strong) strong.textContent = `قلم ${idx+1}`;
    });
  }

  function expenseFormHTML(exp = null){
    const e = exp || { id:'', title:'', amount:0, category:'عمومی', date:todayISO(), notes:'' };
    return `<form id="expenseForm" class="form-grid">
      <label class="field"><span>عنوان هزینه</span><input class="text-input" name="title" value="${esc(e.title)}" placeholder="مثلاً اجاره، اینترنت، حمل‌ونقل"></label>
      <div class="inline-grid-2">
        <label class="field"><span>مبلغ (تومان)</span><input class="text-input" type="number" min="0" name="amount" value="${esc(e.amount)}"></label>
        <label class="field"><span>دسته‌بندی</span><input class="text-input" name="category" value="${esc(e.category)}"></label>
      </div>
      <label class="field"><span>تاریخ</span><input class="text-input" type="date" name="date" value="${esc(e.date)}"></label>
      <label class="field"><span>یادداشت</span><textarea class="text-input" name="notes" rows="3">${esc(e.notes || '')}</textarea></label>
    </form>`;
  }
  function openExpenseForm(existingId = null){
    const exp = existingId ? state.expenses.find(x => x.id === existingId) : null;
    openModal({
      title: existingId ? 'ویرایش هزینه' : 'هزینه جدید',
      eyebrow: 'هزینه‌ها',
      body: expenseFormHTML(exp),
      footer: `<button class="secondary-btn" id="cancelExpenseBtn">انصراف</button><button class="primary-btn" id="saveExpenseBtn">ذخیره هزینه</button>`
    });
    $('#cancelExpenseBtn').onclick = closeModal;
    $('#saveExpenseBtn').onclick = () => {
      const f = $('#expenseForm');
      const data = {
        id: existingId || id(),
        title: f.title.value.trim(),
        amount: toNum(f.amount.value),
        category: f.category.value.trim() || 'عمومی',
        date: f.date.value || todayISO(),
        notes: f.notes.value.trim()
      };
      if (!data.title) return toast('عنوان هزینه را وارد کن', 'error');
      const idx = state.expenses.findIndex(x => x.id === data.id);
      if (idx >= 0) state.expenses[idx] = data; else state.expenses.unshift(data);
      saveState(); render(); closeModal(); toast('هزینه ذخیره شد'); beep();
      switchView('expenses');
    };
  }

  function buildInvoiceHTML(inv){
    const business = state.settings;
    const c = calcInvoice(inv);
    const size = inv.paperSize || state.settings.paperSize || 'A4';
    const pageCss = size === 'A5'
      ? '@page{size:A5 portrait;margin:12mm} .doc{max-width:148mm}'
      : size === '80mm'
      ? '@page{size:80mm auto;margin:6mm} .doc{max-width:68mm}'
      : '@page{size:A4 portrait;margin:14mm} .doc{max-width:210mm}';
    const rows = (inv.items||[]).map((it, i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${esc(it.title)}</td>
        <td>${toNum(it.qty)}</td>
        <td>${formatMoney(it.price)}</td>
        <td>${formatMoney(toNum(it.qty)*toNum(it.price))}</td>
      </tr>
    `).join('');
    return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${esc(inv.number)}</title>
    <style>
      body{font-family:Vazirmatn,Vazir,Tahoma,sans-serif;color:#111;background:#fff}
      ${pageCss}
      .doc{margin:auto}
      h1,h2,h3,p{margin:0}
      .head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}
      .title{font-size:26px;font-weight:800}
      .sub{color:#555;font-size:13px;line-height:1.9}
      .meta{border:1px solid #ccc;border-radius:10px;padding:10px;font-size:13px;line-height:1.9}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #222;padding:8px;font-size:13px;text-align:right}
      th{background:#f5f5f5}
      .sum{margin-top:14px;width:min(100%,340px);margin-inline-start:auto}
      .sum div{display:flex;justify-content:space-between;border:1px solid #ccc;border-bottom:none;padding:9px 10px;font-size:13px}
      .sum div:last-child{border-bottom:1px solid #ccc;background:#f5f5f5;font-weight:800}
      .note{margin-top:18px;font-size:12px;line-height:2}
      .top-actions{display:flex;gap:8px;margin-bottom:12px}
      .top-actions button{padding:10px 14px;border-radius:10px;border:1px solid #ccc;background:#fafafa;cursor:pointer}
      @media print {.top-actions{display:none}}
    </style></head><body>
    <div class="doc">
      <div class="top-actions">
        <button onclick="window.print()">چاپ / PDF</button>
        <button onclick="window.close()">بستن</button>
      </div>
      <div class="head">
        <div>
          <div class="title">فاکتور ${inv.type==='purchase'?'خرید':'فروش'}</div>
          <div class="sub">${esc(business.businessName || 'فرنوا')}<br>${esc(business.phone || '')}<br>${esc(business.address || '')}</div>
        </div>
        <div class="meta">
          <div><strong>شماره:</strong> ${esc(inv.number)}</div>
          <div><strong>تاریخ:</strong> ${esc(formatDate(inv.date))}</div>
          <div><strong>نام طرف حساب:</strong> ${esc(inv.customerName || '-')}</div>
          <div><strong>تلفن:</strong> ${esc(inv.customerPhone || '-')}</div>
          <div><strong>اندازه:</strong> ${esc(size)}</div>
        </div>
      </div>
      <table><thead><tr><th>ردیف</th><th>شرح</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sum">
        <div><span>جمع جزء</span><span>${formatMoney(c.subtotal)}</span></div>
        <div><span>تخفیف</span><span>${formatMoney(c.discount)}</span></div>
        <div><span>مالیات</span><span>${formatMoney(c.tax)}</span></div>
        <div><span>مبلغ نهایی</span><span>${formatMoney(c.total)}</span></div>
      </div>
      <div class="note"><strong>یادداشت:</strong> ${esc(inv.notes || '—')}</div>
    </div></body></html>`;
  }

  function downloadBlob(name, blob){
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportWord(inv){
    const html = buildInvoiceHTML(inv);
    const wrapped = `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
    downloadBlob(`${inv.number}.doc`, new Blob([wrapped], {type:'application/msword'}));
    toast('فایل Word دانلود شد'); beep();
  }

  function openPrintPreview(inv){
    const win = window.open('', '_blank');
    if (!win) return toast('مرورگر اجازه بازشدن پنجره جدید را نداد', 'error');
    win.document.open();
    win.document.write(buildInvoiceHTML(inv));
    win.document.close();
    toast('پیش‌نمایش فاکتور باز شد'); beep();
  }

  function exportCanvasImage(inv, mime='image/png'){
    const c = calcInvoice(inv);
    const size = inv.paperSize || 'A4';
    const dims = size === 'A5' ? {w:1100,h:1550} : size === '80mm' ? {w:900,h:1800} : {w:1240,h:1754};
    const canvas = document.createElement('canvas');
    canvas.width = dims.w; canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.direction = 'rtl'; ctx.textAlign = 'right';

    const margin = 70;
    let y = 80;
    ctx.fillStyle = '#111';
    ctx.font = 'bold 42px Tahoma';
    ctx.fillText('فاکتور ' + (inv.type === 'purchase' ? 'خرید' : 'فروش'), canvas.width - margin, y);
    y += 60;
    ctx.font = '24px Tahoma';
    ctx.fillStyle = '#444';
    ctx.fillText(state.settings.businessName || 'فرنوا', canvas.width - margin, y); y += 36;
    if (state.settings.phone) { ctx.fillText(state.settings.phone, canvas.width - margin, y); y += 36; }
    if (state.settings.address) { wrapText(ctx, state.settings.address, canvas.width - margin, y, canvas.width - margin*2, 34); y += 52; }

    y += 20;
    ctx.fillStyle = '#111';
    drawInfoLine(ctx, 'شماره فاکتور', inv.number, canvas.width - margin, y); y += 36;
    drawInfoLine(ctx, 'تاریخ', formatDate(inv.date), canvas.width - margin, y); y += 36;
    drawInfoLine(ctx, 'طرف حساب', inv.customerName || '-', canvas.width - margin, y); y += 50;

    const tableTop = y;
    const cols = [
      {title:'ردیف', w:100},
      {title:'شرح', w: dims.w - margin*2 - 440},
      {title:'تعداد', w:120},
      {title:'قیمت', w:220}
    ];
    let x = margin;
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    const rowH = 48;
    const tableW = cols.reduce((s,c)=>s+c.w,0);
    ctx.strokeRect(x, tableTop, tableW, rowH);
    cols.forEach(col => { ctx.strokeRect(x, tableTop, col.w, rowH); x += col.w; });
    x = margin; ctx.font = 'bold 22px Tahoma';
    cols.forEach(col => {
      ctx.textAlign = 'center';
      ctx.fillText(col.title, x + col.w/2, tableTop + 30);
      x += col.w;
    });
    ctx.textAlign = 'right';
    y = tableTop + rowH;
    ctx.font = '20px Tahoma';
    inv.items.forEach((it, idx) => {
      ctx.strokeRect(margin, y, tableW, rowH);
      let x = margin;
      [String(idx+1), it.title, String(it.qty), formatMoney(it.price)].forEach((val, i) => {
        const col = cols[i];
        ctx.strokeRect(x, y, col.w, rowH);
        ctx.textAlign = i===1 ? 'right' : 'center';
        const tx = i===1 ? x + col.w - 12 : x + col.w/2;
        ctx.fillText(String(val), tx, y + 30);
        x += col.w;
      });
      y += rowH;
    });
    y += 60;
    ctx.textAlign = 'right';
    ctx.font = '24px Tahoma';
    [
      ['جمع جزء', formatMoney(c.subtotal)],
      ['تخفیف', formatMoney(c.discount)],
      ['مالیات', formatMoney(c.tax)],
      ['مبلغ نهایی', formatMoney(c.total)],
    ].forEach(([k,v]) => {
      drawInfoLine(ctx, k, v, canvas.width - margin, y);
      y += 42;
    });
    y += 20;
    if (inv.notes) {
      ctx.font = '20px Tahoma';
      wrapText(ctx, 'یادداشت: ' + inv.notes, canvas.width - margin, y, canvas.width - margin*2, 32);
    }

    canvas.toBlob(blob => {
      const ext = mime === 'image/jpeg' ? 'jpg' : 'png';
      downloadBlob(`${inv.number}.${ext}`, blob);
      toast(`فایل ${ext.toUpperCase()} دانلود شد`);
      beep();
    }, mime, .95);
  }
  function drawInfoLine(ctx, key, value, xRight, y){
    ctx.fillStyle = '#444'; ctx.font = 'bold 22px Tahoma';
    ctx.fillText(`${key}:`, xRight, y);
    ctx.fillStyle = '#111'; ctx.font = '22px Tahoma';
    ctx.fillText(String(value), xRight - 220, y);
  }
  function wrapText(ctx, text, xRight, yStart, maxWidth, lineHeight){
    const words = String(text).split(' ');
    let line = '';
    let y = yStart;
    for (const word of words){
      const test = line ? (line + ' ' + word) : word;
      if (ctx.measureText(test).width > maxWidth && line){
        ctx.fillText(line, xRight, y);
        line = word; y += lineHeight;
      } else line = test;
    }
    if (line) ctx.fillText(line, xRight, y);
  }

  function openExportMenu(id){
    const inv = state.invoices.find(x => x.id === id);
    if (!inv) return;
    const c = calcInvoice(inv);
    openModal({
      title: `خروجی فاکتور ${inv.number}`,
      eyebrow: 'خروجی‌ها',
      body: `
        <div class="panel" style="padding:12px">
          <div class="invoice-title">${esc(inv.customerName || 'بدون نام')}</div>
          <div class="invoice-meta" style="margin-top:8px">
            <div>${esc(formatDate(inv.date))}</div>
            <div>مبلغ نهایی: ${esc(formatMoney(c.total))}</div>
            <div>سایز انتخابی: ${esc(inv.paperSize || state.settings.paperSize)}</div>
          </div>
        </div>
        <div class="export-grid">
          <button class="export-btn" id="exportPdfBtn">چاپ / PDF</button>
          <button class="export-btn" id="exportWordBtn">Word</button>
          <button class="export-btn" id="exportPngBtn">PNG</button>
          <button class="export-btn" id="exportJpgBtn">JPG</button>
        </div>
        <div class="print-note">استایل خروجی رسمی و مستقل از رنگ و قالب داخلی برنامه است و از خانواده فونت Vazir/Vazirmatn/Tahoma استفاده می‌کند.</div>
      `,
      footer: `<button class="secondary-btn" id="closeExportBtn">بستن</button>`
    });
    $('#closeExportBtn').onclick = closeModal;
    $('#exportPdfBtn').onclick = () => openPrintPreview(inv);
    $('#exportWordBtn').onclick = () => exportWord(inv);
    $('#exportPngBtn').onclick = () => exportCanvasImage(inv, 'image/png');
    $('#exportJpgBtn').onclick = () => exportCanvasImage(inv, 'image/jpeg');
  }

  function exportBackup(){
    const payload = { exportedAt: new Date().toISOString(), app: 'Farnava', version: window.FarnavaConfig?.version || '0.2.0', data: state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    downloadBlob(`Farnava-Backup-${stamp}.farnava`, blob);
    toast('فایل بکاپ دانلود شد'); beep();
  }

  function importBackup(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(reader.result);
        const data = parsed.data || parsed;
        if (!data || !Array.isArray(data.invoices) || !Array.isArray(data.expenses)) throw new Error('invalid');
        if (!confirm('اطلاعات فعلی جایگزین شود؟')) return;
        state = { ...defaultState(), ...data, settings: { ...defaultState().settings, ...(data.settings || {}) } };
        saveState(); render(); toast('بازیابی با موفقیت انجام شد'); beep();
      } catch {
        toast('فایل بکاپ معتبر نیست', 'error'); beep('error');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function seedDemo(){
    if (!confirm('داده نمونه ساخته شود؟')) return;
    state.invoices = [
      {id:id(), number:'FN-00001', type:'sale', date:todayISO(), customerName:'مشتری نمونه', customerPhone:'09120000000', discount:50000, taxPercent:9, notes:'تحویل حضوری', paperSize:'A4', items:[{id:id(), title:'خدمات طراحی', qty:1, price:2500000},{id:id(), title:'پشتیبانی', qty:2, price:750000}]},
      {id:id(), number:'FN-00002', type:'purchase', date:todayISO(), customerName:'تأمین‌کننده نمونه', customerPhone:'09123333333', discount:0, taxPercent:0, notes:'خرید اولیه', paperSize:'A5', items:[{id:id(), title:'مواد اولیه', qty:5, price:320000}]}
    ];
    state.expenses = [
      {id:id(), title:'اینترنت', amount:350000, category:'عملیاتی', date:todayISO(), notes:''},
      {id:id(), title:'حمل‌ونقل', amount:480000, category:'لجستیک', date:todayISO(), notes:''}
    ];
    saveState(); render(); toast('داده نمونه ساخته شد'); beep();
  }

  function resetAll(){
    if (!confirm('همه اطلاعات پاک شود؟ این کار برگشت‌پذیر نیست.')) return;
    state = defaultState(); saveState(); render(); toast('همه داده‌ها پاک شد'); beep();
  }

  function bindEvents(){
    $all('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.target)));
    $('#newInvoiceBtn').onclick = () => openInvoiceForm();
    $('#newInvoiceHero').onclick = () => openInvoiceForm();
    $('#newExpenseBtn').onclick = () => openExpenseForm();
    $('#newExpenseHero').onclick = () => openExpenseForm();
    els.quickAddBtn.onclick = () => {
      openModal({
        title: 'افزودن سریع',
        eyebrow: 'عملیات سریع',
        body: '<div class="backup-grid"><button class="primary-btn big-btn" id="quickInvoice">فاکتور جدید</button><button class="secondary-btn big-btn" id="quickExpense">هزینه جدید</button></div>',
        footer: '<button class="secondary-btn" id="quickClose">بستن</button>'
      });
      $('#quickInvoice').onclick = () => { closeModal(); openInvoiceForm(); };
      $('#quickExpense').onclick = () => { closeModal(); openExpenseForm(); };
      $('#quickClose').onclick = closeModal;
    };

    els.invoiceSearch.addEventListener('input', renderInvoices);
    els.closeModalBtn.onclick = closeModal;
    els.modalBackdrop.addEventListener('click', (e) => { if (e.target === els.modalBackdrop) closeModal(); });

    els.invoiceList.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-action]');
      if (!b) return;
      const idv = b.dataset.id;
      const action = b.dataset.action;
      if (action === 'edit-invoice') return openInvoiceForm(idv);
      if (action === 'export-invoice') return openExportMenu(idv);
      if (action === 'duplicate-invoice') {
        const src = state.invoices.find(x => x.id === idv);
        if (!src) return;
        const copy = JSON.parse(JSON.stringify(src));
        copy.id = id(); copy.number = nextInvoiceNo(); copy.date = todayISO();
        state.invoices.unshift(copy); saveState(); render(); toast('فاکتور کپی شد'); beep();
        return;
      }
      if (action === 'delete-invoice') {
        if (!confirm('این فاکتور حذف شود؟')) return;
        state.invoices = state.invoices.filter(x => x.id !== idv); saveState(); render(); toast('فاکتور حذف شد'); beep();
      }
    });

    els.expenseList.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-action]');
      if (!b) return;
      const idv = b.dataset.id;
      const action = b.dataset.action;
      if (action === 'edit-expense') return openExpenseForm(idv);
      if (action === 'delete-expense') {
        if (!confirm('این هزینه حذف شود؟')) return;
        state.expenses = state.expenses.filter(x => x.id !== idv); saveState(); render(); toast('هزینه حذف شد'); beep();
      }
    });

    els.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      state.settings = {
        businessName: f.businessName.value.trim(),
        managerName: f.managerName.value.trim(),
        phone: f.phone.value.trim(),
        address: f.address.value.trim(),
        paperSize: f.paperSize.value,
        soundEnabled: !!f.soundEnabled.checked,
        animationsEnabled: !!f.animationsEnabled.checked
      };
      saveState(); render(); toast('تنظیمات ذخیره شد'); beep();
    });

    $('#exportBackupBtn').onclick = exportBackup;
    $('#importBackupBtn').onclick = () => els.backupFileInput.click();
    els.backupFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) importBackup(file);
      e.target.value = '';
    });
    $('#seedDemoBtn').onclick = seedDemo;
    $('#resetDataBtn').onclick = resetAll;
    window.addEventListener('resize', () => { if (currentView === 'dashboard') drawChart(); });
  }

  bindEvents();
  render();
})();