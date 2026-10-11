# Assumptions, Decisions & TODOs

This document exists because `RICE_AI_CLAUDE_HANDOFF.md` explicitly warned
against silently guessing on ambiguous points (section 37: "ห้ามเดาแบบเงียบๆ").
Every decision below was made in code, with a comment pointing back here.
Nothing in this list should be treated as validated product/scientific
truth — it's the minimum needed to make the system runnable end-to-end.

## 1. Research export file format
**Decision:** CSV and JSON only.
**Why:** the handoff's Researcher/Data Explorer section describes tabular,
filterable research data — CSV/JSON are the standard formats for that and
require no extra dependencies (PDF/Excel export were not clearly
requested and would add scope without a stated need).
**Where:** `backend/src/routes/research.js`

## 2. Where credentials/passwords live
**Decision:** bcrypt-hashed passwords in the `users` table (this SQL
reference backend stands in for **Firebase Auth**, which the handoff's
architecture references but doesn't fully specify a self-hosted
equivalent for).
**Where:** `backend/src/routes/auth.js`, `backend/src/db/schema.sql`
**TODO for a Firebase deployment:** swap this for real Firebase
Authentication (email/password + custom claims for role), and keep
Firestore purely for profile/role/status data — never store password
hashes in Firestore yourself.

## 3. Inference architecture: server-side vs. on-device (TFLite)
**Decision:** server-side inference via a FastAPI service
(`/ai-service`), called by the Node backend, called by both mobile and web.
**Why:** the handoff's technical stack section names FastAPI + TensorFlow
as the intended serving stack; TFLite on-device is mentioned only as a
possible future/offline mode, not a committed requirement.
**Where:** `backend/src/services/aiClient.js`, `ai-service/main.py`
**TODO:** if offline/low-connectivity use is a hard requirement, add a
TFLite conversion step and an on-device inference path in the Flutter app
as an additional (not replacement) mode.

## 4. Risk-level formula (Low/Medium/High)
**Decision:** an explicit, isolated, clearly-labeled **placeholder**
(`total_cases >= 15 -> high`, `>= 5 -> medium`, else `low`), monthly
per-province.
**Why:** the source report does not define a validated epidemiological
threshold (cases per rai, per capita, trend-based, etc.), and inventing
one would misrepresent a guess as a scientific claim.
**Where:** `backend/src/services/riskConfig.js` — every API response that
uses this includes `risk_formula_is_placeholder: true` so consuming UIs
can (and do, in `/web`) show a visible caveat.
**TODO:** replace with a formula from an agronomist/epidemiologist before
this is used for any real decision-making.

## 5. Province resolution from GPS coordinates
**Decision:** a deterministic bucket function
(`provinceFromLatLng` in `backend/src/routes/diagnosis.js`), not a true
point-in-polygon lookup.
**Why:** the handoff didn't include real Thailand province boundary
GeoJSON, and a geocoding API key wasn't provided/in scope.
**TODO:** replace with reverse geocoding (e.g. a geocoding API) or a real
point-in-polygon lookup once official province GeoJSON is available. Load
it into `boundaries.geo_data`.

## 6. Province map coordinates (for the researcher/admin risk map)
**Decision:** approximate provincial-capital centroid coordinates
(`backend/src/data/provinces.json` — `lat`/`lng` fields), used only for
placing map markers, not for province-boundary shading (choropleth
polygons).
**Why:** no official GeoJSON was provided in the handoff. These centroids
are good enough for a "which province, roughly where" visualization but
are **not survey-grade GIS data**.
**TODO:** swap in an official Thailand province GeoJSON file (many public
sources exist) and switch the map from circle markers to true polygon
choropleth shading.

## 7. Data Dictionary additions
The literal Data Dictionary (handoff section 15) omits a few fields that
are required to make RBAC and ownership actually work. Each addition is
marked `-- ADDITION:` in `backend/src/db/schema.sql`:
- `images.user_id` — needed to enforce "you can only see your own images."
- `locations.province` — needed so outbreak/risk aggregation can group by
  province without re-deriving it every query.
- `statistics.province` / `disease_id` / `period` — the literal Data
  Dictionary's `statistics` table has no natural key to aggregate by; these
  were added so a 77-province, per-disease, per-month rollup is possible.
- `users.status`, `institution`, `access_purpose`, `totp_secret`,
  `totp_enabled` — needed for the researcher application/approval/2FA
  lifecycle described narratively elsewhere in the handoff.
- `logs.severity`, `logs.metadata` — kept `user_id` + `activity` +
  `log_time` as the literal Data Dictionary specifies, and added these two
  only so a real Security Logs screen is usable (filter by severity).

## 8. AI model itself
**Not included.** The handoff's target (4-class rice leaf disease
classifier, ~97.4% accuracy) describes an *outcome* of a training process,
not a deliverable artifact — no labeled dataset or trained weights were
part of the handoff document. `ai-service/main.py` ships a clearly-labeled
placeholder classifier (deterministic-per-image pseudo-random output) so
every other subsystem (backend, web, mobile, statistics, export) can be
built, demoed, and tested end-to-end without blocking on that separate,
much larger effort. See `ai-service/model/README.md` for exactly how to
wire in a real trained model later.

## 9. The 4 canonical disease classes are protected
Per the handoff's implicit constraint that the AI only outputs 4 classes
(Rice Blast, Bacterial Leaf Blight, Rice Tungro Virus, Healthy), the admin
Wiki CRUD API refuses to delete any `encyclopedia` row whose
`disease_code` matches one of the 4 canonical codes, to prevent an admin
from accidentally breaking the AI-response-to-wiki-entry mapping. See
`backend/src/routes/wiki.js`.

## 10. Anonymization approach for research exports
**Decision:** never return `user_id`, `username`, `full_name`, `email`, or
exact GPS coordinates from `/research/data` or `/research/export`. Instead:
a non-reversible-looking reference ID, disease, confidence, **province**
(not exact coordinates), region, and a **month-level** time bucket (not an
exact timestamp).
**Why:** exact GPS + exact timestamp + a small rural population is
realistically re-identifying; province + month is still useful for
epidemiological research without that risk.
**Where:** `backend/src/services/anonymize.js`

## 11. Mobile app scope
The Flutter app (`/mobile`) implements the **farmer** role fully. The
Researcher and Admin experiences (data explorer/export, dashboards, user
management, wiki CRUD, full risk map) are implemented in the **web app**
only (`/web`), consistent with the handoff's own framing of those as
desk-based workflows. See `mobile/README.md` for more.

## 12. What "professional" meant here, given real constraints
This handoff describes a genuinely large, multi-quarter system (mobile +
web + ML pipeline + Firebase infra + GIS + research tooling). Given a
single build session, "professional" was interpreted as: a real,
runnable, end-to-end reference implementation of every subsystem with
correct RBAC/security boundaries and clean, extensible code — rather than
polished UI chrome around subsystems that don't actually work, or a
system that silently fabricates the parts (a trained ML model, real GIS
data, a live Firebase project) that were never actually provided.
