// constants/printStyles.js

export const STATEMENT_PRINT_STYLE = `
  @page {
    size: A4 portrait;
    margin: 12mm 10mm 14mm 10mm;
  }
  @page :first { margin-top: 10mm; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
  }
  body { font-size: 10px; color: #1a1a2e; background: white; direction: rtl; }

  .card {
    box-shadow: none !important;
    border: 1px solid #d1d5db !important;
    border-radius: 4px !important;
    margin-bottom: 8px !important;
    padding: 8px 10px !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
  .card-no-break {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  .overflow-x-auto { overflow: visible !important; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tbody tr { break-inside: avoid !important; page-break-inside: avoid !important; }
  thead tr th { padding: 5px 7px !important; font-size: 9.5px !important; }
  tbody tr td { padding: 3.5px 7px !important; font-size: 9.5px !important; }
  tfoot tr td { padding: 5px 7px !important; font-size: 9.5px !important; }

  .print-stat-grid {
    display: grid !important;
    grid-template-columns: repeat(4, 1fr) !important;
    gap: 5px !important;
    margin-top: 6px !important;
  }
  .print-stat-grid > div { padding: 5px 7px !important; }
  .print-balance-card { break-inside: avoid !important; page-break-inside: avoid !important; border-width: 2px !important; }
  .print-customer-card { break-inside: avoid !important; page-break-inside: avoid !important; }
  .print-footer { break-inside: avoid !important; page-break-inside: avoid !important; }
  .no-print { display: none !important; }

  tr[style*="#1e293b"] { background-color: #1e293b !important; color: white !important; }
  tr[style*="#0f172a"] { background-color: #0f172a !important; color: white !important; }
  tr[style*="#7c2d12"] { background-color: #7c2d12 !important; color: white !important; }
  tr[style*="#14532d"] { background-color: #14532d !important; color: white !important; }
  tr[style*="#052e16"] { background-color: #052e16 !important; color: white !important; }
  tr[style*="#f8fafc"] { background-color: #f8fafc !important; }
  tr[style*="#f0fdf4"] { background-color: #f0fdf4 !important; }
  tr[style*="#fff7ed"] { background-color: #fff7ed !important; }
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