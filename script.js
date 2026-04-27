// QUẢN LÝ SỬA CHỮA LAPTOP - API + FORM IN THEO MẪU WINCARE24
class RepairManager {
    constructor() {
        this.API_BASE = '';
        this.repairs = [];
        this.searchKeyword = '';
        this.statusFilter = 'all';
        this.expandedRepairId = null;
        this.selectionMode = false;
        this.selectedRepairIds = new Set();
        this.selectionTimeMode = 'preset';
        this.selectionTimePreset = 'all';
        this.selectionDateFrom = '';
        this.selectionDateTo = '';
        this.currentInvoiceServices = [];
        this.currentPrintIsInvoice = false;
        this.rowsPerPage = 15;
        this.currentPage = 1;
        this.notes = [];
        this.noteCurrentPage = 1;
        this.noteRowsPerPage = 8;
        this.openNoteMenuId = null;
        this.editingNoteId = null; // Track which note is being edited
        this.STORAGE_KEY = 'wincare_repairs';
        this.BACKUP_URL = 'https://script.google.com/macros/s/AKfycbwbBLpp8ydoZ42e3Ivv6pevuUX6d8uVI478NE511oVkJHIyBExD34Q1Ct13IVFAKJSz/exec';
    }

    getLocalRepairs() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('getLocalRepairs error:', e);
            return [];
        }
    }

    saveLocalRepairs(repairs) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(repairs || []));
    }

    ensureLocalSeedData() {
        const existing = this.getLocalRepairs();
        if (existing.length) return existing;

        const now = new Date();
        const today = this.formatDateVN(now);
        const twoDaysAgo = this.formatDateVN(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2));
        const fourDaysAgo = this.formatDateVN(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4));

        const seed = [
            {
                id: 1,
                ngayNhan: today,
                tenKhach: 'Nguyễn Văn An',
                sdt: '0911111111',
                tenMay: 'Dell Inspiron 15',
                moTaLoi: 'Không lên nguồn',
                phuongAnXuLi: 'Xử lý tại cửa hàng',
                tinhTrang: 'Chưa xử lý',
                ngayTra: null,
                ghiChu: 'Khách cần gấp',
                workNote: '',
                invoice: null
            },
            {
                id: 2,
                ngayNhan: twoDaysAgo,
                tenKhach: 'Trần Thị Bình',
                sdt: '0922222222',
                tenMay: 'HP Pavilion',
                moTaLoi: 'Nóng máy, quạt kêu to',
                phuongAnXuLi: 'Xử lý tại cửa hàng',
                tinhTrang: 'Đang xử lý',
                ngayTra: null,
                ghiChu: '',
                workNote: '',
                invoice: null
            },
            {
                id: 3,
                ngayNhan: fourDaysAgo,
                tenKhach: 'Lê Minh Cường',
                sdt: '0933333333',
                tenMay: 'MacBook Pro 2019',
                moTaLoi: 'Bàn phím liệt vài nút',
                phuongAnXuLi: 'Gửi trung tâm bảo hành',
                tinhTrang: 'Chưa xử lý',
                ngayTra: null,
                ghiChu: 'Đã kiểm tra ngoại quan',
                workNote: '',
                invoice: null
            }
        ];

        this.saveLocalRepairs(seed);
        return seed;
    }

    async apiRequest(url, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data !== null) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        const text = await response.text();
        let json = null;

        if (text) {
            try {
                json = JSON.parse(text);
            } catch (e) {
                json = text;
            }
        }

        if (!response.ok) {
            const errorMessage = (json && json.message) ? json.message : `HTTP ${response.status}`;
            throw new Error(errorMessage);
        }

        return json;
    }

    getNextLocalId(list = this.repairs) {
        const ids = (list || []).map(r => Number(r?.id) || 0);
        return ids.length ? Math.max(...ids) + 1 : 1;
    }

    async init() {
        this.bindEvents();
        await this.fetchRepairs();
        await this.fetchNotes();
        this.renderTable();
        this.renderSummaryCards();
        this.renderNotes();
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
        document.getElementById('invoiceDiscount')?.addEventListener('input', (e) => {
            this.formatCurrencyInput(e.target);
            this.calculateInvoiceTotal();
            this.persistCurrentInvoiceDraft();
        });
        document.getElementById('invoiceDevice')?.addEventListener('input', () => this.persistCurrentInvoiceDraft());
        document.getElementById('invoiceAmount')?.addEventListener('input', (e) => {
            this.formatCurrencyInput(e.target);
        });
        document.getElementById('closeInvoiceModal')?.addEventListener('click', () => this.closeModal('invoiceModal'));
        document.getElementById('cancelInvoice')?.addEventListener('click', () => this.closeModal('invoiceModal'));

        document.getElementById('closePrintIcon')?.addEventListener('click', () => this.closeModal('printModal'));
        document.getElementById('closePrint')?.addEventListener('click', () => this.closeModal('printModal'));
        document.getElementById('confirmPrint')?.addEventListener('click', () => this.printCurrentDocument());

        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.searchKeyword = (e.target.value || '').trim().toLowerCase();
            this.currentPage = 1;
            this.renderTable();
        });
        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            this.statusFilter = e.target.value || 'all';
            this.currentPage = 1;
            this.renderTable();
        });
        const noteInput = document.getElementById('noteInput');
        const noteList = document.getElementById('noteList');

        // NOTE LIST: Click delegation
        noteList?.addEventListener('click', async (e) => {
            const target = e.target;
            const item = target.closest('.note-item');

            // ❌ DELETE NOTE
            if (target.classList.contains('note-delete')) {
                const id = target.dataset.id;
                if (id) {
                    await this.deleteNote(id);
                }
                return;
            }

            // ✏️ EDIT NOTE (click on text area)
            if (target.closest('.note-text') && item) {
                const id = item.dataset.id;
                // Always allow switching to another note
                if (id) {
                    this.startEditingNote(id);
                }
            }
        });

        // EDIT INPUT: Event delegation for Enter key and blur
        noteList?.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('note-edit-input') && e.key === 'Enter') {
                e.preventDefault();
                this.saveEditNote(e.target);
            }
        });

        noteList?.addEventListener('blur', (e) => {
            if (e.target.classList.contains('note-edit-input')) {
                this.saveEditNote(e.target);
            }
        }, true);

        // ADD NEW NOTE
        if (noteInput) {
            noteInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    await this.addNoteFromInput(noteInput);
                }
            });

            noteInput.addEventListener('blur', async () => {
                await this.addNoteFromInput(noteInput);
            });
        }
        document.getElementById('rowsPerPageSelect')?.addEventListener('change', (e) => {
            const nextRows = Number(e.target.value) || 15;
            this.rowsPerPage = [15, 30, 50].includes(nextRows) ? nextRows : 15;
            this.currentPage = 1;
            this.renderTable();
        });
        document.getElementById('prevPageBtn')?.addEventListener('click', () => {
            this.currentPage = Math.max(1, this.currentPage - 1);
            this.renderTable();
        });
        document.getElementById('nextPageBtn')?.addEventListener('click', () => {
            const totalItems = this.getFilteredRepairs().length;
            const totalPages = Math.max(1, Math.ceil(totalItems / this.rowsPerPage));
            this.currentPage = Math.min(totalPages, this.currentPage + 1);
            this.renderTable();
        });
        document.getElementById('toggleSelectMode')?.addEventListener('click', () => {
            this.toggleSelectionMode();
        });
        document.getElementById('deleteSelectedBtn')?.addEventListener('click', async () => {
            await this.deleteSelectedRepairs();
        });
        document.getElementById('selectAllRepairs')?.addEventListener('change', (e) => {
            this.toggleSelectAllFiltered(e.target.checked);
        });
       document.getElementById('timePresetFilter')?.addEventListener('change', (e) => {
    this.selectionTimePreset = e.target.value || 'all';

    // 🔥 XÓA ngày custom
    this.selectionDateFrom = '';
    this.selectionDateTo = '';

    const fromInput = document.getElementById('customDateFrom');
    const toInput = document.getElementById('customDateTo');

    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';

    this.currentPage = 1;
    this.renderTable();
});
       document.getElementById('customDateFrom')?.addEventListener('change', (e) => {
    this.selectionDateFrom = e.target.value || '';

    // 🔥 RESET preset về ALL
    this.selectionTimePreset = 'all';

    const preset = document.getElementById('timePresetFilter');
    if (preset) preset.value = 'all';

    this.currentPage = 1;
    this.renderTable();
});
        document.getElementById('customDateTo')?.addEventListener('change', (e) => {
   this.selectionDateTo = e.target.value || '';

    // 🔥 RESET preset về ALL
    this.selectionTimePreset = 'all';

    const preset = document.getElementById('timePresetFilter');
    if (preset) preset.value = 'all';

    this.currentPage = 1;
    this.renderTable();
});

        document.getElementById('staleList')?.addEventListener('click', (e) => {
            const item = e.target.closest('.summary-item[data-repair-id]');
            if (!item) return;
            this.jumpToRepair(Number(item.dataset.repairId));
        });

        document.getElementById('todayList')?.addEventListener('click', (e) => {
            const item = e.target.closest('.summary-item[data-repair-id]');
            if (!item) return;
            this.jumpToRepair(Number(item.dataset.repairId));
        });

        document.getElementById('fabTop')?.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        document.getElementById('notePrevBtn')?.addEventListener('click', () => {
            this.noteCurrentPage = Math.max(1, this.noteCurrentPage - 1);
            this.renderNotes();
        });
        document.getElementById('noteNextBtn')?.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(this.notes.length / this.noteRowsPerPage));
            this.noteCurrentPage = Math.min(totalPages, this.noteCurrentPage + 1);
            this.renderNotes();
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

            if (!event.target.closest('.note-actions')) {
                this.openNoteMenuId = null;
                this.renderNotes();
            }
        });
        document.getElementById('clearFilterBtn')?.addEventListener('click', () => {

    // 🔥 RESET STATE
    this.selectionTimePreset = 'all';
    this.selectionDateFrom = '';
    this.selectionDateTo = '';

    // 🔥 RESET UI
    const preset = document.getElementById('timePresetFilter');
    const from = document.getElementById('customDateFrom');
    const to = document.getElementById('customDateTo');

    if (preset) preset.value = 'all';
    if (from) from.value = '';
    if (to) to.value = '';

    // 🔥 RESET PAGE + RENDER
    this.currentPage = 1;
    this.renderTable();
});
    }

    async fetchNotes() {
        try {
            const data = await this.apiRequest(`${this.API_BASE}/api/notes?limit=200&page=1`, 'GET');
            this.notes = Array.isArray(data?.items) ? data.items : [];
        } catch (error) {
            console.error('fetchNotes error:', error);
            this.notes = [];
        }
    }

    formatDateTimeVN(input) {
        const d = new Date(input);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleString('vi-VN');
    }

    async createNote() {
        const content = window.prompt('Nhập nội dung note/checklist:');
        if (content === null) return;
        const trimmed = String(content || '').trim();
        if (!trimmed) {
            this.showNotification('❌ Nội dung note không được để trống', 'error');
            return;
        }

        try {
            const created = await this.apiRequest(`${this.API_BASE}/api/notes`, 'POST', { content: trimmed });
            this.notes = [created, ...this.notes];
            this.noteCurrentPage = 1;
            this.renderNotes();
            this.showNotification('✅ Đã thêm note');
        } catch (error) {
            console.error('createNote error:', error);
            this.showNotification(`❌ Lỗi thêm note: ${error.message}`, 'error');
        }
        
    }
    async addNoteFromInput(input) {
    const value = input.value.trim();
    if (!value) return;

    try {
        const created = await this.apiRequest(`${this.API_BASE}/api/notes`, 'POST', {
            content: value
        });

        this.notes = [created, ...this.notes];

        input.value = '';

        this.renderNotes();
    } catch (error) {
        console.error(error);
    }
}
    async editNote(id) {
        const note = this.notes.find((n) => Number(n.id) === Number(id));
        if (!note) return;

        const next = window.prompt('Sửa nội dung note:', note.content || '');
        if (next === null) return;
        const trimmed = String(next || '').trim();
        if (!trimmed) {
            this.showNotification('❌ Nội dung note không được để trống', 'error');
            return;
        }

        try {
            const updated = await this.apiRequest(`${this.API_BASE}/api/notes/${id}`, 'PUT', { content: trimmed });
            this.notes = this.notes.map((n) => (Number(n.id) === Number(id) ? updated : n));
            this.openNoteMenuId = null;
            this.renderNotes();
            this.showNotification('✅ Đã cập nhật note');
        } catch (error) {
            console.error('editNote error:', error);
            this.showNotification(`❌ Lỗi sửa note: ${error.message}`, 'error');
        }
    }

    async deleteNote(id) {
        const ok = window.confirm('Bạn có chắc muốn xóa note này?');
        if (!ok) return;

        // Cancel editing if deleting the editing note
        if (this.editingNoteId == id) {
            this.editingNoteId = null;
        }

        try {
            await this.apiRequest(`${this.API_BASE}/api/notes/${id}`, 'DELETE');
            this.notes = this.notes.filter((n) => Number(n.id) !== Number(id));
            const totalPages = Math.max(1, Math.ceil(this.notes.length / this.noteRowsPerPage));
            if (this.noteCurrentPage > totalPages) this.noteCurrentPage = totalPages;
            this.openNoteMenuId = null;
            this.renderNotes();
            this.showNotification('✅ Đã xóa note khỏi SQL');
        } catch (error) {
            console.error('deleteNote error:', error);
            this.showNotification(`❌ Lỗi xóa note: ${error.message}`, 'error');
        }
    }

    renderNotes() {
        const listEl = document.getElementById('noteList');
        if (!listEl) return;

        if (!this.notes || this.notes.length === 0) {
            listEl.innerHTML = '<div class="summary-empty">Chưa có note nào.</div>';
            return;
        }

        listEl.innerHTML = this.notes.map(note => {
            const isEditing = this.editingNoteId == note.id;
            return `
            <div class="note-item" data-id="${note.id}">
                <div class="note-dot"></div>
                ${isEditing
                    ? `<input type="text" class="note-edit-input" data-id="${note.id}" value="${this.escapeHtml(note.content || '')}" />`
                    : `<span class="note-text">${this.escapeHtml(note.content || '')}</span>`
                }
                <button class="note-delete" data-id="${note.id}">×</button>
            </div>
        `}).join('');

        // Focus the edit input if editing
        if (this.editingNoteId) {
            const editInput = listEl.querySelector('.note-edit-input');
            if (editInput) {
                editInput.focus();
                editInput.setSelectionRange(editInput.value.length, editInput.value.length);
            }
        }
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Start editing a note
    startEditingNote(id) {
        this.editingNoteId = Number(id);
        this.renderNotes();
    }

    // Save editing note (called by Enter key or blur)
    async saveEditNote(inputEl) {
        if (!inputEl) return;
        const id = inputEl.dataset.id;
        const value = inputEl.value.trim();
if (!value) {
            this.editingNoteId = null;
            this.renderNotes();
            return;
        }
        // Quick local update
        this.notes = this.notes.map(n =>
            Number(n.id) === Number(id) ? { ...n, content: value } : n
        );
        this.editingNoteId = null;
        this.renderNotes();

        // API sync
        try {
            await this.apiRequest(`${this.API_BASE}/api/notes/${id}`, 'PUT', { content: value });
            this.showNotification('✅ Đã cập nhật note');
        } catch (error) {
            console.error('saveEditNote error:', error);
            // Revert on error
            await this.fetchNotes();
            this.showNotification(`❌ Lỗi cập nhật: ${error.message}`, 'error');
        }
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
            phuongAnXuLi: row?.phuongAnXuLi || 'Xử lý tại cửa hàng',
            tinhTrang: row?.tinhTrang || 'Chưa xử lý',
            ngayTra: row?.ngayTra || null,
            ghiChu: row?.ghiChu || '',
            workNote: row?.workNote || '',
            invoice: row?.invoice || null,
            invoiceDraft: row?.invoiceDraft || null
        };
    }

    async fetchRepairs() {
        try {
            const localById = new Map(this.getLocalRepairs().map((r) => [Number(r?.id), r]));
            const data = await this.apiRequest(`${this.API_BASE}/api/repairs`, 'GET');
            this.repairs = Array.isArray(data)
                ? data.map((r, idx) => {
                    const normalized = this.normalizeRepair(r, idx + 1);
                    const local = localById.get(Number(normalized.id));
                    if (local?.invoice) normalized.invoice = local.invoice;
                    if (local?.invoiceDraft) normalized.invoiceDraft = local.invoiceDraft;
                    return normalized;
                })
                : [];
            this.saveLocalRepairs(this.repairs);
        } catch (error) {
            console.error('fetchRepairs error:', error);
            this.showNotification('⚠️ Đang dùng dữ liệu offline', 'error');
            try {
                const data = this.getLocalRepairs();
                this.repairs = Array.isArray(data)
                    ? data.map((r, idx) => this.normalizeRepair(r, idx + 1))
                    : [];
            } catch (fallbackError) {
                console.error('fetchRepairs fallback error:', fallbackError);
                this.repairs = [];
                this.showNotification('❌ Không tải được dữ liệu', 'error');
            }
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
                tinhTrang: 'Chưa xử lý',
                ngayTra: null,
                ghiChu: (document.getElementById('ghiChu')?.value || '').trim(),
                workNote: ''
            };

            if (!this.validateForm(payload)) return;

            let saved;
            try {
                const created = await this.apiRequest(`${this.API_BASE}/api/repairs`, 'POST', payload);
                saved = this.normalizeRepair(created, Number(created?.id) || this.getNextLocalId(this.repairs));
            } catch (apiError) {
                console.error('submitForm API error:', apiError);
                this.showNotification('⚠️ Đang dùng dữ liệu offline', 'error');
                const nextId = this.getNextLocalId(this.repairs);
                saved = this.normalizeRepair({ ...payload, id: nextId }, nextId);
            }

            this.repairs = [saved, ...this.repairs];
            this.saveLocalRepairs(this.repairs);

            this.renderTable();
            this.renderSummaryCards();

            document.getElementById('repairForm')?.reset();
            this.closeModal('createModal');
            this.showNotification('✅ Tạo phiếu thành công');
            this.showPrintModal(saved, false);
            setTimeout(() => {
                this.backupToDrive(saved);
            }, 0);
        } catch (error) {
            console.error('submitForm error:', error);
            this.showNotification(`❌ Lỗi lưu dữ liệu: ${error.message}`, 'error');
        }
    }

    toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;
        this.selectedRepairIds.clear();
        this.expandedRepairId = null;
        if (this.selectionMode) {
            this.searchKeyword = '';
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
        }
        this.renderSelectionPanel();
        this.fixSelectionPanelText();
        this.renderTable();
    }

    fixSelectionPanelText() {
        const panel = document.getElementById('batchSelectPanel');
        const toggleBtn = document.getElementById('toggleSelectMode');
        const deleteBtn = document.getElementById('deleteSelectedBtn');
        const selectedCountText = document.getElementById('selectedCountText');
        const selectAll = document.getElementById('selectAllRepairs');
        const presetSelect = document.getElementById('timePresetFilter');

        panel?.querySelector('.batch-select-head strong')?.replaceChildren(document.createTextNode('Bảng chọn'));
        if (toggleBtn) toggleBtn.textContent = this.selectionMode ? 'Hủy chọn' : 'Chọn';
        if (deleteBtn) deleteBtn.textContent = 'Xóa đã chọn';
        if (selectedCountText) {
            selectedCountText.textContent = this.selectedRepairIds.size
                ? `Đã chọn ${this.selectedRepairIds.size} phiếu`
                : 'Chưa chọn phiếu nào';
        }
        if (selectAll) selectAll.setAttribute('aria-label', 'Chọn tất cả');

        const labels = panel?.querySelectorAll('.batch-filter-group > label');
        if (labels?.[0]) labels[0].textContent = 'Kiểu thời gian';
        if (labels?.[1]) labels[1].textContent = 'Chọn khung thời gian';
        if (labels?.[2]) labels[2].textContent = 'Khoảng ngày cụ thể';

        const radioSpans = panel?.querySelectorAll('.radio-chip span');
        if (radioSpans?.[0]) radioSpans[0].textContent = 'Khung sẵn';
        if (radioSpans?.[1]) radioSpans[1].textContent = 'Tùy chọn ngày';

        if (presetSelect) {
            const texts = {
                all: 'Toàn thời gian',
                today: 'Hôm nay',
                yesterday: 'Hôm qua',
                thisWeek: 'Tuần này',
                lastWeek: 'Tuần trước',
                last7days: '7 ngày qua',
                thisMonth: 'Tháng này',
                lastMonth: 'Tháng trước',
                last30days: '30 ngày qua',
                thisYear: 'Năm nay',
                lastYear: 'Năm trước'
            };
            [...presetSelect.options].forEach((option) => {
                option.textContent = texts[option.value] || option.textContent;
            });
        }
    }

    renderSelectionPanel() {
        const searchItem = document.getElementById('searchFilterItem');
        const panel = document.getElementById('batchSelectPanel');
        const toggleBtn = document.getElementById('toggleSelectMode');
        const deleteBtn = document.getElementById('deleteSelectedBtn');
        const selectedCountText = document.getElementById('selectedCountText');
        const selectHead = document.getElementById('selectColumnHead');
        const presetGroup = document.getElementById('presetFilterGroup');
        const customGroup = document.getElementById('customDateGroup');
        const selectAll = document.getElementById('selectAllRepairs');
        const presetSelect = document.getElementById('timePresetFilter');
        const dateFrom = document.getElementById('customDateFrom');
        const dateTo = document.getElementById('customDateTo');

        if (searchItem) searchItem.classList.toggle('hidden', this.selectionMode);
        if (panel) panel.classList.toggle('hidden', !this.selectionMode);
        if (toggleBtn) {
            toggleBtn.textContent = this.selectionMode ? 'Há»§y chá»n' : 'Chá»n';
            toggleBtn.className = this.selectionMode ? 'btn-danger' : 'btn-secondary';
        }
        if (deleteBtn) deleteBtn.disabled = this.selectedRepairIds.size === 0;
        if (selectedCountText) {
            selectedCountText.textContent = this.selectedRepairIds.size
                ? `ÄÃ£ chá»n ${this.selectedRepairIds.size} phiáº¿u`
                : 'ChÆ°a chá»n phiáº¿u nÃ o';
        }
        if (selectHead) selectHead.classList.toggle('hidden', !this.selectionMode);
        if (presetGroup) presetGroup.classList.toggle('hidden', this.selectionTimeMode !== 'preset');
        if (customGroup) customGroup.classList.toggle('hidden', this.selectionTimeMode !== 'custom');
        if (presetSelect) presetSelect.value = this.selectionTimePreset;
        if (dateFrom) dateFrom.value = this.selectionDateFrom;
        if (dateTo) dateTo.value = this.selectionDateTo;
        if (selectAll) {
            const filtered = this.getFilteredRepairs();
            selectAll.checked = filtered.length > 0 && filtered.every((repair) => this.selectedRepairIds.has(repair.id));
        }
        this.fixSelectionPanelText();
    }

    toInputDateValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // getDateRangeForSelectionFilter() {
    // const now = new Date();
    // const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // // 🔥 ƯU TIÊN CUSTOM
    // if (this.selectionTimeMode === 'custom') {
    //     const from = this.selectionDateFrom
    //         ? new Date(this.selectionDateFrom + 'T00:00:00')
    //         : null;

    //     const to = this.selectionDateTo
    //         ? new Date(this.selectionDateTo + 'T23:59:59')
    //         : null;

    //     return { from, to };
    // }

    //     switch (this.selectionTimePreset) {
    //     case 'today':
    //         return { from: today, to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59) };
    //     case 'yesterday': {
    //         const from = new Date(today);
    //         from.setDate(from.getDate() - 1);
    //         return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate(), 23, 59, 59) };
    //     }
    //     case 'thisWeek': {
    //         const day = today.getDay() || 7;
    //         const from = new Date(today);
    //         from.setDate(today.getDate() - day + 1);
    //         return { from, to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59) };
    //     }
    //     case 'lastWeek': {
    //         const day = today.getDay() || 7;
    //         const end = new Date(today);
    //         end.setDate(today.getDate() - day);
    //         const from = new Date(end);
    //         from.setDate(end.getDate() - 6);
    //         return { from, to: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59) };
    //     }
    //     case 'last7days': {
    //         const from = new Date(today);
    //         from.setDate(today.getDate() - 6);
    //         return { from, to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59) };
    //     }
    //     case 'thisMonth':
    //         return {
    //             from: new Date(today.getFullYear(), today.getMonth(), 1),
    //             to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
    //         };
    //     case 'lastMonth': {
    //         const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    //         const to = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    //         return { from, to };
    //     }
    //     case 'last30days': {
    //         const from = new Date(today);
    //         from.setDate(today.getDate() - 29);
    //         return { from, to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59) };
    //     }
    //     case 'thisYear':
    //         return {
    //             from: new Date(today.getFullYear(), 0, 1),
    //             to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
    //         };
    //     case 'lastYear':
    //         return {
    //             from: new Date(today.getFullYear() - 1, 0, 1),
    //             to: new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59)
    //         };
    //     default:
    //         return { from: null, to: null };
    //     }
    // }
getDateRangeForSelectionFilter() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let from = null;
    let to = null;

    // 🔥 ƯU TIÊN DATE CUSTOM
    if (this.selectionDateFrom || this.selectionDateTo) {
        from = this.selectionDateFrom
            ? new Date(this.selectionDateFrom + 'T00:00:00')
            : null;

        to = this.selectionDateTo
            ? new Date(this.selectionDateTo + 'T23:59:59')
            : null;

        return { from, to };
    }

    switch (this.selectionTimePreset) {

        case 'today':
            from = today;
            to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
            break;

        case 'yesterday':
            from = new Date(today);
            from.setDate(today.getDate() - 1);
            to = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 23, 59, 59);
            break;

        case 'thisWeek': {
            const day = today.getDay() || 7; // CN = 7
            from = new Date(today);
            from.setDate(today.getDate() - day + 1);
            to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
            break;
        }

        case 'lastWeek': {
            const day = today.getDay() || 7;
            from = new Date(today);
            from.setDate(today.getDate() - day - 6);
            to = new Date(today);
            to.setDate(today.getDate() - day);
            to.setHours(23, 59, 59);
            break;
        }

        case 'last7days':
            from = new Date(today);
            from.setDate(today.getDate() - 6);
            to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
            break;

        case 'thisMonth':
            from = new Date(today.getFullYear(), today.getMonth(), 1);
            to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
            break;

        case 'lastMonth':
            from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            to = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
            break;

        case 'last30days':
            from = new Date(today);
            from.setDate(today.getDate() - 29);
            to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
            break;

        case 'thisYear':
            from = new Date(today.getFullYear(), 0, 1);
            to = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
            break;

        case 'lastYear':
            from = new Date(today.getFullYear() - 1, 0, 1);
            to = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59);
            break;

        default:
            from = null;
            to = null;
    }

    return { from, to };
}
    matchesSelectionDateFilter(repair) {
    // ❌ BỎ DÒNG NÀY
    // if (!this.selectionMode) return true;

    const repairDate = this.parseViDate(repair.ngayNhan);
    if (!repairDate) return false;

    const { from, to } = this.getDateRangeForSelectionFilter();

    if (from && repairDate < from) return false;
    if (to && repairDate > to) return false;

    return true;
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
            const matchDate = this.matchesSelectionDateFilter(r);
            return matchKeyword && matchStatus && matchDate;
        });
    }

    renderPagination(totalItems, pageItemsCount) {
        const rowsSelect = document.getElementById('rowsPerPageSelect');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const infoEl = document.getElementById('paginationInfo');
        const pageIndicator = document.getElementById('pageIndicator');

        if (rowsSelect) rowsSelect.value = String(this.rowsPerPage);

        const totalPages = Math.max(1, Math.ceil(totalItems / this.rowsPerPage));
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const start = totalItems === 0 ? 0 : ((this.currentPage - 1) * this.rowsPerPage) + 1;
        const end = totalItems === 0 ? 0 : (start + pageItemsCount - 1);

        if (prevBtn) prevBtn.disabled = this.currentPage <= 1 || totalItems === 0;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages || totalItems === 0;
        if (pageIndicator) pageIndicator.textContent = `Trang ${this.currentPage}/${totalPages}`;
        if (infoEl) infoEl.textContent = `Hiển thị ${start}-${end} của tổng ${totalItems} dòng`;
    }

    renderTable() {
        const tbody = document.getElementById('repairList');
        if (!tbody) return;

        const filteredList = this.getFilteredRepairs();
        const totalItems = filteredList.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.rowsPerPage));
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        const list = filteredList.slice(startIndex, endIndex);

        const colspan = this.selectionMode ? 9 : 8;
        tbody.innerHTML = '';

        if (!filteredList.length) {
            tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;padding:24px;color:#7f8c8d;">Không có dữ liệu</td></tr>`;
            this.renderPagination(0, 0);
            this.renderSelectionPanel();
            this.fixSelectionPanelText();
            return;
        }

        tbody.innerHTML = list.map((repair) => {
            const isExpanded = this.expandedRepairId === repair.id;
            const notePreview = (repair.ghiChu || '').trim() || '-';
            const checked = this.selectedRepairIds.has(repair.id) ? 'checked' : '';
            return `
            <tr class="repair-row ${isExpanded ? 'expanded' : ''}" data-id="${repair.id}">
                ${this.selectionMode ? `
                <td class="select-cell">
                    <input type="checkbox" class="select-bullet" data-select-id="${repair.id}" ${checked} aria-label="Chọn phiếu ${repair.id}">
                </td>` : ''}
                <td><strong>#${String(repair.id).padStart(3, '0')}</strong></td>
                <td>${repair.ngayNhan}</td>
                <td>${repair.tenKhach}</td>
                <td>${repair.sdt}</td>
                <td>${repair.tenMay}</td>
                <td>${notePreview}</td>
                <td class="status-cell">
                    <select class="status-select" data-status-id="${repair.id}">
                        <option value="Chưa xử lý" ${repair.tinhTrang === 'Chưa xử lý' ? 'selected' : ''}>Chưa xử lý</option>
                        <option value="Đang xử lý" ${repair.tinhTrang === 'Đang xử lý' ? 'selected' : ''}>Đang xử lý</option>
                        <option value="Đã xử lý" ${repair.tinhTrang === 'Đã xử lý' ? 'selected' : ''}>Đã xử lý</option>
                        <option value="Đã trả máy" ${repair.tinhTrang === 'Đã trả máy' ? 'selected' : ''}>Đã trả máy</option>
                    </select>
                </td>
                <td class="return-date-cell">${repair.ngayTra || '-'}</td>
            </tr>
            ${isExpanded ? `
            <tr class="repair-detail-row">
                <td colspan="${colspan}">
                    <div class="repair-detail-box">
                        <div class="repair-detail-grid">
                            <div><strong>Mô tả lỗi:</strong> ${repair.moTaLoi || '-'}
                            </div>
                            <div><strong>Phương án xử lí:</strong> ${repair.phuongAnXuLi || '-'}
                            </div>
                            <div><strong>Ghi chú tiếp nhận:</strong> ${repair.ghiChu || '-'}
                            </div>
                        </div>
                        <div class="work-note-block">
                            <label for="workNote-${repair.id}"><strong>Ghi chú sửa chữa (nội bộ):</strong></label>
                            <textarea id="workNote-${repair.id}" rows="3" placeholder="Nhập ghi chú quá trình sửa...">${repair.workNote || ''}</textarea>
                            <div class="detail-actions-row">
                                <button type="button" class="btn-print btn-action-print" data-id="${repair.id}" title="In phiếu">🖨️ In phiếu</button>
                                <button type="button" class="btn-secondary btn-action-invoice" data-id="${repair.id}" title="Hóa đơn">🧾 In hóa đơn</button>
                                <button type="button" class="btn-primary" data-save-note="${repair.id}">💾 Lưu ghi chú sửa chữa</button>
                            </div>
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
                if (this.selectionMode) return;
                const id = Number(row.dataset.id);
                this.toggleRepairDetails(id);
            });
        });

        tbody.querySelectorAll('[data-select-id]').forEach((checkbox) => {
            checkbox.addEventListener('click', (e) => e.stopPropagation());
            checkbox.addEventListener('change', () => {
                const id = Number(checkbox.dataset.selectId);
                if (checkbox.checked) this.selectedRepairIds.add(id);
                else this.selectedRepairIds.delete(id);
                this.renderSelectionPanel();
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

        tbody.querySelectorAll('.status-select').forEach((selectEl) => {
            selectEl.addEventListener('click', (e) => e.stopPropagation());
            selectEl.addEventListener('change', async (e) => {
                const id = Number(selectEl.dataset.statusId);
                const newStatus = e.target.value;
                await this.updateRepairStatus(id, newStatus);
            });
        });
        this.renderPagination(totalItems, list.length);
        this.renderSelectionPanel();
        this.fixSelectionPanelText();
    }

    toggleSelectAllFiltered(checked) {
        const list = this.getFilteredRepairs();
        if (checked) {
            list.forEach((repair) => this.selectedRepairIds.add(repair.id));
        } else {
            list.forEach((repair) => this.selectedRepairIds.delete(repair.id));
        }
        this.renderTable();
    }

    async deleteSelectedRepairs() {
        const ids = [...this.selectedRepairIds];
        if (!ids.length) {
            this.showNotification('Khong co phieu nao duoc chon', 'error');
            return;
        }

        const confirmed = window.confirm(`Ban co chac muon xoa ${ids.length} phieu da chon?`);
        if (!confirmed) return;

        try {
            await this.apiRequest(`${this.API_BASE}/api/repairs`, 'DELETE', { ids });
            this.repairs = this.repairs.filter((repair) => !this.selectedRepairIds.has(repair.id));
            this.selectedRepairIds.clear();
            this.expandedRepairId = null;
            this.saveLocalRepairs(this.repairs);
            this.renderTable();
            this.renderSummaryCards();
            this.showNotification('Da xoa cac phieu da chon');
        } catch (error) {
            console.error('deleteSelectedRepairs error:', error);
            this.showNotification(`Loi xoa du lieu: ${error.message}`, 'error');
        }
    }

    async updateRepairStatus(id, newStatus) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;

        const oldStatus = repair.tinhTrang;
        const oldNgayTra = repair.ngayTra;
        const nextNgayTra = newStatus === 'Đã trả máy' ? this.formatDateVN(new Date()) : null;

        repair.tinhTrang = newStatus;
        repair.ngayTra = nextNgayTra;

        try {
            await this.apiRequest(`${this.API_BASE}/api/repairs/${id}/status`, 'PUT', {
                tinhTrang: newStatus,
                ngayTra: nextNgayTra
            });

            this.saveLocalRepairs(this.repairs);
            this.renderTable();
            this.renderSummaryCards();
            this.showNotification('✅ Đã cập nhật tình trạng');
            await this.backupToDrive(repair);
        } catch (error) {
            console.error('updateRepairStatus API error:', error);
            this.showNotification('⚠️ Đang dùng dữ liệu offline', 'error');

            repair.tinhTrang = oldStatus;
            repair.ngayTra = oldNgayTra;
            this.renderTable();
            this.renderSummaryCards();
            this.showNotification(`❌ Lỗi cập nhật tình trạng: ${error.message}`, 'error');
        }
    }

    toggleRepairDetails(id) {
        this.expandedRepairId = this.expandedRepairId === id ? null : id;
        this.renderTable();
    }

    jumpToRepair(id) {
        if (!id || Number.isNaN(id)) return;
        this.expandedRepairId = id;
        this.renderTable();

        const targetRow = document.querySelector(`.repair-row[data-id="${id}"]`);
        if (!targetRow) return;

        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetRow.classList.add('expanded');
        targetRow.style.transition = 'box-shadow 0.3s ease';
        targetRow.style.boxShadow = '0 0 0 3px rgba(0, 191, 255, 0.35)';
        setTimeout(() => {
            targetRow.style.boxShadow = '';
        }, 1200);
    }

    async saveRepairWorkNote(id) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;
        const el = document.getElementById(`workNote-${id}`);
        if (!el) return;
        repair.workNote = (el.value || '').trim();

        this.saveLocalRepairs(this.repairs);
        this.showNotification('✅ Đã lưu ghi chú sửa chữa');
        await this.backupToDrive(repair);
    }

    async backupToDrive(repairData) {
        try {
            await fetch(this.BACKUP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source: 'local',
                    timestamp: new Date().toISOString(),
                    data: repairData
                })
            });
        } catch (error) {
            console.error('backupToDrive error:', error);
        }
    }

    printTicket(id) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;
        this.showPrintModal(repair, false);
    }

    openInvoiceModal(id) {
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;
        const invoiceSource = repair.invoiceDraft || repair.invoice || {};

        document.getElementById('invoiceRepairId').value = id;
        document.getElementById('invoiceDiscount').value = this.formatThousands(invoiceSource.discount || 0);
        document.getElementById('invoiceDevice').value = invoiceSource.device || repair.tenMay || '';
        document.getElementById('invoiceService').value = '';
        document.getElementById('invoiceQty').value = 1;
        document.getElementById('invoiceAmount').value = '';
        document.getElementById('invoiceLines').innerHTML = '';

        this.currentInvoiceServices = Array.isArray(invoiceSource.services) ? [...invoiceSource.services] : [];
        this.renderInvoiceServices();
        this.calculateInvoiceTotal();
        this.openModal('invoiceModal');
    }

    persistInvoiceDraft(repair) {
        if (!repair) return;

        const device = (document.getElementById('invoiceDevice')?.value || '').trim() || repair.tenMay || '';
        const discount = this.parseFormattedNumber(document.getElementById('invoiceDiscount')?.value || '0');
        repair.invoiceDraft = {
            device,
            discount,
            services: [...this.currentInvoiceServices]
        };
        this.saveLocalRepairs(this.repairs);
    }

    persistCurrentInvoiceDraft() {
        const id = Number(document.getElementById('invoiceRepairId')?.value);
        if (!id || Number.isNaN(id)) return;
        const repair = this.repairs.find(r => r.id === id);
        this.persistInvoiceDraft(repair);
    }

    addInvoiceService() {
        const service = (document.getElementById('invoiceService')?.value || '').trim();
        const device = (document.getElementById('invoiceDevice')?.value || '').trim();
        const qty = Number(document.getElementById('invoiceQty')?.value || 1);
        const amount = this.parseFormattedNumber(document.getElementById('invoiceAmount')?.value || '0');

        if (!service || !device || qty <= 0 || amount < 0) {
            this.showNotification('❌ Vui lòng nhập đúng dữ liệu dịch vụ', 'error');
            return;
        }

        this.currentInvoiceServices.push({ service, device, qty, amount });
        this.persistCurrentInvoiceDraft();
        this.renderInvoiceServices();
        this.calculateInvoiceTotal();

        document.getElementById('invoiceService').value = '';
        document.getElementById('invoiceAmount').value = '';
        document.getElementById('invoiceQty').value = 1;
    }

    removeInvoiceService(index) {
        this.currentInvoiceServices.splice(index, 1);
        this.persistCurrentInvoiceDraft();
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
        const discount = this.parseFormattedNumber(document.getElementById('invoiceDiscount')?.value || '0');
        document.getElementById('invoiceTotal').value = this.formatThousands(Math.max(0, subtotal - discount));
    }

    saveInvoiceAndPrint() {
        const id = Number(document.getElementById('invoiceRepairId')?.value);
        const repair = this.repairs.find(r => r.id === id);
        if (!repair) return;

        const device = (document.getElementById('invoiceDevice')?.value || '').trim();
        const discount = this.parseFormattedNumber(document.getElementById('invoiceDiscount')?.value || '0');
        const services = [...this.currentInvoiceServices];

        if (!device || !services.length || discount < 0) {
            this.showNotification('❌ Cần thêm ít nhất 1 dòng dịch vụ trước khi in', 'error');
            return;
        }

        const subtotal = services.reduce((sum, r) => sum + (Number(r.qty) * Number(r.amount)), 0);
        const total = Math.max(0, subtotal - discount);

        repair.invoice = { device, services, discount, subtotal, total };
        repair.invoiceDraft = null;
        this.saveLocalRepairs(this.repairs);
        this.closeModal('invoiceModal');
        this.showPrintModal(repair, true);
    }

    showPrintModal(repair, isInvoice = false) {
        const printContent = document.getElementById('printContent');
        if (!printContent || !repair) return;
        this.currentPrintIsInvoice = Boolean(isInvoice);
        printContent.innerHTML = this.generatePrintHTML(repair, isInvoice);

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

    getPrintDocumentStyles() {
        const isInvoice = this.currentPrintIsInvoice;
        const titleSize = isInvoice ? '16px' : '20px';
        const blockSize = isInvoice ? '13px' : '16px';
        const tableSize = isInvoice ? '11px' : '13px';
        const summarySize = isInvoice ? '13px' : '16px';

        return `
            @page { size: 80mm auto; margin: 0; }

            html, body {
                margin: 0;
                padding: 0;
                background: #fff;
                color: #000;
                font-family: Arial, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .print-shell {
                width: 80mm;
                max-width: 80mm;
                margin: 0 auto;
                background: #fff;
            }

            .print-receipt,
            .invoice-style {
                width: 100%;
                border: 1px solid #000;
                padding: 8px;
                line-height: 1.35;
                background: #fff;
                box-sizing: border-box;
            }

            .invoice-logo { text-align: center; font-size: ${isInvoice ? '18px' : '20px'}; font-weight: 700; margin-bottom: 2px; }
            .invoice-logo span { display: block; font-size: 10px; font-weight: 500; }
            .invoice-center { text-align: center; font-size: 12px; margin-bottom: 6px; }
            .invoice-title { text-align: center; font-size: ${titleSize}; line-height: 1.15; margin: 6px 0 0; color: #000; text-transform: uppercase; word-break: break-word; }
            .invoice-code { text-align: center; font-size: ${isInvoice ? '14px' : '16px'}; font-weight: 700; margin-top: 3px; }
            .invoice-date { text-align: center; font-size: ${isInvoice ? '13px' : '16px'}; line-height: 1.2; margin: 5px 0 8px; font-weight: 700; }
            .invoice-block { font-size: ${blockSize}; margin-bottom: 8px; word-break: break-word; }
            .invoice-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: ${tableSize}; table-layout: fixed; }
            .invoice-table th, .invoice-table td { border: 1px solid #000; padding: ${isInvoice ? '3px' : '4px'}; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; }
            .invoice-table th { text-align: center; background: #fff; color: #000; font-weight: 700; }
            .invoice-table th:first-child, .invoice-table td:first-child { width: ${isInvoice ? '52%' : '60%'}; }
            .invoice-table th:nth-child(2), .invoice-table td:nth-child(2) { width: ${isInvoice ? '16%' : '20%'}; text-align: center; }
            .invoice-table th:nth-child(3), .invoice-table td:nth-child(3) { width: ${isInvoice ? '32%' : '20%'}; text-align: right; }
            .invoice-note { display: block; color: #000; margin: 10px 0 8px; border: 1px dashed #000; padding: 8px; font-size: ${isInvoice ? '11px' : '12px'}; font-weight: 600; page-break-inside: avoid; break-inside: avoid; }
            .invoice-summary { margin-top: 8px; font-size: ${summarySize}; }
            .invoice-summary > div { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
            .invoice-status { margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; font-size: ${isInvoice ? '11px' : '12px'}; word-break: break-word; }
            .receipt-footer { margin-top: 10px; }
            .signature { display: flex; justify-content: space-between; gap: 12px; }
            .signature > div { flex: 1; text-align: center; font-size: 12px; }
            .signature hr { margin-top: 22px; border: none; border-top: 1px solid #000; }
        `;
    }

    printCurrentDocument() {
        const printContent = document.getElementById('printContent');
        if (!printContent || !printContent.innerHTML.trim()) {
            this.showNotification('❌ Không có nội dung để in', 'error');
            return;
        }

        const title = 'In phiếu sửa chữa';
        const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${this.getPrintDocumentStyles()}</style>
</head>
<body>
    <div class="print-shell">${printContent.innerHTML}</div>
</body>
</html>`;

        const existingFrame = document.getElementById('printFrame');
        if (existingFrame) existingFrame.remove();

        const iframe = document.createElement('iframe');
        iframe.id = 'printFrame';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);

        const cleanup = () => {
            setTimeout(() => {
                iframe.remove();
            }, 100);
        };

        const frameWindow = iframe.contentWindow;
        if (!frameWindow) {
            cleanup();
            this.showNotification('❌ Không khởi tạo được vùng in', 'error');
            return;
        }

        frameWindow.document.open();
        frameWindow.document.write(html);
        frameWindow.document.close();

        const triggerPrint = () => {
            frameWindow.focus();
            frameWindow.print();
        };

        frameWindow.addEventListener('afterprint', cleanup, { once: true });
        setTimeout(cleanup, 60000);

        if (frameWindow.document.readyState === 'complete') {
            setTimeout(triggerPrint, 150);
            return;
        }

        iframe.addEventListener('load', () => {
            setTimeout(triggerPrint, 150);
        }, { once: true });
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
            ? stale.map(r => `<div class="summary-item" data-repair-id="${r.id}"><div><strong>${r.tenKhach}</strong> - ${r.tenMay}</div><div class="summary-desc">${r.moTaLoi || '-'}</div><div class="summary-age">Tồn đọng ${this.calcDayDiffFromNow(r.ngayNhan)} ngày</div></div>`).join('')
            : '<div class="summary-empty">Không có máy tồn đọng.</div>';

        todayEl.innerHTML = today.length
            ? today.map(r => `<div class="summary-item" data-repair-id="${r.id}"><div><strong>${r.tenKhach}</strong> - ${r.tenMay}</div><div class="summary-desc">${r.moTaLoi || '-'}</div></div>`).join('')
            : '<div class="summary-empty">Không có máy chưa xử lí trong ngày.</div>';
    }

    formatDateVN(dateObj) {
        return new Date(dateObj).toLocaleDateString('vi-VN');
    }

    parseFormattedNumber(value) {
        const raw = String(value || '').replace(/[^\d]/g, '');
        return raw ? Number(raw) : 0;
    }

    formatThousands(value) {
        const num = Number(value) || 0;
        return num.toLocaleString('en-US');
    }

    formatCurrencyInput(inputEl) {
        if (!inputEl) return;
        const parsed = this.parseFormattedNumber(inputEl.value);
        inputEl.value = this.formatThousands(parsed);
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

