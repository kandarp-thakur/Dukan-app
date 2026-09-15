import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

vi.mock('./api/client', () => ({
  default: {
    post: vi.fn().mockRejectedValue(new Error('no server')),
    get: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

vi.mock('./utils/webglSupport', () => ({
  shouldUse3D: () => false,
}));

vi.mock('./components/HeroScene', () => ({
  default: () => <div data-testid="hero-scene-mock" />,
}));

// Override 1: PricingSection mounts on the landing page and its effect calls
// plansApi.list() === api.get('/plans').then(...). The mocked api.get above
// returns undefined, so the real module would throw synchronously.
vi.mock('./api/endpoints', () => ({
  plansApi: { list: vi.fn().mockResolvedValue({ plans: [] }) },
}));

describe('App routing', () => {
  it('renders the public landing page for a guest at the root path', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /sales, invoices and khata/i })
    ).toBeInTheDocument();
  });

  it('sends an unauthenticated visitor on a protected path to login', async () => {
    window.history.pushState({}, '', '/reports');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    window.history.pushState({}, '', '/');
  });
});
