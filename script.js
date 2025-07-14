class NoticeBoard {
    constructor() {
        this.notices = [];
        this.filteredNotices = [];
        this.currentFilter = 'all';
        this.activeTags = new Set();
        this.sortBy = 'order';
        this.viewMode = 'grid';
        this.isAdmin = false;
        this.quillEditor = null;
        this.syncInterval = null;
        this.lastSyncTime = null;
        this.lastUpdateTime = null;
        this.detailsModalTimer = null;
        this.isOnline = navigator.onLine;
        this.cloudWriteEnabled = true;
        this.currentTags = [];
        this.currentAttachments = [];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.fileHostingReady = false; // External hosting disabled due to CORS
        this.fileHostingService = '0x0.st';
        this.allowedFileTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        
        // Store CSV data
        this.csvData = {};
        
        this.init();
        this.initializeSubHeader();
    }

    async init() {
        this.initializeElements();
        this.attachEventListeners();
        this.initializeQuill();
        this.loadFromStorage();
        this.checkAdminStatus();
        this.initializeCloudSync();
        // this.initializeFileHosting(); // Disabled - using local compression instead
        this.initializeFormsSystem(); // Initialize SMP Forms system
        this.applyTheme();
        
        // Load all CSV files at startup
        await this.loadAllCSVFiles();
        
        // Initialize with demo scrolling notice if no notices exist
        if (this.notices.length === 0) {
            this.createDemoScrollingNotice();
        } else {
            // Check if we have any scrolling notices, if not create one for testing
            const hasScrollingNotice = this.notices.some(notice => notice.scrollingEnabled);
            if (!hasScrollingNotice) {
                console.log('No scrolling notices found, creating demo scrolling notice');
                this.createDemoScrollingNotice();
            }
        }
        
        await this.render();
        // Removed automatic sync polling - only sync on page load and manual refresh
    }

    // Create a demo notice with scrolling messages to showcase the feature
    createDemoScrollingNotice() {
        const demoNotice = {
            id: `demo-${Date.now()}`,
            title: 'Fee Dues Notice - Student List',
            content: '<p><strong>Important Notice:</strong> The following students have pending fee dues. Please contact the accounts office immediately to clear your dues.</p><p>Payment can be made at the college office during working hours (9:00 AM - 4:00 PM).</p><p>For any queries, contact the accounts department at extension 234.</p>',
            category: 'fee-payments',
            priority: 'high',
            date: new Date().toISOString().split('T')[0],
            deadline: null,
            author: 'Accounts Department',
            tags: ['fees', 'payment', 'urgent', 'students'],
            timestamp: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            scrollingEnabled: true,
            scrollingLabel: 'Student Fee Dues List',
            scrollingSpeed: 'medium',
            popupEnabled: true,
            order: 1
        };
        
        this.notices.unshift(demoNotice);
        this.saveToStorage();
        
        console.log('Demo scrolling notice created successfully');
    }

    // Load all available CSV files at startup
    async loadAllCSVFiles() {
        console.log('Loading CSV files at startup...');
        
        // Try to load CSV files numbered 1-10 (common range)
        for (let i = 1; i <= 10; i++) {
            try {
                const csvText = await this.fetchCSVFile(i);
                if (csvText) {
                    // Store raw CSV text instead of parsed format for better processing
                    this.csvData[i] = csvText;
                    const lineCount = csvText.trim().split('\n').length;
                    console.log(`Loaded CSV file ${i}.csv with ${lineCount} lines`);
                }
            } catch (error) {
                // File doesn't exist or error loading, skip silently
                console.log(`CSV file ${i}.csv not found or error loading`);
            }
        }
        
        console.log(`Loaded ${Object.keys(this.csvData).length} CSV files`);
    }

    // Fetch CSV file content
    async fetchCSVFile(fileNumber) {
        try {
            const response = await fetch(`${fileNumber}.csv`);
            if (response.ok) {
                return await response.text();
            }
            return null;
        } catch (error) {
            return null;
        }
    }


    // Create simple scrolling text HTML
    // Get scroll speed multiplier based on setting
    getScrollSpeed(speedSetting = 'medium') {
        const speeds = {
            'slow': 2.0,     // Slow and readable
            'medium': 1.5,   // Optimal for reading
            'fast': 1.0,     // Faster pace for long lists
            'speed': 0.8 // Very fast scrolling for very long lists
        };
        return speeds[speedSetting] || speeds['medium'];
    }

    createScrollingTextHTML(csvText, label, speed = 'medium') {
        try {
            // Parse CSV text properly instead of using pipe-separated format
            const lines = csvText.trim().split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                return this.createEmptyScrollingMessage(label);
            }

            // Parse headers and data rows
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const dataRows = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                return row;
            });

            // Create sanitized data structure
            const sanitizedData = {
                headers: headers,
                rows: dataRows
            };

            // Create mobile column-based format
            const createMobileRowHTML = (row, index) => {
                const rowCells = sanitizedData.headers.map((header, colIndex) => {
                    const cellValue = this.formatCellValue(row[header] || '', header, colIndex);
                    const sanitizedValue = this.escapeHtml(cellValue);
                    // Check if value looks like an amount (contains rupees, numbers, or typical amount patterns)
                    const isAmount = /(?:rs\.?|₹|\$|fee|amount|due|paid|balance|total|sum)/i.test(header) || 
                                   /(?:rs\.?\s*\d|₹\s*\d|\d+\.?\d*\s*(?:rs|₹)|\d+\.\d+)/i.test(sanitizedValue);
                    const isNumeric = /^\d+\.?\d*$/.test(sanitizedValue) || isAmount;
                    const cellClass = isNumeric ? 'csv-cell-numeric' : 'csv-cell-text';
                    return `<div class="csv-column ${cellClass}" data-column="${colIndex}" title="${sanitizedValue}">${sanitizedValue}</div>`;
                }).join('');
                return `<div class="csv-mobile-row" data-row="${index}">${rowCells}</div>`;
            };

            // Create original rows with enhanced indexing
            const originalMobileRowsHTML = sanitizedData.rows.map((row, index) => createMobileRowHTML(row, index)).join('');
            const duplicatedMobileRowsHTML = sanitizedData.rows.map((row, index) => 
                createMobileRowHTML(row, index + sanitizedData.rows.length)
            ).join('');
            const allMobileRowsHTML = originalMobileRowsHTML + duplicatedMobileRowsHTML;

            // Enhanced timing calculation with adaptive speed
            const totalRows = sanitizedData.rows.length;
            const baseSpeed = this.calculateOptimalScrollSpeed ? this.calculateOptimalScrollSpeed(totalRows) : this.getScrollSpeed(speed);
            // Reduce minimum duration for faster scrolling, especially for Fast and Speed options
            const minDuration = speed === 'speed' ? 3 : (speed === 'fast' ? 5 : 10);
            const animationDuration = Math.max(totalRows * baseSpeed, minDuration);
            
            // Generate unique ID for this scrolling instance
            const instanceId = `csv-scroll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            return `
                <div class="scrolling-message-inline" id="${instanceId}" data-rows="${totalRows}">
                    <div class="scrolling-label">
                        <div>
                            ${this.escapeHtml(label)}
                        </div>
                        <span class="scrolling-count">(${totalRows} records)</span>
                    </div>
                    <hr class="scrolling-separator">
                    <div class="scrolling-content-area">
                        <div class="scrolling-animation"
                             style="--scroll-duration: ${animationDuration}s; --total-rows: ${totalRows};"
                             data-animation-duration="${animationDuration}"
                             data-total-rows="${totalRows}">
                            ${allMobileRowsHTML}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error creating scrolling message HTML:', error);
            return this.createErrorScrollingMessage(label, error.message);
        }
    }

    initializeElements() {
        // Header elements
        this.syncStatus = document.getElementById('syncStatus');
        this.themeToggle = document.getElementById('themeToggle');
        this.adminToggle = document.getElementById('adminToggle');

        // Filter elements
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.activeTagsContainer = document.getElementById('activeTags'); // May be null if not in HTML

        // Main content
        this.noticesContainer = document.getElementById('noticesContainer');
        this.emptyState = document.getElementById('emptyState');
        this.addNoticeBtn = document.getElementById('addNoticeBtn');

        // Mobile controls
        this.mobileAdd = document.getElementById('mobileAdd');

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
        this.scrollingEnabled = document.getElementById('scrollingEnabled');
        this.scrollingLabel = document.getElementById('scrollingLabel');
        this.scrollingSpeed = document.getElementById('scrollingSpeed');
        this.popupEnabled = document.getElementById('popupEnabled');
        this.formCaptureEnabled = document.getElementById('formCaptureEnabled');
        this.scrollingOptions = document.getElementById('scrollingOptions');

        // Admin elements
        this.adminCode = document.getElementById('adminCode');
        this.loginAdmin = document.getElementById('loginAdmin');

        // Other elements
        this.fileInput = document.getElementById('fileInput');
        this.toastContainer = document.getElementById('toastContainer');
        this.loadingOverlay = document.getElementById('loadingOverlay');
    }

    attachEventListeners() {
        // Bottom controls (moved from header)
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        // Admin toggle event listener handled in updateAdminUI()

        // Manual sync when clicking on sync status
        this.syncStatus.addEventListener('click', () => {
            if (this.isOnline) {
                this.syncWithCloud();
            }
        });

        // Debug: Add double-click to test JSONhost URL directly
        this.syncStatus.addEventListener('dblclick', () => {
            this.testJsonhostURL();
        });

        // Category filters
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = btn.dataset.category;
                this.handleCategoryFilter(category);
                this.updateActiveFilterButton(btn);
            });
        });

        // Add notice
        this.addNoticeBtn.addEventListener('click', () => this.showNoticeModal());
        this.mobileAdd.addEventListener('click', () => this.showNoticeModal());

        // Mobile controls
        // Mobile filter removed - no longer needed

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
        
        // Enhanced tags and file attachments
        const tagInput = document.getElementById('tagInput');
        if (tagInput) {
            tagInput.addEventListener('keypress', (e) => this.handleTagInput(e));
        }
        
        const fileAttachments = document.getElementById('noticeAttachments');
        if (fileAttachments) {
            fileAttachments.addEventListener('change', (e) => this.handleFileSelection(e));
            this.setupFileDragDrop();
        }

        // Scrolling messages toggle
        if (this.scrollingEnabled) {
            this.scrollingEnabled.addEventListener('change', (e) => {
                this.scrollingOptions.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // Export options
        document.getElementById('exportJSON').addEventListener('click', () => this.exportData('json'));
        document.getElementById('exportCSV').addEventListener('click', () => this.exportData('csv'));
        document.getElementById('exportPDF').addEventListener('click', () => this.exportData('pdf'));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Online/offline detection
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));

        // Manual sync button (optional - can be triggered by page refresh)
        window.addEventListener('focus', () => {
            // Sync when user returns to the tab (optional)
            if (this.isOnline) {
                this.syncWithCloud();
            }
        });

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
        
        // Scrolling data modal
        document.getElementById('closeScrollingDataModal').addEventListener('click', () => this.hideScrollingDataModal());
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
                const attachmentCount = this.notices.reduce((count, notice) => 
                    count + (notice.attachments ? notice.attachments.length : 0), 0);
                console.log(`Loaded ${this.notices.length} notices with ${attachmentCount} attachments from localStorage`);
                this.applyFiltersAndSort();
            }
            
            // Load last update time
            const storedLastUpdate = localStorage.getItem('lastUpdateTime');
            if (storedLastUpdate) {
                this.lastUpdateTime = storedLastUpdate;
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            this.showToast('Error loading saved notices', 'error');
        }
    }

    saveToStorage() {
        try {
            console.log('Saving to localStorage, notices count:', this.notices.length);
            const dataStr = JSON.stringify(this.notices);
            const dataSize = dataStr.length;
            const attachmentCount = this.notices.reduce((count, notice) => 
                count + (notice.attachments ? notice.attachments.length : 0), 0);
            console.log(`Saving ${dataSize} bytes, ${attachmentCount} attachments`);
            
            localStorage.setItem('college-notices', dataStr);
            console.log('Successfully saved to localStorage');
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            if (error.name === 'QuotaExceededError') {
                this.showToast('Storage quota exceeded - attachments too large', 'error');
            } else {
                this.showToast('Error saving notices locally', 'error');
            }
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
        
        // Remove any existing event listeners by cloning the element
        const newAdminToggle = this.adminToggle.cloneNode(true);
        this.adminToggle.parentNode.replaceChild(newAdminToggle, this.adminToggle);
        this.adminToggle = newAdminToggle;
        
        // Add the appropriate event listener
        if (this.isAdmin) {
            this.adminToggle.addEventListener('click', () => this.logout());
        } else {
            this.adminToggle.addEventListener('click', () => this.showAdminModal());
        }
    }

    async initializeCloudSync() {
        console.log('🔄 Initializing cloud sync...');
        console.log('🔍 DEBUG: Cloud config:', window.CLOUD_CONFIG);
        
        if (!window.CLOUD_CONFIG) {
            console.error('CLOUD_CONFIG not found');
            this.updateSyncStatus('offline', 'Cloud sync not configured');
            return;
        }

        if (!this.isCloudConfigValid()) {
            console.error('Cloud config validation failed:', window.CLOUD_CONFIG);
            this.updateSyncStatus('offline', 'Cloud sync configuration invalid');
            return;
        }

        try {
            console.log('🔄 Triggering initial cloud sync...');
            await this.syncWithCloud();
            
            // Process any queued retries
            this.processRetryQueue();
            
            console.log('✅ Initial cloud sync completed');
        } catch (error) {
            console.error('Initial cloud sync failed:', error);
            this.updateSyncStatus('error', `Sync failed: ${error.message}`);
        }
    }

    isCloudConfigValid() {
        const config = window.CLOUD_CONFIG;
        
        switch (config.service) {
            case 'npoint':
                return this.isNPointConfigValid();
            case 'tiiny':
                return this.isTiinyConfigValid();
            case 'jsonsilo':
                return this.isJsonsiloConfigValid();
            case 'jsonhost':
                return this.isJsonhostConfigValid();
            case 'multi':
                return this.isNPointConfigValid() || this.isTiinyConfigValid() || this.isJsonsiloConfigValid() || this.isJsonhostConfigValid();
            default:
                return false;
        }
    }

    isNPointConfigValid() {
        const config = window.CLOUD_CONFIG.npoint;
        return config && config.jsonId && !config.jsonId.includes('YOUR_NPOINT_ID');
    }

    isTiinyConfigValid() {
        const config = window.CLOUD_CONFIG.tiiny;
        return config && config.jsonUrl && !config.jsonUrl.includes('YOUR_TIINY_JSON_URL');
    }

    isJsonsiloConfigValid() {
        const config = window.CLOUD_CONFIG.jsonsilo;
        return config && config.publicUrl && !config.publicUrl.includes('YOUR_JSONSILO_PUBLIC_URL');
    }

    isJsonhostConfigValid() {
        const config = window.CLOUD_CONFIG.jsonhost;
        return config && config.jsonId && config.apiToken && 
               !config.jsonId.includes('YOUR_JSON_ID') && 
               !config.apiToken.includes('YOUR_API_TOKEN');
    }

    // Removed automatic sync polling - sync only happens on page load and manual refresh
    // startSyncPolling() method removed to prevent unnecessary API calls

    async syncWithCloud() {
        if (!window.CLOUD_CONFIG || !this.isOnline) {
            return;
        }

        const config = window.CLOUD_CONFIG;
        
        try {
            this.updateSyncStatus('syncing', 'Syncing...');

            switch (config.service) {
                case 'npoint':
                    await this.syncWithNPoint();
                    break;
                case 'tiiny':
                    await this.syncWithTiiny();
                    break;
                case 'jsonsilo':
                    await this.syncWithJsonsilo();
                    break;
                case 'jsonhost':
                    await this.syncWithJsonhost();
                    break;
                case 'multi':
                    await this.syncWithMultipleServices();
                    break;
                default:
                    throw new Error('Invalid service configuration');
            }
        } catch (error) {
            console.error('Cloud sync error:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                config: window.CLOUD_CONFIG
            });
            this.updateSyncStatus('error', `Sync failed: ${error.message}`);
        }
    }


    async syncWithJsonhost() {
        const config = window.CLOUD_CONFIG.jsonhost;
        if (!this.isJsonhostConfigValid()) {
            console.error('JSONhost config validation failed:', config);
            throw new Error('JSONhost configuration invalid - missing jsonId or apiToken');
        }

        const jsonUrl = `${config.baseUrl}${config.jsonId}`;
        console.log('Attempting to sync with JSONhost:', jsonUrl);
        console.log('JSONhost config:', {
            jsonId: config.jsonId,
            apiToken: config.apiToken ? '[PRESENT]' : '[MISSING]',
            baseUrl: config.baseUrl
        });

        const headers = {
            'Accept': 'application/json'
        };

        try {
            const response = await fetch(jsonUrl, {
                method: 'GET',
                headers: headers,
                mode: 'cors',
                cache: 'no-cache'
            });

            console.log('JSONhost response status:', response.status);
            
            if (response.ok) {
                const cloudData = await response.json();
                console.log('JSONhost data received:', cloudData);
                
                const statusText = 'JSONhost (Read/Write)';
                this.processCloudData(cloudData, statusText);
            } else if (response.status === 404) {
                // JSON file doesn't exist yet, create initial structure
                console.log('JSONhost file not found, will create on first save');
                this.updateSyncStatus('synced', 'JSONhost (Ready)', true);
            } else {
                const errorText = await response.text();
                console.error('JSONhost error response:', errorText);
                throw new Error(`JSONhost returned ${response.status}: ${response.statusText}`);
            }
        } catch (fetchError) {
            console.error('JSONhost fetch error:', fetchError);
            console.error('Error details:', {
                name: fetchError.name,
                message: fetchError.message,
                stack: fetchError.stack
            });
            
            // More specific error handling
            if (fetchError.name === 'TypeError') {
                if (fetchError.message.includes('Failed to fetch')) {
                    throw new Error('CORS or network error - JSONhost.com may not allow cross-origin requests from this domain');
                } else if (fetchError.message.includes('NetworkError')) {
                    throw new Error('Network error - check internet connection and JSONhost.com accessibility');
                }
            }
            
            throw new Error(`JSONhost sync failed: ${fetchError.message}`);
        }
    }


    processCloudData(cloudData, serviceName) {
        console.log('Processing cloud data:', cloudData);
        console.log('🔍 DEBUG: Cloud data structure:', {
            hasNotices: !!(cloudData && cloudData.notices),
            hasForms: !!(cloudData && cloudData.forms),
            noticesCount: cloudData?.notices?.length || 0,
            formsCount: cloudData?.forms?.length || 0
        });
        
        // Process notices data
        if (cloudData && cloudData.notices) {
            const cloudNotices = cloudData.notices;
            const cloudLastUpdated = new Date(cloudData.lastUpdated || 0);
            const localLastUpdated = new Date(this.lastSyncTime || 0);
            
            console.log('Cloud last updated:', cloudLastUpdated);
            console.log('Local last updated:', localLastUpdated);
            console.log('Should update:', cloudLastUpdated > localLastUpdated);

            // Smart merge: preserve local attachments if cloud data lacks them
            if (!this.lastSyncTime || cloudLastUpdated > localLastUpdated) {
                console.log('Merging cloud data with local data');
                
                // Create a map of local notices for quick lookup
                const localNoticesMap = new Map(this.notices.map(notice => [notice.id, notice]));
                
                // Merge cloud notices with local attachments, handling compressed/placeholder attachments
                const mergedNotices = cloudNotices.map(cloudNotice => {
                    const localNotice = localNoticesMap.get(cloudNotice.id);
                    
                    // If both have attachments, merge them intelligently
                    if (cloudNotice.attachments && localNotice && localNotice.attachments) {
                        const mergedAttachments = cloudNotice.attachments.map(cloudAttachment => {
                            // If it's a placeholder, try to restore from local
                            if (cloudAttachment.isPlaceholder) {
                                const localAttachment = localNotice.attachments.find(la => la.name === cloudAttachment.name);
                                if (localAttachment) {
                                    console.log(`Restoring full file from local: ${cloudAttachment.name}`);
                                    return localAttachment;
                                }
                            }
                            return cloudAttachment;
                        });
                        
                        return { ...cloudNotice, attachments: mergedAttachments };
                    }
                    
                    // If local notice has attachments but cloud notice doesn't, preserve local attachments
                    if (localNotice && localNotice.attachments && !cloudNotice.attachments) {
                        console.log(`Preserving local attachments for notice ${cloudNotice.id}`);
                        return { ...cloudNotice, attachments: localNotice.attachments };
                    }
                    
                    return cloudNotice;
                });
                
                this.notices = mergedNotices;
                this.lastUpdateTime = cloudData.lastUpdated; // Track when content was last changed
                localStorage.setItem('lastUpdateTime', this.lastUpdateTime);
                this.saveToStorage();
                this.applyFiltersAndSort();
                this.render();
                console.log('Data merged successfully');
            } else {
                console.log('Local data is up to date');
            }
        } else {
            console.log('No valid cloud data or notices array found');
        }

        // Process forms data
        if (cloudData && cloudData.forms) {
            console.log('📋 Syncing forms data from cloud');
            console.log('🔍 DEBUG: Cloud forms:', cloudData.forms);
            const cloudForms = cloudData.forms;
            const localForms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
            console.log('🔍 DEBUG: Local forms before merge:', localForms);
            
            // Merge forms: prefer newer versions based on lastModified or timestamp
            const mergedForms = this.mergeForms(localForms, cloudForms);
            console.log('🔍 DEBUG: Merged forms result:', mergedForms);
            
            // Save merged forms to localStorage
            localStorage.setItem('smp-forms', JSON.stringify(mergedForms));
            console.log(`📋 Forms synced: ${mergedForms.length} forms`);
        } else {
            console.log('❌ No forms data found in cloud');
            console.log('🔍 DEBUG: cloudData.forms is:', cloudData?.forms);
        }

        this.lastSyncTime = new Date().toISOString();
        this.updateSyncStatus('synced', `Synced via ${serviceName}`, true);
    }

    async uploadToCloud() {
        const config = window.CLOUD_CONFIG;
        
        if (config.service === 'jsonhost' && this.isJsonhostConfigValid()) {
            try {
                await this.uploadToJsonhost();
                console.log('Data uploaded to JSONhost successfully');
            } catch (error) {
                console.error('Failed to upload to JSONhost:', error);
                
                // Handle CORS-specific errors gracefully
                if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
                    this.showToast('Cloud sync disabled: CORS restriction. Data saved locally only.', 'warning');
                    this.updateSyncStatus('offline', 'Local storage only (CORS restriction)');
                    this.cloudWriteEnabled = false;
                } else {
                    this.showToast('Failed to sync data to cloud', 'error');
                }
            }
        } else {
            console.log('JSONhost not properly configured - data saved locally only');
            this.updateSyncStatus('offline', 'Local storage only');
        }
    }

    async uploadToJsonhost() {
        const config = window.CLOUD_CONFIG.jsonhost;
        if (!this.isJsonhostConfigValid()) {
            throw new Error('JSONhost configuration invalid');
        }

        // Get existing cloud data to preserve all information
        let existingCloudData = {};
        try {
            const cloudResponse = await fetch(`${config.baseUrl}${config.jsonId}`);
            if (cloudResponse.ok) {
                existingCloudData = await cloudResponse.json();
            }
        } catch (error) {
            console.log('No existing cloud data found, creating new structure');
        }

        // Optimize notices for cloud sync by compressing attachments
        const optimizedNotices = await this.optimizeNoticesForCloud(this.notices);
        
        // Get forms data for cloud sync
        const formsData = JSON.parse(localStorage.getItem('smp-forms') || '[]');

        // Preserve existing cloud forms if they exist and merge with local
        const cloudForms = existingCloudData.forms || [];
        const mergedForms = this.mergeForms(formsData, cloudForms);

        const data = {
            notices: optimizedNotices,
            forms: mergedForms,
            lastUpdated: new Date().toISOString(),
            version: "1.0",
            metadata: {
                title: "SMP College Notice Board",
                description: "Official notices and announcements",
                totalNotices: this.notices.length,
                totalForms: mergedForms.length,
                service: "jsonhost"
            }
        };

        // Log data size and attachment info for debugging
        const originalSize = JSON.stringify({...data, notices: this.notices, forms: mergedForms}).length;
        const cloudSize = JSON.stringify(data).length;
        const attachmentCount = this.notices.reduce((count, notice) => 
            count + (notice.attachments ? notice.attachments.length : 0), 0);
        const jsonhostLimit = 101 * 1024; // 101KB limit
        
        console.log(`📊 Payload Analysis:`);
        console.log(`Original size: ${(originalSize/1024).toFixed(1)}KB`);
        console.log(`Cloud size: ${(cloudSize/1024).toFixed(1)}KB`);
        console.log(`JSONhost limit: ${(jsonhostLimit/1024).toFixed(1)}KB`);
        console.log(`Notices: ${this.notices.length}, Forms: ${mergedForms.length}`);
        console.log(`Attachments: ${attachmentCount}`);
        console.log(`Within limit: ${cloudSize <= jsonhostLimit ? '✅' : '❌'}`);
        console.log('🔍 DEBUG: Upload data structure:', {
            hasNotices: !!data.notices,
            hasForms: !!data.forms,
            noticesCount: data.notices?.length || 0,
            formsCount: data.forms?.length || 0,
            formsData: data.forms
        });
        
        if (cloudSize > jsonhostLimit) {
            console.warn(`⚠️ Payload too large for JSONhost (${(cloudSize/1024).toFixed(1)}KB > ${(jsonhostLimit/1024).toFixed(1)}KB)`);
            this.showToast(`Upload too large (${(cloudSize/1024).toFixed(1)}KB). Try smaller files or enable Google Drive.`, 'warning');
        }

        const jsonUrl = `${config.baseUrl}${config.jsonId}`;
        console.log('Uploading data to JSONhost:', jsonUrl);

        try {
            const response = await fetch(jsonUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': config.apiToken
                },
                mode: 'cors',
                body: JSON.stringify(data)
            });

            console.log('JSONhost upload response status:', response.status);

            if (response.ok) {
                this.showToast('Data synced to cloud successfully', 'success');
                this.updateSyncStatus('synced', 'JSONhost (Read/Write)', true);
                return response;
            } else {
                const errorText = await response.text();
                console.error('JSONhost upload error response:', errorText);
                
                if (response.status === 401) {
                    throw new Error('Invalid API token - check your JSONhost authorization token');
                } else if (response.status === 403) {
                    throw new Error('POST requests not enabled - enable POST/PATCH API in JSONhost admin settings');
                } else {
                    throw new Error(`JSONhost error ${response.status}: ${response.statusText}`);
                }
            }
        } catch (fetchError) {
            console.error('JSONhost upload fetch error:', fetchError);
            
            if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
                throw new Error('Network error - check internet connection and CORS settings');
            }
            
            throw fetchError;
        }
    }

    async optimizeNoticesForCloud(notices) {
        console.log('🔧 Optimizing notices for cloud sync...');
        console.log(`🔧 File hosting status: ready=${this.fileHostingReady}, service=${this.fileHostingService}`);
        
        const optimizedNotices = await Promise.all(notices.map(async notice => {
            if (!notice.attachments || notice.attachments.length === 0) {
                return notice;
            }

            console.log(`Processing ${notice.attachments.length} attachments for notice: ${notice.title}`);
            
            const optimizedAttachments = await Promise.all(notice.attachments.map(async attachment => {
                // If it's already a hosted file, keep the reference
                if (attachment.hostedFile || attachment.driveFile) {
                    console.log(`✅ File already hosted: ${attachment.name}`);
                    return attachment;
                }

                // Skip external file hosting due to CORS restrictions
                // Most file hosting services don't support browser CORS uploads
                console.log(`📁 Processing file ${attachment.name} (${this.formatFileSize(attachment.size)}) for cloud sync...`);

                // For small files (under 100KB), include directly in cloud sync
                if (attachment.size < 102400) { // 100KB - increased threshold
                    console.log(`✅ Small file ${attachment.name}, including directly in cloud sync`);
                    return attachment;
                }

                // For images, try aggressive compression
                if (attachment.type.startsWith('image/')) {
                    console.log(`🖼️ Compressing image: ${attachment.name} (${this.formatFileSize(attachment.size)})`);
                    const compressed = await this.compressImage(attachment);
                    
                    // If compressed image is under 200KB, include it
                    if (compressed.size < 204800) { // 200KB limit for compressed images
                        console.log(`✅ Compressed image fits: ${attachment.name} (${this.formatFileSize(compressed.size)})`);
                        return compressed;
                    } else {
                        console.log(`⚠️ Compressed image still large: ${attachment.name} (${this.formatFileSize(compressed.size)}), creating reference`);
                        return {
                            name: attachment.name,
                            type: attachment.type,
                            size: attachment.size,
                            isPlaceholder: true,
                            originalSize: attachment.size,
                            note: 'Large image - compressed version available locally',
                            thumbnailData: compressed.data // Include compressed version as thumbnail
                        };
                    }
                }

                // For PDFs and documents, create a reference but keep locally
                if (attachment.type.includes('pdf') || attachment.type.includes('document') || attachment.type.includes('text')) {
                    console.log(`📄 Large document: ${attachment.name} (${this.formatFileSize(attachment.size)}) - creating reference`);
                    return {
                        name: attachment.name,
                        type: attachment.type,
                        size: attachment.size,
                        isPlaceholder: true,
                        originalSize: attachment.size,
                        note: 'Large document - available locally only'
                    };
                }

                // For all other large files, create a placeholder
                console.log(`📦 Large file: ${attachment.name} (${this.formatFileSize(attachment.size)}) - creating reference`);
                return {
                    name: attachment.name,
                    type: attachment.type,
                    size: attachment.size,
                    isPlaceholder: true,
                    originalSize: attachment.size,
                    note: 'Large file - available locally only'
                };
            }));

            return { ...notice, attachments: optimizedAttachments };
        }));

        console.log('Notice optimization completed');
        return optimizedNotices;
    }

    async compressImage(attachment) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Start with more aggressive dimensions for better compression
                let { width, height } = img;
                const maxWidth = 1280; // Reduced from 1920
                const maxHeight = 720; // Reduced from 1080

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Try different quality and dimension combinations
                let compressedData;
                let attempts = 0;
                const maxAttempts = 5;
                
                // Start with moderate quality
                let quality = 0.6;
                compressedData = canvas.toDataURL('image/jpeg', quality);
                
                // If too large, progressively reduce quality and size
                while (compressedData.length > 204800 && attempts < maxAttempts) { // Target 200KB
                    attempts++;
                    
                    if (attempts <= 2) {
                        // First, try reducing quality
                        quality = Math.max(0.2, quality - 0.2);
                        compressedData = canvas.toDataURL('image/jpeg', quality);
                    } else {
                        // Then reduce dimensions
                        width = Math.floor(width * 0.8);
                        height = Math.floor(height * 0.8);
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        compressedData = canvas.toDataURL('image/jpeg', 0.4);
                    }
                }

                const compressedSize = Math.round(compressedData.length * 0.75); // Approximate actual size
                
                console.log(`Image compressed: ${attachment.name} ${this.formatFileSize(attachment.size)} → ${this.formatFileSize(compressedSize)}`);
                
                resolve({
                    ...attachment,
                    data: compressedData,
                    size: compressedSize,
                    compressed: true,
                    originalSize: attachment.size
                });
            };
            
            img.onerror = () => {
                console.log(`Failed to compress image: ${attachment.name}, using original`);
                resolve(attachment);
            };
            
            img.src = attachment.data;
        });
    }

    async initializeFileHosting() {
        console.log('🔧 File Hosting Initialization Started');
        console.log('Using 0x0.st for file hosting with 30 days to 1 year retention');
        
        try {
            // Test 0x0.st API availability
            const testResponse = await fetch('https://0x0.st/', {
                method: 'HEAD'
            });
            
            if (testResponse.ok) {
                console.log('✅ 0x0.st service is available');
            } else {
                console.log('⚠️ 0x0.st service check returned:', testResponse.status);
            }
            
            this.fileHostingReady = true;
            this.showToast('File hosting ready (0x0.st)', 'success');
            this.updateSyncStatus('synced', 'File hosting connected');
            
        } catch (error) {
            console.warn('⚠️ 0x0.st service check failed, but proceeding:', error.message);
            this.fileHostingReady = true;
            this.updateSyncStatus('synced', 'File hosting ready');
        }
    }

    // Test file hosting upload functionality
    async testFileHosting() {
        console.log('🧪 Testing file hosting functionality...');
        
        try {
            // Create a small test file
            const testContent = 'This is a test file for 0x0.st hosting - ' + new Date().toISOString();
            const testBlob = new Blob([testContent], { type: 'text/plain' });
            
            const testFile = {
                name: 'test-upload.txt',
                type: 'text/plain',
                size: testBlob.size,
                data: `data:text/plain;base64,${btoa(testContent)}`
            };
            
            const result = await this.uploadFileToHosting(testFile, testFile.name);
            console.log('✅ Test upload successful:', result);
            this.showToast('File hosting test successful', 'success');
            return result;
            
        } catch (error) {
            console.error('❌ File hosting test failed:', error);
            this.showToast('File hosting test failed', 'error');
            throw error;
        }
    }

    async uploadFileToHosting(file, fileName) {
        if (!this.fileHostingReady) {
            throw new Error('File hosting not ready');
        }

        const maxRetries = 3;
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📤 Uploading ${fileName} to 0x0.st (attempt ${attempt}/${maxRetries})...`);
                
                // Convert base64 to blob
                if (!file.data) {
                    throw new Error('No file data provided');
                }
                
                const base64Data = file.data.split(',')[1];
                if (!base64Data) {
                    throw new Error('Invalid base64 data format');
                }
                
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: file.type });
                
                console.log(`Blob created: ${blob.size} bytes, type: ${blob.type}`);

                // Create FormData for 0x0.st upload
                const formData = new FormData();
                formData.append('file', blob, fileName);

                const response = await fetch('https://0x0.st/', {
                    method: 'POST',
                    body: formData
                });

                console.log(`Response status: ${response.status} ${response.statusText}`);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Upload error response:`, errorText);
                    throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
                }

                const responseText = await response.text();
                console.log(`0x0.st response:`, responseText);
                
                // 0x0.st returns just the URL as plain text
                if (!responseText || !responseText.startsWith('https://')) {
                    throw new Error(`Upload failed: Invalid response - ${responseText}`);
                }

                const fileUrl = responseText.trim();
                console.log(`✅ File uploaded successfully: ${fileName} (URL: ${fileUrl})`);
                
                return {
                    id: fileUrl.split('/').pop(), // Use filename from URL as ID
                    name: fileName,
                    type: file.type,
                    size: file.size,
                    url: fileUrl,
                    hostedFile: true,
                    service: '0x0.st',
                    uploadDate: new Date().toISOString(),
                    expires: '30 days to 1 year' // 0x0.st retention based on file size
                };
                
            } catch (error) {
                console.error(`❌ 0x0.st upload error (attempt ${attempt}/${maxRetries}):`, error);
                lastError = error;
                
                // If it's the last attempt, throw
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Wait before retrying with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    // File hosting service provides direct URLs, no download function needed
    getFileUrl(attachment) {
        if (attachment.hostedFile && attachment.url) {
            return attachment.url;
        }
        if (attachment.driveFile && attachment.webViewLink) {
            return attachment.webViewLink;
        }
        if (attachment.data) {
            return attachment.data; // Base64 data URL
        }
        return null;
    }

    // Debug function to test file hosting setup
    async debugFileHosting() {
        console.log('🔍 File Hosting Debug Test');
        console.log('==========================');
        
        // Test 1: Check configuration
        const config = window.CLOUD_CONFIG?.fileHosting;
        console.log('Test 1: Configuration check');
        console.log('Config:', {
            exists: !!config,
            enabled: config?.enabled,
            service: config?.service,
            maxFileSize: config?.maxFileSize
        });

        if (!config?.enabled) {
            console.error('❌ File hosting not enabled');
            return false;
        }
        console.log('✅ File hosting enabled');

        // Test 2: Check service availability
        console.log('Test 2: Testing pCloud service availability...');
        try {
            const testResponse = await fetch('https://api.pcloud.com/getapiserver');
            if (testResponse.ok) {
                const result = await testResponse.json();
                console.log('✅ pCloud service accessible, API server:', result.api[0]);
            } else {
                console.log('⚠️ pCloud API test failed, but service likely available');
            }
        } catch (error) {
            console.log('⚠️ pCloud API test failed (CORS/network), service likely available');
        }

        // Test 3: Check application state
        console.log('Test 3: Application state');
        console.log('File hosting state:', {
            ready: this.fileHostingReady,
            service: this.fileHostingService,
            maxFileSize: this.maxFileSize
        });

        // Test 4: Test actual upload
        console.log('Test 4: Testing file upload...');
        try {
            const result = await this.testFileHosting();
            console.log('✅ File upload test successful:', result.url);
            return true;
        } catch (error) {
            console.error('❌ File upload test failed:', error);
            return false;
        }
    }

    // Manual function to retry file hosting initialization
    async retryFileHosting() {
        console.log('🔄 Manually retrying file hosting initialization...');
        this.fileHostingReady = false;
        this.updateSyncStatus('syncing', 'Retrying file hosting...');
        
        try {
            await this.initializeFileHosting();
            if (this.fileHostingReady) {
                console.log('✅ File hosting retry successful');
                this.showToast('File hosting connected successfully', 'success');
                return true;
            } else {
                console.log('❌ File hosting retry failed');
                this.showToast('File hosting retry failed', 'error');
                return false;
            }
        } catch (error) {
            console.error('❌ File hosting retry error:', error);
            this.showToast('File hosting retry failed', 'error');
            return false;
        }
    }

    updateSyncStatus(status, message, autoHide = false) {
        this.syncStatus.className = `sync-status ${status}`;
        this.syncStatus.innerHTML = `
            <i class="fas fa-${this.getSyncIcon(status)}"></i>
            <span>${message}</span>
        `;
        
        // Auto-hide sync status and show developer info if requested
        if (autoHide) {
            setTimeout(() => {
                this.showDeveloperInfo();
            }, 2000); // Hide sync status after 2 seconds
        }
    }
    
    showDeveloperInfo() {
        this.syncStatus.className = 'sync-status developer-info';
        this.syncStatus.innerHTML = `
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">Developed by Thejaraj R, SMP</span>
        `;
        
        // Show updates info after developer info
        setTimeout(() => {
            this.showUpdatesInfo();
        }, 5000);
    }
    
    showUpdatesInfo() {
        this.syncStatus.className = 'sync-status updates-info';
        const lastUpdateText = this.lastUpdateTime 
            ? `Last updated: ${this.formatLastUpdateTime(this.lastUpdateTime)}`
            : 'No recent updates';
        
        this.syncStatus.innerHTML = `
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">
                Visit daily for updates • ${lastUpdateText}
            </span>
        `;
        
        // Make this message static - don't hide it
        // Remove the setTimeout that was hiding the message
    }
    
    formatLastUpdateTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMins < 60) {
            return diffMins <= 1 ? 'Just now' : `${diffMins} min ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
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
        
        // Apply new theme with built-in smooth transitions
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

    updateActiveFilterButton(activeBtn) {
        this.filterButtons.forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }

    async handleCategoryFilter(category) {
        this.currentFilter = category;
        this.applyFiltersAndSort();
        await this.render();
    }

    updateCategoryTabs() {
        // Get all available categories from current notices
        const availableCategories = [...new Set(this.notices.map(notice => notice.category))];
        
        // Get all filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        filterButtons.forEach(btn => {
            const category = btn.dataset.category;
            
            // Always show 'All' button
            if (category === 'all') {
                btn.style.display = 'block';
                return;
            }
            
            // Show/hide other category buttons based on availability
            if (availableCategories.includes(category)) {
                btn.style.display = 'block';
            } else {
                btn.style.display = 'none';
            }
        });
    }

    applyFiltersAndSort() {
        let filtered = [...this.notices];

        // Apply category filter
        if (this.currentFilter && this.currentFilter !== 'all') {
            filtered = filtered.filter(notice => notice.category === this.currentFilter);
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
                    // Secondary sort by order
                    const dateComparison = new Date(b.date) - new Date(a.date);
                    return dateComparison !== 0 ? dateComparison : (a.order || 99) - (b.order || 99);
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
                case 'order':
                    return (a.order || 99) - (b.order || 99);
                default:
                    // Primary sort by order, then by date
                    const orderComparison = (a.order || 99) - (b.order || 99);
                    return orderComparison !== 0 ? orderComparison : new Date(b.date) - new Date(a.date);
            }
        });

        this.filteredNotices = filtered;
    }

    async render() {
        // Check forms availability before rendering notices
        const formsData = JSON.parse(localStorage.getItem('smp-forms') || '[]');
        console.log('🔍 DEBUG: Forms available during render:', {
            formsCount: formsData.length,
            formIds: formsData.map(f => f.id)
        });
        
        if (this.filteredNotices.length === 0) {
            this.noticesContainer.innerHTML = '';
            this.emptyState.style.display = 'block';
        } else {
            this.emptyState.style.display = 'none';
            await this.renderNotices();
        }
        this.renderActiveTags();
        this.updateCategoryTabs();
    }

    async renderNotices() {
        const noticesHTML = await Promise.all(
            this.filteredNotices.map((notice, index) => this.createNoticeCard(notice, index + 1))
        );
        this.noticesContainer.innerHTML = noticesHTML.join('');
        
        // Simple scrolling animations are handled by CSS
        
        // Add event listeners to notice cards
        this.filteredNotices.forEach(notice => {
            const card = document.querySelector(`[data-notice-id="${notice.id}"]`);
            if (card) {
                // Removed card click popup functionality

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
                
                // Add scrolling content click listener only if popup is enabled
                const scrollingContent = card.querySelector('.scrolling-message-inline');
                if (scrollingContent && notice.popupEnabled !== false) {
                    scrollingContent.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.showScrollingDataModal(notice);
                    });
                    scrollingContent.style.cursor = 'pointer';
                    scrollingContent.classList.add('scrolling-data-clickable');
                } else if (scrollingContent) {
                    // Reset cursor and classes if popup is disabled
                    scrollingContent.style.cursor = 'default';
                    scrollingContent.classList.remove('scrolling-data-clickable');
                }
            }
        });

        // Add form submission event listeners
        const noticeForms = document.querySelectorAll('.notice-form');
        noticeForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmission(form);
            });
            
            // Add progress tracking for scrollable forms
            if (form.classList.contains('scrollable-form')) {
                this.setupFormProgressTracking(form);
            }
        });

        // Add form toggle event listeners
        const toggleFormBtns = document.querySelectorAll('.toggle-form-btn');
        toggleFormBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFormVisibility(btn.dataset.formId);
            });
        });
    }

    async createNoticeCard(notice, serialNumber) {
        const deadlineInfo = this.getDeadlineInfo(notice.deadline);
        const categoryClass = `category-${notice.category.replace(/\s+/g, '-')}`;
        const priorityClass = `priority-${notice.priority}`;
        
        // Add order class for top 3 positions to enable animations
        const orderClass = (notice.order >= 1 && notice.order <= 3) ? `order-${notice.order}` : '';
        
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
        
        // Process content with URL detection
        const processedContent = this.processContentWithURLs(notice.content);
        
        // Create attachments display
        const attachmentsHTML = this.createAttachmentsDisplay(notice.attachments);
        
        // Format serial number with leading zero
        const formattedSerialNumber = serialNumber.toString().padStart(2, '0');
        
        // Add scrolling CSV content if enabled
        let scrollingHTML = '';
        if (notice.scrollingEnabled && notice.scrollingLabel) {
            const csvFileNumber = notice.order || 1;
            console.log(`Adding scrolling content for notice "${notice.title}" using CSV ${csvFileNumber}`);
            
            if (this.csvData[csvFileNumber]) {
                console.log(`CSV data found for file ${csvFileNumber}, creating scrolling text`);
                scrollingHTML = this.createScrollingTextHTML(this.csvData[csvFileNumber], notice.scrollingLabel, notice.scrollingSpeed);
            } else {
                console.log(`No CSV data found for file ${csvFileNumber}`);
                scrollingHTML = `
                    <div class="scrolling-message">
                        <h4 class="scrolling-label">${notice.scrollingLabel}</h4>
                        <div class="scrolling-content">
                            <p style="color: #999; font-style: italic;">No data available</p>
                        </div>
                    </div>
                `;
            }
        }

        // Add form capture content if enabled
        let formHTML = '';
        console.log(`🔍 DEBUG: Notice "${notice.title}" form check:`, {
            formCaptureEnabled: notice.formCaptureEnabled,
            formId: notice.formId,
            hasFormData: !!notice.formData
        });
        if (notice.formCaptureEnabled && notice.formId) {
            console.log(`✅ Creating form HTML for notice "${notice.title}" with formId: ${notice.formId}`);
            formHTML = this.createFormHTML(notice.formId, notice);
        } else {
            console.log(`❌ No form for notice "${notice.title}" - formCaptureEnabled: ${notice.formCaptureEnabled}, formId: ${notice.formId}`);
        }

        return `
            <div class="notice-card priority-${notice.priority}-card" data-notice-id="${notice.id}">
                <div class="notice-card-header ${priorityClass} ${orderClass}">
                    <div class="header-top">
                        <h3 class="notice-title">${notice.title}</h3>
                        <div class="header-right">
                            <div class="notice-serial-number">${formattedSerialNumber}</div>
                            ${adminActions}
                        </div>
                    </div>
                    <div class="header-meta">
                        <span class="category-info">
                            ${this.getCategoryIcon(notice.category)} ${notice.category}
                        </span>
                        <span class="priority-info">
                            <i class="fas fa-flag"></i> ${notice.priority.toUpperCase()}
                        </span>
                        ${deadlineInfo ? `
                            <span class="deadline-info ${deadlineInfo.class}">
                                <i class="fas fa-clock"></i> ${deadlineInfo.text}
                            </span>
                        ` : ''}
                    </div>
                </div>
                <div class="notice-card-body">
                    <div class="notice-meta">
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
                        ${processedContent}
                    </div>
                    ${scrollingHTML}
                    ${formHTML}
                    ${attachmentsHTML}
                    ${tagsHTML ? `
                        <div class="notice-tags">${tagsHTML}</div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    getCategoryIcon(category) {
        const icons = {
            academic: 'fas fa-graduation-cap',
            admission: 'fas fa-door-open',
            civil: 'fas fa-hard-hat',
            cs: 'fas fa-laptop-code',
            ec: 'fas fa-microchip',
            ee: 'fas fa-bolt',
            events: 'fas fa-calendar-alt',
            exams: 'fas fa-file-alt',
            'fee-payments': 'fas fa-credit-card',
            library: 'fas fa-book',
            mech: 'fas fa-cogs',
            office: 'fas fa-building',
            placement: 'fas fa-briefcase',
            results: 'fas fa-chart-line',
            scholarship: 'fas fa-award',
            urgent: 'fas fa-exclamation-triangle'
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
        // Skip rendering active tags if container doesn't exist (not used in current design)
        if (!this.activeTagsContainer) {
            return;
        }
        
        if (this.activeTags.size === 0) {
            this.activeTagsContainer.innerHTML = '';
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

        this.activeTagsContainer.innerHTML = tagsHTML;

        // Add event listeners to remove buttons
        this.activeTagsContainer.querySelectorAll('.remove-tag').forEach(btn => {
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
        this.populateOrderOptions();
        
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

    populateOrderOptions() {
        const orderSelect = document.getElementById('noticeOrder');
        if (!orderSelect) return;

        // Only show 3 manual orders + Next option
        let options = '';
        options += `<option value="1">1st Position</option>`;
        options += `<option value="2">2nd Position</option>`;
        options += `<option value="3">3rd Position</option>`;
        options += `<option value="auto">Next Available Position</option>`;
        
        orderSelect.innerHTML = options;
        orderSelect.value = 'auto'; // Default to next available
    }

    getNextAvailableOrder() {
        if (this.notices.length === 0) return 1;
        
        const usedOrders = this.notices.map(notice => notice.order || 99).sort((a, b) => a - b);
        const maxOrder = Math.max(...usedOrders);
        
        // Ensure we start from at least order 4 for auto-assigned notices
        return Math.max(maxOrder + 1, 4);
    }
    
    swapNoticeOrders(newOrder, currentNoticeId = null) {
        // Find notice currently in the target order position
        const existingNotice = this.notices.find(notice => 
            notice.order === newOrder && notice.id !== currentNoticeId
        );
        
        if (existingNotice) {
            // Calculate next available order before swapping
            const nextOrder = this.getNextAvailableOrder();
            // Move the existing notice to the next available order
            existingNotice.order = nextOrder;
            console.log(`Swapped: Moved notice "${existingNotice.title}" from order ${newOrder} to order ${existingNotice.order}`);
        }
    }
    
    calculateNoticeOrder() {
        const orderSelect = document.getElementById('noticeOrder');
        const selectedValue = orderSelect.value;
        
        console.log(`Calculating order for selected value: ${selectedValue}`);
        
        if (selectedValue === 'auto') {
            const autoOrder = this.getNextAvailableOrder();
            console.log(`Auto order assigned: ${autoOrder}`);
            return autoOrder;
        } else {
            const manualOrder = parseInt(selectedValue);
            console.log(`Manual order selected: ${manualOrder}`);
            
            // Handle order swapping for manual orders (1, 2, 3)
            if (manualOrder >= 1 && manualOrder <= 3) {
                this.swapNoticeOrders(manualOrder, this.currentEditingNotice?.id);
            }
            return manualOrder;
        }
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
        this.quillEditor.root.innerHTML = notice.content;
        
        // Populate tags
        this.currentTags = notice.tags ? [...notice.tags] : [];
        this.renderTagsDisplay();
        
        // Populate attachments
        this.currentAttachments = notice.attachments ? [...notice.attachments] : [];
        this.renderAttachmentsPreview();
        
        // Populate scrolling options
        this.scrollingEnabled.checked = notice.scrollingEnabled || false;
        this.scrollingLabel.value = notice.scrollingLabel || '';
        this.scrollingSpeed.value = notice.scrollingSpeed || 'medium';
        this.popupEnabled.checked = notice.popupEnabled !== false; // Default to true
        this.formCaptureEnabled.checked = notice.formCaptureEnabled || false;
        this.scrollingOptions.style.display = notice.scrollingEnabled ? 'block' : 'none';
        
        // Update Data Capture button text based on whether form exists
        if (this.dataCaptureBtn) {
            if (notice.formId) {
                this.dataCaptureBtn.innerHTML = '<i class="fas fa-edit"></i> Update Form';
                this.dataCaptureBtn.title = 'Update Data Capture Form';
                // Set the current editing form ID
                this.currentEditingFormId = notice.formId;
            } else {
                this.dataCaptureBtn.innerHTML = '<i class="fas fa-poll"></i> Data Capture';
                this.dataCaptureBtn.title = 'Create Data Capture Form';
                this.currentEditingFormId = null;
            }
        }
        
        // Set order
        const orderSelect = document.getElementById('noticeOrder');
        if (orderSelect) {
            const currentOrder = notice.order || this.getNextAvailableOrder();
            // If it's one of the top 3 positions, show that, otherwise show auto
            if (currentOrder >= 1 && currentOrder <= 3) {
                orderSelect.value = currentOrder.toString();
            } else {
                orderSelect.value = 'auto';
            }
        }
    }

    resetForm() {
        this.noticeForm.reset();
        this.noticeDate.value = new Date().toISOString().split('T')[0];
        this.quillEditor.root.innerHTML = '';
        this.currentTags = [];
        this.currentAttachments = [];
        this.scrollingEnabled.checked = false;
        this.scrollingLabel.value = '';
        this.scrollingSpeed.value = 'medium';
        this.popupEnabled.checked = true; // Default to enabled
        this.formCaptureEnabled.checked = false; // Default to disabled
        this.scrollingOptions.style.display = 'none';
        this.renderTagsDisplay();
        this.renderAttachmentsPreview();
        
        // Reset Data Capture button text
        if (this.dataCaptureBtn) {
            this.dataCaptureBtn.innerHTML = '<i class="fas fa-poll"></i> Data Capture';
            this.dataCaptureBtn.title = 'Create Data Capture Form';
        }
        
        // Reset form editing session
        this.currentEditingFormId = null;
    }

    handleFormSubmit(e) {
        e.preventDefault();
        console.log('Form submitted');
        
        if (!this.validateForm()) {
            console.log('Form validation failed');
            return;
        }
        console.log('Form validation passed');

        const formData = this.getFormData();
        console.log('Form data extracted:', formData);
        
        if (this.currentEditingNotice) {
            console.log('Updating existing notice');
            this.updateNotice(this.currentEditingNotice.id, formData);
        } else {
            console.log('Adding new notice');
            this.addNotice(formData);
        }
        
        this.hideNoticeModal();
        console.log('Modal hidden');
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
        return {
            title: this.noticeTitle.value.trim(),
            content: this.quillEditor.root.innerHTML,
            category: this.noticeCategory.value,
            priority: this.noticePriority.value,
            date: this.noticeDate.value,
            deadline: this.noticeDeadline.value || null,
            author: this.noticeAuthor.value.trim(),
            tags: this.currentTags.length > 0 ? this.currentTags : null,
            attachments: this.currentAttachments.length > 0 ? this.currentAttachments : null,
            scrollingEnabled: this.scrollingEnabled.checked,
            scrollingLabel: this.scrollingLabel.value.trim() || null,
            scrollingSpeed: this.scrollingSpeed.value || 'medium',
            popupEnabled: this.popupEnabled.checked,
            formCaptureEnabled: this.formCaptureEnabled.checked,
            formId: this.currentForm?.id || this.currentEditingFormId || null,
            formData: this.currentForm || null,
            order: this.calculateNoticeOrder(),
            timestamp: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
    }

    addNotice(noticeData) {
        console.log('Adding notice with data:', noticeData);
        
        const notice = {
            id: Date.now().toString(),
            ...noticeData
        };

        console.log('Generated notice object:', notice);
        console.log('Notice has attachments:', notice.attachments ? notice.attachments.length : 0);
        
        this.notices.unshift(notice);
        console.log('Updated notices array:', this.notices);
        
        this.saveToStorage();
        console.log('Saved to localStorage');
        
        // Don't let cloud upload errors prevent local saving
        this.lastUpdateTime = new Date().toISOString();
        localStorage.setItem('lastUpdateTime', this.lastUpdateTime);
        
        this.uploadToCloud().catch(error => {
            console.log('Cloud upload failed, but notice saved locally:', error.message);
        });
        
        this.applyFiltersAndSort();
        this.render();
        this.showToast('Notice added successfully', 'success');
        console.log('Notice addition completed');
    }

    updateNotice(id, noticeData) {
        const index = this.notices.findIndex(notice => notice.id === id);
        if (index !== -1) {
            this.notices[index] = {
                ...this.notices[index],
                ...noticeData,
                lastModified: new Date().toISOString()
            };
            this.lastUpdateTime = new Date().toISOString();
            localStorage.setItem('lastUpdateTime', this.lastUpdateTime);
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
            this.lastUpdateTime = new Date().toISOString();
            localStorage.setItem('lastUpdateTime', this.lastUpdateTime);
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
        
        // Process content with URLs and add attachments display
        const processedContent = this.processContentWithURLs(notice.content);
        const attachmentsHTML = this.createAttachmentsDisplay(notice.attachments);
        
        document.getElementById('noticeContentDisplay').innerHTML = processedContent + attachmentsHTML;
        
        // Show/hide admin buttons
        const adminButtons = document.querySelectorAll('#detailsModal .admin-only');
        adminButtons.forEach(btn => {
            btn.style.display = this.isAdmin ? 'block' : 'none';
        });
        
        this.detailsModal.classList.add('show');
        
        // Auto-hide modal after 10 seconds
        if (this.detailsModalTimer) {
            clearTimeout(this.detailsModalTimer);
        }
        this.detailsModalTimer = setTimeout(() => {
            this.hideDetailsModal();
        }, 10000);
    }

    hideDetailsModal() {
        this.detailsModal.classList.remove('show');
        this.currentDetailNotice = null;
        
        // Clear auto-hide timer if modal is manually closed
        if (this.detailsModalTimer) {
            clearTimeout(this.detailsModalTimer);
            this.detailsModalTimer = null;
        }
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
            this.render(); // Re-render notices to show admin controls
            this.hideAdminModal();
            this.showToast('Admin login successful', 'success', 1000);
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
        this.render(); // Re-render notices to hide admin controls
        this.showToast('Admin logout successful', 'info', 1000);
    }

    showExportModal() {
        this.exportModal.classList.add('show');
    }

    hideExportModal() {
        this.exportModal.classList.remove('show');
    }

    showScrollingDataModal(notice) {
        const csvFileNumber = notice.order || 1;
        const csvData = this.csvData[csvFileNumber];
        
        if (!csvData || !notice.scrollingEnabled) {
            this.showToast('No scrolling data available for this notice', 'info');
            return;
        }

        // Set modal title
        document.getElementById('scrollingDataTitle').textContent = notice.scrollingLabel || 'Data List';
        
        // Create table HTML
        const tableHTML = this.createScrollingDataTable(csvData, notice.scrollingLabel);
        document.getElementById('scrollingDataContainer').innerHTML = tableHTML;
        
        // Show modal
        this.scrollingDataModal = document.getElementById('scrollingDataModal');
        this.scrollingDataModal.classList.add('show');
        
        // Start auto-close timer
        this.startAutoCloseTimer();
    }

    hideScrollingDataModal() {
        const modal = document.getElementById('scrollingDataModal');
        if (modal) {
            modal.classList.remove('show');
        }
        
        // Clear auto-close timer
        if (this.autoCloseTimer) {
            clearInterval(this.autoCloseTimer);
            this.autoCloseTimer = null;
        }
        
        if (this.autoCloseInterval) {
            clearInterval(this.autoCloseInterval);
            this.autoCloseInterval = null;
        }
    }

    createScrollingDataTable(csvData, label) {
        try {
            const lines = csvData.trim().split('\n');
            if (lines.length === 0) {
                return '<p>No data available</p>';
            }

            // Parse CSV data
            const rows = lines.map(line => {
                // Simple CSV parsing - handles basic comma separation
                return line.split(',').map(cell => cell.trim());
            });

            if (rows.length === 0) {
                return '<p>No data available</p>';
            }

            // Use first row as headers
            const headers = rows[0];
            const dataRows = rows.slice(1);

            let tableHTML = `
                <table class="scrolling-data-table">
                    <thead>
                        <tr>
                            ${headers.map(header => `<th>${this.escapeHtml(header)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
            `;

            dataRows.forEach(row => {
                tableHTML += '<tr>';
                headers.forEach((header, index) => {
                    const cellData = row[index] || '';
                    tableHTML += `<td title="${this.escapeHtml(cellData)}">${this.escapeHtml(cellData)}</td>`;
                });
                tableHTML += '</tr>';
            });

            tableHTML += `
                    </tbody>
                </table>
            `;

            return tableHTML;
        } catch (error) {
            console.error('Error creating scrolling data table:', error);
            return '<p>Error loading data</p>';
        }
    }

    startAutoCloseTimer() {
        let timeLeft = 20;
        const timerElement = document.getElementById('timerText');
        
        // Clear any existing timers
        if (this.autoCloseTimer) {
            clearTimeout(this.autoCloseTimer);
        }
        if (this.autoCloseInterval) {
            clearInterval(this.autoCloseInterval);
        }
        
        // Update timer display every second
        this.autoCloseInterval = setInterval(() => {
            timeLeft--;
            if (timerElement) {
                timerElement.textContent = `${timeLeft}s`;
            }
            
            if (timeLeft <= 0) {
                clearInterval(this.autoCloseInterval);
                this.hideScrollingDataModal();
            }
        }, 1000);
        
        // Set the main auto-close timer
        this.autoCloseTimer = setTimeout(() => {
            this.hideScrollingDataModal();
        }, 20000);
        
        // Initialize timer display
        if (timerElement) {
            timerElement.textContent = `${timeLeft}s`;
        }
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

    async loadCSVData(fileNumber) {
        try {
            const csvFileName = `${fileNumber}.csv`;
            console.log(`Attempting to load CSV file: ${csvFileName}`);
            
            const response = await fetch(csvFileName);
            
            if (!response.ok) {
                console.log(`CSV file ${csvFileName} not found (status: ${response.status})`);
                return null;
            }
            
            const csvText = await response.text();
            console.log(`CSV file ${csvFileName} loaded successfully, content length: ${csvText.length}`);
            
            if (!csvText.trim()) {
                console.log(`CSV file ${csvFileName} is empty`);
                return null;
            }
            
            const parsedData = this.parseCSV(csvText);
            console.log(`Parsed CSV data for ${csvFileName}:`, parsedData);
            
            return parsedData;
        } catch (error) {
            console.error(`Error loading CSV file ${fileNumber}.csv:`, error);
            return null;
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            console.log('CSV parsing failed: insufficient data lines');
            return null;
        }
        
        const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, ''));
        const rows = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines
            
            const values = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
            if (values.length >= headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                rows.push(row);
            } else {
                console.log(`Skipping malformed CSV line ${i + 1}: ${line}`);
            }
        }
        
        console.log(`CSV parsing completed: ${headers.length} columns, ${rows.length} rows`);
        return { headers, rows };
    }

    createScrollingMessageHTML(csvData, label) {
        // Enhanced error handling and empty state
        if (!csvData || !csvData.rows || csvData.rows.length === 0) {
            return this.createEmptyScrollingMessage(label);
        }

        try {
            // Sanitize and format data
            const sanitizedData = this.sanitizeCSVData(csvData);
            
            // Create enhanced table header with improved styling
            const headerHTML = sanitizedData.headers.map((header, index) => {
                const sanitizedHeader = this.escapeHtml(header);
                return `<th class="csv-header" data-column="${index}" title="${sanitizedHeader}" style="display: none !important;">${sanitizedHeader}</th>`;
            }).join('');

            // Create optimized row HTML with enhanced data formatting
            const createRowHTML = (row, index) => {
                const cellsHTML = sanitizedData.headers.map((header, colIndex) => {
                    const cellValue = this.formatCellValue(row[header] || '', header, colIndex);
                    const sanitizedValue = this.escapeHtml(cellValue);
                    return `<td class="csv-cell" data-column="${colIndex}" title="${sanitizedValue}" style="display: none !important;">${sanitizedValue}</td>`;
                }).join('');
                return `<tr class="csv-row" data-row="${index}" style="display: none !important;">${cellsHTML}</tr>`;
            };

            // Create mobile column-based format
            const createMobileRowHTML = (row, index) => {
                const rowCells = sanitizedData.headers.map((header, colIndex) => {
                    const cellValue = this.formatCellValue(row[header] || '', header, colIndex);
                    const sanitizedValue = this.escapeHtml(cellValue);
                    // Check if value looks like an amount (contains rupees, numbers, or typical amount patterns)
                    const isAmount = /(?:rs\.?|₹|\$|fee|amount|due|paid|balance|total|sum)/i.test(header) || 
                                   /(?:rs\.?\s*\d|₹\s*\d|\d+\.?\d*\s*(?:rs|₹)|\d+\.\d+)/i.test(sanitizedValue);
                    const isNumeric = /^\d+\.?\d*$/.test(sanitizedValue) || isAmount;
                    const cellClass = isNumeric ? 'csv-cell-numeric' : 'csv-cell-text';
                    return `<div class="csv-column ${cellClass}" data-column="${colIndex}" title="${sanitizedValue}">${sanitizedValue}</div>`;
                }).join('');
                return `<div class="csv-mobile-row" data-row="${index}">${rowCells}</div>`;
            };

            // Create original rows with enhanced indexing
            const originalRowsHTML = sanitizedData.rows.map((row, index) => createRowHTML(row, index)).join('');
            
            // Create duplicate rows for seamless infinite scrolling
            const duplicatedRowsHTML = sanitizedData.rows.map((row, index) => 
                createRowHTML(row, index + sanitizedData.rows.length)
            ).join('');
            
            // Combine all rows
            const allRowsHTML = originalRowsHTML + duplicatedRowsHTML;

            // Create mobile format rows
            const originalMobileRowsHTML = sanitizedData.rows.map((row, index) => createMobileRowHTML(row, index)).join('');
            const duplicatedMobileRowsHTML = sanitizedData.rows.map((row, index) => 
                createMobileRowHTML(row, index + sanitizedData.rows.length)
            ).join('');
            const allMobileRowsHTML = originalMobileRowsHTML + duplicatedMobileRowsHTML;

            // Enhanced timing calculation with adaptive speed
            const totalRows = sanitizedData.rows.length;
            const baseSpeed = this.calculateOptimalScrollSpeed(totalRows);
            const animationDuration = Math.max(totalRows * baseSpeed, 5); // Minimum 5 seconds for faster scrolling
            
            // Generate unique ID for this scrolling instance
            const instanceId = `csv-scroll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            return `
                <div class="scrolling-message-inline" id="${instanceId}" data-rows="${totalRows}">
                    <div class="scrolling-label">
                        <div>
                            ${this.escapeHtml(label)}
                        </div>
                        <span class="scrolling-count">(${totalRows} records)</span>
                    </div>
                    <hr class="scrolling-separator">
                    <div class="scrolling-content-area">
                        <div class="scrolling-animation"
                             style="--scroll-duration: ${animationDuration}s; --total-rows: ${totalRows};"
                             data-animation-duration="${animationDuration}"
                             data-total-rows="${totalRows}">
                            ${allMobileRowsHTML}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error creating scrolling message HTML:', error);
            return this.createErrorScrollingMessage(label, error.message);
        }
    }

    // Helper method to create empty state for scrolling messages
    createEmptyScrollingMessage(label) {
        return `
            <div class="csv-data-container csv-empty">
                <div class="csv-label">
                    <i class="fas fa-table"></i>
                    ${this.escapeHtml(label)}
                </div>
                <div class="csv-error">
                    <i class="fas fa-inbox"></i>
                    <span>No data available</span>
                    <small>CSV file may be empty or not found</small>
                </div>
            </div>
        `;
    }

    // Helper method to create error state for scrolling messages
    createErrorScrollingMessage(label, errorMessage) {
        return `
            <div class="csv-data-container csv-error-state">
                <div class="csv-label">
                    <i class="fas fa-table"></i>
                    ${this.escapeHtml(label)}
                </div>
                <div class="csv-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Error loading data</span>
                    <small>${this.escapeHtml(errorMessage)}</small>
                </div>
            </div>
        `;
    }

    // Helper method to sanitize CSV data
    sanitizeCSVData(csvData) {
        const sanitizedHeaders = csvData.headers.map(header => 
            header.toString().trim().substring(0, 50) // Limit header length
        );
        
        const sanitizedRows = csvData.rows.map(row => {
            const sanitizedRow = {};
            sanitizedHeaders.forEach(header => {
                const originalHeader = csvData.headers.find(h => h.toString().trim().substring(0, 50) === header);
                sanitizedRow[header] = (row[originalHeader] || '').toString().trim().substring(0, 100); // Limit cell length
            });
            return sanitizedRow;
        });
        
        return {
            headers: sanitizedHeaders,
            rows: sanitizedRows
        };
    }

    // Helper method to format cell values based on column type
    formatCellValue(value, header, columnIndex) {
        if (!value) return '';
        
        const valueStr = value.toString().trim();
        
        // Format based on column type detection
        if (columnIndex === 0 || header.toLowerCase().includes('sl') || header.toLowerCase().includes('no')) {
            // Serial number formatting
            return valueStr;
        } else if (header.toLowerCase().includes('fee') || header.toLowerCase().includes('amount') || header.toLowerCase().includes('dues')) {
            // Currency formatting
            const numValue = parseFloat(valueStr.replace(/[^0-9.-]/g, ''));
            if (!isNaN(numValue)) {
                return `₹${numValue.toLocaleString('en-IN')}`;
            }
        } else if (header.toLowerCase().includes('name')) {
            // Name formatting - title case
            return valueStr.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
        }
        
        return valueStr;
    }

    // Helper method to calculate optimal scroll speed
    calculateOptimalScrollSpeed(rowCount) {
        if (rowCount <= 10) return 1.5;  // Faster for fewer rows
        if (rowCount <= 50) return 1.0;
        if (rowCount <= 100) return 0.7;
        return 0.4; // Much faster for many rows
    }

    // Helper method to escape HTML
    escapeHtml(text) {
        if (typeof text !== 'string') {
            text = String(text);
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Control methods for scrolling animation
    toggleScrollAnimation(instanceId) {
        const container = document.getElementById(instanceId);
        if (!container) return;
        
        const scrollContent = container.querySelector('.scrolling-animation');
        const pauseBtn = container.querySelector('.scroll-btn i.fa-pause, .scroll-btn i.fa-play');
        
        if (scrollContent.style.animationPlayState === 'paused') {
            scrollContent.style.animationPlayState = 'running';
            pauseBtn.className = 'fas fa-pause';
            this.showToast('Scrolling resumed', 'info');
        } else {
            scrollContent.style.animationPlayState = 'paused';
            pauseBtn.className = 'fas fa-play';
            this.showToast('Scrolling paused', 'info');
        }
    }

    // Method to adjust scroll speed dynamically
    adjustScrollSpeed(instanceId, direction) {
        const container = document.getElementById(instanceId);
        if (!container) return;
        
        const scrollContent = container.querySelector('.scrolling-animation');
        const currentDuration = parseFloat(scrollContent.dataset.animationDuration) || 20;
        
        let newDuration;
        if (direction === 'faster') {
            newDuration = Math.max(currentDuration * 0.8, 5); // Minimum 5 seconds
        } else {
            newDuration = Math.min(currentDuration * 1.2, 60); // Maximum 60 seconds
        }
        
        scrollContent.style.setProperty('--scroll-duration', `${newDuration}s`);
        scrollContent.dataset.animationDuration = newDuration;
        
        // Restart animation with new timing
        scrollContent.style.animation = 'none';
        scrollContent.offsetHeight; // Trigger reflow
        scrollContent.style.animation = `scroll-csv-smooth ${newDuration}s linear infinite`;
        
        // Show speed feedback
        const speedText = direction === 'faster' ? 'Faster' : 'Slower';
        this.showToast(`Scrolling speed: ${speedText}`, 'info');
    }
    
    // Toggle manual scroll mode
    toggleManualScroll(instanceId) {
        const container = document.getElementById(instanceId);
        if (!container) return;
        
        const scrollContent = container.querySelector('.scrolling-animation');
        const manualBtn = container.querySelector('.scroll-btn:nth-child(4) i');
        
        if (scrollContent.classList.contains('manual-scroll')) {
            // Disable manual scroll
            scrollContent.classList.remove('manual-scroll');
            scrollContent.style.animationPlayState = 'running';
            scrollContent.style.transform = '';
            manualBtn.className = 'fas fa-hand-paper';
            this.showToast('Auto-scroll enabled', 'info');
        } else {
            // Enable manual scroll
            scrollContent.classList.add('manual-scroll');
            scrollContent.style.animationPlayState = 'paused';
            manualBtn.className = 'fas fa-hand-rock';
            this.showToast('Manual scroll enabled - drag to scroll', 'info');
        }
    }
    
    // Reset scroll position to top
    resetScrollPosition(instanceId) {
        const container = document.getElementById(instanceId);
        if (!container) return;
        
        const scrollContent = container.querySelector('.scrolling-animation');
        
        // Reset animation
        scrollContent.style.animation = 'none';
        scrollContent.style.transform = '';
        scrollContent.offsetHeight; // Trigger reflow
        
        const duration = scrollContent.dataset.animationDuration || '25';
        scrollContent.style.animation = `scroll-csv-smooth ${duration}s linear infinite`;
        
        this.showToast('Scroll position reset', 'info');
    }

    // Initialize scrolling animations after DOM insertion
    initializeScrollingAnimations() {
        const scrollContainers = document.querySelectorAll('.csv-data-container');
        console.log(`Found ${scrollContainers.length} CSV scrolling containers`);
        
        scrollContainers.forEach(container => {
            const scrollContent = container.querySelector('.scrolling-animation');
            if (scrollContent) {
                const duration = scrollContent.dataset.animationDuration || '25';
                console.log(`Initializing animation for container ${container.id} with duration ${duration}s`);
                
                // Ensure animation is properly applied
                scrollContent.style.setProperty('--scroll-duration', `${duration}s`);
                scrollContent.style.animation = `scroll-csv-smooth ${duration}s linear infinite`;
                
                // Initialize hover/touch behavior
                this.initializeScrollInteractions(container);
                
                // Initialize horizontal scroll indicators
                this.initializeHorizontalScrollIndicators(container);
                
                // Force reflow to ensure animation starts
                scrollContent.offsetHeight;
            }
        });
    }
    
    // Initialize hover and touch interactions for scrolling
    initializeScrollInteractions(container) {
        const scrollContent = container.querySelector('.scrolling-animation');
        if (!scrollContent) return;
        
        let hoverTimeout;
        let isManualScrolling = false;
        let startY = 0;
        let scrollTop = 0;
        let touchCount = 0;
        let lastTouchTime = 0;
        
        // Mouse events
        container.addEventListener('mouseenter', () => {
            if (!isManualScrolling) {
                scrollContent.style.animationPlayState = 'paused';
                // Auto-resume after 3 seconds
                hoverTimeout = setTimeout(() => {
                    if (!isManualScrolling) {
                        scrollContent.style.animationPlayState = 'running';
                    }
                }, 3000);
            }
        });
        
        container.addEventListener('mouseleave', () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
            if (!isManualScrolling) {
                scrollContent.style.animationPlayState = 'running';
            }
        });
        
        // Enhanced touch events for mobile
        container.addEventListener('touchstart', (e) => {
            const currentTime = Date.now();
            
            // Check for double tap within 500ms
            if (currentTime - lastTouchTime < 500) {
                touchCount++;
            } else {
                touchCount = 1;
            }
            lastTouchTime = currentTime;
            
            // On second touch, resume scrolling
            if (touchCount === 2) {
                scrollContent.style.animationPlayState = 'running';
                this.showToast('Scrolling resumed', 'info');
                touchCount = 0;
                return;
            }
            
            // Pause on first touch
            if (scrollContent.style.animationPlayState !== 'paused') {
                scrollContent.style.animationPlayState = 'paused';
            }
            
            if (scrollContent.classList.contains('manual-scroll')) {
                startY = e.touches[0].clientY;
                scrollTop = scrollContent.scrollTop || 0;
                isManualScrolling = true;
                scrollContent.style.animationPlayState = 'paused';
            }
        });
        
        container.addEventListener('touchmove', (e) => {
            if (scrollContent.classList.contains('manual-scroll') && isManualScrolling) {
                e.preventDefault();
                const currentY = e.touches[0].clientY;
                const deltaY = startY - currentY;
                const newScrollTop = scrollTop + deltaY;
                
                // Manual scroll simulation
                scrollContent.style.transform = `translateY(${-newScrollTop}px)`;
            }
        });
        
        container.addEventListener('touchend', () => {
            if (scrollContent.classList.contains('manual-scroll')) {
                setTimeout(() => {
                    isManualScrolling = false;
                    if (!container.matches(':hover')) {
                        scrollContent.style.animationPlayState = 'running';
                    }
                }, 1000);
            } else {
                // Auto-resume after 4 seconds if not double-tapped
                setTimeout(() => {
                    if (touchCount < 2 && scrollContent.style.animationPlayState === 'paused') {
                        scrollContent.style.animationPlayState = 'running';
                    }
                }, 4000);
            }
        });
    }
    
    // Initialize horizontal scroll indicators for mobile
    initializeHorizontalScrollIndicators(container) {
        const scrollArea = container.querySelector('.scrolling-content-area');
        
        if (!scrollArea) return;
        
        // No scroll indicators needed for inline pipe format
        return;
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

    showMobileFilters() {
        const filterSection = document.querySelector('.category-filter-section');
        if (filterSection) {
            filterSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    showMobileFilters() {
        // Toggle mobile filter panel (implement as needed)
        // Mobile filter removed - no longer needed
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
            } else if (document.getElementById('scrollingDataModal').classList.contains('show')) {
                this.hideScrollingDataModal();
            }
        }
    }

    showToast(message, type = 'info', duration = null) {
        // Set default durations based on type
        if (duration === null) {
            duration = type === 'success' ? 1000 : 3000; // 1 second for success, 3 seconds for others
        }
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

    processContentWithURLs(content) {
        // Process HTML content to detect and convert URLs to clickable links inline
        let processedContent = content;
        
        // URL regex pattern to detect various URL formats
        const urlRegex = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[^\s<>"]+\.[a-z]{2,}(?:\/[^\s<>"]*)?)/gi;
        
        // Convert URLs to clickable links inline (preserve context and positioning)
        processedContent = processedContent.replace(urlRegex, (url) => {
            let href = url;
            // Add https:// if missing
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                href = 'https://' + url;
            }
            // Create inline clickable link that preserves the URL text and position
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="notice-link">
                        <i class="fas fa-external-link-alt"></i> ${url}
                    </a>`;
        });
        
        return processedContent;
    }

    createAttachmentsDisplay(attachments) {
        console.log('Creating attachments display for:', attachments);
        if (!attachments || attachments.length === 0) {
            console.log('No attachments to display');
            return '';
        }
        
        const attachmentsHTML = attachments.map(attachment => {
            const icon = this.getFileIcon(attachment.type);
            const size = this.formatFileSize(attachment.size);
            
            // Handle placeholder attachments
            if (attachment.isPlaceholder) {
                return `
                    <div class="notice-attachment placeholder-attachment">
                        <i class="attachment-icon ${icon}"></i>
                        <div class="attachment-info">
                            <span class="attachment-name">${attachment.name}</span>
                            <span class="attachment-size">${size}</span>
                            <small class="attachment-note">${attachment.note}</small>
                        </div>
                    </div>
                `;
            }

            // Handle hosted files (pCloud, Google Drive, etc.)
            if (attachment.hostedFile || attachment.driveFile) {
                const url = attachment.url || attachment.webViewLink;
                const service = attachment.service || 'Google Drive';
                const serviceIcon = attachment.service === 'pcloud.com' ? '☁️' : 
                                  attachment.service === 'tmpfiles.org' ? '🗂️' : 
                                  attachment.service === 'file.io' ? '☁️' : '📁';
                
                return `
                    <div class="notice-attachment hosted-attachment">
                        <i class="attachment-icon ${icon}"></i>
                        <div class="attachment-info">
                            <a href="${url}" target="_blank" class="attachment-link" rel="noopener noreferrer">
                                <span class="attachment-name">${attachment.name}</span>
                                <span class="attachment-size">${size}</span>
                                <small class="hosting-info">${serviceIcon} Hosted on ${service}</small>
                            </a>
                        </div>
                    </div>
                `;
            }
            
            if (attachment.type.startsWith('image/')) {
                // Display images inline with compression info
                const compressionInfo = attachment.compressed ? 
                    `<small class="compression-info">Compressed (${this.formatFileSize(attachment.originalSize)} → ${size})</small>` : '';
                
                return `
                    <div class="notice-attachment image-attachment">
                        <img src="${attachment.data}" alt="${attachment.name}" class="attachment-image" loading="lazy">
                        <div class="attachment-info">
                            <span class="attachment-name">${attachment.name}</span>
                            <span class="attachment-size">${size}</span>
                            ${compressionInfo}
                        </div>
                    </div>
                `;
            } else {
                // Display other files as downloadable links
                return `
                    <div class="notice-attachment file-attachment">
                        <i class="attachment-icon ${icon}"></i>
                        <div class="attachment-info">
                            <a href="${attachment.data}" download="${attachment.name}" class="attachment-link">
                                <span class="attachment-name">${attachment.name}</span>
                                <span class="attachment-size">${size}</span>
                            </a>
                        </div>
                    </div>
                `;
            }
        }).join('');
        
        return `
            <div class="notice-attachments">
                <div class="attachments-header">
                    <i class="fas fa-paperclip"></i>
                    <span>Attachments (${attachments.length})</span>
                </div>
                <div class="attachments-list">
                    ${attachmentsHTML}
                </div>
            </div>
        `;
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    initializeSubHeader() {
        // Auto-hide sub-header after 8 seconds
        const subHeader = document.getElementById('subHeader');
        if (subHeader) {
            setTimeout(() => {
                subHeader.classList.add('fade-out');
                // Remove from DOM after fade-out animation
                setTimeout(() => {
                    if (subHeader.parentNode) {
                        subHeader.parentNode.removeChild(subHeader);
                    }
                }, 300); // Match CSS transition duration
            }, 8000);
        }
    }

    handleTagInput(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const tagValue = e.target.value.trim();
            if (tagValue && !this.currentTags.includes(tagValue)) {
                this.currentTags.push(tagValue);
                this.renderTagsDisplay();
                e.target.value = '';
            }
        }
    }

    renderTagsDisplay() {
        const tagsDisplay = document.getElementById('tagsDisplay');
        if (!tagsDisplay) return;

        tagsDisplay.innerHTML = this.currentTags.map(tag => `
            <div class="tag-chip">
                ${tag}
                <button type="button" class="remove-tag" onclick="noticeBoard.removeTag('${tag}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    removeTag(tag) {
        this.currentTags = this.currentTags.filter(t => t !== tag);
        this.renderTagsDisplay();
    }

    handleFileSelection(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    setupFileDragDrop() {
        const container = document.querySelector('.file-input-container');
        if (!container) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            container.addEventListener(eventName, () => {
                container.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, () => {
                container.classList.remove('drag-over');
            }, false);
        });

        container.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files);
            this.processFiles(files);
        }, false);
    }

    processFiles(files) {
        files.forEach(file => {
            if (!this.allowedFileTypes.includes(file.type)) {
                this.showToast(`File type not allowed: ${file.name}`, 'error');
                return;
            }

            if (file.size > this.maxFileSize) {
                this.showToast(`File too large: ${file.name} (max 5MB)`, 'error');
                return;
            }

            const fileData = {
                name: file.name,
                size: file.size,
                type: file.type,
                data: null
            };

            const reader = new FileReader();
            reader.onload = (e) => {
                fileData.data = e.target.result;
                this.currentAttachments.push(fileData);
                this.renderAttachmentsPreview();
            };
            reader.readAsDataURL(file);
        });
    }

    renderAttachmentsPreview() {
        const preview = document.getElementById('attachmentsPreview');
        if (!preview) return;

        preview.innerHTML = this.currentAttachments.map((file, index) => `
            <div class="attachment-item">
                <i class="attachment-icon ${this.getFileIcon(file.type)}"></i>
                <div class="attachment-info">
                    <div class="attachment-name">${file.name}</div>
                    <div class="attachment-size">${this.formatFileSize(file.size)}</div>
                </div>
                <button type="button" class="remove-attachment" onclick="noticeBoard.removeAttachment(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    removeAttachment(index) {
        this.currentAttachments.splice(index, 1);
        this.renderAttachmentsPreview();
    }

    getFileIcon(fileType) {
        if (fileType.startsWith('image/')) return 'fas fa-image';
        if (fileType === 'application/pdf') return 'fas fa-file-pdf';
        if (fileType.includes('csv') || fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fas fa-file-csv';
        if (fileType.includes('word') || fileType.includes('document')) return 'fas fa-file-word';
        if (fileType === 'text/plain') return 'fas fa-file-alt';
        return 'fas fa-file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Debug function to test JSONhost URL directly
    async testJsonhostURL() {
        const config = window.CLOUD_CONFIG.jsonhost;
        if (!config || !config.jsonId) {
            console.error('No JSONhost configuration found');
            this.showToast('No JSONhost configuration found', 'error');
            return;
        }

        const jsonUrl = `${config.baseUrl}${config.jsonId}`;
        console.log('Testing JSONhost URL:', jsonUrl);
        this.showToast('Testing JSONhost URL...', 'info');

        try {
            // Test simple fetch without headers first
            const response = await fetch(jsonUrl, {
                method: 'GET',
                mode: 'cors'
            });

            console.log('Direct test - Status:', response.status);
            console.log('Direct test - Headers:', [...response.headers.entries()]);

            if (response.ok) {
                const data = await response.json();
                console.log('Direct test - Response:', data);
                this.showToast('JSONhost URL test successful!', 'success');
                
                // Test the processCloudData function directly
                console.log('Testing processCloudData with response...');
                this.processCloudData(data, 'Test');
                
            } else {
                console.error('Direct test failed:', response.status, response.statusText);
                this.showToast(`JSONhost test failed: ${response.status}`, 'error');
            }
        } catch (error) {
            console.error('Direct test error:', error);
            this.showToast(`JSONhost test error: ${error.message}`, 'error');
        }
    }

    // ==========================================
    // SMP FORMS - DATA CAPTURE FUNCTIONALITY
    // ==========================================

    initializeFormsSystem() {
        // Forms system elements
        this.formsModal = document.getElementById('formsModal');
        this.dataCaptureBtn = document.getElementById('dataCaptureBtn');
        this.closeFormsModal = document.getElementById('closeFormsModal');
        this.formTitle = document.getElementById('formTitle');
        this.formDescription = document.getElementById('formDescription');
        // this.formEnabled = document.getElementById('formEnabled'); // Removed - now controlled by formCaptureEnabled
        this.questionsContainer = document.getElementById('questionsContainer');
        this.addQuestionBtn = document.getElementById('addQuestionBtn');
        this.saveFormBtn = document.getElementById('saveFormBtn');
        this.cancelFormBuilder = document.getElementById('cancelFormBuilder');
        this.previewFormBtn = document.getElementById('previewFormBtn');
        this.publishFormBtn = document.getElementById('publishFormBtn');
        this.formBuilderSection = document.getElementById('formBuilderSection');
        this.formPreviewSection = document.getElementById('formPreviewSection');
        this.backToBuilderBtn = document.getElementById('backToBuilderBtn');
        this.exportFormDataBtn = document.getElementById('exportFormDataBtn');
        this.manageFormDataBtn = document.getElementById('manageFormDataBtn');
        this.deleteFormBtn = document.getElementById('deleteFormBtn');

        // Form data management modal elements
        this.formDataModal = document.getElementById('formDataModal');
        this.closeFormDataModal = document.getElementById('closeFormDataModal');
        this.refreshFormDataBtn = document.getElementById('refreshFormDataBtn');
        this.formDataTableContainer = document.getElementById('formDataTableContainer');
        this.searchResponses = document.getElementById('searchResponses');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        this.totalResponses = document.getElementById('totalResponses');
        this.currentFormName = document.getElementById('currentFormName');

        // Response detail modal elements
        this.responseDetailModal = document.getElementById('responseDetailModal');
        this.closeResponseDetailModal = document.getElementById('closeResponseDetailModal');
        this.editResponseBtn = document.getElementById('editResponseBtn');
        this.deleteResponseBtn = document.getElementById('deleteResponseBtn');
        this.responseDetailContainer = document.getElementById('responseDetailContainer');

        // Current form data
        this.currentForm = null;
        this.formQuestions = [];
        this.questionIdCounter = 0;
        this.currentEditingFormId = null; // Track form for current notice editing session

        // Attach event listeners
        this.dataCaptureBtn?.addEventListener('click', () => this.openFormsModal());
        this.closeFormsModal?.addEventListener('click', () => this.closeFormsModalHandler());
        this.addQuestionBtn?.addEventListener('click', () => this.addNewQuestion());
        this.saveFormBtn?.addEventListener('click', () => this.saveForm());
        this.cancelFormBuilder?.addEventListener('click', () => this.closeFormsModalHandler());
        this.previewFormBtn?.addEventListener('click', () => this.previewForm());
        this.backToBuilderBtn?.addEventListener('click', () => this.backToBuilder());
        this.publishFormBtn?.addEventListener('click', () => this.publishForm());
        this.exportFormDataBtn?.addEventListener('click', () => this.showFormExportOptions());
        this.manageFormDataBtn?.addEventListener('click', () => this.openFormDataManagement());
        this.deleteFormBtn?.addEventListener('click', () => this.deleteForm());

        // Form data management modal events
        this.closeFormDataModal?.addEventListener('click', () => this.closeFormDataManagement());
        this.refreshFormDataBtn?.addEventListener('click', () => this.refreshFormData());
        this.searchResponses?.addEventListener('input', (e) => this.searchFormResponses(e.target.value));
        this.selectAllBtn?.addEventListener('click', () => this.toggleSelectAll());
        this.deleteSelectedBtn?.addEventListener('click', () => this.deleteSelectedResponses());

        // Response detail modal events
        this.closeResponseDetailModal?.addEventListener('click', () => this.closeResponseDetail());
        this.editResponseBtn?.addEventListener('click', () => this.editResponse());
        this.deleteResponseBtn?.addEventListener('click', () => this.deleteResponse());

        // Initialize forms cloud sync
        this.initializeFormsCloudSync();

        console.log('📋 SMP Forms system initialized');
    }

    // Initialize forms cloud synchronization
    async initializeFormsCloudSync() {
        if (!window.CLOUD_CONFIG?.jsonhost?.jsonId) {
            console.log('Forms cloud sync not configured');
            return;
        }

        try {
            // Load forms from cloud
            const cloudForms = await this.getFormsFromJSONhost();
            if (cloudForms && cloudForms.length > 0) {
                // Merge with local forms
                const localForms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
                const mergedForms = this.mergeForms(localForms, cloudForms);
                
                // Save merged forms locally
                localStorage.setItem('smp-forms', JSON.stringify(mergedForms));
                console.log(`📋 Forms synced from cloud: ${mergedForms.length} forms`);
            }
        } catch (error) {
            console.error('Error syncing forms from cloud:', error);
        }
    }

    // Merge local and cloud forms, preferring newer versions
    mergeForms(localForms, cloudForms) {
        const merged = new Map();

        // Add all local forms first
        localForms.forEach(form => {
            merged.set(form.id, form);
        });

        // Add or update with cloud forms if they're newer
        cloudForms.forEach(cloudForm => {
            const localForm = merged.get(cloudForm.id);
            if (!localForm || new Date(cloudForm.lastModified || cloudForm.timestamp) > new Date(localForm.lastModified || localForm.timestamp)) {
                merged.set(cloudForm.id, cloudForm);
            }
        });

        return Array.from(merged.values());
    }

    openFormsModal() {
        this.resetFormBuilder();
        
        // Check if we're editing a notice that has an existing form
        if (this.currentEditingNotice && this.currentEditingNotice.formId) {
            this.loadExistingForm(this.currentEditingNotice.formId);
        }
        
        this.formsModal.classList.add('show');
        this.showFormBuilder();
    }

    closeFormsModalHandler() {
        this.formsModal.classList.remove('show');
        this.resetFormBuilder();
    }

    resetFormBuilder() {
        this.formTitle.value = '';
        this.formDescription.value = '';
        // this.formEnabled.checked = true; // Removed - now controlled by formCaptureEnabled
        this.questionsContainer.innerHTML = '';
        this.formQuestions = [];
        this.questionIdCounter = 0;
        this.currentForm = null;
        
        // Hide admin buttons when creating new form
        this.exportFormDataBtn.style.display = 'none';
        this.manageFormDataBtn.style.display = 'none';
        this.deleteFormBtn.style.display = 'none';
    }

    loadExistingForm(formId) {
        const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
        const form = forms.find(f => f.id === formId);
        
        if (!form) {
            this.showToast('Form not found', 'error');
            return;
        }
        
        // Populate form builder with existing data
        this.formTitle.value = form.title;
        this.formDescription.value = form.description || '';
        // this.formEnabled.checked = form.enabled; // Removed - now controlled by formCaptureEnabled
        this.currentForm = form;
        
        // Load existing questions
        this.formQuestions = [...form.questions];
        this.questionIdCounter = Math.max(...form.questions.map(q => q.id), 0);
        
        // Render all questions
        this.questionsContainer.innerHTML = '';
        this.formQuestions.forEach(question => {
            this.renderQuestion(question);
        });
        
        // Show export and manage buttons if there are responses and user is admin
        if (this.isAdmin && form.responses && form.responses.length > 0) {
            this.exportFormDataBtn.style.display = 'inline-block';
            this.manageFormDataBtn.style.display = 'inline-block';
        } else {
            this.exportFormDataBtn.style.display = 'none';
            this.manageFormDataBtn.style.display = 'none';
        }

        // Show delete button if user is admin and editing existing form
        if (this.isAdmin && form.id) {
            this.deleteFormBtn.style.display = 'inline-block';
        } else {
            this.deleteFormBtn.style.display = 'none';
        }
        
        console.log('Loaded existing form for editing:', form.title);
    }

    showFormBuilder() {
        this.formBuilderSection.style.display = 'block';
        this.formPreviewSection.style.display = 'none';
        this.previewFormBtn.style.display = 'inline-block';
        this.publishFormBtn.style.display = 'none';
    }

    showFormPreview() {
        this.formBuilderSection.style.display = 'none';
        this.formPreviewSection.style.display = 'block';
        this.previewFormBtn.style.display = 'none';
        this.publishFormBtn.style.display = 'inline-block';
    }

    backToBuilder() {
        this.showFormBuilder();
    }

    addNewQuestion() {
        const questionId = ++this.questionIdCounter;
        const questionData = {
            id: questionId,
            type: 'text',
            question: '',
            required: false,
            options: []
        };
        
        this.formQuestions.push(questionData);
        this.renderQuestion(questionData);
    }

    renderQuestion(questionData) {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        questionDiv.dataset.questionId = questionData.id;

        questionDiv.innerHTML = `
            <div class="question-header">
                <span class="question-number">Question ${questionData.id}</span>
                <div class="question-controls">
                    <button type="button" class="btn btn-sm btn-icon" onclick="noticeBoard.moveQuestionUp(${questionData.id})" title="Move Up">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-icon" onclick="noticeBoard.moveQuestionDown(${questionData.id})" title="Move Down">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-danger" onclick="noticeBoard.removeQuestion(${questionData.id})" title="Delete Question">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="question-content">
                <div class="question-type-selector">
                    <label>
                        <input type="radio" name="type_${questionData.id}" value="text" ${questionData.type === 'text' ? 'checked' : ''}>
                        <span>Short Text</span>
                    </label>
                    <label>
                        <input type="radio" name="type_${questionData.id}" value="textarea" ${questionData.type === 'textarea' ? 'checked' : ''}>
                        <span>Long Text</span>
                    </label>
                    <label>
                        <input type="radio" name="type_${questionData.id}" value="radio" ${questionData.type === 'radio' ? 'checked' : ''}>
                        <span>Multiple Choice</span>
                    </label>
                    <label>
                        <input type="radio" name="type_${questionData.id}" value="checkbox" ${questionData.type === 'checkbox' ? 'checked' : ''}>
                        <span>Checkboxes</span>
                    </label>
                    <label>
                        <input type="radio" name="type_${questionData.id}" value="select" ${questionData.type === 'select' ? 'checked' : ''}>
                        <span>Dropdown</span>
                    </label>
                </div>
                
                <input type="text" class="question-input" placeholder="Enter your question here..." value="${questionData.question}">
                
                <label>
                    <input type="checkbox" ${questionData.required ? 'checked' : ''}>
                    <span>Required</span>
                </label>
                
                <div class="question-options" style="display: ${['radio', 'checkbox', 'select'].includes(questionData.type) ? 'block' : 'none'};">
                    <label>Options:</label>
                    <div class="options-list" id="options_${questionData.id}">
                        ${this.renderQuestionOptions(questionData)}
                    </div>
                    <button type="button" class="add-option-btn" onclick="noticeBoard.addOption(${questionData.id})">
                        <i class="fas fa-plus"></i> Add Option
                    </button>
                </div>
            </div>
        `;

        this.questionsContainer.appendChild(questionDiv);
        this.attachQuestionEventListeners(questionData.id);
    }

    renderQuestionOptions(questionData) {
        if (questionData.options.length === 0) {
            questionData.options = ['Option 1', 'Option 2'];
        }
        
        return questionData.options.map((option, index) => `
            <div class="option-item">
                <input type="text" class="option-input" value="${option}" placeholder="Option ${index + 1}">
                <button type="button" class="remove-option-btn" onclick="noticeBoard.removeOption(${questionData.id}, ${index})" ${questionData.options.length <= 2 ? 'disabled' : ''}>
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    attachQuestionEventListeners(questionId) {
        const questionDiv = document.querySelector(`[data-question-id="${questionId}"]`);
        if (!questionDiv) return;

        // Type change handler
        const typeRadios = questionDiv.querySelectorAll('input[type="radio"]');
        typeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.updateQuestionType(questionId, radio.value);
                }
            });
        });

        // Question text change handler
        const questionInput = questionDiv.querySelector('.question-input');
        questionInput.addEventListener('input', () => {
            this.updateQuestionText(questionId, questionInput.value);
        });

        // Required checkbox handler
        const requiredCheckbox = questionDiv.querySelector('input[type="checkbox"]');
        requiredCheckbox.addEventListener('change', () => {
            this.updateQuestionRequired(questionId, requiredCheckbox.checked);
        });

        // Option input handlers
        this.attachOptionEventListeners(questionId);
    }

    attachOptionEventListeners(questionId) {
        const optionInputs = document.querySelectorAll(`#options_${questionId} .option-input`);
        optionInputs.forEach((input, index) => {
            input.addEventListener('input', () => {
                this.updateOption(questionId, index, input.value);
            });
        });
    }

    updateQuestionType(questionId, type) {
        const question = this.formQuestions.find(q => q.id === questionId);
        if (question) {
            question.type = type;
            const optionsDiv = document.querySelector(`[data-question-id="${questionId}"] .question-options`);
            if (optionsDiv) {
                optionsDiv.style.display = ['radio', 'checkbox', 'select'].includes(type) ? 'block' : 'none';
            }
        }
    }

    updateQuestionText(questionId, text) {
        const question = this.formQuestions.find(q => q.id === questionId);
        if (question) {
            question.question = text;
        }
    }

    updateQuestionRequired(questionId, required) {
        const question = this.formQuestions.find(q => q.id === questionId);
        if (question) {
            question.required = required;
        }
    }

    addOption(questionId) {
        const question = this.formQuestions.find(q => q.id === questionId);
        if (question) {
            question.options.push(`Option ${question.options.length + 1}`);
            const optionsList = document.getElementById(`options_${questionId}`);
            optionsList.innerHTML = this.renderQuestionOptions(question);
            this.attachOptionEventListeners(questionId);
        }
    }

    removeOption(questionId, index) {
        const question = this.formQuestions.find(q => q.id === questionId);
        if (question && question.options.length > 2) {
            question.options.splice(index, 1);
            const optionsList = document.getElementById(`options_${questionId}`);
            optionsList.innerHTML = this.renderQuestionOptions(question);
            this.attachOptionEventListeners(questionId);
        }
    }

    updateOption(questionId, index, value) {
        const question = this.formQuestions.find(q => q.id === questionId);
        if (question && question.options[index] !== undefined) {
            question.options[index] = value;
        }
    }

    removeQuestion(questionId) {
        this.formQuestions = this.formQuestions.filter(q => q.id !== questionId);
        const questionDiv = document.querySelector(`[data-question-id="${questionId}"]`);
        if (questionDiv) {
            questionDiv.remove();
        }
        this.updateQuestionNumbers();
    }

    moveQuestionUp(questionId) {
        const index = this.formQuestions.findIndex(q => q.id === questionId);
        if (index > 0) {
            [this.formQuestions[index], this.formQuestions[index - 1]] = [this.formQuestions[index - 1], this.formQuestions[index]];
            this.reRenderQuestions();
        }
    }

    moveQuestionDown(questionId) {
        const index = this.formQuestions.findIndex(q => q.id === questionId);
        if (index < this.formQuestions.length - 1) {
            [this.formQuestions[index], this.formQuestions[index + 1]] = [this.formQuestions[index + 1], this.formQuestions[index]];
            this.reRenderQuestions();
        }
    }

    reRenderQuestions() {
        this.questionsContainer.innerHTML = '';
        this.formQuestions.forEach(question => {
            this.renderQuestion(question);
        });
    }

    updateQuestionNumbers() {
        const questionDivs = this.questionsContainer.querySelectorAll('.question-item');
        questionDivs.forEach((div, index) => {
            const numberSpan = div.querySelector('.question-number');
            if (numberSpan) {
                numberSpan.textContent = `Question ${index + 1}`;
            }
        });
    }

    previewForm() {
        if (!this.validateFormBuilder()) return;
        
        this.generateFormPreview();
        this.showFormPreview();
    }

    validateFormBuilder() {
        if (!this.formTitle || !this.formTitle.value.trim()) {
            this.showToast('Please enter a form title', 'error');
            return false;
        }
        
        if (this.formQuestions.length === 0) {
            this.showToast('Please add at least one question', 'error');
            return false;
        }
        
        for (const question of this.formQuestions) {
            if (!question.question.trim()) {
                this.showToast('Please fill in all question texts', 'error');
                return false;
            }
            
            if (['radio', 'checkbox', 'select'].includes(question.type)) {
                if (question.options.length < 2 || question.options.some(opt => !opt.trim())) {
                    this.showToast('All choice questions must have at least 2 non-empty options', 'error');
                    return false;
                }
            }
        }
        
        return true;
    }

    generateFormPreview() {
        const previewContent = document.getElementById('formPreviewContent');
        
        let html = `
            <div class="form-preview-header">
                <h2>${this.escapeHtml(this.formTitle.value)}</h2>
                ${this.formDescription.value ? `<p class="form-description">${this.escapeHtml(this.formDescription.value)}</p>` : ''}
                <hr>
            </div>
            <form class="form-preview-form">
        `;
        
        this.formQuestions.forEach((question, index) => {
            html += this.generateQuestionPreview(question, index + 1);
        });
        
        html += `
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Submit Response</button>
                </div>
            </form>
        `;
        
        previewContent.innerHTML = html;
    }

    generateQuestionPreview(question, number) {
        const required = question.required ? ' *' : '';
        let inputHtml = '';
        
        switch (question.type) {
            case 'text':
                inputHtml = `<input type="text" class="form-control" placeholder="Your answer..." ${question.required ? 'required' : ''}>`;
                break;
            case 'textarea':
                inputHtml = `<textarea class="form-control" rows="3" placeholder="Your answer..." ${question.required ? 'required' : ''}></textarea>`;
                break;
            case 'radio':
                inputHtml = question.options.map((option, i) => `
                    <label class="radio-option">
                        <input type="radio" name="question_${question.id}" value="${this.escapeHtml(option)}" ${question.required ? 'required' : ''}>
                        <span>${this.escapeHtml(option)}</span>
                    </label>
                `).join('');
                break;
            case 'checkbox':
                inputHtml = question.options.map((option, i) => `
                    <label class="checkbox-option">
                        <input type="checkbox" name="question_${question.id}[]" value="${this.escapeHtml(option)}">
                        <span>${this.escapeHtml(option)}</span>
                    </label>
                `).join('');
                break;
            case 'select':
                inputHtml = `
                    <select class="form-control" ${question.required ? 'required' : ''}>
                        <option value="">Choose an option...</option>
                        ${question.options.map(option => `<option value="${this.escapeHtml(option)}">${this.escapeHtml(option)}</option>`).join('')}
                    </select>
                `;
                break;
        }
        
        return `
            <div class="form-group preview-question">
                <label class="question-label">
                    ${number}. ${this.escapeHtml(question.question)}${required}
                </label>
                <div class="question-input-container">
                    ${inputHtml}
                </div>
            </div>
        `;
    }

    saveForm() {
        if (!this.validateFormBuilder()) return;
        
        // Check if we're editing an existing form or creating a new one
        const isEditing = this.currentForm && this.currentForm.id;
        
        const formData = {
            id: isEditing ? this.currentForm.id : Date.now().toString(),
            title: this.formTitle.value.trim(),
            description: this.formDescription.value.trim(),
            enabled: true, // Always enabled - controlled by formCaptureEnabled in notice
            questions: this.formQuestions.map(q => ({...q})),
            created: isEditing ? this.currentForm.created : new Date().toISOString(),
            lastModified: new Date().toISOString(),
            responses: isEditing ? this.currentForm.responses || [] : []
        };
        
        this.currentForm = formData;
        
        // Save to both localStorage and JSONhost
        this.saveFormToStorage(formData);
        this.saveFormToJSONhost(formData);
        
        // Enable form capture for current notice if we're editing one
        if (this.formCaptureEnabled) {
            this.formCaptureEnabled.checked = true;
        }
        
        // Auto-enable form capture when creating/editing a form
        if (this.currentEditingNotice) {
            // We're editing an existing notice - embed the form data directly
            this.currentEditingNotice.formData = formData;
            this.currentEditingNotice.formId = formData.id;
            this.formCaptureEnabled.checked = true;
            
            // Update the notice in the notices array
            const noticeIndex = this.notices.findIndex(n => n.id === this.currentEditingNotice.id);
            if (noticeIndex !== -1) {
                this.notices[noticeIndex] = this.currentEditingNotice;
                this.saveToStorage();
                this.uploadToCloud();
            }
        }
        
        // Store form ID for current editing session
        this.currentEditingFormId = formData.id;
        
        const action = isEditing ? 'updated' : 'created';
        this.showToast(`Form ${action} successfully! You can now enable it in the notice.`, 'success');
        this.closeFormsModalHandler();
    }

    deleteForm() {
        if (!this.currentForm) {
            this.showToast('No form selected to delete', 'warning');
            return;
        }

        const confirmMessage = `Are you sure you want to delete the form "${this.currentForm.title}"?\n\nThis will permanently delete:\n- The form structure\n- All ${this.currentForm.responses?.length || 0} responses\n- All associated data from the cloud\n\nThis action cannot be undone.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        const formId = this.currentForm.id;
        const formTitle = this.currentForm.title;

        // Remove from localStorage
        const existingForms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
        const filteredForms = existingForms.filter(f => f.id !== formId);
        localStorage.setItem('smp-forms', JSON.stringify(filteredForms));

        // Remove from cloud
        this.deleteFormFromJSONhost(formId);

        // Remove form reference from any notices
        this.notices.forEach(notice => {
            if (notice.formId === formId) {
                notice.formCaptureEnabled = false;
                notice.formId = null;
                notice.formData = null;
            }
        });

        // Save updated notices
        this.saveToStorage();
        this.uploadToCloud();

        // Clear current form
        this.currentForm = null;
        this.currentEditingFormId = null;

        this.showToast(`Form "${formTitle}" deleted successfully`, 'success');
        this.closeFormsModalHandler();
    }

    saveFormToStorage(formData) {
        const existingForms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
        const existingIndex = existingForms.findIndex(f => f.id === formData.id);
        
        if (existingIndex !== -1) {
            existingForms[existingIndex] = formData;
        } else {
            existingForms.push(formData);
        }
        
        localStorage.setItem('smp-forms', JSON.stringify(existingForms));
    }

    publishForm() {
        if (!this.currentForm) {
            this.showToast('Please save the form first', 'error');
            return;
        }
        
        // Generate form URL and copy to clipboard
        const formUrl = `${window.location.origin}${window.location.pathname}?form=${this.currentForm.id}`;
        
        navigator.clipboard.writeText(formUrl).then(() => {
            this.showToast('Form URL copied to clipboard!', 'success');
        }).catch(() => {
            this.showToast('Form published. URL: ' + formUrl, 'info');
        });
    }

    // JSONhost integration for forms
    async saveFormToJSONhost(formData) {
        if (!window.CLOUD_CONFIG?.jsonhost?.jsonId) {
            console.log('JSONhost not configured for forms');
            return;
        }

        try {
            // Get the complete current data structure from JSONhost
            const response = await fetch(`${window.CLOUD_CONFIG.jsonhost.baseUrl}${window.CLOUD_CONFIG.jsonhost.jsonId}`);
            let currentData = {
                notices: this.notices,
                forms: [],
                lastUpdated: new Date().toISOString(),
                version: "1.0",
                metadata: {
                    title: "SMP College Notice Board",
                    description: "Official notices and announcements",
                    totalNotices: this.notices.length,
                    totalForms: 0,
                    service: "jsonhost"
                }
            };

            // If JSONhost data exists, preserve it and update only forms
            if (response.ok) {
                currentData = await response.json();
                currentData.forms = currentData.forms || [];
            }

            // Update or add the specific form
            const existingIndex = currentData.forms.findIndex(f => f.id === formData.id);
            if (existingIndex !== -1) {
                currentData.forms[existingIndex] = formData;
            } else {
                currentData.forms.push(formData);
            }

            // Update metadata
            currentData.lastUpdated = new Date().toISOString();
            currentData.metadata.totalForms = currentData.forms.length;

            // Save the complete structure back to JSONhost
            const updateResponse = await fetch(`${window.CLOUD_CONFIG.jsonhost.baseUrl}${window.CLOUD_CONFIG.jsonhost.jsonId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': window.CLOUD_CONFIG.jsonhost.apiToken
                },
                body: JSON.stringify(currentData)
            });

            if (updateResponse.ok) {
                console.log('Form saved to JSONhost successfully');
            } else {
                console.error('Failed to save form to JSONhost:', updateResponse.status);
            }
        } catch (error) {
            console.error('Error saving form to JSONhost:', error);
        }
    }

    async deleteFormFromJSONhost(formId) {
        if (!window.CLOUD_CONFIG?.jsonhost?.jsonId) {
            console.log('JSONhost not configured for forms');
            return;
        }

        try {
            // Get the complete current data structure from JSONhost
            const response = await fetch(`${window.CLOUD_CONFIG.jsonhost.baseUrl}${window.CLOUD_CONFIG.jsonhost.jsonId}`);
            let currentData = {
                notices: this.notices,
                forms: [],
                lastUpdated: new Date().toISOString(),
                version: "1.0",
                metadata: {
                    title: "SMP College Notice Board",
                    description: "Official notices and announcements",
                    totalNotices: this.notices.length,
                    totalForms: 0,
                    service: "jsonhost"
                }
            };

            // If JSONhost data exists, preserve it and update only forms
            if (response.ok) {
                currentData = await response.json();
                currentData.forms = currentData.forms || [];
            }

            // Remove the specific form
            currentData.forms = currentData.forms.filter(f => f.id !== formId);

            // Update metadata
            currentData.lastUpdated = new Date().toISOString();
            currentData.metadata.totalForms = currentData.forms.length;

            // Save the complete structure back to JSONhost
            const updateResponse = await fetch(`${window.CLOUD_CONFIG.jsonhost.baseUrl}${window.CLOUD_CONFIG.jsonhost.jsonId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': window.CLOUD_CONFIG.jsonhost.apiToken
                },
                body: JSON.stringify(currentData)
            });

            if (updateResponse.ok) {
                console.log('Form deleted from JSONhost successfully');
            } else {
                console.error('Failed to delete form from JSONhost:', updateResponse.status);
            }
        } catch (error) {
            console.error('Error deleting form from JSONhost:', error);
        }
    }

    async getFormsFromJSONhost() {
        if (!window.CLOUD_CONFIG?.jsonhost?.jsonId) {
            return null;
        }

        try {
            const response = await fetch(`${window.CLOUD_CONFIG.jsonhost.baseUrl}${window.CLOUD_CONFIG.jsonhost.jsonId}`);
            if (response.ok) {
                const data = await response.json();
                return data.forms || [];
            }
        } catch (error) {
            console.error('Error loading forms from JSONhost:', error);
        }
        return null;
    }

    // Enhanced form response synchronization with better error handling and race condition prevention
    async saveFormResponseToJSONhost(formId, responseData) {
        console.log(`🔄 saveFormResponseToJSONhost called with formId: ${formId}`);
        console.log('🔍 DEBUG: Response data to save:', responseData);
        
        if (!window.CLOUD_CONFIG?.jsonhost?.jsonId) {
            console.log('❌ JSONhost not configured for form responses');
            return { success: false, error: 'JSONhost not configured' };
        }

        // Use a mutex to prevent race conditions
        const lockKey = `form_response_lock_${formId}`;
        if (this.syncLocks && this.syncLocks[lockKey]) {
            console.log('🔒 Form response sync already in progress, queuing...');
            return new Promise((resolve) => {
                setTimeout(() => resolve(this.saveFormResponseToJSONhost(formId, responseData)), 1000);
            });
        }

        this.syncLocks = this.syncLocks || {};
        this.syncLocks[lockKey] = true;

        try {
            // Get current data with retry mechanism
            let currentData, attempt = 0;
            const maxAttempts = 3;
            
            while (attempt < maxAttempts) {
                try {
                    const response = await fetch(`${window.CLOUD_CONFIG.jsonhost.baseUrl}${window.CLOUD_CONFIG.jsonhost.jsonId}`);
                    if (response.ok) {
                        currentData = await response.json();
                        break;
                    }
                    throw new Error(`HTTP ${response.status}`);
                } catch (error) {
                    attempt++;
                    console.log(`⚠️ Attempt ${attempt} failed, retrying...`);
                    if (attempt >= maxAttempts) throw error;
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }

            if (!currentData) {
                throw new Error('Failed to retrieve current data from JSONhost');
            }

            // Ensure forms array exists
            if (!currentData.forms) {
                currentData.forms = [];
            }

            // Find or create form
            let form = currentData.forms.find(f => f.id === formId);
            if (!form) {
                console.log(`⚠️ Form ${formId} not found in cloud, checking local storage...`);
                const localForms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
                form = localForms.find(f => f.id === formId);
                if (form) {
                    currentData.forms.push(form);
                    console.log(`✅ Added form ${formId} to cloud from local storage`);
                } else {
                    throw new Error(`Form ${formId} not found in local storage or cloud`);
                }
            }

            // Initialize responses array if needed
            if (!form.responses) {
                form.responses = [];
            }

            // Create enhanced response object with better metadata
            const enhancedResponse = {
                id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                ipHash: await this.generateSimpleHash(navigator.userAgent + Date.now()),
                deviceInfo: {
                    platform: navigator.platform,
                    language: navigator.language,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                formVersion: form.version || '1.0',
                data: responseData,
                status: 'submitted',
                lastModified: new Date().toISOString()
            };

            // Add response to form
            form.responses.push(enhancedResponse);
            form.lastModified = new Date().toISOString();
            form.responseCount = form.responses.length;

            // Update metadata
            currentData.lastUpdated = new Date().toISOString();
            currentData.metadata = currentData.metadata || {};
            currentData.metadata.totalForms = currentData.forms.length;
            currentData.metadata.totalResponses = currentData.forms.reduce((sum, f) => sum + (f.responses?.length || 0), 0);
            currentData.metadata.lastResponseTime = new Date().toISOString();

            // Save with retry mechanism
            attempt = 0;
            while (attempt < maxAttempts) {
                try {
                    const response = await fetch(`${window.CLOUD_CONFIG.jsonhost.baseUrl}${window.CLOUD_CONFIG.jsonhost.jsonId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': window.CLOUD_CONFIG.jsonhost.apiToken
                        },
                        body: JSON.stringify(currentData)
                    });

                    if (response.ok) {
                        console.log('✅ Form response saved to JSONhost successfully');
                        console.log(`✅ Form "${form.title}" now has ${form.responses.length} responses in cloud`);
                        
                        // Update local storage to maintain consistency
                        const localForms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
                        const localFormIndex = localForms.findIndex(f => f.id === formId);
                        if (localFormIndex !== -1) {
                            localForms[localFormIndex] = form;
                            localStorage.setItem('smp-forms', JSON.stringify(localForms));
                        }
                        
                        return { success: true, responseId: enhancedResponse.id, responseCount: form.responses.length };
                    }
                    throw new Error(`HTTP ${response.status}`);
                } catch (error) {
                    attempt++;
                    console.log(`⚠️ Save attempt ${attempt} failed, retrying...`);
                    if (attempt >= maxAttempts) throw error;
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        } catch (error) {
            console.error('Error saving form response to JSONhost:', error);
            return { success: false, error: error.message };
        } finally {
            delete this.syncLocks[lockKey];
        }
    }

    // Sync form responses from cloud
    async syncFormResponsesFromCloud(formId) {
        console.log(`🔄 Syncing responses for form ${formId} from cloud`);
        
        if (!window.CLOUD_CONFIG?.jsonhost?.jsonId) {
            console.log('❌ JSONhost not configured for syncing responses');
            return;
        }

        try {
            const response = await fetch(`${window.CLOUD_CONFIG.jsonhost.baseUrl}${window.CLOUD_CONFIG.jsonhost.jsonId}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const cloudData = await response.json();
            if (!cloudData.forms) {
                console.log('No forms found in cloud data');
                return;
            }

            const cloudForm = cloudData.forms.find(f => f.id === formId);
            if (!cloudForm) {
                console.log(`Form ${formId} not found in cloud`);
                return;
            }

            // Update local form with cloud responses
            const localForms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
            const localFormIndex = localForms.findIndex(f => f.id === formId);
            
            if (localFormIndex !== -1) {
                localForms[localFormIndex].responses = cloudForm.responses || [];
                localStorage.setItem('smp-forms', JSON.stringify(localForms));
                console.log(`✅ Synced ${cloudForm.responses?.length || 0} responses from cloud`);
            }
        } catch (error) {
            console.error('Error syncing form responses from cloud:', error);
        }
    }

    // Helper function to generate simple hash for anonymization
    async generateSimpleHash(input) {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substr(0, 16);
    }

    // Create form HTML for display in notice cards
    createFormHTML(formId, notice) {
        console.log(`🔍 DEBUG: createFormHTML called with formId: ${formId}`);
        if (!formId) return '';
        
        // First try to get form from notice data (embedded form)
        let form = notice.formData;
        console.log(`🔍 DEBUG: Embedded form data:`, form);
        
        // Fallback to localStorage if no embedded form data
        if (!form) {
            const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
            console.log(`🔍 DEBUG: Available forms in localStorage:`, forms.map(f => ({id: f.id, title: f.title})));
            form = forms.find(f => f.id === formId);
            console.log(`🔍 DEBUG: Found form in localStorage:`, form ? {id: form.id, title: form.title} : 'NOT FOUND');
        }
        
        if (!form) {
            console.log(`❌ Form with ID ${formId} not found anywhere!`);
            return '';
        }
        
        // Show disabled forms to admins, hide from regular users
        if (!form.enabled && !this.isAdmin) return '';
        
        const isDisabled = !form.enabled;
        const questions = form.questions || [];
        
        return `
            <div class="notice-form-container ${isDisabled ? 'form-disabled' : ''}">
                <div class="form-header">
                    <div class="form-title-section">
                        <h4 class="form-title">
                            <i class="fas fa-poll"></i>
                            ${form.title}
                            ${isDisabled ? '<span class="form-status-badge">Disabled</span>' : ''}
                        </h4>
                        ${this.isAdmin ? `
                            <div class="form-admin-controls">
                                <button type="button" class="btn btn-sm btn-secondary toggle-form-btn" data-form-id="${formId}" title="Toggle Form Visibility">
                                    <i class="fas fa-eye${form.enabled ? '' : '-slash'}"></i>
                                    ${form.enabled ? 'Disable' : 'Enable'}
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    ${form.description ? `<p class="form-description">${form.description}</p>` : ''}
                    ${isDisabled && this.isAdmin ? '<p class="form-disabled-message"><i class="fas fa-info-circle"></i> This form is disabled and not visible to students.</p>' : ''}
                </div>
                ${!isDisabled ? this.createSimpleFormLayout(form, formId) : ''}
            </div>
        `;
    }

    // Create simple form layout like the image
    createSimpleFormLayout(form, formId) {
        const questions = form.questions || [];
        if (questions.length === 0) return '';
        
        const questionsHTML = questions.map((question, index) => {
            return `
                <div class="simple-form-question" data-question-index="${index}">
                    <div class="question-row">
                        <span class="question-text">${question.question}</span>
                        ${question.required ? '<span class="required">*</span>' : ''}
                        <span class="question-number">Q${index + 1}:</span>
                    </div>
                    <div class="question-answer">
                        ${this.createSimpleQuestionHTML(question)}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="simple-form-container">
                <form class="notice-form simple-form" data-form-id="${formId}">
                    ${questionsHTML}
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary submit-form-btn">
                            Submit Response
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    // Create form content with navigation for longer forms
    createFormContentWithNavigation(form, formId) {
        const questions = form.questions || [];
        const hasNavigation = questions.length > 3; // Show navigation for forms with more than 3 questions

        if (!hasNavigation) {
            // Simple form layout for shorter forms
            return `
                <form class="notice-form" data-form-id="${formId}">
                    ${questions.map(question => this.createQuestionHTML(question)).join('')}
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary submit-form-btn">
                            <i class="fas fa-paper-plane"></i>
                            Submit Response
                        </button>
                    </div>
                </form>
            `;
        }

        // Complex form layout with navigation
        const navigationHTML = this.createFormNavigation(questions);
        const sectionsHTML = this.createFormSections(questions);

        return `
            <div class="form-content-with-nav">
                <div class="form-vertical-nav">
                    ${navigationHTML}
                </div>
                <div class="form-main-content">
                    <form class="notice-form" data-form-id="${formId}">
                        ${sectionsHTML}
                        <div class="form-actions" id="form-actions">
                            <button type="submit" class="btn btn-primary submit-form-btn">
                                <i class="fas fa-paper-plane"></i>
                                Submit Response
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    // Setup form progress tracking for scrollable forms
    setupFormProgressTracking(form) {
        // Check if it's a simple form (no progress tracking needed)
        if (form.classList.contains('simple-form')) {
            // Just add basic form validation feedback
            const questions = form.querySelectorAll('.simple-form-question');
            if (questions.length === 0) return;

            // Add validation feedback
            const allInputs = form.querySelectorAll('input, textarea, select');
            allInputs.forEach(input => {
                const updateAnswerStatus = () => {
                    const questionContainer = input.closest('.simple-form-question');
                    if (questionContainer) {
                        if (input.value.trim() !== '' || input.checked) {
                            questionContainer.classList.add('answered');
                        } else {
                            questionContainer.classList.remove('answered');
                        }
                    }
                };
                
                input.addEventListener('input', updateAnswerStatus);
                input.addEventListener('change', updateAnswerStatus);
            });
            return;
        }

        // Legacy scrollable form support
        const formContainer = form.closest('.form-scrollable-window');
        if (!formContainer) return;

        const progressFill = formContainer.querySelector('.progress-fill');
        const progressCount = formContainer.querySelector('.progress-count');
        const questions = form.querySelectorAll('.form-question-item');
        
        if (!progressFill || !progressCount || questions.length === 0) return;

        const totalQuestions = questions.length;
        
        // Function to update progress
        const updateProgress = () => {
            let answeredQuestions = 0;
            
            questions.forEach(questionItem => {
                const inputs = questionItem.querySelectorAll('input, select, textarea');
                let hasAnswer = false;
                
                inputs.forEach(input => {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        if (input.checked) hasAnswer = true;
                    } else if (input.value && input.value.trim() !== '') {
                        hasAnswer = true;
                    }
                });
                
                if (hasAnswer) {
                    answeredQuestions++;
                    questionItem.classList.add('answered');
                } else {
                    questionItem.classList.remove('answered');
                }
            });
            
            const progressPercentage = (answeredQuestions / totalQuestions) * 100;
            progressFill.style.width = `${progressPercentage}%`;
            progressCount.textContent = `${answeredQuestions} / ${totalQuestions}`;
            
            // Update progress bar color based on completion
            if (progressPercentage === 100) {
                progressFill.style.background = 'var(--success-color)';
            } else if (progressPercentage >= 50) {
                progressFill.style.background = 'var(--info-color)';
            } else {
                progressFill.style.background = 'var(--primary-color)';
            }
        };

        // Add event listeners to all form inputs
        questions.forEach(questionItem => {
            const inputs = questionItem.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.addEventListener('input', updateProgress);
                input.addEventListener('change', updateProgress);
                input.addEventListener('focus', () => {
                    questionItem.classList.add('focused');
                });
                input.addEventListener('blur', () => {
                    questionItem.classList.remove('focused');
                });
            });
        });

        // Initial progress calculation
        updateProgress();
    }

    // Create navigation for form sections
    createFormNavigation(questions) {
        const sections = this.groupQuestionsIntoSections(questions);
        
        let navHTML = `
            <div class="nav-section">
                <div class="nav-title">Form Sections</div>
        `;

        sections.forEach((section, index) => {
            navHTML += `
                <div class="nav-item" data-section-id="section-${index}" onclick="window.noticeBoard.scrollToFormSection('section-${index}')">
                    ${section.title}
                    <small>(${section.questions.length} questions)</small>
                </div>
            `;
        });

        navHTML += `
            </div>
            <div class="nav-section">
                <div class="nav-title">Quick Jump</div>
                <div class="nav-item" onclick="window.noticeBoard.scrollToFormSection('form-actions')">
                    <i class="fas fa-paper-plane"></i>
                    Submit Form
                </div>
            </div>
        `;

        return navHTML;
    }

    // Group questions into logical sections
    groupQuestionsIntoSections(questions) {
        const sections = [];
        const questionsPerSection = 3;

        for (let i = 0; i < questions.length; i += questionsPerSection) {
            const sectionQuestions = questions.slice(i, i + questionsPerSection);
            const sectionTitle = `Questions ${i + 1}-${Math.min(i + questionsPerSection, questions.length)}`;
            
            sections.push({
                title: sectionTitle,
                questions: sectionQuestions,
                startIndex: i
            });
        }

        return sections;
    }

    // Create form sections with questions
    createFormSections(questions) {
        const sections = this.groupQuestionsIntoSections(questions);
        
        let sectionsHTML = '';
        
        sections.forEach((section, sectionIndex) => {
            sectionsHTML += `
                <div class="form-section" id="section-${sectionIndex}">
                    <div class="section-header">
                        <h5 class="section-title">${section.title}</h5>
                        <div class="section-progress">
                            Section ${sectionIndex + 1} of ${sections.length}
                        </div>
                    </div>
                    <div class="section-questions">
                        ${section.questions.map(question => this.createQuestionHTML(question)).join('')}
                    </div>
                </div>
            `;
        });

        return sectionsHTML;
    }

    // Scroll to specific form section
    scrollToFormSection(sectionId) {
        const element = document.getElementById(sectionId) || document.querySelector(`.${sectionId}`);
        if (element) {
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
            });

            // Update active navigation item
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            
            const navItem = document.querySelector(`[data-section-id="${sectionId}"]`);
            if (navItem) {
                navItem.classList.add('active');
            }
        }
    }

    // Create HTML for individual form questions
    createQuestionHTML(question, includeLabel = true) {
        const requiredMark = question.required ? '<span class="required">*</span>' : '';
        
        const labelHTML = includeLabel ? `
            <label class="question-label">
                ${question.question}${requiredMark}
            </label>
        ` : '';
        
        switch (question.type) {
            case 'text':
                return `
                    <div class="form-question">
                        ${labelHTML}
                        <input type="text" name="question_${question.id}" ${question.required ? 'required' : ''} class="form-input">
                    </div>
                `;
                
            case 'textarea':
                return `
                    <div class="form-question">
                        ${labelHTML}
                        <textarea name="question_${question.id}" ${question.required ? 'required' : ''} class="form-textarea" rows="3"></textarea>
                    </div>
                `;
                
            case 'radio':
                return `
                    <div class="form-question">
                        ${labelHTML}
                        <div class="radio-group">
                            ${question.options.map((option, index) => `
                                <label class="radio-option">
                                    <input type="radio" name="question_${question.id}" value="${option}" ${question.required ? 'required' : ''}>
                                    <span>${option}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `;
                
            case 'checkbox':
                return `
                    <div class="form-question">
                        ${labelHTML}
                        <div class="checkbox-group">
                            ${question.options.map((option, index) => `
                                <label class="checkbox-option">
                                    <input type="checkbox" name="question_${question.id}[]" value="${option}">
                                    <span>${option}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `;
                
            case 'select':
                return `
                    <div class="form-question">
                        ${labelHTML}
                        <select name="question_${question.id}" ${question.required ? 'required' : ''} class="form-select">
                            <option value="">Select an option</option>
                            ${question.options.map(option => `
                                <option value="${option}">${option}</option>
                            `).join('')}
                        </select>
                    </div>
                `;
                
            default:
                return '';
        }
    }

    // Create simple question HTML matching the image design
    createSimpleQuestionHTML(question) {
        switch (question.type) {
            case 'text':
                return `<input type="text" name="question_${question.id}" class="simple-form-input" ${question.required ? 'required' : ''}>`;
                
            case 'textarea':
                return `<textarea name="question_${question.id}" class="simple-form-textarea" rows="3" ${question.required ? 'required' : ''}></textarea>`;
                
            case 'radio':
                return `
                    <div class="simple-radio-group">
                        ${question.options.map((option, index) => `
                            <label class="simple-radio-option">
                                <input type="radio" name="question_${question.id}" value="${option}" ${question.required ? 'required' : ''}>
                                <span class="option-text">${option}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
                
            case 'checkbox':
                return `
                    <div class="simple-checkbox-group">
                        ${question.options.map((option, index) => `
                            <label class="simple-checkbox-option">
                                <input type="checkbox" name="question_${question.id}[]" value="${option}">
                                <span class="option-text">${option}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
                
            case 'select':
                return `
                    <select name="question_${question.id}" class="simple-form-select" ${question.required ? 'required' : ''}>
                        <option value="">Select an option</option>
                        ${question.options.map(option => `
                            <option value="${option}">${option}</option>
                        `).join('')}
                    </select>
                `;
                
            default:
                return '';
        }
    }

    // Enhanced form submission handling with better validation and user feedback
    async handleFormSubmission(formElement) {
        const formId = formElement.dataset.formId;
        if (!formId) {
            this.showToast('Invalid form configuration', 'error');
            return;
        }

        // Disable form during submission
        const submitButton = formElement.querySelector('button[type="submit"]');
        const originalButtonText = submitButton?.textContent || 'Submit';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        }

        // Get form data with error handling
        const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
        const form = forms.find(f => f.id === formId);
        if (!form) {
            this.showToast('Form configuration not found', 'error');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
            return;
        }

        // Check if form is enabled
        if (!form.enabled) {
            this.showToast('This form is currently disabled', 'error');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
            return;
        }

        // Collect form responses
        const responses = {};
        const formData = new FormData(formElement);
        
        form.questions.forEach(question => {
            const fieldName = `question_${question.id}`;
            
            if (question.type === 'checkbox') {
                const checkboxValues = formData.getAll(`${fieldName}[]`);
                responses[question.id] = {
                    question: question.question,
                    type: question.type,
                    answer: checkboxValues
                };
            } else {
                const value = formData.get(fieldName);
                responses[question.id] = {
                    question: question.question,
                    type: question.type,
                    answer: value || ''
                };
            }
        });

        // Validate required fields
        const missingFields = [];
        form.questions.forEach(question => {
            if (question.required) {
                const response = responses[question.id];
                if (!response.answer || 
                    (Array.isArray(response.answer) && response.answer.length === 0) ||
                    (typeof response.answer === 'string' && response.answer.trim() === '')) {
                    missingFields.push(question.question);
                }
            }
        });

        if (missingFields.length > 0) {
            this.showToast(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
            return;
        }

        // Skip duplicate checking for now to avoid issues
        // if (this.isDuplicateSubmission(form, responses)) {
        //     this.showToast('This response has already been submitted. Duplicate entries are not allowed.', 'warning');
        //     return;
        // }

        // Create enhanced response object
        const responseData = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            formId: formId,
            responses: responses,
            submittedAt: new Date().toISOString(),
            userAgent: navigator.userAgent.substring(0, 100),
            deviceInfo: {
                platform: navigator.platform,
                language: navigator.language,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            formVersion: form.version || '1.0',
            status: 'submitted'
        };

        // Save response locally first for immediate feedback
        try {
            // Add response to form immediately
            if (!form.responses) {
                form.responses = [];
            }
            form.responses.push(responseData);
            
            // Update form in localStorage immediately
            const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
            const formIndex = forms.findIndex(f => f.id === formId);
            if (formIndex !== -1) {
                forms[formIndex] = form;
                localStorage.setItem('smp-forms', JSON.stringify(forms));
            }
            
            // Show success message immediately
            this.showToast(`Response submitted successfully! ID: ${responseData.id.substr(-8)}`, 'success');
            formElement.reset();
            
            // Save to cloud asynchronously in background
            this.saveFormResponseToJSONhost(formId, responseData).then(cloudResult => {
                console.log('Cloud sync completed:', cloudResult);
            }).catch(error => {
                console.error('Cloud sync failed, but data is saved locally:', error);
            });
            
            // Update form statistics
            this.updateFormStats(formId);
            
            // Track submission for analytics
            this.trackFormSubmission(formId, form.title);
        } catch (error) {
            console.error('Form submission error:', error);
            this.showToast(error.message || 'Error submitting form. Please try again.', 'error');
        } finally {
            // Re-enable form
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    }

    // Check if this is a duplicate submission
    isDuplicateSubmission(form, newResponses) {
        // Get existing responses for this form
        const existingResponses = form.responses || [];
        
        // If no existing responses, it's not a duplicate
        if (existingResponses.length === 0) {
            return false;
        }
        
        // Compare new responses with existing ones
        for (const existingResponse of existingResponses) {
            let isIdentical = true;
            
            // Get the responses from the existing response object
            const existingResponseData = existingResponse.responses || existingResponse.data || {};
            
            // Compare each question's answer
            for (const questionId in newResponses) {
                const newAnswer = newResponses[questionId]?.answer;
                const existingAnswer = existingResponseData[questionId]?.answer;
                
                // Skip if either answer is undefined
                if (newAnswer === undefined || existingAnswer === undefined) {
                    isIdentical = false;
                    break;
                }
                
                // Handle array comparison for checkboxes
                if (Array.isArray(newAnswer) && Array.isArray(existingAnswer)) {
                    if (newAnswer.length !== existingAnswer.length || 
                        !newAnswer.every(val => existingAnswer.includes(val))) {
                        isIdentical = false;
                        break;
                    }
                } else if (newAnswer !== existingAnswer) {
                    isIdentical = false;
                    break;
                }
            }
            
            if (isIdentical) {
                console.log('Duplicate submission detected');
                return true; // Found duplicate
            }
        }
        
        return false; // No duplicate found
    }

    // Save form response to storage and cloud
    async saveFormResponse(form, responseData) {
        console.log('🔍 DEBUG: Saving form response for form:', form.id);
        console.log('🔍 DEBUG: Response data:', responseData);
        
        try {
            // Add response to form
            if (!form.responses) {
                form.responses = [];
            }
            form.responses.push(responseData);
            
            console.log(`🔍 DEBUG: Form now has ${form.responses.length} responses`);
            
            // Update form in localStorage
            const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
            const formIndex = forms.findIndex(f => f.id === form.id);
            if (formIndex !== -1) {
                forms[formIndex] = form;
                localStorage.setItem('smp-forms', JSON.stringify(forms));
                console.log('✅ Form with response saved to localStorage');
            }
            
            // Save to JSONhost asynchronously (don't block UI)
            console.log('🔄 Saving response to JSONhost...');
            this.saveFormResponseToJSONhost(form.id, responseData).then(cloudResult => {
                console.log('Cloud sync result:', cloudResult);
                if (!cloudResult.success) {
                    console.warn('Cloud sync failed, but data is saved locally');
                }
            }).catch(error => {
                console.error('Cloud sync error:', error);
            });
            
            console.log('Form response saved locally:', responseData);
            return { success: true, responseId: responseData.id, cloudSync: 'pending' };
        } catch (error) {
            console.error('Error saving form response:', error);
            return { success: false, error: error.message };
        }
    }

    // Show form export options
    showFormExportOptions() {
        if (!this.currentForm || !this.currentForm.responses || this.currentForm.responses.length === 0) {
            this.showToast('No responses to export', 'warning');
            return;
        }

        const exportOptions = [
            { label: 'CSV Export', action: () => this.exportFormDataAsCSV(), icon: 'fas fa-file-csv' },
            { label: 'PDF Export', action: () => this.exportFormDataAsPDF(), icon: 'fas fa-file-pdf' }
        ];

        // Create a simple menu instead of using the main export modal
        const menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.innerHTML = `
            <div class="export-menu-content">
                <h4>Export Form Responses</h4>
                <p>Form: ${this.currentForm.title}</p>
                <p>Total Responses: ${this.currentForm.responses.length}</p>
                ${exportOptions.map(option => `
                    <button class="export-option-btn" data-action="${option.label}">
                        <i class="${option.icon}"></i>
                        ${option.label}
                    </button>
                `).join('')}
                <button class="export-option-btn cancel-export">
                    <i class="fas fa-times"></i>
                    Cancel
                </button>
            </div>
        `;

        // Add to body temporarily
        document.body.appendChild(menu);

        // Add event listeners
        menu.querySelectorAll('.export-option-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('cancel-export')) {
                    document.body.removeChild(menu);
                } else {
                    exportOptions[index].action();
                    document.body.removeChild(menu);
                }
            });
        });

        // Click outside to close
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    if (document.body.contains(menu)) {
                        document.body.removeChild(menu);
                    }
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    // Export form data as CSV
    exportFormDataAsCSV() {
        if (!this.currentForm || !this.currentForm.responses) return;

        const responses = this.currentForm.responses;
        const questions = this.currentForm.questions;

        // Create CSV header
        const headers = ['Response ID', 'Submitted At'];
        questions.forEach(q => headers.push(`Q${q.id}: ${q.question}`));

        // Create CSV rows
        const rows = [headers];
        responses.forEach(response => {
            const row = [response.id, new Date(response.submittedAt || response.timestamp).toLocaleString()];
            
            // Handle both local and cloud response structures
            let responseData = {};
            if (response.responses && typeof response.responses === 'object') {
                responseData = response.responses;
            } else if (response.data && response.data.responses && typeof response.data.responses === 'object') {
                responseData = response.data.responses;
            } else if (response.data && typeof response.data === 'object') {
                responseData = response.data;
            }
            
            questions.forEach(q => {
                const answer = responseData[q.id]?.answer || '';
                // Handle array answers (checkboxes)
                const answerText = Array.isArray(answer) ? answer.join('; ') : answer;
                row.push(answerText);
            });
            rows.push(row);
        });

        // Convert to CSV string
        const csvContent = rows.map(row => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${this.currentForm.title}_responses.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast('CSV exported successfully!', 'success');
    }

    // Export form data as PDF
    exportFormDataAsPDF() {
        if (!this.currentForm || !this.currentForm.responses) return;

        const responses = this.currentForm.responses;
        const questions = this.currentForm.questions;

        // Create HTML content for PDF
        let htmlContent = `
            <html>
            <head>
                <title>${this.currentForm.title} - Responses</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; border-bottom: 2px solid #a8d5e2; padding-bottom: 10px; }
                    .form-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
                    .response { border: 1px solid #ddd; margin-bottom: 20px; padding: 15px; border-radius: 5px; }
                    .response-header { background: #a8d5e2; color: white; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 5px 5px 0 0; }
                    .question { margin-bottom: 10px; }
                    .question-label { font-weight: bold; color: #555; }
                    .answer { margin-left: 15px; color: #333; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <h1>${this.currentForm.title} - Form Responses</h1>
                <div class="form-info">
                    <p><strong>Form Description:</strong> ${this.currentForm.description || 'No description'}</p>
                    <p><strong>Total Responses:</strong> ${responses.length}</p>
                    <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
                </div>
        `;

        responses.forEach((response, index) => {
            htmlContent += `
                <div class="response">
                    <div class="response-header">
                        <strong>Response #${index + 1}</strong> - ${new Date(response.submittedAt).toLocaleString()}
                    </div>
            `;

            questions.forEach(q => {
                // Handle both local and cloud response structures
                let responseData = {};
                if (response.responses && typeof response.responses === 'object') {
                    responseData = response.responses;
                } else if (response.data && response.data.responses && typeof response.data.responses === 'object') {
                    responseData = response.data.responses;
                } else if (response.data && typeof response.data === 'object') {
                    responseData = response.data;
                }
                
                const answer = responseData[q.id]?.answer || 'No answer';
                const answerText = Array.isArray(answer) ? answer.join(', ') : answer;
                htmlContent += `
                    <div class="question">
                        <div class="question-label">${q.question}</div>
                        <div class="answer">${answerText}</div>
                    </div>
                `;
            });

            htmlContent += '</div>';
        });

        htmlContent += '</body></html>';

        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load then print
        printWindow.onload = function() {
            printWindow.print();
            // Close window after printing (optional)
            printWindow.onafterprint = function() {
                printWindow.close();
            };
        };

        this.showToast('PDF export opened in new window. Please print or save as PDF.', 'info');
    }

    // Toggle form visibility (enable/disable)
    toggleFormVisibility(formId) {
        if (!formId) return;

        const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
        const form = forms.find(f => f.id === formId);
        
        if (!form) {
            this.showToast('Form not found', 'error');
            return;
        }

        // Toggle the enabled state
        form.enabled = !form.enabled;
        form.lastModified = new Date().toISOString();

        // Update localStorage
        const formIndex = forms.findIndex(f => f.id === formId);
        if (formIndex !== -1) {
            forms[formIndex] = form;
            localStorage.setItem('smp-forms', JSON.stringify(forms));
        }

        // Update cloud storage
        this.saveFormToJSONhost(form);

        // Re-render notices to reflect changes
        this.render();

        const action = form.enabled ? 'enabled' : 'disabled';
        this.showToast(`Form ${action} successfully`, 'success');
    }

    // Open form data management modal
    async openFormDataManagement() {
        if (!this.currentForm) {
            this.showToast('No form selected', 'warning');
            return;
        }

        console.log('🔍 DEBUG: Opening form data management for form:', this.currentForm.id);
        
        // Get fresh form data from localStorage
        const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
        const updatedForm = forms.find(f => f.id === this.currentForm.id);
        if (updatedForm) {
            this.currentForm = updatedForm;
            console.log('🔍 DEBUG: Updated form from localStorage, responses:', this.currentForm.responses?.length || 0);
        }

        // Try to sync with cloud to get latest responses (don't wait for it)
        this.syncFormResponsesFromCloud(this.currentForm.id).then(() => {
            console.log('🔍 DEBUG: Cloud sync completed, refreshing table');
            // Refresh the table after cloud sync
            const freshForms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
            const freshForm = freshForms.find(f => f.id === this.currentForm.id);
            if (freshForm && freshForm.responses && freshForm.responses.length > 0) {
                this.currentForm = freshForm;
                this.totalResponses.textContent = this.currentForm.responses.length;
                this.loadFormDataTable();
            }
        }).catch(error => {
            console.log('Cloud sync failed, continuing with local data:', error);
        });

        // Show modal immediately with local data
        this.formDataModal.style.display = 'block';
        this.currentFormName.textContent = this.currentForm.title;
        this.totalResponses.textContent = this.currentForm.responses?.length || 0;
        
        console.log('🔍 DEBUG: Current form responses before loading table:', this.currentForm.responses?.length || 0);
        this.loadFormDataTable();
    }

    // Close form data management modal
    closeFormDataManagement() {
        this.formDataModal.style.display = 'none';
        this.searchResponses.value = '';
        this.clearResponseSelection();
    }

    // Load form data into table
    loadFormDataTable() {
        console.log('🔍 DEBUG: loadFormDataTable called');
        console.log('🔍 DEBUG: Current form:', this.currentForm);
        console.log('🔍 DEBUG: Current form responses:', this.currentForm?.responses);
        
        const responses = this.currentForm.responses || [];
        console.log('🔍 DEBUG: Found responses array with length:', responses.length);
        
        if (responses.length === 0) {
            console.log('🔍 DEBUG: No responses found, showing empty message');
            this.formDataTableContainer.innerHTML = `
                <div class="empty-responses-message">
                    <i class="fas fa-inbox"></i>
                    <p>No responses found</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 10px;">
                        Form ID: ${this.currentForm?.id || 'Unknown'}<br>
                        Responses array: ${Array.isArray(this.currentForm?.responses) ? 'Array' : typeof this.currentForm?.responses}
                    </p>
                </div>
            `;
            return;
        }

        // Get all unique questions from the first response or form structure
        const sampleResponse = responses[0];
        const questions = this.currentForm.questions || [];
        
        let tableHTML = `
            <table class="form-data-table">
                <thead>
                    <tr>
                        <th>
                            <input type="checkbox" id="selectAllCheckbox" class="response-checkbox">
                        </th>
                        <th>ID</th>
                        <th>Submitted</th>
                        <th>Preview</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        responses.forEach((response, index) => {
            console.log('🔍 DEBUG: Processing response', index, ':', response);
            
            const submittedDate = new Date(response.submittedAt || response.timestamp).toLocaleString();
            
            // Handle both local and cloud response structures
            let firstAnswer = 'No data';
            
            // Local structure: response.responses
            // Cloud structure: response.data.responses
            let responseData = null;
            
            if (response.responses && typeof response.responses === 'object') {
                responseData = response.responses;
            } else if (response.data && response.data.responses && typeof response.data.responses === 'object') {
                responseData = response.data.responses;
            } else if (response.data && typeof response.data === 'object') {
                responseData = response.data;
            }
            
            if (responseData && typeof responseData === 'object') {
                const values = Object.values(responseData);
                if (values.length > 0) {
                    const firstValue = values[0];
                    
                    // Handle different possible answer structures
                    if (firstValue && typeof firstValue === 'object' && firstValue.answer) {
                        firstAnswer = firstValue.answer;
                    } else if (typeof firstValue === 'string') {
                        firstAnswer = firstValue;
                    } else if (firstValue) {
                        firstAnswer = String(firstValue);
                    }
                }
            }
            const preview = String(firstAnswer).length > 50 ? String(firstAnswer).substring(0, 50) + '...' : firstAnswer;

            tableHTML += `
                <tr data-response-id="${response.id}">
                    <td>
                        <input type="checkbox" class="response-checkbox" value="${response.id}">
                    </td>
                    <td>#${index + 1}</td>
                    <td>
                        <span class="response-timestamp">${submittedDate}</span>
                    </td>
                    <td>
                        <span class="response-preview">${preview}</span>
                    </td>
                    <td>
                        <div class="response-actions">
                            <button class="response-action-btn" onclick="window.noticeBoard.viewResponseDetail('${response.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="response-action-btn" onclick="window.noticeBoard.deleteResponseById('${response.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        this.formDataTableContainer.innerHTML = tableHTML;

        // Add event listeners for checkboxes
        this.setupResponseTableEvents();
    }

    // Setup event listeners for response table
    setupResponseTableEvents() {
        // Select all checkbox
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', () => {
                const checkboxes = document.querySelectorAll('.response-checkbox:not(#selectAllCheckbox)');
                checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
                this.updateDeleteButton();
            });
        }

        // Individual checkboxes
        const checkboxes = document.querySelectorAll('.response-checkbox:not(#selectAllCheckbox)');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => this.updateDeleteButton());
        });

        // Row click to view details
        const rows = document.querySelectorAll('.form-data-table tbody tr');
        rows.forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox' && !e.target.closest('.response-actions')) {
                    const responseId = row.dataset.responseId;
                    this.viewResponseDetail(responseId);
                }
            });
        });
    }

    // Update delete button visibility
    updateDeleteButton() {
        const checkedBoxes = document.querySelectorAll('.response-checkbox:checked:not(#selectAllCheckbox)');
        this.deleteSelectedBtn.style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none';
    }

    // Search form responses
    searchFormResponses(searchTerm) {
        const rows = document.querySelectorAll('.form-data-table tbody tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    // Toggle select all
    toggleSelectAll() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = !selectAllCheckbox.checked;
            selectAllCheckbox.dispatchEvent(new Event('change'));
        }
    }

    // Delete selected responses
    deleteSelectedResponses() {
        const checkedBoxes = document.querySelectorAll('.response-checkbox:checked:not(#selectAllCheckbox)');
        const responseIds = Array.from(checkedBoxes).map(cb => cb.value);

        if (responseIds.length === 0) {
            this.showToast('No responses selected', 'warning');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${responseIds.length} selected response(s)?`)) {
            return;
        }

        // Remove responses from form
        this.currentForm.responses = this.currentForm.responses.filter(
            response => !responseIds.includes(response.id)
        );

        // Update storage
        this.updateFormInStorage();
        
        // Refresh table
        this.loadFormDataTable();
        this.totalResponses.textContent = this.currentForm.responses.length;
        
        this.showToast(`${responseIds.length} response(s) deleted successfully`, 'success');
    }

    // View response detail
    viewResponseDetail(responseId) {
        const response = this.currentForm.responses.find(r => r.id === responseId);
        if (!response) {
            this.showToast('Response not found', 'error');
            return;
        }

        this.currentViewingResponse = response;
        this.responseDetailModal.style.display = 'block';
        this.renderResponseDetail(response);

        // Show admin buttons
        if (this.isAdmin) {
            this.editResponseBtn.style.display = 'inline-block';
            this.deleteResponseBtn.style.display = 'inline-block';
        }
    }

    // Render response detail content
    renderResponseDetail(response) {
        const submittedDate = new Date(response.submittedAt || response.timestamp).toLocaleString();
        
        // Handle both local and cloud response structures
        let responses = {};
        if (response.responses && typeof response.responses === 'object') {
            responses = response.responses;
        } else if (response.data && response.data.responses && typeof response.data.responses === 'object') {
            responses = response.data.responses;
        } else if (response.data && typeof response.data === 'object') {
            responses = response.data;
        }
        
        const questions = this.currentForm.questions || [];

        let detailHTML = `
            <div class="response-meta">
                <div class="response-meta-grid">
                    <div class="meta-item">
                        <span class="meta-label">Response ID</span>
                        <span class="meta-value">${response.id}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Submitted At</span>
                        <span class="meta-value">${submittedDate}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Form</span>
                        <span class="meta-value">${this.currentForm.title}</span>
                    </div>
                </div>
            </div>
            <div class="response-answers">
        `;

        // Display all question-answer pairs
        questions.forEach(question => {
            const answer = responses[question.id]?.answer || 'No answer provided';
            const answerText = Array.isArray(answer) ? answer.join(', ') : answer;
            
            detailHTML += `
                <div class="answer-item">
                    <div class="answer-question">${question.question}</div>
                    <div class="answer-value ${!answerText || answerText === 'No answer provided' ? 'empty' : ''}">${answerText}</div>
                </div>
            `;
        });

        detailHTML += '</div>';
        this.responseDetailContainer.innerHTML = detailHTML;
    }

    // Close response detail modal
    closeResponseDetail() {
        this.responseDetailModal.style.display = 'none';
        this.currentViewingResponse = null;
    }

    // Edit response (placeholder for future implementation)
    editResponse() {
        this.showToast('Edit response feature coming soon!', 'info');
    }

    // Delete single response
    deleteResponse() {
        if (!this.currentViewingResponse) return;

        if (!confirm('Are you sure you want to delete this response?')) {
            return;
        }

        this.deleteResponseById(this.currentViewingResponse.id);
        this.closeResponseDetail();
    }

    // Delete response by ID
    deleteResponseById(responseId) {
        this.currentForm.responses = this.currentForm.responses.filter(r => r.id !== responseId);
        this.updateFormInStorage();
        
        // Refresh data if management modal is open
        if (this.formDataModal.style.display === 'block') {
            this.loadFormDataTable();
            this.totalResponses.textContent = this.currentForm.responses.length;
        }
        
        this.showToast('Response deleted successfully', 'success');
    }

    // Update form in storage and cloud
    updateFormInStorage() {
        // Update localStorage
        const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
        const formIndex = forms.findIndex(f => f.id === this.currentForm.id);
        if (formIndex !== -1) {
            forms[formIndex] = this.currentForm;
            localStorage.setItem('smp-forms', JSON.stringify(forms));
        }

        // Update cloud storage
        this.saveFormToJSONhost(this.currentForm);
    }

    // Refresh form data
    refreshFormData() {
        if (this.currentForm) {
            // Reload form from storage
            const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
            const updatedForm = forms.find(f => f.id === this.currentForm.id);
            if (updatedForm) {
                this.currentForm = updatedForm;
                this.totalResponses.textContent = this.currentForm.responses?.length || 0;
                this.loadFormDataTable();
                this.showToast('Data refreshed', 'success');
            }
        }
    }

    // Clear response selection
    clearResponseSelection() {
        const checkboxes = document.querySelectorAll('.response-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        this.updateDeleteButton();
    }
}

// Additional helper functions for enhanced form data capture
NoticeBoard.prototype.updateFormResponseCount = function(formId, count) {
    const responseCountElements = document.querySelectorAll(`[data-form-id="${formId}"] .response-count`);
    responseCountElements.forEach(element => {
        element.textContent = count;
    });
};

// Update form statistics in UI
NoticeBoard.prototype.updateFormStats = function(formId) {
    const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
    const form = forms.find(f => f.id === formId);
    if (form) {
        const responseCount = form.responses?.length || 0;
        this.updateFormResponseCount(formId, responseCount);
    }
};

// Track form submission for analytics
NoticeBoard.prototype.trackFormSubmission = function(formId, formTitle) {
    const analytics = JSON.parse(localStorage.getItem('form-analytics') || '{}');
    if (!analytics[formId]) {
        analytics[formId] = {
            title: formTitle,
            submissions: 0,
            lastSubmission: null,
            dailySubmissions: {}
        };
    }
    
    analytics[formId].submissions++;
    analytics[formId].lastSubmission = new Date().toISOString();
    
    const today = new Date().toISOString().split('T')[0];
    analytics[formId].dailySubmissions[today] = (analytics[formId].dailySubmissions[today] || 0) + 1;
    
    localStorage.setItem('form-analytics', JSON.stringify(analytics));
};

// Queue failed operations for retry
NoticeBoard.prototype.queueForRetry = function(type, data) {
    const retryQueue = JSON.parse(localStorage.getItem('retry-queue') || '[]');
    retryQueue.push({
        type,
        data,
        timestamp: new Date().toISOString(),
        attempts: 0,
        maxAttempts: 3
    });
    localStorage.setItem('retry-queue', JSON.stringify(retryQueue));
    
    // Schedule retry
    setTimeout(() => this.processRetryQueue(), 5000);
};

// Enhanced retry queue processing with better error handling
NoticeBoard.prototype.processRetryQueue = async function() {
    const retryQueue = JSON.parse(localStorage.getItem('retry-queue') || '[]');
    if (retryQueue.length === 0) return;

    console.log(`🔄 Processing retry queue with ${retryQueue.length} items...`);
    const updatedQueue = [];
    
    for (const item of retryQueue) {
        if (item.attempts >= item.maxAttempts) {
            console.log(`❌ Retry limit reached for ${item.type}:`, item.data);
            // Log failed items for debugging
            this.logFailedSync(item);
            continue;
        }

        item.attempts++;
        console.log(`🔄 Retrying ${item.type} (attempt ${item.attempts}/${item.maxAttempts})...`);

        try {
            if (item.type === 'form_response') {
                const result = await this.saveFormResponseToJSONhost(item.data.formId, item.data.responseData);
                if (result && result.success) {
                    console.log(`✅ Retry successful for ${item.type}`);
                    // Update UI to reflect successful sync
                    this.updateSyncStatus('Synced via JSONhost (Read/Write)', 'success');
                    continue; // Don't re-queue
                }
            }
        } catch (error) {
            console.error(`❌ Retry failed for ${item.type}:`, error);
            item.lastError = error.message;
            item.lastAttempt = new Date().toISOString();
        }

        updatedQueue.push(item);
    }

    localStorage.setItem('retry-queue', JSON.stringify(updatedQueue));
    
    // Update sync status based on queue state
    if (updatedQueue.length > 0) {
        this.updateSyncStatus(`Syncing... (${updatedQueue.length} pending)`, 'warning');
        // Schedule next retry with exponential backoff
        setTimeout(() => this.processRetryQueue(), Math.min(30000 * Math.pow(2, updatedQueue[0].attempts - 1), 300000));
    } else {
        this.updateSyncStatus('Synced via JSONhost (Read/Write)', 'success');
    }
};

// Log failed sync items for debugging
NoticeBoard.prototype.logFailedSync = function(item) {
    const failedSyncs = JSON.parse(localStorage.getItem('failed-syncs') || '[]');
    failedSyncs.push({
        ...item,
        finalFailure: new Date().toISOString()
    });
    
    // Keep only last 50 failed syncs
    if (failedSyncs.length > 50) {
        failedSyncs.splice(0, failedSyncs.length - 50);
    }
    
    localStorage.setItem('failed-syncs', JSON.stringify(failedSyncs));
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize sync locks object
    if (!window.noticeBoard) {
        window.noticeBoard = new NoticeBoard();
        window.noticeBoard.syncLocks = {};
    }
    
    window.testGoogleDrive = () => window.noticeBoard.testGoogleDriveSetup();
    console.log('💡 To test Google Drive setup, run: testGoogleDrive()');
});

// Additional helper functions for enhanced form data capture
NoticeBoard.prototype.updateFormResponseCount = function(formId, count) {
    const responseCountElements = document.querySelectorAll(`[data-form-id="${formId}"] .response-count`);
    responseCountElements.forEach(element => {
        element.textContent = count;
    });
};

// Update form statistics in UI
NoticeBoard.prototype.updateFormStats = function(formId) {
    const forms = JSON.parse(localStorage.getItem('smp-forms') || '[]');
    const form = forms.find(f => f.id === formId);
    if (form) {
        const responseCount = form.responses?.length || 0;
        this.updateFormResponseCount(formId, responseCount);
    }
};

// Track form submission for analytics
NoticeBoard.prototype.trackFormSubmission = function(formId, formTitle) {
    const analytics = JSON.parse(localStorage.getItem('form-analytics') || '{}');
    if (!analytics[formId]) {
        analytics[formId] = {
            title: formTitle,
            submissions: 0,
            lastSubmission: null,
            dailySubmissions: {}
        };
    }
    
    analytics[formId].submissions++;
    analytics[formId].lastSubmission = new Date().toISOString();
    
    const today = new Date().toISOString().split('T')[0];
    analytics[formId].dailySubmissions[today] = (analytics[formId].dailySubmissions[today] || 0) + 1;
    
    localStorage.setItem('form-analytics', JSON.stringify(analytics));
};

// Queue failed operations for retry
NoticeBoard.prototype.queueForRetry = function(type, data) {
    const retryQueue = JSON.parse(localStorage.getItem('retry-queue') || '[]');
    retryQueue.push({
        type,
        data,
        timestamp: new Date().toISOString(),
        attempts: 0,
        maxAttempts: 3
    });
    localStorage.setItem('retry-queue', JSON.stringify(retryQueue));
    
    // Schedule retry
    setTimeout(() => this.processRetryQueue(), 5000);
};

// Enhanced retry queue processing with better error handling
NoticeBoard.prototype.processRetryQueue = async function() {
    const retryQueue = JSON.parse(localStorage.getItem('retry-queue') || '[]');
    if (retryQueue.length === 0) return;

    console.log(`🔄 Processing retry queue with ${retryQueue.length} items...`);
    const updatedQueue = [];
    
    for (const item of retryQueue) {
        if (item.attempts >= item.maxAttempts) {
            console.log(`❌ Retry limit reached for ${item.type}:`, item.data);
            // Log failed items for debugging
            this.logFailedSync(item);
            continue;
        }

        item.attempts++;
        console.log(`🔄 Retrying ${item.type} (attempt ${item.attempts}/${item.maxAttempts})...`);

        try {
            if (item.type === 'form_response') {
                const result = await this.saveFormResponseToJSONhost(item.data.formId, item.data.responseData);
                if (result && result.success) {
                    console.log(`✅ Retry successful for ${item.type}`);
                    // Update UI to reflect successful sync
                    this.updateSyncStatus('Synced via JSONhost (Read/Write)', 'success');
                    continue; // Don't re-queue
                }
            }
        } catch (error) {
            console.error(`❌ Retry failed for ${item.type}:`, error);
            item.lastError = error.message;
            item.lastAttempt = new Date().toISOString();
        }

        updatedQueue.push(item);
    }

    localStorage.setItem('retry-queue', JSON.stringify(updatedQueue));
    
    // Update sync status based on queue state
    if (updatedQueue.length > 0) {
        this.updateSyncStatus(`Syncing... (${updatedQueue.length} pending)`, 'warning');
        // Schedule next retry with exponential backoff
        setTimeout(() => this.processRetryQueue(), Math.min(30000 * Math.pow(2, updatedQueue[0].attempts - 1), 300000));
    } else {
        this.updateSyncStatus('Synced via JSONhost (Read/Write)', 'success');
    }
};

// Log failed sync items for debugging
NoticeBoard.prototype.logFailedSync = function(item) {
    const failedSyncs = JSON.parse(localStorage.getItem('failed-syncs') || '[]');
    failedSyncs.push({
        ...item,
        finalFailure: new Date().toISOString()
    });
    
    // Keep only last 50 failed syncs
    if (failedSyncs.length > 50) {
        failedSyncs.splice(0, failedSyncs.length - 50);
    }
    
    localStorage.setItem('failed-syncs', JSON.stringify(failedSyncs));
};


// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize sync locks object
    if (!window.noticeBoard) {
        window.noticeBoard = new NoticeBoard();
        window.noticeBoard.syncLocks = {};
    }
    
    // Make test function globally available for debugging
    window.testGoogleDrive = () => window.noticeBoard.testGoogleDriveSetup();
    console.log('💡 To test Google Drive setup, run: testGoogleDrive()');
});