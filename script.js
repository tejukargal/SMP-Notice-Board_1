class NoticeBoard {
    constructor() {
        this.notices = [];
        this.filteredNotices = [];
        this.currentFilter = 'all';
        this.activeTags = new Set();
        this.sortBy = 'date-desc';
        this.viewMode = 'grid';
        this.isAdmin = false;
        this.quillEditor = null;
        this.syncInterval = null;
        this.lastSyncTime = null;
        this.isOnline = navigator.onLine;
        this.cloudWriteEnabled = true;
        this.currentTags = [];
        this.currentAttachments = [];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.fileHostingReady = true; // file.io is always ready
        this.fileHostingService = 'pcloud.com';
        this.allowedFileTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        
        this.init();
        this.initializeSubHeader();
    }

    init() {
        this.initializeElements();
        this.attachEventListeners();
        this.initializeQuill();
        this.loadFromStorage();
        this.checkAdminStatus();
        this.initializeCloudSync();
        this.initializeFileHosting();
        this.applyTheme();
        this.render();
        // Removed automatic sync polling - only sync on page load and manual refresh
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
        this.mobileFilter = document.getElementById('mobileFilter');
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
        this.mobileFilter.addEventListener('click', () => this.showMobileFilters());

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
            await this.syncWithCloud();
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
                this.updateSyncStatus('synced', 'JSONhost (Ready)');
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

        this.lastSyncTime = new Date().toISOString();
        this.updateSyncStatus('synced', `Synced via ${serviceName}`);
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

        // Optimize notices for cloud sync by compressing attachments
        const optimizedNotices = await this.optimizeNoticesForCloud(this.notices);

        const data = {
            notices: optimizedNotices,
            lastUpdated: new Date().toISOString(),
            version: "1.0",
            metadata: {
                title: "SMP College Notice Board",
                description: "Official notices and announcements",
                totalNotices: this.notices.length,
                service: "jsonhost"
            }
        };

        // Log data size and attachment info for debugging
        const originalSize = JSON.stringify({...data, notices: this.notices}).length;
        const cloudSize = JSON.stringify(data).length;
        const attachmentCount = this.notices.reduce((count, notice) => 
            count + (notice.attachments ? notice.attachments.length : 0), 0);
        const jsonhostLimit = 101 * 1024; // 101KB limit
        
        console.log(`📊 Payload Analysis:`);
        console.log(`Original size: ${(originalSize/1024).toFixed(1)}KB`);
        console.log(`Cloud size: ${(cloudSize/1024).toFixed(1)}KB`);
        console.log(`JSONhost limit: ${(jsonhostLimit/1024).toFixed(1)}KB`);
        console.log(`Attachments: ${attachmentCount}`);
        console.log(`Within limit: ${cloudSize <= jsonhostLimit ? '✅' : '❌'}`);
        
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
                this.updateSyncStatus('synced', 'JSONhost (Read/Write)');
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
        console.log('Optimizing notices for cloud sync...');
        
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

                // Try to upload to file hosting service if available and file is large enough
                if (this.fileHostingReady && attachment.size > 50000) { // 50KB threshold
                    try {
                        console.log(`📤 Uploading ${attachment.name} to pCloud (size: ${this.formatFileSize(attachment.size)})...`);
                        console.log(`File hosting ready: ${this.fileHostingReady}, pCloud server: ${this.pcloudApiServer}`);
                        const hostedFile = await this.uploadFileToHosting(attachment, attachment.name);
                        console.log(`✅ Successfully uploaded ${attachment.name} to pCloud hosting`);
                        return hostedFile;
                    } catch (error) {
                        console.error(`❌ pCloud upload failed for ${attachment.name}:`, error);
                        console.error(`Error details:`, error.message, error.stack);
                        console.log(`🔄 Falling back to compression for ${attachment.name}`);
                    }
                } else if (attachment.size <= 50000) {
                    console.log(`📁 Small file ${attachment.name}, keeping locally`);
                }

                // Fallback to compression method if Google Drive not available
                // For files under 50KB, include directly
                if (attachment.size < 51200) { // 50KB
                    console.log(`Small file ${attachment.name}, including directly`);
                    return attachment;
                }

                // Compress images
                if (attachment.type.startsWith('image/')) {
                    console.log(`Compressing image: ${attachment.name} (${this.formatFileSize(attachment.size)})`);
                    const compressed = await this.compressImage(attachment);
                    
                    // If compressed image is still too large for JSONhost, create placeholder
                    if (compressed.size > 80000) { // 80KB limit for JSONhost safety
                        console.log(`Compressed image still too large (${this.formatFileSize(compressed.size)}), creating placeholder`);
                        return {
                            name: attachment.name,
                            type: attachment.type,
                            size: attachment.size,
                            isPlaceholder: true,
                            originalSize: attachment.size,
                            note: 'File too large for cloud sync - available locally only'
                        };
                    }
                    
                    return compressed;
                }

                // For all other files larger than 50KB, create a placeholder
                console.log(`Large file detected: ${attachment.name} (${this.formatFileSize(attachment.size)}) - creating placeholder`);
                return {
                    name: attachment.name,
                    type: attachment.type,
                    size: attachment.size,
                    isPlaceholder: true,
                    originalSize: attachment.size,
                    note: 'File too large for cloud sync - available locally only'
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

                // Calculate new dimensions (max 1920x1080)
                let { width, height } = img;
                const maxWidth = 1920;
                const maxHeight = 1080;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                // Try different quality levels until we get a reasonable size for JSONhost
                let quality = 0.7;
                let compressedData;
                
                do {
                    compressedData = canvas.toDataURL('image/jpeg', quality); // Force JPEG for better compression
                    quality -= 0.1;
                } while (compressedData.length > 100000 && quality > 0.1); // Target ~100KB for JSONhost
                
                // If still too large, try smaller dimensions
                if (compressedData.length > 100000 && quality <= 0.1) {
                    const smallerWidth = Math.floor(width * 0.7);
                    const smallerHeight = Math.floor(height * 0.7);
                    canvas.width = smallerWidth;
                    canvas.height = smallerHeight;
                    ctx.drawImage(img, 0, 0, smallerWidth, smallerHeight);
                    compressedData = canvas.toDataURL('image/jpeg', 0.5);
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
        console.log('Using pCloud for professional file hosting');
        
        try {
            // Test pCloud API availability
            const testResponse = await fetch('https://api.pcloud.com/getapiserver', {
                method: 'GET'
            });
            
            if (testResponse.ok) {
                const result = await testResponse.json();
                this.pcloudApiServer = result.api[0] || 'eapi.pcloud.com';
                console.log('✅ pCloud service is available, using server:', this.pcloudApiServer);
            } else {
                this.pcloudApiServer = 'eapi.pcloud.com'; // fallback
                console.log('⚠️ Using fallback pCloud server');
            }
            
            this.fileHostingReady = true;
            this.showToast('File hosting ready (pCloud)', 'success');
            this.updateSyncStatus('synced', 'File hosting connected');
            
        } catch (error) {
            console.warn('⚠️ pCloud service check failed, using fallback server:', error.message);
            this.pcloudApiServer = 'eapi.pcloud.com';
            this.fileHostingReady = true;
            this.updateSyncStatus('synced', 'File hosting ready');
        }
    }

    // Test file hosting upload functionality
    async testFileHosting() {
        console.log('🧪 Testing file hosting functionality...');
        
        try {
            // Create a small test file
            const testContent = 'This is a test file for pCloud hosting - ' + new Date().toISOString();
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
                console.log(`📤 Uploading ${fileName} to pCloud (attempt ${attempt}/${maxRetries})...`);
                console.log(`File data preview:`, file.data ? `${file.data.substring(0, 50)}...` : 'No data found');
                
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

                // Generate unique filename with timestamp
                const timestamp = Date.now();
                const uniqueFileName = `${timestamp}_${fileName}`;

                // Create FormData for pCloud upload
                const formData = new FormData();
                formData.append('files[]', blob, uniqueFileName);
                formData.append('folderid', '0'); // Root folder

                const apiServer = this.pcloudApiServer || 'eapi.pcloud.com';
                const uploadUrl = `https://${apiServer}/uploadfile`;
                console.log(`Making request to: ${uploadUrl}`);
                
                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    body: formData
                });

                console.log(`Response status: ${response.status} ${response.statusText}`);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Upload error response:`, errorText);
                    throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
                }

                const result = await response.json();
                console.log(`pCloud response:`, result);
                
                if (result.result !== 0) {
                    console.error(`pCloud API error:`, result);
                    throw new Error(`Upload failed: ${result.error || 'Unknown error'}`);
                }

                const fileData = result.metadata[0];
                const fileId = fileData.fileid;
                
                // Get public link for the file
                const linkResponse = await fetch(`https://${apiServer}/getfilepublink?fileid=${fileId}`);
                const linkResult = await linkResponse.json();
                
                let publicUrl = null;
                if (linkResult.result === 0) {
                    publicUrl = `https://e1.pcloud.link/publink/show?code=${linkResult.code}`;
                }

                console.log(`✅ File uploaded successfully: ${fileName} (ID: ${fileId})`);
                
                return {
                    id: fileId,
                    name: fileName,
                    type: file.type,
                    size: file.size,
                    url: publicUrl || `https://${apiServer}/getpubthumb?fileid=${fileId}&size=1024x1024`,
                    hostedFile: true,
                    service: 'pcloud.com',
                    uploadDate: new Date().toISOString(),
                    expires: 'permanent' // pCloud files don't expire
                };
                
            } catch (error) {
                console.error(`❌ pCloud upload error (attempt ${attempt}/${maxRetries}):`, error);
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

    updateActiveFilterButton(activeBtn) {
        this.filterButtons.forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }

    handleCategoryFilter(category) {
        this.currentFilter = category;
        this.applyFiltersAndSort();
        this.render();
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
                    // Default sort by order then date
                    const orderComparison = (a.order || 99) - (b.order || 99);
                    return orderComparison !== 0 ? orderComparison : new Date(b.date) - new Date(a.date);
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
        
        // Process content with URL detection
        const processedContent = this.processContentWithURLs(notice.content);
        
        // Create attachments display
        const attachmentsHTML = this.createAttachmentsDisplay(notice.attachments);

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
                    ${processedContent}
                </div>
                ${attachmentsHTML}
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

        const usedOrders = this.notices.map(notice => notice.order || 99);
        const maxOrder = Math.max(...usedOrders, 0);
        
        let options = '';
        for (let i = 1; i <= Math.max(maxOrder + 1, 10); i++) {
            const label = this.getOrderLabel(i);
            options += `<option value="${i}">${i} - ${label}</option>`;
        }
        
        orderSelect.innerHTML = options;
        orderSelect.value = maxOrder + 1;
    }

    getOrderLabel(order) {
        const labels = {
            1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth',
            6: 'Sixth', 7: 'Seventh', 8: 'Eighth', 9: 'Ninth', 10: 'Tenth'
        };
        return labels[order] || `${order}th`;
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
        
        // Set order
        const orderSelect = document.getElementById('noticeOrder');
        if (orderSelect) {
            orderSelect.value = notice.order || 99;
        }
    }

    resetForm() {
        this.noticeForm.reset();
        this.noticeDate.value = new Date().toISOString().split('T')[0];
        this.quillEditor.root.innerHTML = '';
        this.currentTags = [];
        this.currentAttachments = [];
        this.renderTagsDisplay();
        this.renderAttachmentsPreview();
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
            order: parseInt(document.getElementById('noticeOrder').value) || 99,
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
            this.render(); // Re-render notices to show admin controls
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
        this.render(); // Re-render notices to hide admin controls
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

    showMobileFilters() {
        const filterSection = document.querySelector('.category-filter-section');
        if (filterSection) {
            filterSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    showMobileFilters() {
        // Toggle mobile filter panel (implement as needed)
        this.mobileFilter.classList.toggle('active');
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

    processContentWithURLs(content) {
        // First, process the HTML content to detect and extract URLs
        let processedContent = content;
        const urls = [];
        
        // URL regex pattern to detect various URL formats
        const urlRegex = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[^\s<>"]+\.[a-z]{2,}(?:\/[^\s<>"]*)?)/gi;
        
        // Extract URLs and replace them with placeholders
        processedContent = processedContent.replace(urlRegex, (url) => {
            let href = url;
            // Add https:// if missing
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                href = 'https://' + url;
            }
            urls.push({ original: url, href: href });
            return `<span class="url-placeholder">${url}</span>`;
        });
        
        // If URLs were found, create a separate URLs section
        if (urls.length > 0) {
            const urlsSection = `
                <div class="notice-urls">
                    ${urls.map(urlData => 
                        `<a href="${urlData.href}" target="_blank" rel="noopener noreferrer" class="notice-link">
                            <i class="fas fa-external-link-alt"></i> ${urlData.original}
                        </a>`
                    ).join('')}
                </div>
            `;
            
            // Remove placeholder spans and add URLs section at the end
            processedContent = processedContent.replace(/<span class="url-placeholder">.*?<\/span>/g, '');
            processedContent += urlsSection;
        }
        
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.noticeBoard = new NoticeBoard();
    
    // Make test function globally available for debugging
    window.testGoogleDrive = () => window.noticeBoard.testGoogleDriveSetup();
    console.log('💡 To test Google Drive setup, run: testGoogleDrive()');
});