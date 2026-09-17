const request = require('supertest');

/**
 * CORS is the gate between the Vercel frontend and this API.
 *
 * The deployed frontend sends `POST /api/v1/auth/login` with a JSON body, which
 * is NOT a CORS "simple request", so the browser first sends an OPTIONS
 * preflight. If the preflight is rejected the browser never sends the POST and
 * the app sees NO response at all -- surfacing as
 * "Can't reach the API at https://<api>/api/v1" even though the API is healthy.
 *
 * These tests pin the contract app.js must honour for that to work.
 */

/** Reloads the app with a specific CLIENT_URL, since CORS is read at import. */
function loadApp(clientUrl) {
    jest.resetModules();
    if (clientUrl === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = clientUrl;
    return require('../src/app');
}

/** Sends a browser-style preflight and returns the response. */
function preflight(app, origin) {
    return request(app)
        .options('/api/v1/health')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');
}

describe('CORS', () => {
    afterEach(() => {
        delete process.env.CLIENT_URL;
    });

    it('allows the exact CLIENT_URL origin and permits credentials', async () => {
        const app = loadApp('https://dukan-sigma.vercel.app');

        const res = await preflight(app, 'https://dukan-sigma.vercel.app');

        expect(res.headers['access-control-allow-origin']).toBe(
            'https://dukan-sigma.vercel.app'
        );
        expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('tolerates a trailing slash on CLIENT_URL', async () => {
        // The Render dashboard makes it easy to paste "https://app.vercel.app/".
        // That must still match the browser's Origin, which never has a slash.
        const app = loadApp('https://dukan-sigma.vercel.app/');

        const res = await preflight(app, 'https://dukan-sigma.vercel.app');

        expect(res.headers['access-control-allow-origin']).toBe(
            'https://dukan-sigma.vercel.app'
        );
    });

    it('allows each origin in a comma-separated CLIENT_URL', async () => {
        // Production plus a Vercel preview/staging origin.
        const app = loadApp(
            'https://dukan-sigma.vercel.app, https://acc-app-staging.vercel.app'
        );

        const res = await preflight(app, 'https://acc-app-staging.vercel.app');

        expect(res.headers['access-control-allow-origin']).toBe(
            'https://acc-app-staging.vercel.app'
        );
    });

    it('allows both Vercel hostnames when Vercel hands out more than one', async () => {
        // Vercel assigns a different hostname per deployment. Listing every
        // hostname in one comma-separated CLIENT_URL keeps every origin working
        // without a second redeploy each time the URL changes.
        const app = loadApp(
            'https://dukan-sigma.vercel.app,https://dukan-app-nine.vercel.app'
        );

        const first = await preflight(app, 'https://dukan-sigma.vercel.app');
        expect(first.headers['access-control-allow-origin']).toBe(
            'https://dukan-sigma.vercel.app'
        );

        const second = await preflight(app, 'https://dukan-app-nine.vercel.app');
        expect(second.headers['access-control-allow-origin']).toBe(
            'https://dukan-app-nine.vercel.app'
        );
    });

    it('does not echo an origin that is not allowlisted', async () => {
        const app = loadApp('https://dukan-sigma.vercel.app');

        const res = await preflight(app, 'https://evil.example.com');

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('falls back to the local dev origin when CLIENT_URL is unset', async () => {
        // Preserves the previous behaviour so local development keeps working,
        // while the API warns loudly in the deploy log.
        const app = loadApp(undefined);

        const res = await preflight(app, 'http://localhost:5173');

        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
});
