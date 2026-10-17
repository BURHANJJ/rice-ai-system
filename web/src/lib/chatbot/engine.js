// In-browser answer engine for Khao Hom's chat: no network, no cost, always available.
// Order: guard rails (abuse, prompt tricks, gibberish) → small talk → a named rice disease
// (from the Rice Department library) → system topics (knowledge.js) → polite fallback.
// The cloud AI (functions/index.js `chat`) is used instead when it is configured and reachable.
import { diseases } from '../riceDiseases';
import { GLOSSARY, SUGGESTIONS, TITLES, TOPICS } from './knowledge';

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
  Tungro: ['ใบสีส้ม', 'ใบส้ม', 'tungro', 'ทังโร', 'เป็นสีส้ม', 'ใบเหลืองส้ม'],
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
  eat: 'ผมเป็นผู้ช่วยอัตโนมัติ ไม่ได้กินข้าวครับ 😄 แต่ช่วยดูแลข้าวในแปลงได้ อยากรู้เรื่องโรคข้าวหรือการใช้งาน Rice AI ถามได้เลยครับ',
  ack: 'ยินดีครับ มีอะไรเพิ่มเติมเกี่ยวกับ Rice AI หรือโรคข้าว ถามต่อได้เลยนะครับ',
  unsure: 'ขออภัยครับ ผมไม่แน่ใจว่าหมายถึงเรื่องไหน ลองเลือกหัวข้อที่ใกล้เคียงด้านล่าง หรือพิมพ์เพิ่มอีกนิดได้เลยครับ',
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

// People type the same thing many ways ("โหลด", "ดาวโหลด", "แอพ", "ยังงัย", "ได้มั้ย"). Both the
// message and every keyword go through the same rewrite, so one keyword covers all its spellings.
const CANON = [
  [/แอพพลิเคชั่น|แอพพลิเคชัน|แอปพลิเคชั่น|แอปพลิเคชัน|application|แอพ|app(?!le|store)/g, 'แอป'],
  [/ดาวน์โหลท|ดาวโหลท|ดาวโหลด|ดาวน์โหลด/g, 'ดาวน์โหลด'],
  [/(?<!ดาวน์)โหลด/g, 'ดาวน์โหลด'],
  [/เว็บไซต์|เว็บไซท์|เว็ปไซต์|เวปไซต์|เว็ปไซท์|เว็ป|เวป|เวบ|website/g, 'เว็บ'],
  [/ทำยังไง|ทำยังงัย|ยังงัย|ยังงาย|ยังไร|อย่างไร|อย่างไง|ทำไง|ยังไง|ไง/g, 'ยังไง'],
  [/ได้ป่าว|ได้เปล่า|ได้ป่ะ|ได้ปะ|ได้ไม(?![่้])/g, 'ได้ไหม'],
  [/มั้ย|มั๊ย/g, 'ไหม'],
  [/แสกน|scan/g, 'สแกน'],
  [/ล็อคอิน|ล็อกอิน|ล๊อกอิน|ลอคอิน|ล็อกอิน|login|signin/g, 'เข้าสู่ระบบ'],
  [/signup|register/g, 'สมัคร'],
  [/พาสเวิร์ด|password|รหัส(?!ผ่าน)/g, 'รหัสผ่าน'],
  [/เอไอ/g, 'ai'],
  [/โทรศัพท์|โทรสับ|สมาร์ทโฟน|smartphone/g, 'มือถือ'],
  [/ลง(?=แอป)/g, 'ติดตั้ง'],
  [/กี่ตังค์|กี่ตัง/g, 'กี่บาท'],
  [/แอนดรอย(?!ด์)|แอนดอย/g, 'แอนดรอยด์'],
  [/(ครับผม|ครับ|คับ|ค่ะ|คะ|จ้า|จ้ะ|หน่อย|อ่ะ|อะ|นะ|ป่ะ|ปะ|เหรอ|หรอ)+$/g, ''],
];
export const canon = (t) => CANON.reduce((s, [re, to]) => s.replace(re, to), t);

const TOPIC_KEYS = TOPICS.map((topic) => ({ topic, keys: [...new Set(topic.keywords.map((k) => canon(norm(k))).filter(Boolean))] }));
const GLOSS = GLOSSARY.flatMap((g) => g.keys.map((k) => ({ k: norm(k), g }))).sort((a, b) => b.k.length - a.k.length);

const bigrams = (s) => { const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; };
/** Share of the keyword's letter pairs found in the message: tolerates typos and missing letters. */
function near(key, tg) {
  const kg = bigrams(key);
  let n = 0;
  for (const g of kg) if (tg.has(g)) n += 1;
  return kg.size ? n / kg.size : 0;
}

/** Best-matching topic by total length of matched keywords (longer = more specific), then typo-tolerant. */
function bestTopic(t) {
  let best = null;
  let score = 0;
  for (const { topic, keys } of TOPIC_KEYS) {
    const s = keys.reduce((acc, k) => (t.includes(k) ? acc + k.length : acc), 0) * (topic.weight || 1);
    if (s > score) { score = s; best = topic; }
  }
  if (score >= 3) return best;
  const tg = bigrams(t);
  let fuzzy = 0;
  for (const { topic, keys } of TOPIC_KEYS) {
    for (const k of keys) {
      if (k.length < 6) continue;
      const s = near(k, tg);
      if (s >= 0.8 && s * k.length > fuzzy) { fuzzy = s * k.length; best = topic; }
    }
  }
  return fuzzy ? best : null;
}

/** Topics the message loosely resembles, for "did you mean" chips. */
function candidates(t) {
  const tg = bigrams(t);
  return TOPIC_KEYS
    .map(({ topic, keys }) => ({ topic, s: Math.max(0, ...keys.filter((k) => k.length >= 4).map((k) => near(k, tg))) }))
    .filter((x) => x.s >= 0.55)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.topic);
}

const ASK = '(คือ|หมายถึง|แปลว่า|ย่อมาจาก|เป็นยังไง|whatis|meaning)';
function glossary(t) {
  const tt = t.replace(/riceai/g, '');
  const hit = GLOSS.find(({ k }) => tt === k || new RegExp(`${k}${ASK}|^${ASK}${k}|^อะไรคือ${k}`).test(tt));
  return hit ? hit.g : null;
}

const FACET = ['อาการ', 'สาเหตุ', 'เชื้อ', 'ป้องกัน', 'กำจัด', 'รักษา', 'ยา', 'พันธุ์', 'ต้านทาน', 'ระบาด', 'เสี่ยง', 'ช่วงไหน'];
const MORE = ['ละเอียด', 'เพิ่มเติม', 'อธิบายเพิ่ม', 'ขยายความ', 'ยังไม่เข้าใจ', 'ไม่เข้าใจ', 'งง', 'ยกตัวอย่าง', 'อีกหน่อย', 'บอกอีก', 'ต่อเลย'];
const ACK = ['โอเค', 'ok', 'okay', 'เข้าใจแล้ว', 'ได้เลย', 'รับทราบ', 'ใช่', 'อืม', 'เยี่ยม', 'ดีมาก', 'เจ๋ง', 'เก่งมาก', 'สุดยอด'];

/** Most recent disease / topic the user asked about, so "แล้วป้องกันยังไง" or "ละเอียดกว่านี้" makes sense. */
function context(history) {
  const users = history.filter((m) => m.role === 'user').slice(-4).reverse().map((m) => canon(norm(m.content)));
  let disease = null;
  let topic = null;
  for (const u of users) {
    disease = disease || findDisease(u);
    topic = topic || bestTopic(u);
    if (disease || topic) break;
  }
  return { disease, topic, last: users[0] || '' };
}

// ---- suggestion chips: never send people in circles ------------------------------------------

const FACETS = [
  ['symptoms', ['อาการ', 'ลักษณะ', 'ดูยังไง', 'สังเกต', 'symptom']],
  ['cause', ['สาเหตุ', 'เชื้อ', 'เกิดจาก', 'cause']],
  ['control', ['ป้องกัน', 'กำจัด', 'รักษา', 'แก้', 'ยา', 'สาร', 'ฉีด', 'พ่น', 'control']],
  ['variety', ['พันธุ์', 'ต้านทาน', 'ทนโรค']],
  ['risk', ['เสี่ยง', 'ระบาด', 'ช่วงไหน', 'เมื่อไหร่']],
];
/** Where a question would lead: a topic id, a disease + facet, or the text itself. */
function route(q) {
  const t = canon(norm(q || ''));
  const d = findDisease(t);
  if (d) return `d:${d.tag}:${(FACETS.find(([, w]) => has(t, w)) || ['all'])[0]}`;
  const g = glossary(t);
  if (g) return `g:${g.keys[0]}`;
  const topic = bestTopic(t);
  return topic ? topic.id : t;
}
// A sensible path through the system for people who keep tapping chips.
const JOURNEY = ['about', 'detectable', 'how_to_scan', 'download', 'accuracy', 'photo_tips', 'offline', 'outbreak_map', 'wiki', 'after_result', 'how_ai', 'versions', 'privacy', 'price', 'team', 'research_page'];
const DISEASE_TRY = ['อาการโรคไหม้เป็นยังไง', 'ป้องกันโรคขอบใบแห้งยังไง', 'อาการโรคใบสีส้ม', 'โรคข้าวมีอะไรบ้าง'];

/** Drop chips that repeat something already asked or answered; top up with fresh, related ones. */
function freshSuggestions(res, input, history) {
  const seen = new Set([route(input), ...history.filter((m) => m.role === 'user').map((m) => route(m.content))]);
  const out = [];
  const routes = new Set();
  const add = (s) => {
    if (!s || out.length >= 3) return;
    const r = route(s);
    if (seen.has(r) || routes.has(r)) return;
    routes.add(r);
    out.push(s);
  };
  (res.suggestions || []).forEach(add);
  // after a disease answer, other diseases are the natural next step; otherwise walk the journey
  if (route(input).startsWith('d:')) DISEASE_TRY.forEach(add);
  JOURNEY.forEach((id) => add(TITLES[id]));
  return { ...res, suggestions: out };
}

export function answer(input, history = []) {
  return freshSuggestions(reply(input, history), input, history);
}

function reply(input, history) {
  const raw = (input || '').trim();
  const t0 = norm(raw);
  const t = canon(t0);
  const any = (words) => has(t0, words) || has(t, words);
  const seed = hash(t0);
  const out = (text, extra = {}) => ({ text, links: [], suggestions: [], ...extra });
  const topicReply = (topic) => out(topic.answer, { links: topic.links, suggestions: topic.follow });

  if (!t0) return out(replies.empty, { suggestions: SUGGESTIONS });
  if (any(PROFANE)) return out(pick(replies.profane, seed), { links: [{ label: 'ส่งข้อเสนอแนะ', to: '/feedback' }], suggestions: SUGGESTIONS.slice(0, 3) });
  if (any(INJECTION)) return out(replies.injection, { suggestions: SUGGESTIONS.slice(0, 3) });
  // Long runs of one character or no letters at all: ask to rephrase.
  if (/(.)\1{5,}/.test(t0) && !any(LAUGH)) return out(replies.gibberish, { suggestions: SUGGESTIONS });
  if (/^[a-z]{6,}$/.test(t0) && !/[aeiou]{1}[^aeiou]{0,3}[aeiou]/.test(t0)) return out(replies.gibberish, { suggestions: SUGGESTIONS });
  if (!/[฀-๿a-z]/.test(t0)) return any(LAUGH) ? out(replies.laugh) : out(replies.gibberish, { suggestions: SUGGESTIONS });

  const ctx = context(history);
  const disease = findDisease(t);
  const topic = bestTopic(t);
  const short = t0.length <= 14;

  if (short && !disease && !topic) {
    if (any(GREET)) return out(/^[a-z]+$/.test(t0) ? replies.greetEn : pick(replies.greet, seed), { suggestions: SUGGESTIONS });
    if (any(THANKS)) return out(pick(replies.thanks, seed));
    if (any(BYE)) return out(replies.bye);
    if (any(LAUGH)) return out(replies.laugh, { suggestions: SUGGESTIONS.slice(0, 3) });
    if (any(ACK)) return out(replies.ack, { suggestions: ctx.topic?.follow?.length ? ctx.topic.follow : SUGGESTIONS.slice(0, 3) });
  }
  if (any(CRITICAL) && !disease) return out(replies.critical, { links: [{ label: 'ส่งข้อเสนอแนะ', to: '/feedback' }] });
  if (any(WHO) && !disease && !topic) return out(replies.who, { suggestions: ['Rice AI คืออะไร', 'ตรวจโรคอะไรได้บ้าง'] });
  if (any(['กินข้าวยัง', 'กินข้าวหรือยัง', 'ทานข้าวยัง', 'กินอะไรดี'])) return out(replies.eat, { suggestions: SUGGESTIONS.slice(0, 3) });
  if (any(HOWAREYOU)) return out(replies.howareyou, { suggestions: SUGGESTIONS.slice(0, 3) });
  if (any(FLIRT) && !disease) return out(replies.flirt, { suggestions: SUGGESTIONS.slice(0, 3) });
  if (any(['ราคาข้าว', 'ราคาตลาด', 'ขายข้าว', 'โรงสี', 'riceprice'])) return out(replies.market, { suggestions: SUGGESTIONS.slice(0, 3) });

  // Follow-ups that lean on the previous question.
  if (!disease && ctx.disease && t.length <= 24 && has(t, FACET) && !(topic && !['after_result'].includes(topic.id))) return diseaseAnswer(ctx.disease, t);
  // "อาการโรคไหม้" → "แล้วโรคขอบใบแห้งล่ะ": same question, new disease
  if (disease && !has(t, FACET) && t.length <= 22 && has(ctx.last, FACET)) {
    const facet = FACET.filter((f) => ctx.last.includes(f)).join('');
    return diseaseAnswer(disease, t + facet);
  }
  if (!disease && !topic && t.length <= 24 && has(t, MORE)) {
    if (ctx.disease) return diseaseAnswer(ctx.disease, '');
    if (ctx.topic) return out(`เรื่อง **${TITLES[ctx.topic.id] || ctx.topic.id}** มีรายละเอียดเต็มในลิงก์ด้านล่างครับ หรือถามเจาะจงเพิ่มได้เลย เช่น ข้อที่ยังสงสัยตรงไหน`, { links: ctx.topic.links, suggestions: ctx.topic.follow });
  }

  const term = glossary(t);
  if (term && !disease) return out(term.text, { suggestions: ['AI ทำงานยังไง', 'แม่นยำแค่ไหน'] });
  if (any(['โรคข้าวมีอะไร', 'มีโรคอะไรบ้าง', 'โรคทั้งหมด', 'รายชื่อโรค', 'โรคมีกี่', 'listdiseases']) && !disease) return listDiseases();
  if (disease && !(topic && ['detectable', 'accuracy', 'versions', 'comparison', 'dataset'].includes(topic.id) && !has(t, ['อาการ', 'ป้องกัน', 'สาเหตุ', 'รักษา']))) {
    return diseaseAnswer(disease, t);
  }
  if (topic) return topicReply(topic);
  if (t === 'riceai' || t === 'rice') return topicReply(TOPICS.find((x) => x.id === 'about'));
  const symptomHit = bySymptoms(t);
  if (symptomHit) return symptomHit;
  if (any(OFFTOPIC)) return out(replies.offtopic, { suggestions: SUGGESTIONS.slice(0, 4) });
  if (any(GREET)) return out(pick(replies.greet, seed), { suggestions: SUGGESTIONS });
  if (any(THANKS)) return out(pick(replies.thanks, seed));
  // Nothing certain: offer the closest topics instead of a dead end.
  const near3 = candidates(t);
  if (near3.length) return out(replies.unsure, { suggestions: near3.map((x) => TITLES[x.id]).filter(Boolean) });
  if (any(['ข้าว', 'โรค', 'ใบ', 'แปลง', 'rice'])) return out(replies.fallback, { links: [{ label: 'คลังความรู้โรคข้าว', to: '/rice-diseases' }, { label: 'ส่งข้อเสนอแนะ', to: '/feedback' }], suggestions: SUGGESTIONS.slice(1, 5) });
  return out(replies.offtopic, { suggestions: SUGGESTIONS.slice(0, 4) });
}
