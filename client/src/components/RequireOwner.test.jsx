import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RequireOwner from './RequireOwner';

const mockAuth = { user: { role: 'owner' } };

vi.mock('../context/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

const renderGuarded = (initialPath) =>
    render(
        <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
                <Route path="/dashboard" element={<div>Dashboard page</div>} />
                <Route element={<RequireOwner />}>
                    <Route path="/reports" element={<div>Reports page</div>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );

describe('RequireOwner', () => {
    beforeEach(() => {
        mockAuth.user = { role: 'owner' };
    });

    it('renders the guarded child for an owner', () => {
        renderGuarded('/reports');
        expect(screen.getByText('Reports page')).toBeInTheDocument();
    });

    it('redirects staff to the dashboard', () => {
        mockAuth.user = { role: 'staff' };
        renderGuarded('/reports');
        expect(screen.getByText('Dashboard page')).toBeInTheDocument();
        expect(screen.queryByText('Reports page')).toBeNull();
    });
});
