// Builds functions/chatbot/kb.md, the reference text the `chat` function gives Claude,
// from the same sources the website's built-in chat uses (one source of truth):
//   web/src/lib/chatbot/knowledge.js  (system topics)
//   web/src/lib/riceDiseases.js       (Rice Department disease library)
// Run after editing either file:  npm run kb   (inside functions/)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..', '..', 'web', 'src', 'lib');
const { TOPICS, FACTS, GLOSSARY } = await import(pathToFileURL(join(web, 'chatbot', 'knowledge.js')).href);
const { diseases, RKB_ACCESSED } = await import(pathToFileURL(join(web, 'riceDiseases.js')).href);

const parts = [
  '# Rice AI reference',
  `Key figures: ${Object.entries(FACTS).map(([k, v]) => `${k}=${v}`).join(', ')}`,
  '',
  '## System topics',
  ...TOPICS.map((t) => `### ${t.id}\n${t.answer}\nPages: ${t.links.map((l) => `${l.label} (${l.to})`).join(', ') || '-'}`),
  '',
  '## Glossary',
  ...GLOSSARY.map((g) => `- ${g.text}`),
  '',
  `## Rice disease library (Rice Department Rice Knowledge Bank, checked ${RKB_ACCESSED})`,
  'The AI model recognises only: Rice Blast, Bacterial Leaf Blight, Tungro and Healthy leaves (+ "other disease"). Every other disease below is information only.',
  ...diseases.map((d) => [
    `### ${d.name} (${d.tag}) — ${d.category}`,
    `Cause: ${d.cause}. Found: ${d.found}. Risk: ${d.risk}`,
    `Symptoms: ${d.symptoms.join('; ')}`,
    `Prevention: ${d.prevention.join('; ')}`,
    `Department control advice: ${(d.control || []).map((c) => c.text ? c.text + (c.sub ? ` (${c.sub.join('; ')})` : '') : c.note ? `Note: ${c.note}` : '').filter(Boolean).join(' | ')}`,
  ].join('\n')),
];
const out = join(here, 'kb.md');
writeFileSync(out, parts.join('\n\n'));
console.log('kb.md', Math.round(parts.join('\n\n').length / 1024), 'KB,', TOPICS.length, 'topics,', diseases.length, 'diseases');
