class RepairManager {
    constructor() {
        this.repairs = [];
        this.searchKeyword = '';
        this.statusFilter = 'all';
        this.expandedRepairId = null;
        this.currentInvoiceServices = [];

        // Debug log theo yêu cầu
        console.log('Đã tìm thấy form:', !!document.getElementById('repairForm'));
        console.log('Đã tìm thấy bảng repairList:', !!document.getElementById('repairList'));
        console.log('Đã tìm thấy modal createModal:', !!document.getElementById('createModal'));
        console.log('Đã tìm thấy modal invoiceModal:', !!document.getElementById('invoiceModal'));
        console.log('Đã tìm thấy modal printModal:', !!document.getElementById('printModal'));
    }

    async init() {
        // 1) Ưu tiên hiển thị dữ liệu mẫu trước
        this.loadDummyData();
        this.renderTable();
        this.renderSummaryCards();

        // 2) Bind event an toàn
        this.bindEventsSafe();

        // 3) Gọi API, nếu có dữ liệu thật thì ghi đè
        await this.fetchRepairs();
        this.renderTable();
        this.renderSummaryCards();
    }

    loadDummyData() {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - 2);

        this.repairs = [
            {
                id: 1,
                ngayNhan: this.formatDateVN(today),
                tenKhach: 'Nguyễn Văn A',
                sdt: '0905000001',
                tenMay: 'Dell XPS 13',
                moTaLoi: 'Không lên nguồn',
                phuongAnXuLi: 'Xử lí tại cửa hàng',
                huongXuLyNoiBo: 'Thay linh kiện mới',
                tinhTrang: 'Chưa xử lý',
                ngayTra: null,
                ghiChu: 'Khách cần gấp',
                workNote: '',
                invoice: null
            },
            {
                id: 2,
                ngayNhan: this.formatDateVN(yesterday),
                tenKhach: 'Trần Thị B',
                sdt: '0905000002',
                tenMay: 'MacBook Pro 2019',
                moTaLoi: 'Nóng máy',
                phuongAnXuLi: 'Gửi trung tâm bảo hành',
                huongXuLyNoiBo: 'Gửi hãng',
                tinhTrang: 'Đang xử lý',
                ngayTra: null,
                ghiChu: 'Đã sao lưu dữ liệu',
                workNote: '',
                invoice: null
            },
            {
                id: 3,
                ngayNhan: this.formatDateVN(twoDaysAgo),
                tenKhach: 'Lê Văn C',
                sdt: '0905000003',
                tenMay: 'HP Pavilion',
                moTaLoi: 'Bể màn hình',
                phuongAnXuLi: 'Xử lí tại cửa hàng',
                huongXuLyNoiBo: 'Gửi bên thứ 3',
                tinhTrang: 'Chưa xử lý',
                ngayTra: null,
                ghiChu: '',
                workNote: '',
                invoice: null
            }
        ];
    }

    bindEventsSafe() {
        // Tất cả addEventListener đều bọc try/catch theo yêu cầu
        try {
            const form = document.getElementById('repairForm');
            form?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createRepair();
            });
        } catch (err) { console.error('Lỗi bind repairForm:', err); }

        try {
            document.getElementById('openCreateModal')?.addEventListener('click', () => this.openModal('createModal'));
            document.getElementById('fabCreate')?.addEventListener('click', () => this.openModal('createModal'));
        } catch (err) { console.error('Lỗi bind open create modal:', err); }

        try {
            document.getElementById('closeCreateModal')?.addEventListener('click', () => this.closeModal('createModal'));
            document.getElementById('cancelCreate')?.addEventListener('click', () => this.closeModal('createModal'));
        } catch (err) { console.error('Lỗi bind close create modal:', err); }

        try {
            const invoiceForm = document.getElementById('invoiceForm');
            invoiceForm?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveInvoiceAndPrint();
            });
        } catch (err) { console.error('Lỗi bind invoiceForm:', err); }

        try {
            document.getElementById('addInvoiceLine')?.addEventListener('click', () => this.addInvoiceService());
            document.getElementById('invoiceDiscount')?.addEventListener('input', () => this.calculateInvoiceTotal());
        } catch (err) { console.error('Lỗi bind invoice controls:', err); }

        try {
            document.getElementById('closeInvoiceModal')?.addEventListener('click', () => this.closeModal('invoiceModal'));
            document.getElementById('cancelInvoice')?.addEventListener('click', () => this.closeModal('invoiceModal'));
        } catch (err) { console.error('Lỗi bind close invoice modal:', err); }

        try {
            document.getElementById('closePrintIcon')?.addEventListener('click', () => this.closeModal('printModal'));
            document.getElementById('closePrint')?.addEventListener('click', () => this.closeModal('printModal'));
        } catch (err) { console.error('Lỗi bind close print modal:', err); }

        try {
            document.getElementById('searchInput')?.addEventListener('input', (e) => {
                this.searchKeyword = (e.target.value || '').trim().toLowerCase();
                this.renderTable();
            });
            document.getElementById('statusFilter')?.addEventListener('change', (e) => {
                this.statusFilter = e.target.value || 'all';
                this.renderTable();
            });
        } catch (err) { console.error('Lỗi bind search/filter:', err); }

        // Giữ nguyên fabTop
        try {
            document.getElementById('fabTop')?.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            window.addEventListener('scroll', () => {
                const fabTop = document.getElementById('fabTop');
                if (!fabTop) return;
                fabTop.style.opacity = window.scrollY > 150 ? '1' : '0';
                fabTop.style.pointerEvents = window.scrollY > 150 ? 'auto' : 'none';
            });
        } catch (err) { console.error('Lỗi bind fabTop:', err); }

        // Đóng modal khi click ra ngoài
        try {
            window.addEventListener('click', (event) => {
                const createModal = document.getElementById('createModal');
                const invoiceModal = document.getElementById('invoiceModal');
                const printModal = document.getElementById('printModal');

                if (event.target === createModal) this.closeModal('createModal');
                if (event.target === invoiceModal) this.closeModal('invoiceModal');
                if (event.target === printModal) this.closeModal('printModal');
            });
        } catch (err) { console.error('Lỗi bind window click:', err); }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'block';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    normalizeRepair(raw, fallbackId = 0) {
        const id = Number(raw?.id ?? raw?.repairId ?? fallbackId);
        const ngayNhanRaw = raw?.ngayNhan ?? raw?.receivedDate ?? raw?.createdAt ?? new Date();
        return {
            id: Number.isNaN(id) ? fallbackId : id,
            ngayNhan: this.normalizeDateToVN(ngayNhanRaw),
            tenKhach: raw?.tenKhach ?? raw?.customer ?? '',
            sdt: raw?.sdt ?? raw?.phone ?? '',
            tenMay: raw?.tenMay ?? raw?.device ?? '',
            moTaLoi: raw?.moTaLoi ?? raw?.problem ?? '',
            phuongAnXuLi: raw?.phuongAnXuLi ?? raw?.solution ?? 'Xử lí tại cửa hàng',
            huongXuLyNoiBo: raw?.huongXuLyNoiBo ?? raw?.internalDirection ?? 'Thay linh kiện mới',
            tinhTrang: raw?.tinhTrang ?? raw?.status ?? 'Chưa xử lý',
            ngayTra: raw?.ngayTra ?? raw?.returnDate ?? null,
            ghiChu: raw?.ghiChu ?? raw?.note ?? '',
            workNote: raw?.workNote ?? '',
            invoice: raw?.invoice ?? null
        };
    }

    async fetchRepairs() {
        try {
            console.log('Đang gọi API: GET /api/repairs');
            const res = await fetch('/api/repairs');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            console.log('Dữ liệu API nhận được:', data);

            if (Array.isArray(data) && data.length > 0) {
                this.repairs = data.map((item, idx) => this.normalizeRepair(item, idx + 1));
                console.log('Đã ghi đè dummy data bằng dữ liệu API');
            } else {
                console.log('API rỗng, giữ dữ liệu mẫu để hiển thị');
            }
        } catch (error) {
            console.error('fetchRepairs error:', error);
            console.log('Lỗi API, giữ dữ liệu mẫu');
        }
    }

    capitalizeVietnameseName(name) {
        return (name || '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    async createRepair() {
        try {
            const formData = {
                tenKhach: this.capitalizeVietnameseName(document.getElementById('tenKhach')?.value || ''),
                sdt: document.getElementById('sdt')?.value || '',
                tenMay: document.getElementById('tenMay')?.value || '',
                moTaLoi: document.getElementById('moTaLoi')?.value || '',
                phuongAnXuLi: document.getElementById('huongXuLy')?.value || '',
                huongXuLyNoiBo: 'Thay linh kiện mới',
                tinhTrang: 'Chưa xử lý',
                ghiChu: document.getElementById('ghiChu')?.value || '',
                workNote: ''
            };

            if (!this.validateForm(formData)) return;

            const res = await fetch('/api/repairs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${res.status}`);
            }

            const saved = await res.json();
            const savedRepair = this.normalizeRepair(saved, this.repairs.length + 1);

            await this.fetchRepairs();
            this.renderTable();
            this.renderSummaryCards();

            document.getElementById('repairForm')?.reset();
            this.closeModal('createModal');

            this.showPrintModal(savedRepair);
            this.showNotification('✅ Phiếu đã lưu và đồng bộ từ API!');
        } catch (error) {
            console.error('createRepair error:', error);
            this.showNotification(`❌ Lỗi lưu API: ${error.message}`, 'error');
        }
    }

    validateForm(data) {
        const required = ['tenKhach', 'sdt', 'tenMay', 'moTaLoi', 'phuongAnXuLi'];
        for (const field of required) {
            if (!data[field]) {
                this.showNotification('❌ Vui lòng điền đầy đủ thông tin bắt buộc!', 'error');
                return false;
            }
        }
        return true;
    }

    updateStatus(id, newStatus) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;

        repair.tinhTrang = newStatus;
        repair.ngayTra = newStatus === 'Đã trả máy' ? this.formatDateVN(new Date()) : null;

        this.renderTable();
        this.renderSummaryCards();
        this.showNotification('✅ Đã cập nhật tình trạng!');
    }

    toggleRepairDetails(id) {
        this.expandedRepairId = this.expandedRepairId === id ? null : id;
        this.renderTable();
    }

    updateRepairMethod(id, newMethod) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;
        repair.phuongAnXuLi = newMethod;
        this.showNotification('✅ Đã cập nhật phương án xử lí!');
    }

    updateInternalDirection(id, newDirection) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;
        repair.huongXuLyNoiBo = newDirection;
        this.showNotification('✅ Đã cập nhật hướng xử lí nội bộ!');
    }

    // Giữ logic ghi chú sửa chữa nội bộ
    saveRepairWorkNote(id) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;

        const noteEl = document.getElementById(`workNote-${id}`);
        if (!noteEl) return;

        repair.workNote = noteEl.value.trim();
        this.showNotification('✅ Đã lưu ghi chú sửa chữa!');
    }

    printTicket(id) {
        const repair = this.repairs.find(r => r.id === id);
        if (repair) this.showPrintModal(repair);
    }

    openInvoiceModal(id) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;

        const invoiceRepairId = document.getElementById('invoiceRepairId');
        const invoiceDiscount = document.getElementById('invoiceDiscount');
        const invoiceLines = document.getElementById('invoiceLines');
        const invoiceDevice = document.getElementById('invoiceDevice');
        const invoiceService = document.getElementById('invoiceService');
        const invoiceQty = document.getElementById('invoiceQty');
        const invoiceAmount = document.getElementById('invoiceAmount');

        if (invoiceRepairId) invoiceRepairId.value = id;
        if (invoiceDiscount) invoiceDiscount.value = repair.invoice?.discount || 0;
        if (invoiceLines) invoiceLines.innerHTML = '';
        if (invoiceDevice) invoiceDevice.value = repair.invoice?.device || repair.tenMay || '';
        if (invoiceService) invoiceService.value = '';
        if (invoiceQty) invoiceQty.value = 1;
        if (invoiceAmount) invoiceAmount.value = '';

        this.currentInvoiceServices = (repair.invoice?.services && repair.invoice.services.length)
            ? [...repair.invoice.services]
            : [];

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
            this.showNotification('❌ Vui lòng nhập đúng dịch vụ/thiết bị/số lượng/thành tiền!', 'error');
            return;
        }

        this.currentInvoiceServices.push({ service, device, qty, amount });
        this.renderInvoiceServices();
        this.calculateInvoiceTotal();

        const invoiceService = document.getElementById('invoiceService');
        const invoiceAmount = document.getElementById('invoiceAmount');
        const invoiceQty = document.getElementById('invoiceQty');

        if (invoiceService) invoiceService.value = '';
        if (invoiceAmount) invoiceAmount.value = '';
        if (invoiceQty) invoiceQty.value = 1;
        invoiceService?.focus();
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
                            <td><button type="button" class="btn-secondary mini-btn" onclick="repairManager.removeInvoiceService(${idx})">Xóa</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    calculateInvoiceTotal() {
        const subtotal = this.currentInvoiceServices.reduce((sum, row) => sum + (Number(row.qty) * Number(row.amount)), 0);
        const discount = Number(document.getElementById('invoiceDiscount')?.value || 0);
        const total = Math.max(0, subtotal - discount);

        const invoiceTotal = document.getElementById('invoiceTotal');
        if (invoiceTotal) invoiceTotal.value = total;
    }

    saveInvoiceAndPrint() {
        const id = Number(document.getElementById('invoiceRepairId')?.value);
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;

        const device = (document.getElementById('invoiceDevice')?.value || '').trim();
        const discount = Number(document.getElementById('invoiceDiscount')?.value || 0);
        const finalServices = [...this.currentInvoiceServices];

        const subtotal = finalServices.reduce((sum, l) => sum + (l.qty * l.amount), 0);
        const total = Math.max(0, subtotal - discount);

        if (!device || !finalServices.length || discount < 0) {
            this.showNotification('❌ Cần bấm "＋ Thêm dịch vụ" ít nhất 1 lần trước khi in!', 'error');
            return;
        }

        repair.invoice = { device, services: finalServices, discount, subtotal, total };
        this.closeModal('invoiceModal');
        this.showPrintModal(repair, true);
    }

    showPrintModal(repair, isInvoice = false) {
        const printContent = document.getElementById('printContent');
        if (!printContent || !repair) return;

        printContent.innerHTML = this.generatePrintHTML(repair, isInvoice);
        this.openModal('printModal');
    }

    generatePrintHTML(repair, isInvoice = false) {
        const today = this.formatDateVN(new Date());
        const maPhieu = `YCSC${String(repair.id ?? 0).padStart(4, '0')}`;

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
                        `}
                </tbody>
            </table>

            ${isInvoice ? `
            <div class="invoice-summary">
                <div><span>Tổng tiền hàng:</span><strong>${Number(repair.invoice?.subtotal || 0).toLocaleString('vi-VN')}</strong></div>
                <div><span>Chiết khấu:</span><strong>${Number(repair.invoice?.discount || 0).toLocaleString('vi-VN')}</strong></div>
                <div><span>Khách cần trả:</span><strong>${Number(repair.invoice?.total || 0).toLocaleString('vi-VN')}</strong></div>
            </div>
            ` : ''}

            <div class="invoice-status">
                <div><strong>Tình trạng:</strong> ${repair.tinhTrang}</div>
                <div><strong>Ngày nhận:</strong> ${repair.ngayNhan}</div>
                <div><strong>Ngày trả:</strong> ${repair.ngayTra || '-'}</div>
                <div><strong>Ghi chú:</strong> ${repair.ghiChu || '-'}</div>
            </div>
        </div>
        `;
    }

    getFilteredRepairs() {
        const keyword = this.searchKeyword;
        const status = this.statusFilter;

        return this.repairs.filter((repair) => {
            const matchKeyword = !keyword
                || (repair.tenKhach || '').toLowerCase().includes(keyword)
                || (repair.sdt || '').toLowerCase().includes(keyword)
                || (repair.tenMay || '').toLowerCase().includes(keyword);

            const matchStatus = status === 'all' || repair.tinhTrang === status;
            return matchKeyword && matchStatus;
        });
    }

    parseViDate(dateStr) {
        if (!dateStr) return null;
        const parts = String(dateStr).split('/');
        if (parts.length !== 3) return null;
        const [day, month, year] = parts.map(Number);
        if (!day || !month || !year) return null;
        return new Date(year, month - 1, day);
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

        const processing = this.repairs.filter(r =>
            r.tinhTrang === 'Chưa xử lý' || r.tinhTrang === 'Đang xử lý'
        );

        const staleItems = processing.filter(r => this.calcDayDiffFromNow(r.ngayNhan) > 1);
        const todayItems = processing.filter(r => this.calcDayDiffFromNow(r.ngayNhan) === 0);

        staleEl.innerHTML = staleItems.length
            ? staleItems.map(r => `
                <div class="summary-item clickable" onclick="repairManager.jumpToRepair(${r.id})">
                    <div><strong>${r.tenKhach}</strong> - ${r.tenMay}</div>
                    <div class="summary-desc">${r.moTaLoi || '-'}</div>
                    <div class="summary-age">Tồn đọng ${this.calcDayDiffFromNow(r.ngayNhan)} ngày</div>
                </div>
            `).join('')
            : '<div class="summary-empty">Không có máy tồn đọng.</div>';

        todayEl.innerHTML = todayItems.length
            ? todayItems.map(r => `
                <div class="summary-item clickable" onclick="repairManager.jumpToRepair(${r.id})">
                    <div><strong>${r.tenKhach}</strong> - ${r.tenMay}</div>
                    <div class="summary-desc">${r.moTaLoi || '-'}</div>
                </div>
            `).join('')
            : '<div class="summary-empty">Không có máy chưa xử lí trong ngày.</div>';
    }

    jumpToRepair(id) {
        this.searchKeyword = '';
        this.statusFilter = 'all';

        const searchInput = document.getElementById('searchInput');
        const statusFilter = document.getElementById('statusFilter');
        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = 'all';

        this.expandedRepairId = id;
        this.renderTable();

        setTimeout(() => {
            const row = document.querySelector(`tr.repair-row[onclick="repairManager.toggleRepairDetails(${id})"]`);
            if (!row) return;
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('jump-highlight');
            setTimeout(() => row.classList.remove('jump-highlight'), 1500);
        }, 50);
    }

    renderTable() {
        const tbody = document.getElementById('repairList');
        if (!tbody) return;

        const filteredRepairs = this.getFilteredRepairs();

        // Theo yêu cầu: luôn xóa nội dung cũ trước
        tbody.innerHTML = '';

        if (!filteredRepairs.length) {
            const noDataMsg = this.repairs.length === 0
                ? '📭 Chưa có phiếu nào. Tạo phiếu mới ở trên!'
                : '🔎 Không tìm thấy dữ liệu phù hợp bộ lọc/từ khóa.';
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:#7f8c8d;">${noDataMsg}</td></tr>`;
            return;
        }

        tbody.innerHTML = filteredRepairs.map(repair => {
            const shortNote = (repair.ghiChu || '').trim();
            const notePreview = shortNote ? (shortNote.length > 40 ? `${shortNote.slice(0, 40)}...` : shortNote) : '-';
            const isExpanded = this.expandedRepairId === repair.id;

            return `
            <tr class="repair-row ${isExpanded ? 'expanded' : ''}" onclick="repairManager.toggleRepairDetails(${repair.id})">
                <td><strong>#${String(repair.id).padStart(3, '0')}</strong></td>
                <td>${repair.ngayNhan}</td>
                <td>${repair.tenKhach}</td>
                <td>${repair.sdt}</td>
                <td>${repair.tenMay}</td>
                <td title="${(repair.ghiChu || '').replace(/"/g, '"')}">${notePreview}</td>
                <td>
                    <select onclick="event.stopPropagation()" onchange="repairManager.updateStatus(${repair.id}, this.value)" class="status-select">
                        <option value="Chưa xử lý" ${repair.tinhTrang === 'Chưa xử lý' ? 'selected' : ''}>⏳ Chưa xử lý</option>
                        <option value="Đang xử lý" ${repair.tinhTrang === 'Đang xử lý' ? 'selected' : ''}>🔄 Đang xử lý</option>
                        <option value="Đã xử lý" ${repair.tinhTrang === 'Đã xử lý' ? 'selected' : ''}>✅ Đã xử lý</option>
                        <option value="Đã trả máy" ${repair.tinhTrang === 'Đã trả máy' ? 'selected' : ''}>✨ Đã trả máy</option>
                    </select>
                </td>
                <td>${repair.ngayTra || '-'}</td>
                <td onclick="event.stopPropagation()">
                    <button onclick="repairManager.printTicket(${repair.id})" class="btn-print" title="In phiếu">🖨️</button>
                    <button onclick="repairManager.openInvoiceModal(${repair.id})" class="btn-secondary mini-btn" title="In hóa đơn">🧾</button>
                </td>
            </tr>
            ${isExpanded ? `
            <tr class="repair-detail-row">
                <td colspan="9">
                    <div class="repair-detail-box">
                        <div class="repair-detail-grid">
                            <div><strong>Mô tả lỗi:</strong> ${repair.moTaLoi || '-'}</div>
                            <div>
                                <strong>Phương án xử lí:</strong>
                                <select onclick="event.stopPropagation()" onchange="repairManager.updateRepairMethod(${repair.id}, this.value)" class="status-select" style="margin-left:8px;">
                                    <option value="Xử lí tại cửa hàng" ${repair.phuongAnXuLi === 'Xử lí tại cửa hàng' ? 'selected' : ''}>Xử lí tại cửa hàng</option>
                                    <option value="Gửi trung tâm bảo hành" ${repair.phuongAnXuLi === 'Gửi trung tâm bảo hành' ? 'selected' : ''}>Gửi trung tâm bảo hành</option>
                                </select>
                            </div>
                            <div>
                                <strong>Hướng xử lí (nội bộ):</strong>
                                <select onclick="event.stopPropagation()" onchange="repairManager.updateInternalDirection(${repair.id}, this.value)" class="status-select" style="margin-left:8px;">
                                    <option value="Thay linh kiện mới" ${(repair.huongXuLyNoiBo || 'Thay linh kiện mới') === 'Thay linh kiện mới' ? 'selected' : ''}>Thay linh kiện mới</option>
                                    <option value="Gửi bên thứ 3" ${repair.huongXuLyNoiBo === 'Gửi bên thứ 3' ? 'selected' : ''}>Gửi bên thứ 3</option>
                                    <option value="Gửi hãng" ${repair.huongXuLyNoiBo === 'Gửi hãng' ? 'selected' : ''}>Gửi hãng</option>
                                    <option value="Gửi chi nhánh khác" ${repair.huongXuLyNoiBo === 'Gửi chi nhánh khác' ? 'selected' : ''}>Gửi chi nhánh khác</option>
                                </select>
                            </div>
                            <div><strong>Ghi chú tiếp nhận:</strong> ${repair.ghiChu || '-'}</div>
                        </div>
                        <div class="work-note-block">
                            <label for="workNote-${repair.id}"><strong>Ghi chú sửa chữa (nội bộ):</strong></label>
                            <textarea id="workNote-${repair.id}" rows="3" placeholder="Nhập ghi chú quá trình sửa...">${repair.workNote || ''}</textarea>
                            <button type="button" class="btn-primary mini-btn" onclick="repairManager.saveRepairWorkNote(${repair.id})">💾 Lưu ghi chú sửa chữa</button>
                        </div>
                    </div>
                </td>
            </tr>
            ` : ''}
            `;
        }).join('');
    }

    formatDateVN(dateObj) {
        return new Date(dateObj).toLocaleDateString('vi-VN');
    }

    normalizeDateToVN(input) {
        if (!input) return this.formatDateVN(new Date());
        if (typeof input === 'string' && input.includes('/')) return input;
        const d = new Date(input);
        if (Number.isNaN(d.getTime())) return this.formatDateVN(new Date());
        return this.formatDateVN(d);
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

// Khởi tạo an toàn
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.repairManager = new RepairManager();
        window.repairManager.init();
    } catch (err) {
        console.error('Lỗi khởi tạo RepairManager:', err);
    }
});
