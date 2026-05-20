// ─── components/common/ErrorBoundary.jsx ─────────────────────────────────────
// ✅ NEW: Error Boundary — يمنع crash التطبيق عند وجود خطأ في أي component
// يعرض رسالة واضحة للمستخدم بدل الشاشة البيضاء
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // يمكن إرسال الخطأ لـ Sentry أو أي logging service هنا
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === 'development';

      return (
        <div
          dir="rtl"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            fontFamily: 'Cairo, Segoe UI, sans-serif',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: 520,
              width: '100%',
              background: '#1e293b',
              borderRadius: 16,
              padding: '40px 32px',
              border: '1px solid #ef444440',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              textAlign: 'center',
            }}
          >
            {/* أيقونة الخطأ */}
            <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>

            <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
              حدث خطأ غير متوقع
            </h1>

            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 28px', lineHeight: 1.7 }}>
              حدث خطأ في هذا الجزء من التطبيق.
              <br />
              يمكنك المحاولة مرة أخرى أو إعادة تحميل الصفحة.
            </p>

            {/* أزرار الحل */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReset}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                حاول مرة أخرى
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  background: '#334155',
                  color: '#e2e8f0',
                  border: '1px solid #475569',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                إعادة تحميل الصفحة
              </button>
            </div>

            {/* تفاصيل الخطأ في وضع التطوير فقط */}
            {isDev && this.state.error && (
              <details
                style={{
                  marginTop: 28,
                  textAlign: 'right',
                  background: '#0f172a',
                  borderRadius: 8,
                  padding: '12px 16px',
                  border: '1px solid #334155',
                }}
              >
                <summary
                  style={{
                    color: '#f87171',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: 8,
                  }}
                >
                  تفاصيل الخطأ (للمطورين فقط)
                </summary>
                <pre
                  style={{
                    color: '#fca5a5',
                    fontSize: 11,
                    overflow: 'auto',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    direction: 'ltr',
                    textAlign: 'left',
                    lineHeight: 1.5,
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
