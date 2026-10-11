// Handoff 28 / 37.6 — Statistics / Risk Map Logic.
// -----------------------------------------------------------------------
// IMPORTANT: the source report does NOT define a High/Medium/Low threshold
// formula. Per the handoff's explicit instruction ("ห้ามเดาสูตร... ห้าม
// เขียน risk threshold แบบเดาโดยไม่บอก"), we do NOT hard-code an assumed
// scientific threshold. Instead this is an isolated, swappable config
// module with a clearly marked placeholder, so:
//   1) the rest of the system (map, dashboard, list) can function end-to-end
//   2) whoever owns the epidemiology methodology can replace just this file
//   3) nothing downstream silently treats a guess as a validated requirement
//
// TODO(product/epidemiology owner): replace PLACEHOLDER_THRESHOLDS with an
// approved formula (e.g. cases per rai, per 10,000 farmers, trend-based,
// etc.) before this is used for any real agricultural decision-making.
// -----------------------------------------------------------------------

const PLACEHOLDER_THRESHOLDS = {
  low: 0,      // total_cases >= 0   -> 'low'
  medium: 5,   // total_cases >= 5   -> 'medium'
  high: 15,    // total_cases >= 15  -> 'high'
};

const IS_PLACEHOLDER_FORMULA = true;

function computeRiskLevel(totalCases) {
  if (totalCases >= PLACEHOLDER_THRESHOLDS.high) return 'high';
  if (totalCases >= PLACEHOLDER_THRESHOLDS.medium) return 'medium';
  return 'low';
}

module.exports = { computeRiskLevel, IS_PLACEHOLDER_FORMULA, PLACEHOLDER_THRESHOLDS };
