import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Subscription from './Subscription';
import { plansApi, businessApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    plansApi: {
        list: vi.fn(),
    },
    businessApi: {
        get: vi.fn(),
        update: vi.fn(),
        requestUpgrade: vi.fn(),
    },
}));

const mockAuth = {
    user: { id: 'u1', role: 'owner', name: 'Owner' },
    business: { name: 'Local Test Shop', plan: 'free' },
};

vi.mock('../context/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

const plans = [
    {
        id: 'free',
        name: 'Free',
        priceMonthly: 0,
        features: ['Up to 1 user (owner)', 'Unlimited sales & expenses', 'Customer khata'],
    },
    {
        id: 'pro',
        name: 'Pro',
        priceMonthly: 19900,
        features: ['Owner + staff accounts', 'Everything in Free', 'Monthly & outstanding reports'],
    },
];

describe('Subscription page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        plansApi.list.mockResolvedValue({ plans });
        businessApi.get.mockResolvedValue({ business: { id: 'b1', name: 'Local Test Shop', plan: 'free' } });
    });

    it('renders the plan cards with formatted prices', async () => {
        render(
            <MemoryRouter>
                <Subscription />
            </MemoryRouter>
        );
        expect(await screen.findByText('Free')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText('₹0')).toBeInTheDocument();
        expect(screen.getByText('₹199')).toBeInTheDocument();
        expect(screen.getByText(/current plan/i)).toBeInTheDocument();
    });

    it('requests an upgrade to Pro after confirmation', async () => {
        businessApi.requestUpgrade.mockResolvedValue({
            request: { plan: 'pro', status: 'pending' },
        });
        window.confirm = vi.fn().mockReturnValue(true);
        render(
            <MemoryRouter>
                <Subscription />
            </MemoryRouter>
        );
        await screen.findByText('Pro');
        fireEvent.click(screen.getByRole('button', { name: /upgrade to pro/i }));
        await waitFor(() => expect(businessApi.requestUpgrade).toHaveBeenCalledWith('pro'));
        expect(
            await screen.findByText(/upgrade request received/i)
        ).toBeInTheDocument();
    });

    it('does not offer an upgrade button for the current plan', async () => {
        render(
            <MemoryRouter>
                <Subscription />
            </MemoryRouter>
        );
        await screen.findByText('Pro');
        expect(screen.queryByRole('button', { name: /upgrade to free/i })).not.toBeInTheDocument();
    });
});
