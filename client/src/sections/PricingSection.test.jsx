import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PricingSection from './PricingSection';
import { plansApi } from '../api/endpoints';

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        BrowserRouter: ({ children }) => children,
        Link: ({ to, children, ...props }) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

vi.mock('../api/endpoints', () => ({
    plansApi: { list: vi.fn() },
}));

const renderSection = () =>
    render(
        <MemoryRouter>
            <PricingSection />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PricingSection', () => {
    it('renders the plans returned by the API', async () => {
        plansApi.list.mockResolvedValue({
            plans: [
                { id: 'free', name: 'Starter', priceMonthly: 0, features: ['One user'] },
                { id: 'pro', name: 'Growth', priceMonthly: 49900, features: ['Staff accounts'] },
            ],
        });

        renderSection();

        expect(await screen.findByText('Growth')).toBeInTheDocument();
        expect(screen.getByText('Starter')).toBeInTheDocument();
        expect(screen.getByText('₹499/mo')).toBeInTheDocument();
    });

    it('falls back to the local catalog when the API fails', async () => {
        plansApi.list.mockRejectedValue(new Error('offline'));

        renderSection();

        expect(await screen.findByText('Free')).toBeInTheDocument();
        expect(screen.getByText('₹199/mo')).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: 'Get started' }).length).toBe(2);
    });
});
