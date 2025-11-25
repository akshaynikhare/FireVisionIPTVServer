// Common utilities and shared functionality for admin pages

// API Configuration
const API_BASE = window.location.origin;

// Get session ID from localStorage
function getSessionId() {
    return localStorage.getItem('sessionId');
}

// Set session ID to localStorage
function setSessionId(sessionId) {
    localStorage.setItem('sessionId', sessionId);
}

// Remove session ID from localStorage
function removeSessionId() {
    localStorage.removeItem('sessionId');
}

// Show toast notification
function showToast(message, duration = 3000) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Cache user data to avoid repeated auth checks
let cachedUser = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 1 minute

// Check Authentication with caching
async function checkAuth(forceRefresh = false) {
    const sessionId = getSessionId();

    if (!sessionId) {
        window.location.href = '/admin/';
        return null;
    }

    // Return cached user if available and not expired
    const now = Date.now();
    if (!forceRefresh && cachedUser && (now - cacheTimestamp < CACHE_DURATION)) {
        return cachedUser;
    }

    try {
        const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
            headers: { 'X-Session-Id': sessionId }
        });

        if (response.ok) {
            const data = await response.json();
            cachedUser = data.user;
            cacheTimestamp = now;
            return data.user;
        } else {
            window.location.href = '/admin/';
            return null;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/admin/';
        return null;
    }
}

// Update sidebar with user info
function updateSidebar(user, activePage) {
    document.getElementById('loggedInUser').textContent = user.username;
    document.getElementById('loggedInUserRole').textContent = user.role || 'User';

    // Set sidebar profile picture or initials
    if (user.profilePicture) {
        document.getElementById('sidebarProfilePicture').src = API_BASE + user.profilePicture;
        document.getElementById('sidebarProfilePicture').classList.remove('hidden');
        document.getElementById('sidebarProfilePlaceholder').classList.add('hidden');
    } else {
        const initials = user.username ? user.username.substring(0, 2).toUpperCase() : 'U';
        document.getElementById('sidebarProfileInitials').textContent = initials;
        document.getElementById('sidebarProfilePicture').classList.add('hidden');
        document.getElementById('sidebarProfilePlaceholder').classList.remove('hidden');
    }

    // Hide Users tab for non-admin users
    if (user.role !== 'Admin') {
        const usersNavLink = document.getElementById('usersNavLink');
        if (usersNavLink) {
            usersNavLink.style.display = 'none';
        }
    }

    // Set active navigation item
    document.querySelectorAll('nav a[data-page]').forEach(link => {
        if (link.dataset.page === activePage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Set profile button active state
    const profileLink = document.querySelector('.user-profile-section');
    if (activePage === 'profile' && profileLink) {
        profileLink.classList.add('active');
    } else if (profileLink) {
        profileLink.classList.remove('active');
    }
}

// Show/hide top loading bar
function showLoadingBar() {
    let loadingBar = document.getElementById('topLoadingBar');
    if (!loadingBar) {
        loadingBar = document.createElement('div');
        loadingBar.id = 'topLoadingBar';
        loadingBar.className = 'top-loading-bar';
        document.body.appendChild(loadingBar);
    }

    // Trigger animation immediately
    requestAnimationFrame(() => {
        loadingBar.classList.add('loading');
    });
}

function hideLoadingBar() {
    const loadingBar = document.getElementById('topLoadingBar');
    if (loadingBar) {
        loadingBar.style.width = '100%';
        loadingBar.classList.remove('loading');
        setTimeout(() => {
            loadingBar.remove();
        }, 300);
    }
}

// Show dashboard (instant transition, no splash screen)
function showDashboard(user, activePage) {
    // Show dashboard immediately for instant feedback
    const dashboardScreen = document.getElementById('dashboardScreen');
    if (dashboardScreen) {
        dashboardScreen.classList.add('active');
    }

    // Update sidebar asynchronously
    requestAnimationFrame(() => {
        updateSidebar(user, activePage);
        // Keep loading bar visible until page-specific data loads
        // It will be hidden by the page after data loads
    });
}

// Logout handler
async function handleLogout() {
    const sessionId = getSessionId();

    try {
        await fetch(`${API_BASE}/api/v1/auth/logout`, {
            method: 'POST',
            headers: { 'X-Session-Id': sessionId }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    removeSessionId();
    window.location.href = '/admin/';
}

// Image proxy helper function
function getProxiedImageUrl(imageUrl) {
    if (!imageUrl || imageUrl.startsWith('data:')) {
        return imageUrl;
    }
    return `${API_BASE}/api/v1/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

// Default placeholder images
const DEFAULT_LOGO = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%3E%3Crect%20width%3D%2240%22%20height%3D%2240%22%20fill%3D%22%23ddd%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%20fill%3D%22%23999%22%3E%3F%3C%2Ftext%3E%3C%2Fsvg%3E';
const DEFAULT_LOGO_LARGE = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20fill%3D%22%23ddd%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%20fill%3D%22%23999%22%3E%3F%3C%2Ftext%3E%3C%2Fsvg%3E';

// Sequential Image Loading Function
function loadImagesSequentially(tableSelector) {
    const containers = document.querySelectorAll(`${tableSelector} .img-loading-container`);
    let currentIndex = 0;

    function loadNextImage() {
        if (currentIndex >= containers.length) {
            return;
        }

        const container = containers[currentIndex];
        const img = container.querySelector('img');
        const imgSrc = container.getAttribute('data-img-src');

        if (!imgSrc) {
            currentIndex++;
            loadNextImage();
            return;
        }

        if (imgSrc.startsWith('data:')) {
            img.src = imgSrc;
            container.classList.add('loaded');
            currentIndex++;
            loadNextImage();
            return;
        }

        img.onload = function() {
            container.classList.add('loaded');
            currentIndex++;
            setTimeout(loadNextImage, 50);
        };

        img.onerror = function() {
            img.src = DEFAULT_LOGO;
            container.classList.add('loaded');
            currentIndex++;
            setTimeout(loadNextImage, 50);
        };

        img.src = imgSrc;
    }

    loadNextImage();
}

// Initialize logout button
function initializeLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Initialize common functionality on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeLogout();
});
