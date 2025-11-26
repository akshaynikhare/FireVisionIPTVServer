// AdminCore: Shared initialization & utilities to reduce duplication across admin pages
// Depends on functions defined in common.js (loaded after this file)

window.AdminCore = (function() {
    const API_BASE = window.location.origin;

    function initPage(pageName, pageInitFn) {
        // Show global loading bar if available
        if (typeof showLoadingBar === 'function') {
            showLoadingBar();
        }

        // Auth check + dashboard bootstrap
        Promise.resolve()
            .then(() => (typeof checkAuth === 'function' ? checkAuth() : null))
            .then(user => {
                if (!user) return null; // redirected by checkAuth
                if (typeof showDashboard === 'function') {
                    showDashboard(user, pageName);
                }
                return Promise.resolve(pageInitFn ? pageInitFn(user) : null);
            })
            .catch(err => console.error(`[AdminCore] initPage error (${pageName}):`, err))
            .finally(() => {
                if (typeof hideLoadingBar === 'function') {
                    hideLoadingBar();
                }
            });
    }

    // Apply global DataTables defaults once jQuery is ready
    function applyDataTableDefaults(retries = 40) {
        if (window.jQuery && jQuery.fn && jQuery.fn.dataTable) {
            jQuery.extend(jQuery.fn.dataTable.defaults, {
                pageLength: 25,
                lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
                language: { search: 'Filter:' }
            });
            return;
        }
        if (retries > 0) {
            setTimeout(() => applyDataTableDefaults(retries - 1), 125);
        }
    }

    // Logout helper (wraps existing handleLogout)
    function logout() {
        if (typeof handleLogout === 'function') {
            handleLogout();
        } else {
            // Fallback: remove sessionId and redirect
            localStorage.removeItem('sessionId');
            window.location.href = '/admin/';
        }
    }

    // Initialize sidebar / nav state manually if needed
    function setActiveNav(pageName) {
        document.querySelectorAll('.nav-sidebar .nav-link').forEach(link => {
            if (link.getAttribute('href') && link.getAttribute('href').includes(pageName + '.html')) {
                link.classList.add('active');
            } else if (!link.classList.contains('text-danger')) {
                link.classList.remove('active');
            }
        });
    }

    // Auto-run DataTables defaults
    applyDataTableDefaults();

    // Centralized sequential image loader (moved from common.js)
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
                img.src = window.DEFAULT_LOGO || '';
                container.classList.add('loaded');
                currentIndex++;
                setTimeout(loadNextImage, 50);
            };

            img.src = imgSrc;
        }

        loadNextImage();
    }

    // Unified toast + error handler wrappers
    function toast(message, duration = 3000) {
        if (typeof showToast === 'function') {
            showToast(message, duration);
        } else {
            console.log('[Toast]', message);
        }
    }

    function handleError(context, error, userMessage = 'An unexpected error occurred') {
        console.error(`[AdminCore] ${context} error:`, error);
        toast(userMessage, 4000);
    }

    return {
        API_BASE,
        initPage,
        applyDataTableDefaults,
        logout,
        setActiveNav,
        loadImagesSequentially,
        toast,
        handleError
    };
})();

// Example usage pattern (not executed automatically):
// AdminCore.initPage('channels', async (user) => { /* load data */ });