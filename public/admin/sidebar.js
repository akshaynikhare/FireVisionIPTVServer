/**
 * Common Sidebar Component
 * Loads and injects the sidebar from sidebar.html template
 * Automatically highlights the active menu item based on current page
 */

(function() {
    'use strict';

    // Function to get current page name
    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);
        return filename.replace('.html', '') || 'channels';
    }

    // Function to set active menu item
    function setActiveMenuItem() {
        const currentPage = getCurrentPage();
        const menuLinks = document.querySelectorAll('.nav-sidebar .nav-link[data-page]');
        
        menuLinks.forEach(link => {
            const page = link.getAttribute('data-page');
            if (page === currentPage) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // Function to load and inject sidebar
    async function loadSidebar() {
        try {
            const response = await fetch('sidebar.html');
            if (!response.ok) throw new Error('Failed to load sidebar');
            
            const sidebarHTML = await response.text();
            
            const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
            if (sidebarPlaceholder) {
                sidebarPlaceholder.innerHTML = sidebarHTML;
            } else {
                // If no placeholder, inject after navbar
                const wrapper = document.querySelector('.wrapper');
                const navbar = document.querySelector('.main-header');
                if (wrapper && navbar && !wrapper.querySelector('.main-sidebar')) {
                    navbar.insertAdjacentHTML('afterend', sidebarHTML);
                }
            }
            
            // Set active menu item after injection
            setTimeout(setActiveMenuItem, 0);
        } catch (error) {
            console.error('Error loading sidebar:', error);
        }
    }

    // Auto-load on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadSidebar);
    } else {
        loadSidebar();
    }
})();
