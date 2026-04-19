require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve frontend static files
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.use(express.static(__dirname));

const PORT = Number(process.env.PORT || 3000);

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'wincare_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wincare',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

async function initDatabase() {
    pool = mysql.createPool(dbConfig);

    // Ensure connection and UTF-8 support
    const conn = await pool.getConnection();
    try {
        await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        await conn.query(`
            CREATE TABLE IF NOT EXISTS repairs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ngayNhan VARCHAR(20) NOT NULL,
                tenKhach VARCHAR(255) NOT NULL,
                sdt VARCHAR(50) NOT NULL,
                tenMay VARCHAR(255) NOT NULL,
                moTaLoi TEXT NOT NULL,
                phuongAnXuLi VARCHAR(255) NOT NULL,
                tinhTrang VARCHAR(100) DEFAULT 'Chưa xử lý',
                ngayTra VARCHAR(20) NULL,
                ghiChu TEXT NULL,
                workNote TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);
    } finally {
        conn.release();
    }
}

function validateRepairPayload(body) {
    const requiredFields = ['tenKhach', 'sdt', 'tenMay', 'moTaLoi', 'phuongAnXuLi'];
    for (const field of requiredFields) {
        if (!body[field] || String(body[field]).trim() === '') {
            return `Thiếu trường bắt buộc: ${field}`;
        }
    }
    return null;
}

app.get('/api/health', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 AS ok');
        res.json({ ok: rows?.[0]?.ok === 1 });
    } catch (error) {
        res.status(500).json({ message: 'Database connection failed', error: error.message });
    }
});

app.get('/api/repairs', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id, ngayNhan, tenKhach, sdt, tenMay, moTaLoi,
                phuongAnXuLi, tinhTrang, ngayTra, ghiChu, workNote
            FROM repairs
            ORDER BY id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('GET /api/repairs error:', error);
        res.status(500).json({ message: 'Lỗi tải danh sách sửa chữa', error: error.message });
    }
});

app.post('/api/repairs', async (req, res) => {
    try {
        const validationError = validateRepairPayload(req.body);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const payload = {
            ngayNhan: req.body.ngayNhan || new Date().toLocaleDateString('vi-VN'),
            tenKhach: String(req.body.tenKhach || '').trim(),
            sdt: String(req.body.sdt || '').trim(),
            tenMay: String(req.body.tenMay || '').trim(),
            moTaLoi: String(req.body.moTaLoi || '').trim(),
            phuongAnXuLi: String(req.body.phuongAnXuLi || '').trim(),
            tinhTrang: req.body.tinhTrang ? String(req.body.tinhTrang).trim() : 'Chưa xử lý',
            ngayTra: req.body.ngayTra || null,
            ghiChu: req.body.ghiChu ? String(req.body.ghiChu).trim() : '',
            workNote: req.body.workNote ? String(req.body.workNote).trim() : ''
        };

        const [result] = await pool.query(
            `
            INSERT INTO repairs
            (ngayNhan, tenKhach, sdt, tenMay, moTaLoi, phuongAnXuLi, tinhTrang, ngayTra, ghiChu, workNote)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                payload.ngayNhan,
                payload.tenKhach,
                payload.sdt,
                payload.tenMay,
                payload.moTaLoi,
                payload.phuongAnXuLi,
                payload.tinhTrang,
                payload.ngayTra,
                payload.ghiChu,
                payload.workNote
            ]
        );

        const [rows] = await pool.query(
            `
            SELECT
                id, ngayNhan, tenKhach, sdt, tenMay, moTaLoi,
                phuongAnXuLi, tinhTrang, ngayTra, ghiChu, workNote
            FROM repairs
            WHERE id = ?
            `,
            [result.insertId]
        );

        return res.status(201).json(rows[0]);
    } catch (error) {
        console.error('POST /api/repairs error:', error);
        return res.status(500).json({ message: 'Lỗi lưu phiếu sửa chữa', error: error.message });
    }
});

initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Wincare backend listening on http://0.0.0.0:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Database init failed:', error);
        process.exit(1);
    });
