import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Fail the production build when VITE_API_URL is missing. Vite inlines env
  // vars at build time, so shipping without it makes the bundle target the
  // static frontend host (relative /api/v1) and every POST — e.g. login —
  // fails with HTTP 405 instead of reaching the API. Failing here is far
  // cheaper than debugging a broken login in production.
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = (env.VITE_API_URL || process.env.VITE_API_URL || '').trim();
  if (mode === 'production' && !apiUrl) {
    throw new Error(
      'VITE_API_URL is not set for this production build. Set it to your API ' +
      'base (e.g. https://<api>.onrender.com/api/v1) as a build-time ' +
      'environment variable and redeploy. Without it the app targets the ' +
      'static host and login fails with HTTP 405. See docs/DEPLOYMENT.md.'
    );
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
    },
  };
});
