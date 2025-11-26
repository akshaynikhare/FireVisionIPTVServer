// Admin Pair Device Page
(async function() {
    const API_BASE = window.location.origin;
    const getSessionId = () => localStorage.getItem('sessionId');

    // Check auth and load page
    const user = await checkAuth();
    if (!user) return;
    
    showDashboard(user, 'pair-device');
    
    // Load device info after a small delay to ensure DOM is ready
    setTimeout(() => {
        loadDeviceInfo(user);
    }, 100);
    
    // Focus on PIN input
    setTimeout(() => {
        const pinInput = document.getElementById('pinInput');
        if (pinInput) pinInput.focus();
    }, 200);
    
    // Auto-format PIN input (digits only)
    document.getElementById('pinInput').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });
    
    // Allow Enter key to trigger pairing
    document.getElementById('pinInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePairing();
        }
    });
    
    // Handle pairing button click
    document.getElementById('pairBtn').addEventListener('click', (e) => {
        e.preventDefault();
        handlePairing();
    });

    function handlePairing() {
        const pin = document.getElementById('pinInput').value.trim();
        const statusDiv = document.getElementById('statusMessage');
        const pairBtn = document.getElementById('pairBtn');
        
        if (pin.length !== 6) {
            showStatus('PIN must be exactly 6 digits', 'error');
            return;
        }
        
        // Verify we have a session
        const sessionId = getSessionId();
        if (!sessionId) {
            showStatus('Not authenticated. Please refresh the page and log in.', 'error');
            return;
        }
        
        pairBtn.disabled = true;
        pairBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Pairing...';
        
        // Create XHR request
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/api/v1/tv/pairing/confirm`, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-Session-Id', sessionId);
        
        xhr.onload = function() {
            try {
                const data = JSON.parse(xhr.responseText);
                
                if (xhr.status === 200 && data.success) {
                    showStatus(`
                        <div class="pairing-success">
                            <h5><i class="fas fa-check-circle mr-2"></i>Device Paired Successfully!</h5>
                            <p><strong>Device:</strong> ${data.device.name} (${data.device.model})</p>
                            <p><strong>Channel List Code:</strong> <code>${data.user.channelListCode}</code></p>
                            <p class="mb-0">Your TV is now linked to your account. The app will load your channels automatically.</p>
                        </div>
                    `, 'success');
                    
                    document.getElementById('pinInput').value = '';
                    
                    // Reload device info
                    checkAuth(true).then(user => {
                        if (user) loadDeviceInfo(user);
                    });
                } else {
                    const errorMsg = data.error || 'Failed to pair device';
                    showStatus(errorMsg, 'error');
                    console.error('Pairing failed:', data);
                }
            } catch (e) {
                console.error('Error parsing response:', e);
                showStatus('Invalid response from server.', 'error');
            }
            
            pairBtn.disabled = false;
            pairBtn.innerHTML = '<i class="fas fa-link mr-2"></i>Pair Device';
        };
        
        xhr.onerror = function() {
            console.error('XHR error');
            showStatus('Connection error. Please try again.', 'error');
            pairBtn.disabled = false;
            pairBtn.innerHTML = '<i class="fas fa-link mr-2"></i>Pair Device';
        };
        
        xhr.send(JSON.stringify({ pin: pin }));
    }
    
    function showStatus(message, type) {
        const statusDiv = document.getElementById('statusMessage');
        statusDiv.style.display = 'block';
        
        if (type === 'success') {
            statusDiv.innerHTML = message;
        } else if (type === 'error') {
            statusDiv.innerHTML = `
                <div class="pairing-error">
                    <h5><i class="fas fa-exclamation-circle mr-2"></i>Error</h5>
                    <p class="mb-0">${message}</p>
                </div>
            `;
        }
    }
    
    async function loadDeviceInfo(user) {
        const deviceDiv = document.getElementById('deviceInfo');
        
        if (!deviceDiv) {
            console.warn('Device info div not found, retrying...');
            setTimeout(() => loadDeviceInfo(user), 100);
            return;
        }
        
        // Show loading state
        deviceDiv.innerHTML = '<p class="text-muted"><i class="fas fa-spinner fa-spin mr-2"></i>Loading device information...</p>';
        
        try {
            // Fetch fresh user data from API
            const sessionId = getSessionId();
            const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
                headers: { 'X-Session-Id': sessionId }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load user data');
            }
            
            const data = await response.json();
            const freshUser = data.user;
            
            // Display device info
            if (freshUser.metadata && freshUser.metadata.lastPairedDevice) {
                const pairedDate = freshUser.metadata.pairedAt ? 
                    new Date(freshUser.metadata.pairedAt).toLocaleString() : 'Unknown';
                
                deviceDiv.innerHTML = `
                    <div class="info-box">
                        <span class="info-box-icon bg-info"><i class="fas fa-tv"></i></span>
                        <div class="info-box-content">
                            <span class="info-box-text">Last Paired Device</span>
                            <span class="info-box-number">${freshUser.metadata.lastPairedDevice}</span>
                            <small>Model: ${freshUser.metadata.deviceModel || 'Unknown'}</small><br>
                            <small>Paired: ${pairedDate}</small>
                        </div>
                    </div>
                    <div class="alert alert-info mt-3">
                        <i class="fas fa-key mr-2"></i>
                        <strong>Your Channel List Code:</strong> <code class="h5">${freshUser.channelListCode}</code>
                    </div>
                    <p class="text-muted">
                        <small><i class="fas fa-info-circle mr-1"></i>Use this code in your TV app to load your channels.</small>
                    </p>
                `;
            } else {
                deviceDiv.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-info-circle mr-2"></i>
                        <strong>No devices paired yet.</strong> Enter a PIN from your TV to get started.
                    </div>
                    <div class="alert alert-info">
                        <i class="fas fa-key mr-2"></i>
                        <strong>Your Channel List Code:</strong> <code class="h5">${freshUser.channelListCode}</code>
                    </div>
                    <p class="text-muted">
                        <small><i class="fas fa-info-circle mr-1"></i>Use this code in your TV app to load your channels.</small>
                    </p>
                `;
            }
        } catch (error) {
            console.error('Error loading device info:', error);
            deviceDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    Failed to load device information. Please refresh the page.
                </div>
            `;
        }
    }
})();
