import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AppShell from './components/AppShell';
import Staff from './pages/Staff';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import Products from './pages/Products';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import Sales from './pages/Sales';
import SaleDetail from './pages/SaleDetail';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Expenses from './pages/Expenses';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass w-full max-w-md p-8">
          <div className="skeleton h-9 w-44" />
          <div className="skeleton mt-4 h-4 w-60" />
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/sales/:id" element={<SaleDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/:id" element={<SupplierDetail />} />
        <Route path="/products" element={<Products />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
