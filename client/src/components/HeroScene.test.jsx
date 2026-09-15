import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({
    Canvas: ({ children }) => <div data-testid="r3f-canvas">{children}</div>,
    useFrame: () => { },
}));

vi.mock('@react-three/drei', () => ({
    Float: ({ children }) => <div>{children}</div>,
    RoundedBox: ({ children }) => <div>{children}</div>,
}));

import HeroScene from './HeroScene';

describe('HeroScene', () => {
    it('mounts the canvas without a real WebGL context', () => {
        render(<HeroScene />);
        expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    });
});
