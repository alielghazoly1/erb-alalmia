import React from 'react';
import { fmt, todayStr, yesterdayStr } from '../cashRegisterConfig';

function StatCard({ label, value, bg, color, sub }) {
  return (
    <div className={`rounded-xl p-3 text-center ${bg}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{fmt(value)}</p>
      {sub && <p className={`text-xs ${sub}`}>ج.م</p>}
    </div>
  );
}

export default function SummaryTab({ summary, loading, summaryDate, setSummaryDate, openAdminOnDate, setTab }) {
  const handleQuick = (label) => {
    setSummaryDate(label === 'اليوم' ? todayStr() : yesterdayStr());
  };

  if (loading) {
    return <div className="card text-center py-12 text-gray-400">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          className="input-field py-1.5 text-sm w-44"
          value={summaryDate}
          onChange={(e) => setSummaryDate(e.target.value)}
        />
        {['اليوم', 'أمس'].map((l) => (
          <button
            key={l}
            onClick={() => handleQuick(l)}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {l}
          </button>
        ))}
      </div>

      {!summary ? null : (
        <>
          {/* Admin treasury */}
          <div className="card">
            <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              👤 خزنة الأدمن (نقدي)
              <span className="text-xs font-normal text-gray-400">الأرقام بالجنيه المصري</span>
            </h2>

            {summary.admins.length === 0 ? (
              <p className="text-center text-gray-400 py-6">مفيش حركات نقدية في هذا اليوم</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {summary.admins.map((a) => (
                  <button
                    key={a.admin._id}
                    onClick={() => openAdminOnDate(a.admin._id, summaryDate)}
                    className="rounded-xl border-2 border-gray-200 bg-white hover:border-blue-300 hover:shadow-md p-3 text-right transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {a.admin.name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{a.admin.name}</p>
                        <p className="text-xs text-gray-400">{a.count} حركة</p>
                      </div>
                    </div>
                    <p className={`text-xl font-bold ${a.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(a.net)}
                      <span className="text-xs font-normal text-gray-400 mr-1">ج.م</span>
                    </p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {a.saleCash > 0 && (
                        <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">🧾 {fmt(a.saleCash)}</span>
                      )}
                      {a.paymentCash > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">💰 {fmt(a.paymentCash)}</span>
                      )}
                      {a.returnCash > 0 && (
                        <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">↩️ -{fmt(a.returnCash)}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="border-t mt-4 pt-3 flex justify-between items-center">
              <span className="text-sm text-gray-500">إجمالي صافي النقدي</span>
              <span className={`text-lg font-bold ${summary.adminTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(summary.adminTotal)} ج.م
              </span>
            </div>
          </div>

          {/* Bank treasury */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">🏦 خزنة البنك (انستاباي / تحويل / شيك)</h2>
              <button onClick={() => setTab('bank')} className="text-xs text-blue-600 hover:underline">
                التفاصيل ←
              </button>
            </div>

            {summary.bank.count === 0 ? (
              <p className="text-center text-gray-400 py-6">مفيش حركات بنكية في هذا اليوم</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="إجمالي الوارد"  value={summary.bank.totalIn}  bg="bg-blue-50"  color="text-blue-700"  sub="text-blue-400" />
                <StatCard label="المرتجعات"       value={summary.bank.totalOut} bg="bg-red-50"   color="text-red-600"  sub="text-red-400" />
                <StatCard label="الصافي"           value={summary.bank.net}      bg="bg-green-50" color={summary.bank.net >= 0 ? 'text-green-700' : 'text-red-600'} sub="text-green-400" />
                <div className="card bg-gray-50 border border-gray-200">
                  <p className="text-xs text-gray-400 mb-2">تفاصيل</p>
                  <div className="space-y-1">
                    {Object.entries(summary.bank.byMethod || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-gray-500">{k}</span>
                        <span className="font-medium">{fmt(v.in - v.out)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Grand total */}
          <div className="rounded-2xl bg-gray-800 p-5 text-white">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-300 text-sm">إجمالي الوارد (نقدي + بنكي)</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {new Date(summaryDate).toLocaleDateString('ar-EG', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </p>
              </div>
              <p className="text-3xl font-bold text-green-400">{fmt(summary.grandTotal)} ج.م</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
