
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import App from './App';

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("GlobalErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif', textAlign: 'center', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#ffffff', padding: 32, borderRadius: 24, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', maxWidth: 500, width: '100%', border: '1px solid #e2e8f0' }}>
            <h2 style={{ color: '#dc2626', fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Đã có lỗi hệ thống!</h2>
            <p style={{ color: '#475569', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              Ứng dụng gặp sự cố kỹ thuật. Nhấn nút bên dưới để khôi phục lại trang.
            </p>
            {this.state.error && (
              <pre style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, textWrap: 'wrap', wordBreak: 'break-word', fontSize: 11, textAlign: 'left', color: '#991b1b', maxHeight: 150, overflowY: 'auto' }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }}
                style={{ flex: 1, padding: '12px 16px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
              >
                Xóa cache & Tải lại
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{ flex: 1, padding: '12px 16px', backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
              >
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </GlobalErrorBoundary>
  </React.StrictMode>
);

