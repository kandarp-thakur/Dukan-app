import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HeroSection from './HeroSection';
import { shouldUse3D } from '../utils/webglSupport';

const hoisted = vi.hoisted(() => ({ sceneProps: { current: null } }));

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
    default: (props) => {
        hoisted.sceneProps.current = props;
        return <div data-testid="hero-scene-mock" />;
    },
}));

const renderHero = () =>
    render(
        <MemoryRouter>
            <HeroSection />
        </MemoryRouter>
    );

/** Installs a controllable IntersectionObserver, as jsdom ships none. */
function stubIntersectionObserver() {
    const captured = { callback: null, disconnect: vi.fn() };
    vi.stubGlobal(
        'IntersectionObserver',
        class {
            constructor(callback) {
                captured.callback = callback;
            }

            observe() {}

            unobserve() {}

            disconnect() {
                captured.disconnect();
            }
        }
    );
    return captured;
}

function setVisibility(state) {
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
    });
    document.dispatchEvent(new Event('visibilitychange'));
}

describe('HeroSection', () => {
    beforeEach(() => {
        hoisted.sceneProps.current = null;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible',
        });
    });

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

    it('runs the scene while the hero is on screen', async () => {
        shouldUse3D.mockReturnValue(true);
        const observer = stubIntersectionObserver();
        renderHero();

        await screen.findByTestId('hero-scene-mock');
        act(() => observer.callback([{ isIntersecting: true }]));

        expect(hoisted.sceneProps.current.active).toBe(true);
    });

    it('pauses the scene once the hero scrolls out of view (spec 6.3)', async () => {
        shouldUse3D.mockReturnValue(true);
        const observer = stubIntersectionObserver();
        renderHero();

        await screen.findByTestId('hero-scene-mock');
        act(() => observer.callback([{ isIntersecting: false }]));

        expect(hoisted.sceneProps.current.active).toBe(false);
    });

    it('pauses the scene while the browser tab is hidden', async () => {
        shouldUse3D.mockReturnValue(true);
        stubIntersectionObserver();
        renderHero();

        await screen.findByTestId('hero-scene-mock');
        act(() => setVisibility('hidden'));

        expect(hoisted.sceneProps.current.active).toBe(false);
    });

    it('swaps in the static fallback when the WebGL context is lost', async () => {
        shouldUse3D.mockReturnValue(true);
        stubIntersectionObserver();
        renderHero();

        await screen.findByTestId('hero-scene-mock');
        act(() => hoisted.sceneProps.current.onContextLost());

        expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
        expect(screen.queryByTestId('hero-scene-mock')).not.toBeInTheDocument();
    });
});
