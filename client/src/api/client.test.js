import { describe, it, expect, beforeEach, vi } from 'vitest';
import api, { setAccessToken } from './client';

const makeResponse = (status, data) => ({
    status,
    data,
    headers: {},
    config: {},
});

const makeError = (status, url, data = {}) => {
    const error = new Error(`Request failed with status code ${status}`);
    error.response = { status, data, headers: {}, config: {} };
    error.config = { url, headers: {} };
    return error;
};

const getAuth = (config) => {
    const headers = config.headers;
    if (headers && typeof headers.get === 'function') {
        return headers.get('Authorization');
    }
    return headers.Authorization ?? headers.authorization;
};

describe('api client 401 refresh interceptor', () => {
    let adapter;

    beforeEach(() => {
        setAccessToken(null);
        adapter = vi.fn();
        api.defaults.adapter = adapter;
    });

    it('refreshes the token and retries the original request on 401', async () => {
        setAccessToken('expired-token');
        adapter
            .mockRejectedValueOnce(makeError(401, '/business'))
            .mockResolvedValueOnce(makeResponse(200, { data: { accessToken: 'new-token' } }))
            .mockResolvedValueOnce(makeResponse(200, { data: { ok: true } }));
        const res = await api.get('/business');
        expect(res.status).toBe(200);
        expect(adapter).toHaveBeenCalledTimes(3);
        const refreshCall = adapter.mock.calls[1][0];
        expect(String(refreshCall.url)).toContain('/auth/refresh');
        const retryCall = adapter.mock.calls[2][0];
        expect(getAuth(retryCall)).toBe('Bearer new-token');
    });

    it('clears the access token and rejects when refresh fails', async () => {
        setAccessToken('expired-token');
        adapter
            .mockRejectedValueOnce(makeError(401, '/business'))
            .mockRejectedValueOnce(makeError(401, '/auth/refresh'));
        await expect(api.get('/business')).rejects.toMatchObject({ response: { status: 401 } });
        const retryCalls = adapter.mock.calls.filter((c) => !String(c[0].url).includes('/auth/'));
        expect(retryCalls.length).toBe(1);
    });

    it('shares a single refresh call across concurrent 401s', async () => {
        setAccessToken('expired-token');
        let resolveRefresh;
        const refreshResponse = new Promise((resolve) => {
            resolveRefresh = () => resolve(makeResponse(200, { data: { accessToken: 'shared-token' } }));
        });
        adapter
            .mockRejectedValueOnce(makeError(401, '/business'))
            .mockRejectedValueOnce(makeError(401, '/products'))
            .mockImplementationOnce(() => refreshResponse)
            .mockResolvedValueOnce(makeResponse(200, { data: { a: 1 } }))
            .mockResolvedValueOnce(makeResponse(200, { data: { b: 2 } }));
        const first = api.get('/business');
        const second = api.get('/products');
        resolveRefresh();
        const [res1, res2] = await Promise.all([first, second]);
        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);
        const refreshCalls = adapter.mock.calls.filter((c) => String(c[0].url).includes('/auth/refresh'));
        expect(refreshCalls.length).toBe(1);
        expect(getAuth(adapter.mock.calls[3][0])).toBe('Bearer shared-token');
        expect(getAuth(adapter.mock.calls[4][0])).toBe('Bearer shared-token');
        expect(adapter).toHaveBeenCalledTimes(5);
    });

    it('does not attempt refresh for 401s on auth routes', async () => {
        adapter.mockRejectedValueOnce(makeError(401, '/auth/login', { success: false }));
        await expect(api.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } });
        expect(adapter).toHaveBeenCalledTimes(1);
    });
});
