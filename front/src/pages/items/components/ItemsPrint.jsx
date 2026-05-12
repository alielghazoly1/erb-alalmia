// ─── pages/items/components/ItemsPrint.jsx ────────────────────────────────────
// منطق الطباعة الاحترافية للأصناف
// printWarehouse: 'ramses' | 'october' | 'all'

const fmt    = (n) => (n || 0).toLocaleString('eg-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => (n || 0).toLocaleString('eg-EG');

const warehouseLabel = { ramses: 'رمسيس', october: 'أكتوبر', all: 'جميع المخازن' };

export function printItems(items, warehouse = 'all') {
  const now   = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const rows = items.map((item, idx) => {
    const ramQty = item.stock?.ramses?.quantity  ?? 0;
    const ramWgt = item.stock?.ramses?.weight    ?? 0;
    const octQty = item.stock?.october?.quantity ?? 0;
    const octWgt = item.stock?.october?.weight   ?? 0;

    // حسب المخزن المطلوب
    const showRamses  = warehouse === 'all' || warehouse === 'ramses';
    const showOctober = warehouse === 'all' || warehouse === 'october';

    return `
      <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
        <td class="center">${idx + 1}</td>
        <td class="code">${item.code}</td>
        <td>${item.name}</td>
        <td class="center">${item.category || '—'}</td>
        <td class="center">${item.unit}</td>
        ${showRamses ? `
          <td class="center num ${ramQty > 0 ? 'pos' : ''}">${fmtQty(ramQty)}</td>
          <td class="center num ${ramWgt > 0 ? 'pos' : ''}">${fmt(ramWgt)}</td>
        ` : ''}
        ${showOctober ? `
          <td class="center num ${octQty > 0 ? 'pos' : ''}">${fmtQty(octQty)}</td>
          <td class="center num ${octWgt > 0 ? 'pos' : ''}">${fmt(octWgt)}</td>
        ` : ''}
        ${warehouse === 'all' ? `
          <td class="center num bold">${fmtQty(ramQty + octQty)}</td>
          <td class="center num bold">${fmt(ramWgt + octWgt)}</td>
        ` : ''}
        <td class="center">
          <span class="badge ${item.isRawMaterial ? 'raw' : 'product'}">
            ${item.isRawMaterial ? 'خامة' : 'منتج'}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const totalRamQty = items.reduce((s, i) => s + (i.stock?.ramses?.quantity  ?? 0), 0);
  const totalRamWgt = items.reduce((s, i) => s + (i.stock?.ramses?.weight    ?? 0), 0);
  const totalOctQty = items.reduce((s, i) => s + (i.stock?.october?.quantity ?? 0), 0);
  const totalOctWgt = items.reduce((s, i) => s + (i.stock?.october?.weight   ?? 0), 0);

  const showRamses  = warehouse === 'all' || warehouse === 'ramses';
  const showOctober = warehouse === 'all' || warehouse === 'october';

  const footerCols = `
    <td></td><td></td><td></td><td></td><td></td>
    ${showRamses  ? `<td class="center num bold">${fmtQty(totalRamQty)}</td><td class="center num bold">${fmt(totalRamWgt)}</td>` : ''}
    ${showOctober ? `<td class="center num bold">${fmtQty(totalOctQty)}</td><td class="center num bold">${fmt(totalOctWgt)}</td>` : ''}
    ${warehouse === 'all' ? `<td class="center num bold">${fmtQty(totalRamQty + totalOctQty)}</td><td class="center num bold">${fmt(totalRamWgt + totalOctWgt)}</td>` : ''}
    <td></td>
  `;

  const theadCols = `
    <th>م</th>
    <th>الكود</th>
    <th>الاسم</th>
    <th>التصنيف</th>
    <th>الوحدة</th>
    ${showRamses  ? '<th colspan="2" class="wh-ramses">مخزن رمسيس<br/><span>كرتون / كيلو</span></th>'  : ''}
    ${showOctober ? '<th colspan="2" class="wh-oct">مخزن أكتوبر<br/><span>كرتون / كيلو</span></th>'   : ''}
    ${warehouse === 'all' ? '<th colspan="2" class="wh-total">الإجمالي<br/><span>كرتون / كيلو</span></th>' : ''}
    <th>النوع</th>
  `;

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>كشف الأصناف — ${warehouseLabel[warehouse]}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Cairo', Arial, sans-serif;
      font-size: 11px;
      color: #1a1a2e;
      background: #fff;
      direction: rtl;
    }
    /* ── Header ── */
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px 12px;
      border-bottom: 3px solid #1e40af;
      margin-bottom: 12px;
    }
    .print-header .company { font-size: 22px; font-weight: 900; color: #1e40af; }
    .print-header .subtitle { font-size: 13px; color: #374151; margin-top: 2px; }
    .print-header .meta { text-align: left; font-size: 11px; color: #6b7280; }
    .print-header .meta strong { display: block; font-size: 15px; color: #1e40af; font-weight: 700; }
    /* ── Stats Bar ── */
    .stats-bar {
      display: flex;
      gap: 12px;
      padding: 8px 20px;
      background: #f0f7ff;
      border-radius: 8px;
      margin: 0 0 12px;
      font-size: 12px;
    }
    .stat-item { display: flex; gap: 6px; align-items: center; }
    .stat-item .label { color: #6b7280; }
    .stat-item .value { font-weight: 700; color: #1e40af; }
    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    thead tr {
      background: #1e40af;
      color: white;
    }
    thead th {
      padding: 8px 6px;
      text-align: center;
      font-weight: 700;
      border: 1px solid #1e3a8a;
    }
    thead th span { font-size: 9px; font-weight: 400; opacity: .8; }
    .wh-ramses  { background: #1d4ed8; }
    .wh-oct     { background: #6d28d9; }
    .wh-total   { background: #065f46; }
    tbody tr.even { background: #f9fafb; }
    tbody tr.odd  { background: #ffffff; }
    tbody tr:hover { background: #eff6ff; }
    td {
      padding: 7px 6px;
      border: 1px solid #e5e7eb;
      vertical-align: middle;
    }
    .center { text-align: center; }
    .code { font-family: monospace; font-weight: 700; color: #1d4ed8; font-size: 11px; }
    .num  { font-variant-numeric: tabular-nums; }
    .pos  { color: #1d4ed8; font-weight: 700; }
    .bold { font-weight: 700; }
    tfoot tr { background: #e0f2fe; }
    tfoot td { font-weight: 700; padding: 8px 6px; border: 1px solid #bfdbfe; }
    .badge { 
      display: inline-block; 
      padding: 2px 8px; 
      border-radius: 999px; 
      font-size: 9.5px; 
      font-weight: 700; 
    }
    .badge.raw     { background: #fed7aa; color: #9a3412; }
    .badge.product { background: #bfdbfe; color: #1e40af; }
    /* ── Footer ── */
    .print-footer {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      padding: 10px 20px;
      font-size: 10px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
    }
    @media print {
      body { font-size: 10px; }
      @page { size: A4 landscape; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div>
      <div class="company">🏭 شركة السيد</div>
      <div class="subtitle">كشف الأصناف — ${warehouseLabel[warehouse]}</div>
    </div>
    <div class="meta">
      <strong>${dateStr}</strong>
      <span>الوقت: ${timeStr}</span>
    </div>
  </div>

  <div class="stats-bar">
    <div class="stat-item">
      <span class="label">إجمالي الأصناف:</span>
      <span class="value">${fmtQty(items.length)}</span>
    </div>
    ${showRamses ? `
    <div class="stat-item">
      <span class="label">مخزن رمسيس:</span>
      <span class="value">${fmtQty(totalRamQty)} كرتون / ${fmt(totalRamWgt)} ك</span>
    </div>` : ''}
    ${showOctober ? `
    <div class="stat-item">
      <span class="label">مخزن أكتوبر:</span>
      <span class="value">${fmtQty(totalOctQty)} كرتون / ${fmt(totalOctWgt)} ك</span>
    </div>` : ''}
    ${warehouse === 'all' ? `
    <div class="stat-item">
      <span class="label">الإجمالي الكلي:</span>
      <span class="value">${fmtQty(totalRamQty + totalOctQty)} كرتون / ${fmt(totalRamWgt + totalOctWgt)} ك</span>
    </div>` : ''}
  </div>

  <table>
    <thead>
      <tr>${theadCols}</tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="bold" style="text-align:center">الإجمالي الكلي</td>
        ${footerCols}
      </tr>
    </tfoot>
  </table>

  <div class="print-footer">
    <span>طُبع بواسطة نظام الإدارة</span>
    <span>${dateStr} — ${timeStr}</span>
  </div>

  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1200,height=800');
  if (!win) { alert('افتح الـ popup blocker'); return; }
  win.document.write(html);
  win.document.close();
}
