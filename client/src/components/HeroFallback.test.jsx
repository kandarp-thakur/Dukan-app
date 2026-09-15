import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HeroFallback from './HeroFallback';

describe('HeroFallback', () => {
    it('renders the three glass panels', () => {
        render(<HeroFallback />);
        expect(screen.getByText('Sales')).toBeInTheDocument();
        expect(screen.getByText('Expenses')).toBeInTheDocument();
        expect(screen.getByText('Profit')).toBeInTheDocument();
    });

    it('renders the root wrapper used by the hero', () => {
        render(<HeroFallback />);
        expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
    });

    it('is decorative art hidden from assistive technology', () => {
        render(<HeroFallback />);
        expect(screen.getByTestId('hero-fallback')).toHaveAttribute('aria-hidden', 'true');
    });
});
