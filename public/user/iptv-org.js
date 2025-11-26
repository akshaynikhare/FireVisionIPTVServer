// User IPTV-org Import Page - Loads admin functionality and overrides import for user context
(function() {
    // Wait for admin script to load then override the import function
    function waitForAdminScript() {
        if (typeof window.confirmImportChannels === 'undefined' || typeof window.iptvOrgChannels === 'undefined') {
            setTimeout(waitForAdminScript, 100);
            return;
        }
        
        console.log('Admin IPTV-org script loaded, overriding import function for user context');
        
        // Store original function
        const originalConfirmImport = window.confirmImportChannels;
        
        // Override the confirmImportChannels function for user context
        window.confirmImportChannels = async function() {
            console.log('🔵 User import function called');
            $('#importConfirmationModal').modal('hide');
            
            if (!window.selectedIptvOrgChannels || window.selectedIptvOrgChannels.size === 0) {
                console.error('❌ No channels selected');
                showToast('No channels selected', 3000);
                return;
            }
            
            const selectedChannelsData = Array.from(window.selectedIptvOrgChannels).map(index => window.iptvOrgChannels[index]);
            console.log('📋 Selected channels:', selectedChannelsData.length, selectedChannelsData[0]);

            try {
                showLoadingBar();
                showToast(`Importing ${selectedChannelsData.length} channels to your personal channel list...`, 3000);
                
                const sessionId = getSessionId();
                console.log('🔑 Session ID:', sessionId ? 'Present' : 'Missing');
                
                // Prepare channel data for import
                const channelsToImport = selectedChannelsData.map(ch => {
                    const channelData = {
                        id: ch.channelId || ch.id,
                        name: ch.channelName || ch.name,
                        url: ch.channelUrl || ch.url,
                        logo: ch.tvgLogo || ch.channelImg || ch.logo,
                        category: ch.channelGroup || ch.category || 'IPTV-org',
                        country: ch.tvgCountry || ch.country,
                        language: ch.tvgLanguage || ch.language
                    };
                    return channelData;
                });
                
                console.log('📤 Sending request to /api/v1/iptv-org/import-user');
                console.log('📦 First channel data:', channelsToImport[0]);
                
                // Import channels using the user import endpoint which handles both channel creation and assignment
                const response = await fetch(`${API_BASE}/api/v1/iptv-org/import-user`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Session-Id': sessionId 
                    },
                    body: JSON.stringify({ 
                        channels: channelsToImport
                    })
                });
                
                console.log('📥 Response status:', response.status, response.statusText);
                
                const data = await response.json();
                console.log('📋 Import response:', data);

                hideLoadingBar();
                
                if (response.ok && data.success) {
                    window.selectedIptvOrgChannels.clear();
                    const imported = data.addedCount || 0;
                    const skipped = selectedChannelsData.length - imported;
                    showToast(`✅ Imported ${imported} channels to your personal channel list! ${skipped > 0 ? `(${skipped} skipped)` : ''}`, 5000);
                    
                    // Redirect to channels page
                    setTimeout(() => {
                        window.location.href = '/user/channels.html';
                    }, 2000);
                } else {
                    showToast(`❌ Import failed: ${data.error || 'Unknown error'}`, 5000);
                }
                
            } catch (error) {
                console.error('❌ Import error:', error);
                hideLoadingBar();
                showToast(`❌ Failed to import channels: ${error.message}`, 5000);
            }
        };
    }
    
    // Start waiting for admin script
    waitForAdminScript();
})();
