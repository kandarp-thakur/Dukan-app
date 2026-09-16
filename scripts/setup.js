#!/usr/bin/env node
'use strict';

/**
 * One command to prepare this project for a Render + Atlas deploy.
 *
 * WHAT IT DOES
 *   1. Generates cryptographically strong JWT secrets.
 *   2. Writes server/.env, preserving any values already present there.
 *   3. Prints the exact key/value block to paste into Render's Environment tab.
 *
 * WHAT IT CANNOT DO -- these are authenticated dashboard actions, and no script
 * committed to a public repo can perform them for you:
 *   - create the Render service            -> Render: New + -> Blueprint
 *   - create the MongoDB Atlas cluster     -> cloud.mongodb.com
 *   - set the Render environment variables -> paste the block this prints
 *
 * USAGE
 *   npm run setup
 *   npm run setup -- --set=MONGO_URI=mongodb+srv://user:pass@cluster/acc-app
 *   npm run setup -- --set=CLIENT_URL=https://my-app.vercel.app
 *   npm run setup -- --dry-run     # print everything, write nothing
 *   npm run setup -- --force       # regenerate secrets even if already set
 *
 * FLAGS
 *   --set=KEY=VALUE   Override a single variable. Repeatable. This is how you
 *                     supply MONGO_URI and CLIENT_URL, which cannot be guessed.
 *   --dry-run         Show the result without touching the filesystem.
 *   --force           Replace existing JWT secrets. WARNING: this invalidates
 *                     every issued session, so all users must log in again.
 *   --out=PATH        Write to a specific file instead of server/.env.
 *                     Mainly useful for testing; see server/tests/setupScript.
 *   --help, -h        Show usage.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');
const EXAMPLE_FILE = path.join(SERVER_DIR, '.env.example');
const DEFAULT_OUT = path.join(SERVER_DIR, '.env');

const SECRET_KEYS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

// Values that ship in .env.example and must never be treated as real.
const PLACEHOLDERS = new Set([
    '',
    'change-me',
    'change-me-access',
    'change-me-refresh',
    'your-secret-here',
]);

const USAGE = `Usage: npm run setup -- [options]

Options:
  --set=KEY=VALUE   Override a variable (repeatable). Use for MONGO_URI,
                    CLIENT_URL and SHARE_LINK_BASE_URL.
  --dry-run         Print the result without writing any file.
  --force           Regenerate JWT secrets (invalidates all existing sessions).
  --out=PATH        Write somewhere other than server/.env.
  --help, -h        Show this message.`;

function parseArgs(argv) {
    const opts = { overrides: {}, dryRun: false, force: false, out: DEFAULT_OUT, help: false };

    for (const arg of argv) {
        if (arg === '--help' || arg === '-h') {
            opts.help = true;
        } else if (arg === '--dry-run') {
            opts.dryRun = true;
        } else if (arg === '--force') {
            opts.force = true;
        } else if (arg.startsWith('--out=')) {
            opts.out = path.resolve(ROOT, arg.slice('--out='.length));
        } else if (arg.startsWith('--set=')) {
            const body = arg.slice('--set='.length);
            const eq = body.indexOf('=');
            if (eq < 1) throw new Error(`--set expects KEY=VALUE, received "${body}"`);
            opts.overrides[body.slice(0, eq)] = body.slice(eq + 1);
        } else {
            throw new Error(`Unknown argument "${arg}". Run with --help for usage.`);
        }
    }

    return opts;
}

function newSecret() {
    return crypto.randomBytes(48).toString('hex');
}

function stripQuotes(value) {
    const v = value.trim();
    if (
        (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
        (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
    ) {
        return v.slice(1, -1);
    }
    return v;
}

/** Parses KEY=VALUE lines. Comments and blanks are ignored. */
function parseEnvText(text) {
    const values = new Map();
    const order = [];

    for (const raw of String(text).split(/\r?\n/)) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(raw);
        if (!match) continue;
        const key = match[1];
        if (!values.has(key)) order.push(key);
        values.set(key, stripQuotes(match[2]));
    }

    return { values, order };
}

function isReal(value) {
    return value !== undefined && !PLACEHOLDERS.has(value.trim());
}

/**
 * Merges example defaults, whatever the user already has, and CLI overrides.
 * Precedence: --set override > existing real value > generated secret >
 * example default.
 */
function resolveValues({ example, existing, overrides, force }) {
    const values = new Map();
    const generated = [];

    const keys = [...example.order, ...existing.order.filter((k) => !example.values.has(k))];

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(overrides, key)) {
            values.set(key, overrides[key]);
            continue;
        }

        const isSecret = SECRET_KEYS.includes(key);

        if (isSecret && force) {
            values.set(key, newSecret());
            generated.push(key);
            continue;
        }

        const current = existing.values.get(key);
        if (isReal(current)) {
            values.set(key, current);
            continue;
        }

        if (isSecret) {
            values.set(key, newSecret());
            generated.push(key);
            continue;
        }

        values.set(key, example.values.get(key) ?? '');
    }

    // A shared secret would let a refresh token be accepted as an access token.
    if (values.get('JWT_ACCESS_SECRET') === values.get('JWT_REFRESH_SECRET')) {
        values.set('JWT_REFRESH_SECRET', newSecret());
        if (!generated.includes('JWT_REFRESH_SECRET')) generated.push('JWT_REFRESH_SECRET');
    }

    return { values, generated };
}

function serializeEnv(values) {
    const header = [
        '# Generated by scripts/setup.js -- local development only.',
        '# This file is gitignored. Never commit it; never reuse these secrets in prod.',
        '',
    ];
    const body = [...values.entries()].map(([key, value]) => `${key}=${value}`);
    return `${[...header, ...body].join('\n')}\n`;
}

function isLocalhost(uri) {
    return /(^|\/\/)(127\.0\.0\.1|localhost|0\.0\.0\.0)(:|\/|$)/.test(String(uri));
}

function printRenderHandoff(values) {
    const line = '-'.repeat(70);
    const mongoUri = values.get('MONGO_URI') || '';
    const clientUrl = values.get('CLIENT_URL') || '';

    console.log('');
    console.log(line);
    console.log('PASTE THESE INTO RENDER  ->  your service  ->  Environment');
    console.log(line);
    console.log('');
    console.log('Required (the server exits 1 without all three):');
    console.log('');
    console.log(`MONGO_URI           ${mongoUri || '<paste your Atlas URI>'}`);
    console.log(`JWT_ACCESS_SECRET   ${values.get('JWT_ACCESS_SECRET')}`);
    console.log(`JWT_REFRESH_SECRET  ${values.get('JWT_REFRESH_SECRET')}`);
    console.log('');
    console.log('Strongly recommended (without it the deployed frontend is CORS-blocked):');
    console.log('');
    console.log(`CLIENT_URL          ${clientUrl || '<your Vercel URL, no trailing slash>'}`);
    console.log(`SHARE_LINK_BASE_URL ${clientUrl || '<same as CLIENT_URL>'}`);
    console.log('');
    console.log(line);
    console.log('NEXT STEPS');
    console.log(line);
    console.log('1. Render -> New + -> Blueprint -> connect this repo.');
    console.log('   Create the service as a BLUEPRINT, not a plain Web Service.');
    console.log('   A manual Web Service ignores render.yaml, never prompts for the');
    console.log('   sync:false values, and boots on the wrong Node version.');
    console.log('2. Paste the values above when prompted, then Redeploy.');
    console.log('3. Verify:  npm run verify:deploy -- --api-url=https://<service>.onrender.com');
    console.log('');
    console.log('Need the Atlas URI? cloud.mongodb.com -> Connect -> Drivers.');
    console.log('Allow Render in Atlas -> Network Access: 0.0.0.0/0 unless you');
    console.log('attached a static IP add-on and have its outbound CIDRs.');
    console.log('');

    if (mongoUri && isLocalhost(mongoUri)) {
        console.log('WARNING: MONGO_URI points at localhost. That works locally but NOT on');
        console.log('Render, where there is no local MongoDB. Supply the Atlas URI with');
        console.log('  npm run setup -- --set=MONGO_URI=<atlas-uri>');
        console.log('');
    }

    console.log('Treat this output as a secret. Do not paste it into issues, chats or');
    console.log('screenshots -- anyone with these values can mint valid auth tokens.');
    console.log('');
}

function main() {
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2));
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(2);
    }

    if (opts.help) {
        console.log(USAGE);
        return;
    }

    if (!fs.existsSync(EXAMPLE_FILE)) {
        console.error(`Error: cannot find ${path.relative(ROOT, EXAMPLE_FILE)}.`);
        console.error('Run this from a checkout of the repo (npm run setup handles that).');
        process.exit(2);
    }

    const example = parseEnvText(fs.readFileSync(EXAMPLE_FILE, 'utf8'));

    let existing = { values: new Map(), order: [] };
    const fileExists = fs.existsSync(opts.out);
    if (fileExists) {
        existing = parseEnvText(fs.readFileSync(opts.out, 'utf8'));
    }

    const { values, generated } = resolveValues({
        example,
        existing,
        overrides: opts.overrides,
        force: opts.force,
    });

    const serialized = serializeEnv(values);

    console.log('');
    console.log(`Source template : ${path.relative(ROOT, EXAMPLE_FILE)}`);
    console.log(`Target          : ${path.relative(ROOT, opts.out)}`);
    console.log(`Existing file   : ${fileExists ? 'yes (values preserved)' : 'no (creating)'}`);
    console.log(`Mode            : ${opts.dryRun ? 'dry run (nothing written)' : 'write'}`);

    if (generated.length) {
        console.log(`Generated       : ${generated.join(', ')}`);
    } else {
        console.log('Generated       : none (existing secrets reused)');
    }

    if (opts.dryRun) {
        console.log('');
        console.log('--- would write ---');
        console.log(serialized.trimEnd());
        console.log('--- end ---');
    } else {
        fs.mkdirSync(path.dirname(opts.out), { recursive: true });
        fs.writeFileSync(opts.out, serialized, 'utf8');
        console.log(`Wrote           : ${path.relative(ROOT, opts.out)}`);
    }

    printRenderHandoff(values);
}

main();
