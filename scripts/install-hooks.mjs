// Turns on the repository's git hooks (.githooks/) for this clone: node scripts/install-hooks.mjs
import { execFileSync } from 'node:child_process';

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
const email = execFileSync('git', ['config', 'user.email']).toString().trim();
console.log('Git hooks enabled: leak check runs before every commit and push.');
if (!/@users\.noreply\.github\.com$/.test(email)) {
  console.log(`Note: your git e-mail is ${email || '(not set)'}. Commits are blocked until it is a GitHub noreply address:`);
  console.log('  git config user.email "<id>+<username>@users.noreply.github.com"   (GitHub -> Settings -> Emails shows yours)');
}
