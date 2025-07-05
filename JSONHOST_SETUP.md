# JSONhost.com JSON Hosting Setup Guide

## Overview

This guide explains how to set up JSON data hosting for the SMP College Notice Board application using JSONhost.com. JSONhost is a simple JSON hosting service that provides easy JSON hosting with APIs, perfect for storing and retrieving static data for web applications.

## What is JSONhost.com?

JSONhost.com is a JSON hosting platform that provides:
- **Simple JSON Storage**: Easy upload and hosting of JSON files
- **Direct URL Access**: Simple HTTP GET requests to access data
- **Form-Based Editing**: Easy editing through web interface
- **API Integration**: RESTful endpoints for data access
- **Edit Keys**: Optional security for data modification
- **Fast Access**: Quick data retrieval for applications

## Important: Static JSON Hosting

⚠️ **Key Characteristics**:
- **Read-Only Implementation**: This app uses JSONhost in read-only mode
- **Static Files**: JSON content updated manually through web interface
- **Simple API**: Straightforward GET requests for data access
- **Manual Updates**: Content changes done through JSONhost website
- **Perfect for**: Notice boards and static content distribution

## Step-by-Step Setup

### Step 1: Access JSONhost.com

1. Visit [jsonhost.com](https://jsonhost.com)
2. The service provides easy JSON hosting with APIs
3. No account registration required for basic usage
4. Simple upload and hosting process

### Step 2: Create Your JSON File

Prepare your initial JSON structure:
```json
{
  "notices": [],
  "lastUpdated": "2024-01-01T00:00:00.000Z",
  "version": "1.0",
  "metadata": {
    "title": "SMP College Notice Board",
    "description": "Official notices and announcements",
    "service": "jsonhost"
  }
}
```

### Step 3: Upload to JSONhost

1. **Method A - Direct Upload**:
   - Use JSONhost's upload interface
   - Upload your prepared JSON file
   - Get the direct access URL

2. **Method B - Form Creation**:
   - Use JSONhost's form-based creation
   - Paste your JSON structure
   - Save and get access URL

3. **Get Your URLs**:
   - **Access URL**: `https://jsonhost.com/json/abc123`
   - **Edit URL**: Link to modify your JSON (if available)
   - **Edit Key**: Optional security key for modifications

### Step 4: Configure the Application

1. Open `index.html` in your text editor
2. Find the cloud configuration section (around line 295):
   ```javascript
   window.CLOUD_CONFIG = {
       // Service type: 'npoint', 'tiiny', 'jsonsilo', 'jsonhost', or 'multi'
       service: 'jsonhost',
       
       // JSONhost.com Configuration
       jsonhost: {
           jsonUrl: 'YOUR_JSONHOST_URL_HERE',
           // Example: 'https://jsonhost.com/json/abc123'
           editKey: null, // Optional for editing capabilities
       }
   };
   ```

3. Replace the placeholder with your actual JSONhost URL:
   ```javascript
   window.CLOUD_CONFIG = {
       service: 'jsonhost',
       jsonhost: {
           jsonUrl: 'https://jsonhost.com/json/abc123',
           editKey: null // Add if you have edit capabilities
       }
   };
   ```

4. Save the file

### Step 5: Test Configuration

1. Open your Notice Board application in a web browser
2. Check the sync status indicator in the header
3. Expected status indicators:
   - **"Syncing..."** initially
   - **"Synced via JSONhost (Read-only)"** when successful
   - **"Sync failed"** if configuration is incorrect

4. The application will fetch notices from your JSONhost file on page load
5. Local changes are saved in browser storage
6. Click the sync status indicator to manually refresh data from the cloud

## Configuration Options

### Option 1: JSONhost Only
```javascript
window.CLOUD_CONFIG = {
    service: 'jsonhost',
    jsonhost: {
        jsonUrl: 'https://jsonhost.com/json/your-id',
        editKey: null
    }
};
```

### Option 2: JSONhost with Edit Key
```javascript
window.CLOUD_CONFIG = {
    service: 'jsonhost',
    jsonhost: {
        jsonUrl: 'https://jsonhost.com/json/your-id',
        editKey: 'your-edit-key-here' // For write access
    }
};
```

### Option 3: Multi-Service Fallback
```javascript
window.CLOUD_CONFIG = {
    service: 'multi',
    jsonhost: {
        jsonUrl: 'https://jsonhost.com/json/your-id',
        editKey: null
    },
    jsonsilo: {
        publicUrl: 'https://api.jsonsilo.com/public/your-silo-id',
        apiKey: null
    },
    npoint: {
        jsonId: 'your-npoint-id',
        baseUrl: 'https://api.npoint.io'
    }
};
```

## Adding Sample Data

To populate your notice board with initial content:

1. **Access Your JSONhost File**: Use the edit URL or interface
2. **Update JSON Structure**: Replace the empty notices array:
   ```json
   {
     "notices": [
       {
         "id": "welcome-notice-2024",
         "title": "Welcome to SMP College Notice Board",
         "content": "<p>Welcome to the official SMP College Notice Board. Stay updated with all important announcements and information.</p>",
         "category": "academic",
         "priority": "normal",
         "date": "2024-01-15",
         "deadline": null,
         "author": "College Administration",
         "tags": ["welcome", "information", "general"],
         "timestamp": "2024-01-15T10:00:00.000Z",
         "lastModified": "2024-01-15T10:00:00.000Z"
       },
       {
         "id": "exam-schedule-2024",
         "title": "Mid-Semester Examination Schedule",
         "content": "<p><strong>Important:</strong> Mid-semester examinations will be conducted from February 1-15, 2024.</p><ul><li>Mathematics: February 1st, 9:00 AM</li><li>Physics: February 3rd, 2:00 PM</li><li>Chemistry: February 5th, 9:00 AM</li></ul><p>Students must carry valid ID cards to the examination hall.</p>",
         "category": "exams",
         "priority": "high",
         "date": "2024-01-20",
         "deadline": "2024-02-01",
         "author": "Examination Controller",
         "tags": ["exam", "schedule", "important", "mid-semester"],
         "timestamp": "2024-01-20T09:00:00.000Z",
         "lastModified": "2024-01-20T09:00:00.000Z"
       },
       {
         "id": "scholarship-announcement-2024",
         "title": "Merit Scholarship Applications Now Open",
         "content": "<p>Applications for merit-based scholarships for the academic year 2024-25 are now being accepted.</p><p><strong>Eligibility Criteria:</strong></p><ul><li>Minimum GPA of 3.5</li><li>Regular attendance (>90%)</li><li>Active participation in college activities</li></ul><p><strong>Required Documents:</strong></p><ul><li>Academic transcripts</li><li>Two recommendation letters</li><li>Financial need statement</li></ul>",
         "category": "scholarship",
         "priority": "high",
         "date": "2024-01-25",
         "deadline": "2024-03-15",
         "author": "Financial Aid Office",
         "tags": ["scholarship", "merit", "application", "financial-aid", "deadline"],
         "timestamp": "2024-01-25T14:00:00.000Z",
         "lastModified": "2024-01-25T14:00:00.000Z"
       }
     ],
     "lastUpdated": "2024-01-25T14:00:00.000Z",
     "version": "1.1",
     "metadata": {
       "title": "SMP College Notice Board",
       "description": "Official notices and announcements",
       "totalNotices": 3,
       "service": "jsonhost"
     }
   }
   ```

3. **Save Changes**: Update your JSONhost file
4. **Verify**: Refresh your application - notices should appear

## Content Management Workflow

### For Content Administrators

#### Adding New Notices
1. **Access JSONhost**: Go to your JSONhost edit URL
2. **Edit JSON**: Modify the JSON structure
3. **Add Notice Object**: Insert new notice using this template:
   ```json
   {
     "id": "unique-notice-id",
     "title": "Your Notice Title",
     "content": "<p>Notice content with HTML formatting</p>",
     "category": "academic",
     "priority": "normal",
     "date": "2024-01-15",
     "deadline": "2024-01-30",
     "author": "Department Name",
     "tags": ["tag1", "tag2", "tag3"],
     "timestamp": "2024-01-15T10:00:00.000Z",
     "lastModified": "2024-01-15T10:00:00.000Z"
   }
   ```
4. **Update Metadata**: Change "lastUpdated" and increment notice count
5. **Save Changes**: Apply updates on JSONhost
6. **Verify**: Check application for updates

#### Editing Existing Notices
1. **Locate Notice**: Find the notice object in the JSON
2. **Modify Fields**: Update title, content, category, priority, etc.
3. **Update Timestamps**: Set "lastModified" to current time
4. **Update Global Timestamp**: Change "lastUpdated" field
5. **Save**: Apply changes on JSONhost

#### Removing Notices
1. **Find Notice Object**: Locate in the notices array
2. **Delete Entry**: Remove the entire JSON object
3. **Update Counters**: Decrease total notice count in metadata
4. **Update Timestamp**: Change "lastUpdated" to current time
5. **Save**: Apply changes to JSONhost

## Notice Categories and Priority Levels

### Available Categories
- `academic` - Academic announcements and updates
- `events` - College events, seminars, workshops
- `exams` - Examination schedules and notices
- `urgent` - Critical urgent announcements
- `scholarship` - Scholarship and financial aid information
- `fee-payments` - Fee payment deadlines and procedures
- `admission` - Admission-related notices
- `placement` - Job opportunities and placements
- `library` - Library notices and updates

### Priority Levels
- `normal` - Regular notices (default styling)
- `high` - Important notices (yellow warning styling)
- `critical` - Critical notices (red styling with pulse animation)

## JSONhost Features

### Basic Features
- **Simple Upload**: Easy JSON file hosting
- **Direct Access**: Simple URL-based access
- **Form Editing**: Web-based JSON editing
- **API Integration**: RESTful endpoints
- **Edit Keys**: Optional security for modifications

### API Capabilities
- **GET Requests**: Simple data retrieval
- **Edit Keys**: Secure modification access
- **Form Interface**: User-friendly editing
- **Direct URLs**: Clean, simple access URLs

## Troubleshooting

### Common Issues

#### 1. "Cloud sync not configured" Error
**Cause**: JSONhost URL missing or contains placeholder text
**Solutions**:
- Verify your JSON URL is correctly set in index.html
- Ensure you copied the complete URL from JSONhost
- Check for typos in the configuration
- Make sure the URL starts with `https://jsonhost.com/`

#### 2. "Sync failed" Error
**Cause**: Invalid URL, network issues, or access problems
**Solutions**:
- Test the URL directly in browser
- Verify the JSON file exists on JSONhost
- Check internet connection
- Ensure the URL is publicly accessible

#### 3. Data Not Updating
**Cause**: JSON file not updated or browser cache
**Solutions**:
- Verify changes were saved on JSONhost
- Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
- Clear browser cache and localStorage
- Check if "lastUpdated" timestamp is newer than local data

#### 4. Access Errors
**Cause**: URL not accessible or service issues
**Solutions**:
- Verify JSONhost service is operational
- Check URL format and accessibility
- Ensure no CORS issues with the service
- Test with a simple browser request

### Debug Steps

1. **Test JSONhost URL Directly**:
   ```javascript
   // Open browser console and run:
   fetch('https://jsonhost.com/json/your-id')
     .then(r => r.json())
     .then(console.log)
     .catch(console.error);
   ```

2. **Check Configuration**:
   ```javascript
   // Verify configuration in console:
   console.log(window.CLOUD_CONFIG);
   ```

3. **Test with Edit Key (if available)**:
   ```javascript
   // Test with edit key:
   fetch('https://jsonhost.com/json/your-id', {
     headers: {
       'X-Edit-Key': 'your-edit-key',
       'Content-Type': 'application/json'
     }
   }).then(r => r.json()).then(console.log);
   ```

4. **View Local Data**:
   ```javascript
   // Check what's stored locally:
   console.log(JSON.parse(localStorage.getItem('college-notices')));
   ```

## Best Practices

### File Management
1. **Bookmark URLs**: Save both access and edit URLs
2. **Regular Backups**: Download JSON files periodically
3. **Version Control**: Include version numbers in your JSON
4. **Test Changes**: Verify updates appear correctly in application
5. **Simple Structure**: Keep JSON structure clean and organized

### JSON Structure Best Practices
```json
{
  "notices": [
    // Notice objects here
  ],
  "lastUpdated": "2024-01-15T10:00:00.000Z", // Always update this
  "version": "1.2", // Track structure changes
  "metadata": {
    "title": "SMP College Notice Board",
    "description": "Official notices and announcements",
    "totalNotices": 5,
    "service": "jsonhost",
    "lastEditor": "admin@college.edu"
  }
}
```

### Content Guidelines
- **HTML Content**: Use clean, semantic HTML in notice content
- **Date Formats**: Consistent ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
- **Unique IDs**: Ensure each notice has a unique, descriptive ID
- **Performance**: Keep file size reasonable for fast loading
- **Validation**: Use JSON validators to check syntax before saving

## Workflow Examples

### Daily Notice Management
1. **Morning Check**: Access JSONhost edit interface
2. **Add New Notices**: Insert new announcements using templates
3. **Update Existing**: Modify any outdated information
4. **Remove Expired**: Delete old or irrelevant notices
5. **Verify Application**: Test changes appear correctly

### Weekly Maintenance
1. **Content Review**: Check all notices for relevance and accuracy
2. **Archive Management**: Remove outdated notices
3. **Performance Check**: Monitor file size and loading times
4. **Backup Creation**: Download current JSON as backup
5. **Structure Review**: Ensure JSON remains well-formatted

## Migration and Backup

### Backup Strategy
```javascript
// Export current data from application
const backup = {
  notices: window.noticeBoard.notices,
  lastUpdated: new Date().toISOString(),
  backupDate: new Date().toISOString(),
  source: 'smp-notice-board-jsonhost'
};
console.log('Backup Data:', JSON.stringify(backup, null, 2));
```

### Migration Process
1. **Export Current Data**: Use application export feature
2. **Create New JSONhost File**: Upload to new JSONhost location
3. **Update Configuration**: Change URL in application
4. **Test Migration**: Verify data loads correctly
5. **Update Bookmarks**: Save new access and edit URLs

## Support Resources

### JSONhost Support
- **Website**: [jsonhost.com](https://jsonhost.com)
- **Service**: Check website for documentation and support
- **Community**: Look for user forums or help sections

### Application Support
- **Development Guide**: Check CLAUDE.md for development guidelines
- **Browser Console**: Use F12 to check for error messages
- **Local Testing**: Test offline functionality and local storage

---

**Quick Setup Checklist:**
- [ ] Go to jsonhost.com and upload JSON with initial structure
- [ ] Copy the access URL from JSONhost
- [ ] Update `window.CLOUD_CONFIG.jsonhost.jsonUrl` in index.html
- [ ] Test application shows "Synced via JSONhost" status
- [ ] Add sample notices via JSONhost interface
- [ ] Bookmark JSONhost edit URL for easy content management
- [ ] Download initial backup of your JSON data

**Pro Tips:**
- 🎯 **Keep JSON structure simple** for easy manual editing
- 🔄 **Test URLs in browser** before configuring the app
- 📋 **Use consistent naming** for notice IDs and metadata
- 🛡️ **Use edit keys** if JSONhost provides secure editing
- 📊 **Monitor file size** to ensure fast loading times

JSONhost provides a simple, straightforward solution for static JSON hosting perfect for college notice boards!