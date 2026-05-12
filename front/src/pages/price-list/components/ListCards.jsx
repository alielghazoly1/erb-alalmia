export default function ListCards({ allLists, selectedListName, setSelectedListName, isAdmin, onEditList }) {
  return (
    <div className="no-print mb-8">
      <h2 className="text-base font-bold text-gray-700 mb-3">📂 القوائم المتاحة</h2>
      <div className="flex flex-wrap gap-3">
        {allLists.map((lc) => (
          <div
            key={lc.name}
            onClick={() => setSelectedListName(lc.name)}
            className={`relative flex items-center gap-3 px-5 py-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
              selectedListName === lc.name
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow'
            }`}
          >
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">{lc.name}</p>
              {lc.description && <p className="text-xs text-gray-500 mt-0.5">{lc.description}</p>}
              <span className="text-xs text-blue-600 font-medium">📦 {lc.count} صنف</span>
            </div>
            {isAdmin && selectedListName === lc.name && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditList(); }}
                className="text-gray-400 hover:text-blue-600 text-lg"
                title="تعديل"
              >
                ✏️
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
