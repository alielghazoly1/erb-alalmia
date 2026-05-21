// ─── pages/items/components/ItemsPrint.jsx ────────────────────────────────────
// طباعة كشف الأصناف عبر iframe في نفس الصفحة (بدون window.open)
// مُحسَّن لـ 100K+ صنف: A4 landscape، خط صغير، compact rows

// تحويل أي قيمة (Decimal, string, number, null) لـ JS number آمن
const toN = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

// تقريب وشيل أصفار الزيادة  →  "5" مش "5.00"، "22.68" مش "22.680"
const smart = (v, maxDec = 3) => {
  const n = toN(v);
  const rounded = parseFloat(n.toFixed(maxDec));
  if (rounded === 0) return '0';
  let s = rounded.toFixed(maxDec);
  s = s.replace(/\.?0+$/, '');
  return s;
};

// للكميات (أعداد صحيحة في الغالب) — لو فيه كسر يظهر بـ 3 خانات max
const fmtQty = (v) => smart(v, 3);

// للأوزان — دايماً 3 خانات max مع شيل الأصفار
const fmtWgt = (v) => smart(v, 3);

// للإجماليات الكبيرة — نفس المنطق
const fmtTot = (v) => smart(v, 3);

const WH_LABEL = { ramses: 'رمسيس', october: 'أكتوبر', all: 'جميع المخازن' };

export function printItems(items, warehouse = 'all') {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const showRamses  = warehouse === 'all' || warehouse === 'ramses';
  const showOctober = warehouse === 'all' || warehouse === 'october';
  const showTotal   = warehouse === 'all';

  // نجمع بـ JS numbers عادية بعد toN — مش Decimal objects
  let totalRamQty = 0, totalRamWgt = 0, totalOctQty = 0, totalOctWgt = 0;
  for (const i of items) {
    totalRamQty += toN(i.stock?.ramses?.quantity);
    totalRamWgt += toN(i.stock?.ramses?.weight);
    totalOctQty += toN(i.stock?.october?.quantity);
    totalOctWgt += toN(i.stock?.october?.weight);
  }

  const rows = items.map((item, idx) => {
    const ramQty = toN(item.stock?.ramses?.quantity);
    const ramWgt = toN(item.stock?.ramses?.weight);
    const octQty = toN(item.stock?.october?.quantity);
    const octWgt = toN(item.stock?.october?.weight);
    const totQty = ramQty + octQty;
    const totWgt = ramWgt + octWgt;
    return `<tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
      <td class="cen">${idx + 1}</td>
      <td class="code">${item.code}</td>
      <td>${item.name}</td>
      <td class="cen">${item.category || '—'}</td>
      <td class="cen">${item.unit}</td>
      ${showRamses  ? `<td class="cen num ${ramQty > 0 ? 'pos' : ramQty < 0 ? 'neg' : ''}">${fmtQty(ramQty)}</td><td class="cen num ${ramWgt > 0 ? 'pos' : ramWgt < 0 ? 'neg' : ''}">${fmtWgt(ramWgt)}</td>` : ''}
      ${showOctober ? `<td class="cen num ${octQty > 0 ? 'pos' : octQty < 0 ? 'neg' : ''}">${fmtQty(octQty)}</td><td class="cen num ${octWgt > 0 ? 'pos' : octWgt < 0 ? 'neg' : ''}">${fmtWgt(octWgt)}</td>` : ''}
      ${showTotal   ? `<td class="cen num bold ${totQty > 0 ? 'pos' : totQty < 0 ? 'neg' : ''}">${fmtTot(totQty)}</td><td class="cen num bold ${totWgt > 0 ? 'pos' : totWgt < 0 ? 'neg' : ''}">${fmtTot(totWgt)}</td>` : ''}
      <td class="cen"><span class="badge ${item.isRawMaterial ? 'raw' : 'prod'}">${item.isRawMaterial ? 'خامة' : 'منتج'}</span></td>
    </tr>`;
  }).join('');

  const theadCols = `
    <th>م</th><th>الكود</th><th>الاسم</th><th>التصنيف</th><th>الوحدة</th>
    ${showRamses  ? '<th colspan="2" class="wh-r">مخزن رمسيس<br/><span>كرتون / كيلو</span></th>'  : ''}
    ${showOctober ? '<th colspan="2" class="wh-o">مخزن أكتوبر<br/><span>كرتون / كيلو</span></th>' : ''}
    ${showTotal   ? '<th colspan="2" class="wh-t">الإجمالي<br/><span>كرتون / كيلو</span></th>'    : ''}
    <th>النوع</th>
  `;

  const footerCols = `
    <td></td><td></td><td></td><td></td><td></td>
    ${showRamses  ? `<td class="cen bold">${fmtTot(totalRamQty)}</td><td class="cen bold">${fmtTot(totalRamWgt)}</td>` : ''}
    ${showOctober ? `<td class="cen bold">${fmtTot(totalOctQty)}</td><td class="cen bold">${fmtTot(totalOctWgt)}</td>` : ''}
    ${showTotal   ? `<td class="cen bold">${fmtTot(totalRamQty + totalOctQty)}</td><td class="cen bold">${fmtTot(totalRamWgt + totalOctWgt)}</td>` : ''}
    <td></td>
  `;

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>كشف الأصناف — ${WH_LABEL[warehouse]}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Cairo',Arial,sans-serif;font-size:10.5px;color:#1a1a2e;background:#fff;direction:rtl}

    /* Header */
    .hdr{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 10px;border-bottom:3px solid #1e40af;margin-bottom:10px}
    .hdr .company{font-size:20px;font-weight:900;color:#1e40af}
    .hdr .sub{font-size:12px;color:#374151;margin-top:2px}
    .hdr .meta{text-align:left;font-size:11px;color:#6b7280}
    .hdr .meta strong{display:block;font-size:14px;color:#1e40af;font-weight:700}

    /* Stats bar */
    .stats{display:flex;gap:10px;padding:6px 16px;background:#f0f7ff;border-radius:6px;margin:0 0 8px;font-size:11px;flex-wrap:wrap}
    .stats span{color:#374151}.stats b{color:#1e40af}

    /* Table */
    table{width:100%;border-collapse:collapse;font-size:10px}
    thead tr{background:#1e40af;color:#fff}
    th{padding:6px 4px;text-align:center;font-weight:700;border:1px solid #1e3a8a}
    th span{font-size:8.5px;font-weight:400;opacity:.8}
    .wh-r{background:#1d4ed8}.wh-o{background:#6d28d9}.wh-t{background:#065f46}
    tr.even{background:#f9fafb}tr.odd{background:#fff}
    td{padding:5px 4px;border:1px solid #e5e7eb;vertical-align:middle}
    .cen{text-align:center}
    .code{font-family:monospace;font-weight:700;color:#1d4ed8;font-size:10.5px}
    .num{font-variant-numeric:tabular-nums;font-family:monospace}
    .pos{color:#1d4ed8;font-weight:700}
    .neg{color:#dc2626;font-weight:700}
    .bold{font-weight:700}
    .badge{display:inline-block;padding:1px 6px;border-radius:999px;font-size:9px;font-weight:700}
    .badge.raw{background:#fed7aa;color:#9a3412}.badge.prod{background:#bfdbfe;color:#1e40af}
    tfoot tr{background:#e0f2fe}
    tfoot td{font-weight:700;padding:6px 4px;border:1px solid #bfdbfe}
    .footer{margin-top:10px;display:flex;justify-content:space-between;padding:6px 16px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb}

    @media print{
      @page{size:A4 landscape;margin:7mm}
      body{font-size:9.5px}
      .hdr{padding:8px 12px 8px}
    }
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <div class="company">🏭  العالمية</div>
      <div class="sub">كشف الأصناف — ${WH_LABEL[warehouse]}</div>
    </div>
    <div class="meta">
      <strong>${dateStr}</strong>
      <span>الوقت: ${timeStr}</span>
    </div>
  </div>

  <div class="stats">
    <span>إجمالي الأصناف: <b>${items.length}</b></span>
    ${showRamses  ? `<span>رمسيس: <b>${fmtTot(totalRamQty)} كرتون / ${fmtTot(totalRamWgt)} ك</b></span>` : ''}
    ${showOctober ? `<span>أكتوبر: <b>${fmtTot(totalOctQty)} كرتون / ${fmtTot(totalOctWgt)} ك</b></span>` : ''}
    ${showTotal   ? `<span>الكلي: <b>${fmtTot(totalRamQty + totalOctQty)} كرتون / ${fmtTot(totalRamWgt + totalOctWgt)} ك</b></span>` : ''}
  </div>

  <table>
    <thead><tr>${theadCols}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="3" style="text-align:center">الإجمالي الكلي</td>${footerCols}</tr></tfoot>
  </table>

  <div class="footer">
    <span>طُبع بواسطة نظام الإدارة</span>
    <span>${dateStr} — ${timeStr}</span>
  </div>

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  // ── طباعة عبر iframe مخفي (نفس الصفحة، بدون popup blocker) ───────────────
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} }, 2500);
  }, 600);
}
