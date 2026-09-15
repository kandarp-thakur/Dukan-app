import { describe, it, expect, vi, afterEach } from 'vitest';
import { supportsWebGL, prefersReducedMotion, isSmallViewport, shouldUse3D } from './webglSupport';

const originalInnerWidth = window.innerWidth;

afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
});

describe('webglSupport', () => {
    it('reports no WebGL when the canvas cannot give a context', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        expect(supportsWebGL()).toBe(false);
    });

    it('reports no WebGL when getContext throws', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
            throw new Error('not implemented');
        });
        expect(supportsWebGL()).toBe(false);
    });

    it('reports WebGL when a context is returned', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
        expect(supportsWebGL()).toBe(true);
    });

    it('detects a reduced-motion preference', () => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
        expect(prefersReducedMotion()).toBe(true);
    });

    it('treats a missing matchMedia as no preference', () => {
        vi.stubGlobal('matchMedia', undefined);
        expect(prefersReducedMotion()).toBe(false);
    });

    it('detects a small viewport below 768px', () => {
        Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
        expect(isSmallViewport()).toBe(true);
    });

    it('allows 3D when WebGL works and motion is welcome on a large screen', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        expect(shouldUse3D()).toBe(true);
    });

    it('refuses 3D when the user prefers reduced motion', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        expect(shouldUse3D()).toBe(false);
    });

    it('refuses 3D on a small viewport', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
        Object.defineProperty(window, 'innerWidth', { value: 640, configurable: true });
        expect(shouldUse3D()).toBe(false);
    });
});
