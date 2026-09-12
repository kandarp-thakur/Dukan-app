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

  it('renders the glass sidebar with lucide svg icons', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );
    const sidebar = document.querySelector('aside');
    expect(sidebar).not.toBeNull();
    expect(sidebar.className).toContain('glass');
    expect(sidebar.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('renders the plan chip as a badge', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );
    const chip = screen.getByText('Free plan');
    expect(chip.className).toContain('badge');
  });
});
