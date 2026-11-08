# Deploying the API on Oracle Cloud (Always Free)

One VM runs everything: PostgreSQL 17 + PostGIS, the Spring Boot API and Caddy, which serves
HTTPS with an automatic Let's Encrypt certificate. The database is not reachable from the
internet; only ports 80/443 (Caddy) are open.

```
internet ──443──> Caddy ──> app:8080 (Spring Boot) ──> db:5432 (Postgres/PostGIS, volume pgdata)
```

Cost: €0 on Always Free resources (Ampere A1 up to 4 OCPU / 24 GB, 200 GB block storage).

## 1. Create the VM

1. Sign up at https://www.oracle.com/cloud/free/ (needs a card for verification; Always
   Free resources are not charged). Pick a home region close to your users, e.g. Madrid or
   Frankfurt. **The home region can't be changed later.**
2. Compute → Instances → Create instance:
   - Image: **Canonical Ubuntu 24.04** (the aarch64 build is picked automatically for Ampere).
   - Shape: **VM.Standard.A1.Flex**, 2 OCPU / 12 GB (or the full 4 / 24 GB).
   - Networking: create a VCN with a public subnet, **assign a public IPv4 address**.
   - Upload or generate an SSH key and keep the private key.
   - "Out of capacity" for A1 is common: retry later or try another availability domain.
3. Note the public IP.

Idle Always Free instances can be reclaimed (CPU under ~20% for 7 days). Upgrading the
account to Pay As You Go removes that rule and still costs nothing as long as you stay
within the Always Free limits; if you do it, set a budget alert of €1 (Billing → Budgets).

## 2. Open ports 80 and 443

Two firewalls, both are closed by default:

1. **Cloud side:** Networking → Virtual cloud networks → your VCN → Security Lists → Default →
   Add Ingress Rules: source `0.0.0.0/0`, TCP, destination ports `80,443`.
   (Optional: also UDP 443 for HTTP/3.)
2. **On the VM** (Oracle's Ubuntu image ships with iptables rules that reject everything
   except SSH):

```bash
ssh ubuntu@<PUBLIC_IP>
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Domain

Free option: https://www.duckdns.org → sign in → create `yourname` → set its IP to the VM's
public IP. The API domain is then `yourname.duckdns.org`.
With your own domain: an `A` record pointing to the VM's IP (see Cloudflare below).

Check before going on: `nslookup yourname.duckdns.org` returns the VM's IP.

## 4. Install Docker and get the code

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu && newgrp docker
git clone https://github.com/acoder160/PROY_INTERMODULAR_ANDRII_CHAIKA.git skatemap
cd skatemap/deploy
cp .env.example .env && chmod 600 .env
nano .env        # fill in every value (see comments in the file)
```

## 5. Move the data from Neon

Skip this for an empty database (Flyway creates the schema on first start).

```bash
docker compose up -d --build db
# Dump from Neon (the connection string is in the Neon console; keep sslmode=require)
docker run --rm postgres:17 pg_dump "postgresql://USER:PASSWORD@HOST/DB?sslmode=require" \
  -Fc --no-owner --no-privileges > neon.dump
docker compose exec -T db pg_restore -U skatemap -d skatemap --no-owner --no-privileges < neon.dump
rm neon.dump
```

`pg_restore` may print "extension postgis already exists"-style warnings; those are harmless.
Check: `docker compose exec db psql -U skatemap -c "select count(*) from spots"`.

## 6. Start everything

```bash
docker compose up -d --build
docker compose logs -f app        # wait for "Started SkatemapApplication"
curl -sI https://yourname.duckdns.org/api/spots | head -5
```

The first `--build` takes a few minutes (Maven downloads dependencies). Caddy gets the
certificate on the first HTTPS request; if it fails, `docker compose logs caddy` usually
shows that port 80 isn't reachable or DNS doesn't point to the VM yet.

## 7. Point the clients at the new API

- **Google Cloud Console** → the Web OAuth client:
  - Authorized redirect URIs: add `https://<API_DOMAIN>/api/auth/google/callback`.
  - Authorized JavaScript origins: the website origin (e.g. `https://skatemap.netlify.app`).
  - The ngrok URI can be removed once local testing is done.
- **Website (Netlify)** → Site configuration → Environment variables:
  `VITE_API_URL=https://<API_DOMAIN>/api`, then redeploy. The site origin must be in
  `CORS_ORIGINS` / `FRONTEND_URL` in `deploy/.env`.
- **Mobile app:** `EXPO_PUBLIC_API_URL=https://<API_DOMAIN>` for the EAS build
  (`eas env:create` or `eas.json` → `build.preview.env`), then `eas build -p android --profile preview`
  for an installable APK.
- Once nothing uses Render any more, delete `.github/workflows/keep_alive.yml` and the Render service.

## 8. Backups

```bash
chmod +x ~/skatemap/deploy/backup.sh
~/skatemap/deploy/backup.sh          # first run by hand
crontab -e
# add:
15 3 * * * /home/ubuntu/skatemap/deploy/backup.sh >> /home/ubuntu/skatemap-backup.log 2>&1
```

Dumps go to `~/skatemap-backups`, 14 days are kept. They live on the same VM, so copy one
off the machine from time to time (`scp ubuntu@<IP>:skatemap-backups/<file> .`), or upload
them to Oracle Object Storage (20 GB free).

## Updating

```bash
cd ~/skatemap && git pull
cd deploy && docker compose up -d --build app
```

Flyway applies new migrations on start. Downtime is the ~20 s the new container takes to boot.

## Load test against the server

From a machine with good bandwidth (or from the VM itself to measure the server without the
network), see `skatemap/loadtest/README.md`:

```bash
k6 run -e BASE_URL=https://<API_DOMAIN> -e PROFILE=full skatemap/loadtest/browse.js
```

## Optional: Cloudflare in front

Needs your own domain on Cloudflare (DuckDNS subdomains can't be proxied). Gives a CDN for
the cached read endpoints and hides the VM's IP.

1. DNS record `api` → VM IP, proxied (orange cloud). SSL/TLS mode: **Full (strict)**.
2. In `deploy/.env`: `API_DOMAIN=api.yourdomain.com`, `CLIENT_IP_HEADER=CF-Connecting-IP`.
3. Allow 80/443 only from Cloudflare's ranges (https://www.cloudflare.com/ips/) in the
   Security List; otherwise anyone can hit the VM directly and fake `CF-Connecting-IP` to
   get around the rate limits.

## Troubleshooting

| Symptom | Check |
|---|---|
| Browser can't connect at all | Both firewalls (step 2), `docker compose ps` |
| Certificate error | DNS points to the VM; `docker compose logs caddy` |
| 502 from Caddy | The app is still starting or crashed: `docker compose logs app` |
| Website login doesn't persist | `REFRESH_COOKIE_SAME_SITE=None`, site origin in `CORS_ORIGINS` |
| Google `redirect_uri_mismatch` | The callback URI in Google Console matches `https://<API_DOMAIN>/api/auth/google/callback` exactly |
