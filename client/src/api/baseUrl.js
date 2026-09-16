// Resolves the base URL every API request is sent to.
//
// Production builds MUST provide VITE_API_URL. Vite inlines `import.meta.env`
// at build time, so if the variable is missing the bundle falls back to the
// relative '/api/v1' and every request (including `POST /auth/login`) is sent
// to the static frontend host instead of the API. A static host answers
// non-GET verbs with HTTP 405 (Method Not Allowed) and an HTML/empty body,
// which is why login surfaced as "Login failed (HTTP 405)" with no API message.
//
// Keeping this in one place lets the runtime client and the Vite build guard
// agree on the rule: never target the static host in a production build.
export function resolveApiBaseUrl(env = import.meta.env) {
    const explicit = typeof env?.VITE_API_URL === 'string' ? env.VITE_API_URL.trim() : '';
    if (explicit) return explicit;

    if (env?.PROD) {
        throw new Error(
            'VITE_API_URL is not set. Production builds must point at the API ' +
            '(e.g. https://<api>.onrender.com/api/v1). Without it, requests fall ' +
            'back to the static host and fail with HTTP 405. See docs/DEPLOYMENT.md.'
        );
    }

    // Dev: Vite proxies /api to the local backend (see client/vite.config.js).
    return '/api/v1';
}
