// ─── components/ItemSection.jsx ───────────────────────────────────────────────
//  Wrapper لقسم الخامات أو المنتجات (header ملوّن + children)
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = {
  orange: {
    border:  'border-orange-200',
    header:  'bg-orange-50 border-orange-100',
    title:   'text-orange-700',
  },
  green: {
    border:  'border-green-200',
    header:  'bg-green-50 border-green-100',
    title:   'text-green-700',
  },
};

export default function ItemSection({ title, icon, color = 'orange', children }) {
  const c = COLORS[color];
  return (
    <div className={`card border-2 mb-0 ${c.border}`}>
      <div className={`-mx-5 -mt-5 px-5 py-3 mb-4 rounded-t-xl border-b ${c.header}`}>
        <h2 className={`font-semibold flex items-center gap-2 ${c.title}`}>
          <span className="text-lg">{icon}</span>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
