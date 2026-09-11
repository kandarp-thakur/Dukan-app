import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Settings from './Settings';
import { businessApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    businessApi: {
        get: vi.fn(),
        update: vi.fn(),
    },
}));

const business = {
    id: 'b1',
    name: 'Local Test Shop',
    address: 'Main Road, Pune',
    gstin: '27ABCDE1234F1Z5',
    currency: 'INR',
    invoicePrefix: 'INV',
    plan: 'free',
};

describe('Settings page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        businessApi.get.mockResolvedValue({ business });
    });

    it('renders the business profile form prefilled', async () => {
        render(
            <MemoryRouter>
                <Settings />
            </MemoryRouter>
        );
        expect(await screen.findByLabelText(/business name/i)).toHaveValue('Local Test Shop');
        expect(screen.getByLabelText(/address/i)).toHaveValue('Main Road, Pune');
        expect(screen.getByLabelText(/gstin/i)).toHaveValue('27ABCDE1234F1Z5');
        expect(screen.getByLabelText(/invoice prefix/i)).toHaveValue('INV');
    });

    it('saves the updated business profile', async () => {
        businessApi.update.mockResolvedValue({
            business: { ...business, name: 'New Shop Name' },
        });
        render(
            <MemoryRouter>
                <Settings />
            </MemoryRouter>
        );
        await screen.findByLabelText(/business name/i);
        fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: 'New Shop Name' } });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
        await waitFor(() =>
            expect(businessApi.update).toHaveBeenCalledWith({
                name: 'New Shop Name',
                address: 'Main Road, Pune',
                gstin: '27ABCDE1234F1Z5',
                currency: 'INR',
                invoicePrefix: 'INV',
            })
        );
        expect(await screen.findByText(/business updated/i)).toBeInTheDocument();
    });

    it('shows the server error message when the update fails', async () => {
        businessApi.update.mockRejectedValueOnce({
            response: { data: { message: 'Update failed' } },
        });
        render(
            <MemoryRouter>
                <Settings />
            </MemoryRouter>
        );
        await screen.findByLabelText(/business name/i);
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
        expect(await screen.findByText('Update failed')).toBeInTheDocument();
    });
});
