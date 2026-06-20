import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './theme/tokens.css';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthProvider, useAuth } from './auth/useAuth';
import { AppShell } from './components/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { ChangePasswordPage } from './features/auth/ChangePasswordPage';
import { BrandingEditor } from './features/branding/BrandingEditor';
import { getToken } from './api/client';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (!getToken()) return <Navigate to="/login" replace />;
  if (loading) return <div style={{ padding: 'var(--sp-8)' }}>Carregando...</div>;
  if (user?.mustChangePassword) return <Navigate to="/trocar-senha" replace />;
  return <AppShell>{children}</AppShell>;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: 'var(--color-text-mut)' }}>Em construção — chega no épico correspondente da trilha.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/trocar-senha" element={<ChangePasswordPage />} />
            <Route path="/" element={<RequireAuth><Placeholder title="Dashboard" /></RequireAuth>} />
            <Route path="/marca" element={<RequireAuth><BrandingEditor /></RequireAuth>} />
            <Route path="/produtos" element={<RequireAuth><Placeholder title="Produtos" /></RequireAuth>} />
            <Route path="/estoque" element={<RequireAuth><Placeholder title="Estoque" /></RequireAuth>} />
            <Route path="/funcionarios" element={<RequireAuth><Placeholder title="Funcionários" /></RequireAuth>} />
            <Route path="/relatorios" element={<RequireAuth><Placeholder title="Relatórios" /></RequireAuth>} />
            <Route path="/admin/tenants" element={<RequireAuth><Placeholder title="Distribuidoras" /></RequireAuth>} />
            <Route path="/admin/planos" element={<RequireAuth><Placeholder title="Planos" /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
