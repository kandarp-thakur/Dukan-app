import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Staff from './Staff';
import { usersApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    usersApi: {
        list: vi.fn(),
        create: vi.fn(),
        updateRole: vi.fn(),
        remove: vi.fn(),
    },
}));

const mockAuth = {
    user: { id: 'u1', role: 'owner', name: 'Owner' },
    business: { name: 'Local Test Shop' },
};

vi.mock('../context/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

const users = [
    { id: 'u1', name: 'Owner', email: 'owner@shop.com', role: 'owner' },
    { id: 'u2', name: 'Ravi', email: 'ravi@shop.com', role: 'staff' },
];

describe('Staff page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        usersApi.list.mockResolvedValue({ users });
    });

    it('renders the staff list with roles', async () => {
        render(
            <MemoryRouter>
                <Staff />
            </MemoryRouter>
        );
        expect(await screen.findByText('owner@shop.com')).toBeInTheDocument();
        expect(screen.getByText('ravi@shop.com')).toBeInTheDocument();
        expect(screen.getAllByText('owner').length).toBeGreaterThan(0);
        expect(screen.getAllByText('staff').length).toBeGreaterThan(0);
    });

    it('creates a staff member', async () => {
        usersApi.create.mockResolvedValue({
            user: { id: 'u3', name: 'Meena', email: 'meena@shop.com', role: 'staff' },
        });
        render(
            <MemoryRouter>
                <Staff />
            </MemoryRouter>
        );
        await screen.findByText('ravi@shop.com');
        fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Meena' } });
        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'meena@shop.com' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
        fireEvent.click(screen.getByRole('button', { name: /add staff/i }));
        await waitFor(() =>
            expect(usersApi.create).toHaveBeenCalledWith({
                name: 'Meena',
                email: 'meena@shop.com',
                password: 'secret123',
                role: 'staff',
            })
        );
    });

    it('changes a staff role to owner', async () => {
        usersApi.updateRole.mockResolvedValue({
            user: { id: 'u2', name: 'Ravi', email: 'ravi@shop.com', role: 'owner' },
        });
        render(
            <MemoryRouter>
                <Staff />
            </MemoryRouter>
        );
        await screen.findByText('ravi@shop.com');
        fireEvent.change(screen.getByLabelText(/role for ravi/i), { target: { value: 'owner' } });
        await waitFor(() => expect(usersApi.updateRole).toHaveBeenCalledWith('u2', 'owner'));
    });

    it('deletes a staff member after confirmation', async () => {
        usersApi.remove.mockResolvedValue({});
        window.confirm = vi.fn().mockReturnValue(true);
        render(
            <MemoryRouter>
                <Staff />
            </MemoryRouter>
        );
        await screen.findByText('ravi@shop.com');
        fireEvent.click(screen.getByRole('button', { name: /remove/i }));
        await waitFor(() => expect(usersApi.remove).toHaveBeenCalledWith('u2'));
    });
});
