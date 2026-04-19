1. Tại Máy tính (PC)
Bash
git add .
git commit -m "update"
git push origin main
2. Tại Server (VPS)
Bash
cd /var/www/wincare
git pull origin main
pm2 restart all
