-- Rice AI — Database Schema (SQLite reference implementation)
-- Mirrors Data Dictionary D1–D11 from RICE_AI_CLAUDE_HANDOFF.md (section 15).
-- NOTE: In a Firebase deployment these map 1:1 to Firestore collections
-- (users, settings, images, diagnosis, locations, encyclopedia, advice,
-- statistics, boundaries, exports, logs). SQL is used here only so the
-- whole system is runnable/testable without external cloud accounts.
--
-- Deviations from the literal Data Dictionary are called out with
-- "-- ADDITION:" comments and are documented in docs/ASSUMPTIONS_AND_TODOS.md
-- (handoff section 37).

PRAGMA foreign_keys = ON;

-- D1: users -----------------------------------------------------------
-- ADDITION: password is NEVER stored raw. We store password_hash (bcrypt)
-- to honor handoff 37.2 ("Firebase Auth should own credentials"); this
-- SQL backend is a stand-in for Firebase Auth + Firestore combined.
CREATE TABLE IF NOT EXISTS users (
  user_id         TEXT PRIMARY KEY,           -- uid
  username        TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('farmer','researcher','admin')),
  -- ADDITION: account/researcher lifecycle state (handoff 24, 37 not numbered but required by RBAC)
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','suspended','rejected')),
  -- ADDITION: researcher-only application metadata (handoff section 18)
  institution     TEXT,
  access_purpose  TEXT,
  -- ADDITION: 2FA secret for researcher accounts (TOTP), never exposed to clients
  totp_secret     TEXT,
  totp_enabled    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- D2: settings ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  setting_id    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  theme         TEXT NOT NULL DEFAULT 'light',
  language      TEXT NOT NULL DEFAULT 'th',
  notification  TEXT NOT NULL DEFAULT 'on'
);

-- D3: images -------------------------------------------------------------
-- ADDITION: user_id owner reference. The literal Data Dictionary omits it
-- (handoff 37.5), but ownership is required to enforce RBAC on Storage.
CREATE TABLE IF NOT EXISTS images (
  image_id      TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  file_size     INTEGER NOT NULL,
  mime_type     TEXT NOT NULL,
  upload_date   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- D5: locations -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  location_id   TEXT PRIMARY KEY,
  latitude      REAL,
  longitude     REAL,
  place_name    TEXT,
  -- ADDITION: resolved province, required for outbreak/risk-map aggregation
  -- (handoff 37.4). Populated via reverse lookup against the 77-province table.
  province      TEXT
);

-- D6: encyclopedia (disease wiki) -----------------------------------------
CREATE TABLE IF NOT EXISTS encyclopedia (
  disease_id    TEXT PRIMARY KEY,
  disease_name  TEXT NOT NULL,
  disease_code  TEXT NOT NULL UNIQUE, -- BLAST | BLB | TUNGRO | HEALTHY
  symptoms      TEXT,
  cause         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- D7: advice ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS advice (
  advice_id      TEXT PRIMARY KEY,
  disease_id     TEXT NOT NULL REFERENCES encyclopedia(disease_id) ON DELETE CASCADE,
  treatment      TEXT,
  chemical_name  TEXT,
  dosage         TEXT
);

-- D4: diagnosis --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnosis (
  diag_id       TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  disease_id    TEXT NOT NULL REFERENCES encyclopedia(disease_id),
  image_id      TEXT NOT NULL REFERENCES images(image_id),
  location_id   TEXT REFERENCES locations(location_id),
  confidence    REAL NOT NULL,     -- percentage 0-100
  diag_date     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- D8: statistics (+ ADDITION aggregation keys per handoff 37.4) --------------
-- Kept the original stat_id/total_cases/risk_level/last_update concept, but
-- added province/disease/period so it can actually back a 77-province map.
CREATE TABLE IF NOT EXISTS statistics (
  stat_id       TEXT PRIMARY KEY,
  province      TEXT NOT NULL,      -- ADDITION
  disease_id    TEXT REFERENCES encyclopedia(disease_id), -- ADDITION (nullable = all diseases)
  period        TEXT NOT NULL,      -- ADDITION, e.g. '2026-08' (monthly bucket)
  total_cases   INTEGER NOT NULL DEFAULT 0,
  risk_level    TEXT,               -- computed by riskService (config-driven, see 37.6)
  last_update   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(province, disease_id, period)
);

-- D9: boundaries (77 provinces + GeoJSON reference) --------------------------
CREATE TABLE IF NOT EXISTS boundaries (
  map_id        TEXT PRIMARY KEY,
  province      TEXT NOT NULL UNIQUE,
  region        TEXT NOT NULL,
  district      TEXT,
  geo_data      TEXT, -- GeoJSON geometry (as text) or null if using shared basemap
  -- ADDITION: approximate centroid for demo map markers (not survey-grade GIS;
  -- swap for official polygon GeoJSON in production — see docs/ASSUMPTIONS_AND_TODOS.md)
  centroid_lat  REAL,
  centroid_lng  REAL
);

-- D10: exports (CSV/JSON per handoff 37.1 decision) --------------------------
CREATE TABLE IF NOT EXISTS exports (
  export_id     TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  file_type     TEXT NOT NULL CHECK (file_type IN ('csv','json')),
  row_count     INTEGER NOT NULL DEFAULT 0,
  filters       TEXT, -- JSON-encoded query params used, for reproducibility/audit
  export_date   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- D11: logs (audit/security) --------------------------------------------------
CREATE TABLE IF NOT EXISTS logs (
  log_id        TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  activity      TEXT NOT NULL,
  -- ADDITION: severity + metadata, useful for a real security log screen but
  -- not required by the Data Dictionary (which only has user_id/activity/log_time)
  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  metadata      TEXT,
  log_time      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_user ON diagnosis(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_date ON diagnosis(diag_date);
CREATE INDEX IF NOT EXISTS idx_statistics_province ON statistics(province);
CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(log_time);
