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

describe('App routing', () => {
  it('redirects unauthenticated users to login', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });
});
