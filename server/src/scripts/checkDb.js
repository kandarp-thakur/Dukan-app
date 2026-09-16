#!/usr/bin/env node
/**
 * Diagnoses "can this process reach MongoDB?" and, when it cannot, reports the
 * public IP address that MongoDB is seeing — the exact value that has to be
 * allowed in Atlas -> Network Access.
 *
 * Run it from the environment that is failing:
 *
 *   Render Shell (Environment tab -> Shell):   npm run db:check
 *   Local machine:                             npm run db:check
 *
 * Comparing the two runs is the whole diagnosis. If it passes locally and fails
 * on Render, the connection string and cluster are fine and only the source IP
 * is denied. If it fails in both, the fault is in the URI or the cluster.
 *
 * Never prints the password: the URI is masked before any output.
 */
require('dotenv').config();
const dns = require('dns');
const https = require('https');
const net = require('net');

const { maskSecrets } = require('../config/mongoError');

const TCP_TIMEOUT_MS = 10000;

function out(line = '') {
    console.log(line);
}

function maskUri(uri) {
    return maskSecrets(uri);
}

function resolveSrv(hostname) {
    return new Promise((resolve) => {
        dns.resolveSrv(`_mongodb._tcp.${hostname}`, (err, records) => {
            resolve(err ? { ok: false, err } : { ok: true, records });
        });
    });
}

function probeTcp(host, port) {
    return new Promise((resolve) => {
        const socket = net.connect({ host, port });
        const done = (result) => {
            socket.destroy();
            resolve(result);
        };
        socket.setTimeout(TCP_TIMEOUT_MS);
        socket.on('connect', () => done({ ok: true }));
        socket.on('timeout', () => done({ ok: false, err: new Error(`did not answer within ${TCP_TIMEOUT_MS}ms`) }));
        socket.on('error', (err) => done({ ok: false, err }));
    });
}

function fetchPublicIp() {
    return new Promise((resolve) => {
        const req = https.get('https://api.ipify.org?format=json', { timeout: 8000 }, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body).ip);
                } catch (err) {
                    resolve(null);
                }
            });
        });
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
        req.on('error', () => resolve(null));
    });
}

async function main() {
    const uri = process.env.MONGO_URI;

    out('');
    out('MongoDB connectivity check');
    out('==========================');

    if (!uri || !String(uri).trim()) {
        out('FAIL  MONGO_URI is not set in this environment.');
        out('');
        out('      Set it under Render -> Environment, then redeploy.');
        process.exit(1);
    }

    const masked = maskUri(uri);
    out(`URI    ${masked}`);

    let parsed;
    try {
        parsed = new URL(uri);
    } catch (err) {
        out(`FAIL  MONGO_URI is not a valid connection string: ${err.message}`);
        process.exit(1);
    }

    const host = parsed.hostname;
    const dbName = parsed.pathname || '(none)';
    const isSrv = parsed.protocol === 'mongodb+srv:';

    out(`Host   ${host}`);
    out(`DB     ${dbName}`);
    out(`Scheme ${isSrv ? 'mongodb+srv (SRV lookup required)' : parsed.protocol}`);
    if (dbName === '' || dbName === '/') {
        out('WARN  No database name in the URI. It will fall back to "test"; add /acc-app.');
    }
    out('');

    // Step 1: DNS. On a +srv URI every Atlas deployment is discovered here, so a
    // DNS failure means the allowlist was never even consulted.
    let target = { host, port: 27017 };
    if (isSrv) {
        out('1. DNS / SRV lookup');
        const srv = await resolveSrv(host);
        if (!srv.ok) {
            out(`   FAIL  ${srv.err.code || srv.err.message}`);
            out('         This is a name-resolution problem, not an allowlist problem.');
            out('         Check the hostname in MONGO_URI and that this host resolves DNS.');
            process.exit(1);
        }
        const first = srv.records[0];
        out(`   OK    ${srv.records.length} shard(s); first is ${first.name}:${first.port}`);
        target = { host: first.name, port: first.port };
    } else {
        out('1. DNS / SRV lookup');
        out('   SKIP  not an SRV URI');
    }
    out('');

    // Step 2: raw TCP. Atlas only speaks TLS and only after the IP check passes,
    // so an open socket proves the allowlist accepted this source address.
    out('2. TCP connect to the shard');
    const tcp = await probeTcp(target.host, target.port);
    if (tcp.ok) {
        out(`   OK    ${target.host}:${target.port} accepted the connection`);
        out('');
        out('Result: PASS — this host can reach the cluster.');
        out('        If the API still fails, the password or database name is wrong.');
        process.exit(0);
    }

    out(`   FAIL  ${tcp.err.code || tcp.err.message}`);
    out('');

    // Step 3: the actionable bit. Report the egress IP Atlas is rejecting.
    out('3. Outbound (egress) IP of this process');
    const ip = await fetchPublicIp();
    if (ip) {
        out(`   This process connects from: ${ip}`);
    } else {
        out('   Could not determine it (no outbound HTTPS access).');
    }
    out('');
    out('Result: FAIL — MongoDB did not accept a connection from this host.');
    out('');

    if (ip) {
        out(`  The exact address to allowlist for THIS host is: ${ip}`);
        out('');
    }

    out('  Fix (MongoDB Atlas -> Network Access -> Add IP Address):');
    out('    - Render free tier / no static IP add-on: Render\'s egress IPs are');
    out('      dynamic and unpublished, so a single IP will break again on the next');
    out('      host restart. Add 0.0.0.0/0 and rely on the scoped Atlas database user.');
    out('    - Static IP add-on attached: add ONLY the CIDRs shown on the service\'s');
    out('      Connect tab, not the IP printed above.');
    out('');
    out('  Then redeploy Render and look for "MongoDB connected" in the log.');

    process.exit(1);
}

main().catch((err) => {
    out('');
    out(`Unexpected failure: ${maskSecrets(err.message)}`);
    process.exit(1);
});
