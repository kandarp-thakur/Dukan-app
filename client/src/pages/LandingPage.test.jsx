import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import { plansApi } from '../api/endpoints';

const mockAuth = { user: null, loading: false };

vi.mock('../context/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

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

vi.mock('../utils/webglSupport', () => ({
    shouldUse3D: () => false,
}));

vi.mock('../components/HeroScene', () => ({
    default: () => <div data-testid="hero-scene-mock" />,
}));

const renderLanding = () =>
    render(
        <MemoryRouter>
            <LandingPage />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = null;
    mockAuth.loading = false;
    plansApi.list.mockResolvedValue({ plans: [] });
});

describe('LandingPage', () => {
    it('shows the hero, features, pricing and cta to a guest', async () => {
        renderLanding();
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /everything your shop needs/i })).toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: /simple pricing/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /ready to tidy up your books/i })).toBeInTheDocument();
    });

    it('redirects a logged-in user to the dashboard instead of the hero', () => {
        mockAuth.user = { role: 'owner' };
        renderLanding();
        expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    });
});
