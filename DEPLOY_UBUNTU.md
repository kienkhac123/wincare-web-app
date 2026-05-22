# Deploy Wincare on the current Ubuntu server

This guide targets the current server:

- Ubuntu Server host: `iamkin`
- SSH user: `iamkin`
- LAN IP: `192.168.1.16`
- App path: `/var/www/wincare`
- Node process: PM2 app `wincare`
- MariaDB data path: `/data/mysql`
- Public access: Tailscale Funnel

## Recommended architecture

Use the services already installed:

```text
Internet
  -> Tailscale Funnel public HTTPS URL
  -> Nginx on localhost/LAN port 80
  -> Node app managed by PM2 on 127.0.0.1:3000
  -> MariaDB on 127.0.0.1:3306
```

This avoids router port forwarding and does not expose MariaDB or the Node port directly to the internet.

## SSH from another network

The LAN command only works while Windows can reach `192.168.1.16`:

```bash
ssh iamkin@192.168.1.16
```

For administration from another network, install and sign in to Tailscale on the Windows machine too. Then use the server MagicDNS name or Tailscale IP instead of the LAN IP:

```bash
ssh iamkin@iamkin
```

Keep ordinary OpenSSH if this already works over the tailnet. Tailscale SSH is optional; enable it only if you want Tailscale to manage SSH authentication and tailnet SSH policy.

## Keep

- `ssh`: server administration.
- `ufw`: firewall rules.
- `mariadb`: app database, still using `/data/mysql`.
- `pm2`: keeps the Node app alive and restores it after reboot.
- `nginx`: one local reverse proxy in front of Node.
- `tailscaled` and Tailscale Funnel: public HTTPS URL without opening home router ports.

## Do not expose

- Do not open MariaDB port `3306` to the internet.
- Do not open Node port `3000` to the internet.
- Do not add router port forwarding for ports `80`, `443`, `3000`, or `3306` when using Funnel.

## Remove or disable when unused

- Disable the default Nginx site if it is still enabled:

```bash
sudo unlink /etc/nginx/sites-enabled/default
```

- Remove old duplicate PM2 app entries if `pm2 list` shows more than one Wincare process:

```bash
pm2 delete <old-process-name-or-id>
pm2 save
```

- Remove old UFW allow rules for `3000` or `3306` if they exist:

```bash
sudo ufw status numbered
sudo ufw delete <rule-number>
```

- Keep Nginx if Funnel points at port `80`. If you intentionally change Funnel to point straight at Node port `3000`, Nginx becomes optional.

## Environment

Create the server environment file once:

```bash
cd /var/www/wincare
cp .env.example .env
nano .env
```

Use values like:

```dotenv
PORT=3000
HOST=127.0.0.1
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=wincare_user
DB_PASSWORD=<real-database-password>
DB_NAME=wincare
DB_POOL_LIMIT=10
```

`.env` is ignored by Git. Do not commit the real password.

## Nginx reverse proxy

Use `/etc/nginx/sites-available/wincare` like:

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/wincare /etc/nginx/sites-enabled/wincare
sudo nginx -t
sudo systemctl reload nginx
```

## First deploy

```bash
ssh iamkin@192.168.1.16
cd /var/www/wincare
git pull origin main
npm ci --omit=dev
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Run the `sudo ...` command printed by `pm2 startup`, then save again:

```bash
pm2 save
```

## Update deploy

```bash
ssh iamkin@192.168.1.16
cd /var/www/wincare
git pull origin main
npm ci --omit=dev
pm2 restart wincare
curl http://127.0.0.1:3000/health
curl http://127.0.0.1/health
```

## Public HTTPS with Tailscale Funnel

Funnel should target Nginx port `80` in this architecture:

```bash
sudo tailscale up
sudo tailscale funnel --bg 80
tailscale funnel status
```

Use the public HTTPS URL shown by `tailscale funnel status`.

To turn this Funnel target off:

```bash
sudo tailscale funnel --bg 80 off
```

## Firewall baseline

Check current rules first:

```bash
sudo ufw status verbose
```

For this architecture, allow SSH. Port `80` can stay open only if LAN access through Nginx is desired. Port `3000` and MariaDB port `3306` should not be open to outside clients.

## Health checks

```bash
pm2 list
pm2 logs wincare --lines 100
sudo systemctl status nginx
sudo systemctl status mariadb
sudo systemctl status tailscaled
curl http://127.0.0.1:3000/health
curl http://127.0.0.1/health
tailscale funnel status
```
