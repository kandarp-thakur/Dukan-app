// Pure environment probes. Kept dependency-free so they can be unit tested
// without a browser GPU. See spec 2026-09-15-landing-page-3d-design.md §6.2.

export function supportsWebGL() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        return Boolean(gl);
    } catch {
        return false;
    }
}

export function prefersReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isSmallViewport() {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
}

export function shouldUse3D() {
    return !prefersReducedMotion() && !isSmallViewport() && supportsWebGL();
}
