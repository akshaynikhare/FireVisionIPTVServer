// Statistics Module
// Handles statistics display and charts

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    AdminCore.initPage('stats', async () => {
        await loadStats();
        // Auto-refresh every 30 seconds for live data
        setInterval(loadStats, 30000);
    });
});

// Load statistics data
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/stats/detailed`, {
            headers: { 'X-Session-Id': getSessionId() }
        });

        const data = await response.json();

        if (data.success) {
            const stats = data.data;

            // Update channel stats
            document.getElementById('statTotalChannels').textContent = stats.channels?.total || 0;
            document.getElementById('statActiveChannels').textContent = stats.channels?.active || 0;
            document.getElementById('statInactiveChannels').textContent = stats.channels?.inactive || 0;
            document.getElementById('statTotalVersions').textContent = stats.app?.totalVersions || 0;
            
            // Update user stats
            document.getElementById('statTotalUsers').textContent = stats.users?.total || 0;
            document.getElementById('statActiveSessions').textContent = stats.sessions?.active || 0;
            
            // Update pairing stats
            document.getElementById('statTotalPairings').textContent = stats.pairings?.total || 0;
            document.getElementById('statPendingPairings').textContent = stats.pairings?.pending || 0;
            
            // Update live users count
            const liveCount = stats.sessions?.activeSessions?.length || 0;
            document.getElementById('liveUsersCount').textContent = `${liveCount} online`;
            
            // Render tables and charts
            renderLiveUsers(stats.sessions?.activeSessions || []);
            renderRecentPairings(stats.pairings?.recent || []);
            renderLocationChart(stats.sessions?.byLocation || []);
            renderRecentUsers(stats.users?.recent || []);
            renderCategoryChart(stats.channels?.byGroup || []);
            renderActivityTimeline(stats.activity || []);
            
            // Update recent pairings count
            const todayPairings = stats.pairings?.todayCount || 0;
            document.getElementById('recentPairingsCount').textContent = `${todayPairings} today`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Failed to load statistics', 3000);
    }
}

// Render live users table
function renderLiveUsers(sessions) {
    const table = document.getElementById('liveUsersTable');
    if (!table) return;
    
    if (!sessions || sessions.length === 0) {
        table.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4"><i class="fas fa-user-slash mr-2"></i>No active sessions</td></tr>';
        return;
    }
    
    table.innerHTML = sessions.map(session => {
        const lastActivity = session.lastActivity ? getTimeAgo(new Date(session.lastActivity)) : 'Unknown';
        const location = session.location || extractLocation(session.ipAddress);
        const device = extractDevice(session.userAgent);
        const isOnline = isRecentlyActive(session.lastActivity);
        
        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <span class="status-dot ${isOnline ? 'bg-success' : 'bg-secondary'} mr-2"></span>
                        <div>
                            <strong>${escapeHtml(session.username || 'Unknown')}</strong>
                            <br><small class="text-muted">${escapeHtml(session.email || '')}</small>
                        </div>
                    </div>
                </td>
                <td><i class="fas fa-map-marker-alt text-muted mr-1"></i>${escapeHtml(location)}</td>
                <td><small>${lastActivity}</small></td>
                <td><small class="text-muted">${escapeHtml(device)}</small></td>
            </tr>
        `;
    }).join('');
}

// Render recent pairings table
function renderRecentPairings(pairings) {
    const table = document.getElementById('recentPairingsTable');
    if (!table) return;
    
    if (!pairings || pairings.length === 0) {
        table.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4"><i class="fas fa-unlink mr-2"></i>No recent pairings</td></tr>';
        return;
    }
    
    table.innerHTML = pairings.map(pairing => {
        const time = getTimeAgo(new Date(pairing.createdAt || pairing.pairedAt));
        const statusClass = getStatusClass(pairing.status);
        const deviceIcon = getDeviceIcon(pairing.deviceModel);
        
        return `
            <tr>
                <td>
                    <i class="${deviceIcon} text-muted mr-2"></i>
                    <span>${escapeHtml(pairing.deviceName || 'Unknown Device')}</span>
                    <br><small class="text-muted">${escapeHtml(pairing.deviceModel || '')}</small>
                </td>
                <td>${escapeHtml(pairing.username || pairing.userId?.username || 'N/A')}</td>
                <td><span class="badge ${statusClass}">${pairing.status || 'unknown'}</span></td>
                <td><small>${time}</small></td>
            </tr>
        `;
    }).join('');
}

// Render location chart
function renderLocationChart(locations) {
    const chart = document.getElementById('locationChart');
    if (!chart) return;
    
    if (!locations || locations.length === 0) {
        chart.innerHTML = '<div class="text-center text-muted py-5"><i class="fas fa-globe fa-3x mb-3"></i><p>No location data available</p></div>';
        return;
    }
    
    const maxCount = Math.max(...locations.map(l => l.count));
    
    chart.innerHTML = locations.slice(0, 8).map(loc => {
        const width = (loc.count / maxCount) * 100;
        const countryCode = loc._id || 'Unknown';
        const flag = getFlagEmoji(countryCode);
        
        return `
            <div class="location-bar mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span>${flag} ${escapeHtml(getCountryName(countryCode))}</span>
                    <span class="badge badge-secondary">${loc.count}</span>
                </div>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar bg-success" style="width: ${width}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Render recent users list
function renderRecentUsers(users) {
    const list = document.getElementById('recentUsersList');
    if (!list) return;
    
    if (!users || users.length === 0) {
        list.innerHTML = '<li class="list-group-item text-center text-muted py-4"><i class="fas fa-user-plus mr-2"></i>No recent users</li>';
        return;
    }
    
    list.innerHTML = users.map(user => {
        const time = getTimeAgo(new Date(user.createdAt));
        const avatar = user.profilePicture || getDefaultAvatar(user.username);
        
        return `
            <li class="list-group-item d-flex align-items-center py-2">
                <img src="${escapeHtml(avatar)}" alt="" class="rounded-circle mr-3" style="width: 40px; height: 40px; object-fit: cover;"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%236c757d%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2240%22>${user.username?.charAt(0).toUpperCase() || 'U'}</text></svg>'">
                <div class="flex-grow-1">
                    <strong>${escapeHtml(user.username)}</strong>
                    <br><small class="text-muted">${escapeHtml(user.email)}</small>
                </div>
                <div class="text-right">
                    <span class="badge ${user.role === 'Admin' ? 'badge-danger' : 'badge-primary'}">${user.role}</span>
                    <br><small class="text-muted">${time}</small>
                </div>
            </li>
        `;
    }).join('');
}

// Render category chart (enhanced)
function renderCategoryChart(groups) {
    const chart = document.getElementById('categoryChart');
    if (!chart) return;

    chart.innerHTML = '';

    if (!groups || groups.length === 0) {
        chart.innerHTML = '<div class="text-center text-muted py-5"><i class="fas fa-folder-open fa-3x mb-3"></i><p>No channel groups available</p></div>';
        return;
    }

    const maxCount = Math.max(...groups.map(g => g.count));
    const colors = ['bg-primary', 'bg-success', 'bg-info', 'bg-warning', 'bg-danger', 'bg-secondary', 'bg-dark', 'bg-purple'];

    chart.innerHTML = groups.slice(0, 10).map((group, index) => {
        const width = (group.count / maxCount) * 100;
        const colorClass = colors[index % colors.length];

        return `
            <div class="category-item mb-2">
                <div class="d-flex justify-content-between mb-1">
                    <span class="font-weight-bold">${escapeHtml(group._id || 'Uncategorized')}</span>
                    <span class="text-muted">${group.count}</span>
                </div>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar ${colorClass}" style="width: ${width}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Render activity timeline
function renderActivityTimeline(activities) {
    const timeline = document.getElementById('activityTimeline');
    if (!timeline) return;
    
    if (!activities || activities.length === 0) {
        timeline.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-clock fa-2x mb-2"></i><p>No recent activity</p></div>';
        return;
    }
    
    timeline.innerHTML = activities.map((activity, index) => {
        const time = getTimeAgo(new Date(activity.timestamp || activity.createdAt));
        const icon = getActivityIcon(activity.type);
        const bgColor = getActivityColor(activity.type);
        const isLast = index === activities.length - 1;
        
        return `
            <div class="timeline-item">
                <i class="fas ${icon} bg-${bgColor}"></i>
                <div class="timeline-item-content">
                    <span class="time"><i class="fas fa-clock"></i> ${time}</span>
                    <h3 class="timeline-header">${escapeHtml(activity.title || activity.type)}</h3>
                    <div class="timeline-body">${escapeHtml(activity.description || '')}</div>
                </div>
            </div>
        `;
    }).join('') + '<div class="timeline-item"><i class="fas fa-clock bg-gray"></i></div>';
}

// Helper functions
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

function isRecentlyActive(lastActivity) {
    if (!lastActivity) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return (new Date() - new Date(lastActivity)) < fiveMinutes;
}

function extractLocation(ip) {
    if (!ip) return 'Unknown';
    // Simplified - in production, use a geolocation service
    return ip.startsWith('192.168') || ip.startsWith('10.') ? 'Local Network' : 'Remote';
}

function extractDevice(userAgent) {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Fire TV') || userAgent.includes('AFT')) return 'Fire TV';
    if (userAgent.includes('Android TV')) return 'Android TV';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    return 'Browser';
}

function getDeviceIcon(model) {
    if (!model) return 'fas fa-question-circle';
    const m = model.toLowerCase();
    if (m.includes('fire') || m.includes('aft')) return 'fas fa-fire';
    if (m.includes('tv')) return 'fas fa-tv';
    if (m.includes('phone') || m.includes('mobile')) return 'fas fa-mobile-alt';
    if (m.includes('tablet')) return 'fas fa-tablet-alt';
    return 'fas fa-desktop';
}

function getStatusClass(status) {
    switch(status) {
        case 'completed': return 'badge-success';
        case 'pending': return 'badge-warning';
        case 'expired': return 'badge-secondary';
        default: return 'badge-info';
    }
}

function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode === 'Unknown' || countryCode.length !== 2) return '🌍';
    const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}

function getCountryName(code) {
    const countries = {
        'US': 'United States', 'GB': 'United Kingdom', 'IN': 'India', 'CA': 'Canada',
        'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'JP': 'Japan',
        'BR': 'Brazil', 'Unknown': 'Unknown Location', 'Local': 'Local Network'
    };
    return countries[code] || code;
}

function getActivityIcon(type) {
    const icons = {
        'login': 'fa-sign-in-alt', 'logout': 'fa-sign-out-alt', 'register': 'fa-user-plus',
        'pairing': 'fa-link', 'channel_add': 'fa-plus', 'channel_update': 'fa-edit',
        'channel_delete': 'fa-trash', 'app_update': 'fa-download'
    };
    return icons[type] || 'fa-info-circle';
}

function getActivityColor(type) {
    const colors = {
        'login': 'success', 'logout': 'secondary', 'register': 'info',
        'pairing': 'primary', 'channel_add': 'success', 'channel_update': 'warning',
        'channel_delete': 'danger', 'app_update': 'purple'
    };
    return colors[type] || 'secondary';
}

function getDefaultAvatar(username) {
    const initial = (username || 'U').charAt(0).toUpperCase();
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%236c757d" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="white" font-size="40">${initial}</text></svg>`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
