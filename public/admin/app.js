// API Configuration
const API_BASE = window.location.origin;
let sessionId = localStorage.getItem('sessionId');
let currentView = 'channels';
let channels = [];
let iptvOrgChannels = [];
let selectedChannels = new Set();
let selectedIptvOrgChannels = new Set();
let channelsDataTable = null;
let iptvOrgDataTable = null;
let currentChannelDetail = null;
let hlsInstance = null;

// Image proxy helper function
function getProxiedImageUrl(imageUrl) {
    if (!imageUrl || imageUrl.startsWith('data:')) {
        return imageUrl;
    }
    return `${API_BASE}/api/v1/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

// Default placeholder images - properly encoded SVG data URIs
const DEFAULT_LOGO = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%3E%3Crect%20width%3D%2240%22%20height%3D%2240%22%20fill%3D%22%23ddd%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%20fill%3D%22%23999%22%3E%3F%3C%2Ftext%3E%3C%2Fsvg%3E';
const DEFAULT_LOGO_LARGE = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20fill%3D%22%23ddd%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%20fill%3D%22%23999%22%3E%3F%3C%2Ftext%3E%3C%2Fsvg%3E';

// Show toast notification
function showToast(message, duration = 3000) {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove toast after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initializeEventListeners();
});

// Check Authentication
async function checkAuth() {
    if (sessionId) {
        try {
            const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const data = await response.json();
                showDashboard(data.user);
                return;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        }
    }

    showLogin();
}

function showLogin() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('dashboardScreen').classList.remove('active');
}

function showDashboard(user) {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('dashboardScreen').classList.add('active');
    document.getElementById('loggedInUser').textContent = user.username;

    loadChannels();
    loadStats();
}

// Event Listeners
function initializeEventListeners() {
    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Navigation
    document.querySelectorAll('[data-view]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(e.target.dataset.view);
        });
    });

    // Add Channel
    document.getElementById('addChannelBtn').addEventListener('click', () => openChannelModal());

    // Channel Form
    document.getElementById('channelForm').addEventListener('submit', handleChannelSubmit);
    document.getElementById('cancelBtn').addEventListener('click', closeChannelModal);

    // Close buttons for channelModal
    document.querySelectorAll('[data-close="channelModal"]').forEach(btn => {
        btn.addEventListener('click', closeChannelModal);
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Bulk actions
    document.getElementById('selectAll').addEventListener('change', handleSelectAll);
    document.getElementById('bulkDeleteBtn').addEventListener('click', handleBulkDelete);
    document.getElementById('bulkTestBtn').addEventListener('click', handleBulkTest);

    // IPTV-org
    document.getElementById('iptvOrgSearch').addEventListener('input', handleIptvOrgSearch);
    document.getElementById('selectAllIptvOrg').addEventListener('click', selectAllIptvOrg);
    document.getElementById('deselectAllIptvOrg').addEventListener('click', deselectAllIptvOrg);
    document.getElementById('importSelectedBtn').addEventListener('click', handleImportSelected);
    document.getElementById('selectAllIptvOrgCheckbox').addEventListener('change', handleSelectAllIptvOrg);

    // Quick filters
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            loadQuickFilter(filter);
        });
    });

    // Channel details modal
    document.getElementById('detailPreviewBtn').addEventListener('click', handleDetailPreview);

    // Test
    document.getElementById('testAllChannelsBtn').addEventListener('click', () => testChannels('all'));
    document.getElementById('testSelectedChannelsBtn').addEventListener('click', () => testChannels('selected'));
}

// Sequential Image Loading Function
function loadImagesSequentially(tableSelector) {
    const containers = document.querySelectorAll(`${tableSelector} .img-loading-container`);
    let currentIndex = 0;

    function loadNextImage() {
        if (currentIndex >= containers.length) {
            return; // All images loaded
        }

        const container = containers[currentIndex];
        const img = container.querySelector('img');
        const imgSrc = container.getAttribute('data-img-src');

        if (!imgSrc) {
            currentIndex++;
            loadNextImage();
            return;
        }

        // Check if it's a data URI (placeholder) - load instantly
        if (imgSrc.startsWith('data:')) {
            img.src = imgSrc;
            container.classList.add('loaded');
            currentIndex++;
            loadNextImage();
            return;
        }

        // Load actual image
        img.onload = function() {
            container.classList.add('loaded');
            currentIndex++;
            // Small delay before loading next image to avoid overwhelming the server
            setTimeout(loadNextImage, 50);
        };

        img.onerror = function() {
            // Fallback to placeholder on error
            img.src = DEFAULT_LOGO;
            container.classList.add('loaded');
            currentIndex++;
            setTimeout(loadNextImage, 50);
        };

        img.src = imgSrc;
    }

    // Start loading from the first image
    loadNextImage();
}

// Login Handler
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            sessionId = data.sessionId;
            localStorage.setItem('sessionId', sessionId);
            showDashboard(data.user);
        } else {
            errorDiv.textContent = data.error || 'Login failed';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error';
        errorDiv.classList.remove('hidden');
    }
}

// Logout Handler
async function handleLogout() {
    try {
        await fetch(`${API_BASE}/api/v1/auth/logout`, {
            method: 'POST',
            headers: { 'X-Session-Id': sessionId }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    localStorage.removeItem('sessionId');
    sessionId = null;
    showLogin();
}

// View Switcher
function switchView(view) {
    currentView = view;

    // Update nav
    document.querySelectorAll('[data-view]').forEach(link => {
        link.classList.toggle('active', link.dataset.view === view);
    });

    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });

    // Convert hyphenated view name to camelCase for ID (e.g., 'iptv-org' -> 'iptvOrg')
    const viewId = view.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    const viewElement = document.getElementById(`${viewId}View`);

    if (viewElement) {
        viewElement.classList.add('active');
    } else {
        console.error(`View element not found: ${viewId}View`);
    }

    // Load view data
    switch(view) {
        case 'channels':
            loadChannels();
            break;
        case 'iptv-org':
            loadIptvOrgPlaylists();
            break;
        case 'test':
            loadTestResults();
            break;
        case 'stats':
            loadStats();
            break;
    }
}

// Load Channels
async function loadChannels() {
    try {
        document.getElementById('loadingChannels').classList.remove('hidden');

        const response = await fetch(`${API_BASE}/api/v1/channels`);
        const data = await response.json();

        channels = data.data;
        renderChannelsTable(channels);
        updateChannelStats(channels);

        document.getElementById('loadingChannels').classList.add('hidden');
    } catch (error) {
        console.error('Error loading channels:', error);
        alert('Failed to load channels');
    }
}

// Render Channels Table with DataTables
function renderChannelsTable(channelsToRender) {
    // Wait for jQuery to be ready
    if (typeof $ === 'undefined' || typeof $.fn.DataTable === 'undefined') {
        console.log('Waiting for jQuery/DataTables to load...');
        setTimeout(() => renderChannelsTable(channelsToRender), 100);
        return;
    }

    // Destroy existing DataTable if it exists
    if (channelsDataTable) {
        channelsDataTable.destroy();
        channelsDataTable = null;
    }

    // Initialize DataTable
    channelsDataTable = $('#channelsTable').DataTable({
        data: channelsToRender,
        pageLength: 25,
        lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
        order: [[2, 'asc']], // Sort by Name column
        columns: [
            {
                // Checkbox column
                data: null,
                orderable: false,
                searchable: false,
                render: function(data, type, row) {
                    return `<input type="checkbox" class="channel-select" data-id="${row._id}">`;
                }
            },
            {
                // Logo column
                data: 'channelImg',
                orderable: false,
                render: function(data, type, row) {
                    const logoUrl = data ? getProxiedImageUrl(data) : DEFAULT_LOGO;
                    const uniqueId = `img-${row._id || Math.random().toString(36).substring(2, 11)}`;
                    // Don't set src yet - will be loaded sequentially
                    return `<div class="img-loading-container" data-img-src="${logoUrl}" id="${uniqueId}"><img class="channel-logo" alt="${row.channelName}"></div>`;
                }
            },
            {
                // Name column
                data: 'channelName',
                render: function(data, type, row) {
                    return `<strong>${data}</strong>`;
                }
            },
            {
                // Group column
                data: 'channelGroup',
                render: function(data, type, row) {
                    return data || 'N/A';
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
                // Test Status column
                data: null,
                render: function(data, type, row) {
                    // Show loading spinner if currently testing
                    if (row.metadata?.isTesting) {
                        return '<span class="status-badge status-testing"><span class="spinner"></span> Testing...</span>';
                    }

                    if (row.metadata?.isWorking === undefined) {
                        return '<span class="status-badge status-untested">⏸️ Not Tested</span>';
                    }
                    return row.metadata.isWorking
                        ? '<span class="status-badge status-working">✓ Working</span>'
                        : '<span class="status-badge status-not-working">✗ Not Working</span>';
                }
            },
            {
                // URL column (hidden)
                data: 'channelUrl',
                visible: false,
                render: function(data, type, row) {
                    return data;
                }
            },
            {
                // Actions column
                data: null,
                orderable: false,
                searchable: false,
                render: function(data, type, row) {
                    return `
                        <div class="actions">
                            <button class="btn-icon btn-edit" data-id="${row._id}" title="Edit">✏️</button>
                            <button class="btn-icon btn-delete" data-id="${row._id}" title="Delete">🗑️</button>
                            <button class="btn-icon btn-test" data-id="${row._id}" title="Test">🔍</button>
                            <button class="btn-icon btn-play" data-id="${row._id}" title="Play">▶️</button>
                            <button class="btn-icon btn-copy-link" data-id="${row._id}" title="Copy Link">🔗</button>
                        </div>
                    `;
                }
            }
        ],
        initComplete: function() {
            // Add column search filters
            this.api().columns([2, 3]).every(function() {
                const column = this;
                const header = $(column.header());

                // Check if search input already exists
                if (header.find('input').length > 0) {
                    return;
                }

                const title = header.text().trim();

                const input = $('<input type="text" placeholder="Search ' + title + '" />')
                    .appendTo(header)
                    .on('click', function(e) {
                        e.stopPropagation();
                    })
                    .on('keyup change clear', function() {
                        if (column.search() !== this.value) {
                            column.search(this.value).draw();
                        }
                    });
            });

            // Add event listeners for action buttons
            $('#channelsTable').on('click', '.btn-edit', function() {
                const id = $(this).data('id');
                editChannel(id);
            });

            $('#channelsTable').on('click', '.btn-delete', function() {
                const id = $(this).data('id');
                deleteChannel(id);
            });

            $('#channelsTable').on('click', '.btn-test', function() {
                const id = $(this).data('id');
                testSingleChannel(id);
            });

            $('#channelsTable').on('click', '.btn-play', function() {
                const id = $(this).data('id');
                const channel = channelsToRender.find(c => c._id === id);
                if (channel) {
                    playChannel(channel);
                }
            });

            $('#channelsTable').on('click', '.btn-copy-link', function() {
                const id = $(this).data('id');
                const channel = channelsToRender.find(c => c._id === id);
                if (channel) {
                    copyChannelLink(channel);
                }
            });

            // Add event listeners to checkboxes
            $('#channelsTable').on('change', '.channel-select', function() {
                const id = $(this).data('id');
                if ($(this).is(':checked')) {
                    selectedChannels.add(id);
                } else {
                    selectedChannels.delete(id);
                }
            });

            // Add row click handler to show channel details
            $('#channelsTable tbody').on('click', 'tr', function(e) {
                // Don't trigger if clicking checkbox or buttons
                if ($(e.target).is('input, button, .btn-icon')) {
                    return;
                }

                const rowData = channelsDataTable.row(this).data();
                if (rowData) {
                    showChannelDetails(rowData);
                }
            });

            // Load images sequentially
            loadImagesSequentially('#channelsTable');
        }
    });
}

// Update Channel Stats
function updateChannelStats(channels) {
    document.getElementById('totalChannels').textContent = channels.length;
    document.getElementById('activeChannels').textContent = channels.filter(c => c.isActive).length;

    const working = channels.filter(c => c.metadata?.isWorking === true).length;
    document.getElementById('workingChannels').textContent = working || '-';

    const groups = new Set(channels.map(c => c.channelGroup));
    document.getElementById('totalGroups').textContent = groups.size;
}

// Channel Modal
function openChannelModal(channel = null) {
    const modal = document.getElementById('channelModal');
    const title = document.getElementById('modalTitle');

    if (channel) {
        title.textContent = 'Edit Channel';
        document.getElementById('channelIdHidden').value = channel._id;
        document.getElementById('channelId').value = channel.channelId;
        document.getElementById('channelName').value = channel.channelName;
        document.getElementById('channelUrl').value = channel.channelUrl;
        document.getElementById('channelImg').value = channel.channelImg || '';
        document.getElementById('channelGroup').value = channel.channelGroup || '';
        document.getElementById('isActive').checked = channel.isActive;
    } else {
        title.textContent = 'Add Channel';
        document.getElementById('channelForm').reset();
        document.getElementById('channelIdHidden').value = '';
    }

    modal.classList.add('active');
}

function closeChannelModal() {
    document.getElementById('channelModal').classList.remove('active');
}

// Handle Channel Submit
async function handleChannelSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('channelIdHidden').value;
    const channelData = {
        channelId: document.getElementById('channelId').value,
        channelName: document.getElementById('channelName').value,
        channelUrl: document.getElementById('channelUrl').value,
        channelImg: document.getElementById('channelImg').value,
        channelGroup: document.getElementById('channelGroup').value,
        isActive: document.getElementById('isActive').checked
    };

    try {
        const url = id
            ? `${API_BASE}/api/v1/admin/channels/${id}`
            : `${API_BASE}/api/v1/admin/channels`;

        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify(channelData)
        });

        const data = await response.json();

        if (data.success) {
            closeChannelModal();
            loadChannels();
        } else {
            alert(data.error || 'Failed to save channel');
        }
    } catch (error) {
        console.error('Error saving channel:', error);
        alert('Failed to save channel');
    }
}

// Edit Channel
async function editChannel(id) {
    const channel = channels.find(c => c._id === id);
    if (channel) {
        openChannelModal(channel);
    }
}

// Delete Channel
async function deleteChannel(id) {
    if (!confirm('Are you sure you want to delete this channel?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/channels/${id}`, {
            method: 'DELETE',
            headers: { 'X-Session-Id': sessionId }
        });

        const data = await response.json();

        if (data.success) {
            loadChannels();
        } else {
            alert(data.error || 'Failed to delete channel');
        }
    } catch (error) {
        console.error('Error deleting channel:', error);
        alert('Failed to delete channel');
    }
}

// Search Channels
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const filtered = channels.filter(c =>
        c.channelName.toLowerCase().includes(query) ||
        c.channelGroup.toLowerCase().includes(query)
    );
    renderChannelsTable(filtered);
}

// Select All
function handleSelectAll(e) {
    const checkboxes = document.querySelectorAll('.channel-select');
    checkboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
        if (e.target.checked) {
            selectedChannels.add(checkbox.dataset.id);
        } else {
            selectedChannels.delete(checkbox.dataset.id);
        }
    });
}

// Bulk Delete
async function handleBulkDelete() {
    if (selectedChannels.size === 0) {
        alert('Please select channels to delete');
        return;
    }

    if (!confirm(`Delete ${selectedChannels.size} selected channels?`)) return;

    const promises = Array.from(selectedChannels).map(id =>
        fetch(`${API_BASE}/api/v1/admin/channels/${id}`, {
            method: 'DELETE',
            headers: { 'X-Session-Id': sessionId }
        })
    );

    await Promise.all(promises);
    selectedChannels.clear();
    loadChannels();
}

// Bulk Test
async function handleBulkTest() {
    if (selectedChannels.size === 0) {
        alert('Please select channels to test');
        return;
    }

    const response = await fetch(`${API_BASE}/api/v1/test/test-batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': sessionId
        },
        body: JSON.stringify({ channelIds: Array.from(selectedChannels) })
    });

    const data = await response.json();
    alert(`Tested ${data.tested} channels\nWorking: ${data.results.filter(r => r.working).length}`);
    loadChannels();
}

// IPTV-org Functions
async function loadIptvOrgPlaylists() {
    try {
        const response = await fetch(`${API_BASE}/api/v1/iptv-org/playlists`, {
            headers: { 'X-Session-Id': sessionId }
        });

        const data = await response.json();
        renderPlaylistsGrid(data.data);
    } catch (error) {
        console.error('Error loading playlists:', error);
    }
}

function renderPlaylistsGrid(playlists) {
    const grid = document.getElementById('playlistsGrid');
    grid.innerHTML = '';

    playlists.forEach(playlist => {
        const card = document.createElement('div');
        card.className = 'playlist-card';
        card.innerHTML = `
            <h3>${playlist.name}</h3>
            <p>${playlist.description}</p>
        `;
        card.onclick = () => fetchIptvOrgPlaylist(playlist.url);
        grid.appendChild(card);
    });
}

async function fetchIptvOrgPlaylist(url) {
    try {
        document.getElementById('iptvOrgChannels').classList.add('hidden');
        document.getElementById('iptvOrgPlaceholder').classList.add('hidden');
        document.getElementById('iptvOrgLoading').classList.remove('hidden');

        const response = await fetch(`${API_BASE}/api/v1/iptv-org/fetch?url=${encodeURIComponent(url)}`, {
            headers: { 'X-Session-Id': sessionId }
        });

        const data = await response.json();
        iptvOrgChannels = data.data;

        document.getElementById('iptvOrgCount').textContent = iptvOrgChannels.length;
        renderIptvOrgTable(iptvOrgChannels);
        document.getElementById('iptvOrgLoading').classList.add('hidden');
        document.getElementById('iptvOrgChannels').classList.remove('hidden');
    } catch (error) {
        console.error('Error fetching playlist:', error);
        document.getElementById('iptvOrgLoading').classList.add('hidden');
        alert('Failed to fetch playlist');
    }
}

function renderIptvOrgTable(channels) {
    // Wait for jQuery to be ready
    if (typeof $ === 'undefined' || typeof $.fn.DataTable === 'undefined') {
        console.log('Waiting for jQuery/DataTables to load...');
        setTimeout(() => renderIptvOrgTable(channels), 100);
        return;
    }

    // Destroy existing DataTable if it exists
    if (iptvOrgDataTable) {
        iptvOrgDataTable.destroy();
        iptvOrgDataTable = null;
    }

    // Initialize DataTable
    iptvOrgDataTable = $('#iptvOrgTable').DataTable({
        data: channels,
        pageLength: 25,
        lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
        order: [[2, 'asc']], // Sort by Name column
        columns: [
            {
                // Checkbox column
                data: null,
                orderable: false,
                searchable: false,
                render: function(data, type, row, meta) {
                    return `<input type="checkbox" class="iptv-org-select" data-index="${meta.row}">`;
                }
            },
            {
                // Logo column
                data: 'tvgLogo',
                orderable: false,
                render: function(data, type, row, meta) {
                    const logoUrl = data ? getProxiedImageUrl(data) : DEFAULT_LOGO;
                    const uniqueId = `img-iptv-${meta.row}`;
                    // Don't set src yet - will be loaded sequentially
                    return `<div class="img-loading-container" data-img-src="${logoUrl}" id="${uniqueId}"><img class="channel-logo" alt="${row.channelName}"></div>`;
                }
            },
            {
                // Name column
                data: 'channelName',
                render: function(data, type, row) {
                    return `<strong class="channel-row-name">${data}</strong>`;
                }
            },
            {
                // Group column
                data: 'channelGroup',
                render: function(data, type, row) {
                    return data || 'N/A';
                }
            },
            {
                // Language column
                data: 'tvgLanguage',
                render: function(data, type, row) {
                    return data || 'N/A';
                }
            },
            {
                // Country column
                data: 'tvgCountry',
                render: function(data, type, row) {
                    return data || 'N/A';
                }
            },
            {
                // Actions column
                data: null,
                orderable: false,
                searchable: false,
                render: function(data, type, row, meta) {
                    return `
                        <div class="actions">
                            <button class="btn-icon btn-preview-iptv" data-index="${meta.row}" title="Preview">▶️</button>
                            <button class="btn-icon btn-info-iptv" data-index="${meta.row}" title="Details">ℹ️</button>
                        </div>
                    `;
                }
            }
        ],
        initComplete: function() {
            // Add column search filters for Name, Group, Language, Country
            this.api().columns([2, 3, 4, 5]).every(function() {
                const column = this;
                const header = $(column.header());

                // Check if search input already exists
                if (header.find('input').length > 0) {
                    return;
                }

                const title = header.text().trim();

                const input = $('<input type="text" placeholder="Search ' + title + '" />')
                    .appendTo(header)
                    .on('click', function(e) {
                        e.stopPropagation();
                    })
                    .on('keyup change clear', function() {
                        if (column.search() !== this.value) {
                            column.search(this.value).draw();
                        }
                    });
            });

            // Add event listeners for action buttons
            $('#iptvOrgTable').on('click', '.btn-preview-iptv', function() {
                const index = parseInt($(this).data('index'));
                const channel = channels[index];
                if (channel) {
                    previewIptvOrgChannel(channel);
                }
            });

            $('#iptvOrgTable').on('click', '.btn-info-iptv', function() {
                const index = parseInt($(this).data('index'));
                const channel = channels[index];
                if (channel) {
                    showChannelDetails(channel);
                }
            });

            // Add row click handler
            $('#iptvOrgTable tbody').on('click', 'tr', function(e) {
                // Don't trigger if clicking checkbox or buttons
                if ($(e.target).is('input, button, .btn-icon')) {
                    return;
                }

                const rowData = iptvOrgDataTable.row(this).data();
                if (rowData) {
                    showChannelDetails(rowData);
                }
            });

            // Add event listeners to checkboxes
            $('#iptvOrgTable').on('change', '.iptv-org-select', function() {
                const index = parseInt($(this).data('index'));
                if ($(this).is(':checked')) {
                    selectedIptvOrgChannels.add(index);
                } else {
                    selectedIptvOrgChannels.delete(index);
                }
            });

            // Load images sequentially
            loadImagesSequentially('#iptvOrgTable');
        }
    });
}

function handleIptvOrgSearch(e) {
    if (iptvOrgDataTable) {
        iptvOrgDataTable.search(e.target.value).draw();
    }
}

function selectAllIptvOrg() {
    document.querySelectorAll('.iptv-org-select').forEach((cb, index) => {
        cb.checked = true;
        selectedIptvOrgChannels.add(index);
    });
}

function deselectAllIptvOrg() {
    document.querySelectorAll('.iptv-org-select').forEach(cb => {
        cb.checked = false;
    });
    selectedIptvOrgChannels.clear();
}

function handleSelectAllIptvOrg(e) {
    if (e.target.checked) {
        selectAllIptvOrg();
    } else {
        deselectAllIptvOrg();
    }
}

async function handleImportSelected() {
    if (selectedIptvOrgChannels.size === 0) {
        alert('Please select channels to import');
        return;
    }

    const selectedChannelsData = Array.from(selectedIptvOrgChannels).map(index => iptvOrgChannels[index]);
    const replaceExisting = document.getElementById('replaceExisting').checked;

    if (replaceExisting && !confirm('This will DELETE ALL existing channels. Are you sure?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/v1/iptv-org/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                channels: selectedChannelsData,
                replaceExisting
            })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            selectedIptvOrgChannels.clear();
            switchView('channels');
        } else {
            alert(data.error || 'Import failed');
        }
    } catch (error) {
        console.error('Error importing channels:', error);
        alert('Failed to import channels');
    }
}

// Test Functions
async function testSingleChannel(id) {
    try {
        // Find the channel in the DataTable and update its test status to loading
        if (channelsDataTable) {
            const rowData = channelsDataTable.rows().data().toArray();
            const rowIndex = rowData.findIndex(row => row._id === id);

            if (rowIndex !== -1) {
                // Update the row data with loading state
                rowData[rowIndex].metadata = rowData[rowIndex].metadata || {};
                rowData[rowIndex].metadata.isTesting = true;

                // Redraw the specific row
                channelsDataTable.row(rowIndex).data(rowData[rowIndex]).draw(false);
            }
        }

        const response = await fetch(`${API_BASE}/api/v1/test/test-channel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ channelId: id })
        });

        const data = await response.json();

        if (data.success) {
            alert(`Channel: ${data.channel.name}\nStatus: ${data.working ? 'Working ✓' : 'Not Working ✗'}\nResponse Time: ${data.responseTime}ms`);
            loadChannels(); // Reload to get updated status
        }
    } catch (error) {
        console.error('Error testing channel:', error);
        alert('Failed to test channel');
        loadChannels(); // Reload to clear loading state
    }
}

async function testChannels(mode) {
    const channelsToTest = mode === 'all' ? channels.map(c => c._id) : Array.from(selectedChannels);

    if (channelsToTest.length === 0) {
        alert('No channels to test');
        return;
    }

    if (!confirm(`Test ${channelsToTest.length} channels? This may take several minutes.`)) return;

    document.getElementById('testProgress').textContent = 'Testing...';

    try {
        const response = await fetch(`${API_BASE}/api/v1/test/test-batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ channelIds: channelsToTest })
        });

        const data = await response.json();
        document.getElementById('testProgress').textContent = '';

        alert(`Tested: ${data.tested}\nWorking: ${data.working}\nNot Working: ${data.notWorking}`);
        loadChannels();
        loadTestResults();
    } catch (error) {
        console.error('Error testing channels:', error);
        alert('Failed to test channels');
        document.getElementById('testProgress').textContent = '';
    }
}

async function loadTestResults() {
    try {
        const response = await fetch(`${API_BASE}/api/v1/channels`, {
            headers: { 'X-Session-Id': sessionId }
        });

        if (!response.ok) throw new Error('Failed to load channels');

        const data = await response.json();
        const testChannels = data.channels || [];

        renderTestResultsTable(testChannels);
    } catch (error) {
        console.error('Error loading test results:', error);
        alert('Failed to load channels for testing');
    }
}

function renderTestResultsTable(testChannels) {
    // Wait for jQuery to be ready
    if (typeof $ === 'undefined' || typeof $.fn.DataTable === 'undefined') {
        console.log('Waiting for jQuery/DataTables to load...');
        setTimeout(() => renderTestResultsTable(testChannels), 100);
        return;
    }

    // Destroy existing DataTable if it exists
    if ($.fn.DataTable.isDataTable('#testResultsTable')) {
        $('#testResultsTable').DataTable().destroy();
    }

    // Initialize DataTable
    $('#testResultsTable').DataTable({
        data: testChannels,
        pageLength: 25,
        lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
        order: [[1, 'asc']], // Sort by Name column
        columns: [
            {
                // Checkbox column
                data: null,
                orderable: false,
                searchable: false,
                render: function(data, type, row) {
                    return `<input type="checkbox" class="test-channel-select" data-id="${row._id}">`;
                }
            },
            {
                // Name column
                data: 'channelName',
                render: function(data, type, row) {
                    return `<strong>${data}</strong>`;
                }
            },
            {
                // Group column
                data: 'channelGroup',
                render: function(data, type, row) {
                    return data || 'N/A';
                }
            },
            {
                // Status column
                data: null,
                render: function(data, type, row) {
                    if (row.metadata?.isWorking === undefined) {
                        return '<span class="status-badge status-inactive">Not Tested</span>';
                    }
                    return row.metadata.isWorking
                        ? '<span class="status-badge status-working">✓ Working</span>'
                        : '<span class="status-badge status-not-working">✗ Not Working</span>';
                }
            },
            {
                // Response Time column
                data: 'metadata.responseTime',
                render: function(data, type, row) {
                    return data ? `${data}ms` : 'N/A';
                }
            },
            {
                // Last Tested column
                data: 'metadata.lastTested',
                render: function(data, type, row) {
                    if (!data) return 'Never';
                    const date = new Date(data);
                    return date.toLocaleString();
                }
            },
            {
                // Actions column
                data: null,
                orderable: false,
                searchable: false,
                render: function(data, type, row) {
                    return `
                        <div class="actions">
                            <button class="btn-icon btn-test-single" data-id="${row._id}" title="Test">🔍</button>
                        </div>
                    `;
                }
            }
        ],
        initComplete: function() {
            // Add column search filters
            this.api().columns([1, 2]).every(function() {
                const column = this;
                const title = $(column.header()).text();

                const input = $('<input type="text" placeholder="Search ' + title + '" />')
                    .appendTo($(column.header()))
                    .on('click', function(e) {
                        e.stopPropagation();
                    })
                    .on('keyup change clear', function() {
                        if (column.search() !== this.value) {
                            column.search(this.value).draw();
                        }
                    });
            });

            // Add event listeners for test button
            $('#testResultsTable').on('click', '.btn-test-single', function() {
                const id = $(this).data('id');
                testSingleChannel(id);
            });

            // Add event listeners to checkboxes
            $('#testResultsTable').on('change', '.test-channel-select', function() {
                const id = $(this).data('id');
                if ($(this).is(':checked')) {
                    selectedChannels.add(id);
                } else {
                    selectedChannels.delete(id);
                }
            });
        }
    });
}

// Load Stats
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/stats`, {
            headers: { 'X-Session-Id': sessionId }
        });

        const data = await response.json();

        if (data.success) {
            const stats = data.data;

            document.getElementById('statTotalChannels').textContent = stats.channels.total;
            document.getElementById('statActiveChannels').textContent = stats.channels.active;
            document.getElementById('statInactiveChannels').textContent = stats.channels.inactive;
            document.getElementById('statTotalVersions').textContent = stats.app.totalVersions;

            renderCategoryChart(stats.channels.byGroup);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function renderCategoryChart(groups) {
    const chart = document.getElementById('categoryChart');
    chart.innerHTML = '';

    const maxCount = Math.max(...groups.map(g => g.count));

    groups.forEach(group => {
        const bar = document.createElement('div');
        bar.className = 'category-bar';

        const width = (group.count / maxCount) * 100;

        bar.innerHTML = `
            <div class="category-name">${group._id || 'Uncategorized'}</div>
            <div class="category-bar-fill" style="width: ${width}%">
                <span class="category-count">${group.count}</span>
            </div>
        `;

        chart.appendChild(bar);
    });
}

// Global Video.js player instance
let videoJsPlayer = null;
let currentChannel = null;

// Copy channel link to clipboard
function copyChannelLink(channel) {
    if (!channel || !channel.channelUrl) {
        showToast('Channel URL not available');
        return;
    }

    const streamUrl = channel.channelUrl;
    const channelName = channel.channelName || 'Unnamed Channel';

    // Try to use Clipboard API (modern browsers)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(streamUrl)
            .then(() => {
                showToast(`Link copied! ${channelName}`);
            })
            .catch(err => {
                console.error('Failed to copy to clipboard:', err);
                fallbackCopyToClipboard(streamUrl, channelName);
            });
    } else {
        // Fallback for older browsers
        fallbackCopyToClipboard(streamUrl, channelName);
    }
}

// Fallback copy method for older browsers
function fallbackCopyToClipboard(text, channelName) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast(`Link copied! ${channelName}`);
        } else {
            prompt('Copy this URL manually:', text);
        }
    } catch (err) {
        console.error('Fallback: Could not copy text:', err);
        prompt('Copy this URL manually:', text);
    }

    document.body.removeChild(textArea);
}

// Play channel in video player
function playChannel(channel) {
    const modal = document.getElementById('playerModal');
    const errorBox = document.getElementById('playerError');
    const errorDetails = errorBox.querySelector('.error-details');
    const video = document.getElementById('videoPlayer');
    const status = document.getElementById('playerStatus');
    const name = document.getElementById('playerChannelName');
    const urlDisplay = document.getElementById('playerUrl');

    // Reset state
    errorBox.classList.add('hidden');
    status.textContent = 'Loading...';
    name.textContent = channel.channelName || 'Unnamed Channel';
    urlDisplay.textContent = channel.channelUrl;
    urlDisplay.title = channel.channelUrl;

    // Stop any previous playback
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();

    // Prepare stream URL (proxy if needed)
    let streamUrl = channel.channelUrl;
    // const isExternal = streamUrl.startsWith('http://') || streamUrl.startsWith('https://');
    // const isLocalhost = streamUrl.includes('localhost') || streamUrl.includes('127.0.0.1');
    // if (isExternal && !isLocalhost && !streamUrl.includes('/api/v1/stream-proxy')) {
    //     streamUrl = `/api/v1/stream-proxy?url=${encodeURIComponent(channel.channelUrl)}`;
    //     console.log('Auto-proxying external stream:', streamUrl);
    // }

    // Use HLS.js if supported
    if (Hls.isSupported()) {
        hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
        });
        console.log('Loading stream via HLS.js:', streamUrl);
        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(video);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(err => console.warn('Autoplay blocked:', err));
            status.textContent = 'Playing';
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS.js error:', data);
            status.textContent = 'Error';
            errorBox.classList.remove('hidden');
            errorDetails.textContent = data.details || 'Stream load failed';
        });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari HLS support
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
            video.play().catch(() => {});
            status.textContent = 'Playing';
        });
        video.addEventListener('error', (e) => {
            status.textContent = 'Error loading stream';
            errorBox.classList.remove('hidden');
            errorDetails.textContent = e.message || 'Failed to load HLS stream';
        });
    } else {
        status.textContent = 'HLS not supported';
        errorBox.classList.remove('hidden');
        errorDetails.textContent = 'Try using Chrome or Safari.';
    }

    modal.classList.add('active');
}

// Close player modal and cleanup
document.querySelectorAll('[data-close="playerModal"]').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = document.getElementById('playerModal');
        const video = document.getElementById('videoPlayer');
        modal.classList.remove('active');
        video.pause();
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
    });
});

// Close channel details modal
document.querySelectorAll('[data-close="channelDetailsModal"]').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = document.getElementById('channelDetailsModal');
        modal.classList.remove('active');
        currentChannelDetail = null;
    });
});

// Close channel modal
document.querySelectorAll('[data-close="channelModal"]').forEach(btn => {
    btn.addEventListener('click', closeChannelModal);
});

// Click outside modal to close
document.addEventListener('click', (e) => {
    // Close playerModal if clicking outside
    const playerModal = document.getElementById('playerModal');
    if (e.target === playerModal) {
        playerModal.classList.remove('active');
        const video = document.getElementById('videoPlayer');
        video.pause();
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
    }

    // Close channelModal if clicking outside
    const channelModal = document.getElementById('channelModal');
    if (e.target === channelModal) {
        closeChannelModal();
    }

    // Close channelDetailsModal if clicking outside
    const channelDetailsModal = document.getElementById('channelDetailsModal');
    if (e.target === channelDetailsModal) {
        channelDetailsModal.classList.remove('active');
        currentChannelDetail = null;
    }
});

// Quick Filter Functions
async function loadQuickFilter(filter) {
    const filterMap = {
        'india-hindi': { country: 'IN', language: 'hin' },
        'india-marathi': { country: 'IN', language: 'mar' },
        'india-english': { country: 'IN', language: 'eng' },
        'english-kids': { language: 'eng', category: 'kids' }
    };

    const params = filterMap[filter];
    if (!params) return;

    try {
        // Build query string
        const queryParams = new URLSearchParams(params).toString();
        const response = await fetch(`${API_BASE}/api/v1/iptv-org/filter?${queryParams}`, {
            headers: { 'X-Session-Id': sessionId }
        });

        if (!response.ok) {
            throw new Error('Filter fetch failed');
        }

        const data = await response.json();
        iptvOrgChannels = data.data || [];

        document.getElementById('iptvOrgCount').textContent = iptvOrgChannels.length;
        renderIptvOrgTable(iptvOrgChannels);
        document.getElementById('iptvOrgChannels').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading quick filter:', error);
        alert(`Failed to load ${filter} channels. Using fallback...`);

        // Fallback: fetch all and filter client-side
        await loadIptvOrgPlaylists();
    }
}

// Show Channel Details Modal
function showChannelDetails(channel) {
    currentChannelDetail = channel;

    // Support both IPTV-org channels (tvgLogo) and regular channels (channelImg)
    const logoUrl = channel.tvgLogo || channel.channelImg;
    const proxiedLogo = logoUrl ? getProxiedImageUrl(logoUrl) : DEFAULT_LOGO_LARGE;

    document.getElementById('detailLogo').src = proxiedLogo;
    document.getElementById('detailName').textContent = channel.channelName || 'N/A';
    document.getElementById('detailGroup').textContent = channel.channelGroup || 'N/A';

    // Handle both IPTV-org and regular channel metadata formats
    const language = channel.tvgLanguage || channel.metadata?.language || 'N/A';
    const country = channel.tvgCountry || channel.metadata?.country || 'N/A';

    document.getElementById('detailLanguage').textContent = language;
    document.getElementById('detailCountry').textContent = country;
    document.getElementById('detailUrl').textContent = channel.channelUrl || 'N/A';

    document.getElementById('channelDetailsModal').classList.add('active');
}

// Preview IPTV Org Channel
function previewIptvOrgChannel(channel) {
    playChannel({
        channelName: channel.channelName,
        channelUrl: channel.channelUrl,
        channelImg: channel.tvgLogo
    });
}

// Handle Detail Preview Button
function handleDetailPreview() {
    if (currentChannelDetail) {
        document.getElementById('channelDetailsModal').classList.remove('active');
        previewIptvOrgChannel(currentChannelDetail);
    }
}

// ==================== APK MANAGER FUNCTIONS ====================

let apkVersions = [];

// Initialize APK Manager event listeners
function initializeApkManagerListeners() {
    // File input change
    const apkFileInput = document.getElementById('apkFile');
    if (apkFileInput) {
        apkFileInput.addEventListener('change', handleApkFileSelect);
    }

    // Upload form
    const apkUploadForm = document.getElementById('apkUploadForm');
    if (apkUploadForm) {
        apkUploadForm.addEventListener('submit', handleApkUpload);
    }

    // Refresh button
    const refreshApkBtn = document.getElementById('refreshApkBtn');
    if (refreshApkBtn) {
        refreshApkBtn.addEventListener('click', loadApkVersions);
    }
}

// Load APK versions from server
async function loadApkVersions() {
    const loadingEl = document.getElementById('loadingApk');
    const tableBody = document.getElementById('apkVersionsTableBody');

    if (loadingEl) loadingEl.style.display = 'block';
    if (tableBody) tableBody.innerHTML = '';

    try {
        // Use the new JSON-based public endpoint (no auth needed)
        const response = await fetch(`${API_BASE}/api/v1/app/versions`);

        if (!response.ok) {
            throw new Error('Failed to fetch APK versions');
        }

        const data = await response.json();
        apkVersions = data.data || [];

        renderApkVersionsTable();
        updateApkStats();
        updateDownloadLinks();
    } catch (error) {
        console.error('Error loading APK versions:', error);
        showToast('Failed to load APK versions', 3000);
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

// Render APK versions table
function renderApkVersionsTable() {
    const tableBody = document.getElementById('apkVersionsTableBody');
    if (!tableBody) return;

    if (apkVersions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;">No APK versions uploaded yet</td></tr>';
        return;
    }

    tableBody.innerHTML = apkVersions.map(version => `
        <tr>
            <td><strong>${version.versionName}</strong></td>
            <td>${version.versionCode}</td>
            <td><code>${version.apkFileName || 'N/A'}</code></td>
            <td>${formatFileSize(version.apkFileSize)}</td>
            <td>
                <span class="badge ${version.isActive ? 'badge-success' : 'badge-inactive'}">
                    ${version.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <span class="badge ${version.isMandatory ? 'badge-warning' : 'badge-info'}">
                    ${version.isMandatory ? 'Yes' : 'No'}
                </span>
            </td>
            <td>${formatDate(version.releasedAt)}</td>
            <td>
                <button class="btn btn-small btn-info" onclick="viewApkDetails('${version.versionCode}')">View</button>
                <button class="btn btn-small btn-primary" onclick="downloadApk('${version.apkFileName}')">Download</button>
                <span style="color: #6b7280; font-size: 0.75rem; margin-left: 0.5rem;">
                    (Edit versions.json to modify)
                </span>
            </td>
        </tr>
    `).join('');
}

// Update APK statistics
function updateApkStats() {
    const totalEl = document.getElementById('totalApkVersions');
    const activeEl = document.getElementById('activeApkVersions');
    const latestNameEl = document.getElementById('latestVersionName');
    const latestCodeEl = document.getElementById('latestVersionCode');

    if (totalEl) totalEl.textContent = apkVersions.length;

    const activeVersions = apkVersions.filter(v => v.isActive);
    if (activeEl) activeEl.textContent = activeVersions.length;

    const latestVersion = apkVersions.find(v => v.isActive) || apkVersions[0];
    if (latestVersion) {
        if (latestNameEl) latestNameEl.textContent = latestVersion.versionName;
        if (latestCodeEl) latestCodeEl.textContent = latestVersion.versionCode;
    } else {
        if (latestNameEl) latestNameEl.textContent = '-';
        if (latestCodeEl) latestCodeEl.textContent = '-';
    }
}

// Update download links
function updateDownloadLinks() {
    const fullLinkEl = document.getElementById('fullDownloadLink');
    if (fullLinkEl) {
        fullLinkEl.textContent = `${API_BASE}/api/v1/app/apk`;
    }
}

// Handle file selection
function handleApkFileSelect(event) {
    const file = event.target.files[0];
    const fileNameEl = document.getElementById('fileName');
    const fileSizeEl = document.getElementById('fileSize');

    if (file) {
        if (fileNameEl) fileNameEl.textContent = file.name;
        if (fileSizeEl) fileSizeEl.textContent = `(${formatFileSize(file.size)})`;
    } else {
        if (fileNameEl) fileNameEl.textContent = 'No file selected';
        if (fileSizeEl) fileSizeEl.textContent = '';
    }
}

// Handle APK upload
async function handleApkUpload(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData();

    // Get form values
    const versionName = document.getElementById('versionName').value;
    const versionCode = document.getElementById('versionCode').value;
    const releaseNotes = document.getElementById('releaseNotes').value;
    const isMandatory = document.getElementById('isMandatory').checked;
    const isActive = document.getElementById('isActive').checked;
    const minCompatibleVersion = document.getElementById('minCompatibleVersion').value;
    const apkFile = document.getElementById('apkFile').files[0];

    if (!apkFile) {
        showToast('Please select an APK file', 3000);
        return;
    }

    // Append form data
    formData.append('apkFile', apkFile);
    formData.append('versionName', versionName);
    formData.append('versionCode', versionCode);
    if (releaseNotes) formData.append('releaseNotes', releaseNotes);
    formData.append('isMandatory', isMandatory);
    formData.append('isActive', isActive);
    if (minCompatibleVersion) formData.append('minCompatibleVersion', minCompatibleVersion);

    // Show progress
    const progressEl = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const submitBtn = form.querySelector('button[type="submit"]');

    if (progressEl) progressEl.classList.remove('hidden');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                if (progressFill) progressFill.style.width = `${percentComplete}%`;
                if (progressText) progressText.textContent = `${percentComplete}%`;
            }
        });

        // Handle completion
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                showToast('APK uploaded successfully!', 3000);
                form.reset();
                handleApkFileSelect({ target: { files: [] } });
                loadApkVersions();
                if (progressEl) progressEl.classList.add('hidden');
                if (progressFill) progressFill.style.width = '0%';
                if (progressText) progressText.textContent = '0%';
            } else {
                const error = JSON.parse(xhr.responseText);
                showToast(`Upload failed: ${error.error || 'Unknown error'}`, 5000);
            }
            if (submitBtn) submitBtn.disabled = false;
        });

        // Handle errors
        xhr.addEventListener('error', () => {
            showToast('Upload failed. Please check your connection.', 5000);
            if (submitBtn) submitBtn.disabled = false;
            if (progressEl) progressEl.classList.add('hidden');
        });

        // Send request
        xhr.open('POST', `${API_BASE}/api/v1/admin/app/upload`);
        xhr.setRequestHeader('X-Session-Id', sessionId);
        xhr.send(formData);

    } catch (error) {
        console.error('Error uploading APK:', error);
        showToast('Failed to upload APK', 3000);
        if (submitBtn) submitBtn.disabled = false;
        if (progressEl) progressEl.classList.add('hidden');
    }
}

// Toggle APK version status
async function toggleApkStatus(versionId, newStatus) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/app/versions/${versionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ isActive: newStatus })
        });

        if (!response.ok) {
            throw new Error('Failed to update version status');
        }

        showToast(`Version ${newStatus ? 'activated' : 'deactivated'} successfully`, 3000);
        loadApkVersions();
    } catch (error) {
        console.error('Error toggling status:', error);
        showToast('Failed to update version status', 3000);
    }
}

// Delete APK version
async function deleteApkVersion(versionId) {
    if (!confirm('Are you sure you want to delete this version? This will also delete the APK file.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/app/versions/${versionId}`, {
            method: 'DELETE',
            headers: { 'X-Session-Id': sessionId }
        });

        if (!response.ok) {
            throw new Error('Failed to delete version');
        }

        showToast('Version deleted successfully', 3000);
        loadApkVersions();
    } catch (error) {
        console.error('Error deleting version:', error);
        showToast('Failed to delete version', 3000);
    }
}

// View APK details
function viewApkDetails(versionCode) {
    const version = apkVersions.find(v => v.versionCode === versionCode);
    if (!version) return;

    const downloadUrl = `${API_BASE}/api/v1/app/download?version=${version.versionCode}`;

    const details = `
Version: ${version.versionName} (Code: ${version.versionCode})
File: ${version.apkFileName}
Size: ${formatFileSize(version.apkFileSize)}
Status: ${version.isActive ? 'Active' : 'Inactive'}
Mandatory: ${version.isMandatory ? 'Yes' : 'No'}
${version.minCompatibleVersion ? `Min Compatible: ${version.minCompatibleVersion}` : ''}
Released: ${formatDate(version.releasedAt)}

Release Notes:
${version.releaseNotes || 'No release notes available'}

Download URL:
${downloadUrl}

To modify this version:
Edit versions.json and restart the server
    `;

    alert(details);
}

// Download APK
function downloadApk(fileName) {
    window.open(`${API_BASE}/apks/${fileName}`, '_blank');
}

// Copy to clipboard helper
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const text = element.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy to clipboard', 2000);
    });
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Initialize APK manager when view is loaded
const originalSwitchView = switchView;
switchView = function(view) {
    originalSwitchView(view);
    if (view === 'apk') {
        initializeApkManagerListeners();
        loadApkVersions();
    }
};
