// Channels Management Module
// Handles all channel-related operations including CRUD, testing, and playback

// ==================== STATE VARIABLES ====================
let channels = [];
let selectedChannels = new Set();
let channelsDataTable = null;
let currentChannelDetail = null;
let hlsInstance = null;
let videoEventHandlers = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Show loading bar
    showLoadingBar();

    // Check authentication first (uses cache for fast subsequent loads)
    const user = await checkAuth();
    if (!user) return; // Will redirect to login if not authenticated

    // Show dashboard immediately with channels as active page
    showDashboard(user, 'channels');

    // Initialize page functionality (non-blocking)
    initializeChannelEventListeners();

    // Load channels and hide loading bar when done
    try {
        await loadChannels();
    } finally {
        hideLoadingBar();
    }
});

// Initialize event listeners specific to channels
function initializeChannelEventListeners() {
    // Add Channel button
    const addChannelBtn = document.getElementById('addChannelBtn');
    if (addChannelBtn) {
        addChannelBtn.addEventListener('click', () => openChannelModal());
    }

    // Channel Form
    const channelForm = document.getElementById('channelForm');
    if (channelForm) {
        channelForm.addEventListener('submit', handleChannelSubmit);
    }

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeChannelModal);
    }

    // Close buttons for channelModal
    document.querySelectorAll('[data-close="channelModal"]').forEach(btn => {
        btn.addEventListener('click', closeChannelModal);
    });

    // Bulk actions
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', handleSelectAll);
    }

    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', handleBulkDelete);
    }

    const bulkTestBtn = document.getElementById('bulkTestBtn');
    if (bulkTestBtn) {
        bulkTestBtn.addEventListener('click', handleBulkTest);
    }

    const bulkDeleteAllBtn = document.getElementById('bulkDeleteAllBtn');
    if (bulkDeleteAllBtn) {
        bulkDeleteAllBtn.addEventListener('click', () => {
            const modal = document.getElementById('deleteAllConfirmationModal');
            if (modal) {
                modal.classList.add('active');
            }
        });
    }

    const cancelDeleteAllBtn = document.getElementById('cancelDeleteAllBtn');
    if (cancelDeleteAllBtn) {
        cancelDeleteAllBtn.addEventListener('click', () => {
            const modal = document.getElementById('deleteAllConfirmationModal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    }

    const confirmDeleteAllBtn = document.getElementById('confirmDeleteAllBtn');
    if (confirmDeleteAllBtn) {
        confirmDeleteAllBtn.addEventListener('click', handleBulkDeleteAll);
    }

    // Quick filters
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            applyQuickFilter(filter);
        });
    });

    // Channel details modal
    const detailPreviewBtn = document.getElementById('detailPreviewBtn');
    if (detailPreviewBtn) {
        detailPreviewBtn.addEventListener('click', handleDetailPreview);
    }

    // Close channel details modal
    document.querySelectorAll('[data-close="channelDetailsModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('channelDetailsModal');
            if (modal) {
                modal.classList.remove('active');
                currentChannelDetail = null;
            }
        });
    });

    // Close player modal buttons
    document.querySelectorAll('[data-close="playerModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('playerModal');
            if (modal) {
                modal.classList.remove('active');
                cleanupVideoPlayer();
            }
        });
    });

    // Click outside modal to close
    document.addEventListener('click', (e) => {
        // Close playerModal if clicking outside
        const playerModal = document.getElementById('playerModal');
        if (e.target === playerModal) {
            playerModal.classList.remove('active');
            cleanupVideoPlayer();
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

        // Close deleteAllConfirmationModal if clicking outside
        const deleteAllConfirmationModal = document.getElementById('deleteAllConfirmationModal');
        if (e.target === deleteAllConfirmationModal) {
            deleteAllConfirmationModal.classList.remove('active');
        }
    });
}

// ==================== CHANNEL LOADING & RENDERING ====================

// Load Channels
async function loadChannels() {
    const sessionId = getSessionId();

    try {
        const loadingElement = document.getElementById('loadingChannels');
        if (loadingElement) {
            loadingElement.classList.remove('hidden');
        }

        const response = await fetch(`${API_BASE}/api/v1/channels`);
        const data = await response.json();

        channels = data.data;
        renderChannelsTable(channels);
        updateChannelStats(channels);

        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
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
    const totalChannelsEl = document.getElementById('totalChannels');
    const workingChannelsEl = document.getElementById('workingChannels');
    const totalGroupsEl = document.getElementById('totalGroups');

    if (totalChannelsEl) {
        totalChannelsEl.textContent = channels.length;
    }

    const working = channels.filter(c => c.metadata?.isWorking === true).length;
    if (workingChannelsEl) {
        workingChannelsEl.textContent = working || '-';
    }

    const groups = new Set(channels.map(c => c.channelGroup));
    if (totalGroupsEl) {
        totalGroupsEl.textContent = groups.size;
    }
}

// ==================== CHANNEL MODAL OPERATIONS ====================

// Channel Modal
function openChannelModal(channel = null) {
    const modal = document.getElementById('channelModal');
    const title = document.getElementById('modalTitle');

    if (!modal || !title) return;

    if (channel) {
        title.textContent = 'Edit Channel';
        document.getElementById('channelIdHidden').value = channel._id;
        document.getElementById('channelId').value = channel.channelId;
        document.getElementById('channelName').value = channel.channelName;
        document.getElementById('channelUrl').value = channel.channelUrl;
        document.getElementById('channelImg').value = channel.channelImg || '';
        document.getElementById('channelGroup').value = channel.channelGroup || '';
    } else {
        title.textContent = 'Add Channel';
        document.getElementById('channelForm').reset();
        document.getElementById('channelIdHidden').value = '';
    }

    modal.classList.add('active');
}

function closeChannelModal() {
    const modal = document.getElementById('channelModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Handle Channel Submit
async function handleChannelSubmit(e) {
    e.preventDefault();

    const sessionId = getSessionId();
    const id = document.getElementById('channelIdHidden').value;
    const channelData = {
        channelId: document.getElementById('channelId').value,
        channelName: document.getElementById('channelName').value,
        channelUrl: document.getElementById('channelUrl').value,
        channelImg: document.getElementById('channelImg').value,
        channelGroup: document.getElementById('channelGroup').value
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

// ==================== CHANNEL CRUD OPERATIONS ====================

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

    const sessionId = getSessionId();

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

// ==================== FILTER OPERATIONS ====================

// Quick Filter Functions
function applyQuickFilter(filter) {
    // Reserved for future filter implementations
}

// ==================== BULK OPERATIONS ====================

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

    const sessionId = getSessionId();

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

// Bulk Delete All
async function handleBulkDeleteAll() {
    const modal = document.getElementById('deleteAllConfirmationModal');
    if (modal) {
        modal.classList.remove('active');
    }

    const sessionId = getSessionId();

    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/channels`, {
            method: 'DELETE',
            headers: { 'X-Session-Id': sessionId }
        });

        const data = await response.json();

        if (data.success) {
            showToast(`${data.deletedCount} channels deleted successfully.`, 3000);
            loadChannels();
        } else {
            alert(data.error || 'Failed to delete all channels');
        }
    } catch (error) {
        console.error('Error deleting all channels:', error);
        alert('An error occurred while deleting all channels.');
    }
}

// Bulk Test
async function handleBulkTest() {
    if (selectedChannels.size === 0) {
        showToast('Please select channels to test', 3000);
        return;
    }

    const sessionId = getSessionId();

    // Limit to 100 channels
    let channelsToTest = Array.from(selectedChannels);
    if (channelsToTest.length > 100) {
        showToast(`Testing limited to 100 channels. You selected ${channelsToTest.length}, testing first 100.`, 3000);
        channelsToTest = channelsToTest.slice(0, 100);
    }

    showToast('Testing channels...', 3000);

    const response = await fetch(`${API_BASE}/api/v1/test/test-batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': sessionId
        },
        body: JSON.stringify({ channelIds: channelsToTest })
    });

    const data = await response.json();
    const workingCount = data.results.filter(r => r.working).length;
    showToast(`Tested ${data.tested} channels - ${workingCount} working, ${data.tested - workingCount} failed`, 3000);
    loadChannels();
}

// ==================== CHANNEL TESTING ====================

// Test Single Channel
async function testSingleChannel(id) {
    const sessionId = getSessionId();

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
            const status = data.working ? '✓ Working' : '✗ Not Working';
            const statusType = data.working ? 'success' : 'error';
            showToast(`${data.channel.name}: ${status} (${data.responseTime}ms)`, 3000);
            loadChannels(); // Reload to get updated status
        }
    } catch (error) {
        console.error('Error testing channel:', error);
        showToast('Failed to test channel', 3000);
        loadChannels(); // Reload to clear loading state
    }
}

// ==================== CHANNEL DETAILS MODAL ====================

// Show Channel Details Modal
function showChannelDetails(channel) {
    currentChannelDetail = channel;

    // Support both IPTV-org channels (tvgLogo) and regular channels (channelImg)
    const logoUrl = channel.tvgLogo || channel.channelImg;
    const proxiedLogo = logoUrl ? getProxiedImageUrl(logoUrl) : DEFAULT_LOGO_LARGE;

    const detailLogo = document.getElementById('detailLogo');
    const detailName = document.getElementById('detailName');
    const detailGroup = document.getElementById('detailGroup');
    const detailLanguage = document.getElementById('detailLanguage');
    const detailCountry = document.getElementById('detailCountry');
    const detailUrl = document.getElementById('detailUrl');
    const modal = document.getElementById('channelDetailsModal');

    if (detailLogo) detailLogo.src = proxiedLogo;
    if (detailName) detailName.textContent = channel.channelName || 'N/A';
    if (detailGroup) detailGroup.textContent = channel.channelGroup || 'N/A';

    // Handle both IPTV-org and regular channel metadata formats
    const language = channel.tvgLanguage || channel.metadata?.language || 'N/A';
    const country = channel.tvgCountry || channel.metadata?.country || 'N/A';

    if (detailLanguage) detailLanguage.textContent = language;
    if (detailCountry) detailCountry.textContent = country;
    if (detailUrl) detailUrl.textContent = channel.channelUrl || 'N/A';

    if (modal) {
        modal.classList.add('active');
    }
}

// Handle Detail Preview Button
function handleDetailPreview() {
    if (currentChannelDetail) {
        const modal = document.getElementById('channelDetailsModal');
        if (modal) {
            modal.classList.remove('active');
        }
        playChannel({
            channelName: currentChannelDetail.channelName,
            channelUrl: currentChannelDetail.channelUrl,
            channelImg: currentChannelDetail.channelImg || currentChannelDetail.tvgLogo
        });
    }
}

// ==================== CHANNEL PLAYBACK ====================

// Cleanup video player and remove event listeners
function cleanupVideoPlayer() {
    const video = document.getElementById('videoPlayer');

    if (!video) return;

    // Destroy HLS instance
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }

    // Remove all event listeners if they exist
    if (videoEventHandlers) {
        video.removeEventListener('playing', videoEventHandlers.playing);
        video.removeEventListener('pause', videoEventHandlers.pause);
        video.removeEventListener('waiting', videoEventHandlers.waiting);
        video.removeEventListener('error', videoEventHandlers.error);
        if (videoEventHandlers.loadedmetadata) {
            video.removeEventListener('loadedmetadata', videoEventHandlers.loadedmetadata);
        }
        videoEventHandlers = null;
    }

    // Reset video element
    video.pause();
    video.removeAttribute('src');
    video.load();
}

// Play channel in video player
function playChannel(channel) {
    const sessionId = getSessionId();
    const modal = document.getElementById('playerModal');
    const errorBox = document.getElementById('playerError');
    const errorDetails = errorBox?.querySelector('.error-details');
    const loadingBox = document.getElementById('playerLoading');
    const video = document.getElementById('videoPlayer');
    const status = document.getElementById('playerStatus');
    const name = document.getElementById('playerChannelName');
    const urlDisplay = document.getElementById('playerUrl');

    if (!modal || !video || !status || !name || !urlDisplay) {
        console.error('Player modal elements not found');
        return;
    }

    // Cleanup any previous player state
    cleanupVideoPlayer();

    // Reset state
    if (errorBox) errorBox.classList.add('hidden');
    if (loadingBox) loadingBox.classList.remove('hidden');
    status.textContent = '⏳ Loading stream...';
    status.className = 'status-loading';
    name.textContent = channel.channelName || 'Unnamed Channel';
    urlDisplay.textContent = channel.channelUrl;
    urlDisplay.title = channel.channelUrl;

    // Prepare stream URL - Use proxy for external streams to bypass CORS
    let streamUrl = channel.channelUrl;
    const isExternal = streamUrl.startsWith('http://') || streamUrl.startsWith('https://');
    const isLocalhost = streamUrl.includes('localhost') || streamUrl.includes('127.0.0.1');

    // Auto-proxy external streams (not localhost) to bypass CORS restrictions
    if (isExternal && !isLocalhost && !streamUrl.includes('/api/v1/stream-proxy')) {
        streamUrl = `${API_BASE}/api/v1/stream-proxy?url=${encodeURIComponent(channel.channelUrl)}`;
        console.log('🔄 Using stream proxy for CORS bypass');
    }

    console.log('🎬 Loading channel:', channel.channelName);
    console.log('📡 Stream URL:', channel.channelUrl);
    console.log('🌐 Proxied URL:', streamUrl);

    // Use HLS.js if supported
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 3,
            levelLoadingTimeOut: 10000,
            levelLoadingMaxRetry: 3,
            fragLoadingTimeOut: 20000,
            fragLoadingMaxRetry: 3,
            xhrSetup: function(xhr, url) {
                // Add authentication header for stream proxy requests
                if (url.includes('/api/v1/stream-proxy') && sessionId) {
                    xhr.setRequestHeader('X-Session-Id', sessionId);
                }
            }
        });

        console.log('✅ Loading stream via HLS.js');
        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(video);

        // Track loading progress
        let manifestLoaded = false;

        hlsInstance.on(Hls.Events.MANIFEST_LOADING, () => {
            console.log('📥 Loading manifest...');
            status.textContent = '⏳ Loading manifest...';
        });

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            console.log('✅ Manifest parsed successfully');
            manifestLoaded = true;
            status.textContent = '▶️ Starting playback...';
            if (loadingBox) loadingBox.classList.add('hidden');

            // Display stream info if available
            if (data.levels && data.levels.length > 0) {
                const level = data.levels[0];
                console.log(`📺 Stream quality: ${level.width}x${level.height} @ ${level.bitrate}bps`);
            }

            video.play()
                .then(() => {
                    console.log('✅ Playback started');
                    status.textContent = '✅ Playing';
                    status.className = 'status-playing';
                })
                .catch(err => {
                    console.warn('⚠️ Autoplay blocked:', err);
                    status.textContent = '⏸️ Click to play';
                    status.className = 'status-paused';
                });
        });

        hlsInstance.on(Hls.Events.LEVEL_LOADED, (event, data) => {
            console.log('📊 Level loaded:', data.details);
        });

        hlsInstance.on(Hls.Events.FRAG_LOADING, () => {
            if (!manifestLoaded) {
                status.textContent = '⏳ Loading video fragments...';
            }
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            console.error('❌ HLS.js error:', data);

            // Determine error severity
            if (data.fatal) {
                if (loadingBox) loadingBox.classList.add('hidden');
                status.textContent = '❌ Error';
                status.className = 'status-error';
                if (errorBox) errorBox.classList.remove('hidden');

                // Provide detailed error messages
                let errorMessage = '';
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        errorMessage = `Network Error: ${data.details}. The stream may be offline or unreachable.`;

                        // Attempt to recover from network errors
                        console.log('🔄 Attempting to recover from network error...');
                        hlsInstance.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        errorMessage = `Media Error: ${data.details}. The stream format may be incompatible.`;

                        // Attempt to recover from media errors
                        console.log('🔄 Attempting to recover from media error...');
                        hlsInstance.recoverMediaError();
                        break;
                    default:
                        errorMessage = `Fatal Error: ${data.details || 'Unknown error occurred'}`;
                        break;
                }

                if (errorDetails) errorDetails.textContent = errorMessage;
            } else {
                // Non-fatal error, just log it
                console.warn('⚠️ Non-fatal HLS error:', data.details);
            }
        });

        // Create and store event handlers for HLS.js playback
        videoEventHandlers = {
            playing: () => {
                if (loadingBox) loadingBox.classList.add('hidden');
                status.textContent = '✅ Playing';
                status.className = 'status-playing';
            },
            pause: () => {
                status.textContent = '⏸️ Paused';
                status.className = 'status-paused';
            },
            waiting: () => {
                status.textContent = '⏳ Buffering...';
                status.className = 'status-loading';
            },
            error: (e) => {
                console.error('❌ Video element error:', e);
                if (loadingBox) loadingBox.classList.add('hidden');
                status.textContent = '❌ Error';
                status.className = 'status-error';
                if (errorBox) errorBox.classList.remove('hidden');

                // Get more detailed error info
                if (video.error) {
                    const errorCode = video.error.code;
                    const errorMessages = {
                        1: 'MEDIA_ERR_ABORTED: Playback was aborted',
                        2: 'MEDIA_ERR_NETWORK: Network error occurred',
                        3: 'MEDIA_ERR_DECODE: Decoding error occurred',
                        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED: Stream format not supported'
                    };
                    if (errorDetails) errorDetails.textContent = errorMessages[errorCode] || 'Unknown playback error';
                } else {
                    if (errorDetails) errorDetails.textContent = 'Video playback error: ' + (e.message || 'Unknown error');
                }
            }
        };

        // Add event listeners
        video.addEventListener('playing', videoEventHandlers.playing);
        video.addEventListener('pause', videoEventHandlers.pause);
        video.addEventListener('waiting', videoEventHandlers.waiting);
        video.addEventListener('error', videoEventHandlers.error);

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari HLS support
        console.log('✅ Using native HLS support (Safari)');
        video.src = streamUrl;

        // Create and store event handlers for native HLS
        videoEventHandlers = {
            playing: () => {
                if (loadingBox) loadingBox.classList.add('hidden');
                status.textContent = '✅ Playing';
                status.className = 'status-playing';
            },
            pause: () => {
                status.textContent = '⏸️ Paused';
                status.className = 'status-paused';
            },
            waiting: () => {
                status.textContent = '⏳ Buffering...';
                status.className = 'status-loading';
            },
            error: (e) => {
                console.error('❌ Native HLS error:', e);
                if (loadingBox) loadingBox.classList.add('hidden');
                status.textContent = '❌ Error loading stream';
                status.className = 'status-error';
                if (errorBox) errorBox.classList.remove('hidden');

                if (video.error) {
                    const errorCode = video.error.code;
                    const errorMessages = {
                        1: 'MEDIA_ERR_ABORTED: Playback was aborted',
                        2: 'MEDIA_ERR_NETWORK: Network error - stream may be offline',
                        3: 'MEDIA_ERR_DECODE: Codec/format not supported in Safari',
                        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED: HLS stream format not supported'
                    };
                    if (errorDetails) errorDetails.textContent = errorMessages[errorCode] || 'Failed to load HLS stream';
                } else {
                    if (errorDetails) errorDetails.textContent = e.message || 'Failed to load HLS stream. The stream may be offline or incompatible.';
                }
            },
            loadedmetadata: () => {
                console.log('✅ Metadata loaded');
                if (loadingBox) loadingBox.classList.add('hidden');
                video.play()
                    .then(() => {
                        status.textContent = '✅ Playing';
                        status.className = 'status-playing';
                    })
                    .catch(() => {
                        status.textContent = '⏸️ Click to play';
                        status.className = 'status-paused';
                    });
            }
        };

        // Add event listeners
        video.addEventListener('playing', videoEventHandlers.playing);
        video.addEventListener('pause', videoEventHandlers.pause);
        video.addEventListener('waiting', videoEventHandlers.waiting);
        video.addEventListener('error', videoEventHandlers.error);
        video.addEventListener('loadedmetadata', videoEventHandlers.loadedmetadata);
    } else {
        console.error('❌ HLS not supported in this browser');
        if (loadingBox) loadingBox.classList.add('hidden');
        status.textContent = '❌ HLS not supported';
        status.className = 'status-error';
        if (errorBox) errorBox.classList.remove('hidden');
        if (errorDetails) errorDetails.textContent = 'Your browser does not support HLS streaming. Please try using Chrome, Firefox, or Safari.';
    }

    modal.classList.add('active');
    console.log('🎭 Player modal opened');
}

// ==================== UTILITY FUNCTIONS ====================

// Copy channel link to clipboard
function copyChannelLink(channel) {
    if (!channel || !channel.channelUrl) {
        showToast('Channel URL not available', 3000);
        return;
    }

    const streamUrl = channel.channelUrl;
    const channelName = channel.channelName || 'Unnamed Channel';

    // Try to use Clipboard API (modern browsers)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(streamUrl)
            .then(() => {
                showToast(`Link copied! ${channelName}`, 3000);
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
            showToast(`Link copied! ${channelName}`, 3000);
        } else {
            prompt('Copy this URL manually:', text);
        }
    } catch (err) {
        console.error('Fallback: Could not copy text:', err);
        prompt('Copy this URL manually:', text);
    }

    document.body.removeChild(textArea);
}
