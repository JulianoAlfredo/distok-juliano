import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './theme/tokens.css';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthProvider, useAuth } from './auth/useAuth';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/Confirm';
import { Loading } from './components/ui';
import { AppShell } from './components/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { ChangePasswordPage } from './features/auth/ChangePasswordPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { BrandingEditor } from './features/branding/BrandingEditor';
import { ProductsPage } from './features/products/ProductsPage';
import { UsersPage } from './features/users/UsersPage';
import { StockPage } from './features/stock/StockPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { TenantsPage } from './features/superadmin/TenantsPage';
import { PlansPage } from './features/superadmin/PlansPage';
import { CustomersPage }  from './features/customers/CustomersPage';
import { SuppliersPage } from './features/suppliers/SuppliersPage';
import { CatalogPage }    from './features/catalog/CatalogPage';
import { PurchasesPage } from './features/purchases/PurchasesPage';
import { SalesPage }     from './features/sales/SalesPage';
import { CashierPage }    from './features/cashier/CashierPage';
import { FinancialPage }  from './features/financial/FinancialPage';
import { getToken } from './api/client';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (!getToken()) return <Navigate to="/login" replace />;
  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loading /></div>;
  if (user?.mustChangePassword) return <Navigate to="/trocar-senha" replace />;
  return <AppShell>{children}</AppShell>;
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
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
              <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
              <Route path="/trocar-senha" element={<ChangePasswordPage />} />
              <Route path="/" element={<RequireAuth><RoleHome /></RequireAuth>} />
              <Route path="/relatorios" element={<RequireAuth><ReportsPage /></RequireAuth>} />
              <Route path="/marca" element={<RequireAuth><BrandingEditor /></RequireAuth>} />
              <Route path="/produtos" element={<RequireAuth><ProductsPage /></RequireAuth>} />
              <Route path="/estoque" element={<RequireAuth><StockPage /></RequireAuth>} />
              <Route path="/clientes"     element={<RequireAuth><CustomersPage /></RequireAuth>} />
              <Route path="/fornecedores" element={<RequireAuth><SuppliersPage /></RequireAuth>} />
              <Route path="/cadastros"    element={<RequireAuth><CatalogPage /></RequireAuth>} />
              <Route path="/compras"      element={<RequireAuth><PurchasesPage /></RequireAuth>} />
              <Route path="/vendas"       element={<RequireAuth><SalesPage /></RequireAuth>} />
              <Route path="/caixa"        element={<RequireAuth><CashierPage /></RequireAuth>} />
              <Route path="/financeiro"   element={<RequireAuth><FinancialPage /></RequireAuth>} />
              <Route path="/funcionarios" element={<RequireAuth><UsersPage /></RequireAuth>} />
              <Route path="/admin/tenants" element={<RequireAuth><TenantsPage /></RequireAuth>} />
              <Route path="/admin/planos" element={<RequireAuth><PlansPage /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
         </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
