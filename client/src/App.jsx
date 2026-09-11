import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AppShell from './components/AppShell';
import PlaceholderPage from './components/PlaceholderPage';

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass px-8 py-4 font-medium text-primary">Loading…</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<PlaceholderPage title="Dashboard" />} />
        <Route path="/sales" element={<PlaceholderPage title="Sales" />} />
        <Route path="/expenses" element={<PlaceholderPage title="Expenses" />} />
        <Route path="/customers" element={<PlaceholderPage title="Customers" />} />
        <Route path="/suppliers" element={<PlaceholderPage title="Suppliers" />} />
        <Route path="/products" element={<PlaceholderPage title="Products" />} />
        <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
        <Route path="/staff" element={<PlaceholderPage title="Staff" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="/subscription" element={<PlaceholderPage title="Subscription" />} />
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
