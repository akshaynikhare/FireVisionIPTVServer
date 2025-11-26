// User Channels Page with full functionality
(async function() {
    const API_BASE = window.location.origin;
    const getSessionId = () => localStorage.getItem('sessionId');

    // Check for OAuth callback sessionId in URL
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSessionId = urlParams.get('sessionId');
    if (oauthSessionId) {
        localStorage.setItem('sessionId', oauthSessionId);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check auth and load page
    const user = await checkAuth();
    if (!user) return;
    
    showDashboard(user, 'channels');
    
    let myChannels = [];
    let channelsTable = null;
    let testQueue = [];
    let isTestingBulk = false;
    let currentEditChannelId = null;
    let pendingDeleteAction = null;

    // Initialize
    initializeEventListeners();
    await loadData();
    updateButtonStates();

    function initializeEventListeners() {
        // Bulk action buttons
        document.getElementById('addChannelBtn')?.addEventListener('click', () => openChannelModal());
        document.getElementById('bulkTestBtn')?.addEventListener('click', handleBulkTest);
        document.getElementById('bulkTestPendingBtn')?.addEventListener('click', handleTestPending);
        document.getElementById('bulkDeleteBtn')?.addEventListener('click', handleBulkDelete);
        document.getElementById('bulkDeleteNotWorkingBtn')?.addEventListener('click', handleDeleteNotWorking);
        document.getElementById('bulkDeleteAllBtn')?.addEventListener('click', handleDeleteAll);
        document.getElementById('selectAll')?.addEventListener('change', handleSelectAll);
        
        // Modals
        document.getElementById('channelForm')?.addEventListener('submit', handleChannelSubmit);
        document.getElementById('confirmDeleteAllBtn')?.addEventListener('click', confirmDeleteAll);
        document.getElementById('confirmDeleteNotWorkingBtn')?.addEventListener('click', confirmDeleteNotWorking);
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', executeDeleteAction);
        
        // Download M3U - Fixed to work with session
        document.getElementById('downloadM3U')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const sessionId = getSessionId();
            if (!sessionId) {
                showToast('Not logged in', 'error');
                return;
            }
            try {
                const response = await fetch(`${API_BASE}/api/v1/user-playlist/me/playlist.m3u`, {
                    headers: { 'X-Session-Id': sessionId }
                });
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `my-channels-${Date.now()}.m3u`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showToast('M3U downloaded successfully');
            } catch (error) {
                console.error('Download error:', error);
                showToast('Failed to download M3U', 'error');
            }
        });
    }

    function updateButtonStates() {
        const selectedCount = getSelectedChannelIds().length;
        const bulkTestBtn = document.getElementById('bulkTestBtn');
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        const bulkTestPendingBtn = document.getElementById('bulkTestPendingBtn');
        
        // Enable/disable based on selection
        if (bulkTestBtn) {
            bulkTestBtn.disabled = selectedCount === 0 || isTestingBulk;
        }
        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = selectedCount === 0;
        }
        if (bulkTestPendingBtn) {
            bulkTestPendingBtn.disabled = isTestingBulk;
        }
    }

    async function loadData() {
        try {
            document.getElementById('loadingChannels').style.display = 'block';
            
            const response = await fetch(`${API_BASE}/api/v1/user-playlist/me/channels`, {
                headers: { 'X-Session-Id': getSessionId() }
            });
            const data = await response.json();

            myChannels = data.channels || [];
            
            updateStats();
            renderTable();
            
            document.getElementById('loadingChannels').style.display = 'none';
        } catch (error) {
            console.error('Load error:', error);
            document.getElementById('loadingChannels').style.display = 'none';
            showToast('Error loading channels', 'error');
        }
    }

    function updateStats() {
        document.getElementById('myChannelCount').textContent = myChannels.length;
        
        const workingCount = myChannels.filter(ch => 
            ch.metadata?.isWorking === true || ch.testStatus === 'working'
        ).length;
        document.getElementById('workingChannels').textContent = workingCount || '0';
    }

    function renderTable() {
        const noMsg = document.getElementById('noChannelsMessage');
        const table = document.getElementById('channelsTable');
        const tbody = document.getElementById('channelsTableBody');
        
        if (myChannels.length === 0) {
            noMsg.style.display = 'block';
            table.style.display = 'none';
            return;
        }
        
        noMsg.style.display = 'none';
        table.style.display = 'table';

        // Destroy existing DataTable
        if (channelsTable) {
            channelsTable.destroy();
        }

        // Clear tbody
        tbody.innerHTML = '';

        // Build rows
        myChannels.forEach(channel => {
            const row = document.createElement('tr');
            row.dataset.channelId = channel._id;
            
            // Checkbox
            const checkCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'channel-checkbox';
            checkbox.value = channel._id;
            checkbox.addEventListener('change', updateButtonStates);
            checkCell.appendChild(checkbox);
            row.appendChild(checkCell);
            
            // Logo
            const logoCell = document.createElement('td');
            const logoUrl = (channel.tvgLogo || channel.channelImg) ? getProxiedImageUrl(channel.tvgLogo || channel.channelImg) : '/uploads/profiles/default.png';
            const uniqueId = `img-${channel._id || Math.random().toString(36).substring(2, 11)}`;
            logoCell.innerHTML = `<div class="img-loading-container" data-img-src="${logoUrl}" id="${uniqueId}"><img class="channel-logo" alt="${channel.channelName}" style="width:40px;height:40px;object-fit:contain;"></div>`;
            row.appendChild(logoCell);
            
            // Name
            const nameCell = document.createElement('td');
            nameCell.textContent = channel.channelName || 'Unknown';
            row.appendChild(nameCell);
            
            // Group
            const groupCell = document.createElement('td');
            groupCell.innerHTML = `<span class="badge badge-info">${channel.channelGroup || 'Uncategorized'}</span>`;
            row.appendChild(groupCell);
            
            // Language
            const langCell = document.createElement('td');
            const languages = channel.metadata?.language || channel.tvgLanguage || '';
            if (languages && languages.includes(',')) {
                const langArray = languages.split(',').map(l => l.trim()).filter(l => l);
                const firstLang = langArray[0];
                const remaining = langArray.length - 1;
                langCell.innerHTML = `${firstLang} <span class="badge badge-secondary" title="${langArray.join(', ')}" style="cursor: help;">+${remaining}</span>`;
            } else {
                langCell.textContent = languages || '-';
            }
            row.appendChild(langCell);
            
            // Status
            const statusCell = document.createElement('td');
            statusCell.innerHTML = getStatusBadge(channel);
            row.appendChild(statusCell);
            
            // Actions
            const actionsCell = document.createElement('td');
            actionsCell.innerHTML = `
                <button class="btn btn-sm btn-info btn-preview" title="Preview"><i class="fas fa-play"></i></button>
                <button class="btn btn-sm btn-primary btn-edit" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-secondary btn-copy" title="Copy URL"><i class="fas fa-copy"></i></button>
                <button class="btn btn-sm btn-danger btn-delete" title="Delete"><i class="fas fa-trash"></i></button>
            `;
            
            // Action event listeners
            actionsCell.querySelector('.btn-preview').addEventListener('click', () => previewChannel(channel));
            actionsCell.querySelector('.btn-edit').addEventListener('click', () => editChannel(channel));
            actionsCell.querySelector('.btn-copy').addEventListener('click', () => copyChannelUrl(channel));
            actionsCell.querySelector('.btn-delete').addEventListener('click', () => deleteChannel(channel._id));
            
            row.appendChild(actionsCell);
            tbody.appendChild(row);
        });

        // Initialize DataTable
        channelsTable = $('#channelsTable').DataTable({
            pageLength: 25,
            order: [[2, 'asc']],
            autoWidth: false,
            columns: [
                null, // Checkbox
                null, // Logo
                null, // Name
                null, // Group
                null, // Language
                null, // Status
                null  // Actions
            ],
            columnDefs: [
                { orderable: false, targets: [0, 1, 6] },
                { width: '10px', targets: 0 },
                { width: '60px', targets: 1 },
                { width: '100px', targets: 4 },
                { width: '120px', targets: 5 },
                { width: '200px', targets: 6 }
            ]
        });

        // Load images sequentially
        loadImagesSequentially('#channelsTable');

        // Initialize Bootstrap tooltips for language badges
        $('[title]').tooltip();
    }

    function getStatusBadge(channel) {
        if (channel.metadata?.isWorking === true) {
            return '<span class="badge badge-success">Working</span>';
        }
        if (channel.metadata?.isWorking === false) {
            return '<span class="badge badge-danger">Not Working</span>';
        }
        if (channel.testStatus === 'working') {
            return '<span class="badge badge-success">Working</span>';
        }
        if (channel.testStatus === 'not_working') {
            return '<span class="badge badge-danger">Not Working</span>';
        }
        return '<span class="badge badge-secondary">Pending</span>';
    }

    function handleSelectAll(e) {
        const checkboxes = document.querySelectorAll('.channel-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateButtonStates();
    }

    function getSelectedChannelIds() {
        const checkboxes = document.querySelectorAll('.channel-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // Channel Modal Functions
    function openChannelModal(channel = null) {
        const modal = $('#channelModal');
        const title = document.getElementById('modalTitle');
        
        if (channel) {
            title.textContent = 'Edit Channel';
            currentEditChannelId = channel._id;
            document.getElementById('channelIdHidden').value = channel._id;
            document.getElementById('channelId').value = channel.channelId || '';
            document.getElementById('channelName').value = channel.channelName || '';
            document.getElementById('channelUrl').value = channel.channelUrl || '';
            document.getElementById('channelImg').value = channel.tvgLogo || channel.channelImg || '';
            document.getElementById('channelGroup').value = channel.channelGroup || '';
            document.getElementById('channelLanguage').value = channel.metadata?.language || '';
        } else {
            title.textContent = 'Add Channel';
            currentEditChannelId = null;
            document.getElementById('channelForm').reset();
            document.getElementById('channelIdHidden').value = '';
        }
        
        modal.modal('show');
    }

    async function handleChannelSubmit(e) {
        e.preventDefault();
        
        const channelData = {
            channelId: document.getElementById('channelId').value,
            channelName: document.getElementById('channelName').value,
            channelUrl: document.getElementById('channelUrl').value,
            tvgLogo: document.getElementById('channelImg').value,
            channelGroup: document.getElementById('channelGroup').value,
            metadata: {
                language: document.getElementById('channelLanguage').value
            }
        };

        try {
            if (currentEditChannelId) {
                // Update existing channel
                const response = await fetch(`${API_BASE}/api/v1/channels/${currentEditChannelId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Id': getSessionId()
                    },
                    body: JSON.stringify(channelData)
                });
                
                const data = await response.json();
                if (data.success) {
                    showToast('Channel updated successfully');
                    $('#channelModal').modal('hide');
                    await loadData();
                } else {
                    showToast('Failed to update channel', 'error');
                }
            } else {
                // Create new channel and add to user's list
                const createResponse = await fetch(`${API_BASE}/api/v1/channels`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Id': getSessionId()
                    },
                    body: JSON.stringify(channelData)
                });
                
                const createData = await createResponse.json();
                if (createData.success) {
                    // Add to user's channel list
                    const addResponse = await fetch(`${API_BASE}/api/v1/user-playlist/me/channels/add`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Session-Id': getSessionId()
                        },
                        body: JSON.stringify({ channelIds: [createData.data._id] })
                    });
                    
                    const addData = await addResponse.json();
                    if (addData.success) {
                        showToast('Channel added successfully');
                        $('#channelModal').modal('hide');
                        await loadData();
                    } else {
                        showToast('Failed to add channel to your list', 'error');
                    }
                } else {
                    showToast('Failed to create channel', 'error');
                }
            }
        } catch (error) {
            console.error('Channel submit error:', error);
            showToast('Error saving channel', 'error');
        }
    }

    function editChannel(channel) {
        openChannelModal(channel);
    }

    function copyChannelUrl(channel) {
        navigator.clipboard.writeText(channel.channelUrl).then(() => {
            showToast('Channel URL copied to clipboard');
        }).catch(() => {
            showToast('Failed to copy URL', 'error');
        });
    }

    function deleteChannel(channelId) {
        const channel = myChannels.find(ch => ch._id === channelId);
        const channelName = channel ? channel.channelName : 'this channel';
        
        document.getElementById('deleteConfirmationMessage').textContent = 
            `Are you sure you want to remove "${channelName}" from your list?`;
        
        pendingDeleteAction = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/v1/user-playlist/me/channels/remove`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Id': getSessionId()
                    },
                    body: JSON.stringify({ channelIds: [channelId] })
                });
                
                const data = await response.json();
                if (data.success) {
                    showToast('Channel removed from your list');
                    $('#deleteConfirmationModal').modal('hide');
                    await loadData();
                } else {
                    showToast('Failed to remove channel', 'error');
                }
            } catch (error) {
                console.error('Delete error:', error);
                showToast('Error removing channel', 'error');
            }
        };
        
        $('#deleteConfirmationModal').modal('show');
    }

    async function executeDeleteAction() {
        if (pendingDeleteAction) {
            await pendingDeleteAction();
            pendingDeleteAction = null;
        }
    }

    // Global HLS instance for cleanup
    let currentHls = null;

    // Preview Channel
    function previewChannel(channel) {
        const modal = $('#playerModal');
        const video = document.getElementById('videoPlayer');
        const channelName = document.getElementById('playerChannelName');
        const urlSpan = document.getElementById('playerUrl');
        const statusSpan = document.getElementById('playerStatus');
        
        // Cleanup previous player
        cleanupPlayer();
        
        channelName.textContent = channel.channelName;
        urlSpan.textContent = channel.channelUrl;
        statusSpan.textContent = 'Loading...';
        
        video.src = '';
        
        if (Hls.isSupported() && channel.channelUrl.includes('.m3u8')) {
            currentHls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90
            });
            
            currentHls.loadSource(channel.channelUrl);
            currentHls.attachMedia(video);
            
            currentHls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().then(() => {
                    statusSpan.textContent = 'Playing (HLS)';
                }).catch(err => {
                    statusSpan.textContent = 'Playback blocked: ' + err.message;
                });
            });
            
            currentHls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            statusSpan.textContent = 'Network Error - Stream unavailable';
                            currentHls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            statusSpan.textContent = 'Media Error - Attempting recovery...';
                            currentHls.recoverMediaError();
                            break;
                        default:
                            statusSpan.textContent = 'Fatal Error - Cannot play stream';
                            cleanupPlayer();
                            break;
                    }
                } else {
                    // Non-fatal errors - just log, don't show to user if playing
                    if (video.paused) {
                        statusSpan.textContent = 'Stream issue: ' + data.details;
                    }
                }
            });
        } else {
            video.src = channel.channelUrl;
            video.play().then(() => {
                statusSpan.textContent = 'Playing';
            }).catch(err => {
                statusSpan.textContent = 'Error: ' + err.message;
            });
        }
        
        modal.modal('show');
    }

    function cleanupPlayer() {
        const video = document.getElementById('videoPlayer');
        
        // Stop video
        if (video) {
            video.pause();
            video.src = '';
            video.load();
        }
        
        // Destroy HLS instance
        if (currentHls) {
            currentHls.destroy();
            currentHls = null;
        }
    }

    // Cleanup when modal is closed
    $('#playerModal').on('hidden.bs.modal', function () {
        cleanupPlayer();
    });

    // Bulk Test Functions
    async function handleBulkTest() {
        const selectedIds = getSelectedChannelIds();
        if (selectedIds.length === 0) {
            showToast('Please select channels to test', 'warning');
            return;
        }
        
        if (isTestingBulk) {
            showToast('Testing already in progress', 'warning');
            return;
        }
        
        // Check server lock
        try {
            const lockCheck = await fetch(`${API_BASE}/api/v1/channels/test-status`, {
                headers: { 'X-Session-Id': getSessionId() }
            });
            const lockData = await lockCheck.json();
            if (lockData.isLocked) {
                showToast('Another test operation is in progress. Please wait.', 'warning');
                return;
            }
        } catch (error) {
            // Continue if endpoint doesn't exist
        }
        
        testQueue = selectedIds;
        isTestingBulk = true;
        updateButtonStates();
        document.getElementById('testProgress').textContent = `Testing 0/${testQueue.length}`;
        
        await testChannelsSequentially();
    }

    async function handleTestPending() {
        const pendingChannels = myChannels.filter(ch => !ch.testStatus || ch.testStatus === 'pending');
        if (pendingChannels.length === 0) {
            showToast('No pending channels to test', 'info');
            return;
        }
        
        if (isTestingBulk) {
            showToast('Testing already in progress', 'warning');
            return;
        }
        
        // Check server lock
        try {
            const lockCheck = await fetch(`${API_BASE}/api/v1/channels/test-status`, {
                headers: { 'X-Session-Id': getSessionId() }
            });
            const lockData = await lockCheck.json();
            if (lockData.isLocked) {
                showToast('Another test operation is in progress. Please wait.', 'warning');
                return;
            }
        } catch (error) {
            // Continue if endpoint doesn't exist
        }
        
        testQueue = pendingChannels.map(ch => ch._id);
        isTestingBulk = true;
        updateButtonStates();
        document.getElementById('testProgress').textContent = `Testing 0/${testQueue.length}`;
        
        await testChannelsSequentially();
    }

    async function testChannelsSequentially() {
        let tested = 0;
        let successful = 0;
        
        for (const channelId of testQueue) {
            try {
                const response = await fetch(`${API_BASE}/api/v1/channels/${channelId}/test`, {
                    method: 'POST',
                    headers: { 'X-Session-Id': getSessionId() }
                });
                const result = await response.json();
                if (result.success) successful++;
                tested++;
                document.getElementById('testProgress').textContent = `Testing ${tested}/${testQueue.length}`;
                // Small delay between tests
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error('Test error:', error);
                tested++;
            }
        }
        
        document.getElementById('testProgress').textContent = '';
        isTestingBulk = false;
        updateButtonStates();
        showToast(`Tested ${tested} channels (${successful} responded)`);
        await loadData();
    }

    // Bulk Delete Functions
    function handleBulkDelete() {
        const selectedIds = getSelectedChannelIds();
        if (selectedIds.length === 0) {
            showToast('Please select channels to delete', 'warning');
            return;
        }
        
        document.getElementById('deleteConfirmationMessage').textContent = 
            `Are you sure you want to remove ${selectedIds.length} selected channels from your list?`;
        
        pendingDeleteAction = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/v1/user-playlist/me/channels/remove`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Id': getSessionId()
                    },
                    body: JSON.stringify({ channelIds: selectedIds })
                });
                
                const data = await response.json();
                if (data.success) {
                    showToast(`Removed ${data.removedCount} channels`);
                    $('#deleteConfirmationModal').modal('hide');
                    await loadData();
                } else {
                    showToast('Failed to remove channels', 'error');
                }
            } catch (error) {
                console.error('Bulk delete error:', error);
                showToast('Error removing channels', 'error');
            }
        };
        
        $('#deleteConfirmationModal').modal('show');
    }

    function handleDeleteNotWorking() {
        const notWorkingChannels = myChannels.filter(ch => 
            ch.metadata?.isWorking === false || ch.testStatus === 'not_working'
        );
        if (notWorkingChannels.length === 0) {
            showToast('No non-working channels found', 'info');
            return;
        }
        
        document.getElementById('notWorkingCount').textContent = notWorkingChannels.length;
        $('#deleteNotWorkingConfirmationModal').modal('show');
    }

    async function confirmDeleteNotWorking() {
        const notWorkingIds = myChannels
            .filter(ch => ch.metadata?.isWorking === false || ch.testStatus === 'not_working')
            .map(ch => ch._id);
        
        try {
            const response = await fetch(`${API_BASE}/api/v1/user-playlist/me/channels/remove`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': getSessionId()
                },
                body: JSON.stringify({ channelIds: notWorkingIds })
            });
            
            const data = await response.json();
            if (data.success) {
                showToast(`Removed ${data.removedCount} non-working channels`);
                $('#deleteNotWorkingConfirmationModal').modal('hide');
                await loadData();
            } else {
                showToast('Failed to remove channels', 'error');
            }
        } catch (error) {
            console.error('Delete not working error:', error);
            showToast('Error removing channels', 'error');
        }
    }

    function handleDeleteAll() {
        $('#deleteAllConfirmationModal').modal('show');
    }

    async function confirmDeleteAll() {
        const allIds = myChannels.map(ch => ch._id);
        
        try {
            const response = await fetch(`${API_BASE}/api/v1/user-playlist/me/channels/remove`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': getSessionId()
                },
                body: JSON.stringify({ channelIds: allIds })
            });
            
            const data = await response.json();
            if (data.success) {
                showToast('All channels removed from your list');
                $('#deleteAllConfirmationModal').modal('hide');
                await loadData();
            } else {
                showToast('Failed to remove all channels', 'error');
            }
        } catch (error) {
            console.error('Delete all error:', error);
            showToast('Error removing all channels', 'error');
        }
    }
})();
