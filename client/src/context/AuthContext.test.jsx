import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import api, { setAccessToken } from '../api/client';

vi.mock('../api/client', () => ({
  default: { post: vi.fn(), get: vi.fn() },
  setAccessToken: vi.fn(),
}));

const Probe = () => {
  const { user, business, loading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user">{user ? user.email : 'none'}</div>
      <div data-testid="business">{business ? business.name : 'none'}</div>
    </div>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('silently refreshes on mount and loads user + business', async () => {
    api.post.mockResolvedValueOnce({ data: { data: { accessToken: 'tok' } } });
    api.get.mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u1', email: 'o@test.com', role: 'owner' },
          business: { id: 'b1', name: 'My Shop', plan: 'free' },
        },
      },
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('o@test.com'));
    expect(screen.getByTestId('business').textContent).toBe('My Shop');
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(setAccessToken).toHaveBeenCalledWith('tok');
    expect(api.post).toHaveBeenCalledWith('/auth/refresh');
    expect(api.get).toHaveBeenCalledWith('/auth/me');
  });

  it('ends unauthenticated when refresh fails', async () => {
    api.post.mockRejectedValueOnce(new Error('no cookie'));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });

  it('login sets user and business from response', async () => {
    api.post.mockRejectedValueOnce(new Error('no cookie'));
    api.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'tok',
          user: { id: 'u1', email: 'o@test.com', role: 'owner' },
          business: { id: 'b1', name: 'My Shop', plan: 'free' },
        },
      },
    });
    let ctx;
    const LoginProbe = () => {
      ctx = useAuth();
      return null;
    };
    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>
    );
    await waitFor(() => expect(ctx.loading).toBe(false));
    await act(async () => {
      await ctx.login('o@test.com', 'secret123');
    });
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'o@test.com', password: 'secret123' });
    expect(ctx.user.email).toBe('o@test.com');
    expect(ctx.business.name).toBe('My Shop');
  });
});
