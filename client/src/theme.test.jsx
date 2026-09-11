import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import AppShell from './components/AppShell';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({ user: null, business: null, logout: vi.fn() }),
}));

describe('theme wiring smoke test', () => {
  it('renders a themed app shell with the default business name', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );
    expect(screen.getAllByText('My Business').length).toBeGreaterThan(0);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
