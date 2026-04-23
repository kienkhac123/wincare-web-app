require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const ALLOWED_STATUSES = ['Chưa xử lý', 'Đang xử lý', 'Đã xử lý', 'Đã trả máy'];

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'wincare_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wincare',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
    queueLimit: 0
};

let pool;

/**
 * Helpers
 */
function toTrimmedString(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    return String(value).trim();
}

function toNullableTrimmedString(value) {
    const v = toTrimmedString(value, '');
    return v === '' ? null : v;
}

function toPositiveInt(value, fallback) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return fallback;
    return n;
}

function getTodayVN() {
    return new Date().toLocaleDateString('vi-VN');
}

function sanitizeRepairPayload(body = {}) {
    return {
        ngayNhan: toTrimmedString(body.ngayNhan, getTodayVN()),
        tenKhach: toTrimmedString(body.tenKhach),
        sdt: toTrimmedString(body.sdt),
        tenMay: toTrimmedString(body.tenMay),
        moTaLoi: toTrimmedString(body.moTaLoi),
        phuongAnXuLi: toTrimmedString(body.phuongAnXuLi),
        tinhTrang: toTrimmedString(body.tinhTrang, 'Chưa xử lý') || 'Chưa xử lý',
        ngayTra: toNullableTrimmedString(body.ngayTra),
        ghiChu: toTrimmedString(body.ghiChu, ''),
        workNote: toTrimmedString(body.workNote, '')
    };
}

function validateRepairPayload(payload) {
    const requiredFields = ['tenKhach', 'sdt', 'tenMay', 'moTaLoi', 'phuongAnXuLi'];

    for (const field of requiredFields) {
        if (!payload[field]) {
            return `Thiếu trường bắt buộc: ${field}`;
        }
    }

    if (payload.tinhTrang && !ALLOWED_STATUSES.includes(payload.tinhTrang)) {
        return 'Tình trạng không hợp lệ';
    }

    return null;
}

function validateStatusUpdatePayload(body = {}) {
    const tinhTrang = toTrimmedString(body.tinhTrang);
    const ngayTra = body.ngayTra === undefined ? null : toNullableTrimmedString(body.ngayTra);

    if (!tinhTrang) {
        return { error: 'Thiếu trường tinhTrang' };
    }

    if (!ALLOWED_STATUSES.includes(tinhTrang)) {
        return { error: 'Tình trạng không hợp lệ' };
    }

    return { tinhTrang, ngayTra };
}

function parseListQuery(query = {}) {
    const q = toTrimmedString(query.q, '');
    const status = toTrimmedString(query.status, '');
    const limit = Math.min(toPositiveInt(query.limit, 200), 1000);
    const offset = toPositiveInt(query.offset, 0);

    return { q, status, limit, offset };
}

async function initDatabase() {
    pool = mysql.createPool(dbConfig);

    const conn = await pool.getConnection();
    try {
        await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
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
        console.log('[DB] Connected and schema ensured');
    } finally {
        conn.release();
    }
}

function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Security / middleware
 */
app.use(helmet());


app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.options('*', cors());
app.use(express.json({ limit: '1mb' }));

// Static frontend
//const publicDir = path.join(__dirname, 'public');
//app.use(express.static(publicDir));
app.use(express.static(__dirname));

/**
 * Routes
 */
app.get('/api/health', asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({
        ok: rows?.[0]?.ok === 1,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
}));

app.get('/api/repairs', asyncHandler(async (req, res) => {
    const { q, status, limit, offset } = parseListQuery(req.query);

    const where = [];
    const params = [];

    if (q) {
        where.push(`(
            tenKhach LIKE ?
            OR sdt LIKE ?
            OR tenMay LIKE ?
            OR moTaLoi LIKE ?
            OR phuongAnXuLi LIKE ?
            OR ghiChu LIKE ?
            OR workNote LIKE ?
        )`);
        const like = `%${q}%`;
        params.push(like, like, like, like, like, like, like);
    }

    if (status) {
        where.push('tinhTrang = ?');
        params.push(status);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit, offset);

    const sql = `
        SELECT
            id, ngayNhan, tenKhach, sdt, tenMay, moTaLoi,
            phuongAnXuLi, tinhTrang, ngayTra, ghiChu, workNote
        FROM repairs
        ${whereClause}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(sql, params);
    console.log(`[API] GET /api/repairs -> ${rows.length} rows (q="${q}", status="${status}")`);
    res.json(rows);
}));

app.post('/api/repairs', asyncHandler(async (req, res) => {
    const payload = sanitizeRepairPayload(req.body);
    const validationError = validateRepairPayload(payload);

    if (validationError) {
        return res.status(400).json({ message: validationError });
    }

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

    console.log(`[API] POST /api/repairs -> created id=${result.insertId}`);
    return res.status(201).json(rows[0]);
}));

app.put('/api/repairs/:id/status', asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    if (!id || Number.isNaN(id)) {
        return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const { error, tinhTrang, ngayTra } = validateStatusUpdatePayload(req.body);
    if (error) {
        return res.status(400).json({ message: error });
    }

    const [updateResult] = await pool.query(
        `
        UPDATE repairs
        SET tinhTrang = ?, ngayTra = ?
        WHERE id = ?
        `,
        [tinhTrang, ngayTra, id]
    );

    if (updateResult.affectedRows === 0) {
        return res.status(404).json({ message: 'Không tìm thấy phiếu sửa chữa' });
    }

    const [rows] = await pool.query(
        `
        SELECT
            id, ngayNhan, tenKhach, sdt, tenMay, moTaLoi,
            phuongAnXuLi, tinhTrang, ngayTra, ghiChu, workNote
        FROM repairs
        WHERE id = ?
        `,
        [id]
    );

    console.log(`[API] PUT /api/repairs/${id}/status -> ${tinhTrang}`);
    return res.json(rows[0]);
}));

/**
 * Not Found
 */
app.use((req, res) => {
    res.status(404).json({ message: 'Endpoint không tồn tại' });
});

/**
 * Centralized error handler
 */
app.use((err, req, res, next) => {
    console.error('[ERROR]', err?.message || err);
    if (res.headersSent) return next(err);

    const isCorsError = String(err?.message || '').toLowerCase().includes('cors');
    if (isCorsError) {
        return res.status(403).json({ message: 'CORS bị từ chối' });
    }

    return res.status(500).json({
        message: 'Lỗi hệ thống',
        error: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
});

/**
 * Bootstrap
 */
initDatabase()
    .then(() => {
        app.listen(PORT, HOST, () => {
            console.log(`Wincare backend listening on http://${HOST}:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Database init failed:', error);
        process.exit(1);
    });
