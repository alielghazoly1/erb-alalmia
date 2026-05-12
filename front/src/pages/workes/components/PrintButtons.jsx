// ─── components/PrintButtons.jsx ─────────────────────────────────────────────
//  زرارين طباعة: ملخص فقط / كامل مع الأوامر
// ─────────────────────────────────────────────────────────────────────────────
import { useReactToPrint }        from 'react-to-print';
import { STATEMENT_PRINT_STYLE }  from '../../../components/constants/printStyles';

export default function PrintButtons({ summaryRef, fullRef, workerName, seasonLabel }) {
  const docTitle = (type) => `${type} - ${workerName || 'معلم'} - ${seasonLabel || ''}`;

  const printSummary = useReactToPrint({
    contentRef:    summaryRef,
    documentTitle: docTitle('ملخص'),
    pageStyle:     STATEMENT_PRINT_STYLE,
  });

  const printFull = useReactToPrint({
    contentRef:    fullRef,
    documentTitle: docTitle('كشف كامل'),
    pageStyle:     STATEMENT_PRINT_STYLE,
  });

  return (
    <div className="flex gap-2 no-print">
      <button
        onClick={printSummary}
        className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        title="طباعة ملخص المنتجات والخامات فقط"
      >
        🖨️ طباعة ملخص
      </button>
      <button
        onClick={printFull}
        className="flex items-center gap-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        title="طباعة الكشف الكامل مع جميع الأوامر"
      >
        🖨️ طباعة كامل
      </button>
    </div>
  );
}
