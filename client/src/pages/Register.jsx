import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ businessName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Is the server running?';
      const details = err.response?.data?.errors?.length ? ` (${err.response.data.errors.join(', ')})` : '';
      setError(message + details);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="flex items-center justify-center px-4 pb-16 pt-24">
      <div className="glass w-full max-w-md p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-btn-glow">
            <UserPlus size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-primary">Create your account</h1>
            <p className="text-sm text-gray-600">Set up your business in under a minute</p>
          </div>
        </div>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="businessName" className="text-sm font-medium text-gray-700">
              Business name
            </label>
            <input id="businessName" type="text" required className="glass-input mt-1"
              value={form.businessName} onChange={set('businessName')} />
          </div>
          <div>
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Your name
            </label>
            <input id="name" type="text" required className="glass-input mt-1"
              value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label htmlFor="reg-email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <input id="reg-email" type="email" required className="glass-input mt-1"
              value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label htmlFor="reg-password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input id="reg-password" type="password" required minLength={8} className="glass-input mt-1"
              value={form.password} onChange={set('password')} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
