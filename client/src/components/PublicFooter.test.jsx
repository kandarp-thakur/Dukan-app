import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PublicFooter from './PublicFooter';

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

describe('PublicFooter', () => {
    it('renders the brand and product links', () => {
        render(
            <MemoryRouter>
                <PublicFooter />
            </MemoryRouter>
        );
        expect(screen.getByText('Acc App')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
        expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
    });

    it('shows the current year in the copyright line', () => {
        render(
            <MemoryRouter>
                <PublicFooter />
            </MemoryRouter>
        );
        expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
    });
});
