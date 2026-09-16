const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SETUP = path.join(ROOT, 'scripts', 'setup.js');
const EXAMPLE = path.join(ROOT, 'server', '.env.example');

/** Runs the setup script in a child process and returns its stdout. */
function runSetup(args) {
    return execFileSync(process.execPath, [SETUP, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

function tmpFile(name) {
    return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'acc-setup-')), name);
}

describe('setup script', () => {
    it('exits 0 and prints usage for --help', () => {
        const out = runSetup(['--help']);
        expect(out).toMatch(/Usage: npm run setup/);
        expect(out).toMatch(/--dry-run/);
    });

    it('rejects an unknown flag', () => {
        expect(() => runSetup(['--nonsense'])).toThrow();
    });

    it('rejects a malformed --set', () => {
        expect(() => runSetup(['--set=NOPE', '--dry-run'])).toThrow();
    });

    it('rejects --timeout-like bad values rather than guessing', () => {
        expect(() => runSetup(['--set=', '--dry-run'])).toThrow();
    });

    it('--dry-run writes no file', () => {
        const out = tmpFile('.env');
        const stdout = runSetup(['--dry-run', `--out=${out}`]);
        expect(stdout).toMatch(/would write/);
        expect(fs.existsSync(out)).toBe(false);
    });

    it('generates secrets and copies the remaining keys from .env.example', () => {
        const out = tmpFile('.env');
        runSetup([`--out=${out}`]);
        const written = fs.readFileSync(out, 'utf8');

        const exampleKeys = fs
            .readFileSync(EXAMPLE, 'utf8')
            .split(/\r?\n/)
            .map((l) => (/^([A-Za-z_][A-Za-z0-9_]*)=/.exec(l) || [])[1])
            .filter(Boolean);

        // Every key the app reads must survive into the generated file.
        for (const key of exampleKeys) {
            expect(written).toMatch(new RegExp(`^${key}=`, 'm'));
        }
    });

    it('generates distinct, long, hex secrets -- never the example placeholders', () => {
        const out = tmpFile('.env');
        runSetup([`--out=${out}`]);
        const text = fs.readFileSync(out, 'utf8');

        const access = /^JWT_ACCESS_SECRET=(.+)$/m.exec(text)[1];
        const refresh = /^JWT_REFRESH_SECRET=(.+)$/m.exec(text)[1];

        // A shared secret would let a refresh token pass as an access token.
        expect(access).not.toEqual(refresh);
        expect(access).toMatch(/^[0-9a-f]{96}$/);
        expect(refresh).toMatch(/^[0-9a-f]{96}$/);
        expect(text).not.toMatch(/change-me/);
    });

    it('applies --set overrides such as MONGO_URI', () => {
        const out = tmpFile('.env');
        const uri = 'mongodb+srv://u:p@cluster0.abc.mongodb.net/acc-app?retryWrites=true';
        runSetup([`--out=${out}`, `--set=MONGO_URI=${uri}`]);
        expect(fs.readFileSync(out, 'utf8')).toContain(`MONGO_URI=${uri}`);
    });

    it('preserves an existing real secret across runs instead of rotating it', () => {
        const out = tmpFile('.env');
        runSetup([`--out=${out}`]);
        const first = fs.readFileSync(out, 'utf8');
        const firstAccess = /^JWT_ACCESS_SECRET=(.+)$/m.exec(first)[1];

        runSetup([`--out=${out}`]);
        const secondAccess = /^JWT_ACCESS_SECRET=(.+)$/m.exec(fs.readFileSync(out, 'utf8'))[1];

        // Rotating silently on every run would log out every user.
        expect(secondAccess).toEqual(firstAccess);
    });

    it('--force rotates the secrets deliberately', () => {
        const out = tmpFile('.env');
        runSetup([`--out=${out}`]);
        const before = /^JWT_ACCESS_SECRET=(.+)$/m.exec(fs.readFileSync(out, 'utf8'))[1];

        runSetup([`--out=${out}`, '--force']);
        const after = /^JWT_ACCESS_SECRET=(.+)$/m.exec(fs.readFileSync(out, 'utf8'))[1];

        expect(after).not.toEqual(before);
    });

    it('honours quoting in an existing file rather than double-wrapping the value', () => {
        const out = tmpFile('.env');
        fs.writeFileSync(out, 'MONGO_URI="mongodb://keep-me/db"\n', 'utf8');
        runSetup([`--out=${out}`]);
        expect(fs.readFileSync(out, 'utf8')).toContain('MONGO_URI=mongodb://keep-me/db');
    });

    it('warns when MONGO_URI still points at localhost', () => {
        const out = tmpFile('.env');
        const stdout = runSetup([`--out=${out}`, '--set=MONGO_URI=mongodb://127.0.0.1:27017/acc-app']);
        expect(stdout).toMatch(/WARNING/);
        expect(stdout).toMatch(/not on\s+Render|NOT on/);
    });

    it('prints the Render handoff with the required keys', () => {
        const out = tmpFile('.env');
        const stdout = runSetup([`--out=${out}`, '--set=MONGO_URI=mongodb+srv://u:p@c.mongodb.net/db']);
        expect(stdout).toMatch(/PASTE THESE INTO RENDER/);
        expect(stdout).toMatch(/MONGO_URI/);
        expect(stdout).toMatch(/JWT_ACCESS_SECRET/);
        expect(stdout).toMatch(/JWT_REFRESH_SECRET/);
        expect(stdout).toMatch(/CLIENT_URL/);
        expect(stdout).toMatch(/Blueprint/);
    });
});

describe('verify-deploy script', () => {
    it('prints usage for --help', () => {
        const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'verify-deploy.js'), '--help'], {
            cwd: ROOT,
            encoding: 'utf8',
        });
        expect(out).toMatch(/Usage: npm run verify:deploy/);
    });

    it('requires --api-url', () => {
        expect(() =>
            execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'verify-deploy.js')], {
                cwd: ROOT,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
            })
        ).toThrow();
    });

    it('rejects a URL with no scheme, which is a common copy-paste mistake', () => {
        expect(() =>
            execFileSync(
                process.execPath,
                [path.join(ROOT, 'scripts', 'verify-deploy.js'), '--api-url=acc-app-api.onrender.com'],
                { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
            )
        ).toThrow();
    });

    it('rejects a non-numeric timeout', () => {
        expect(() =>
            execFileSync(
                process.execPath,
                [path.join(ROOT, 'scripts', 'verify-deploy.js'), '--api-url=https://x.test', '--timeout=soon'],
                { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
            )
        ).toThrow();
    });
});
