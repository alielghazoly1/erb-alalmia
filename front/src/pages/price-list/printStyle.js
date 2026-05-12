/**
 * PRINT_STYLE — CSS للطباعة
 *
 * الهدف: الـ output يطلع نفس الـ PDF بالضبط على A4
 *
 * المشكلة الشائعة: browsers بتعمل scaling وبتضيف margins تلقائية
 * الحل: نحدد كل حاجة بالـ mm وnحذف margins الـ browser
 *
 * استخدام مع react-to-print:
 *   const handlePrint = useReactToPrint({ contentRef: printRef, pageStyle: PRINT_STYLE });
 */
export const PRINT_STYLE = `
  @page {
    size: A4 portrait;
    margin: 0mm;
  }

  @media print {
    html, body {
      margin: 2px !important;
      padding: 0 !important;
      width: 210mm !important;
      height: 297mm !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      font-size: 100% !important;
    }

    /* إخفاء كل حاجة مش الـ print area */
    .no-print {
      display: none !important;
    }

    /* الـ print container */
    .print-area {
      width: 210mm !important;
      min-height: 297mm !important;
      margin: 0 !important;
      padding: 0 !important;
      page-break-inside: avoid;
    }

    /* منع الجداول من الاتقسيم بين صفحتين */
    table {
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }

    /* إزالة box-shadow وborder-radius للطباعة */
    * {
      box-shadow: none !important;
      border-radius: 0 !important;
      text-shadow: none !important;
    }
  }
`;