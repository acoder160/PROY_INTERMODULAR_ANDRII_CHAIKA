# Load tests (k6)

Install k6: `winget install k6 --source winget` (or https://grafana.com/docs/k6/latest/set-up/install-k6/).

| Script | What it does | Where to run |
|---|---|---|
| `browse.js` | Opening the map (half first visits, half return visits with ETag) and reading comments. Read-only. | Anywhere, including production |
| `mixed.js` | Browsing + 5 logins/s + a few users posting comments. Writes data. | **Staging only**, with `RATE_LIMIT_ENABLED=false` on the backend |

```bash
# Light local check (50 users, ~4 min)
k6 run loadtest/browse.js

# Capacity test on the server (up to 2000 users, ~13 min)
k6 run -e BASE_URL=https://api.example.com -e PROFILE=full loadtest/browse.js
```

Pass/fail thresholds: under 1% errors; p95 under 1.5 s for a first map load (full list),
300 ms for a return visit (304) and 500 ms for comments.

Notes:
- Run the full profile from a machine with good bandwidth: 2000 users downloading the
  ~320 KB (gzip) spot list can saturate a home connection before the server.
- Logins are rate limited per IP (10/min); from one load-generator IP the login scenario
  only makes sense with `RATE_LIMIT_ENABLED=false` on staging.
