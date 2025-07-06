// File Hosting Debug Helper Functions
// Run these in the browser console to diagnose file hosting issues

window.FileHostingDebug = {
    
    // Test file hosting setup
    async testSetup() {
        console.log('🔧 File Hosting Debug Test');
        console.log('===========================');
        
        if (typeof noticeBoard === 'undefined') {
            console.error('❌ NoticeBoard not found');
            return false;
        }
        
        return await noticeBoard.debugFileHosting();
    },
    
    // Retry file hosting initialization
    async retryInit() {
        console.log('🔄 Retrying file hosting initialization...');
        
        if (typeof noticeBoard === 'undefined') {
            console.error('❌ NoticeBoard not found');
            return false;
        }
        
        return await noticeBoard.retryFileHosting();
    },
    
    // Check current configuration
    checkConfig() {
        console.log('⚙️ File Hosting Configuration Check');
        console.log('====================================');
        
        const config = window.CLOUD_CONFIG?.fileHosting;
        console.log('File Hosting Configuration:', {
            exists: !!config,
            enabled: config?.enabled,
            service: config?.service,
            maxFileSize: config?.maxFileSize,
            expires: config?.expires
        });
        
        console.log('Environment:', {
            origin: window.location.origin,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            isHTTPS: window.location.protocol === 'https:',
            isLocalhost: window.location.hostname === 'localhost'
        });
        
        console.log('Network Status:', {
            online: navigator.onLine,
            fetchSupported: typeof fetch !== 'undefined',
            formDataSupported: typeof FormData !== 'undefined'
        });
        
        if (typeof noticeBoard !== 'undefined') {
            console.log('NoticeBoard State:', {
                fileHostingReady: noticeBoard.fileHostingReady,
                fileHostingService: noticeBoard.fileHostingService,
                maxFileSize: noticeBoard.maxFileSize
            });
        }
    },
    
    // Test file upload simulation
    async testFileUpload() {
        console.log('📤 Testing file hosting upload...');
        
        if (typeof noticeBoard === 'undefined') {
            console.error('❌ NoticeBoard not found');
            return false;
        }
        
        if (!noticeBoard.fileHostingReady) {
            console.error('❌ File hosting not ready');
            return false;
        }
        
        try {
            const result = await noticeBoard.testFileHosting();
            console.log('✅ Test upload successful:', result);
            return result;
        } catch (error) {
            console.error('❌ Test upload failed:', error);
            return false;
        }
    },
    
    // Get current hosted files info
    async getHostedFiles() {
        console.log('📄 Getting hosted files information...');
        
        if (typeof noticeBoard === 'undefined') {
            console.error('❌ NoticeBoard not found');
            return false;
        }
        
        try {
            const notices = noticeBoard.notices || [];
            const hostedFiles = [];
            
            notices.forEach(notice => {
                if (notice.attachments && notice.attachments.length > 0) {
                    notice.attachments.forEach(attachment => {
                        if (attachment.hostedFile || attachment.driveFile) {
                            hostedFiles.push({
                                noticeTitle: notice.title,
                                fileName: attachment.name,
                                service: attachment.service || 'Google Drive',
                                url: attachment.url || attachment.webViewLink,
                                size: attachment.size,
                                uploadDate: attachment.uploadDate
                            });
                        }
                    });
                }
            });
            
            console.log('📄 Hosted Files:', hostedFiles);
            return hostedFiles;
            
        } catch (error) {
            console.error('❌ Failed to get hosted files info:', error);
            return false;
        }
    },
    
    // Test 0x0.st service directly
    async test0x0Service() {
        console.log('🌐 Testing 0x0.st service directly...');
        
        try {
            // Create a test file
            const testContent = '0x0.st test - ' + new Date().toISOString();
            const blob = new Blob([testContent], { type: 'text/plain' });
            
            const formData = new FormData();
            formData.append('file', blob, '0x0-test.txt');
            
            const response = await fetch('https://0x0.st/', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.text();
            console.log('✅ 0x0.st service test successful:', result);
            return result;
            
        } catch (error) {
            console.error('❌ 0x0.st service test failed:', error);
            return false;
        }
    }
};

// Auto-run configuration check on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            console.log('🔧 File Hosting Debug Helper loaded');
            console.log('Usage:');
            console.log('- FileHostingDebug.checkConfig() - Check configuration');
            console.log('- FileHostingDebug.testSetup() - Test file hosting setup');
            console.log('- FileHostingDebug.retryInit() - Retry initialization');
            console.log('- FileHostingDebug.testFileUpload() - Test file upload');
            console.log('- FileHostingDebug.getHostedFiles() - Get hosted files info');
            console.log('- FileHostingDebug.test0x0Service() - Test 0x0.st directly');
        }, 1000);
    });
} else {
    setTimeout(() => {
        console.log('🔧 File Hosting Debug Helper loaded');
        console.log('Usage:');
        console.log('- FileHostingDebug.checkConfig() - Check configuration');
        console.log('- FileHostingDebug.testSetup() - Test file hosting setup');
        console.log('- FileHostingDebug.retryInit() - Retry initialization');
        console.log('- FileHostingDebug.testFileUpload() - Test file upload');
        console.log('- FileHostingDebug.getHostedFiles() - Get hosted files info');
        console.log('- FileHostingDebug.test0x0Service() - Test 0x0.st directly');
    }, 1000);
}