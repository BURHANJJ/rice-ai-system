// Handoff section 27 — Data Anonymization before Research Export.
// Rule: never export full_name / email / username / raw user_id / exact
// personal identifiers. Research rows should carry only what a study needs:
// disease, confidence, province/region, and a coarsened time bucket.
//
// We deliberately do NOT round GPS to fewer decimals and still expose it
// exactly, because exact coordinates + timestamp can re-identify a specific
// farmer's field. Instead we expose only province (already resolved server
// side) — see handoff: "อาจใช้ province/district ... แทน exact location".

function anonymizeDiagnosisRow(row) {
  return {
    diagnosis_ref: hashId(row.diag_id), // opaque, non-reversible-looking ref instead of raw diag_id
    disease_name: row.disease_name,
    disease_code: row.disease_code,
    confidence: row.confidence,
    province: row.province || 'unknown',
    region: row.region || 'unknown',
    period: row.diag_date ? row.diag_date.slice(0, 7) : null, // YYYY-MM only, not exact timestamp
  };
}

// Simple non-cryptographic obfuscation sufficient for a reference/demo ref id.
// NOT intended as a security control — the point is *omission* of PII, not
// this hash's strength.
function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return 'REF-' + h.toString(16).toUpperCase();
}

module.exports = { anonymizeDiagnosisRow };
