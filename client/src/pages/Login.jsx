import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.data?.message) {
        // The API answered with a reason (e.g. 401 "Invalid email or password").
        setError(err.response.data.message);
      } else if (err.response?.status === 405) {
        // 405 with no API message means a static host answered the POST — it
        // never reached Express (whose notFound handler returns 404 JSON). The
        // usual cause is a build without VITE_API_URL, so the bundle fell back
        // to the same-origin /api/v1 and hit the frontend host.
        setError(
          'Login failed: the request reached a static host, not the API (HTTP 405). ' +
          'VITE_API_URL is likely unset for this build — set it to your API base and redeploy. ' +
          'See docs/DEPLOYMENT.md.'
        );
      } else if (err.response) {
        setError(`Login failed (HTTP ${err.response.status}). Please try again.`);
      } else {
        // No response at all: the browser never received a reply. Keep in mind
        // the base URL printed below is the value inlined into this bundle, so
        // if it is a real https:// URL then VITE_API_URL is already correct and
        // is NOT the problem. The remaining causes, in order of likelihood:
        //   1. CORS. A JSON POST is not a "simple" request, so the browser sends
        //      an OPTIONS preflight first. If Render's CLIENT_URL does not
        //      byte-match this site's origin the preflight is rejected and the
        //      POST is never even sent -- which looks exactly like a dead API.
        //      See server/src/app.js and docs/DEPLOYMENT.md.
        //   2. A sleeping backend. Render's free tier idles out and needs ~30-50s
        //      to wake, which a default request timeout may not survive.
        //   3. A genuinely down service.
        const base = import.meta.env.VITE_API_URL || '/api/v1 (same origin)';
        if (base.startsWith('http')) {
          setError(
            `Can't reach the API at ${base} — the request got no reply. Most often the ` +
            'backend is asleep: Render\'s free tier takes 30-50s to wake, so wait a moment ' +
            "and try again. If it stays unreachable, CORS is blocking this site — on Render " +
            "set CLIENT_URL to this site's exact URL (no trailing slash) and redeploy. " +
            'See docs/DEPLOYMENT.md.'
          );
        } else {
          setError(
            `Can't reach the API at ${base}. VITE_API_URL was not set for this build, so the ` +
            'request went to the frontend host instead of the API. Set it to your API base ' +
            '(e.g. https://<api>.onrender.com/api/v1) and redeploy. See docs/DEPLOYMENT.md.'
          );
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-4 pb-16 pt-24">
      <div className="glass w-full max-w-md p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-btn-glow">
            <LogIn size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-primary">Welcome back</h1>
            <p className="text-sm text-gray-600">Sign in to your business account</p>
          </div>
        </div>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="glass-input mt-1"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="glass-input mt-1"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          New here?{' '}
          <Link to="/register" className="font-semibold text-primary">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
