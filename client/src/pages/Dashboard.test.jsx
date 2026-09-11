import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from './Dashboard';
import { dashboardApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    dashboardApi: {
        summary: vi.fn(),
    },
}));

const summary = {
    range: 'today',
    salesTotal: 140000,
    expensesTotal: 25000,
    profit: 115000,
    cashBalance: 500000,
    receivable: 20000,
    payable: 10000,
};

describe('Dashboard page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dashboardApi.summary.mockResolvedValue({ summary });
    });

    it('renders summary cards with formatted amounts', async () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        expect(await screen.findByText('₹1,400')).toBeInTheDocument();
        expect(screen.getByText('₹250')).toBeInTheDocument();
        expect(screen.getByText('₹1,150')).toBeInTheDocument();
        expect(screen.getByText('₹5,000')).toBeInTheDocument();
        expect(screen.getByText('₹200')).toBeInTheDocument();
        expect(screen.getByText('₹100')).toBeInTheDocument();
    });

    it('switches range and refetches the summary', async () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        await screen.findByText('₹1,400');
        fireEvent.click(screen.getByRole('button', { name: /this month/i }));
        await waitFor(() => expect(dashboardApi.summary).toHaveBeenCalledWith('month'));
    });

    it('shows the error message when the summary fails to load', async () => {
        dashboardApi.summary.mockRejectedValueOnce({
            response: { data: { message: 'Summary unavailable' } },
        });
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        expect(await screen.findByText('Summary unavailable')).toBeInTheDocument();
    });
});
