// Tests for check-leaks.mjs and the git hooks. Run: node --test scripts/check-leaks.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, 'check-leaks.mjs');
const HOOKS = join(here, '..', '.githooks');
const NOREPLY = '1+tester@users.noreply.github.com';
const made = [];

// Fake secrets are assembled at run time so this file never contains a real-looking one.
const fakeApiKey = () => 'AI' + 'za' + 'A'.repeat(35);
const personalMail = () => 'burhan' + 'jewjoubb@gmail.com';

const run = (cwd, cmd, args, env = {}) => spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
const git = (cwd, ...args) => run(cwd, 'git', args);

function repo({ email = NOREPLY } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'leakcheck-'));
  made.push(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.name', 'Tester');
  git(dir, 'config', 'user.email', email);
  git(dir, 'config', 'core.autocrlf', 'false');
  return dir;
}

function stage(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  git(dir, 'add', '-A');
}

const check = (dir, ...args) => run(dir, process.execPath, [SCRIPT, ...args]);
const staged = (files, opts) => { const d = repo(opts); stage(d, files); return check(d, '--staged'); };

after(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('files that must stay out', () => {
  const blocked = {
    'the report folder': { 'docs/report/chapter1.md': 'x' },
    'a PDF': { 'web/src/guide.pdf': 'x' },
    'a Word file': { 'docs/SETUP.docx': 'x' },
    'a video': { 'web/public/media/promo.mp4': 'x' },
    'the video project': { 'video/package.json': '{}' },
    'an audio file': { 'web/public/a.wav': 'x' },
    'an APK': { 'web/public/downloads/app.apk': 'x' },
    'a backup file': { 'web/src/App.jsx.old': 'x' },
    'a local env file': { 'web/.env.local': 'A=1' },
    'Firebase Android config': { 'mobile/android/app/google-services.json': '{}' },
    'FlutterFire options': { 'mobile/lib/firebase_options.dart': '//' },
    'a signing key': { 'mobile/android/app/upload.keystore': 'x' },
    'a service account file': { 'scripts/rice-ai-adminsdk-abc.json': '{}' },
    'an old dev script': { 'web/make_admin.js': '//' },
    'a file at the repository root': { 'notes.txt': 'x' },
    'review material under docs': { 'docs/site-copy-review/a.png': 'x' },
  };
  for (const [name, files] of Object.entries(blocked)) {
    it(`blocks ${name}`, () => assert.equal(staged(files).status, 1));
  }

  it('allows the templates and ordinary source', () => {
    const r = staged({
      'web/.env.example': 'VITE_X=', 'mobile/android/app/google-services.json.example': '{}', 'README.md': '# x',
      'docs/SETUP.md': '# x', 'web/src/App.jsx': 'export {}', 'tests/a.test.mjs': '//',
    });
    assert.equal(r.status, 0, r.stderr);
  });

  it('blocks a file over 25 MB', () => {
    const d = repo();
    stage(d, { 'web/public/big.bin': Buffer.alloc(26 * 1024 * 1024, 1) });
    assert.equal(check(d, '--staged').status, 1);
  });
});

describe('secrets and personal data in contents', () => {
  it('blocks a Firebase API key', () => assert.equal(staged({ 'web/src/a.js': `const k = '${fakeApiKey()}';` }).status, 1));
  it('blocks a private key block', () => assert.equal(staged({ 'web/src/a.js': '-----BEGIN ' + 'PRIVATE KEY-----' }).status, 1));
  it('blocks a hard-coded credential', () => assert.equal(staged({ 'web/src/a.js': "const password = 'correct-horse-battery';" }).status, 1)); // leak-check:ignore (deliberately fake sample)
  it('blocks the personal e-mail in new places', () => assert.equal(staged({ 'web/src/a.js': `// ${personalMail()}` }).status, 1));
  it('blocks a Thai mobile number', () => assert.equal(staged({ 'web/src/a.js': "const phone = '0812345678';" }).status, 1)); // leak-check:ignore (deliberately fake sample)
  it('blocks a local machine path', () => assert.equal(staged({ 'ai-service/a.py': "p = r'C:\\Users\\me\\x'" }).status, 1)); // leak-check:ignore (deliberately fake sample)

  it('lets the public contact address stay where it belongs', () => {
    assert.equal(staged({ 'web/src/lib/legalContent.js': `export const CONTACT_EMAIL = '${personalMail()}';` }).status, 0);
  });
  it('ignores placeholders and Thai text', () => {
    const r = staged({ 'mobile/lib/o.dart': "apiKey: 'YOUR_WEB_API_KEY'", 'web/src/m.js': "'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง'," });
    assert.equal(r.status, 0, r.stderr);
  });
  it('honours the leak-check:ignore comment', () => {
    assert.equal(staged({ 'web/src/a.js': `const k = '${fakeApiKey()}'; // leak-check:ignore` }).status, 0);
  });
});

describe('commit identity', () => {
  it('blocks a personal e-mail as the commit author', () => {
    const d = repo({ email: personalMail() });
    stage(d, { 'README.md': '# x' });
    const r = check(d, '--staged', '--identity');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /noreply/);
  });
  it('accepts a GitHub noreply address', () => {
    const d = repo();
    stage(d, { 'README.md': '# x' });
    assert.equal(check(d, '--staged', '--identity').status, 0);
  });
});

describe('history', () => {
  it('still fails when a forbidden file was added and removed in a later commit', () => {
    const d = repo();
    stage(d, { 'README.md': '# x' });
    git(d, 'commit', '-q', '-m', 'base');
    stage(d, { 'docs/report/r.md': 'x' });
    git(d, 'commit', '-q', '-m', 'adds the report');
    git(d, 'rm', '-q', '-r', 'docs/report');
    git(d, 'commit', '-q', '-m', 'removes it again');
    assert.equal(check(d, '--range', 'HEAD~2..HEAD').status, 1);
    assert.equal(check(d, '--all').status, 0, 'the final tree itself is clean');
  });
});

describe('git hooks', () => {
  function withHooks() {
    const d = repo();
    cpSync(HOOKS, join(d, '.githooks'), { recursive: true });
    mkdirSync(join(d, 'scripts'));
    cpSync(SCRIPT, join(d, 'scripts', 'check-leaks.mjs'));
    git(d, 'config', 'core.hooksPath', '.githooks');
    return d;
  }

  it('pre-commit refuses a commit that carries a secret', () => {
    const d = withHooks();
    stage(d, { 'web/src/a.js': `const k = '${fakeApiKey()}';` });
    const r = git(d, 'commit', '-m', 'oops');
    assert.notEqual(r.status, 0);
    assert.equal(git(d, 'rev-list', '--count', '--all').stdout.trim(), '0', 'no commit was created');
  });

  it('pre-commit lets a clean commit through', () => {
    const d = withHooks();
    stage(d, { 'README.md': '# x' });
    assert.equal(git(d, 'commit', '-m', 'ok').status, 0);
  });

  it('pre-push stops a bad commit from reaching a public remote', () => {
    const d = withHooks();
    const remote = mkdtempSync(join(tmpdir(), 'leakremote-'));
    made.push(remote);
    git(remote, 'init', '-q', '--bare', '-b', 'main');
    git(d, 'remote', 'add', 'origin', remote);
    stage(d, { 'README.md': '# x' });
    git(d, 'commit', '-q', '-m', 'ok');
    git(d, 'config', 'core.hooksPath', '/nonexistent'); // let a bad commit be created, then re-enable the hook for the push
    stage(d, { 'docs/report/r.md': 'x' });
    git(d, 'commit', '-q', '-m', 'bad');
    git(d, 'config', 'core.hooksPath', '.githooks');
    const r = git(d, 'push', 'origin', 'main');
    assert.notEqual(r.status, 0);
    assert.equal(git(remote, 'rev-list', '--count', '--all').stdout.trim(), '0', 'the remote received nothing');
  });

  it('pre-push does not check the private archive', () => {
    const d = withHooks();
    const base = mkdtempSync(join(tmpdir(), 'leak-'));
    made.push(base);
    const remote = join(base, 'rice-ai-system-private.git');
    mkdirSync(remote);
    git(remote, 'init', '-q', '--bare', '-b', 'main');
    git(d, 'remote', 'add', 'old-private', remote);
    git(d, 'config', 'core.hooksPath', '/nonexistent');
    stage(d, { 'docs/report/r.md': 'x' });
    git(d, 'commit', '-q', '-m', 'private material');
    git(d, 'config', 'core.hooksPath', '.githooks');
    assert.equal(git(d, 'push', 'old-private', 'main').status, 0);
  });
});
