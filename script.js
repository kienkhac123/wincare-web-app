// QUẢN LÝ SỬA CHỮA LAPTOP - API + FORM IN THEO MẪU WINCARE24
class RepairManager {
    constructor() {
        this.repairs = [];
        this.searchKeyword = '';
        this.statusFilter = 'all';
        this.expandedRepairId = null;
        this.currentInvoiceServices = [];
    }

    async init() {
        this.bindEvents();
        await this.fetchRepairs();
        this.renderTable();
        this.renderSummaryCards();
    }

    bindEvents() {
        document.getElementById('repairForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitForm();
        });

        document.getElementById('openCreateModal')?.addEventListener('click', () => this.openModal('createModal'));
        document.getElementById('fabCreate')?.addEventListener('click', () => this.openModal('createModal'));
        document.getElementById('closeCreateModal')?.addEventListener('click', () => this.closeModal('createModal'));
        document.getElementById('cancelCreate')?.addEventListener('click', () => this.closeModal('createModal'));

        document.getElementById('invoiceForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveInvoiceAndPrint();
        });
        document.getElementById('addInvoiceLine')?.addEventListener('click', () => this.addInvoiceService());
        document.getElementById('invoiceDiscount')?.addEventListener('input', () => this.calculateInvoiceTotal());
        document.getElementById('closeInvoiceModal')?.addEventListener('click', () => this.closeModal('invoiceModal'));
        document.getElementById('cancelInvoice')?.addEventListener('click', () => this.closeModal('invoiceModal'));

        document.getElementById('closePrintIcon')?.addEventListener('click', () => this.closeModal('printModal'));
        document.getElementById('closePrint')?.addEventListener('click', () => this.closeModal('printModal'));

        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.searchKeyword = (e.target.value || '').trim().toLowerCase();
            this.renderTable();
        });
        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            this.statusFilter = e.target.value || 'all';
            this.renderTable();
        });

        document.getElementById('fabTop')?.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        window.addEventListener('scroll', () => {
            const fabTop = document.getElementById('fabTop');
            if (!fabTop) return;
            fabTop.style.opacity = window.scrollY > 150 ? '1' : '0';
            fabTop.style.pointerEvents = window.scrollY > 150 ? 'auto' : 'none';
        });

        window.addEventListener('click', (event) => {
            const createModal = document.getElementById('createModal');
            const invoiceModal = document.getElementById('invoiceModal');
            const printModal = document.getElementById('printModal');
            if (event.target === createModal) this.closeModal('createModal');
            if (event.target === invoiceModal) this.closeModal('invoiceModal');
            if (event.target === printModal) this.closeModal('printModal');
        });
    }

    openModal(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.style.display = 'block';
    }

    closeModal(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.style.display = 'none';
    }

    normalizeRepair(row, fallbackId = 0) {
        const id = Number(row?.id ?? fallbackId);
        return {
            id: Number.isNaN(id) ? fallbackId : id,
            ngayNhan: row?.ngayNhan || this.formatDateVN(new Date()),
            tenKhach: row?.tenKhach || '',
            sdt: row?.sdt || '',
            tenMay: row?.tenMay || '',
            moTaLoi: row?.moTaLoi || '',
            phuongAnXuLi: row?.phuongAnXuLi || 'Xử lí tại cửa hàng',
            huongXuLyNoiBo: row?.huongXuLyNoiBo || 'Thay linh kiện mới',
            tinhTrang: row?.tinhTrang || 'Chưa xử lý',
            ngayTra: row?.ngayTra || null,
            ghiChu: row?.ghiChu || '',
            workNote: row?.workNote || '',
            invoice: row?.invoice || null
        };
    }

    async fetchRepairs() {
        try {
            const res = await fetch('/api/repairs');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.repairs = Array.isArray(data)
                ? data.map((r, idx) => this.normalizeRepair(r, idx + 1))
                : [];
        } catch (error) {
            console.error('fetchRepairs error:', error);
            this.repairs = [];
            this.showNotification('❌ Không tải được danh sách từ server', 'error');
        }
    }

    capitalizeVietnameseName(name) {
        return (name || '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    validateForm(data) {
        const required = ['tenKhach', 'sdt', 'tenMay', 'moTaLoi', 'phuongAnXuLi'];
        for (const key of required) {
            if (!data[key] || String(data[key]).trim() === '') {
                this.showNotification('❌ Vui lòng nhập đầy đủ thông tin bắt buộc', 'error');
                return false;
            }
        }
        return true;
    }

    async submitForm() {
        try {
            const payload = {
                ngayNhan: this.formatDateVN(new Date()),
                tenKhach: this.capitalizeVietnameseName(document.getElementById('tenKhach')?.value || ''),
                sdt: (document.getElementById('sdt')?.value || '').trim(),
                tenMay: (document.getElementById('tenMay')?.value || '').trim(),
                moTaLoi: (document.getElementById('moTaLoi')?.value || '').trim(),
                phuongAnXuLi: (document.getElementById('phuongAnXuLi')?.value || '')
                    .trim()
                    .replace(/^Xử\s*lí tại cửa hàng$/i, 'Xử lý tại cửa hàng'),
                huongXuLyNoiBo: 'Thay linh kiện mới',
                tinhTrang: 'Chưa xử lý',
                ngayTra: null,
                ghiChu: (document.getElementById('ghiChu')?.value || '').trim(),
                workNote: ''
            };

            if (!this.validateForm(payload)) return;

            const res = await fetch('/api/repairs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${res.status}`);
            }

            const saved = this.normalizeRepair(await res.json(), this.repairs.length + 1);
            await this.fetchRepairs();
            this.renderTable();
            this.renderSummaryCards();

            document.getElementById('repairForm')?.reset();
            this.closeModal('createModal');
            this.showPrintModal(saved, false);
            this.showNotification('✅ Tạo phiếu thành công');
        } catch (error) {
            console.error('submitForm error:', error);
            this.showNotification(`❌ Lỗi lưu dữ liệu: ${error.message}`, 'error');
        }
    }

    getFilteredRepairs() {
        const keyword = this.searchKeyword;
        const status = this.statusFilter;
        return this.repairs.filter((r) => {
            const matchKeyword = !keyword
                || (r.tenKhach || '').toLowerCase().includes(keyword)
                || (r.sdt || '').toLowerCase().includes(keyword)
                || (r.tenMay || '').toLowerCase().includes(keyword);
            const matchStatus = status === 'all' || r.tinhTrang === status;
            return matchKeyword && matchStatus;
        });
    }

    renderTable() {
        const tbody = document.getElementById('repairList');
        if (!tbody) return;

        const list = this.getFilteredRepairs();
        tbody.innerHTML = '';

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:#7f8c8d;">📭 Chưa có dữ liệu</td></tr>';
            return;
        }

        tbody.innerHTML = list.map((repair) => {
            const isExpanded = this.expandedRepairId === repair.id;
            const notePreview = (repair.ghiChu || '').trim() || '-';
            return `
            <tr class="repair-row ${isExpanded ? 'expanded' : ''}" data-id="${repair.id}">
                <td><strong>#${String(repair.id).padStart(3, '0')}</strong></td>
                <td>${repair.ngayNhan}</td>
                <td>${repair.tenKhach}</td>
                <td>${repair.sdt}</td>
                <td>${repair.tenMay}</td>
                <td>${notePreview}</td>
                <td>${repair.tinhTrang}</td>
                <td>${repair.ngayTra || '-'}</td>
                <td>
                    <button type="button" class="btn-print btn-action-print" data-id="${repair.id}" title="In phiếu">🖨️</button>
                    <button type="button" class="btn-secondary mini-btn btn-action-invoice" data-id="${repair.id}" title="Hóa đơn">🧾</button>
                </td>
            </tr>
            ${isExpanded ? `
            <tr class="repair-detail-row">
                <td colspan="9">
                    <div class="repair-detail-box">
                        <div class="repair-detail-grid">
                            <div><strong>Mô tả lỗi:</strong> ${repair.moTaLoi || '-'}</div>
                            <div><strong>Phương án xử lí:</strong> ${repair.phuongAnXuLi || '-'}</div>
                            <div><strong>Ghi chú tiếp nhận:</strong> ${repair.ghiChu || '-'}</div>
                        </div>
                        <div class="work-note-block">
                            <label for="workNote-${repair.id}"><strong>Ghi chú sửa chữa (nội bộ):</strong></label>
                            <textarea id="workNote-${repair.id}" rows="3" placeholder="Nhập ghi chú quá trình sửa...">${repair.workNote || ''}</textarea>
                            <button type="button" class="btn-primary mini-btn" data-save-note="${repair.id}">💾 Lưu ghi chú sửa chữa</button>
                        </div>
                    </div>
                </td>
            </tr>
            ` : ''}
            `;
        }).join('');

        tbody.querySelectorAll('.repair-row').forEach((row) => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button, select, textarea, input')) return;
                const id = Number(row.dataset.id);
                this.toggleRepairDetails(id);
            });
        });

        tbody.querySelectorAll('.btn-action-print').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.id);
                this.printTicket(id);
            });
        });

        tbody.querySelectorAll('.btn-action-invoice').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.id);
                this.openInvoiceModal(id);
            });
        });

        tbody.querySelectorAll('[data-save-note]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.saveNote);
                this.saveRepairWorkNote(id);
            });
        });
    }

    toggleRepairDetails(id) {
        this.expandedRepairId = this.expandedRepairId === id ? null : id;
        this.renderTable();
    }

    saveRepairWorkNote(id) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;
        const el = document.getElementById(`workNote-${id}`);
        if (!el) return;
        repair.workNote = (el.value || '').trim();
        this.showNotification('✅ Đã lưu ghi chú sửa chữa');
    }

    printTicket(id) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;
        this.showPrintModal(repair, false);
    }

    openInvoiceModal(id) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;

        document.getElementById('invoiceRepairId').value = id;
        document.getElementById('invoiceDiscount').value = repair.invoice?.discount || 0;
        document.getElementById('invoiceDevice').value = repair.invoice?.device || repair.tenMay || '';
        document.getElementById('invoiceService').value = '';
        document.getElementById('invoiceQty').value = 1;
        document.getElementById('invoiceAmount').value = '';
        document.getElementById('invoiceLines').innerHTML = '';

        this.currentInvoiceServices = Array.isArray(repair.invoice?.services) ? [...repair.invoice.services] : [];
        this.renderInvoiceServices();
        this.calculateInvoiceTotal();
        this.openModal('invoiceModal');
    }

    addInvoiceService() {
        const service = (document.getElementById('invoiceService')?.value || '').trim();
        const device = (document.getElementById('invoiceDevice')?.value || '').trim();
        const qty = Number(document.getElementById('invoiceQty')?.value || 1);
        const amount = Number(document.getElementById('invoiceAmount')?.value || 0);

        if (!service || !device || qty <= 0 || amount < 0) {
            this.showNotification('❌ Vui lòng nhập đúng dữ liệu dịch vụ', 'error');
            return;
        }

        this.currentInvoiceServices.push({ service, device, qty, amount });
        this.renderInvoiceServices();
        this.calculateInvoiceTotal();

        document.getElementById('invoiceService').value = '';
        document.getElementById('invoiceAmount').value = '';
        document.getElementById('invoiceQty').value = 1;
    }

    removeInvoiceService(index) {
        this.currentInvoiceServices.splice(index, 1);
        this.renderInvoiceServices();
        this.calculateInvoiceTotal();
    }

    renderInvoiceServices() {
        const container = document.getElementById('invoiceLines');
        if (!container) return;

        if (!this.currentInvoiceServices.length) {
            container.innerHTML = '<div style="padding:10px;color:#666;">Chưa có dịch vụ nào được thêm.</div>';
            return;
        }

        container.innerHTML = `
            <table class="invoice-lines-table">
                <thead>
                    <tr>
                        <th>Dịch vụ thay thế</th>
                        <th>Thiết bị sửa chữa</th>
                        <th>SL</th>
                        <th>Thành tiền</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${this.currentInvoiceServices.map((line, idx) => `
                        <tr>
                            <td>${line.service}</td>
                            <td>${line.device}</td>
                            <td>${line.qty}</td>
                            <td>${Number(line.amount).toLocaleString('vi-VN')}</td>
                            <td><button type="button" class="btn-secondary mini-btn" data-remove-invoice="${idx}">Xóa</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.querySelectorAll('[data-remove-invoice]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.removeInvoiceService(Number(btn.dataset.removeInvoice));
            });
        });
    }

    calculateInvoiceTotal() {
        const subtotal = this.currentInvoiceServices.reduce((sum, r) => sum + (Number(r.qty) * Number(r.amount)), 0);
        const discount = Number(document.getElementById('invoiceDiscount')?.value || 0);
        document.getElementById('invoiceTotal').value = Math.max(0, subtotal - discount);
    }

    saveInvoiceAndPrint() {
        const id = Number(document.getElementById('invoiceRepairId')?.value);
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;

        const device = (document.getElementById('invoiceDevice')?.value || '').trim();
        const discount = Number(document.getElementById('invoiceDiscount')?.value || 0);
        const services = [...this.currentInvoiceServices];

        if (!device || !services.length || discount < 0) {
            this.showNotification('❌ Cần thêm ít nhất 1 dòng dịch vụ trước khi in', 'error');
            return;
        }

        const subtotal = services.reduce((sum, r) => sum + (Number(r.qty) * Number(r.amount)), 0);
        const total = Math.max(0, subtotal - discount);

        repair.invoice = { device, services, discount, subtotal, total };
        this.closeModal('invoiceModal');
        this.showPrintModal(repair, true);
    }

    showPrintModal(repair, isInvoice = false) {
        const printContent = document.getElementById('printContent');
        if (!printContent || !repair) return;
        printContent.innerHTML = this.generatePrintHTML(repair, isInvoice);

        // Fallback cưỡng bức: luôn đảm bảo có khối lưu ý quan trọng trong DOM thực tế
        if (!printContent.querySelector('.invoice-note')) {
            const statusBlock = printContent.querySelector('.invoice-status');
            const fallbackNote = document.createElement('div');
            fallbackNote.className = 'invoice-note';
            fallbackNote.innerHTML = `
                <strong>LƯU Ý QUAN TRỌNG:</strong><br>
                Quý khách vui lòng ký tên linh kiện hoặc chụp ảnh linh kiện ngay trước khi bàn giao máy.<br>
                Cửa hàng sẽ bàn giao máy dựa trên đối chiếu ký hiệu linh kiện hoặc ảnh đã lưu.
            `;

            if (statusBlock && statusBlock.parentNode) {
                statusBlock.parentNode.insertBefore(fallbackNote, statusBlock);
            } else {
                printContent.appendChild(fallbackNote);
            }
        }

        this.openModal('printModal');
    }

    generatePrintHTML(repair, isInvoice = false) {
        const today = this.formatDateVN(new Date());
        const maPhieu = `YCSC${String(repair.id || 0).padStart(4, '0')}`;

        return `
        <div class="print-receipt invoice-style">
            <div class="invoice-logo">WINCARE <span>IT Services &amp; Solutions</span></div>
            <div class="invoice-center">
                <div><strong>https://WinCare.vn</strong></div>
                <div>Địa chỉ: 24 Thái Thị Bôi, Chính Gián, Thanh Khê, Đà Nẵng 550000, Việt Nam</div>
                <div>Điện thoại: <strong>0911474727</strong></div>
            </div>

            <h1 class="invoice-title">${isInvoice ? 'Hóa Đơn Sửa Chữa' : 'Phiếu Yêu Cầu Sửa Chữa'}</h1>
            <div class="invoice-code">${maPhieu}</div>
            <div class="invoice-date">Ngày ${today}</div>

            <div class="invoice-block">
                <div><strong>Khách hàng:</strong> ${repair.tenKhach}</div>
                <div><strong>Địa chỉ:</strong></div>
                <div><strong>Điện thoại:</strong> ${repair.sdt}</div>
                ${isInvoice ? `<div><strong>Thiết bị sửa chữa:</strong> ${repair.invoice?.device || repair.tenMay}</div>` : ''}
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th>Dịch vụ sửa chữa, thiết bị thay thế</th>
                        <th>Số lượng</th>
                        ${isInvoice ? '<th>Thành tiền</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${isInvoice
                        ? (repair.invoice?.services || []).map(line => `
                            <tr>
                                <td>${line.service}</td>
                                <td>${line.qty}</td>
                                <td>${Number(line.amount || 0).toLocaleString('vi-VN')}</td>
                            </tr>
                        `).join('')
                        : `
                            <tr>
                                <td>${repair.tenMay} - ${repair.moTaLoi}</td>
                                <td>1</td>
                            </tr>
                        `
                    }
                </tbody>
            </table>

            <div class="invoice-note">
                <strong>LƯU Ý QUAN TRỌNG:</strong><br>
                Quý khách vui lòng ký tên linh kiện hoặc chụp ảnh linh kiện ngay trước khi bàn giao máy.<br>
                Cửa hàng sẽ bàn giao máy dựa trên đối chiếu ký hiệu linh kiện hoặc ảnh đã lưu.
            </div>

            ${isInvoice ? `
            <div class="invoice-summary">
                <div><span>Tổng tiền hàng:</span><strong>${Number(repair.invoice?.subtotal || 0).toLocaleString('vi-VN')}</strong></div>
                <div><span>Chiết khấu:</span><strong>${Number(repair.invoice?.discount || 0).toLocaleString('vi-VN')}</strong></div>
                <div><span>Khách cần trả:</span><strong>${Number(repair.invoice?.total || 0).toLocaleString('vi-VN')}</strong></div>
            </div>
            ` : ''}

            <div class="invoice-status">
                <div><strong>Phương án xử lí:</strong> ${repair.phuongAnXuLi || '-'}</div>
                <div><strong>Tình trạng:</strong> ${repair.tinhTrang || '-'}</div>
                <div><strong>Ngày nhận:</strong> ${repair.ngayNhan || '-'}</div>
                <div><strong>Ngày trả:</strong> ${repair.ngayTra || '-'}</div>
                <div><strong>Ghi chú:</strong> ${repair.ghiChu || '-'}</div>
            </div>

            <div class="receipt-footer">
                <div class="signature">
                    <div>
                        <p>Khách hàng</p>
                        <hr>
                    </div>
                    <div>
                        <p>Kỹ thuật viên</p>
                        <hr>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    parseViDate(dateStr) {
        if (!dateStr) return null;
        const parts = String(dateStr).split('/');
        if (parts.length !== 3) return null;
        const [d, m, y] = parts.map(Number);
        if (!d || !m || !y) return null;
        return new Date(y, m - 1, d);
    }

    calcDayDiffFromNow(dateStr) {
        const date = this.parseViDate(dateStr);
        if (!date) return 0;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return Math.floor((today - base) / (1000 * 60 * 60 * 24));
    }

    renderSummaryCards() {
        const staleEl = document.getElementById('staleList');
        const todayEl = document.getElementById('todayList');
        if (!staleEl || !todayEl) return;

        const processing = this.repairs.filter(r => r.tinhTrang === 'Chưa xử lý' || r.tinhTrang === 'Đang xử lý');
        const stale = processing.filter(r => this.calcDayDiffFromNow(r.ngayNhan) >= 1);
        const today = processing.filter(r => this.calcDayDiffFromNow(r.ngayNhan) === 0);

        staleEl.innerHTML = stale.length
            ? stale.map(r => `<div class="summary-item"><div><strong>${r.tenKhach}</strong> - ${r.tenMay}</div><div class="summary-desc">${r.moTaLoi || '-'}</div><div class="summary-age">Tồn đọng ${this.calcDayDiffFromNow(r.ngayNhan)} ngày</div></div>`).join('')
            : '<div class="summary-empty">Không có máy tồn đọng.</div>';

        todayEl.innerHTML = today.length
            ? today.map(r => `<div class="summary-item"><div><strong>${r.tenKhach}</strong> - ${r.tenMay}</div><div class="summary-desc">${r.moTaLoi || '-'}</div></div>`).join('')
            : '<div class="summary-empty">Không có máy chưa xử lí trong ngày.</div>';
    }

    formatDateVN(dateObj) {
        return new Date(dateObj).toLocaleDateString('vi-VN');
    }

    showNotification(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
            color: white; padding: 15px 20px; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000;
            transform: translateX(400px); transition: transform 0.3s;
        `;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.transform = 'translateX(0)'; }, 100);
        setTimeout(() => {
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (document.body.contains(toast)) document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    window.repairManager = new RepairManager();
    await window.repairManager.init();
});
