import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Reports from './Reports';
import { reportsApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    reportsApi: {
        daily: vi.fn(),
        monthly: vi.fn(),
        outstanding: vi.fn(),
    },
}));

const dailyReport = {
    date: '2026-09-10',
    salesTotal: 50000,
    expensesTotal: 15000,
    profit: 35000,
};

const monthlyReport = {
    month: '2026-09',
    salesTotal: 1250000,
    expensesTotal: 400000,
    profit: 850000,
};

const outstandingReport = {
    receivableTotal: 30000,
    payableTotal: 12000,
    receivables: [
        { id: 'c1', name: 'Ramesh', phone: '9876543210', balance: 20000 },
        { id: 'c2', name: 'Suresh', phone: '', balance: 10000 },
    ],
    payables: [{ id: 's1', name: 'Wholesale Mart', phone: '', balance: 12000 }],
};

describe('Reports page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        reportsApi.daily.mockResolvedValue({ report: dailyReport });
        reportsApi.monthly.mockResolvedValue({ report: monthlyReport });
        reportsApi.outstanding.mockResolvedValue({ report: outstandingReport });
    });

    it('renders the daily report by default', async () => {
        render(
            <MemoryRouter>
                <Reports />
            </MemoryRouter>
        );
        expect(await screen.findByText('Daily report')).toBeInTheDocument();
        expect(screen.getByText('₹500')).toBeInTheDocument();
        expect(screen.getByText('₹150')).toBeInTheDocument();
        expect(screen.getByText('₹350')).toBeInTheDocument();
    });

    it('fetches the daily report with the selected date', async () => {
        render(
            <MemoryRouter>
                <Reports />
            </MemoryRouter>
        );
        await screen.findByText('Daily report');
        const dateInput = screen.getByLabelText(/date/i);
        fireEvent.change(dateInput, { target: { value: '2026-09-08' } });
        fireEvent.click(screen.getByRole('button', { name: /run report/i }));
        await waitFor(() => expect(reportsApi.daily).toHaveBeenCalledWith('2026-09-08'));
    });

    it('renders the monthly report with the selected month', async () => {
        render(
            <MemoryRouter>
                <Reports />
            </MemoryRouter>
        );
        await screen.findByText('Daily report');
        fireEvent.click(screen.getByRole('button', { name: /monthly/i }));
        expect(await screen.findByText('Monthly report')).toBeInTheDocument();
        expect(screen.getByText('₹12,500')).toBeInTheDocument();
        expect(screen.getByText('₹4,000')).toBeInTheDocument();
        expect(screen.getByText('₹8,500')).toBeInTheDocument();
    });

    it('renders the outstanding report with receivables and payables', async () => {
        render(
            <MemoryRouter>
                <Reports />
            </MemoryRouter>
        );
        await screen.findByText('Daily report');
        fireEvent.click(screen.getByRole('button', { name: /outstanding/i }));
        expect(await screen.findByText('Outstanding report')).toBeInTheDocument();
        expect(screen.getByText('Ramesh')).toBeInTheDocument();
        expect(screen.getByText('Suresh')).toBeInTheDocument();
        expect(screen.getByText('Wholesale Mart')).toBeInTheDocument();
        expect(screen.getAllByText('₹300').length).toBeGreaterThan(0);
        expect(screen.getAllByText('₹120').length).toBeGreaterThan(0);
    });
});
