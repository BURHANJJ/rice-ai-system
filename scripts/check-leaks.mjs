#!/usr/bin/env node
// Leak guard for this public repository. Run by the git hooks in .githooks/ and by CI.
//
//   node scripts/check-leaks.mjs --staged                 files about to be committed
//   node scripts/check-leaks.mjs --range <a>..<b>         every commit in a range
//   node scripts/check-leaks.mjs --all                    the whole tree at HEAD
//   node scripts/check-leaks.mjs --pre-push <remote> <url>   (reads the hook's stdin)
//   add --identity to also require a GitHub noreply author/committer e-mail
//
// It blocks: files that must stay out of the repository (report, videos, documents, Firebase project
// config, keys, backups), top-level items that are not on the allow-list, files over 25 MB, secrets and
// personal data in file contents, and a personal e-mail address in the commit author. A line that
// really is fine can carry the comment `leak-check:ignore`.
import { execFileSync } from 'node:child_process';

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_SCAN_BYTES = 2 * 1024 * 1024;
const ZERO = /^0+$/;

// Anything at the top level that is not listed here is treated as unintended.
const ROOT_ALLOW = new Set([
  '.firebaserc', '.gitattributes', '.githooks', '.github', '.gitignore', 'CONTRIBUTING.md', 'LICENSE', 'NOTICE',
  'README.md', 'SECURITY.md', 'ai-service', 'docs', 'firebase.json', 'firestore.indexes.json', 'firestore.rules',
  'functions', 'mobile', 'scripts', 'tests', 'web',
]);

const PATH_RULES = [
  [/^docs\/report\//, 'the project report stays out of the repository'],
  [/^video\//, 'the presentation video project stays out of the repository'],
  [/^web\/public\/media\//, 'embedded video files stay out of the repository'],
  [/^output\//, 'generated output'],
  [/(^|\/)(google-services\.json|GoogleService-Info\.plist|firebase_options\.dart)$/, 'Firebase project config (commit the .example template instead)'],
  [/(^|\/)\.env(\.(?!example$)[^/]+)?$/, 'environment file'],
  [/(serviceaccount|service-account|-adminsdk-)[^/]*\.json$/i, 'service account key'],
  [/\.(keystore|jks|p12|pfx|pem|key)$/i, 'signing key or certificate'],
  [/(^|\/)key\.properties$/, 'Android signing properties'],
  [/\.(pdf|docx?|pptx?|xlsx?)$/i, 'document (reports and guides are not published)'],
  [/\.(mp4|mov|avi|mkv|webm|wav|mp3|m4a)$/i, 'video or audio file'],
  [/\.(apk|aab|ipa)$/i, 'app binary (publish it as a GitHub Release instead)'],
  [/\.(old|bak|orig|tmp)$/i, 'backup file'],
  [/(^|\/)(check_|seed_)[^/]*\.(c|m)?js$|(^|\/)make_admin\.js$/, 'local dev script that talks to production'],
  [/site-copy-review|master[_-]?guide/i, 'internal review material'],
];

const bs = String.fromCharCode(92);
const CONTENT_RULES = [
  ['Google/Firebase API key', /AIza[0-9A-Za-z_-]{35}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['service account key', /"type"\s*:\s*"service_account"/],
  ['Anthropic/OpenAI API key', /\bsk-(ant-)?[A-Za-z0-9_-]{24,}/],
  ['GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google OAuth client secret', /GOCSPX-[A-Za-z0-9_-]{10,}/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['FCM server key', /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{100,}/],
  // a quoted ASCII value of 12+ characters that is not an obvious placeholder
  ['hard-coded credential', /(password|passwd|secret|api[_-]?key|token)['"]?\s*[:=]\s*['"]([A-Za-z0-9_\-./+=]{12,})['"]/i,
    (m) => !/^(your[_-]|<|example|placeholder|changeme|x{4,}|\*+|\$\{)/i.test(m[2]) && !/^(.)\1+$/.test(m[2])],
  // written in pieces so this file does not trip its own check
  ['student ID', new RegExp('\\b' + '66206' + '10113' + '\\b')],
  ['Thai mobile number', /\b0[689]\d{8}\b/],
  ['local machine path', new RegExp(`[A-Za-z]:[${bs}${bs}/]+Users[${bs}${bs}/]+|D:[${bs}${bs}/]+Project[${bs}${bs}/]`)],
  ['personal e-mail', new RegExp('burhan' + 'jewjoubb')],
];
// The author's public contact address is meant to be on the website and in the chatbot's knowledge.
const PERSONAL_EMAIL_OK = new Set([
  'web/src/lib/legalContent.js', 'web/src/lib/chatbot/knowledge.js', 'functions/chatbot/kb.md', 'functions/index.js',
]);

const NOREPLY = /(@users\.noreply\.github\.com|^noreply@github\.com)$/;

const git = (args, input) => execFileSync('git', ['-c', 'core.quotepath=off', ...args], { input, maxBuffer: 1 << 29 });
const text = (args, input) => git(args, input).toString('utf8');

function parseRaw(buf) {
  // `git diff-tree/diff --raw -z`: ":mode mode sha sha STATUS\0path\0"
  const parts = buf.toString('utf8').split('\0');
  const out = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const m = /^:(\d+) (\d+) ([0-9a-f]+) ([0-9a-f]+) (\w)/.exec(parts[i]);
    if (m && m[5] !== 'D' && m[2] !== '160000') out.push({ path: parts[i + 1], sha: m[4] });
  }
  return out;
}

const entriesStaged = () => parseRaw(git(['diff', '--cached', '--raw', '-z', '--no-abbrev', '--no-renames', '--diff-filter=ACMR']));
const entriesCommit = (sha) => parseRaw(git(['diff-tree', '-r', '--root', '--raw', '-z', '--no-abbrev', '--no-renames', '--no-commit-id', sha]));
function entriesTree() {
  return text(['ls-tree', '-r', '-z', '--full-tree', 'HEAD']).split('\0').filter(Boolean).map((l) => {
    const [meta, path] = l.split('\t');
    const [mode, , sha] = meta.split(' ');
    return mode === '160000' ? null : { path, sha };
  }).filter(Boolean);
}

function blobInfo(shas) {
  const info = new Map();
  if (!shas.length) return info;
  for (const line of text(['cat-file', '--batch-check'], shas.join('\n') + '\n').split('\n')) {
    const m = /^([0-9a-f]+) blob (\d+)$/.exec(line);
    if (m) info.set(m[1], Number(m[2]));
  }
  return info;
}

function readBlobs(shas) {
  const out = new Map();
  if (!shas.length) return out;
  const buf = git(['cat-file', '--batch'], shas.join('\n') + '\n');
  let pos = 0;
  while (pos < buf.length) {
    const eol = buf.indexOf(10, pos);
    if (eol < 0) break;
    const m = /^([0-9a-f]+) (\w+) (\d+)$/.exec(buf.toString('utf8', pos, eol));
    if (!m) break;
    const size = Number(m[3]);
    out.set(m[1], buf.subarray(eol + 1, eol + 1 + size));
    pos = eol + 1 + size + 1;
  }
  return out;
}

function checkEntries(entries, label = '') {
  const problems = [];
  const add = (path, why) => problems.push(`${label}${path}: ${why}`);
  const seen = new Set();
  for (const { path } of entries) {
    const rule = PATH_RULES.find(([rx]) => rx.test(path));
    const top = path.split('/')[0];
    if (rule) add(path, rule[1]);
    else if (!ROOT_ALLOW.has(top)) add(path, `top-level item "${top}" is not on the allow-list (ROOT_ALLOW in scripts/check-leaks.mjs)`);
    else if (top === 'docs' && !/^docs\/(SETUP\.md|images\/)/.test(path)) add(path, 'docs/ holds the setup guide only');
  }
  const sizes = blobInfo([...new Set(entries.map((e) => e.sha))]);
  const toScan = [];
  for (const { path, sha } of entries) {
    const size = sizes.get(sha) ?? 0;
    if (size > MAX_BYTES) add(path, `${(size / 1048576).toFixed(1)} MB is over the ${MAX_BYTES / 1048576} MB limit`);
    else if (size <= MAX_SCAN_BYTES && !seen.has(sha)) { seen.add(sha); toScan.push({ path, sha }); }
  }
  const blobs = readBlobs(toScan.map((e) => e.sha));
  for (const { path, sha } of toScan) {
    const data = blobs.get(sha);
    if (!data || data.subarray(0, 8192).includes(0)) continue; // binary
    const lines = data.toString('utf8').split('\n');
    for (const [name, rx, accept = () => true] of CONTENT_RULES) {
      if (name === 'personal e-mail' && PERSONAL_EMAIL_OK.has(path)) continue;
      const i = lines.findIndex((l) => { const m = rx.exec(l); return m && accept(m) && !l.includes('leak-check:ignore'); });
      if (i >= 0) add(path, `${name} on line ${i + 1}`);
    }
  }
  return problems;
}

function badEmail(who, email) {
  return NOREPLY.test(email) ? [] : [`${who} e-mail ${email} is not a GitHub noreply address. Run: git config user.email "<id>+<user>@users.noreply.github.com"`];
}

function currentIdentity() {
  const email = (v) => /<([^>]*)>/.exec(text(['var', v]))?.[1] ?? '';
  return [...badEmail('author', email('GIT_AUTHOR_IDENT')), ...badEmail('committer', email('GIT_COMMITTER_IDENT'))];
}

function checkCommits(revs, identity) {
  const problems = [];
  for (const sha of revs) {
    const short = sha.slice(0, 7);
    if (identity) {
      const [ae, ce] = text(['show', '-s', '--format=%ae%n%ce', sha]).trim().split('\n');
      problems.push(...badEmail(`commit ${short} author`, ae), ...(ce !== ae ? badEmail(`commit ${short} committer`, ce) : []));
    }
    problems.push(...checkEntries(entriesCommit(sha), `[${short}] `));
  }
  return problems;
}

function revList(args) {
  try { return text(['rev-list', '--reverse', ...args]).split('\n').filter(Boolean); } catch { return null; }
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const argv = process.argv.slice(2);
  const identity = argv.includes('--identity');
  let problems = [];
  let scope = '';
  if (argv.includes('--staged')) {
    scope = 'staged files';
    problems = checkEntries(entriesStaged());
    if (identity) problems.unshift(...currentIdentity());
  } else if (argv.includes('--all')) {
    scope = 'the whole tree';
    problems = checkEntries(entriesTree());
  } else if (argv.includes('--range')) {
    const range = argv[argv.indexOf('--range') + 1];
    scope = `commits ${range}`;
    problems = checkCommits(revList([range]) ?? [], identity);
  } else if (argv.includes('--pre-push')) {
    const i = argv.indexOf('--pre-push');
    const remote = argv[i + 1];
    const url = argv[i + 2] || '';
    if (/rice-ai-system-private/.test(url)) process.exit(0);
    scope = `what would be pushed to ${remote}`;
    const seen = new Set();
    for (const line of (await readStdin()).split('\n').filter(Boolean)) {
      const [, localSha, , remoteSha] = line.split(' ');
      if (ZERO.test(localSha)) continue; // deleting a ref
      const revs = ZERO.test(remoteSha)
        ? revList([localSha, '--not', `--remotes=${remote}`])
        : (revList([`${remoteSha}..${localSha}`]) ?? revList([localSha, '--not', `--remotes=${remote}`]));
      problems.push(...checkCommits((revs ?? []).filter((s) => !seen.has(s) && seen.add(s)), true));
    }
  } else if (argv.includes('--identity')) {
    scope = 'commit identity';
    problems = currentIdentity();
  } else {
    console.error('Usage: check-leaks.mjs --staged | --all | --range a..b | --pre-push <remote> <url> [--identity]');
    process.exit(2);
  }
  if (problems.length) {
    console.error(`\nLeak check FAILED for ${scope}:\n`);
    for (const p of problems) console.error(`  x ${p}`);
    console.error('\nNothing was published. Remove or unstage the items above (git rm --cached <file>, git commit --amend).');
    console.error('A line that is really fine can carry the comment "leak-check:ignore"; to allow a new top-level item edit ROOT_ALLOW in scripts/check-leaks.mjs.\n');
    process.exit(1);
  }
  console.log(`Leak check passed (${scope}).`);
}

main();
