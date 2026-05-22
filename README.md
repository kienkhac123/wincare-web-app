# Wincare web app

Ứng dụng quản lý phiếu sửa chữa Wincare dùng Express, MariaDB và frontend HTML/CSS/JS thuần.

## Deploy

Hướng dẫn deploy cho Ubuntu Server hiện tại nằm ở [DEPLOY_UBUNTU.md](./DEPLOY_UBUNTU.md).

Luồng cập nhật cơ bản:

```bash
# Máy Windows
git add .
git commit -m "update"
git push origin main
```

```bash
# Ubuntu Server
cd /var/www/wincare
git pull origin main
npm ci --omit=dev
pm2 restart wincare
```
