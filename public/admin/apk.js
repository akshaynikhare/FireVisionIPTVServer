// APK Manager Module
// Handles APK version management, uploads, and downloads

// State
let apkVersions = [];
let apkDataTable = null;

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    AdminCore.initPage('apk', async () => {
        initializeApkManagerListeners();
        await loadApkVersions();
    });
});

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
    
    if (loadingEl) loadingEl.style.display = 'block';

    try {
        // Use the new JSON-based public endpoint (no auth needed)
        const response = await fetch(`${API_BASE}/api/v1/app/versions`);

        if (!response.ok) {
            throw new Error('Failed to fetch APK versions');
        }

        const data = await response.json();
        apkVersions = data.data || [];

        renderApkVersionsTable(apkVersions);
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
function renderApkVersionsTable(versions) {
    // Wait for jQuery and DataTables to be ready
    if (typeof $ === 'undefined' || typeof $.fn.DataTable === 'undefined') {
        console.log('Waiting for jQuery/DataTables to load...');
        setTimeout(() => renderApkVersionsTable(versions), 100);
        return;
    }

    // Destroy existing DataTable if it exists
    if (apkDataTable) {
        apkDataTable.destroy();
        apkDataTable = null;
    }

    // Initialize DataTable
    apkDataTable = $('#apkVersionsTable').DataTable({
        data: versions,
        pageLength: 10,
        deferRender: true,
        order: [[1, 'desc']], // Sort by Version Code descending
        columns: [
            {
                // Version Name
                data: 'versionName',
                render: function(data) {
                    return `<strong>${data}</strong>`;
                }
            },
            {
                // Version Code
                data: 'versionCode'
            },
            {
                // File Name
                data: 'apkFileName',
                render: function(data) {
                    return `<code>${data || 'N/A'}</code>`;
                }
            },
            {
                // Size
                data: 'apkFileSize',
                render: function(data) {
                    return formatFileSize(data);
                }
            },
            {
                // Status
                data: 'isActive',
                render: function(data) {
                    return `<span class="badge ${data ? 'badge-success' : 'badge-inactive'}">${data ? 'Active' : 'Inactive'}</span>`;
                }
            },
            {
                // Mandatory
                data: 'isMandatory',
                render: function(data) {
                    return `<span class="badge ${data ? 'badge-warning' : 'badge-info'}">${data ? 'Yes' : 'No'}</span>`;
                }
            },
            {
                // Released
                data: 'releasedAt',
                render: function(data) {
                    return formatDate(data);
                }
            },
            {
                // Actions
                data: null,
                orderable: false,
                render: function(data, type, row) {
                    return `
                        <button class="btn btn-sm btn-info btn-view" data-code="${row.versionCode}">View</button>
                        <button class="btn btn-sm btn-primary btn-download" data-file="${row.apkFileName}">Download</button>
                    `;
                }
            }
        ],
        initComplete: function() {
            // Event delegation for buttons
            $('#apkVersionsTable').on('click', '.btn-view', function() {
                const code = $(this).data('code');
                viewApkDetails(code);
            });

            $('#apkVersionsTable').on('click', '.btn-download', function() {
                const file = $(this).data('file');
                downloadApk(file);
            });
        }
    });
}

// Update APK statistics
function updateApkStats() {
    const activeEl = document.getElementById('activeApkVersions');
    const latestNameEl = document.getElementById('latestVersionName');
    const latestCodeEl = document.getElementById('latestVersionCode');

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
        xhr.setRequestHeader('X-Session-Id', getSessionId());
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
                'X-Session-Id': getSessionId()
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
            headers: { 'X-Session-Id': getSessionId() }
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
