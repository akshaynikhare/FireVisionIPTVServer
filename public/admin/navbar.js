/**
 * Common Navbar Component
 * Loads and injects the navbar from navbar.html template
 */

(function() {
    'use strict';

    // Function to load and inject navbar
    async function loadNavbar() {
        try {
            const response = await fetch('navbar.html');
            if (!response.ok) throw new Error('Failed to load navbar');
            
            const navbarHTML = await response.text();
            
            const navbarPlaceholder = document.getElementById('navbar-placeholder');
            if (navbarPlaceholder) {
                navbarPlaceholder.innerHTML = navbarHTML;
            } else {
                // If no placeholder, inject after .wrapper opening
                const wrapper = document.querySelector('.wrapper');
                if (wrapper && !wrapper.querySelector('.main-header')) {
                    wrapper.insertAdjacentHTML('afterbegin', navbarHTML);
                }
            }
        } catch (error) {
            console.error('Error loading navbar:', error);
        }
    }

    // Auto-load on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadNavbar);
    } else {
        loadNavbar();
    }
})();
