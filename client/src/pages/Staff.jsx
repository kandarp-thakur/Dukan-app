import { useEffect, useState } from 'react';
import { usersApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

export default function Staff() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await usersApi.list();
                if (!cancelled) setUsers(data.users);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load staff');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setNotice('');
        try {
            await usersApi.create({
                name: form.name,
                email: form.email,
                password: form.password,
                role: form.role,
            });
            setForm({ name: '', email: '', password: '', role: 'staff' });
            setNotice('Staff member added');
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add staff');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRole = async (id, role) => {
        setError('');
        setNotice('');
        try {
            await usersApi.updateRole(id, role);
            setNotice('Role updated');
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update role');
        }
    };

    const handleRemove = async (id) => {
        if (!window.confirm('Remove this staff member?')) return;
        setError('');
        setNotice('');
        try {
            await usersApi.remove(id);
            setNotice('Staff member removed');
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to remove staff');
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-primary">Staff</h1>

            {error && <div className="glass border border-red-200 p-4 text-sm text-red-600">{error}</div>}
            {notice && <div className="glass border border-green-200 p-4 text-sm text-green-700">{notice}</div>}
            {loading && <div className="glass p-6 text-center text-gray-500">Loading staff…</div>}

            <form onSubmit={handleCreate} className="glass space-y-4 p-6">
                <h2 className="text-lg font-semibold text-gray-800">Add staff member</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label htmlFor="staff-name" className="block text-xs font-semibold text-gray-500">
                            Name
                        </label>
                        <input
                            id="staff-name"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            required
                            className="glass-input mt-1"
                        />
                    </div>
                    <div>
                        <label htmlFor="staff-email" className="block text-xs font-semibold text-gray-500">
                            Email
                        </label>
                        <input
                            id="staff-email"
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={handleChange}
                            required
                            className="glass-input mt-1"
                        />
                    </div>
                    <div>
                        <label htmlFor="staff-password" className="block text-xs font-semibold text-gray-500">
                            Password
                        </label>
                        <input
                            id="staff-password"
                            name="password"
                            type="password"
                            value={form.password}
                            onChange={handleChange}
                            required
                            minLength={6}
                            className="glass-input mt-1"
                        />
                    </div>
                    <div>
                        <label htmlFor="staff-role" className="block text-xs font-semibold text-gray-500">
                            Role
                        </label>
                        <select
                            id="staff-role"
                            name="role"
                            value={form.role}
                            onChange={handleChange}
                            className="glass-input mt-1"
                        >
                            <option value="staff">staff</option>
                            <option value="owner">owner</option>
                        </select>
                    </div>
                </div>
                <button type="submit" disabled={submitting} className="btn-primary">
                    {submitting ? 'Adding…' : 'Add staff'}
                </button>
            </form>

            <div className="glass overflow-x-auto p-6">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400">
                            <th className="pb-2">Name</th>
                            <th className="pb-2">Email</th>
                            <th className="pb-2">Role</th>
                            <th className="pb-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className="border-b border-gray-100">
                                <td className="py-2 font-medium text-gray-800">
                                    {u.name}
                                    {u.id === user?.id && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                                </td>
                                <td className="py-2 text-gray-500">{u.email}</td>
                                <td className="py-2">
                                    <label htmlFor={`role-${u.id}`} className="sr-only">
                                        Role for {u.name}
                                    </label>
                                    <select
                                        id={`role-${u.id}`}
                                        value={u.role}
                                        onChange={(e) => handleRole(u.id, e.target.value)}
                                        className="glass-input py-1"
                                    >
                                        <option value="staff">staff</option>
                                        <option value="owner">owner</option>
                                    </select>
                                </td>
                                <td className="py-2 text-right">
                                    {u.id !== user?.id && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(u.id)}
                                            className="text-sm font-semibold text-red-600 hover:underline"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
