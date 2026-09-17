import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({ frameCallbacks: [], canvasProps: null }));

vi.mock('@react-three/fiber', () => ({
    Canvas: ({ children, onCreated, frameloop }) => {
        hoisted.canvasProps = { onCreated, frameloop };
        return <div data-testid="r3f-canvas">{children}</div>;
    },
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
    beforeEach(() => {
        hoisted.frameCallbacks.length = 0;
        hoisted.canvasProps = null;
    });

    it('mounts the canvas without a real WebGL context', () => {
        render(<HeroScene />);
        expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    });

    it('registers a per-frame callback for pointer parallax depth', () => {
        render(<HeroScene />);
        expect(hoisted.frameCallbacks.length).toBeGreaterThan(0);
        expect(typeof hoisted.frameCallbacks[0]).toBe('function');
    });

    it('renders every frame while active (the default)', () => {
        render(<HeroScene />);
        expect(hoisted.canvasProps.frameloop).toBe('always');
    });

    it('pauses the render loop when inactive so an offscreen canvas stops drawing', () => {
        render(<HeroScene active={false} />);
        expect(hoisted.canvasProps.frameloop).toBe('never');
    });

    // HeroScene only *reports* the loss; swapping in the static fallback is the
    // owner's decision and is asserted in HeroSection.test.jsx.
    it('reports a lost WebGL context instead of leaving a permanently blank canvas', () => {
        const onContextLost = vi.fn();
        render(<HeroScene onContextLost={onContextLost} />);

        const domElement = document.createElement('canvas');
        act(() => {
            hoisted.canvasProps.onCreated({ gl: { domElement } });
        });
        act(() => {
            domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
        });

        expect(onContextLost).toHaveBeenCalled();
    });

    it('does not crash when a context is lost with no handler attached', () => {
        render(<HeroScene />);

        const domElement = document.createElement('canvas');
        act(() => {
            hoisted.canvasProps.onCreated({ gl: { domElement } });
        });

        expect(() => {
            act(() => {
                domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
            });
        }).not.toThrow();
    });
});
