// Picks who answers: the Claude-backed cloud function when VITE_CHAT_URL is set and it
// responds in time, otherwise the built-in engine. Either way the user gets an answer.
import { answer } from './engine';

const CHAT_URL = import.meta.env.VITE_CHAT_URL || '';
export const cloudEnabled = Boolean(CHAT_URL);

// Routes the assistant may mention; turned into tappable chips under its reply.
const ROUTES = [
  ['/rice-diseases', 'คลังความรู้โรคข้าว'],
  ['/risk-map', 'แผนที่การระบาด'],
  ['/research-study', 'งานวิจัย'],
  ['/feedback', 'ส่งข้อเสนอแนะ'],
  ['/#app', 'ดาวน์โหลดแอป'],
  ['/privacy', 'นโยบายความเป็นส่วนตัว'],
  ['/terms', 'เงื่อนไขการใช้งาน'],
  ['/apply-researcher', 'สมัครนักวิชาการ'],
  ['/login', 'เข้าสู่ระบบ'],
];
const linksIn = (text) => ROUTES.filter(([to]) => text.includes(to)).map(([to, label]) => ({ to, label }));

/** history: [{role: 'user'|'assistant', content}] ending with the new user message. */
export async function ask(history) {
  const question = history[history.length - 1].content;
  if (CHAT_URL) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12) }),
        signal: ctl.signal,
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429 && data.reply) return { text: data.reply, links: [], suggestions: [], source: 'cloud' };
      if (r.ok && data.reply) return { text: data.reply, links: linksIn(data.reply), suggestions: [], source: 'cloud' };
    } catch {
      // fall through to the built-in engine
    } finally {
      clearTimeout(timer);
    }
  }
  // Built-in answers come back instantly; a short pause reads more naturally.
  await new Promise((r) => setTimeout(r, 450 + Math.min(900, question.length * 12)));
  return { ...answer(question), source: 'local' };
}
