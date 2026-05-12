// ─── components/PrintHeader.jsx ─────────────────────────────────────────────
// ظاهر في الطباعة فقط — hidden في الشاشة
// يحتوي على اسم الشركة + بيانات الكشف + التاريخ
// ────────────────────────────────────────────────────────────────────────────

const COMPANY_NAME = 'نظام المحاسبة';

export default function PrintHeader({ customer, seasonName }) {
  return (
    <div className="hidden print:block mb-6 border-b-2 pb-4">
      {/* اسم الشركة */}
      <h1 className="text-2xl font-black text-center text-gray-900 mb-1">
        {COMPANY_NAME}
      </h1>

      {/* عنوان الكشف */}
      <h2 className="text-lg font-bold text-center text-gray-700 mb-3">
        كشف حساب عميل
      </h2>

      {/* بيانات أفقية */}
      <div className="flex justify-between text-sm text-gray-600">
        <div className="space-y-0.5">
          <p><span className="font-semibold">العميل:</span> {customer?.name}</p>
          <p><span className="font-semibold">الكود:</span> {customer?.code}</p>
          {customer?.phone && (
            <p><span className="font-semibold">التليفون:</span> {customer.phone}</p>
          )}
        </div>
        <div className="space-y-0.5 text-left">
          <p><span className="font-semibold">الموسم:</span> {seasonName || 'الموسم النشط'}</p>
          <p>
            <span className="font-semibold">تاريخ الطباعة:</span>{' '}
            {new Date().toLocaleDateString('ar-EG')}
          </p>
          <p>
            <span className="font-semibold">الوقت:</span>{' '}
            {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}
