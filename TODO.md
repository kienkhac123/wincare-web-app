# TODO - Rebuild Backend `server.js` (MySQL, Secure, Scalable)

## ✅ Plan Approved
- [x] Keep frontend untouched (`index.html`, `style.css`, `script.js` behavior compatibility).
- [x] Rebuild backend with Node.js + Express + MySQL.
- [x] Bind server to IPv4 host `0.0.0.0`.

## 🔧 Implementation Steps
- [x] Rewrite `server.js` from scratch with:
  - [x] Express app bootstrap
  - [x] Security middleware (`helmet`, strict `cors`, JSON parser limit)
  - [x] MySQL pool config with UTF-8 (`utf8mb4`)
  - [x] DB initialization + table create (`repairs`)
  - [x] Validation/sanitization helpers
  - [x] API routes:
    - [x] `GET /api/repairs` (supports optional q/status/limit/offset)
    - [x] `POST /api/repairs`
    - [x] `PUT /api/repairs/:id/status`
  - [x] `GET /api/health`
  - [x] 404 + centralized error middleware
  - [x] `app.listen(PORT, '0.0.0.0', ...)`
- [x] Update `package.json` dependencies (add `helmet`).

## 🧪 Testing Steps
- [ ] Install/update dependencies.
- [ ] Start server.
- [ ] Curl test:
  - [ ] Health endpoint
  - [ ] GET repairs
  - [ ] POST repairs (Vietnamese payload)
  - [ ] PUT status update
- [ ] Verify no regression with frontend API contract.
