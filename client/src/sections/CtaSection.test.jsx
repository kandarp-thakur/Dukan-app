import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CtaSection from './CtaSection';

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

describe('CtaSection', () => {
    it('offers a get started link to registration', () => {
        render(
            <MemoryRouter>
                <CtaSection />
            </MemoryRouter>
        );
        expect(screen.getByRole('heading', { name: /ready to tidy up your books/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
    });
});
