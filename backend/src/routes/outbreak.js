// Handoff 4.7 (mobile outbreak list) + 4.8 (Researcher/Admin risk map, 77 provinces).
const express = require('express');
const db = require('../db/db');
const { authRequired } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { IS_PLACEHOLDER_FORMULA } = require('../services/riskConfig');

const router = express.Router();

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function provinceSummary() {
  // Aggregate current-period statistics per province across all diseases.
  // Left join so every one of the 77 provinces is represented even with 0 cases
  // (handoff 38: "ห้ามลืม 77 จังหวัด").
  const rows = db.prepare(`
    SELECT b.province, b.region, b.centroid_lat, b.centroid_lng,
           COALESCE(SUM(s.total_cases), 0) AS total_cases,
           MAX(s.last_update) AS last_update
    FROM boundaries b
    LEFT JOIN statistics s ON s.province = b.province AND s.period = ?
    GROUP BY b.province, b.region
    ORDER BY b.province
  `).all(currentPeriod());

  const { computeRiskLevel } = require('../services/riskConfig');
  return rows.map(r => ({
    province: r.province,
    region: r.region,
    latitude: r.centroid_lat,
    longitude: r.centroid_lng,
    total_cases: r.total_cases,
    risk_level: computeRiskLevel(r.total_cases),
    last_update: r.last_update,
  }));
}

// GET /outbreak/provinces — Mobile list view (handoff 4.7), open to all authenticated roles
router.get('/outbreak/provinces', authRequired, (req, res) => {
  const { region, q } = req.query;
  let rows = provinceSummary();
  if (region) rows = rows.filter(r => r.region === region);
  if (q) rows = rows.filter(r => r.province.includes(q));
  res.json({
    provinces: rows,
    coverage: rows.length, // should always be 77
    risk_formula_is_placeholder: IS_PLACEHOLDER_FORMULA,
  });
});

// GET /outbreak/provinces/:province — detail incl. disease breakdown
router.get('/outbreak/provinces/:province', authRequired, (req, res) => {
  const boundary = db.prepare('SELECT * FROM boundaries WHERE province = ?').get(req.params.province);
  if (!boundary) return res.status(404).json({ error: 'not_found' });
  const breakdown = db.prepare(`
    SELECT e.disease_name, e.disease_code, SUM(s.total_cases) AS total_cases
    FROM statistics s
    JOIN encyclopedia e ON e.disease_id = s.disease_id
    WHERE s.province = ? AND s.period = ?
    GROUP BY e.disease_name, e.disease_code
  `).all(req.params.province, currentPeriod());
  const summary = provinceSummary().find(p => p.province === req.params.province);
  res.json({ province: boundary.province, region: boundary.region, ...summary, disease_breakdown: breakdown });
});

// GET /risk-map — GeoJSON-ready choropleth data (Researcher/Admin, handoff 4.8)
router.get('/risk-map', authRequired, requireRole('researcher', 'admin'), (req, res) => {
  const rows = provinceSummary();
  res.json({
    type: 'choropleth',
    technology_note: 'Consume with Leaflet (web) or flutter_map (mobile) using GeoJSON; geo_data per province is in boundaries table (simplified placeholder polygons in this reference implementation — swap in official Thailand province GeoJSON for production).',
    features: rows,
    risk_formula_is_placeholder: IS_PLACEHOLDER_FORMULA,
  });
});

// GET /risk-map/list — same data, list view (Map/List toggle, handoff 4.8)
router.get('/risk-map/list', authRequired, requireRole('researcher', 'admin'), (req, res) => {
  res.json({ provinces: provinceSummary(), risk_formula_is_placeholder: IS_PLACEHOLDER_FORMULA });
});

module.exports = router;
