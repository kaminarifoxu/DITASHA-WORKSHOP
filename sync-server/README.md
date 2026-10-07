# DITASHA phone sync — Debian

Use `workspace.gremoryy.my.id` for your private workspace. This package supports Debian 12/13 with Docker Compose. It does not install itself on your VPS.

## 1. DNS and network

Create an **A record** named `workspace` pointing to your VPS public IPv4 address. Add an AAAA record only if the server really has working public IPv6. Allow inbound TCP ports **80 and 443** in your VPS firewall/security group. Keep your SSH access allowed. Port 8787 stays bound to localhost; do not expose it.

If using a DNS proxy, choose DNS-only during initial certificate setup. Your existing root website can continue using `gremoryy.my.id`.

## 2. Install Docker

If `docker compose version` already works, skip this step. Otherwise follow the official Debian installation guide: https://docs.docker.com/engine/install/debian/ . On a fresh Debian 12/13 server, run as root:

```sh
apt update
apt install -y ca-certificates curl unzip
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $VERSION_CODENAME
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker compose version
```

If Debian reports conflicting Docker/container packages, use the official guide to review them before removal; do not remove services blindly.

## 3. Upload and initialize

Upload `DITASHA-Sync-Server.zip` from the GitHub release to `/tmp/` on your VPS (SCP or your server file manager). Then run as root:

```sh
mkdir -p /opt
unzip /tmp/DITASHA-Sync-Server.zip -d /opt
cd /opt/ditasha-sync
cp .env.example .env
docker compose build app
bash setup-owner.sh
```

The script asks for your username and a password of at least 12 characters. Password input is hidden and stored as a salted scrypt hash. This is your private workspace login, separate from Gmail, ChatGPT and GitHub.

The download provided directly in chat may have a version suffix. Rename it to `DITASHA-Sync-Server.zip` before using the command above.

## 4. Start HTTPS — choose one path

### No existing web server: Caddy

Use this if ports 80/443 are free:

```sh
cd /opt/ditasha-sync
docker compose --profile https up -d
docker compose logs --tail=50 app caddy
```

Caddy obtains an HTTPS certificate automatically once DNS points here and both ports are reachable. Visit **https://workspace.gremoryy.my.id** and sign in. Certificate setup details: https://caddyserver.com/docs/automatic-https .

### Existing Nginx: keep Nginx

Start only the application, then add the supplied separate virtual host:

```sh
cd /opt/ditasha-sync
docker compose up -d app
cp nginx.conf.example /etc/nginx/sites-available/ditasha-workspace
ln -s /etc/nginx/sites-available/ditasha-workspace /etc/nginx/sites-enabled/ditasha-workspace
nginx -t
systemctl reload nginx
apt install -y certbot python3-certbot-nginx
certbot --nginx -d workspace.gremoryy.my.id
```

If that configuration filename already exists, review it instead of overwriting it. Do not start Caddy alongside Nginx on the same ports. An existing Apache or another proxy can also forward this subdomain to `127.0.0.1:8787` with HTTPS.

## 5. Pair your PC and Android

1. Update Windows to **DITASHA Workspace 3.15.0** and keep the app open.
2. Open the HTTPS workspace on your phone, sign in and choose **Devices → Create pairing code**. The one-use code expires after ten minutes.
3. On Windows, open **Settings → Sync ponsel**, enter `https://workspace.gremoryy.my.id`, the code and a PC name, then pair.
4. Install `DITASHA-Companion.apk` on Android 8 or newer, allowing installation from the browser/file manager you use. Open it and sign in with the same workspace account. You can also use the mobile website without installing an APK.

Pairing a new PC revokes the previous PC. Use Devices to revoke access. Disconnecting locally stops syncing but does not erase already uploaded data.

## What syncs

- Recent conversations, projects and employee provider/model labels; text/code attachments can be submitted from the phone, and generated code files can be downloaded.
- Phone requests queue while the PC is offline. The open Windows app runs them through your existing employee workflow. This release executes one phone request at a time; the existing employee collaboration can still run workers concurrently within a request.
- Lora's sorting counts, payment metadata, recent Achi transactions and the latest available Lora/Achi Excel report (up to 4 MB). The phone can request an email scan or review a payment for duplicate-safe IDR ledger import.
- API keys, ChatGPT sessions, Gmail passwords, employee private instructions and arbitrary PC files are not uploaded. The account can access the uploaded content, so protect the VPS and backups.

The Windows app must remain open, online and awake for AI work and uploads. Lora's existing Windows scheduler can scan while the app is closed; those results upload after reopening. If a request loses its lease, it appears interrupted for review instead of being run again automatically. Completed chat results survive reconnection. Sync is deliberately limited to recent history and may show a partial-history notice. Android background push notifications, phone model editing, binary file attachments and running AI directly on the VPS are not included in this first version.

The APK is a personal preview signed by a build-generated preview key. It is not a Play Store release. Future APK updates require the same signing key; back up your own production key before wider distribution.

## Maintenance and recovery

```sh
cd /opt/ditasha-sync
docker compose ps
docker compose logs --tail=100 app
bash setup-owner.sh reset-password
```

Resetting the password logs out existing phone/browser sessions. Revoking a PC is a separate action in Devices.

Create and copy a consistent SQLite backup (choose a new filename each time):

```sh
docker compose exec -T app node admin.mjs backup /data/backup-20261007.sqlite
docker compose cp app:/data/backup-20261007.sqlite ./backup-20261007.sqlite
chmod 600 backup-20261007.sqlite
```

Keep backups private. To restore, stop the app, copy the backup into the volume as `/data/ditasha.sqlite`, remove that database's stale `-wal`/`-shm` files, set ownership to container UID 1000 and restart. Test restoration on a separate volume first.

For updates, replace deployment source files while preserving `.env` and Docker volumes, then run `docker compose build app` and your chosen `up -d` command again. **Do not run `docker compose down -v`** unless you intend to erase the workspace database.

If login does not work, verify HTTPS and the exact domain in `.env`; cookies are HTTPS-only. If the PC cannot pair, check the server logs and create a fresh code. If HTTPS fails, check DNS, IPv6, port availability and the proxy logs.
