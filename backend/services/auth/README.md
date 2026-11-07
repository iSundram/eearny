# eearny — auth service

Register / login / session verification for the eearny platform.

## Run

```bash
npm install
npm run dev        # http://localhost:4001
```

## Endpoints

| Method | Path                       | Auth     | Body                                |
| ------ | -------------------------- | -------- | ----------------------------------- |
| GET    | `/health`                  | —        | —                                   |
| POST   | `/api/auth/register`       | —        | `{ name, email, password, device? }` |
| POST   | `/api/auth/login`          | —        | `{ email, password, device? }`      |
| GET    | `/api/auth/me`             | Bearer   | —                                   |
| POST   | `/api/auth/logout`         | Bearer   | revokes the caller's session        |
| POST   | `/api/auth/forgot-password` | —       | `{ email }` → dev `resetUrl`        |
| POST   | `/api/auth/reset-password` | —        | `{ token, password }` (single-use)  |
| POST   | `/api/auth/change-password` | Bearer  | `{ currentPassword, newPassword }`  |
| GET    | `/api/auth/sessions`       | Bearer   | active sessions w/ device info      |
| DELETE | `/api/auth/sessions/:sid`  | Bearer   | revoke one session                  |
| DELETE | `/api/auth/sessions`       | Bearer   | revoke all other sessions           |

Success returns `{ token, sid, user }`. Errors return `{ error, field? }` with 400/401/409.

## Sessions & devices

Every login creates a server-side session (`backend/data/sessions.json`, shared with the
account service via `backend/packages/session-store.js`). The JWT carries the `sid` claim;
revoking a session invalidates its token in **every** service immediately. The client sends a
device fingerprint (`frontend/packages/fingerprint.js` — browser, OS, screen, timezone,
language, canvas hash) which is stored per session and shown in myaccount → Security.

Password resets: tokens are single-use, expire after 30 minutes, and revoke all sessions.
Dev mode has no mailer, so `forgot-password` returns the reset link directly — replace with
an email send in production.

## Config

- `PORT` (default 4001)
- `JWT_SECRET` — set the **same** secret on the account service
- `JWT_EXPIRES_IN` (default `7d`)

Users are stored in `data/users.json` (dev only — swap the store for a real DB later).
