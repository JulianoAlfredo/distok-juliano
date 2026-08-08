import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './theme/tokens.css';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthProvider, useAuth } from './auth/useAuth';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/Confirm';
import { Loading } from './components/ui';
import { AppShell } from './components/AppShell';
import { CommandPaletteProvider } from './components/ui/CommandPalette';
import { getToken } from './api/client';

// Auth pages — carregadas eagerly (pequenas, sem autenticação, críticas para TTFP)
import { LoginPage }          from './features/auth/LoginPage';
import { ChangePasswordPage } from './features/auth/ChangePasswordPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage }  from './features/auth/ResetPasswordPage';

// App pages — lazy (só carregam após login)
const DashboardPage  = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const BrandingEditor = lazy(() => import('./features/branding/BrandingEditor').then((m) => ({ default: m.BrandingEditor })));
const ProductsPage   = lazy(() => import('./features/products/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const UsersPage      = lazy(() => import('./features/users/UsersPage').then((m) => ({ default: m.UsersPage })));
const StockPage      = lazy(() => import('./features/stock/StockPage').then((m) => ({ default: m.StockPage })));
const ReportsPage    = lazy(() => import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const TenantsPage    = lazy(() => import('./features/superadmin/TenantsPage').then((m) => ({ default: m.TenantsPage })));
const PlansPage      = lazy(() => import('./features/superadmin/PlansPage').then((m) => ({ default: m.PlansPage })));
const CustomersPage  = lazy(() => import('./features/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const SuppliersPage  = lazy(() => import('./features/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })));
const CatalogPage    = lazy(() => import('./features/catalog/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const PurchasesPage  = lazy(() => import('./features/purchases/PurchasesPage').then((m) => ({ default: m.PurchasesPage })));
const SalesPage      = lazy(() => import('./features/sales/SalesPage').then((m) => ({ default: m.SalesPage })));
const CashierPage    = lazy(() => import('./features/cashier/CashierPage').then((m) => ({ default: m.CashierPage })));
const FinancialPage  = lazy(() => import('./features/financial/FinancialPage').then((m) => ({ default: m.FinancialPage })));
const ZeDeliverySettings = lazy(() => import('./features/ze-delivery/ZeDeliverySettings').then((m) => ({ default: m.ZeDeliverySettings })));

function PageFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <Loading label="Carregando…" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (!getToken()) return <Navigate to="/login" replace />;
  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loading /></div>;
  if (user?.mustChangePassword) return <Navigate to="/trocar-senha" replace />;
  return <AppShell><Suspense fallback={<PageFallback />}>{children}</Suspense></AppShell>;
}

function RoleHome() {
  const { user } = useAuth();
  if (user?.role === 'super_admin') return <Navigate to="/admin/tenants" replace />;
  return <DashboardPage />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
         <ConfirmProvider>
          <BrowserRouter>
          <CommandPaletteProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
              <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
              <Route path="/trocar-senha" element={<ChangePasswordPage />} />
              <Route path="/" element={<RequireAuth><RoleHome /></RequireAuth>} />
              <Route path="/relatorios"    element={<RequireAuth><ReportsPage /></RequireAuth>} />
              <Route path="/marca"         element={<RequireAuth><BrandingEditor /></RequireAuth>} />
              <Route path="/integracoes/ze-delivery" element={<RequireAuth><ZeDeliverySettings /></RequireAuth>} />
              <Route path="/produtos"      element={<RequireAuth><ProductsPage /></RequireAuth>} />
              <Route path="/estoque"       element={<RequireAuth><StockPage /></RequireAuth>} />
              <Route path="/clientes"      element={<RequireAuth><CustomersPage /></RequireAuth>} />
              <Route path="/fornecedores"  element={<RequireAuth><SuppliersPage /></RequireAuth>} />
              <Route path="/cadastros"     element={<RequireAuth><CatalogPage /></RequireAuth>} />
              <Route path="/compras"       element={<RequireAuth><PurchasesPage /></RequireAuth>} />
              <Route path="/vendas"        element={<RequireAuth><SalesPage /></RequireAuth>} />
              <Route path="/caixa"         element={<RequireAuth><CashierPage /></RequireAuth>} />
              <Route path="/financeiro"    element={<RequireAuth><FinancialPage /></RequireAuth>} />
              <Route path="/funcionarios"  element={<RequireAuth><UsersPage /></RequireAuth>} />
              <Route path="/admin/tenants" element={<RequireAuth><TenantsPage /></RequireAuth>} />
              <Route path="/admin/planos"  element={<RequireAuth><PlansPage /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CommandPaletteProvider>
          </BrowserRouter>
         </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
