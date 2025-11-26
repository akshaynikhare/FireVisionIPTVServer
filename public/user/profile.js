// User Profile Page
(async function() {
    const API_BASE = window.location.origin;
    const getSessionId = () => localStorage.getItem('sessionId');

    // Check auth and load page
    const user = await checkAuth();
    if (!user) return;
    
    showDashboard(user, 'profile');
    
    let currentUser = user;

    // Initialize
    loadProfile();
    initializeEventListeners();

    function initializeEventListeners() {
        document.getElementById('profileForm')?.addEventListener('submit', handleProfileUpdate);
        document.getElementById('passwordForm')?.addEventListener('submit', handlePasswordChange);
        document.getElementById('copyCodeBtn')?.addEventListener('click', copyChannelListCode);
        document.getElementById('regenerateCodeBtn')?.addEventListener('click', showRegenerateModal);
        document.getElementById('confirmRegenerateBtn')?.addEventListener('click', confirmRegenerateCode);
        document.getElementById('editProfileBtn')?.addEventListener('click', showEditMode);
        document.getElementById('cancelEditBtn')?.addEventListener('click', showViewMode);
        document.getElementById('changePasswordBtn')?.addEventListener('click', showPasswordEditMode);
        document.getElementById('cancelPasswordBtn')?.addEventListener('click', showPasswordViewMode);
    }

    function showEditMode() {
        document.getElementById('profileViewCard').style.display = 'none';
        document.getElementById('profileEditCard').style.display = 'block';
    }

    function showViewMode() {
        document.getElementById('profileViewCard').style.display = 'block';
        document.getElementById('profileEditCard').style.display = 'none';
    }

    function showPasswordEditMode() {
        document.getElementById('passwordViewCard').style.display = 'none';
        document.getElementById('passwordEditCard').style.display = 'block';
    }

    function showPasswordViewMode() {
        document.getElementById('passwordViewCard').style.display = 'block';
        document.getElementById('passwordEditCard').style.display = 'none';
        // Clear the form
        document.getElementById('passwordForm').reset();
    }

    async function loadProfile() {
        try {
            // Refresh user data
            const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
                headers: { 'X-Session-Id': getSessionId() }
            });
            const data = await response.json();
            currentUser = data.user;

            // Update profile display
            updateProfileDisplay(currentUser);

            // Load channel count
            const channelsResponse = await fetch(`${API_BASE}/api/v1/user-playlist/me/channels`, {
                headers: { 'X-Session-Id': getSessionId() }
            });
            const channelsData = await channelsResponse.json();
            document.getElementById('profileChannelCount').textContent = channelsData.channels?.length || 0;

        } catch (error) {
            console.error('Error loading profile:', error);
            showToast('Error loading profile data', 'error');
        }
    }

    function updateProfileDisplay(user) {
        // Profile card - Username and email
        document.getElementById('profileUsername').textContent = user.username;
        document.getElementById('profileEmail').textContent = user.email || 'No email set';
        
        // Role
        document.getElementById('profileRole').textContent = user.role === 'admin' ? 'Administrator' : 'User';
        
        // Channel List Code
        document.getElementById('profileChannelListCode').value = user.channelListCode || 'N/A';
        
        // Profile picture or initials
        const profilePic = document.getElementById('profilePicture');
        const profilePlaceholder = document.getElementById('profilePlaceholder');
        const profileInitials = document.getElementById('profileInitials');

        if (user.profilePicture) {
            profilePic.src = API_BASE + user.profilePicture;
            profilePic.classList.remove('d-none');
            profilePlaceholder.classList.add('d-none');
        } else {
            const initials = user.username ? user.username.substring(0, 2).toUpperCase() : 'U';
            profileInitials.textContent = initials;
            profilePic.classList.add('d-none');
            profilePlaceholder.classList.remove('d-none');
        }

        // View mode - Profile information
        document.getElementById('viewUsername').textContent = user.username;
        document.getElementById('viewEmail').textContent = user.email || 'Not set';
        
        const viewProfilePicture = document.getElementById('viewProfilePicture');
        if (user.profilePicture) {
            viewProfilePicture.innerHTML = `<a href="${API_BASE + user.profilePicture}" target="_blank">${user.profilePicture}</a>`;
        } else {
            viewProfilePicture.innerHTML = '<span class="text-muted">Not set</span>';
        }
        
        // Format creation date
        if (user.createdAt) {
            const date = new Date(user.createdAt);
            document.getElementById('viewCreatedAt').textContent = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }

        // Edit form - Populate fields
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editProfilePicture').value = user.profilePicture || '';
    }

    async function handleProfileUpdate(e) {
        e.preventDefault();

        const profileData = {
            username: document.getElementById('editUsername').value,
            email: document.getElementById('editEmail').value,
            profilePicture: document.getElementById('editProfilePicture').value || undefined
        };

        try {
            const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': getSessionId()
                },
                body: JSON.stringify(profileData)
            });

            const data = await response.json();

            if (data.success) {
                showToast('Profile updated successfully');
                await loadProfile();
                // Update cached user in common.js
                await checkAuth(true);
                // Switch back to view mode
                showViewMode();
            } else {
                showToast(data.error || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('Error updating profile', 'error');
        }
    }

    async function handlePasswordChange(e) {
        e.preventDefault();

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/v1/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': getSessionId()
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast('Password changed successfully');
                document.getElementById('passwordForm').reset();
            } else {
                showToast(data.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            showToast('Error changing password', 'error');
        }
    }

    function copyChannelListCode() {
        const codeInput = document.getElementById('profileChannelListCode');
        const code = codeInput.value;
        
        if (!code || code === 'N/A') {
            showToast('No channel list code available', 'error');
            return;
        }

        // Select and copy
        codeInput.select();
        codeInput.setSelectionRange(0, 99999); // For mobile
        
        navigator.clipboard.writeText(code).then(() => {
            showToast('Channel list code copied to clipboard');
            // Change button icon temporarily
            const btn = document.getElementById('copyCodeBtn');
            const icon = btn.querySelector('i');
            icon.className = 'fas fa-check';
            setTimeout(() => {
                icon.className = 'fas fa-copy';
            }, 2000);
        }).catch(() => {
            showToast('Failed to copy code', 'error');
        });
    }

    function showRegenerateModal() {
        $('#regenerateCodeModal').modal('show');
    }

    async function confirmRegenerateCode() {
        // Close the modal
        $('#regenerateCodeModal').modal('hide');

        try {
            const response = await fetch(`${API_BASE}/api/v1/auth/regenerate-channel-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': getSessionId()
                }
            });

            const data = await response.json();

            if (data.success) {
                showToast('Channel list code regenerated successfully! Update this code on your TV.');
                await loadProfile();
                // Update cached user
                await checkAuth(true);
            } else {
                showToast(data.error || 'Failed to regenerate code', 'error');
            }
        } catch (error) {
            console.error('Error regenerating code:', error);
            showToast('Error regenerating code', 'error');
        }
    }

})();
