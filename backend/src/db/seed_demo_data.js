// OPTIONAL demo-data seeder. Populates a handful of realistic-looking
// diagnosis/statistics rows so the dashboard, risk map, and export screens
// have something to show in a fresh demo environment. This is clearly
// separated from seed.js (reference data) because it is FAKE sample
// activity, not reference/master data — do not run this against a real
// production database.
const db = require('./db');
const { newId } = require('../services/id');
const { computeRiskLevel } = require('../services/riskConfig');

const farmer = db.prepare("SELECT user_id FROM users WHERE role = 'farmer' LIMIT 1").get();
if (!farmer) {
  console.error('No farmer account found — run `npm run seed` first.');
  process.exit(1);
}

const diseases = db.prepare('SELECT * FROM encyclopedia').all();
const provinces = db.prepare('SELECT province FROM boundaries').all().map(r => r.province);

const period = new Date().toISOString().slice(0, 7);
const insertImage = db.prepare('INSERT INTO images (image_id, user_id, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?)');
const insertLocation = db.prepare('INSERT INTO locations (location_id, latitude, longitude, place_name, province) VALUES (?, ?, ?, ?, ?)');
const insertDiagnosis = db.prepare('INSERT INTO diagnosis (diag_id, user_id, disease_id, image_id, location_id, confidence, diag_date) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\', ?))');
const upsertStat = db.prepare('SELECT * FROM statistics WHERE province = ? AND disease_id = ? AND period = ?');
const insertStat = db.prepare('INSERT INTO statistics (stat_id, province, disease_id, period, total_cases, risk_level, last_update) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))');
const updateStat = db.prepare('UPDATE statistics SET total_cases = ?, risk_level = ?, last_update = datetime(\'now\') WHERE stat_id = ?');

function bump(province, disease_id) {
  const existing = upsertStat.get(province, disease_id, period);
  if (existing) {
    const total = existing.total_cases + 1;
    updateStat.run(total, computeRiskLevel(total), existing.stat_id);
  } else {
    insertStat.run(newId(), province, disease_id, period, 1, computeRiskLevel(1));
  }
}

const tx = db.transaction(() => {
  const sampleSize = 180;
  for (let i = 0; i < sampleSize; i++) {
    const disease = diseases[Math.floor(Math.random() * diseases.length)];
    const province = provinces[Math.floor(Math.random() * provinces.length)];
    const daysAgo = Math.floor(Math.random() * 25);

    const image_id = newId();
    insertImage.run(image_id, farmer.user_id, `local-mock-storage/demo-${image_id}.jpg`, 245000, 'image/jpeg');

    const location_id = newId();
    insertLocation.run(location_id, null, null, null, province);

    const diag_id = newId();
    const confidence = Math.round((70 + Math.random() * 29) * 100) / 100;
    insertDiagnosis.run(diag_id, farmer.user_id, disease.disease_id, image_id, location_id, confidence, `-${daysAgo} days`);

    bump(province, disease.disease_id);
  }
});

tx();
console.log('Seeded demo activity data (diagnoses + statistics) for dashboard/risk-map demos.');
