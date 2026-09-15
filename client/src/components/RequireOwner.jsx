import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireOwner() {
    const { user } = useAuth();
    if (user?.role !== 'owner') {
        return <Navigate to="/dashboard" replace />;
    }
    return <Outlet />;
}
