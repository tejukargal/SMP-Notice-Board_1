# Google Drive API Integration Setup Guide

## Overview

This guide explains how to set up Google Drive API integration for the SMP College Notice Board application. With Google Drive integration, file attachments are stored in Google Drive and can be accessed across all devices, providing unlimited storage for attachments.

## What is Google Drive API?

Google Drive API provides:
- **Cloud File Storage**: Upload files to Google Drive programmatically
- **Cross-Device Access**: Files accessible from any device with internet
- **Large File Support**: Handle files much larger than JSON payload limits
- **Reliable Storage**: Google's enterprise-grade storage infrastructure
- **Direct Links**: Share files via Google Drive links
- **Version Control**: Google Drive handles file versioning automatically

## Benefits of Google Drive Integration

✅ **True Cross-Device Sync**: Files accessible on all devices
✅ **Large File Support**: No size limits (within Google Drive quotas)
✅ **Reliable Storage**: Enterprise-grade Google infrastructure
✅ **Direct Access**: Files open directly in Google Drive
✅ **Automatic Backup**: Files backed up in Google Drive
✅ **Share Links**: Easy sharing via Google Drive URLs

## Step-by-Step Setup

### Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**:
   - Visit [console.cloud.google.com](https://console.cloud.google.com)
   - Sign in with your Google account

2. **Create a New Project**:
   - Click "Select a project" → "New Project"
   - Name: "SMP Notice Board" (or any name you prefer)
   - Click "Create"

3. **Select Your Project**:
   - Make sure your new project is selected in the dropdown

### Step 2: Enable Google Drive API

1. **Navigate to APIs & Services**:
   - In the left sidebar, click "APIs & Services" → "Library"

2. **Enable Google Drive API**:
   - Search for "Google Drive API"
   - Click on "Google Drive API"
   - Click "Enable"

### Step 3: Create Credentials

1. **Go to Credentials**:
   - In the left sidebar, click "APIs & Services" → "Credentials"

2. **Create API Key**:
   - Click "Create Credentials" → "API Key"
   - Copy the generated API key
   - **Important**: Keep this key secure

3. **Create OAuth 2.0 Client ID**:
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Web application"
   - Name: "SMP Notice Board Web"
   - **Authorized JavaScript origins**: Add your domain (e.g., `https://your-domain.com`)
   - **Authorized redirect URIs**: Add your domain (e.g., `https://your-domain.com`)
   - Click "Create"
   - Copy the Client ID

### Step 4: Configure the Application

1. **Open `index.html`** in your text editor

2. **Find the Google Drive configuration** (around line 345):
   ```javascript
   googledrive: {
       apiKey: 'YOUR_GOOGLE_DRIVE_API_KEY', // Replace with your API key
       clientId: 'YOUR_GOOGLE_CLIENT_ID', // Replace with your OAuth client ID
       enabled: false, // Set to true when configured
       folderName: 'SMP-Notice-Board-Attachments'
   }
   ```

3. **Update the configuration**:
   ```javascript
   googledrive: {
       apiKey: 'AIzaSyC1234567890abcdefg', // Your actual API key
       clientId: '123456789-abc123def456.apps.googleusercontent.com', // Your client ID
       enabled: true, // Enable Google Drive
       folderName: 'SMP-Notice-Board-Attachments'
   }
   ```

4. **Save the file**

### Step 5: Test the Integration

1. **Open your application** in a web browser

2. **Check the console**:
   - Open Developer Tools (F12)
   - Look for Google Drive initialization messages
   - Expected: "Google Drive initialized successfully"

3. **Test file upload**:
   - Login as admin (code: `teju_smp`)
   - Add a new notice with an attachment
   - File should upload to Google Drive
   - Check your Google Drive for the "SMP-Notice-Board-Attachments" folder

## How It Works

### Hybrid Storage System
- **Text Content**: Stored in JSONhost for fast sync
- **File Attachments**: Stored in Google Drive for unlimited size
- **Metadata**: Links to Google Drive files stored in JSONhost

### Upload Process
1. User selects file attachment
2. App uploads file to Google Drive
3. Google Drive returns file ID and access links
4. File metadata (ID, links) stored in notice data
5. Notice synced to JSONhost with Google Drive references

### Cross-Device Access
1. Device loads notice from JSONhost
2. Notice contains Google Drive file references
3. Files displayed with Google Drive preview links
4. Users click to open files directly in Google Drive

## Security Considerations

### API Key Security
- **Client-side safe**: API keys are designed for browser use
- **Domain restrictions**: Restrict API key to your domains only
- **Regular rotation**: Change API keys periodically

### OAuth Permissions
- **Limited scope**: Only requests `drive.file` permission
- **File-level access**: Can only access files created by the app
- **User consent**: Users must authorize Google Drive access

### Best Practices
- **Domain restrictions**: Set up authorized domains in Google Cloud Console
- **HTTPS only**: Always use HTTPS for production
- **Regular monitoring**: Monitor API usage in Google Cloud Console

## Quota and Limits

### Google Drive API Limits
- **Daily quota**: 1 billion requests per day (default)
- **Per-user quota**: 1,000 requests per 100 seconds per user
- **File size**: Up to 5TB per file
- **Storage**: 15GB free, unlimited with Google Workspace

### Notice Board Limits
- **File types**: All file types supported
- **Concurrent uploads**: Handled automatically
- **Retry logic**: Automatic retry on temporary failures

## Troubleshooting

### Common Issues

#### 1. "Google Drive not configured" Message
**Cause**: Configuration not set up or `enabled: false`
**Solutions**:
- Verify API key and client ID are correctly set
- Ensure `enabled: true` in configuration
- Check for typos in configuration

#### 2. "Google Drive initialization failed"
**Cause**: Invalid credentials or API not enabled
**Solutions**:
- Verify Google Drive API is enabled in Google Cloud Console
- Check API key is valid and not restricted
- Ensure client ID is correct
- Check browser console for specific error messages

#### 3. Authentication Popup Blocked
**Cause**: Browser blocking Google OAuth popup
**Solutions**:
- Allow popups for your domain
- Use HTTPS (required for OAuth)
- Check if third-party cookies are enabled

#### 4. Upload Failures
**Cause**: Network issues, quota exceeded, or permission problems
**Solutions**:
- Check internet connection
- Verify Google Drive quota not exceeded
- Check API usage in Google Cloud Console
- Ensure user has granted necessary permissions

### Debug Steps

1. **Check API Configuration**:
   ```javascript
   // Open browser console and run:
   console.log(window.CLOUD_CONFIG.googledrive);
   ```

2. **Test API Key**:
   ```javascript
   // Test if API key works:
   fetch(`https://www.googleapis.com/drive/v3/about?fields=user&key=YOUR_API_KEY`)
   ```

3. **Check Authentication**:
   ```javascript
   // Check if user is authenticated:
   console.log(gapi.auth2.getAuthInstance().isSignedIn.get());
   ```

## File Management

### Automatic Folder Creation
- App creates "SMP-Notice-Board-Attachments" folder in user's Google Drive
- All attachments stored in this dedicated folder
- Folder shared across all notices

### File Organization
- Files named with original filename
- Multiple files with same name handled automatically
- Files remain in Google Drive even if notice is deleted

### Cleanup
- Files remain in Google Drive for manual management
- Users can manually delete files from Google Drive
- Consider implementing cleanup features for deleted notices

## Advanced Configuration

### Custom Folder Names
```javascript
googledrive: {
    // ... other config
    folderName: 'Custom-Folder-Name-Here'
}
```

### Multiple Environments
```javascript
// Development
googledrive: {
    apiKey: 'dev-api-key',
    clientId: 'dev-client-id',
    folderName: 'SMP-Dev-Attachments'
}

// Production
googledrive: {
    apiKey: 'prod-api-key',
    clientId: 'prod-client-id', 
    folderName: 'SMP-Notice-Board-Attachments'
}
```

## Migration from Previous System

### Existing Compressed Attachments
- Current compressed attachments will continue to work
- New attachments will use Google Drive
- Mixed system: some files compressed, others in Google Drive

### Upgrading Process
1. Set up Google Drive as described above
2. New attachments automatically use Google Drive
3. Existing attachments remain as compressed/local files
4. Gradual migration as content is updated

## Support and Monitoring

### Google Cloud Console
- Monitor API usage: APIs & Services → Dashboard
- Check quotas: APIs & Services → Quotas
- View errors: APIs & Services → Credentials

### Application Monitoring
- Browser console shows detailed upload/download logs
- Toast notifications for user feedback
- Automatic fallback to compression if Google Drive fails

---

## Quick Setup Checklist

- [ ] Create Google Cloud Project
- [ ] Enable Google Drive API
- [ ] Create API Key and OAuth Client ID
- [ ] Configure authorized domains
- [ ] Update `index.html` with credentials
- [ ] Set `enabled: true` in configuration
- [ ] Test upload functionality
- [ ] Verify files appear in Google Drive
- [ ] Test cross-device access

**Setup Time**: ~15-20 minutes
**User Experience**: Seamless file uploads with Google Drive storage
**Storage Limit**: Virtually unlimited (within Google Drive quotas)

With Google Drive integration, your notice board becomes a powerful document management system with enterprise-grade file storage! 🚀