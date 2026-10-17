// In-browser answer engine for Khao Hom's chat: no network, no cost, always available.
// Order: guard rails (abuse, prompt tricks, gibberish) → small talk → a named rice disease
// (from the Rice Department library) → system topics (knowledge.js) → polite fallback.
// The cloud AI (functions/index.js `chat`) is used instead when it is configured and reachable.
import { diseases } from '../riceDiseases';
import { SUGGESTIONS, TOPICS } from './knowledge';

/** Lowercase, drop spaces and punctuation, keep Thai, latin letters and digits. */
export const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[^฀-๿a-z0-9]/g, '');
const has = (t, words) => words.some((w) => t.includes(w));
const pick = (list, seed) => list[Math.abs(seed) % list.length];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

// The four classes the model itself recognises (V3 adds "other").
const DETECTABLE = new Set(['Rice Blast', 'Bacterial Leaf Blight', 'Tungro']);
const ALIASES = {
  'Rice Blast': ['ใบไหม้', 'โรคไหม้', 'blast', 'ไหม้คอรวง'],
  'Bacterial Leaf Blight': ['ขอบใบแห้ง', 'blb', 'leafblight', 'bacterialblight'],
  Tungro: ['ใบสีส้ม', 'ใบส้ม', 'tungro', 'ทังโร'],
  'Brown Spot': ['ใบจุดสีน้ำตาล', 'จุดสีน้ำตาล', 'brownspot'],
  'Bacterial Leaf Streak': ['ใบขีดโปร่งแสง', 'leafstreak'],
  'Sheath Blight': ['กาบใบแห้ง', 'sheathblight'],
  'Ragged Stunt': ['ใบหงิก', 'โรคจู๋', 'raggedstunt'],
  'Dirty Panicle': ['เมล็ดด่าง', 'dirtypanicle'],
  Bakanae: ['ถอดฝักดาบ', 'bakanae', 'ต้นยืด'],
  'Grassy Stunt': ['เขียวเตี้ย', 'grassystunt'],
};

const DISEASE_KEYS = diseases.flatMap((d) => {
  const base = d.name.replace(/\s*\(.*\)/, '');
  const keys = [norm(base), norm(base.replace(/^โรค/, '')), norm(d.tag), ...(ALIASES[d.tag] || []).map(norm)];
  return [...new Set(keys)].filter((k) => k.length >= 3).map((k) => ({ k, d }));
}).sort((a, b) => b.k.length - a.k.length);

function findDisease(t) {
  const hit = DISEASE_KEYS.find(({ k }) => t.includes(k));
  return hit ? hit.d : null;
}

const list = (items, n = 4) => items.slice(0, n).map((x) => `- ${x}`).join('\n');
const controlText = (d) => (d.control || []).filter((c) => c.text).slice(0, 4).map((c) => c.text);

function diseaseAnswer(d, t) {
  const name = d.name.replace(/\s*\(.*\)/, '');
  const head = `**${d.name}** (${d.tag}) · สาเหตุจาก${d.category}`;
  const aiNote = DETECTABLE.has(d.tag)
    ? `\n\nAI ของ Rice AI **ตรวจโรคนี้จากรูปใบข้าวได้** ครับ`
    : `\n\nโรคนี้ AI ยังไม่ได้ถูกสอนให้ระบุชื่อ ถ้าสแกนอาจได้ผลเป็น "โรคอื่น" แนะนำเทียบอาการกับคลังความรู้และปรึกษาเจ้าหน้าที่ครับ`;
  let body;
  if (has(t, ['อาการ', 'ลักษณะ', 'ดูยังไง', 'สังเกต', 'symptom', 'รูปร่าง'])) {
    body = `อาการของ${name}ครับ\n${list(d.symptoms, 5)}`;
  } else if (has(t, ['สาเหตุ', 'เชื้อ', 'เกิดจาก', 'cause', 'ทำไมเป็น'])) {
    body = `${name}เกิดจาก**${d.category}** เชื้อสาเหตุคือ *${d.cause}* ครับ\nสภาพที่เสี่ยง: ${d.risk}`;
  } else if (has(t, ['ป้องกัน', 'กำจัด', 'รักษา', 'แก้', 'ยา', 'สาร', 'ฉีด', 'พ่น', 'จัดการ', 'control', 'treat', 'prevent'])) {
    const ctl = controlText(d);
    body = `การป้องกันและจัดการ${name} (สรุปจากกรมการข้าว)\n${list(d.prevention, 4)}${ctl.length ? `\n\nวิธีป้องกันกำจัดของกรมการข้าว\n${list(ctl, 3)}` : ''}\n\n**ก่อนใช้สารเคมีควรปรึกษาเจ้าหน้าที่เกษตรในพื้นที่ และใช้ตามอัตราบนฉลากครับ**`;
  } else if (has(t, ['พันธุ์', 'ต้านทาน', 'ทนโรค', 'ทนต่อ', 'variety', 'resistant'])) {
    const v = (d.control || []).filter((c) => c.text && /พันธุ์/.test(c.text));
    const lines = v.map((c) => `- ${c.text}${c.sub ? `\n${c.sub.map((x) => `  - ${x}`).join('\n')}` : ''}`).join('\n');
    body = v.length
      ? `พันธุ์ข้าวที่กรมการข้าวแนะนำสำหรับ${name}\n${lines}\n\nความต้านทานขึ้นกับพื้นที่และสภาพอากาศ ควรสอบถามศูนย์วิจัยข้าวในพื้นที่ด้วยครับ`
      : `ข้อมูลของกรมการข้าวสำหรับ${name}ไม่ได้ระบุพันธุ์ต้านทานไว้ครับ แนะนำสอบถามศูนย์วิจัยข้าวหรือเจ้าหน้าที่เกษตรในพื้นที่`;
  } else if (has(t, ['เสี่ยง', 'ระบาด', 'สภาพ', 'อากาศ', 'ช่วงไหน', 'เมื่อไหร่'])) {
    body = `${name}มักระบาดเมื่อ ${d.risk}\nพบได้: ${d.found}`;
  } else {
    body = `${head}\n\n**อาการ**\n${list(d.symptoms, 3)}\n\n**ป้องกัน**\n${list(d.prevention, 3)}`;
    return { text: body + aiNote, links: [{ label: 'ดูข้อมูลเต็มและรูปประกอบ', to: '/rice-diseases' }], suggestions: [`สาเหตุ${name}`, `ป้องกัน${name}ยังไง`] };
  }
  return { text: `${head}\n\n${body}${aiNote}`, links: [{ label: 'ดูข้อมูลเต็มและรูปประกอบ', to: '/rice-diseases' }], suggestions: [`อาการ${name}`, `ป้องกัน${name}ยังไง`].filter((s) => !has(t, [norm(s)])) };
}

// Specific forms only: single syllables like กู/ห่า/ควาย also occur in กู้ ห่าง and real farm talk.
const PROFANE = ['เหี้ย', 'สัส', 'ควย', 'เย็ด', 'ไอ้สัตว์', 'ไอสัตว์', 'อีดอก', 'ส้นตีน', 'แม่ง', 'มึง', 'fuck', 'shit', 'bitch', 'ไอ้ห่า', 'ระยำ', 'ชาติหมา', 'ไอ้ควาย', 'อีควาย'];
const CRITICAL = ['ห่วย', 'กากมาก', 'แอปกาก', 'บอทกาก', 'บอทโง่', 'aiโง่', 'โง่จัง', 'โง่มาก', 'แย่มาก', 'ไร้สาระ', 'ไม่ได้เรื่อง', 'ไม่เห็นช่วย', 'useless', 'stupid', 'dumb', 'trash'];
const INJECTION = ['ignore', 'systemprompt', 'prompt', 'jailbreak', 'ลืมคำสั่ง', 'ไม่ต้องทำตาม', 'แกล้งทำเป็น', 'roleplay', 'developermode', 'เปิดเผยคำสั่ง', 'instructions'];
const GREET = ['สวัสดี', 'หวัดดี', 'ดีครับ', 'ดีค่ะ', 'ดีจ้า', 'hello', 'hi', 'hey', 'สวัสดีตอน'];
const THANKS = ['ขอบคุณ', 'ขอบใจ', 'thank', 'thx', 'แต้งกิ้ว'];
const BYE = ['บาย', 'ลาก่อน', 'bye', 'ไปละ', 'แค่นี้'];
const WHO = ['คุณคือใคร', 'เป็นใคร', 'ชื่ออะไร', 'คนจริง', 'เป็นคน', 'บอท', 'bot', 'whoareyou', 'aiหรือ', 'หุ่นยนต์'];
const HOWAREYOU = ['สบายดีไหม', 'เป็นไงบ้าง', 'howareyou'];
const FLIRT = ['รักนะ', 'รักน้อง', 'รักคุณ', 'ชอบน้อง', 'ชอบคุณ', 'เป็นแฟน', 'จีบ', 'น่ารัก', 'คิดถึง', 'loveyou', 'marryme'];
const LAUGH = ['555', 'ฮ่าฮ่า', 'lol', 'lmao', 'ขำ'];
// Clearly unrelated requests: answered with a polite boundary, not with made-up help.
const OFFTOPIC = ['การเมือง', 'นายก', 'เลือกตั้ง', 'หวย', 'เลขเด็ด', 'บอล', 'หุ้น', 'คริปโต', 'bitcoin', 'การบ้าน', 'แก้โจทย์', 'เขียนโค้ด', 'code', 'python', 'สูตรอาหาร', 'ทำอาหาร', 'ดูดวง', 'เกม', 'หนัง', 'เพลง', 'ศาสนา', 'แปลภาษา', 'สมการ'];

const replies = {
  empty: 'พิมพ์คำถามเกี่ยวกับ Rice AI หรือโรคข้าวได้เลยครับ หรือเลือกคำถามด้านล่างก็ได้',
  profane: [
    'ผมเข้าใจว่าอาจกำลังหงุดหงิดอยู่ครับ ถ้าใช้งานแล้วติดปัญหา บอกผมได้เลยว่าเกิดอะไรขึ้น ผมยินดีช่วยหาทางแก้ให้ครับ',
    'ขอให้เราคุยกันอย่างสุภาพนะครับ ผมพร้อมช่วยเรื่องการใช้งาน Rice AI และโรคข้าว มีอะไรให้ช่วยบอกได้เลยครับ',
  ],
  critical: 'ขอบคุณที่บอกตรง ๆ ครับ ถ้าบอกได้ว่าส่วนไหนยังไม่ดีหรือใช้แล้วติดตรงไหน ผมจะช่วยดูให้ และแนะนำให้ส่งรายละเอียดผ่านหน้า **ส่งข้อเสนอแนะ** ทีมพัฒนาจะได้นำไปปรับปรุงครับ',
  injection: 'ขออภัยครับ ผมทำตามคำขอแบบนั้นไม่ได้ ผมเป็นผู้ช่วยของ Rice AI ตอบได้เฉพาะเรื่องการใช้งานระบบ งานวิจัย และโรคข้าว มีเรื่องไหนในนี้ให้ช่วยไหมครับ',
  greet: ['สวัสดีครับ ผมน้องข้าวหอม ผู้ช่วยของ Rice AI ถามเรื่องการใช้งานแอป ความแม่นยำของ AI หรือโรคข้าวได้เลยครับ', 'สวัสดีครับ ยินดีต้อนรับสู่ Rice AI วันนี้ให้ผมช่วยเรื่องอะไรดีครับ'],
  greetEn: "Hi, I'm Khao Hom, Rice AI's assistant. I answer mainly in Thai, but ask me anything about the app, the AI model or rice diseases.",
  thanks: ['ยินดีครับ ถ้ามีคำถามอื่นเกี่ยวกับ Rice AI หรือโรคข้าว ถามได้ตลอดครับ', 'ด้วยความยินดีครับ ขอให้ข้าวในแปลงแข็งแรงนะครับ'],
  bye: 'ขอบคุณที่แวะมาคุยกันครับ ถ้ามีคำถามเพิ่มเติม กดที่ผมมุมขวาล่างได้ทุกเมื่อครับ',
  who: 'ผมคือ **น้องข้าวหอม** ผู้ช่วยอัตโนมัติของ Rice AI ครับ ไม่ใช่เจ้าหน้าที่ตัวจริง ตอบคำถามเรื่องการใช้งานระบบ งานวิจัยของโมเดล และข้อมูลโรคข้าวจากกรมการข้าว ถ้าต้องการคุยกับทีมงาน ส่งข้อเสนอแนะหรืออีเมลมาได้ครับ',
  howareyou: 'สบายดีครับ ขอบคุณที่ถาม วันนี้มีเรื่องข้าวหรือการใช้งาน Rice AI ให้ผมช่วยไหมครับ',
  flirt: 'ขอบคุณครับ ผมดีใจที่ชอบน้องข้าวหอม 😊 แต่ผมเป็นผู้ช่วยเรื่องข้าวนะครับ มีอะไรเกี่ยวกับ Rice AI หรือโรคข้าวให้ช่วยไหมครับ',
  laugh: 'ดีใจที่อารมณ์ดีครับ 😄 มีอะไรเกี่ยวกับ Rice AI หรือโรคข้าวให้ผมช่วยไหมครับ',
  offtopic: 'ขออภัยครับ เรื่องนี้อยู่นอกขอบเขตที่ผมช่วยได้ ผมตอบได้เฉพาะเรื่อง **Rice AI** (การใช้งาน แอป งานวิจัย ความเป็นส่วนตัว) และ **โรคข้าว** ครับ ลองถามเรื่องเหล่านี้ได้เลย',
  market: 'ขออภัยครับ ผมไม่มีข้อมูลราคาข้าวหรือราคาตลาด เพราะ Rice AI เน้นการวินิจฉัยโรคข้าว แนะนำดูราคาจากกรมการค้าภายในหรือสมาคมโรงสีข้าวไทยครับ ถ้ามีคำถามเรื่องโรคข้าวหรือการใช้งานแอป ผมช่วยได้เลยครับ',
  gibberish: 'ขออภัยครับ ผมยังไม่เข้าใจข้อความนี้ ลองพิมพ์คำถามใหม่อีกครั้ง หรือเลือกจากคำถามแนะนำด้านล่างได้ครับ',
  fallback: 'ขออภัยครับ ผมยังไม่มีข้อมูลเรื่องนี้ ลองถามใหม่ให้เจาะจงขึ้น เช่น เรื่องการใช้งานแอป ความแม่นยำ หรือชื่อโรคข้าว ถ้าเป็นเรื่องเฉพาะ ส่งคำถามถึงทีมผ่านหน้า **ส่งข้อเสนอแนะ** ได้ครับ',
};

function listDiseases() {
  const groups = {};
  for (const d of diseases) (groups[d.category] = groups[d.category] || []).push(d.name);
  const lines = Object.entries(groups).map(([cat, names]) => `- **${cat}**: ${names.join(', ')}`);
  return { text: `คลังความรู้ของ Rice AI มีโรคข้าว **${diseases.length} โรค** จากกรมการข้าวครับ\n${lines.join('\n')}\n\nAI ตรวจจากรูปได้ 3 โรค (ไหม้ ขอบใบแห้ง ใบสีส้ม) และใบปกติครับ`, links: [{ label: 'คลังความรู้โรคข้าว', to: '/rice-diseases' }], suggestions: ['อาการโรคไหม้เป็นยังไง'] };
}

// Symptom words a farmer may describe; matched against every disease's symptom list.
const SYMPTOM_WORDS = ['เหลือง', 'ส้ม', 'แสด', 'น้ำตาล', 'จุด', 'แผล', 'แห้ง', 'เตี้ย', 'แคระ', 'ลีบ', 'เน่า', 'ขีด', 'หงิก', 'ขาว', 'ด่าง', 'ม้วน', 'ซีด', 'ดำ', 'เทา', 'รากปม', 'ยืด', 'รวง', 'กาบ', 'ต้นกล้า', 'ปม'];
function bySymptoms(t) {
  const words = SYMPTOM_WORDS.filter((w) => t.includes(w));
  if (!words.length || !has(t, ['ใบ', 'ต้น', 'ราก', 'รวง', 'เมล็ด', 'กาบ', 'ข้าว'])) return null;
  const ranked = diseases
    .map((d) => ({ d, n: words.filter((w) => d.symptoms.join(' ').includes(w)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  if (!ranked.length) return null;
  const lines = ranked.map(({ d }) => `- **${d.name}**: ${d.symptoms[0]}`).join('\n');
  return {
    text: `อาการที่เล่ามาใกล้เคียงกับโรคเหล่านี้ในคลังความรู้ครับ (เป็นการเทียบจากคำบรรยาย ยังไม่ใช่การวินิจฉัย)\n${lines}\n\nแนะนำ **ถ่ายรูปใบให้ AI ช่วยวิเคราะห์** เทียบอาการกับรูปในคลังความรู้ และถ้าอาการลุกลามเร็ว ปรึกษาเจ้าหน้าที่เกษตรในพื้นที่ครับ อาการใบเหลืองบางครั้งเกิดจากขาดธาตุอาหารหรือน้ำ ไม่ใช่โรคเสมอไป`,
    links: [{ label: 'คลังความรู้โรคข้าว', to: '/rice-diseases' }],
    suggestions: ranked.map(({ d }) => `อาการ${d.name}`),
  };
}

/** Best-matching topic by total length of matched keywords (longer = more specific). */
function bestTopic(t) {
  let best = null;
  let score = 0;
  for (const topic of TOPICS) {
    const s = topic.keywords.reduce((acc, k) => (t.includes(norm(k)) ? acc + norm(k).length : acc), 0);
    if (s > score) { score = s; best = topic; }
  }
  return score >= 3 ? best : null;
}

export function answer(input) {
  const raw = (input || '').trim();
  const t = norm(raw);
  const seed = hash(t);
  const out = (text, extra = {}) => ({ text, links: [], suggestions: [], ...extra });

  if (!t) return out(replies.empty, { suggestions: SUGGESTIONS });
  if (has(t, PROFANE)) return out(pick(replies.profane, seed), { links: [{ label: 'ส่งข้อเสนอแนะ', to: '/feedback' }], suggestions: SUGGESTIONS.slice(0, 3) });
  if (has(t, INJECTION)) return out(replies.injection, { suggestions: SUGGESTIONS.slice(0, 3) });
  // Long runs of one character or no letters at all: ask to rephrase.
  if (/(.)\1{5,}/.test(t) && !has(t, LAUGH)) return out(replies.gibberish, { suggestions: SUGGESTIONS });
  if (/^[a-z]{6,}$/.test(t) && !/[aeiou]{1}[^aeiou]{0,3}[aeiou]/.test(t)) return out(replies.gibberish, { suggestions: SUGGESTIONS });
  if (!/[฀-๿a-z]/.test(t)) return has(t, LAUGH) ? out(replies.laugh) : out(replies.gibberish, { suggestions: SUGGESTIONS });

  const disease = findDisease(t);
  const topic = bestTopic(t);
  const short = t.length <= 14;

  if (short && !disease && !topic) {
    if (has(t, GREET)) return out(/^[a-z]+$/.test(t) ? replies.greetEn : pick(replies.greet, seed), { suggestions: SUGGESTIONS });
    if (has(t, THANKS)) return out(pick(replies.thanks, seed));
    if (has(t, BYE)) return out(replies.bye);
    if (has(t, LAUGH)) return out(replies.laugh, { suggestions: SUGGESTIONS.slice(0, 3) });
  }
  if (has(t, WHO) && !disease) return out(replies.who, { suggestions: ['Rice AI คืออะไร', 'ตรวจโรคอะไรได้บ้าง'] });
  if (has(t, HOWAREYOU)) return out(replies.howareyou, { suggestions: SUGGESTIONS.slice(0, 3) });
  if (has(t, FLIRT) && !disease) return out(replies.flirt, { suggestions: SUGGESTIONS.slice(0, 3) });
  if (has(t, ['ราคาข้าว', 'ราคาตลาด', 'ขายข้าว', 'โรงสี', 'riceprice'])) return out(replies.market, { suggestions: SUGGESTIONS.slice(0, 3) });
  if (has(t, CRITICAL) && !disease) return out(replies.critical, { links: [{ label: 'ส่งข้อเสนอแนะ', to: '/feedback' }] });

  if (has(t, ['โรคข้าวมีอะไร', 'มีโรคอะไรบ้าง', 'โรคทั้งหมด', 'รายชื่อโรค', 'โรคมีกี่', 'listdiseases']) && !disease) return listDiseases();
  if (disease && !(topic && ['detectable', 'accuracy', 'versions', 'comparison', 'dataset'].includes(topic.id) && !has(t, ['อาการ', 'ป้องกัน', 'สาเหตุ', 'รักษา']))) {
    return diseaseAnswer(disease, t);
  }
  if (topic) return out(topic.answer, { links: topic.links, suggestions: topic.follow });
  const symptomHit = bySymptoms(t);
  if (symptomHit) return symptomHit;
  if (has(t, OFFTOPIC)) return out(replies.offtopic, { suggestions: SUGGESTIONS.slice(0, 4) });
  if (has(t, GREET)) return out(pick(replies.greet, seed), { suggestions: SUGGESTIONS });
  if (has(t, THANKS)) return out(pick(replies.thanks, seed));
  if (has(t, ['ข้าว', 'โรค', 'ใบ', 'แปลง', 'rice'])) return out(replies.fallback, { links: [{ label: 'คลังความรู้โรคข้าว', to: '/rice-diseases' }, { label: 'ส่งข้อเสนอแนะ', to: '/feedback' }], suggestions: SUGGESTIONS.slice(1, 5) });
  return out(replies.offtopic, { suggestions: SUGGESTIONS.slice(0, 4) });
}
