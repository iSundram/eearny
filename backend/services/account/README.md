# eearny — account service

Profile, earnings summary and transaction history for logged-in users.
All routes (except `/health`) require `Authorization: Bearer <token>` issued by the auth service —
both services must share the same `JWT_SECRET`.

## Run

```bash
npm install
npm run dev        # http://localhost:4002
```

## Endpoints

| Method | Path                      | Body / Notes                    |
| ------ | ------------------------- | ------------------------------- |
| GET    | `/health`                 | —                               |
| GET    | `/api/account/me`         | —                               |
| PATCH  | `/api/account/me`         | `{ name }`                      |
| GET    | `/api/account/summary`    | balance / earned / pending      |
| GET    | `/api/account/transactions` | seeded demo history per user  |

## Wallet & dashboard API (INR)

All routes need `Authorization: Bearer <jwt>`. Logic lives in `src/wallet.js`; data in `data/wallet.json`
(override with `WALLET_DB_FILE`). `REVENUE_DAY_MS` / `WITHDRAW_PROCESS_MS` shorten revenue days / withdrawal
settlement for demos.

| Area | Endpoints |
| --- | --- |
| Wallet | `GET /summary`, `GET /config`, `GET /transactions?category=`, `POST /topup`, `POST /withdraw` |
| Payment methods | `GET/POST /methods`, `POST /methods/:id/default`, `DELETE /methods/:id` |
| Invest | `GET /plans`, `GET /investments`, `POST /invest {planId, units, source}` |
| Rewards | `GET/POST /checkin` (₹5 base + tier bonus), `GET /lucky`, `POST /lucky/spin` |
| Referrals | `GET /referrals`, `POST /referrals/redeem {code}` — commission 10% / 5% / 2% (levels 1–3) |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read-all`, `POST /notifications/:id/read`, `DELETE /notifications[/:id]`, `GET/PUT /notification-prefs` |

All paths are prefixed `/api/account`. Top-ups are simulated (no real payment gateway).
Plans: Starter ₹500 · Basic ₹1,000 · Silver ₹5,000 · Gold ₹10,000 · Platinum ₹25,000 · Diamond ₹50,000.
Tiers (lifetime invested): Bronze · Silver ₹1k · Gold ₹10k · Platinum ₹50k · Diamond ₹150k.
