import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';

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

afterEach(() => {
    window.scrollY = 0;
});

describe('PublicNavbar', () => {
    it('shows sign in and get started links', () => {
        render(
            <MemoryRouter>
                <PublicNavbar transparent={false} />
            </MemoryRouter>
        );
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
        expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
    });

    it('is solid when it has no hero to float over', () => {
        render(
            <MemoryRouter>
                <PublicNavbar transparent={false} />
            </MemoryRouter>
        );
        expect(screen.getByTestId('public-navbar')).toHaveAttribute('data-solid', 'true');
    });

    it('starts transparent and becomes solid after scroll', () => {
        render(
            <MemoryRouter>
                <PublicNavbar transparent />
            </MemoryRouter>
        );
        expect(screen.getByTestId('public-navbar')).toHaveAttribute('data-solid', 'false');

        act(() => {
            window.scrollY = 120;
            window.dispatchEvent(new Event('scroll'));
        });

        expect(screen.getByTestId('public-navbar')).toHaveAttribute('data-solid', 'true');
    });
});
