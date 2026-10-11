// Seeds reference data required for the system to be usable end-to-end:
// - D9 boundaries: all 77 provinces (handoff 38 "ห้ามลืม 77 จังหวัด")
// - D6/D7 encyclopedia + advice: exactly the 4 canonical classes (handoff section 3)
// - Demo accounts for each of the 3 roles (farmer/researcher/admin)
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { newId } = require('../services/id');

function seedProvinces() {
  const already = db.prepare('SELECT COUNT(*) c FROM boundaries').get().c;
  if (already > 0) { console.log(`boundaries already seeded (${already})`); return; }
  const provinces = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'provinces.json'), 'utf-8'));
  const insert = db.prepare('INSERT INTO boundaries (map_id, province, region, district, geo_data, centroid_lat, centroid_lng) VALUES (?, ?, ?, NULL, NULL, ?, ?)');
  const tx = db.transaction((rows) => { for (const r of rows) insert.run(newId(), r.province, r.region, r.lat, r.lng); });
  tx(provinces);
  console.log(`seeded ${provinces.length} provinces`);
}

function seedDiseases() {
  const already = db.prepare('SELECT COUNT(*) c FROM encyclopedia').get().c;
  if (already > 0) { console.log('encyclopedia already seeded'); return; }

  const diseases = [
    {
      code: 'BLAST',
      name: 'โรคไหม้ (Rice Blast)',
      symptoms: 'แผลรูปตาเข้ม ขอบสีน้ำตาลเข้ม กลางแผลสีเทา พบบนใบ กาบใบ คอรวง และเมล็ด ในสภาพอากาศชื้นแผลจะขยายและลุกลามอย่างรวดเร็ว',
      cause: 'เกิดจากเชื้อรา Magnaporthe oryzae ระบาดง่ายในสภาพอากาศชื้น ใส่ปุ๋ยไนโตรเจนมากเกินไป และปลูกแน่นเกินไป',
    },
    {
      code: 'BLB',
      name: 'โรคขอบใบแห้ง (Bacterial Leaf Blight)',
      symptoms: 'ใบมีรอยช้ำที่ขอบใบ ต่อมาเปลี่ยนเป็นสีเหลืองและแห้งลามจากปลายใบเข้าสู่โคนใบ ในสภาพชื้นจะพบหยดของเหลวสีเหลืองบนแผล',
      cause: 'เกิดจากเชื้อแบคทีเรีย Xanthomonas oryzae pv. oryzae แพร่กระจายผ่านน้ำ ลม และบาดแผลของพืช',
    },
    {
      code: 'TUNGRO',
      name: 'โรคใบสีส้ม (Rice Tungro Virus)',
      symptoms: 'ใบเปลี่ยนเป็นสีเหลืองถึงส้ม ต้นแคระแกร็น แตกกอน้อย ผลผลิตลดลงอย่างมาก',
      cause: 'เกิดจากเชื้อไวรัส Rice Tungro Virus นำพาโดยเพลี้ยจักจั่นสีเขียว (Green Leafhopper)',
    },
    {
      code: 'HEALTHY',
      name: 'ใบข้าวปกติ (Healthy Rice Leaf)',
      symptoms: 'ใบมีสีเขียวสม่ำเสมอ ไม่มีรอยแผล จุด หรือลักษณะผิดปกติ',
      cause: 'ไม่มี (ใบข้าวสุขภาพดี)',
    },
  ];

  const insertDisease = db.prepare('INSERT INTO encyclopedia (disease_id, disease_name, disease_code, symptoms, cause) VALUES (?, ?, ?, ?, ?)');
  const insertAdvice = db.prepare('INSERT INTO advice (advice_id, disease_id, treatment, chemical_name, dosage) VALUES (?, ?, ?, ?, ?)');

  const adviceMap = {
    BLAST: { treatment: 'ลดปุ๋ยไนโตรเจน ปรับระยะปลูกให้โปร่ง ระบายน้ำในแปลงไม่ให้ชื้นแฉะเกินไป และพ่นสารป้องกันกำจัดเชื้อราตามคำแนะนำของนักวิชาการเกษตรในพื้นที่', chem: 'ปรึกษาสารป้องกันกำจัดเชื้อรากลุ่ม triazole ตามฉลากและคำแนะนำในพื้นที่', dosage: 'ตามอัตราแนะนำบนฉลากผลิตภัณฑ์และคำแนะนำของเจ้าหน้าที่เกษตรในพื้นที่' },
    BLB: { treatment: 'หลีกเลี่ยงการให้น้ำท่วมขังนาน ใช้เมล็ดพันธุ์สะอาดปลอดโรค และกำจัดวัชพืชที่เป็นแหล่งสะสมเชื้อ', chem: 'ปรึกษาสารป้องกันกำจัดแบคทีเรียที่ขึ้นทะเบียนถูกต้องตามคำแนะนำในพื้นที่', dosage: 'ตามอัตราแนะนำบนฉลากผลิตภัณฑ์และคำแนะนำของเจ้าหน้าที่เกษตรในพื้นที่' },
    TUNGRO: { treatment: 'กำจัดเพลี้ยจักจั่นสีเขียวซึ่งเป็นพาหะ ปลูกพันธุ์ต้านทาน และทำลายต้นที่เป็นโรคเพื่อลดแหล่งแพร่เชื้อ', chem: 'ปรึกษาสารกำจัดแมลงพาหะ (เพลี้ยจักจั่น) ที่ขึ้นทะเบียนถูกต้องตามคำแนะนำในพื้นที่', dosage: 'ตามอัตราแนะนำบนฉลากผลิตภัณฑ์และคำแนะนำของเจ้าหน้าที่เกษตรในพื้นที่' },
    HEALTHY: { treatment: 'ดูแลตามหลักเกษตรกรรมทั่วไป ไม่จำเป็นต้องใช้สารเคมี', chem: null, dosage: null },
  };

  const tx = db.transaction(() => {
    for (const d of diseases) {
      const disease_id = newId();
      insertDisease.run(disease_id, d.name, d.code, d.symptoms, d.cause);
      const a = adviceMap[d.code];
      insertAdvice.run(newId(), disease_id, a.treatment, a.chem, a.dosage);
    }
  });
  tx();
  console.log(`seeded ${diseases.length} diseases + advice`);
}

// Demo passwords come from the environment; when unset a random one is generated and printed once.
function demoPassword(envName) {
  return process.env[envName] || require('crypto').randomBytes(9).toString('base64url');
}

function seedDemoAccounts() {
  const already = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (already > 0) { console.log('users already seeded'); return; }

  const accounts = [
    { username: 'admin', email: 'admin@riceai.local', password: demoPassword('SEED_ADMIN_PASSWORD'), full_name: 'ผู้ดูแลระบบ', role: 'admin', status: 'active' },
    { username: 'researcher1', email: 'researcher1@riceai.local', password: demoPassword('SEED_RESEARCHER_PASSWORD'), full_name: 'นักวิชาการเกษตร ทดสอบ', role: 'researcher', status: 'active', institution: 'มหาวิทยาลัยตัวอย่าง', access_purpose: 'ศึกษาการระบาดของโรคใบข้าวเพื่องานวิจัย' },
    { username: 'farmer1', email: 'farmer1@riceai.local', password: demoPassword('SEED_FARMER_PASSWORD'), full_name: 'เกษตรกร ทดสอบ', role: 'farmer', status: 'active' },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (user_id, username, password_hash, full_name, email, role, status, institution, access_purpose)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSettings = db.prepare('INSERT INTO settings (setting_id, user_id) VALUES (?, ?)');

  const tx = db.transaction(() => {
    for (const a of accounts) {
      const user_id = newId();
      insertUser.run(user_id, a.username, bcrypt.hashSync(a.password, 10), a.full_name, a.email, a.role, a.status, a.institution || null, a.access_purpose || null);
      insertSettings.run(newId(), user_id);
      console.log(`  ${a.email} / ${a.password}`);
    }
  });
  tx();
  console.log('seeded demo accounts (passwords printed above)');
}

seedProvinces();
seedDiseases();
seedDemoAccounts();
console.log('Seed complete.');
