import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './theme/tokens.css';
import { ThemeProvider } from './theme/ThemeProvider';
import { LoginPage } from './features/auth/LoginPage';
import { getToken } from './api/client';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

function Home() {
  return (
    <div style={{ padding: 'var(--sp-8)' }}>
      <h2>DISTOK — Painel</h2>
      <p style={{ color: 'var(--color-text-mut)' }}>
        Épico 1 concluído. Dashboard, produtos, estoque e relatórios chegam nos próximos épicos.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
