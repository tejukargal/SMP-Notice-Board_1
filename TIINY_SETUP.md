# Tiiny.host JSON Hosting Setup Guide

## Overview

This guide explains how to set up JSON data hosting for the SMP College Notice Board application using Tiiny.host's JSON hosting service. Tiiny.host provides free static JSON file hosting with direct URL access, perfect for read-only data distribution.

## What is Tiiny.host JSON Hosting?

Tiiny.host offers JSON hosting services that provide:
- **Static JSON Storage**: Upload JSON files and get direct URLs
- **Free Service**: 3MB storage limit on free plan
- **No Authentication**: Public JSON endpoints
- **Direct Access**: Simple HTTP GET requests to access data
- **CORS Enabled**: Works with browser-based applications
- **Password Protection**: Optional security for JSON files
- **Built-in Analytics**: Track file access and views

## Important: Static JSON Hosting

⚠️ **Key Characteristics**:
- **Read-Only**: Application can only fetch data from Tiiny.host
- **Static Files**: JSON content doesn't change unless manually updated
- **Manual Updates**: All content changes must be done through Tiiny.host interface
- **No Dynamic API**: Not a database or dynamic API service
- **Perfect for**: Centralized content management with admin-controlled updates

## Step-by-Step Setup

### Step 1: Create Your JSON File on Tiiny.host

1. Visit [tiiny.host](https://tiiny.host)
2. Click **"Upload JSON"** or go to [tiiny.host/upload/json](https://tiiny.host/upload/json)
3. You can either:
   - **Upload a file**: Create `notices.json` locally and upload it
   - **Create online**: Use their online JSON editor

### Step 2: Prepare Your JSON Data

Create a JSON file with this initial structure:
```json
{
  "notices": [],
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

### Step 3: Upload to Tiiny.host

1. **Method A - File Upload**:
   - Save the JSON structure as `notices.json`
   - Drag and drop the file to tiiny.host upload area
   - Click **"Upload"**

2. **Method B - Online Editor**:
   - Use their JSON editor interface
   - Paste the JSON structure
   - Save the file

3. **Get Your URL**: After upload, you'll receive:
   - **Direct JSON URL**: `https://tiiny.host/files/abc123/notices.json`
   - **Management URL**: Link to edit/update the file
   - **Analytics URL**: View access statistics

### Step 4: Configure the Application

1. Open `index.html` in your text editor
2. Find the cloud configuration section (around line 295):
   ```javascript
   window.CLOUD_CONFIG = {
       // Service type: 'npoint', 'tiiny', or 'both'
       service: 'tiiny',
       
       // Tiiny.host Configuration
       tiiny: {
           jsonUrl: 'YOUR_TIINY_JSON_URL_HERE',
           // Example: 'https://tiiny.host/files/abc123/notices.json'
       }
   };
   ```

3. Replace the placeholder with your actual Tiiny.host URL:
   ```javascript
   window.CLOUD_CONFIG = {
       service: 'tiiny',
       tiiny: {
           jsonUrl: 'https://tiiny.host/files/abc123/notices.json',
       }
   };
   ```

4. Save the file

### Step 5: Test the Configuration

1. Open your Notice Board application in a web browser
2. Check the sync status indicator in the header
3. It should show:
   - **"Syncing..."** initially
   - **"Synced via Tiiny.host (Read-only)"** when successful
   - **"Sync failed"** if the URL is incorrect

4. The application will fetch any notices from your Tiiny.host JSON
5. Local changes are saved in browser storage only

## Service Configuration Options

### Option 1: Tiiny.host Only
```javascript
window.CLOUD_CONFIG = {
    service: 'tiiny',
    tiiny: {
        jsonUrl: 'https://tiiny.host/files/your-id/notices.json'
    }
};
```

### Option 2: NPoint.io Only  
```javascript
window.CLOUD_CONFIG = {
    service: 'npoint',
    npoint: {
        jsonId: 'your-npoint-id',
        baseUrl: 'https://api.npoint.io'
    }
};
```

### Option 3: Both Services (Fallback)
```javascript
window.CLOUD_CONFIG = {
    service: 'both',
    npoint: {
        jsonId: 'your-npoint-id',
        baseUrl: 'https://api.npoint.io'
    },
    tiiny: {
        jsonUrl: 'https://tiiny.host/files/your-id/notices.json'
    }
};
```

## Adding Sample Data

To populate your notice board with initial content:

1. **Access Your Tiiny.host File**: Use the management URL provided after upload
2. **Edit the JSON**: Replace the empty notices array with sample data:
   ```json
   {
     "notices": [
       {
         "id": "1",
         "title": "Welcome to SMP College Notice Board",
         "content": "<p>This notice board helps you stay updated with college announcements.</p>",
         "category": "academic",
         "priority": "normal",
         "date": "2024-01-15",
         "deadline": null,
         "author": "Administration",
         "tags": ["welcome", "info"],
         "timestamp": "2024-01-15T10:00:00.000Z",
         "lastModified": "2024-01-15T10:00:00.000Z"
       },
       {
         "id": "2",
         "title": "Important Exam Notice",
         "content": "<p>Mid-term examinations will commence from February 1st, 2024.</p>",
         "category": "exams",
         "priority": "high",
         "date": "2024-01-20",
         "deadline": "2024-02-01",
         "author": "Examination Department",
         "tags": ["exam", "important", "deadline"],
         "timestamp": "2024-01-20T09:00:00.000Z",
         "lastModified": "2024-01-20T09:00:00.000Z"
       }
     ],
     "lastUpdated": "2024-01-20T09:00:00.000Z"
   }
   ```

3. **Save Changes**: Update the file on Tiiny.host
4. **Verify**: Refresh your application - notices should appear

## Data Management Workflow

### For Content Administrators

#### Adding New Notices
1. **Access Management URL**: Go to your saved Tiiny.host edit link
2. **Edit JSON**: Add new notice objects to the "notices" array
3. **Use This Template**:
   ```json
   {
     "id": "unique-notice-id",
     "title": "Notice Title Here",
     "content": "<p>Notice content with HTML formatting</p>",
     "category": "academic",
     "priority": "normal", 
     "date": "2024-01-15",
     "deadline": "2024-01-30",
     "author": "Department Name",
     "tags": ["tag1", "tag2"],
     "timestamp": "2024-01-15T10:00:00.000Z",
     "lastModified": "2024-01-15T10:00:00.000Z"
   }
   ```
4. **Update Timestamp**: Change "lastUpdated" to current date/time
5. **Save**: Apply changes on Tiiny.host
6. **Verify**: Check application for updates (may take up to 5 seconds)

#### Editing Existing Notices
1. **Find Notice**: Locate the notice object in the JSON array
2. **Modify Fields**: Update title, content, category, etc.
3. **Update lastModified**: Set to current timestamp
4. **Update lastUpdated**: Set to current timestamp  
5. **Save Changes**: Apply on Tiiny.host

#### Removing Notices
1. **Locate Notice**: Find the notice object to remove
2. **Delete Object**: Remove the entire JSON object from array
3. **Update Timestamp**: Change "lastUpdated" field
4. **Save**: Apply changes on Tiiny.host

## Notice Categories and Priority Levels

### Available Categories
- `academic` - Academic announcements
- `events` - College events and activities  
- `exams` - Examination notices
- `urgent` - Urgent announcements
- `scholarship` - Scholarship information
- `fee-payments` - Fee payment notices
- `admission` - Admission related notices
- `placement` - Placement opportunities
- `library` - Library notices

### Priority Levels
- `normal` - Regular notices (gray indicator)
- `high` - Important notices (yellow indicator)
- `critical` - Critical notices (red indicator with animation)

## Tiiny.host Features

### Free Plan Benefits
- **Storage**: 3MB file size limit
- **Access**: Unlimited downloads
- **Duration**: Files hosted indefinitely
- **Speed**: Fast global CDN delivery
- **Analytics**: Basic view statistics

### Security Features
- **Password Protection**: Optional password for JSON access
- **Private URLs**: Non-guessable file URLs
- **HTTPS**: Secure connection for all requests
- **Analytics**: Track access patterns

### Paid Plan Benefits
- **Larger Storage**: Up to 75MB per file
- **Custom Domains**: Use your own domain
- **Advanced Analytics**: Detailed access reports
- **Priority Support**: Faster customer service

## Troubleshooting

### Common Issues

#### 1. "Cloud sync not configured" Error
**Cause**: Tiiny.host URL is missing or contains placeholder text
**Solution**:
- Verify your JSON URL is correctly set in index.html
- Ensure you copied the complete URL from Tiiny.host
- Check for typos in the configuration

#### 2. "Sync failed" Error  
**Cause**: Invalid URL or network issues
**Solutions**:
- Test the URL directly in browser
- Verify the JSON file exists on Tiiny.host
- Check internet connection
- Ensure the URL is publicly accessible

#### 3. Data Not Updating
**Cause**: JSON file not updated or browser cache
**Solutions**:
- Verify changes were saved on Tiiny.host
- Hard refresh the page (Ctrl+F5)
- Clear browser cache
- Check if file has "lastUpdated" timestamp newer than local data

#### 4. CORS Errors
**Cause**: Browser security restrictions (rare with Tiiny.host)
**Solutions**:
- Ensure accessing via HTTP/HTTPS (not file://)
- Check browser console for specific error messages
- Verify Tiiny.host service is operational

### Debug Steps

1. **Test Tiiny.host URL**:
   ```javascript
   // Open browser console and run:
   fetch('https://tiiny.host/files/your-id/notices.json')
     .then(r => r.json())
     .then(console.log);
   ```

2. **Check Configuration**:
   ```javascript
   // Verify configuration:
   console.log(window.CLOUD_CONFIG);
   ```

3. **View Local Data**:
   ```javascript
   // Check local storage:
   console.log(JSON.parse(localStorage.getItem('college-notices')));
   ```

## Best Practices

### File Management
1. **Bookmark Management URL**: Save your Tiiny.host edit link
2. **Regular Backups**: Download JSON file periodically
3. **Version Control**: Keep numbered backups locally
4. **Test Changes**: Verify updates in application after changes
5. **Monitor Analytics**: Check file access statistics

### JSON Structure
```json
{
  "notices": [
    // Array of notice objects
  ],
  "lastUpdated": "2024-01-15T10:00:00.000Z", // Always update this
  "version": "1.0", // Optional version tracking
  "metadata": { // Optional metadata
    "totalNotices": 5,
    "lastEditor": "admin"
  }
}
```

### Content Guidelines
- **HTML Content**: Use simple HTML in notice content
- **Date Formats**: Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
- **Unique IDs**: Ensure each notice has a unique ID
- **File Size**: Keep under 3MB for free plan
- **Performance**: Limit to 100-200 notices for optimal loading

## Workflow Examples

### Daily Notice Management
1. **Morning Check**: Access Tiiny.host management URL
2. **Add New**: Insert new notice objects as needed
3. **Update Existing**: Modify any outdated information
4. **Remove Old**: Delete expired or irrelevant notices
5. **Save & Verify**: Apply changes and test in application

### Weekly Maintenance
1. **Review Content**: Check all notices for relevance
2. **Archive Old**: Remove outdated notices
3. **Update Deadlines**: Refresh any upcoming dates
4. **Backup Data**: Download current JSON file
5. **Analytics Review**: Check access statistics

## Limitations and Considerations

### Service Limitations
- **File Size**: 3MB limit on free plan
- **No Authentication**: Files are publicly accessible
- **Manual Updates**: No API for programmatic changes
- **Static Content**: No real-time dynamic updates
- **Single File**: One JSON file per URL

### Suitable Use Cases
- ✅ **College Notice Boards**: Public announcements
- ✅ **Event Listings**: Static event information
- ✅ **Simple CMS**: Basic content management
- ✅ **Read-Heavy Apps**: More reads than writes

### Not Suitable For
- ❌ **Real-time Data**: Frequently changing information
- ❌ **User-generated Content**: Comments, submissions
- ❌ **Private Data**: Sensitive information
- ❌ **Large Datasets**: Complex relational data

## Migration and Backup

### Backup Strategy
```javascript
// Export from application
const backup = {
  notices: window.noticeBoard.notices,
  lastUpdated: new Date().toISOString(),
  backupDate: new Date().toISOString()
};
console.log('Backup:', JSON.stringify(backup, null, 2));
```

### Migration Process
1. **Export Current Data**: Use application export feature
2. **Create New Tiiny File**: Upload to new Tiiny.host location
3. **Update Configuration**: Change URL in application
4. **Test Migration**: Verify data loads correctly
5. **Update Bookmarks**: Save new management URL

## Support Resources

### Tiiny.host Support
- **Website**: [tiiny.host](https://tiiny.host)
- **Documentation**: Available on their website
- **Contact**: Email support available
- **Status**: Check service status on their homepage

### Application Support
- **Browser Console**: Check for error messages
- **CLAUDE.md**: Development guidelines
- **Local Testing**: Test offline functionality

---

**Quick Setup Checklist:**
- [ ] Upload JSON file to Tiiny.host with initial structure
- [ ] Copy the direct JSON URL from Tiiny.host
- [ ] Update `window.CLOUD_CONFIG.tiiny.jsonUrl` in index.html
- [ ] Test application shows "Synced via Tiiny.host" status
- [ ] Add sample notices via Tiiny.host to test data flow
- [ ] Bookmark Tiiny.host management URL for future updates

**Remember**: Tiiny.host provides static JSON hosting - all content updates must be done through their web interface!