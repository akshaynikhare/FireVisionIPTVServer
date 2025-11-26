// Users Management Module
// Handles all user-related operations including CRUD, channel assignment, and playlist code management

// ==================== STATE VARIABLES ====================
let users = [];
let usersDataTable = null;
let assignChannelsDataTable = null;
let currentUserId = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    AdminCore.initPage('users', async () => {
        initializeUserEventListeners();
        await loadUsers();
    });
});

// Initialize event listeners specific to user management
function initializeUserEventListeners() {
    // Add User button
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => openUserModal());
    }

    // Save User button
    const saveUserBtn = document.getElementById('saveUserBtn');
    if (saveUserBtn) {
        saveUserBtn.addEventListener('click', handleUserSubmit);
    }

    // Copy Code button
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', copyPlaylistCode);
    }

    // Regenerate Code button
    const regenerateCodeBtn = document.getElementById('regenerateCodeBtn');
    if (regenerateCodeBtn) {
        regenerateCodeBtn.addEventListener('click', handleRegenerateCode);
    }

    // Save Channels button
    const saveChannelsBtn = document.getElementById('saveChannelsBtn');
    if (saveChannelsBtn) {
        saveChannelsBtn.addEventListener('click', handleSaveChannels);
    }

    // Select All Channels button
    const selectAllChannelsBtn = document.getElementById('selectAllChannelsBtn');
    if (selectAllChannelsBtn) {
        selectAllChannelsBtn.addEventListener('click', selectAllChannels);
    }

    // Deselect All Channels button
    const deselectAllChannelsBtn = document.getElementById('deselectAllChannelsBtn');
    if (deselectAllChannelsBtn) {
        deselectAllChannelsBtn.addEventListener('click', deselectAllChannels);
    }

    // Close user modal
    // Bootstrap 4 handles data-dismiss="modal" automatically
    
    // Close assign channels modal
    // Bootstrap 4 handles data-dismiss="modal" automatically

    // Close modals when clicking outside - Bootstrap handles this automatically
}

// ==================== UTILITY FUNCTIONS ====================

// Format date helper
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Update selected count in assign channels modal
function updateSelectedCount() {
    const count = $('.channel-assign-checkbox:checked').length;
    const selectedCountEl = document.getElementById('selectedCount');
    if (selectedCountEl) {
        selectedCountEl.textContent = `${count} channels selected`;
    }
}

// ==================== LOAD USERS ====================

async function loadUsers() {
    try {
        const loadingEl = document.getElementById('loadingUsers');
        if (loadingEl) {
            loadingEl.classList.remove('hidden');
        }

        const response = await fetch(`${API_BASE}/api/v1/users`, {
            headers: { 'X-Session-Id': getSessionId() }
        });

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const data = await response.json();
        users = data.data || [];

        renderUsersTable(users);
        updateUserStats(users);

        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
        const loadingEl = document.getElementById('loadingUsers');
        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }
    }
}

// ==================== RENDER USERS TABLE ====================

function renderUsersTable(usersToRender) {
    // Wait for jQuery and DataTables to be ready
    if (typeof $ === 'undefined' || typeof $.fn.DataTable === 'undefined') {
        console.log('Waiting for jQuery/DataTables to load...');
        setTimeout(() => renderUsersTable(usersToRender), 100);
        return;
    }

    // Destroy existing DataTable if it exists
    if (usersDataTable) {
        usersDataTable.destroy();
        usersDataTable = null;
    }

    // Initialize DataTable
    usersDataTable = $('#usersTable').DataTable({
        data: usersToRender,
        pageLength: 25,
        deferRender: true,
        order: [[6, 'desc']], // Sort by Last Login descending
        columns: [
            {
                // Username column
                data: 'username',
                render: function(data, type, row) {
                    return `<strong>${data}</strong>`;
                }
            },
            {
                // Email column
                data: 'email'
            },
            {
                // Role column
                data: 'role',
                render: function(data, type, row) {
                    const badge = data === 'Admin' ? 'status-admin' : 'status-user';
                    return `<span class="status-badge ${badge}">${data}</span>`;
                }
            },
            {
                // Playlist Code column
                data: 'playlistCode',
                render: function(data, type, row) {
                    return `<span style="font-weight: bold; letter-spacing: 2px; font-family: monospace;">${data}</span>`;
                }
            },
            {
                // Channels column
                data: 'channels',
                render: function(data, type, row) {
                    if (row.role === 'Admin') {
                        return '<span class="status-badge status-all">All Channels</span>';
                    }
                    return data.length || 0;
                }
            },
            {
                // Status column
                data: 'isActive',
                render: function(data, type, row) {
                    return `<span class="status-badge ${data ? 'status-active' : 'status-inactive'}">${data ? 'Active' : 'Inactive'}</span>`;
                }
            },
            {
                // Last Login column
                data: 'lastLogin',
                render: function(data, type, row) {
                    if (!data) return 'Never';
                    return formatDate(data);
                }
            },
            {
                // Actions column
                data: null,
                orderable: false,
                render: function(data, type, row) {
                    return `
                        <div class="actions">
                            <button class="btn-icon btn-edit-user" data-id="${row._id}" title="Edit">✏️</button>
                            <button class="btn-icon btn-assign-channels" data-id="${row._id}" title="Assign Channels">📋</button>
                            <button class="btn-icon btn-copy-code-user" data-id="${row._id}" title="Copy Code">📋</button>
                            <button class="btn-icon btn-delete-user" data-id="${row._id}" title="Delete">🗑️</button>
                        </div>
                    `;
                }
            }
        ],
        initComplete: function() {
            // Add event listeners for action buttons
            $('#usersTable').on('click', '.btn-edit-user', function() {
                const id = $(this).data('id');
                editUser(id);
            });

            $('#usersTable').on('click', '.btn-assign-channels', function() {
                const id = $(this).data('id');
                openAssignChannelsModal(id);
            });

            $('#usersTable').on('click', '.btn-copy-code-user', function() {
                const id = $(this).data('id');
                const user = users.find(u => u._id === id);
                if (user) {
                    navigator.clipboard.writeText(user.playlistCode);
                    showToast(`Playlist code ${user.playlistCode} copied!`, 'success');
                }
            });

            $('#usersTable').on('click', '.btn-delete-user', function() {
                const id = $(this).data('id');
                deleteUser(id);
            });
        }
    });
}

// ==================== UPDATE USER STATS ====================

function updateUserStats(users) {
    const totalUsersEl = document.getElementById('totalUsers');
    const activeUsersEl = document.getElementById('activeUsers');
    const adminUsersEl = document.getElementById('adminUsers');

    if (totalUsersEl) {
        totalUsersEl.textContent = users.length;
    }
    if (activeUsersEl) {
        activeUsersEl.textContent = users.filter(u => u.isActive).length;
    }
    if (adminUsersEl) {
        adminUsersEl.textContent = users.filter(u => u.role === 'Admin').length;
    }
}

// ==================== USER MODAL (ADD/EDIT) ====================

function openUserModal(userId = null) {
    currentUserId = userId;
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    const passwordHint = document.getElementById('passwordHint');
    const playlistCodeDisplay = document.getElementById('playlistCodeDisplay');

    if (!form) return;

    form.reset();

    if (userId) {
        // Edit mode
        if (title) title.textContent = 'Edit User';
        if (passwordHint) passwordHint.classList.remove('hidden');
        if (playlistCodeDisplay) playlistCodeDisplay.style.display = 'block';

        const user = users.find(u => u._id === userId);
        if (user) {
            const userIdField = document.getElementById('userId');
            const usernameField = document.getElementById('userUsername');
            const emailField = document.getElementById('userEmail');
            const roleField = document.getElementById('userRole');
            const isActiveField = document.getElementById('userIsActive');
            const playlistCodeField = document.getElementById('userPlaylistCode');
            const passwordField = document.getElementById('userPassword');

            if (userIdField) userIdField.value = user._id;
            if (usernameField) usernameField.value = user.username;
            if (emailField) emailField.value = user.email;
            if (roleField) roleField.value = user.role;
            if (isActiveField) isActiveField.checked = user.isActive;
            if (playlistCodeField) playlistCodeField.value = user.playlistCode;
            if (passwordField) passwordField.removeAttribute('required');
        }
    } else {
        // Add mode
        if (title) title.textContent = 'Add User';
        if (passwordHint) passwordHint.classList.add('hidden');
        if (playlistCodeDisplay) playlistCodeDisplay.style.display = 'none';

        const passwordField = document.getElementById('userPassword');
        if (passwordField) passwordField.setAttribute('required', 'required');
    }

    $('#userModal').modal('show');
}

async function handleUserSubmit(e) {
    e.preventDefault();

    const userId = currentUserId;
    const usernameField = document.getElementById('userUsername');
    const emailField = document.getElementById('userEmail');
    const passwordField = document.getElementById('userPassword');
    const roleField = document.getElementById('userRole');
    const isActiveField = document.getElementById('userIsActive');

    if (!usernameField || !emailField || !roleField || !isActiveField) return;

    const username = usernameField.value;
    const email = emailField.value;
    const password = passwordField ? passwordField.value : '';
    const role = roleField.value;
    const isActive = isActiveField.checked;

    const userData = {
        username,
        email,
        role,
        isActive
    };

    // Only send password if it's set (for edit mode)
    if (password) {
        userData.password = password;
    }

    try {
        let response;
        if (userId) {
            // Update user
            response = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': getSessionId()
                },
                body: JSON.stringify(userData)
            });
        } else {
            // Create user
            response = await fetch(`${API_BASE}/api/v1/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': getSessionId()
                },
                body: JSON.stringify(userData)
            });
        }

        const data = await response.json();

        if (data.success) {
            showToast(userId ? 'User updated successfully' : 'User created successfully', 'success');
            closeUserModal();
            loadUsers();
        } else {
            showToast(data.error || 'Failed to save user', 'error');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showToast('Failed to save user', 'error');
    }
}

function closeUserModal() {
    $('#userModal').modal('hide');
    currentUserId = null;
}

// ==================== EDIT USER ====================

function editUser(userId) {
    openUserModal(userId);
}

// ==================== DELETE USER ====================

async function deleteUser(userId) {
    const user = users.find(u => u._id === userId);
    if (!user) return;

    if (!confirm(`Delete user "${user.username}"?`)) return;

    try {
        const response = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
            method: 'DELETE',
            headers: { 'X-Session-Id': getSessionId() }
        });

        const data = await response.json();

        if (data.success) {
            showToast('User deleted successfully', 'success');
            loadUsers();
        } else {
            showToast(data.error || 'Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user', 'error');
    }
}

// ==================== PLAYLIST CODE MANAGEMENT ====================

function copyPlaylistCode() {
    const playlistCodeField = document.getElementById('userPlaylistCode');
    if (playlistCodeField) {
        const code = playlistCodeField.value;
        if (code) {
            navigator.clipboard.writeText(code);
            showToast(`Playlist code ${code} copied!`, 'success');
        }
    }
}

async function handleRegenerateCode() {
    if (!currentUserId) return;

    if (!confirm('Regenerate playlist code? This will invalidate the current code.')) return;

    try {
        const response = await fetch(`${API_BASE}/api/v1/users/${currentUserId}/regenerate-code`, {
            method: 'PUT',
            headers: { 'X-Session-Id': getSessionId() }
        });

        const data = await response.json();

        if (data.success) {
            const playlistCodeField = document.getElementById('userPlaylistCode');
            if (playlistCodeField) {
                playlistCodeField.value = data.data.playlistCode;
            }
            showToast('Playlist code regenerated successfully', 'success');
            loadUsers(); // Refresh table
        } else {
            showToast(data.error || 'Failed to regenerate code', 'error');
        }
    } catch (error) {
        console.error('Error regenerating code:', error);
        showToast('Failed to regenerate code', 'error');
    }
}

// ==================== ASSIGN CHANNELS MODAL ====================

async function openAssignChannelsModal(userId) {
    const user = users.find(u => u._id === userId);
    if (!user) return;

    const assignUserIdField = document.getElementById('assignUserId');
    const assignUserNameField = document.getElementById('assignUserName');

    if (assignUserIdField) assignUserIdField.value = userId;
    if (assignUserNameField) assignUserNameField.textContent = user.username;

    // Load all channels
    try {
        const response = await fetch(`${API_BASE}/api/v1/channels`, {
            headers: { 'X-Session-Id': getSessionId() }
        });
        const data = await response.json();
        const allChannels = data.data || [];

        renderAssignChannelsTable(allChannels, user.channels);

        $('#assignChannelsModal').modal('show');
    } catch (error) {
        console.error('Error loading channels:', error);
        showToast('Failed to load channels', 'error');
    }
}

function renderAssignChannelsTable(allChannels, userChannelIds) {
    // Wait for jQuery and DataTables to be ready
    if (typeof $ === 'undefined' || typeof $.fn.DataTable === 'undefined') {
        console.log('Waiting for jQuery/DataTables to load...');
        setTimeout(() => renderAssignChannelsTable(allChannels, userChannelIds), 100);
        return;
    }

    // Destroy existing DataTable if it exists
    if (assignChannelsDataTable) {
        assignChannelsDataTable.destroy();
        assignChannelsDataTable = null;
    }

    const userChannelSet = new Set(userChannelIds.map(id => id.toString()));

    assignChannelsDataTable = $('#assignChannelsTable').DataTable({
        data: allChannels,
        pageLength: 10,
        deferRender: true,
        order: [[1, 'asc']],
        columns: [
            {
                // Checkbox column
                data: null,
                orderable: false,
                render: function(data, type, row) {
                    const checked = userChannelSet.has(row._id.toString()) ? 'checked' : '';
                    return `<input type="checkbox" class="channel-assign-checkbox" data-id="${row._id}" ${checked}>`;
                }
            },
            {
                // Channel Name column
                data: 'channelName'
            },
            {
                // Channel Group column
                data: 'channelGroup',
                render: function(data, type, row) {
                    return data || 'N/A';
                }
            }
        ]
    });

    updateSelectedCount();

    // Update selected count when checkboxes change
    $('#assignChannelsTable').on('change', '.channel-assign-checkbox', function() {
        updateSelectedCount();
    });

    // Select all checkbox
    $('#selectAllCheck').on('change', function() {
        const isChecked = $(this).is(':checked');
        $('.channel-assign-checkbox').prop('checked', isChecked);
        updateSelectedCount();
    });
}

// ==================== SELECT/DESELECT ALL CHANNELS ====================

function selectAllChannels() {
    $('.channel-assign-checkbox').prop('checked', true);
    $('#selectAllCheck').prop('checked', true);
    updateSelectedCount();
}

function deselectAllChannels() {
    $('.channel-assign-checkbox').prop('checked', false);
    $('#selectAllCheck').prop('checked', false);
    updateSelectedCount();
}

// ==================== SAVE CHANNELS ====================

async function handleSaveChannels() {
    const assignUserIdField = document.getElementById('assignUserId');
    if (!assignUserIdField) return;

    const userId = assignUserIdField.value;
    const selectedChannelIds = [];

    $('.channel-assign-checkbox:checked').each(function() {
        selectedChannelIds.push($(this).data('id'));
    });

    try {
        const response = await fetch(`${API_BASE}/api/v1/users/${userId}/channels`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': getSessionId()
            },
            body: JSON.stringify({ channelIds: selectedChannelIds })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Assigned ${selectedChannelIds.length} channels successfully`, 'success');
            $('#assignChannelsModal').modal('hide');
            loadUsers(); // Refresh users table
        } else {
            showToast(data.error || 'Failed to assign channels', 'error');
        }
    } catch (error) {
        console.error('Error assigning channels:', error);
        showToast('Failed to assign channels', 'error');
    }
}
