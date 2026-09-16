import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Login from './Login';
import Register from './Register';

const mockLogin = vi.fn().mockResolvedValue(undefined);
const mockRegister = vi.fn().mockResolvedValue(undefined);

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

describe('Login', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('renders labeled fields and submits credentials', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'o@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('o@test.com', 'secret123'));
  });

  it('shows server error message on failure', async () => {
    mockLogin.mockRejectedValueOnce({ response: { data: { message: 'Invalid email or password' } } });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'o@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  // A rejected request with no `.response` means the network layer failed —
  // the POST never reached an API. Saying "check your password" here sends the
  // operator down the wrong path; name the misconfiguration instead.
  it('distinguishes an unreachable API from bad credentials', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network Error'));
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'demo@dukan.app' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Demo@12345' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/can't reach the api/i)).toBeInTheDocument();
  });

  // The base URL in the message is the value inlined into this bundle. When it
  // is already a real https:// URL, VITE_API_URL is correct and telling the
  // operator to "set VITE_API_URL" sends them down the wrong path. The live
  // cause is then a CORS preflight rejection (Render CLIENT_URL) or a
  // cold-started backend, so the message must name those instead.
  it('points at CORS / cold start when VITE_API_URL is already a real URL', async () => {
    vi.stubEnv('VITE_API_URL', 'https://acc-app-api.onrender.com/api/v1');
    mockLogin.mockRejectedValueOnce(new Error('Network Error'));
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'demo@dukan.app' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Demo@12345' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/got no reply/i)).toBeInTheDocument();
    expect(screen.getByText(/CLIENT_URL/)).toBeInTheDocument();
  });

  // An HTTP 405 with no API message means a static host answered the POST
  // instead of Express (whose notFound handler returns 404 JSON). This is the
  // signature of a build without VITE_API_URL, so surface the cause rather
  // than a bare status code.
  it('explains an HTTP 405 as a static-host / missing VITE_API_URL problem', async () => {
    mockLogin.mockRejectedValueOnce({ response: { status: 405, data: '<html></html>' } });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'demo@dukan.app' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Demo@12345' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/reached a static host, not the api/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_API_URL/)).toBeInTheDocument();
  });
});

describe('Register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders labeled fields and submits registration payload', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: 'My Shop' } });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Shubham' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 's@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith({
        businessName: 'My Shop',
        name: 'Shubham',
        email: 's@test.com',
        password: 'secret123',
      })
    );
  });
});
