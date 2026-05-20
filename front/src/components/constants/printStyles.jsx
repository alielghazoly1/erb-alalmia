// ─── constants/printStyles.jsx ────────────────────────────────────────────────
// أنماط الطباعة المشتركة لكشف الحساب (عملاء + موردين)
// ─────────────────────────────────────────────────────────────────────────────

export const STATEMENT_PRINT_STYLE = `
  @page {
    size: A4 portrait;
    margin: 10mm 8mm 12mm 8mm;
  }
  @page :first { margin-top: 8mm; }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    box-sizing: border-box;
  }

  body {
    font-size: 9.5px;
    color: #1a1a2e;
    background: white;
    direction: rtl;
  }

  /* ─── cards ─── */
  .card {
    box-shadow:    none !important;
    border:        1px solid #d1d5db !important;
    border-radius: 4px !important;
    margin-bottom: 6px !important;
    padding:       6px 8px !important;
    break-inside:  auto !important;
    page-break-inside: auto !important;
  }

  .overflow-x-auto { overflow: visible !important; }

  /* ─── table ─── */
  table {
    width: 100% !important;
    border-collapse: collapse !important;
    font-size: 9px !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
    min-width: unset !important;
  }

  thead { display: table-header-group !important; }
  tfoot { display: table-footer-group !important; }

  thead tr th {
    padding: 5px 6px !important;
    font-size: 9px !important;
  }

  tbody tr {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  tbody tr td { padding: 3px 5px !important; font-size: 9px !important; }
  tfoot tr td { padding: 5px 6px !important; font-size: 9px !important; }

  /* ─── force colors in print ─── */
  thead tr[style*="#1e293b"],
  thead tr[style*="1e293b"] {
    background-color: #1e293b !important;
    color: white !important;
  }

  tfoot tr[style*="#1e293b"],
  tfoot tr[style*="1e293b"] {
    background-color: #1e293b !important;
    color: white !important;
  }

  tr[style*="#f8fafc"] { background-color: #f8fafc !important; }
  tr[style*="#f0fdf4"] { background-color: #f0fdf4 !important; }
  tr[style*="#fef2f2"] { background-color: #fef2f2 !important; }
  tr[style*="#fefce8"] { background-color: #fefce8 !important; }
  tr[style*="#fff7ed"] { background-color: #fff7ed !important; }
  tr[style*="#eff6ff"] { background-color: #eff6ff !important; }
  tr[style*="#dbeafe"] { background-color: #dbeafe !important; }
  tr[style*="#bbf7d0"] { background-color: #bbf7d0 !important; }
  tr[style*="#fed7aa"] { background-color: #fed7aa !important; }
  tr[style*="#fef9c3"] { background-color: #fef9c3 !important; }

  /* ─── print header ─── */
  .print-header-block {
    border-bottom: 2px solid #1e293b !important;
    margin-bottom: 8px !important;
    padding-bottom: 6px !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  /* ─── print footer ─── */
  .print-footer-block {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    margin-top: 10px !important;
  }

  /* ─── show print-only elements ─── */
  .hidden.print\\:block,
  .hidden.print\\:table-row {
    display: block !important;
  }
  .hidden.print\\:table-row {
    display: table-row !important;
  }

  /* ─── hide screen-only elements ─── */
  .print\\:hidden { display: none !important; }
  .no-print      { display: none !important; }

  /* ─── summary print grid ─── */
  .print-summary-grid {
    display: grid !important;
    grid-template-columns: repeat(4, 1fr) !important;
    gap: 4px !important;
    margin: 6px 0 !important;
    break-inside: avoid !important;
  }

  .print-summary-grid > div {
    padding: 4px 6px !important;
    text-align: center !important;
    border: 1px solid #d1d5db !important;
    border-radius: 3px !important;
  }
`;

export const PAY_METHOD_LABEL = {
  cash:     'نقدي',
  instapay: 'انستاباي',
  transfer: 'تحويل',
  check:    'شيك',
  mixed:    'مختلط',
  credit:   'آجل',
};

export const COMPANY_NAME = 'الشركة العالمية للاستيراد والتصدير';
