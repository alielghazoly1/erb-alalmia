import listLogo from '../../../assets/listLogo.png';

/* ─── ثوابت أبعاد الصفحة ─────────────────────────────────────────────
   A4 عرضه 210mm، padding كل جنب 2.5mm → المساحة الصافية = 205mm
   بنقسمها على جدولين متساويين → كل جدول 102.5mm
   أعمدة ثابتة: الصنف(40) + المنشأ(11.1) + العبوة(13.3) + الكمية(11.9) = 76.3mm
   ──────────────────────────────────────────────────────────────────── */
const PAGE_CONTENT_WIDTH_MM  = 205;    // 210 - (2.5 * 2)
const HALF_TABLE_WIDTH_MM    = 102;  // PAGE_CONTENT_WIDTH_MM / 2
const MAX_PRICE_COLUMNS      = 3;

/* ─── بناء تعريف الأعمدة ────────────────────────────────────────────── */
function buildColumnDefinitions(priceColumnLabels) {
  return [
    { id: 'name',   label: 'الـصـنـف', widthMm: 35 },
    { id: 'origin', label: 'المنشأ',   widthMm: 14 },
    { id: 'unit',   label: 'العبوة',   widthMm: 15 },
    ...priceColumnLabels.map((l, index) => ({
      id: `price_${index}`,
      label:"السعر",
      widthMm: 13,
    })),
    { id: 'qty', label: 'كمية', widthMm: 12 },
  ];
}

/* ─── استخراج قيمة الخلية ───────────────────────────────────────────── */
function getCellValue(entry, columnId) {
  if (columnId === 'name')   return entry.displayName || '';
  if (columnId === 'origin') return entry.origin || '—';
  if (columnId === 'unit')   return entry.unit   || '—';
  if (columnId === 'qty')    return '';
  if (columnId.startsWith('price_')) {
    const priceIndex = Number(columnId.split('_')[1]);
    const priceData  = entry.prices?.[priceIndex];
    return priceData?.price ? Number(priceData.price).toFixed(0) : '—';
  }
  return '';
}

/* ─── نصف الجدول (يمين أو يسار) ────────────────────────────────────── */
function HalfTable({ items, priceColumnLabels }) {
  const columnDefs = buildColumnDefinitions(priceColumnLabels);

  return (
    <table style={{
      width:          `${HALF_TABLE_WIDTH_MM}mm`,
      maxWidth:       `${HALF_TABLE_WIDTH_MM}mm`,
      borderCollapse: 'collapse',
      border:         '0.5mm solid #111',
      tableLayout:    'fixed',
      direction:      'rtl',
      flexShrink:     0,
    }}>
      <colgroup>
        {columnDefs.map((col, index) => (
          <col key={index} style={{ width: `${col.widthMm}mm` }} />
        ))}
      </colgroup>

      <thead>
        <tr style={{ background: 'rgb(211 211 211)' }}>
          {columnDefs.map((col, index) => (
            <th key={index} style={{
              border:      '0.6mm solid black ',
              textAlign:   'center',
              fontFamily:  "'Tahoma', Arial, sans-serif",
              fontWeight:  '900',
              color:       '#c0152a',
              fontSize:    '10pt',
              padding:     '0.3mm 0.2mm',
              whiteSpace:  'nowrap',
              overflow:    'hidden',
              lineHeight:  '1',
            }}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {
          
        items.map((entry, rowIndex) => (
          
          <tr
            key={entry._id || rowIndex}
            style={{ background: rowIndex % 2 === 0 ? '#fff' : 'rgb(211 211 211)' }}
          >
            {columnDefs.map((col, colIndex) => (
              <td key={colIndex} style={{
                border:        '0.6mm solid black',
                fontFamily:    "'Times New Roman', Times, serif",
                fontWeight:    '900',
                fontSize:     '10pt',
                textAlign:    'center',
                lineHeight:    '1',
                overflow:      'hidden',
                whiteSpace:     'nowrap',
                wordBreak:      'normal',
                verticalAlign: 'middle',
                color:         '#000',
              }}>
                              {/* عايز لو عدد حروف الصنف زاد عن 20 خلي size اقل */}
                              {/* {col.id === 'name' && entry.displayName && entry.displayName.length < 25 ? (
                                <span style={{
                                   fontSize: '13pt' 
                                   }}>
                                  {getCellValue(entry, col.id)}
                                </span>
                              ) : (
                                getCellValue(entry, col.id)
                              )} */}

                {/* {getCellValue(entry, col.id) === '—' ? (
                  <span style={{ color: '#555' }}>—</span>
                ) : (
                   getCellValue(entry, col.id)
                )} */}
                {getCellValue(entry, col.id)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── الـ styles المشتركة للنصوص ───────────────────────────────────── */
const TEXT_STYLE_RED = {
  fontFamily: "'Tahoma', sans-serif",
  fontWeight: 'bold',
  color:      '#c0152a',
};
/* ─── مكوّن الصفحة الرئيسي ──────────────────────────────────────────
   forScreen = true  → معاينة على الشاشة (خلفية رمادية + ظل)
   forScreen = false → طباعة / تصدير (بدون أي wrapper إضافي)
   pageRef           → ref على الـ A4 div لـ html2canvas
   ──────────────────────────────────────────────────────────────────── */
export default function PrintPreview({
  selectedListName,
  listDescription,
  list,
  forScreen = false,
  pageRef,
}) {
  if (!selectedListName || !list?.length) return null;

  /* ── جمع تسميات أعمدة الأسعار (max 3) ── */
  const priceColumnLabels = (() => {
    const seenLabels  = new Set();
    const uniqueLabels = [];
    for (const entry of list) {
      for (const priceItem of entry.prices || []) {
        const label = priceItem.label || 'السعر';
        if (!seenLabels.has(label)) {
          seenLabels.add(label);
          uniqueLabels.push(label);
        }
      }
    }
    return uniqueLabels.length ? uniqueLabels.slice(0, MAX_PRICE_COLUMNS) : ['السعر'];
  })();

  /* ── تقسيم الأصناف على جدولين ── */
  const firstHalfCount  = Math.ceil(list.length / 2);
  const rightTableItems = list.slice(0, firstHalfCount);
  const leftTableItems  = list.slice(firstHalfCount);

  /* ── تاريخ اليوم ── */
  const todayFormatted = new Date().toLocaleDateString('ar-EG', {
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  });

  /* ══════════════════════════════════════════════════════════════════
     الـ A4 — نفس الـ markup والـ styles في الشاشة والطباعة والتصدير
     width بالـ mm عشان يكون متطابق في كل البيئات
  ══════════════════════════════════════════════════════════════════ */
  const a4Page = (
    <div
      ref={pageRef}
      style={{
        width:      '210mm',
        minHeight:  '297mm',
        padding:    '3mm 2.5mm',
        background: '#fff',
        direction:  'rtl',
        boxSizing:  'border-box',
        fontFamily: "'Tahoma', sans-serif",
      }}
    >
      {/* ══ رأس الصفحة ══ */}
      <div style={{
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        marginBottom:   '1.5mm',
      }}>
        {/* العمود الأيمن */}
       
        <div style={{ flex: '0 0 auto', width: '80mm', textAlign: 'center', direction: 'ltr' }}>
          <div style={{ ...TEXT_STYLE_RED, fontSize: '15pt' }}>
            AL-ALAMIA FOR IMP &amp; EXP
          </div>
          <div style={{ direction: 'rtl', textAlign: 'center', marginTop: '0.4mm' }}>
            <div style={{ ...TEXT_STYLE_RED, fontSize: '15pt', marginBottom: '0.3mm' }}>
              العالمية للإستيراد والتصدير
            </div>
            <div style={{ ...TEXT_STYLE_RED, fontSize: '11pt', marginBottom: '0.2mm' }}>
              78 شارع بين الحارات ـ رمسيس ـ القاهرة
            </div>
            <div style={{ ...TEXT_STYLE_RED, fontSize: '11pt' }}>
              ت/ 01044050511 ـ 0225935886
            </div>
          </div>
        </div>

        {/* اللوجو */}        {/* العمود الأيسر */}

        <div style={{ flex: '0 0 auto' }}>
          <img
            src={listLogo}
            alt=""
            style={{
              width:     '31.2mm',
              height:    '29.1mm',
              objectFit: 'contain',
              display:   'block',
            }}
          />
        </div>
                {/* العمود الأيسر */}
         <div style={{ flex: '0 0 auto', width: '80mm', textAlign: 'right' }}>
          {/* <div style={{ ...TEXT_STYLE_RED, fontSize: '10pt', marginBottom: '0.6mm' }}>
            بيان أسعار الياميش لعام 2026م
          </div> */}

          {selectedListName && (
            <div style={{ ...TEXT_STYLE_RED, fontSize: '15pt', marginBottom: '0.4mm' }}>
             بيان أسعار  {selectedListName}
            </div>
          )}

          {listDescription && (
            <div style={{ fontSize: '6pt', color: '#555', marginBottom: '0.4mm' }}>
              {listDescription}
            </div>
          )}

          <div style={{ fontSize: '14pt',fontWeight:"bold", color: '#222', marginBottom: '0.8mm' }}>
            <b>بتاريخ :</b> {todayFormatted}
          </div>


          {['الأسم', 'العنوان'].map(fieldLabel => (
            <div key={fieldLabel} style={{
              fontSize:      '11pt',
              fontWeight:    'bold',
              marginBottom:  '0.1mm',
              borderBottom:  '0.3mm solid #333',
              paddingBottom: '0.1mm',
            }}>
              {fieldLabel}:
            </div>
          ))}
        </div>

      </div>

      {/* الخط الفاصل الأحمر */}
      <div style={{ height: '0.5mm', background: '#c0152a', marginBottom: '0.6mm' }} />

      {/* ══ منطقة الجدولين ══
          - direction: ltr عشان الجدولين يوقفوا من الشمال
          - overflow: hidden يمنع التمدد فوق الـ 205mm
          - بدون gap أو margin بين الجدولين عشان المجموع = 205mm بالظبط
      */}
      <div style={{
        width:         `${PAGE_CONTENT_WIDTH_MM}mm`,
        display:       'flex',
        flexDirection: 'row',
        direction:     'rtl',
        alignItems:    'center',
        overflow:      'hidden',
      }}>
        <HalfTable items={rightTableItems} priceColumnLabels={priceColumnLabels} />
        <HalfTable items={leftTableItems}  priceColumnLabels={priceColumnLabels} />
      </div>

      {/* ══ تذييل الصفحة ══ */}
      <div style={{
        // marginTop:  '2mm',
        // borderTop:  '0.35mm solid #444',
        // paddingTop: '1mm',
        textAlign:  'center',
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '12pt', color: '#222', marginBottom: '0.4mm' }}>
          ملحوظة : البـيـع نـقـداً فقط ـ يضاف 15 جنيه للكيلو لتحميص الفسدق واللوز و 20 جنيه للكيلو لتحميص الكاجو
        </div>
        <div style={{ fontWeight: 'bold', fontSize: '10pt', color: '#222' }}>
          الأسعار سارية لمدة ─────────────── فقط وقابلة للارتفاع أو الانخفاض والتغير حسب وضع السوق ـ وكل عام وأنتم بخيـر:..
        </div>
      </div>
    </div>
  );

  /* ── معاينة الشاشة ── */
  if (forScreen) {
    return (
      <div style={{
        width:          '100%',
        overflowX:      'auto',
        background:     '#d1d5db',
        padding:        '32px 16px',
        display:        'flex',
        justifyContent: 'center',
      }}>
        <div style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.25)', flexShrink: 0 }}>
          {a4Page}
        </div>
      </div>
    );
  }

  /* ── طباعة / تصدير ── */
  return a4Page;
}
