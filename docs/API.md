# API Reference — Rice AI Backend

Base URL (local dev): `http://localhost:4000`
Auth: `Authorization: Bearer <JWT>` header, obtained from `/auth/login`.

## Public / Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register a new **farmer** account |
| POST | `/researcher/apply` | Apply for a researcher account (pending approval) |
| GET | `/researcher/application/status` | Check your researcher application status |
| POST | `/auth/login` | Login; returns `{ token, user, requires_2fa }` |
| POST | `/researcher/2fa/verify` | Verify TOTP code, returns a fully-privileged token |
| GET | `/diseases` | List/search the disease encyclopedia (public) |
| GET | `/diseases/:id` | Disease detail + advice (public) |

## Authenticated (any role)

| Method | Path | Description |
|---|---|---|
| GET | `/me` | Current user profile |
| PATCH | `/me` | Update profile |
| GET | `/me/settings` | Get theme/language/notification settings |
| PATCH | `/me/settings` | Update settings |
| POST | `/diagnosis/predict` | Upload image (+ optional GPS) → AI diagnosis |
| GET | `/diagnosis/me` | Your diagnosis history |
| GET | `/diagnosis/:id` | Diagnosis detail (owner or admin only) |
| GET | `/outbreak/provinces` | 77-province outbreak summary (list view) |
| GET | `/outbreak/provinces/:province` | Province detail + disease breakdown |

## Researcher (approved + 2FA-verified) / Admin

| Method | Path | Description |
|---|---|---|
| GET | `/risk-map` | Choropleth-ready province risk data |
| GET | `/risk-map/list` | Same data, list form |
| GET | `/research/data` | Anonymized, filterable diagnosis records |
| POST | `/research/export` | Export anonymized data as CSV or JSON |
| GET | `/research/exports` | Your export history |

## Admin only

| Method | Path | Description |
|---|---|---|
| GET | `/admin/dashboard` | Summary cards, charts data |
| GET | `/admin/live-feed` | Recent diagnoses stream |
| GET | `/admin/diagnoses` | All reports, filterable |
| GET | `/admin/users` | List/search users |
| POST | `/admin/users` | Create a user (any role) |
| PATCH | `/admin/users/:id` | Edit user |
| POST | `/admin/researchers/:id/approve` | Approve a pending researcher |
| POST | `/admin/researchers/:id/reject` | Reject a pending researcher |
| POST | `/admin/users/:id/suspend` | Suspend a user |
| POST | `/admin/users/:id/reactivate` | Reactivate a user |
| GET | `/admin/audit-logs` | Security/audit log, filterable |
| POST/PATCH/DELETE | `/admin/diseases`, `/admin/advice` | Wiki CRUD |

## AI Service (FastAPI, port 8000, called by the backend — not by clients directly)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service + model status |
| POST | `/predict` | Raw image bytes → `{ class_code, confidence }` |

See `docs/ASSUMPTIONS_AND_TODOS.md` for what's a placeholder vs. what's real.
