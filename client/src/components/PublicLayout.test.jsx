import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicLayout from './PublicLayout';

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

const renderAt = (initialPath) =>
    render(
        <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
                <Route element={<PublicLayout />}>
                    <Route path="/" element={<p>landing child</p>} />
                    <Route path="/login" element={<p>auth child</p>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );

describe('PublicLayout', () => {
    it('renders navbar, outlet content and footer', () => {
        renderAt('/');
        expect(screen.getByTestId('public-navbar')).toBeInTheDocument();
        expect(screen.getByText('landing child')).toBeInTheDocument();
        expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
    });

    it('makes the navbar transparent on the landing page', () => {
        renderAt('/');
        expect(screen.getByTestId('public-navbar')).toHaveAttribute('data-solid', 'false');
    });

    it('makes the navbar solid on an auth page', () => {
        renderAt('/login');
        expect(screen.getByText('auth child')).toBeInTheDocument();
        expect(screen.getByTestId('public-navbar')).toHaveAttribute('data-solid', 'true');
    });
});
