# Requirements Document: FireVision IPTV Server Modernization

## Introduction

The FireVision IPTV Server is a Node.js/Express backend system that manages IPTV channel lists and Android app updates for the FireVision IPTV application. The current system uses AdminLTE 3.2 (Bootstrap 4) with jQuery for the frontend, session-based authentication, and MongoDB for data storage. This modernization project aims to upgrade the entire technology stack, improve user experience, enhance security, and add modern features while maintaining system stability through a phased approach.

The modernization will transform the system from a legacy jQuery-based interface to a modern, type-safe, performant application with improved developer experience, better security practices, and enhanced user features.

## Glossary

- **System**: The FireVision IPTV Server application (backend API + frontend UI)
- **Admin_Panel**: The administrative web interface for managing channels, users, and app versions
- **User_Portal**: The user-facing web interface for viewing channels and managing personal playlists
- **API_Server**: The Express.js backend that handles HTTP requests and database operations
- **Channel**: An IPTV streaming channel with metadata (name, URL, logo, group, DRM info)
- **M3U_Playlist**: A standard playlist format for IPTV channels
- **APK**: Android application package file for the FireVision IPTV mobile app
- **JWT**: JSON Web Token used for stateless authentication
- **RBAC**: Role-Based Access Control system for managing user permissions
- **DRM**: Digital Rights Management for protected streaming content
- **WebSocket**: Protocol for real-time bidirectional communication
- **Redis**: In-memory data store used for caching and session management
- **TypeScript**: Typed superset of JavaScript for improved code quality
- **React**: Modern JavaScript library for building user interfaces
- **Next.js**: React framework with server-side rendering and routing
- **OAuth**: Open standard for access delegation and authentication
- **CDN**: Content Delivery Network for serving static assets
- **CI/CD**: Continuous Integration and Continuous Deployment pipeline
- **WCAG**: Web Content Accessibility Guidelines for accessible web applications
- **Rate_Limiter**: Mechanism to control request frequency per user or IP address
- **Super_Admin**: User with highest level of system access and permissions
- **Pairing_Request**: Request to link a Fire TV device with a user account
- **Session**: Authenticated user session with associated state and permissions
- **Refresh_Token**: Long-lived token used to obtain new access tokens

## Requirements

### Requirement 1: Modern Frontend Technology Stack

**User Story:** As a developer, I want to use modern frontend technologies, so that the codebase is maintainable, type-safe, and follows current best practices.

#### Acceptance Criteria

1. THE System SHALL use React 18+ or Next.js 14+ for the frontend framework
2. THE System SHALL use TypeScript for all frontend code with strict type checking enabled
3. THE System SHALL remove all jQuery dependencies from the codebase
4. THE System SHALL remove AdminLTE and Bootstrap 4 dependencies
5. THE System SHALL use a modern UI component library (Material-UI, Ant Design, or Shadcn/ui)
6. THE System SHALL implement modern state management (React Context, Zustand, or Redux Toolkit)
7. THE System SHALL use a modern build tool (Vite or Next.js built-in tooling)
8. THE System SHALL support CSS-in-JS or CSS Modules for component styling

### Requirement 2: Modern Backend Technology Stack

**User Story:** As a developer, I want to modernize the backend codebase, so that it uses current Node.js features and TypeScript for better maintainability.

#### Acceptance Criteria

1. THE System SHALL use Node.js 20 LTS or later
2. THE System SHALL convert all backend code to TypeScript with strict type checking
3. THE System SHALL use ES modules instead of CommonJS
4. THE System SHALL implement proper dependency injection patterns
5. THE System SHALL use modern async/await patterns consistently
6. THE System SHALL implement API versioning with /api/v2/ endpoints
7. THE System SHALL maintain backward compatibility with /api/v1/ endpoints during transition
8. THE System SHALL use environment-based configuration with validation

### Requirement 3: Improved User Interface and Experience

**User Story:** As a user, I want a modern, intuitive interface, so that I can efficiently manage channels and navigate the system.

#### Acceptance Criteria

1. THE System SHALL provide a responsive design that works on mobile, tablet, and desktop devices
2. THE System SHALL implement dark mode and light mode themes with user preference persistence
3. THE System SHALL provide loading states for all asynchronous operations
4. THE System SHALL display user-friendly error messages with actionable guidance
5. THE System SHALL implement optimistic UI updates for better perceived performance
6. THE System SHALL provide keyboard navigation support for all interactive elements
7. THE System SHALL implement infinite scroll or virtual scrolling for large channel lists
8. THE System SHALL provide real-time feedback for long-running operations with progress indicators
9. THE System SHALL implement smooth transitions and animations that enhance usability
10. THE System SHALL provide contextual help and tooltips for complex features

### Requirement 4: Enhanced Authentication and Authorization

**User Story:** As a system administrator, I want robust authentication and authorization, so that user data is secure and access is properly controlled.

#### Acceptance Criteria

1. THE System SHALL implement JWT-based authentication with access tokens and refresh tokens
2. WHEN an access token expires, THE System SHALL automatically refresh it using the refresh token
3. THE System SHALL implement secure token storage using httpOnly cookies
4. THE System SHALL support OAuth 2.0 authentication with Google and GitHub providers
5. THE System SHALL implement role-based access control with roles: super_admin, admin, and user
6. THE System SHALL enforce password complexity requirements (minimum 8 characters, uppercase, lowercase, number, special character)
7. THE System SHALL implement account lockout after 5 failed login attempts
8. THE System SHALL provide password reset functionality via email
9. THE System SHALL implement two-factor authentication (2FA) as an optional security feature
10. THE System SHALL log all authentication events for security auditing

### Requirement 5: Real-Time Features

**User Story:** As an administrator, I want real-time updates, so that I can see channel status changes and user activity without refreshing the page.

#### Acceptance Criteria

1. THE System SHALL implement WebSocket connections for real-time communication
2. WHEN a channel is added, updated, or deleted, THE System SHALL broadcast the change to all connected admin clients
3. WHEN a user connects or disconnects, THE System SHALL update the active users count in real-time
4. THE System SHALL display real-time channel health status (online/offline) in the admin panel
5. THE System SHALL implement automatic reconnection when WebSocket connection is lost
6. THE System SHALL provide real-time notifications for important system events
7. THE System SHALL implement presence indicators showing which admins are currently online
8. THE System SHALL limit WebSocket connections per user to prevent resource exhaustion

### Requirement 6: Advanced Channel Management

**User Story:** As an administrator, I want advanced channel management features, so that I can efficiently organize and maintain large channel lists.

#### Acceptance Criteria

1. THE System SHALL support bulk operations (activate, deactivate, delete, update group) on multiple channels
2. THE System SHALL provide advanced filtering by channel group, status, DRM type, and custom tags
3. THE System SHALL implement full-text search across channel names, groups, and metadata
4. THE System SHALL support drag-and-drop reordering of channels within groups
5. THE System SHALL provide channel duplication functionality for quick creation of similar channels
6. THE System SHALL implement channel templates for common configurations
7. THE System SHALL validate channel URLs and provide health check status
8. THE System SHALL support importing channels from multiple M3U sources simultaneously
9. THE System SHALL provide export functionality in multiple formats (M3U, JSON, CSV)
10. THE System SHALL implement channel categorization with custom tags and labels

### Requirement 7: Analytics and Monitoring Dashboard

**User Story:** As an administrator, I want comprehensive analytics, so that I can understand system usage and make informed decisions.

#### Acceptance Criteria

1. THE System SHALL display total channel count, active users, and app download statistics
2. THE System SHALL provide interactive charts showing channel views over time
3. THE System SHALL display most popular channels by view count
4. THE System SHALL show user growth trends over time periods (daily, weekly, monthly)
5. THE System SHALL display API request statistics with response time metrics
6. THE System SHALL provide system health metrics (CPU, memory, database connections)
7. THE System SHALL implement exportable reports in PDF and CSV formats
8. THE System SHALL display geographic distribution of users on a map visualization
9. THE System SHALL track and display app version adoption rates
10. THE System SHALL provide customizable date range filters for all analytics

### Requirement 8: Performance Optimization

**User Story:** As a user, I want fast page loads and responsive interactions, so that I can work efficiently without delays.

#### Acceptance Criteria

1. THE System SHALL implement Redis caching for frequently accessed channel data
2. THE System SHALL cache channel lists with a configurable TTL (default 5 minutes)
3. WHEN channel data is modified, THE System SHALL invalidate relevant cache entries
4. THE System SHALL implement database query optimization with proper indexing
5. THE System SHALL use CDN for serving static assets (images, CSS, JavaScript)
6. THE System SHALL implement image optimization and lazy loading for channel logos
7. THE System SHALL achieve a Lighthouse performance score of 90+ for the admin panel
8. THE System SHALL implement code splitting to reduce initial bundle size
9. THE System SHALL use compression (gzip/brotli) for all HTTP responses
10. THE System SHALL implement pagination or virtual scrolling for lists exceeding 100 items

### Requirement 9: Security Enhancements

**User Story:** As a security-conscious administrator, I want robust security measures, so that the system is protected against common vulnerabilities.

#### Acceptance Criteria

1. THE System SHALL implement rate limiting of 100 requests per 15 minutes per IP address for API endpoints
2. THE System SHALL implement stricter rate limiting of 10 requests per 15 minutes for authentication endpoints
3. THE System SHALL enforce HTTPS for all connections in production environments
4. THE System SHALL implement security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
5. THE System SHALL sanitize all user inputs to prevent XSS attacks
6. THE System SHALL use parameterized queries to prevent SQL/NoSQL injection
7. THE System SHALL implement CORS with configurable allowed origins
8. THE System SHALL encrypt sensitive data at rest in the database
9. THE System SHALL implement audit logging for all administrative actions
10. THE System SHALL perform dependency vulnerability scanning in CI/CD pipeline
11. THE System SHALL implement API key rotation mechanism for administrative access
12. THE System SHALL validate file uploads for type, size, and malicious content

### Requirement 10: Developer Experience Improvements

**User Story:** As a developer, I want excellent tooling and documentation, so that I can develop features efficiently and onboard quickly.

#### Acceptance Criteria

1. THE System SHALL use ESLint with TypeScript rules for code quality enforcement
2. THE System SHALL use Prettier for consistent code formatting
3. THE System SHALL implement Husky pre-commit hooks for linting and formatting
4. THE System SHALL provide comprehensive API documentation using OpenAPI/Swagger
5. THE System SHALL implement automated testing with minimum 70% code coverage
6. THE System SHALL use Jest for unit testing and Playwright for end-to-end testing
7. THE System SHALL implement GitHub Actions CI/CD pipeline for automated testing and deployment
8. THE System SHALL provide Docker Compose setup for local development environment
9. THE System SHALL include detailed README with setup instructions and architecture diagrams
10. THE System SHALL implement hot module replacement for fast development iteration
11. THE System SHALL provide TypeScript types for all API responses
12. THE System SHALL use conventional commits for clear git history

### Requirement 11: Testing Infrastructure

**User Story:** As a developer, I want comprehensive testing infrastructure, so that I can ensure code quality and prevent regressions.

#### Acceptance Criteria

1. THE System SHALL implement unit tests for all business logic functions
2. THE System SHALL implement integration tests for all API endpoints
3. THE System SHALL implement end-to-end tests for critical user flows
4. THE System SHALL implement property-based tests for data validation functions
5. THE System SHALL run all tests automatically on pull requests
6. THE System SHALL fail CI builds when test coverage drops below 70%
7. THE System SHALL provide test fixtures and factories for consistent test data
8. THE System SHALL implement API contract testing for frontend-backend integration
9. THE System SHALL provide visual regression testing for UI components
10. THE System SHALL implement performance testing for critical API endpoints

### Requirement 12: Marketing and Public-Facing Features

**User Story:** As a product owner, I want a professional public presence, so that users can discover and sign up for the service easily.

#### Acceptance Criteria

1. THE System SHALL provide a marketing landing page at the root URL (http://tv.cadnative.com/)
2. THE System SHALL display key features, screenshots, and benefits on the landing page
3. THE System SHALL provide separate signup flows for regular users and administrators
4. THE System SHALL implement a public API documentation page accessible without authentication
5. THE System SHALL provide download links for Android APK with version information
6. THE System SHALL display system status and uptime on a public status page
7. THE System SHALL implement SEO optimization with proper meta tags and structured data
8. THE System SHALL provide a contact form for support inquiries
9. THE System SHALL implement email notifications for new user registrations
10. THE System SHALL display terms of service and privacy policy pages

### Requirement 13: User Management and Administration

**User Story:** As an administrator, I want comprehensive user management tools, so that I can manage user accounts and permissions effectively.

#### Acceptance Criteria

1. THE System SHALL provide a user list with search, filter, and sort capabilities
2. THE System SHALL allow administrators to create, update, and delete user accounts
3. THE System SHALL allow administrators to assign and modify user roles
4. THE System SHALL display user activity logs showing login history and actions
5. THE System SHALL allow administrators to suspend or activate user accounts
6. THE System SHALL provide bulk user operations (activate, deactivate, delete, change role)
7. THE System SHALL display user statistics (total users, active users, new registrations)
8. THE System SHALL allow administrators to reset user passwords
9. THE System SHALL implement user profile management with avatar upload
10. THE System SHALL provide user session management with ability to revoke active sessions

### Requirement 14: APK Management and Distribution via GitHub Releases

**User Story:** As an administrator, I want to manage APK distribution through GitHub Releases, so that I can leverage GitHub's infrastructure and provide seamless updates to users.

#### Acceptance Criteria

1. THE System SHALL integrate with GitHub API to fetch releases from the FireVisionIPTV repository
2. THE System SHALL automatically extract version information and APK assets from GitHub releases
3. THE System SHALL cache GitHub release data with a configurable TTL (default 5 minutes)
4. THE System SHALL display APK file size, version, release date, and release notes in the admin panel
5. THE System SHALL parse release notes to determine if updates are mandatory or optional
6. THE System SHALL provide a link to open the GitHub release page for detailed information
7. THE System SHALL track download statistics for each APK version in the database
8. THE System SHALL display both GitHub download counts and server-tracked downloads
9. THE System SHALL provide an API endpoint to check for app updates against GitHub releases
10. THE System SHALL support version comparison to determine if an update is available

### Requirement 15: Accessibility Compliance

**User Story:** As a user with disabilities, I want an accessible interface, so that I can use the system effectively with assistive technologies.

#### Acceptance Criteria

1. THE System SHALL meet WCAG 2.1 Level AA compliance standards
2. THE System SHALL provide proper ARIA labels for all interactive elements
3. THE System SHALL support keyboard navigation for all functionality
4. THE System SHALL provide sufficient color contrast ratios (minimum 4.5:1 for normal text)
5. THE System SHALL provide text alternatives for all non-text content
6. THE System SHALL support screen readers with proper semantic HTML
7. THE System SHALL provide focus indicators for all interactive elements
8. THE System SHALL allow text resizing up to 200% without loss of functionality
9. THE System SHALL provide skip navigation links for keyboard users
10. THE System SHALL avoid using color as the only means of conveying information

### Requirement 16: Data Import and Export

**User Story:** As an administrator, I want flexible data import and export options, so that I can migrate data and integrate with external systems.

#### Acceptance Criteria

1. THE System SHALL support importing M3U playlists via file upload or URL
2. THE System SHALL validate M3U format and provide detailed error messages for invalid files
3. THE System SHALL support importing channels from JSON format
4. THE System SHALL provide preview of imported channels before committing changes
5. THE System SHALL allow selective import with channel filtering options
6. THE System SHALL export channel lists in M3U, JSON, and CSV formats
7. THE System SHALL include all channel metadata in exports
8. THE System SHALL provide bulk export of user data for GDPR compliance
9. THE System SHALL implement incremental import to update existing channels
10. THE System SHALL log all import and export operations for audit trail

### Requirement 17: Configuration Management

**User Story:** As an administrator, I want centralized configuration management, so that I can customize system behavior without code changes.

#### Acceptance Criteria

1. THE System SHALL provide a configuration interface in the admin panel
2. THE System SHALL allow configuring rate limiting thresholds per endpoint
3. THE System SHALL allow configuring cache TTL values for different data types
4. THE System SHALL allow configuring email templates for notifications
5. THE System SHALL allow configuring OAuth provider settings
6. THE System SHALL allow configuring file upload size limits
7. THE System SHALL allow configuring session timeout duration
8. THE System SHALL validate configuration changes before applying them
9. THE System SHALL provide configuration backup and restore functionality
10. THE System SHALL log all configuration changes with user attribution

### Requirement 18: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can diagnose and fix issues quickly.

#### Acceptance Criteria

1. THE System SHALL implement structured logging with log levels (debug, info, warn, error)
2. THE System SHALL log all API requests with method, path, status code, and response time
3. THE System SHALL log all errors with stack traces and context information
4. THE System SHALL implement error tracking integration (Sentry or similar)
5. THE System SHALL provide log viewing interface in the admin panel
6. THE System SHALL implement log rotation to prevent disk space exhaustion
7. THE System SHALL sanitize sensitive data (passwords, tokens) from logs
8. THE System SHALL provide log filtering and search capabilities
9. THE System SHALL implement alerting for critical errors via email or webhook
10. THE System SHALL include request ID in all logs for request tracing

### Requirement 19: Database Optimization

**User Story:** As a system administrator, I want optimized database performance, so that the system remains responsive under load.

#### Acceptance Criteria

1. THE System SHALL create indexes on frequently queried fields (channelId, userId, isActive)
2. THE System SHALL implement database connection pooling with configurable pool size
3. THE System SHALL use projection to fetch only required fields in queries
4. THE System SHALL implement pagination for all list queries
5. THE System SHALL use aggregation pipelines for complex analytics queries
6. THE System SHALL implement database query monitoring and slow query logging
7. THE System SHALL provide database backup automation with configurable schedule
8. THE System SHALL implement database migration system for schema changes
9. THE System SHALL validate data integrity with schema validation rules
10. THE System SHALL implement soft deletes for channels and users to preserve history

### Requirement 20: Deployment and Infrastructure

**User Story:** As a DevOps engineer, I want modern deployment infrastructure, so that I can deploy updates safely and efficiently.

#### Acceptance Criteria

1. THE System SHALL provide Docker images for all services (API, frontend, Redis)
2. THE System SHALL provide Docker Compose configuration for local development
3. THE System SHALL provide production Docker Compose configuration for Portainer deployment
4. THE System SHALL implement health check endpoints for container orchestration
5. THE System SHALL implement graceful shutdown handling for zero-downtime deployments
6. THE System SHALL provide environment-specific configuration files
7. THE System SHALL implement automated database migrations on deployment
8. THE System SHALL provide rollback capability for failed deployments via Portainer
9. THE System SHALL implement GitHub Actions workflow for automated deployment to Portainer
10. THE System SHALL integrate with Portainer API for stack updates
11. THE System SHALL implement automated SSL certificate renewal
12. THE System SHALL provide monitoring and alerting integration (Prometheus, Grafana)
