import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppShell from './AppShell';

const mockAuth = {
  user: { role: 'owner', name: 'Owner' },
  business: { name: 'Owner Shop', plan: 'free' },
  logout: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const renderShell = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<AppShell />} />
      </Routes>
    </MemoryRouter>
  );

describe('AppShell', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows all nav items for owner', () => {
    renderShell();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Suppliers')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getAllByText('Owner Shop').length).toBeGreaterThan(0);
  });

  it('hides owner-only nav items for staff', () => {
    mockAuth.user = { role: 'staff', name: 'Staff' };
    renderShell();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.queryByText('Reports')).toBeNull();
    expect(screen.queryByText('Staff')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();
    expect(screen.queryByText('Subscription')).toBeNull();
    mockAuth.user = { role: 'owner', name: 'Owner' };
  });
});
