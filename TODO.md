# TODO - Chuyển Bộ lọc sang panel trái + lọc thời gian

## ✅ Plan Approved
- [x] Tạo panel trái “Bộ lọc” tương tự panel note bên phải.
- [x] Bao gồm:
  - [x] Lọc theo tình trạng
  - [x] Lọc theo thời gian (khung sẵn / tùy chọn ngày)
- [x] Giữ nguyên các tính năng hiện có (search, chọn hàng loạt, pagination, note panel).

## 🔧 Implementation Steps
- [ ] Update `index.html`
  - [ ] Thêm panel trái “🧰 Bộ lọc”
  - [ ] Đưa status filter vào panel trái
  - [ ] Thêm bộ lọc thời gian (preset/custom + from/to)
  - [ ] Bỏ status filter ở thanh filter giữa
- [ ] Update `style.css`
  - [ ] Chuyển layout app thành 3 cột (left filter / main / right notes)
  - [ ] Style panel trái đồng bộ panel phải (nền trắng + bóng xanh)
  - [ ] Responsive dưới 1200px về 1 cột
- [ ] Update `script.js`
  - [ ] Bind events cho panel lọc trái
  - [ ] Áp dụng lọc thời gian cho toàn bộ danh sách
  - [ ] Giữ nguyên selection mode hiện có
- [ ] Update `TODO.md`
  - [ ] Tick hoàn tất các bước sau khi sửa

## 🧪 Testing Steps
- [ ] Verify lọc tình trạng từ panel trái hoạt động đúng
- [ ] Verify lọc thời gian preset hoạt động đúng
- [ ] Verify lọc khoảng ngày custom hoạt động đúng
- [ ] Verify search + pagination + selection mode không hồi quy
- [ ] Verify layout 3 cột desktop và responsive mobile
