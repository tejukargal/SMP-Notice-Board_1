# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a sophisticated College Notice Board web application built with vanilla HTML, CSS, and JavaScript. It features cloud synchronization, offline functionality, and a modern responsive design for educational institutions.

## Architecture

### Technology Stack
- **Frontend**: Pure vanilla HTML5, CSS3, JavaScript (ES6+)
- **Cloud Sync**: JSONhost.com API for bidirectional data synchronization
- **Storage**: localStorage for offline fallback and caching
- **UI Framework**: Custom CSS with modern design patterns
- **Rich Text**: Quill.js editor for content creation
- **Icons**: Font Awesome 6.0.0
- **Fonts**: Inter + Noto Sans Kannada from Google Fonts

### Core Components
- **NoticeBoard Class** (`script.js:1`): Main application controller
- **CSS Variables System** (`styles.css:1-80`): Complete design system
- **Modal System** (`index.html:150-300`): Overlay-based interactions
- **Responsive Grid** (`styles.css:400-500`): Mobile-first layout

## Key Features

### Notice Management
- **CRUD Operations**: Full create, read, update, delete functionality
- **Rich Text Editor**: Quill.js integration with formatting toolbar
- **Categories**: 15+ predefined categories with visual coding
- **Priority System**: Normal, High, Critical with animations
- **Deadline Tracking**: Visual indicators for overdue/approaching deadlines
- **Tag System**: Custom keywords for organization and filtering
- **Display Order**: Manual positioning control for top 3 notices

### Cloud Synchronization
- **JSONhost Integration**: Full read/write synchronization with API tokens
- **Real-time Updates**: Automatic sync on CRUD operations
- **Offline Fallback**: localStorage backup with sync when online
- **Data Validation**: Input sanitization and error handling
- **Export/Import**: JSON, CSV, PDF export capabilities

### Forms and Data Capture
- **Dynamic Forms**: Admin-created forms for student submissions
- **Form Builder**: Visual form creation with multiple question types
- **Response Management**: Admin dashboard for form responses
- **CSV Integration**: Scrolling message display from CSV files
- **File Attachments**: Support for multiple file types with compression

### Authentication
- **Admin System**: Keyword-based authentication (`teju_smp`)
- **Session Management**: Uses sessionStorage for persistence
- **Permission Control**: Edit/delete restricted to admin users
- **UI State Management**: Dynamic visibility of admin controls

### User Interface
- **Dark Mode**: Complete theme system with CSS variables
- **Responsive Design**: Mobile-first approach with breakpoints
- **Glassmorphism**: Modern design with backdrop-filter effects
- **Toast Notifications**: User feedback for all operations
- **Keyboard Shortcuts**: Power-user functionality

## Development Commands

### Local Development
```bash
# Start local server (choose one):
python -m http.server 8000    # Python
npm start                     # NPM script
npx serve .                   # Node.js  
php -S localhost:8000         # PHP

# Open in browser
open http://localhost:8000
```

### Testing Commands
```bash
# No specific test framework - manual testing required
# Test across browsers: Chrome, Firefox, Safari, Edge
# Test responsive design on various screen sizes
# Test offline functionality by disconnecting network
```

### Linting Commands
```bash
# No linting setup - pure vanilla code
# Validate HTML: https://validator.w3.org/
# Validate CSS: https://jigsaw.w3.org/css-validator/
# Check JavaScript: Use browser dev tools console
```

## Code Style Guidelines

### JavaScript Conventions
- **Class-based Architecture**: Main functionality in `NoticeBoard` class
- **ES6+ Features**: Arrow functions, template literals, destructuring
- **Async/Await**: For all Promise-based operations
- **Error Handling**: Try-catch blocks with user feedback
- **Event Delegation**: Efficient event listener management

### CSS Conventions
- **CSS Variables**: Use custom properties for all design tokens
- **BEM-like Naming**: Block-element-modifier pattern
- **Mobile-first**: Start with mobile styles, enhance for desktop
- **Accessibility**: Proper focus states and ARIA labels

### HTML Conventions
- **Semantic Elements**: Use appropriate HTML5 elements
- **Accessibility**: ARIA labels and keyboard navigation
- **Performance**: Minimize DOM depth and optimize images

## Data Structures

### Notice Object
```javascript
{
    id: string,              // Unique timestamp-based identifier
    title: string,           // Notice title (required)
    content: string,         // Rich HTML content from Quill editor
    category: string,        // Category selection (required)
    priority: string,        // 'normal'|'high'|'critical'
    date: string,           // Publication date (YYYY-MM-DD)
    deadline: string|null,   // Optional deadline date
    author: string,         // Department/faculty name
    tags: string[],         // Array of custom keyword tags
    timestamp: string,      // Creation timestamp (ISO format)
    lastModified: string,   // Last edit timestamp (ISO format)
    order: number,          // Display order (1-3 for priority positioning)
    attachments: object[]   // File attachments with metadata
}
```

### Storage Structure
```javascript
// localStorage: 'college-notices'
[Notice, Notice, ...] // Array of notice objects

// localStorage: 'darkMode' 
boolean // Theme preference

// sessionStorage: 'isAdmin'
boolean // Authentication state

// JSONhost Cloud Structure
{
    notices: Notice[],
    lastUpdated: string,
    version: string,
    metadata: {
        title: string,
        description: string,
        service: string
    }
}
```

## Code Architecture

### Main Application Class
```javascript
class NoticeBoard {
    constructor() {
        this.notices = [];
        this.filteredNotices = [];
        this.currentCategory = 'all';
        this.isAdmin = false;
        this.quillEditor = null;
        this.fileData = new Map();
        this.init();
    }

    async init() {
        await this.loadAllCSVFiles();
        await this.initializeCloudSync();
        this.setupEventListeners();
        this.loadSettings();
        await this.render();
    }
}
```

### Key Methods

#### Data Management
- `loadAllCSVFiles()`: Loads CSV files for scrolling messages
- `syncWithCloud()`: Orchestrates cloud synchronization
- `syncWithJsonhost()`: Handles JSONhost-specific sync operations
- `uploadToCloud()`: Uploads local changes to cloud storage
- `optimizeNoticesForCloud()`: Compresses data for cloud storage

#### UI Operations
- `render()`: Main rendering method for notices display
- `renderNotices()`: Renders individual notice cards
- `handleCategoryFilter()`: Filters notices by category
- `openNoticeModal()`: Opens notice creation/editing modal
- `showNoticeDetails()`: Displays notice in detail view

#### Form Management
- `openFormsModal()`: Opens form builder interface
- `addQuestion()`: Adds questions to form builder
- `saveFormData()`: Saves form configuration
- `manageFormData()`: Admin interface for form responses

### File Structure
```
/
├── index.html              # Main application file
├── script.js              # Application logic (NoticeBoard class)
├── styles.css             # Complete styling system
├── file-hosting-debug.js   # File hosting utilities
├── README.md              # Basic project information
├── JSONHOST_SETUP.md      # Detailed setup instructions
├── CLAUDE.md              # This file
├── package-lock.json      # NPM configuration
├── 1.csv                  # Sample CSV for scrolling messages
├── 2.csv                  # Sample CSV for scrolling messages
└── prompt.txt             # Development notes
```

## Configuration

### JSONhost Setup
1. Create JSON endpoint at jsonhost.com
2. Enable POST/PATCH requests in admin settings
3. Copy API authorization token
4. Update `window.CLOUD_CONFIG` in `index.html:590-617`
5. Replace placeholder with actual JSONhost ID and API token

### Cloud Configuration
```javascript
window.CLOUD_CONFIG = {
    service: 'jsonhost',
    jsonhost: {
        jsonId: 'your-json-id',
        apiToken: 'your-api-token',
        baseUrl: 'https://jsonhost.com/json/'
    }
}
```

### Environment Variables
- No server-side environment variables
- Configuration stored in HTML file
- Can be moved to separate config.js if needed

## Browser Compatibility

### Required Features
- **CSS Grid & Flexbox**: Modern layout systems
- **CSS Custom Properties**: Variables for theming
- **Backdrop-filter**: Glassmorphism effects
- **ES6 Classes**: Modern JavaScript features
- **Storage APIs**: localStorage and sessionStorage
- **Fetch API**: Cloud synchronization
- **File API**: Import/export functionality

### Supported Browsers
- Chrome 88+
- Firefox 87+
- Safari 14+
- Edge 88+

## Performance Optimization

### JavaScript Performance
- **Efficient Rendering**: Only re-render when data changes
- **Debounced Search**: Real-time search with performance optimization
- **Memory Management**: Proper cleanup of event listeners
- **Lazy Loading**: Load content as needed

### CSS Performance
- **CSS Variables**: Efficient theme switching
- **Transform3d**: Hardware acceleration for animations
- **Will-change**: Optimize for upcoming changes
- **Minimize Reflow**: Use transforms over layout changes

### Network Performance
- **Manual Sync**: Sync only on page load and manual refresh
- **Minimal API Calls**: No automatic polling to reduce server load
- **Offline Fallback**: Graceful degradation
- **CDN Usage**: External resources from CDN

## Security Considerations

### Client-side Security
- **Input Sanitization**: Prevent XSS attacks
- **Data Validation**: Validate all user inputs
- **Admin Authentication**: Simple keyword-based system
- **No Sensitive Data**: Designed for public notices

### Limitations
- Client-side only application
- Admin code is hardcoded (suitable for controlled environments)
- No server-side validation or authentication
- Data is publicly accessible if JSONhost credentials are exposed

## Testing Strategy

### Manual Testing Checklist
- [ ] Notice CRUD operations work correctly
- [ ] Search and filtering functions properly
- [ ] Admin authentication and permissions work
- [ ] Cloud sync works with network changes
- [ ] Offline functionality works without internet
- [ ] Export/import features work correctly
- [ ] Responsive design works on all screen sizes
- [ ] Dark mode toggle works properly
- [ ] Keyboard shortcuts function correctly
- [ ] Toast notifications appear for all actions

### Cross-browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Performance Testing
- [ ] Load time under 3 seconds
- [ ] Smooth animations on all devices
- [ ] Memory usage remains stable
- [ ] No console errors or warnings

## Deployment

### Static Hosting
- Can be deployed on any static hosting service
- No server-side requirements
- Examples: Netlify, Vercel, GitHub Pages, Firebase Hosting

### Pre-deployment Checklist
- [ ] Update JSONhost configuration with real credentials
- [ ] Test all functionality in production environment
- [ ] Verify CDN resources are accessible
- [ ] Check mobile responsiveness
- [ ] Validate HTML/CSS
- [ ] Test offline functionality

### Environment Setup
```bash
# Clone or download files
# Update JSONhost configuration in index.html
# Deploy to static hosting service
# Test live application
```

## Troubleshooting

### Common Issues

#### Cloud Sync Not Working
- Check JSONhost ID and API token configuration in index.html
- Verify network connectivity
- Test JSONhost URL directly in browser
- Check browser console for API errors

#### Styles Not Loading
- Verify CDN links are accessible
- Check CSS file path and permissions
- Validate CSS syntax
- Clear browser cache

#### JavaScript Errors
- Check browser console for specific errors
- Verify all CDN scripts are loaded
- Check for syntax errors in script.js
- Ensure DOM elements exist before accessing

#### Mobile Issues
- Test on actual devices, not just browser dev tools
- Check viewport meta tag
- Verify touch events work properly
- Test offline functionality on mobile

### Debug Mode
- Open browser developer tools
- Check console for errors and warnings
- Use Network tab to monitor API calls
- Use Application tab to inspect localStorage/sessionStorage

## Contributing Guidelines

### Code Quality
- Follow existing code style and patterns
- Add comments for complex logic
- Test changes across all supported browsers
- Ensure responsive design is maintained

### Feature Development
1. Understand existing architecture
2. Plan changes to minimize impact
3. Test thoroughly before implementation
4. Update documentation as needed

### Bug Fixes
1. Reproduce the issue
2. Identify root cause
3. Implement minimal fix
4. Test fix doesn't break other features

## Future Enhancements

### Potential Features
- User accounts and permissions
- Email notifications for deadlines
- Advanced search with filters
- Notice templates
- Approval workflow
- Analytics and reporting
- Multi-language support
- Rich media attachments
- Two-way sync with writable cloud service

### Technical Improvements
- Service worker for better offline support
- IndexedDB for larger data storage
- Web Components for modularity
- TypeScript for better type safety
- Build process for optimization
- Unit and integration tests

## Common Issues and Solutions

### Cloud Sync Issues
- **Error**: "Cloud sync not configured"
  - **Solution**: Verify JSONhost ID and API token in configuration
  
- **Error**: "Sync failed"
  - **Solution**: Check network connectivity and JSONhost service status

### Performance Issues
- **Slow Loading**: Check file sizes and optimize images
- **Memory Leaks**: Ensure proper event listener cleanup
- **Rendering Issues**: Verify CSS compatibility across browsers

### Data Issues
- **Missing Notices**: Check localStorage and cloud sync status
- **Form Responses**: Verify form configuration and API endpoints
- **CSV Files**: Ensure proper file format and encoding

## Development Best Practices

### Code Organization
- Keep the main NoticeBoard class modular
- Use async/await for all Promise-based operations
- Implement proper error handling with try-catch blocks
- Follow consistent naming conventions

### CSS Guidelines
- Use CSS custom properties for all design tokens
- Follow mobile-first responsive design
- Implement proper focus states for accessibility
- Use semantic HTML elements

### JavaScript Patterns
- Use ES6+ features consistently
- Implement proper event delegation
- Handle errors gracefully with user feedback
- Optimize for performance with debouncing

## Admin Access

Default admin code: `teju_smp`

This provides access to:
- Add/edit/delete notices
- Form builder and management
- Export/import functionality
- Response management
- System configuration

---

*This application serves as a comprehensive notice board solution for educational institutions, combining modern web technologies with practical functionality for daily administrative tasks.*