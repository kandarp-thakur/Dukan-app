import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Expenses from './Expenses';
import { expensesApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    expensesApi: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
    },
}));

const mockAuth = { user: { role: 'owner', name: 'Owner' } };

vi.mock('../context/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

const expense = {
    id: 'e1',
    category: 'rent',
    amount: 150000,
    paymentMethod: 'cash',
    note: 'Shop rent',
    date: '2026-09-05T10:30:00.000Z',
};

describe('Expenses page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.user = { role: 'owner', name: 'Owner' };
        expensesApi.list.mockResolvedValue({ expenses: [expense] });
    });

    it('renders expenses with formatted amounts', async () => {
        render(<Expenses />);
        expect(await screen.findByText('rent')).toBeInTheDocument();
        expect(screen.getByText('₹1,500')).toBeInTheDocument();
        expect(screen.getByText('Shop rent')).toBeInTheDocument();
    });

    it('creates an expense converting rupees to paise', async () => {
        expensesApi.create.mockResolvedValue({ expense });
        render(<Expenses />);
        await screen.findByText('rent');
        fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'electricity' } });
        fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '250.5' } });
        fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'upi' } });
        fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Bill' } });
        fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
        await waitFor(() =>
            expect(expensesApi.create).toHaveBeenCalledWith({
                category: 'electricity',
                amount: 25050,
                paymentMethod: 'upi',
                note: 'Bill',
            })
        );
    });

    it('deletes an expense after confirmation for owners', async () => {
        expensesApi.remove.mockResolvedValue(null);
        window.confirm = vi.fn().mockReturnValue(true);
        render(<Expenses />);
        await screen.findByText('rent');
        fireEvent.click(screen.getByRole('button', { name: /delete/i }));
        await waitFor(() => expect(expensesApi.remove).toHaveBeenCalledWith('e1'));
    });

    it('hides delete for staff', async () => {
        mockAuth.user = { role: 'staff', name: 'Staff' };
        render(<Expenses />);
        await screen.findByText('rent');
        expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    });
});
