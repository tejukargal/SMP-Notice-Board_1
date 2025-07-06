// Google Drive Debug Helper Functions
// Run these in the browser console to diagnose Google Drive issues

window.GoogleDriveDebug = {
    
    // Test Google Drive setup
    async testSetup() {
        console.log('🔧 Google Drive Debug Test');
        console.log('==========================');
        
        if (typeof noticeBoard === 'undefined') {
            console.error('❌ NoticeBoard not found');
            return false;
        }
        
        return await noticeBoard.testGoogleDriveSetup();
    },
    
    // Retry Google Drive initialization
    async retryInit() {
        console.log('🔄 Retrying Google Drive initialization...');
        
        if (typeof noticeBoard === 'undefined') {
            console.error('❌ NoticeBoard not found');
            return false;
        }
        
        return await noticeBoard.retryGoogleDriveInit();
    },
    
    // Check current configuration
    checkConfig() {
        console.log('⚙️ Google Drive Configuration Check');
        console.log('====================================');
        
        const config = window.CLOUD_CONFIG?.googledrive;
        console.log('Configuration:', {
            exists: !!config,
            enabled: config?.enabled,
            hasApiKey: !!config?.apiKey,
            hasClientId: !!config?.clientId,
            apiKeyStart: config?.apiKey?.substring(0, 10) + '...',
            clientIdStart: config?.clientId?.substring(0, 15) + '...',
            folderName: config?.folderName
        });
        
        console.log('Environment:', {
            origin: window.location.origin,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            isHTTPS: window.location.protocol === 'https:',
            isLocalhost: window.location.hostname === 'localhost'
        });
        
        console.log('Google API Status:', {
            gapiLoaded: typeof gapi !== 'undefined',
            authLoaded: typeof gapi !== 'undefined' && gapi.auth2 !== undefined,
            clientLoaded: typeof gapi !== 'undefined' && gapi.client !== undefined
        });
        
        if (typeof noticeBoard !== 'undefined') {
            console.log('NoticeBoard State:', {
                googleDriveReady: noticeBoard.googleDriveReady,
                googleDriveFolderId: noticeBoard.googleDriveFolderId
            });
        }
    },
    
    // Test file upload simulation
    async testFileUpload() {
        console.log('📤 Testing Google Drive file upload simulation...');
        
        if (typeof noticeBoard === 'undefined') {
            console.error('❌ NoticeBoard not found');
            return false;
        }
        
        if (!noticeBoard.googleDriveReady) {
            console.error('❌ Google Drive not ready');
            return false;
        }
        
        // Create a small test file
        const testContent = 'This is a test file for Google Drive upload';
        const blob = new Blob([testContent], { type: 'text/plain' });
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
            reader.onload = async (e) => {
                const testFile = {
                    name: 'google-drive-test.txt',
                    type: 'text/plain',
                    size: blob.size,
                    data: e.target.result
                };
                
                try {
                    const result = await noticeBoard.uploadFileToGoogleDrive(testFile, testFile.name);
                    console.log('✅ Test upload successful:', result);
                    resolve(true);
                } catch (error) {
                    console.error('❌ Test upload failed:', error);
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },
    
    // Get Google Drive folder info
    async getFolderInfo() {
        console.log('📁 Getting Google Drive folder information...');
        
        if (typeof noticeBoard === 'undefined') {
            console.error('❌ NoticeBoard not found');
            return false;
        }
        
        if (!noticeBoard.googleDriveReady) {
            console.error('❌ Google Drive not ready');
            return false;
        }
        
        try {
            const response = await gapi.client.drive.files.get({
                fileId: noticeBoard.googleDriveFolderId,
                fields: 'id,name,createdTime,modifiedTime,webViewLink'
            });
            
            console.log('📁 Folder Info:', response.result);
            
            // List files in folder
            const filesResponse = await gapi.client.drive.files.list({
                q: `'${noticeBoard.googleDriveFolderId}' in parents and trashed=false`,
                fields: 'files(id,name,size,createdTime,webViewLink)'
            });
            
            console.log('📄 Files in folder:', filesResponse.result.files);
            return filesResponse.result.files;
            
        } catch (error) {
            console.error('❌ Failed to get folder info:', error);
            return false;
        }
    },
    
    // Clear Google Drive authentication
    async signOut() {
        console.log('🚪 Signing out of Google Drive...');
        
        try {
            if (typeof gapi !== 'undefined' && gapi.auth2) {
                const authInstance = gapi.auth2.getAuthInstance();
                if (authInstance && authInstance.isSignedIn.get()) {
                    await authInstance.signOut();
                    console.log('✅ Signed out successfully');
                    
                    if (typeof noticeBoard !== 'undefined') {
                        noticeBoard.googleDriveReady = false;
                        noticeBoard.googleDriveFolderId = null;
                        noticeBoard.updateSyncStatus('offline', 'Google Drive signed out');
                    }
                    
                    return true;
                }
            }
            console.log('ℹ️ Already signed out or not initialized');
            return true;
        } catch (error) {
            console.error('❌ Sign out failed:', error);
            return false;
        }
    },
    
    // Manual sign in
    async signIn() {
        console.log('🔑 Attempting to sign in to Google Drive...');
        
        try {
            if (typeof gapi !== 'undefined' && gapi.auth2) {
                const authInstance = gapi.auth2.getAuthInstance();
                if (authInstance) {
                    if (!authInstance.isSignedIn.get()) {
                        await authInstance.signIn();
                        console.log('✅ Signed in successfully');
                        
                        // Retry initialization
                        if (typeof noticeBoard !== 'undefined') {
                            await noticeBoard.retryGoogleDriveInit();
                        }
                        
                        return true;
                    } else {
                        console.log('ℹ️ Already signed in');
                        return true;
                    }
                }
            }
            console.error('❌ Google auth not available');
            return false;
        } catch (error) {
            console.error('❌ Sign in failed:', error);
            return false;
        }
    }
};

// Auto-run configuration check on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            console.log('🔧 Google Drive Debug Helper loaded');
            console.log('Usage:');
            console.log('- GoogleDriveDebug.checkConfig() - Check configuration');
            console.log('- GoogleDriveDebug.testSetup() - Test Google Drive setup');
            console.log('- GoogleDriveDebug.retryInit() - Retry initialization');
            console.log('- GoogleDriveDebug.testFileUpload() - Test file upload');
            console.log('- GoogleDriveDebug.getFolderInfo() - Get folder information');
            console.log('- GoogleDriveDebug.signOut() - Sign out of Google Drive');
            console.log('- GoogleDriveDebug.signIn() - Sign in to Google Drive');
        }, 1000);
    });
} else {
    setTimeout(() => {
        console.log('🔧 Google Drive Debug Helper loaded');
        console.log('Usage:');
        console.log('- GoogleDriveDebug.checkConfig() - Check configuration');
        console.log('- GoogleDriveDebug.testSetup() - Test Google Drive setup');
        console.log('- GoogleDriveDebug.retryInit() - Retry initialization');
        console.log('- GoogleDriveDebug.testFileUpload() - Test file upload');
        console.log('- GoogleDriveDebug.getFolderInfo() - Get folder information');
        console.log('- GoogleDriveDebug.signOut() - Sign out of Google Drive');
        console.log('- GoogleDriveDebug.signIn() - Sign in to Google Drive');
    }, 1000);
}