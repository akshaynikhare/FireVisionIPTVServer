// Common utilities for user pages

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

// Check Authentication with caching (for regular users)
async function checkAuth(forceRefresh = false) {
    const sessionId = getSessionId();

    if (!sessionId) {
        window.location.href = '/user/login.html';
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
            removeSessionId();
            window.location.href = '/user/login.html';
            return null;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        removeSessionId();
        window.location.href = '/user/login.html';
        return null;
    }
}

// Update sidebar with user info
function updateSidebar(user, activePage) {
    const loggedInUser = document.getElementById('loggedInUser');
    if (loggedInUser) loggedInUser.textContent = user.username;

    // Set channel list code
    const channelListCode = document.getElementById('sidebarChannelListCode');
    if (channelListCode) {
        channelListCode.textContent = user.channelListCode || 'N/A';
    }

    // Set sidebar profile picture or initials
    const profilePic = document.getElementById('sidebarProfilePicture');
    const profilePlaceholder = document.getElementById('sidebarProfilePlaceholder');
    const profileInitials = document.getElementById('sidebarProfileInitials');

    if (profilePic && profilePlaceholder) {
        if (user.profilePicture) {
            profilePic.src = API_BASE + user.profilePicture;
            profilePic.classList.remove('d-none');
            profilePic.classList.remove('hidden');
            profilePlaceholder.classList.add('d-none');
            profilePlaceholder.classList.add('hidden');
        } else {
            const initials = user.username ? user.username.substring(0, 2).toUpperCase() : 'U';
            if (profileInitials) profileInitials.textContent = initials;
            profilePic.classList.add('d-none');
            profilePic.classList.add('hidden');
            profilePlaceholder.classList.remove('d-none');
            profilePlaceholder.classList.remove('hidden');
        }
    }

    // Set active navigation item
    const navLinks = document.querySelectorAll('.nav-sidebar .nav-link, nav a[data-page]');
    navLinks.forEach(link => {
        let page = link.dataset.page;
        if (!page && link.getAttribute('href')) {
            const href = link.getAttribute('href');
            page = href.split('/').pop().replace('.html', '');
        }
        
        if (page === activePage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
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

// Show dashboard
function showDashboard(user, activePage) {
    const dashboardScreen = document.getElementById('dashboardScreen');
    if (dashboardScreen) {
        dashboardScreen.classList.add('active');
    }

    requestAnimationFrame(() => {
        updateSidebar(user, activePage);
    });
}

// Logout handler for user pages
async function handleLogout(event) {
    if (event) {
        event.preventDefault();
    }
    
    const sessionId = getSessionId();

    try {
        const response = await fetch(`${API_BASE}/api/v1/auth/logout`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId 
            }
        });
        
        if (!response.ok) {
            console.warn('Logout request failed:', response.status);
        }
    } catch (error) {
        console.error('Logout error:', error);
    }

    // Clear session and redirect regardless of API response
    removeSessionId();
    cachedUser = null;
    cacheTimestamp = 0;
    window.location.href = '/user/login.html';
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
        // Remove any existing listeners
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        
        // Add click handler
        newLogoutBtn.addEventListener('click', handleLogout);
    }
}

// Initialize common functionality on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeLogout();
});
