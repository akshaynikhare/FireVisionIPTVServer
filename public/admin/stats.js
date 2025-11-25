// Statistics Module
// Handles statistics display and charts

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    // Show loading bar
    showLoadingBar();

    // Check authentication first
    const user = await checkAuth();
    if (!user) return; // Will redirect to login if not authenticated

    // Show dashboard with stats as active page
    showDashboard(user, 'stats');

    // Load data and hide loading bar when done
    try {
        await loadStats();
    } finally {
        hideLoadingBar();
    }
});

// Load statistics data
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/stats`, {
            headers: { 'X-Session-Id': getSessionId() }
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
        showToast('Failed to load statistics', 3000);
    }
}

// Render category chart
function renderCategoryChart(groups) {
    const chart = document.getElementById('categoryChart');
    if (!chart) return;

    chart.innerHTML = '';

    if (!groups || groups.length === 0) {
        chart.innerHTML = '<p style="text-align:center;padding:2rem;color:#6b7280;">No channel groups available</p>';
        return;
    }

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
