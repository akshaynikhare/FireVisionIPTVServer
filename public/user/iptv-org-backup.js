// IPTV-org Management Module
// Handles all IPTV-org playlist and channel operations

// ==================== STATE VARIABLES ====================

let iptvOrgChannels = [];
let selectedIptvOrgChannels = new Set();
let iptvOrgDataTable = null;
let currentChannelDetail = null;
let hlsInstance = null;
let videoEventHandlers = null;

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    AdminCore.initPage('iptv-org', async () => {
        initializeEventListeners();
        await loadIptvOrgPlaylists();
    });
});

// ==================== EVENT LISTENERS ====================

function initializeEventListeners() {

    // Select/Deselect buttons
    const selectAllBtn = document.getElementById('selectAllIptvOrg');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllIptvOrg);
    }

    const deselectAllBtn = document.getElementById('deselectAllIptvOrg');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', deselectAllIptvOrg);
    }

    // Import button
    const importBtn = document.getElementById('importSelectedBtn');
    if (importBtn) {
        importBtn.addEventListener('click', handleImportSelected);
    }

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllIptvOrgCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', handleSelectAllIptvOrg);
    }

    // Load all IPTV-org channels
    const loadAllBtn = document.getElementById('loadAllIptvOrgBtn');
    if (loadAllBtn) {
        loadAllBtn.addEventListener('click', loadAllIptvOrgChannels);
    }

    // Clear cache button
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', clearCacheAndRefresh);
    }

    // Channel details modal preview button
    const detailPreviewBtn = document.getElementById('detailPreviewBtn');
    if (detailPreviewBtn) {
        detailPreviewBtn.addEventListener('click', handleDetailPreview);
    }

    // Player modal close buttons
    // Bootstrap 4 handles data-dismiss="modal" automatically
    // We need to hook into the hide event to cleanup the player
    $('#playerModal').on('hidden.bs.modal', function () {
        cleanupVideoPlayer();
    });

    // Channel details modal close buttons
    // Bootstrap 4 handles data-dismiss="modal" automatically
    $('#channelDetailsModal').on('hidden.bs.modal', function () {
        currentChannelDetail = null;
    });

    // Import confirmation button
    const confirmImportBtn = document.getElementById('confirmImportBtn');
    if (confirmImportBtn) {
        confirmImportBtn.addEventListener('click', confirmImportChannels);
    }

    // Click outside modal to close - Bootstrap handles this automatically
}

// ==================== PLAYLIST FUNCTIONS ====================

async function loadIptvOrgPlaylists() {
    try {
        const sessionId = getSessionId();
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
    const placeholder = document.getElementById('playlistsPlaceholder');

    // Check if required elements exist
    if (!grid) {
        console.error('playlistsGrid element not found in DOM');
        return;
    }

    grid.innerHTML = '';

    if (!playlists || playlists.length === 0) {
        if (placeholder) placeholder.classList.remove('hidden');
        return;
    }

    if (placeholder) placeholder.classList.add('hidden');

    // Show ALL playlists including "All Channels"
    playlists.forEach(playlist => {
        const card = document.createElement('div');
        card.className = 'playlist-card btn btn-outline-primary';
        card.innerHTML = `
            <span><strong>${playlist.name}</strong></span>
        `;
        card.onclick = () => fetchIptvOrgPlaylist(playlist.filter);
        grid.appendChild(card);
    });
}

async function fetchIptvOrgPlaylist(filter) {
    try {
        document.getElementById('iptvOrgChannels').classList.add('hidden');
        document.getElementById('iptvOrgPlaceholder').classList.add('hidden');
        document.getElementById('iptvOrgLoading').classList.remove('hidden');

        // Build query parameters from filter object
        const params = new URLSearchParams();
        if (filter.country) params.append('country', filter.country);

        // Handle both single language and multiple languages
        if (filter.languages && Array.isArray(filter.languages)) {
            // Multiple languages - send as comma-separated string
            params.append('languages', filter.languages.join(','));
        } else if (filter.language) {
            // Single language
            params.append('language', filter.language);
        }

        if (filter.category) params.append('category', filter.category);

        const sessionId = getSessionId();
        const response = await fetch(`${API_BASE}/api/v1/iptv-org/fetch?${params.toString()}`, {
            headers: { 'X-Session-Id': sessionId }
        });

        const data = await response.json();
        iptvOrgChannels = data.data;

        renderIptvOrgTable(iptvOrgChannels);
        document.getElementById('iptvOrgLoading').classList.add('hidden');
        document.getElementById('iptvOrgChannels').classList.remove('hidden');
    } catch (error) {
        console.error('Error fetching playlist:', error);
        document.getElementById('iptvOrgLoading').classList.add('hidden');
        showToast('Failed to fetch playlist', 3000);
    }
}

async function loadAllIptvOrgChannels() {
    try {
        document.getElementById('iptvOrgChannels').classList.add('hidden');
        document.getElementById('iptvOrgPlaceholder').classList.add('hidden');
        document.getElementById('iptvOrgLoading').classList.remove('hidden');

        showToast('Loading all IPTV-org channels...', 'info');

        const sessionId = getSessionId();
        // Use the /fetch endpoint without filters to get ALL enriched data
        const response = await fetch(`${API_BASE}/api/v1/iptv-org/fetch`, {
            headers: { 'X-Session-Id': sessionId }
        });

        if (!response.ok) {
            throw new Error('Failed to load channels');
        }

        const data = await response.json();
        iptvOrgChannels = data.data || [];

        renderIptvOrgTable(iptvOrgChannels);
        document.getElementById('iptvOrgLoading').classList.add('hidden');
        document.getElementById('iptvOrgChannels').classList.remove('hidden');

        showToast(`Loaded ${iptvOrgChannels.length} channels from cache`, 'success');
    } catch (error) {
        console.error('Error loading all IPTV-org channels:', error);
        document.getElementById('iptvOrgLoading').classList.add('hidden');
        showToast('Failed to load channels', 'error');
    }
}

async function clearCacheAndRefresh() {
    try {
        showToast('Clearing cache...', 'info');

        const sessionId = getSessionId();
        const response = await fetch(`${API_BASE}/api/v1/iptv-org/clear-cache`, {
            method: 'POST',
            headers: { 'X-Session-Id': sessionId }
        });

        if (!response.ok) {
            throw new Error('Failed to clear cache');
        }

        const data = await response.json();
        showToast(data.message || 'Cache cleared successfully', 'success');

        // Reload the data
        setTimeout(() => loadAllIptvOrgChannels(), 500);
    } catch (error) {
        console.error('Error clearing cache:', error);
        showToast('Failed to clear cache', 'error');
    }
}

// ==================== TABLE RENDERING ====================

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
        deferRender: true,
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
                const channel = iptvOrgChannels[index];
                if (channel) {
                    previewIptvOrgChannel(channel);
                }
            });

            $('#iptvOrgTable').on('click', '.btn-info-iptv', function() {
                const index = parseInt($(this).data('index'));
                const channel = iptvOrgChannels[index];
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

// ==================== SEARCH & SELECTION ====================


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

// ==================== IMPORT CHANNELS ====================

function handleImportSelected() {
    if (selectedIptvOrgChannels.size === 0) {
        showToast('Please select channels to import', 3000);
        return;
    }

    // Update count in modal
    const countEl = document.getElementById('importChannelCount');
    if (countEl) {
        countEl.textContent = selectedIptvOrgChannels.size;
    }

    // Show confirmation modal
    $('#importConfirmationModal').modal('show');
}

async function confirmImportChannels() {
    // Close modal
    $('#importConfirmationModal').modal('hide');

    const selectedChannelsData = Array.from(selectedIptvOrgChannels).map(index => iptvOrgChannels[index]);
    const replaceExisting = false;

    try {
        showToast(`Importing ${selectedChannelsData.length} channels...`, 3000);

        const sessionId = getSessionId();
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
            showToast(data.message, 3000);
            selectedIptvOrgChannels.clear();
            // Redirect to channels page after a short delay
            setTimeout(() => {
                window.location.href = '/admin/channels.html';
            }, 1500);
        } else {
            showToast(data.error || 'Import failed', 3000);
        }
    } catch (error) {
        console.error('Error importing channels:', error);
        showToast('Failed to import channels', 3000);
    }
}

// ==================== CHANNEL PREVIEW & DETAILS ====================

function previewIptvOrgChannel(channel) {
    playChannel({
        channelName: channel.channelName,
        channelUrl: channel.channelUrl,
        channelImg: channel.tvgLogo
    });
}

function handleDetailPreview() {
    if (currentChannelDetail) {
        $('#channelDetailsModal').modal('hide');
        previewIptvOrgChannel(currentChannelDetail);
    }
}

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

    $('#channelDetailsModal').modal('show');
}

// ==================== VIDEO PLAYER ====================

function cleanupVideoPlayer() {
    const video = document.getElementById('videoPlayer');

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

function playChannel(channel) {
    const modal = document.getElementById('playerModal');
    const errorBox = document.getElementById('playerError');
    const errorDetails = errorBox.querySelector('.error-details');
    const loadingBox = document.getElementById('playerLoading');
    const video = document.getElementById('videoPlayer');
    const status = document.getElementById('playerStatus');
    const name = document.getElementById('playerChannelName');
    const urlDisplay = document.getElementById('playerUrl');

    // Cleanup any previous player state
    cleanupVideoPlayer();

    // Reset state
    errorBox.classList.add('hidden');
    loadingBox.classList.remove('hidden');
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
    if (Hls.isSupported()) {
        const sessionId = getSessionId();
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
            loadingBox.classList.add('hidden');

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
                loadingBox.classList.add('hidden');
                status.textContent = '❌ Error';
                status.className = 'status-error';
                errorBox.classList.remove('hidden');

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

                errorDetails.textContent = errorMessage;
            } else {
                // Non-fatal error, just log it
                console.warn('⚠️ Non-fatal HLS error:', data.details);
            }
        });

        // Create and store event handlers for HLS.js playback
        videoEventHandlers = {
            playing: () => {
                loadingBox.classList.add('hidden');
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
                loadingBox.classList.add('hidden');
                status.textContent = '❌ Error';
                status.className = 'status-error';
                errorBox.classList.remove('hidden');

                // Get more detailed error info
                if (video.error) {
                    const errorCode = video.error.code;
                    const errorMessages = {
                        1: 'MEDIA_ERR_ABORTED: Playback was aborted',
                        2: 'MEDIA_ERR_NETWORK: Network error occurred',
                        3: 'MEDIA_ERR_DECODE: Decoding error occurred',
                        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED: Stream format not supported'
                    };
                    errorDetails.textContent = errorMessages[errorCode] || 'Unknown playback error';
                } else {
                    errorDetails.textContent = 'Video playback error: ' + (e.message || 'Unknown error');
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
                loadingBox.classList.add('hidden');
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
                loadingBox.classList.add('hidden');
                status.textContent = '❌ Error loading stream';
                status.className = 'status-error';
                errorBox.classList.remove('hidden');

                if (video.error) {
                    const errorCode = video.error.code;
                    const errorMessages = {
                        1: 'MEDIA_ERR_ABORTED: Playback was aborted',
                        2: 'MEDIA_ERR_NETWORK: Network error - stream may be offline',
                        3: 'MEDIA_ERR_DECODE: Codec/format not supported in Safari',
                        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED: HLS stream format not supported'
                    };
                    errorDetails.textContent = errorMessages[errorCode] || 'Failed to load HLS stream';
                } else {
                    errorDetails.textContent = e.message || 'Failed to load HLS stream. The stream may be offline or incompatible.';
                }
            },
            loadedmetadata: () => {
                console.log('✅ Metadata loaded');
                loadingBox.classList.add('hidden');
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
        loadingBox.classList.add('hidden');
        status.textContent = '❌ HLS not supported';
        status.className = 'status-error';
        errorBox.classList.remove('hidden');
        errorDetails.textContent = 'Your browser does not support HLS streaming. Please try using Chrome, Firefox, or Safari.';
    }

    $('#playerModal').modal('show');
    console.log('🎭 Player modal opened');
}
