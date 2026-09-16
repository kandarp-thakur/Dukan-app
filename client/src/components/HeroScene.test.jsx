import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({ frameCallbacks: [] }));

vi.mock('@react-three/fiber', () => ({
    Canvas: ({ children }) => <div data-testid="r3f-canvas">{children}</div>,
    useFrame: (cb) => {
        hoisted.frameCallbacks.push(cb);
    },
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

    it('registers a per-frame callback for pointer parallax depth', () => {
        hoisted.frameCallbacks.length = 0;
        render(<HeroScene />);
        expect(hoisted.frameCallbacks.length).toBeGreaterThan(0);
        expect(typeof hoisted.frameCallbacks[0]).toBe('function');
    });
});
