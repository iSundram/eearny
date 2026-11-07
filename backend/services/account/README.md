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
