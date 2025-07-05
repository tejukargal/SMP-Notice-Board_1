class NoticeBoard {
    constructor() {
        this.notices = [];
        this.filteredNotices = [];
        this.currentFilter = '';
        this.currentSearch = '';
        this.activeTags = new Set();
        this.sortBy = 'date-desc';
        this.viewMode = 'grid';
        this.isAdmin = false;
        this.quillEditor = null;
        this.syncInterval = null;
        this.lastSyncTime = null;
        this.isOnline = navigator.onLine;
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.attachEventListeners();
        this.initializeQuill();
        this.loadFromStorage();
        this.checkAdminStatus();
        this.initializeCloudSync();
        this.applyTheme();
        this.render();
        this.startSyncPolling();
    }

    initializeElements() {
        // Header elements
        this.syncStatus = document.getElementById('syncStatus');
        this.themeToggle = document.getElementById('themeToggle');
        this.viewToggle = document.getElementById('viewToggle');
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.adminToggle = document.getElementById('adminToggle');

        // Search and filter elements
        this.searchInput = document.getElementById('searchInput');
        this.clearSearch = document.getElementById('clearSearch');
        this.categoryFilter = document.getElementById('categoryFilter');
        this.sortBy = document.getElementById('sortBy');
        this.activeTags = document.getElementById('activeTags');

        // Main content
        this.noticesContainer = document.getElementById('noticesContainer');
        this.emptyState = document.getElementById('emptyState');
        this.addNoticeBtn = document.getElementById('addNoticeBtn');

        // Mobile controls
        this.mobileSearch = document.getElementById('mobileSearch');
        this.mobileFilter = document.getElementById('mobileFilter');
        this.mobileAdd = document.getElementById('mobileAdd');
        this.mobileSettings = document.getElementById('mobileSettings');

        // Modals
        this.noticeModal = document.getElementById('noticeModal');
        this.adminModal = document.getElementById('adminModal');
        this.detailsModal = document.getElementById('detailsModal');
        this.exportModal = document.getElementById('exportModal');

        // Form elements
        this.noticeForm = document.getElementById('noticeForm');
        this.noticeTitle = document.getElementById('noticeTitle');
        this.noticeCategory = document.getElementById('noticeCategory');
        this.noticePriority = document.getElementById('noticePriority');
        this.noticeDate = document.getElementById('noticeDate');
        this.noticeDeadline = document.getElementById('noticeDeadline');
        this.noticeAuthor = document.getElementById('noticeAuthor');
        this.noticeTags = document.getElementById('noticeTags');

        // Admin elements
        this.adminCode = document.getElementById('adminCode');
        this.loginAdmin = document.getElementById('loginAdmin');

        // Other elements
        this.fileInput = document.getElementById('fileInput');
        this.toastContainer = document.getElementById('toastContainer');
        this.loadingOverlay = document.getElementById('loadingOverlay');
    }

    attachEventListeners() {
        // Header controls
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.viewToggle.addEventListener('click', () => this.toggleViewMode());
        this.exportBtn.addEventListener('click', () => this.showExportModal());
        this.importBtn.addEventListener('click', () => this.showImportDialog());
        this.adminToggle.addEventListener('click', () => this.showAdminModal());

        // Search and filters
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.clearSearch.addEventListener('click', () => this.clearSearchInput());
        this.categoryFilter.addEventListener('change', (e) => this.handleCategoryFilter(e.target.value));
        this.sortBy.addEventListener('change', (e) => this.handleSortChange(e.target.value));

        // Add notice
        this.addNoticeBtn.addEventListener('click', () => this.showNoticeModal());
        this.mobileAdd.addEventListener('click', () => this.showNoticeModal());

        // Mobile controls
        this.mobileSearch.addEventListener('click', () => this.focusSearch());
        this.mobileFilter.addEventListener('click', () => this.showMobileFilters());
        this.mobileSettings.addEventListener('click', () => this.showMobileSettings());

        // Form submission
        this.noticeForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Modal controls
        this.setupModalControls();

        // Admin login
        this.loginAdmin.addEventListener('click', () => this.handleAdminLogin());
        this.adminCode.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAdminLogin();
        });

        // Import file
        this.fileInput.addEventListener('change', (e) => this.handleFileImport(e));

        // Export options
        document.getElementById('exportJSON').addEventListener('click', () => this.exportData('json'));
        document.getElementById('exportCSV').addEventListener('click', () => this.exportData('csv'));
        document.getElementById('exportPDF').addEventListener('click', () => this.exportData('pdf'));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Online/offline detection
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));

        // Click outside to close modals
        document.addEventListener('click', (e) => this.handleOutsideClick(e));

        // Set default date
        this.noticeDate.value = new Date().toISOString().split('T')[0];
    }

    setupModalControls() {
        // Notice modal
        document.getElementById('closeModal').addEventListener('click', () => this.hideNoticeModal());
        document.getElementById('cancelNotice').addEventListener('click', () => this.hideNoticeModal());

        // Admin modal
        document.getElementById('closeAdminModal').addEventListener('click', () => this.hideAdminModal());
        document.getElementById('cancelAdmin').addEventListener('click', () => this.hideAdminModal());

        // Details modal
        document.getElementById('closeDetailsModal').addEventListener('click', () => this.hideDetailsModal());
        document.getElementById('editNoticeBtn').addEventListener('click', () => this.editCurrentNotice());
        document.getElementById('deleteNoticeBtn').addEventListener('click', () => this.deleteCurrentNotice());

        // Export modal
        document.getElementById('closeExportModal').addEventListener('click', () => this.hideExportModal());
    }

    initializeQuill() {
        this.quillEditor = new Quill('#noticeContent', {
            theme: 'snow',
            placeholder: 'Enter notice content...',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    ['link', 'blockquote'],
                    [{ 'align': [] }],
                    ['clean']
                ]
            }
        });
    }

    loadFromStorage() {
        try {
            const storedNotices = localStorage.getItem('college-notices');
            if (storedNotices) {
                this.notices = JSON.parse(storedNotices);
                this.applyFiltersAndSort();
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            this.showToast('Error loading saved notices', 'error');
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('college-notices', JSON.stringify(this.notices));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            this.showToast('Error saving notices locally', 'error');
        }
    }

    checkAdminStatus() {
        this.isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        this.updateAdminUI();
    }

    updateAdminUI() {
        document.body.classList.toggle('admin-mode', this.isAdmin);
        this.adminToggle.innerHTML = this.isAdmin 
            ? '<i class="fas fa-user-check"></i>' 
            : '<i class="fas fa-user-shield"></i>';
        this.adminToggle.title = this.isAdmin ? 'Logout Admin' : 'Admin Login';
        
        if (this.isAdmin) {
            this.adminToggle.addEventListener('click', () => this.logout());
        }
    }

    async initializeCloudSync() {
        if (!window.NPOINT_CONFIG || !window.NPOINT_CONFIG.jsonId || window.NPOINT_CONFIG.jsonId.includes('YOUR_NPOINT_ID')) {
            this.updateSyncStatus('offline', 'Cloud sync not configured');
            return;
        }

        try {
            await this.syncWithCloud();
        } catch (error) {
            console.error('Initial cloud sync failed:', error);
            this.updateSyncStatus('error', 'Cloud sync failed');
        }
    }

    startSyncPolling() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(async () => {
            if (this.isOnline) {
                try {
                    await this.syncWithCloud();
                } catch (error) {
                    console.error('Sync polling error:', error);
                }
            }
        }, 5000);
    }

    async syncWithCloud() {
        if (!window.NPOINT_CONFIG || !this.isOnline) {
            return;
        }

        try {
            this.updateSyncStatus('syncing', 'Syncing...');

            const response = await fetch(`${window.NPOINT_CONFIG.baseUrl}/${window.NPOINT_CONFIG.jsonId}`);

            if (response.ok) {
                const cloudData = await response.json();
                
                if (cloudData && cloudData.notices) {
                    const cloudNotices = cloudData.notices;
                    const cloudLastUpdated = new Date(cloudData.lastUpdated || 0);
                    const localLastUpdated = new Date(this.lastSyncTime || 0);

                    if (cloudLastUpdated > localLastUpdated) {
                        this.notices = cloudNotices;
                        this.saveToStorage();
                        this.applyFiltersAndSort();
                        this.render();
                    }
                }

                // Note: NPoint.io is read-only, so we only fetch data
                this.lastSyncTime = new Date().toISOString();
                this.updateSyncStatus('synced', 'Synced (Read-only)');
            } else {
                throw new Error('Failed to fetch from cloud');
            }
        } catch (error) {
            console.error('Cloud sync error:', error);
            this.updateSyncStatus('error', 'Sync failed');
        }
    }

    async uploadToCloud() {
        // NPoint.io is read-only, so we don't upload data
        // Data is manually updated through the NPoint.io web interface
        console.log('NPoint.io is read-only - data not uploaded to cloud');
        return;
    }

    updateSyncStatus(status, message) {
        this.syncStatus.className = `sync-status ${status}`;
        this.syncStatus.innerHTML = `
            <i class="fas fa-${this.getSyncIcon(status)}"></i>
            <span>${message}</span>
        `;
    }

    getSyncIcon(status) {
        switch (status) {
            case 'syncing': return 'sync-alt fa-spin';
            case 'synced': return 'check-circle';
            case 'offline': return 'cloud-download-alt';
            case 'error': return 'exclamation-triangle';
            default: return 'cloud-upload-alt';
        }
    }

    handleOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        if (isOnline) {
            this.updateSyncStatus('syncing', 'Reconnecting...');
            this.syncWithCloud();
        } else {
            this.updateSyncStatus('offline', 'Offline mode');
        }
    }

    applyTheme() {
        const isDark = localStorage.getItem('darkMode') === 'true';
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        this.themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('darkMode', newTheme === 'dark');
        this.themeToggle.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    toggleViewMode() {
        this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
        this.viewToggle.innerHTML = this.viewMode === 'grid' 
            ? '<i class="fas fa-th"></i>' 
            : '<i class="fas fa-list"></i>';
        this.noticesContainer.className = `notices-container ${this.viewMode}-view`;
    }

    handleSearch(query) {
        this.currentSearch = query.toLowerCase().trim();
        this.clearSearch.style.display = query ? 'block' : 'none';
        this.applyFiltersAndSort();
        this.render();
    }

    clearSearchInput() {
        this.searchInput.value = '';
        this.currentSearch = '';
        this.clearSearch.style.display = 'none';
        this.applyFiltersAndSort();
        this.render();
    }

    handleCategoryFilter(category) {
        this.currentFilter = category;
        this.applyFiltersAndSort();
        this.render();
    }

    handleSortChange(sortBy) {
        this.sortBy = sortBy;
        this.applyFiltersAndSort();
        this.render();
    }

    applyFiltersAndSort() {
        let filtered = [...this.notices];

        // Apply category filter
        if (this.currentFilter) {
            filtered = filtered.filter(notice => notice.category === this.currentFilter);
        }

        // Apply search filter
        if (this.currentSearch) {
            filtered = filtered.filter(notice => {
                const searchFields = [
                    notice.title,
                    notice.content,
                    notice.author,
                    notice.category,
                    ...(notice.tags || [])
                ].join(' ').toLowerCase();
                return searchFields.includes(this.currentSearch);
            });
        }

        // Apply tag filter
        if (this.activeTags.size > 0) {
            filtered = filtered.filter(notice => {
                return notice.tags && notice.tags.some(tag => this.activeTags.has(tag));
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.sortBy) {
                case 'date-desc':
                    return new Date(b.date) - new Date(a.date);
                case 'date-asc':
                    return new Date(a.date) - new Date(b.date);
                case 'priority':
                    const priorityOrder = { critical: 3, high: 2, normal: 1 };
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                case 'deadline':
                    const aDeadline = a.deadline ? new Date(a.deadline) : new Date('2099-12-31');
                    const bDeadline = b.deadline ? new Date(b.deadline) : new Date('2099-12-31');
                    return aDeadline - bDeadline;
                case 'title':
                    return a.title.localeCompare(b.title);
                default:
                    return 0;
            }
        });

        this.filteredNotices = filtered;
    }

    render() {
        if (this.filteredNotices.length === 0) {
            this.noticesContainer.innerHTML = '';
            this.emptyState.style.display = 'block';
        } else {
            this.emptyState.style.display = 'none';
            this.renderNotices();
        }
        this.renderActiveTags();
    }

    renderNotices() {
        const noticesHTML = this.filteredNotices.map(notice => this.createNoticeCard(notice)).join('');
        this.noticesContainer.innerHTML = noticesHTML;
        
        // Add event listeners to notice cards
        this.filteredNotices.forEach(notice => {
            const card = document.querySelector(`[data-notice-id="${notice.id}"]`);
            if (card) {
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('.notice-actions')) {
                        this.showNoticeDetails(notice);
                    }
                });

                // Add tag click listeners
                const tags = card.querySelectorAll('.notice-tag');
                tags.forEach(tag => {
                    tag.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleTag(tag.textContent.trim());
                    });
                });

                // Add admin action listeners
                if (this.isAdmin) {
                    const editBtn = card.querySelector('.edit-notice');
                    const deleteBtn = card.querySelector('.delete-notice');
                    
                    if (editBtn) {
                        editBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.editNotice(notice);
                        });
                    }
                    
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.deleteNotice(notice.id);
                        });
                    }
                }
            }
        });
    }

    createNoticeCard(notice) {
        const deadlineInfo = this.getDeadlineInfo(notice.deadline);
        const categoryClass = `category-${notice.category.replace(/\s+/g, '-')}`;
        const priorityClass = `priority-${notice.priority}`;
        
        const tagsHTML = notice.tags ? notice.tags.map(tag => 
            `<span class="notice-tag">${tag}</span>`
        ).join('') : '';

        const adminActions = this.isAdmin ? `
            <div class="notice-actions">
                <button class="btn btn-icon edit-notice" title="Edit Notice">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-icon delete-notice" title="Delete Notice">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        ` : '';

        const deadlineIndicator = deadlineInfo ? `
            <div class="deadline-indicator ${deadlineInfo.class}">
                <i class="fas fa-clock"></i> ${deadlineInfo.text}
            </div>
        ` : '';

        return `
            <div class="notice-card ${priorityClass}" data-notice-id="${notice.id}">
                ${deadlineIndicator}
                <div class="notice-header">
                    <h3 class="notice-title">${notice.title}</h3>
                </div>
                <div class="notice-meta">
                    <span class="category-badge ${categoryClass}">
                        ${this.getCategoryIcon(notice.category)} ${notice.category}
                    </span>
                    <span class="priority-badge ${priorityClass}">
                        <i class="fas fa-flag"></i> ${notice.priority}
                    </span>
                    <span class="meta-item">
                        <i class="fas fa-calendar"></i> ${this.formatDate(notice.date)}
                    </span>
                    ${notice.author ? `
                        <span class="meta-item">
                            <i class="fas fa-user"></i> ${notice.author}
                        </span>
                    ` : ''}
                </div>
                <div class="notice-content">
                    ${this.stripHTML(notice.content).substring(0, 150)}${this.stripHTML(notice.content).length > 150 ? '...' : ''}
                </div>
                <div class="notice-footer">
                    <div class="notice-tags">${tagsHTML}</div>
                    ${adminActions}
                </div>
            </div>
        `;
    }

    getCategoryIcon(category) {
        const icons = {
            academic: 'fas fa-graduation-cap',
            events: 'fas fa-calendar-alt',
            exams: 'fas fa-file-alt',
            urgent: 'fas fa-exclamation-triangle',
            scholarship: 'fas fa-award',
            'fee-payments': 'fas fa-credit-card',
            admission: 'fas fa-door-open',
            placement: 'fas fa-briefcase',
            library: 'fas fa-book'
        };
        return `<i class="${icons[category] || 'fas fa-info-circle'}"></i>`;
    }

    getDeadlineInfo(deadline) {
        if (!deadline) return null;

        const deadlineDate = new Date(deadline);
        const today = new Date();
        const diffTime = deadlineDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { class: 'deadline-overdue', text: 'Overdue' };
        } else if (diffDays <= 3) {
            return { class: 'deadline-approaching', text: `${diffDays} days left` };
        } else {
            return { class: 'deadline-normal', text: this.formatDate(deadline) };
        }
    }

    renderActiveTags() {
        if (this.activeTags.size === 0) {
            this.activeTags.innerHTML = '';
            return;
        }

        const tagsHTML = Array.from(this.activeTags).map(tag => `
            <div class="tag">
                ${tag}
                <button class="remove-tag" data-tag="${tag}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        this.activeTags.innerHTML = tagsHTML;

        // Add event listeners to remove buttons
        this.activeTags.querySelectorAll('.remove-tag').forEach(btn => {
            btn.addEventListener('click', () => {
                this.toggleTag(btn.dataset.tag);
            });
        });
    }

    toggleTag(tag) {
        if (this.activeTags.has(tag)) {
            this.activeTags.delete(tag);
        } else {
            this.activeTags.add(tag);
        }
        this.applyFiltersAndSort();
        this.render();
    }

    showNoticeModal(notice = null) {
        this.currentEditingNotice = notice;
        
        if (notice) {
            // Edit mode
            document.getElementById('modalTitle').textContent = 'Edit Notice';
            document.getElementById('saveNotice').textContent = 'Update Notice';
            this.populateForm(notice);
        } else {
            // Add mode
            document.getElementById('modalTitle').textContent = 'Add New Notice';
            document.getElementById('saveNotice').textContent = 'Save Notice';
            this.resetForm();
        }
        
        this.noticeModal.classList.add('show');
        this.noticeTitle.focus();
    }

    hideNoticeModal() {
        this.noticeModal.classList.remove('show');
        this.currentEditingNotice = null;
        this.resetForm();
    }

    populateForm(notice) {
        this.noticeTitle.value = notice.title;
        this.noticeCategory.value = notice.category;
        this.noticePriority.value = notice.priority;
        this.noticeDate.value = notice.date;
        this.noticeDeadline.value = notice.deadline || '';
        this.noticeAuthor.value = notice.author || '';
        this.noticeTags.value = notice.tags ? notice.tags.join(', ') : '';
        this.quillEditor.root.innerHTML = notice.content;
    }

    resetForm() {
        this.noticeForm.reset();
        this.noticeDate.value = new Date().toISOString().split('T')[0];
        this.quillEditor.root.innerHTML = '';
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        const formData = this.getFormData();
        
        if (this.currentEditingNotice) {
            this.updateNotice(this.currentEditingNotice.id, formData);
        } else {
            this.addNotice(formData);
        }
        
        this.hideNoticeModal();
    }

    validateForm() {
        const title = this.noticeTitle.value.trim();
        const category = this.noticeCategory.value;
        const content = this.quillEditor.getText().trim();

        if (!title) {
            this.showToast('Please enter a title', 'error');
            this.noticeTitle.focus();
            return false;
        }

        if (!category) {
            this.showToast('Please select a category', 'error');
            this.noticeCategory.focus();
            return false;
        }

        if (!content) {
            this.showToast('Please enter content', 'error');
            this.quillEditor.focus();
            return false;
        }

        return true;
    }

    getFormData() {
        const tags = this.noticeTags.value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag);

        return {
            title: this.noticeTitle.value.trim(),
            content: this.quillEditor.root.innerHTML,
            category: this.noticeCategory.value,
            priority: this.noticePriority.value,
            date: this.noticeDate.value,
            deadline: this.noticeDeadline.value || null,
            author: this.noticeAuthor.value.trim(),
            tags: tags.length > 0 ? tags : null,
            timestamp: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
    }

    addNotice(noticeData) {
        const notice = {
            id: Date.now().toString(),
            ...noticeData
        };

        this.notices.unshift(notice);
        this.saveToStorage();
        this.uploadToCloud();
        this.applyFiltersAndSort();
        this.render();
        this.showToast('Notice added successfully', 'success');
    }

    updateNotice(id, noticeData) {
        const index = this.notices.findIndex(notice => notice.id === id);
        if (index !== -1) {
            this.notices[index] = {
                ...this.notices[index],
                ...noticeData,
                lastModified: new Date().toISOString()
            };
            this.saveToStorage();
            this.uploadToCloud();
            this.applyFiltersAndSort();
            this.render();
            this.showToast('Notice updated successfully', 'success');
        }
    }

    editNotice(notice) {
        this.showNoticeModal(notice);
    }

    deleteNotice(id) {
        if (confirm('Are you sure you want to delete this notice?')) {
            this.notices = this.notices.filter(notice => notice.id !== id);
            this.saveToStorage();
            this.uploadToCloud();
            this.applyFiltersAndSort();
            this.render();
            this.showToast('Notice deleted successfully', 'success');
        }
    }

    showNoticeDetails(notice) {
        this.currentDetailNotice = notice;
        
        document.getElementById('detailsTitle').textContent = notice.title;
        
        const metaHTML = `
            <div class="notice-meta">
                <span class="category-badge category-${notice.category.replace(/\s+/g, '-')}">
                    ${this.getCategoryIcon(notice.category)} ${notice.category}
                </span>
                <span class="priority-badge priority-${notice.priority}">
                    <i class="fas fa-flag"></i> ${notice.priority}
                </span>
                <span class="meta-item">
                    <i class="fas fa-calendar"></i> ${this.formatDate(notice.date)}
                </span>
                ${notice.deadline ? `
                    <span class="meta-item">
                        <i class="fas fa-clock"></i> Deadline: ${this.formatDate(notice.deadline)}
                    </span>
                ` : ''}
                ${notice.author ? `
                    <span class="meta-item">
                        <i class="fas fa-user"></i> ${notice.author}
                    </span>
                ` : ''}
                ${notice.tags ? `
                    <div class="notice-tags">
                        ${notice.tags.map(tag => `<span class="notice-tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('noticeMeta').innerHTML = metaHTML;
        document.getElementById('noticeContentDisplay').innerHTML = notice.content;
        
        // Show/hide admin buttons
        const adminButtons = document.querySelectorAll('#detailsModal .admin-only');
        adminButtons.forEach(btn => {
            btn.style.display = this.isAdmin ? 'block' : 'none';
        });
        
        this.detailsModal.classList.add('show');
    }

    hideDetailsModal() {
        this.detailsModal.classList.remove('show');
        this.currentDetailNotice = null;
    }

    editCurrentNotice() {
        if (this.currentDetailNotice) {
            this.hideDetailsModal();
            this.editNotice(this.currentDetailNotice);
        }
    }

    deleteCurrentNotice() {
        if (this.currentDetailNotice) {
            this.deleteNotice(this.currentDetailNotice.id);
            this.hideDetailsModal();
        }
    }

    showAdminModal() {
        if (this.isAdmin) {
            this.logout();
        } else {
            this.adminModal.classList.add('show');
            this.adminCode.focus();
        }
    }

    hideAdminModal() {
        this.adminModal.classList.remove('show');
        this.adminCode.value = '';
    }

    handleAdminLogin() {
        const code = this.adminCode.value.trim();
        
        if (code === 'teju_smp') {
            this.isAdmin = true;
            sessionStorage.setItem('isAdmin', 'true');
            this.updateAdminUI();
            this.hideAdminModal();
            this.showToast('Admin login successful', 'success');
        } else {
            this.showToast('Invalid admin code', 'error');
            this.adminCode.value = '';
            this.adminCode.focus();
        }
    }

    logout() {
        this.isAdmin = false;
        sessionStorage.removeItem('isAdmin');
        this.updateAdminUI();
        this.showToast('Admin logout successful', 'info');
    }

    showExportModal() {
        this.exportModal.classList.add('show');
    }

    hideExportModal() {
        this.exportModal.classList.remove('show');
    }

    showImportDialog() {
        this.fileInput.click();
    }

    exportData(format) {
        try {
            let data, filename, mimeType;

            switch (format) {
                case 'json':
                    data = JSON.stringify(this.notices, null, 2);
                    filename = `notices-${this.getCurrentDateString()}.json`;
                    mimeType = 'application/json';
                    break;
                    
                case 'csv':
                    data = this.convertToCSV(this.notices);
                    filename = `notices-${this.getCurrentDateString()}.csv`;
                    mimeType = 'text/csv';
                    break;
                    
                case 'pdf':
                    this.exportToPDF();
                    this.hideExportModal();
                    return;
                    
                default:
                    throw new Error('Unsupported export format');
            }

            this.downloadFile(data, filename, mimeType);
            this.hideExportModal();
            this.showToast(`Data exported as ${format.toUpperCase()}`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Export failed', 'error');
        }
    }

    convertToCSV(notices) {
        const headers = ['Title', 'Category', 'Priority', 'Date', 'Deadline', 'Author', 'Content', 'Tags'];
        const rows = notices.map(notice => [
            this.escapeCsvField(notice.title),
            this.escapeCsvField(notice.category),
            this.escapeCsvField(notice.priority),
            this.escapeCsvField(notice.date),
            this.escapeCsvField(notice.deadline || ''),
            this.escapeCsvField(notice.author || ''),
            this.escapeCsvField(this.stripHTML(notice.content)),
            this.escapeCsvField(notice.tags ? notice.tags.join('; ') : '')
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    escapeCsvField(field) {
        if (field && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field || '';
    }

    exportToPDF() {
        const printWindow = window.open('', '_blank');
        const printContent = this.generatePDFContent();
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    }

    generatePDFContent() {
        const notices = this.notices.slice(0, 50); // Limit for PDF
        const noticesHTML = notices.map(notice => `
            <div style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${notice.title}</h3>
                <p style="margin: 5px 0; font-size: 12px; color: #666;">
                    <strong>Category:</strong> ${notice.category} | 
                    <strong>Priority:</strong> ${notice.priority} | 
                    <strong>Date:</strong> ${this.formatDate(notice.date)}
                    ${notice.deadline ? ` | <strong>Deadline:</strong> ${this.formatDate(notice.deadline)}` : ''}
                    ${notice.author ? ` | <strong>Author:</strong> ${notice.author}` : ''}
                </p>
                <div style="margin: 10px 0;">${notice.content}</div>
                ${notice.tags ? `<p style="font-size: 11px; color: #888;"><strong>Tags:</strong> ${notice.tags.join(', ')}</p>` : ''}
            </div>
        `).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>SMP College Notice Board - Export</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; text-align: center; }
                    .export-info { text-align: center; margin-bottom: 30px; color: #666; }
                </style>
            </head>
            <body>
                <h1>SMP College Notice Board</h1>
                <div class="export-info">
                    <p>Export Date: ${new Date().toLocaleDateString()}</p>
                    <p>Total Notices: ${notices.length}</p>
                </div>
                ${noticesHTML}
            </body>
            </html>
        `;
    }

    handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/json') {
            this.showToast('Please select a JSON file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                
                if (!Array.isArray(importedData)) {
                    throw new Error('Invalid data format');
                }

                // Validate data structure
                const validNotices = importedData.filter(notice => 
                    notice.title && notice.content && notice.category
                );

                if (validNotices.length === 0) {
                    throw new Error('No valid notices found');
                }

                // Merge with existing notices
                const existingIds = new Set(this.notices.map(n => n.id));
                const newNotices = validNotices.filter(notice => !existingIds.has(notice.id));

                this.notices = [...newNotices, ...this.notices];
                this.saveToStorage();
                this.uploadToCloud();
                this.applyFiltersAndSort();
                this.render();

                this.showToast(`Imported ${newNotices.length} notices`, 'success');
            } catch (error) {
                console.error('Import error:', error);
                this.showToast('Import failed: Invalid file format', 'error');
            }
        };

        reader.readAsText(file);
        this.fileInput.value = '';
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    getCurrentDateString() {
        return new Date().toISOString().split('T')[0];
    }

    handleKeyboardShortcuts(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            if (this.isAdmin) {
                this.showNoticeModal();
            }
        }
        
        if (e.key === 'Escape') {
            if (this.noticeModal.classList.contains('show')) {
                this.hideNoticeModal();
            } else if (this.detailsModal.classList.contains('show')) {
                this.hideDetailsModal();
            } else if (this.adminModal.classList.contains('show')) {
                this.hideAdminModal();
            } else if (this.exportModal.classList.contains('show')) {
                this.hideExportModal();
            }
        }
    }

    focusSearch() {
        this.searchInput.focus();
    }

    showMobileFilters() {
        // Toggle mobile filter panel (implement as needed)
        this.mobileFilter.classList.toggle('active');
    }

    showMobileSettings() {
        // Show mobile settings (implement as needed)
        this.showExportModal();
    }

    handleOutsideClick(e) {
        if (e.target.classList.contains('modal')) {
            if (this.noticeModal.classList.contains('show')) {
                this.hideNoticeModal();
            } else if (this.detailsModal.classList.contains('show')) {
                this.hideDetailsModal();
            } else if (this.adminModal.classList.contains('show')) {
                this.hideAdminModal();
            } else if (this.exportModal.classList.contains('show')) {
                this.hideExportModal();
            }
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        toast.innerHTML = `
            <i class="toast-icon ${icons[type]}"></i>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        this.toastContainer.appendChild(toast);

        // Add close functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.remove();
        });

        // Auto remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, duration);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    stripHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.noticeBoard = new NoticeBoard();
});