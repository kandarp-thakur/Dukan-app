import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HeroSection from './HeroSection';
import { shouldUse3D } from '../utils/webglSupport';

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

vi.mock('../utils/webglSupport', () => ({
    shouldUse3D: vi.fn(),
}));

vi.mock('../components/HeroScene', () => ({
    default: () => <div data-testid="hero-scene-mock" />,
}));

const renderHero = () =>
    render(
        <MemoryRouter>
            <HeroSection />
        </MemoryRouter>
    );

describe('HeroSection', () => {
    it('renders the headline and both calls to action', () => {
        shouldUse3D.mockReturnValue(false);
        renderHero();
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    });

    it('shows the static fallback when 3D is not available', () => {
        shouldUse3D.mockReturnValue(false);
        renderHero();
        expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
        expect(screen.queryByTestId('hero-scene-mock')).not.toBeInTheDocument();
    });

    it('hides the decorative art from assistive technology', () => {
        shouldUse3D.mockReturnValue(false);
        const { container } = renderHero();
        const art = container.querySelector('[aria-hidden="true"]');
        expect(art).not.toBeNull();
        expect(art).toContainElement(screen.getByTestId('hero-fallback'));
    });
});
