// Global variables for folder management
let currentFolderId = null;
let currentFolderPath = 'Share';
let foldersData = [];

// Initialize file share functionality
document.addEventListener('DOMContentLoaded', () => {
    initializeFileShare();
});

// Function called when file share tab is shown
function loadFileShareContent() {
    loadFolders();
    loadCurrentFolderFiles();
}

function initializeFileShare() {
    // File upload functionality
    const fileInput = document.getElementById('file-share-upload-input');
    const uploadButton = document.querySelector('.file-share-container .upload-btn');
    const createFolderButton = document.querySelector('.file-share-container .create-folder-btn');

    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }

    if (createFolderButton) {
        createFolderButton.addEventListener('click', showCreateFolderModal);
    }

    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Load initial data
    loadFolders();
}

// Folder management functions
function loadFolders() {
    fetch('/folders')
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch folders');
            return response.json();
        })
        .then(data => {
            foldersData = data.folders || [];
            renderFolderTree();

            // If no folder is currently selected, select the root folder
            if (currentFolderId === null && foldersData.length > 0) {
                selectFolder(foldersData[0].id, foldersData[0].name);
            }
        })
        .catch(error => {
            console.error('Error loading folders:', error);
            showError('Failed to load folders: ' + error.message);
        });
}

function renderFolderTree() {
    const folderTreeContent = document.getElementById('folder-tree-content');
    if (!folderTreeContent) return;

    folderTreeContent.innerHTML = '';

    // Render folder hierarchy (database already contains root 'Share' folder)
    function renderFolder(folder, level = 0) {
        const folderElement = document.createElement('div');
        folderElement.className = `folder-item ${currentFolderId == folder.id ? 'selected' : ''}`;
        folderElement.dataset.folderId = folder.id;
        folderElement.style.paddingLeft = `${level * 16}px`;
        folderElement.innerHTML = `
            <i class="fas fa-folder"></i>
            <span>${escapeHtml(folder.name)}</span>
            <div class="folder-actions">
                <button class="rename-btn" title="Rename" onclick="event.stopPropagation(); renameFolder(${folder.id}, '${escapeHtml(folder.name)}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" title="Delete" onclick="event.stopPropagation(); deleteFolder(${folder.id}, '${escapeHtml(folder.name)}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        folderElement.addEventListener('click', () => selectFolder(folder.id, folder.name));
        folderTreeContent.appendChild(folderElement);

        // Render children
        if (folder.children && folder.children.length > 0) {
            folder.children.forEach(child => renderFolder(child, level + 1));
        }
    }

    foldersData.forEach(folder => renderFolder(folder));
}

function selectFolder(folderId, folderName) {
    currentFolderId = folderId;

    // Build path - if it's the root folder (Share), just show 'Share', otherwise show 'Share/folderName'
    let pathParts = [];
    if (foldersData.length > 0 && folderId === foldersData[0].id) {
        // This is the root folder
        currentFolderPath = 'Share';
    } else {
        // This is a subfolder - build the full path
        currentFolderPath = `Share/${folderName}`;
    }

    // Update UI
    document.getElementById('current-folder-path').innerHTML = `
        <i class="fas fa-folder"></i> ${escapeHtml(currentFolderPath)}
    `;

    // Update selected folder visual
    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.remove('selected');
    });

    document.querySelector(`.folder-item[data-folder-id="${folderId}"]`).classList.add('selected');

    // Load files for selected folder
    loadCurrentFolderFiles();
}

function loadCurrentFolderFiles() {
    const fileList = document.getElementById('file-list');
    if (!fileList) return;

    // Check if current folder is the root folder (Share)
    const isRootFolder = currentFolderId === null || (foldersData.length > 0 && currentFolderId === foldersData[0].id);

    const url = isRootFolder ?
        '/folder-files/0' :  // Use 0 to represent root folder
        `/folder-files/${currentFolderId}`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch files');
            return response.json();
        })
        .then(data => {
            fileList.innerHTML = '';
            const files = data.files || [];

            if (files.length === 0) {
                fileList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No files in this folder</div>';
                return;
            }

            files.forEach(file => {
                // Skip files with missing required properties
                if (!file || !file.filename) {
                    console.warn('Skipping file with missing filename:', file);
                    return;
                }

                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';

                // Handle URL construction safely
                const filename = file.filename;
                // Extract the path relative to static directory
                const filepath = file.filepath;
                // Remove 'static\\' or 'static/' prefix and convert backslashes to forward slashes
                const relativePath = filepath.replace(/^static[\\\/]/, '').replace(/\\/g, '/');
                const lazyUrl = `/lazy-file/${encodeURIComponent(relativePath)}`;

                // Format upload date
                const uploadDate = file.created_at ? new Date(file.created_at).toLocaleDateString() : 'Unknown';

                // Check if file is an image for thumbnail display
                const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(filename);
                const thumbnailHtml = file.thumbnail_url && isImage ?
                    `<img src="${file.thumbnail_url}" alt="thumbnail" class="file-thumbnail" onclick="openImageModal('${lazyUrl}')">` :
                    `<i class="fas ${getFileIcon(filename)}"></i>`;

                fileItem.innerHTML = `
                    ${thumbnailHtml}
                    <div class="file-info">
                        <span class="file-name">${escapeHtml(filename)}</span>
                        <span class="file-meta">${formatFileSize(file.size)} • ${file.created_at}</span>
                    </div>
                    <div class="file-actions">
                        <a href="${lazyUrl}" download="${escapeHtml(filename)}" class="file-download">Download</a>
                        <button class="delete-btn" title="Delete" onclick="deleteFile('${escapeHtml(filename)}', ${file.folder_id})"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                fileList.appendChild(fileItem);
            });
        })
        .catch(error => {
            console.error('Error loading files:', error);
            fileList.innerHTML = '<div style="text-align: center; color: #dc3545; padding: 20px;">Failed to load files</div>';
        });
}

// File deletion function
function deleteFile(filename, folderId) {
    if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
        return;
    }

    fetch('/delete-file', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            filename: filename,
            folder_id: folderId
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to delete file');
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showSuccess(`File "${filename}" deleted successfully`);
            loadCurrentFolderFiles(); // Refresh the file list
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    })
    .catch(error => {
        console.error('Error deleting file:', error);
        showError('Failed to delete file: ' + error.message);
    });
}

// Folder creation functions
function showCreateFolderModal() {
    const modal = document.getElementById('create-folder-modal');
    const parentSelect = document.getElementById('folder-parent-select');

    if (modal && parentSelect) {
        // Populate parent folder options
        parentSelect.innerHTML = '';
        foldersData.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            if (foldersData.length > 0 && folder.id === foldersData[0].id) {
                // This is the root folder
                option.textContent = 'Share (Root)';
            } else {
                option.textContent = `Share/${folder.name}`;
            }
            parentSelect.appendChild(option);
        });

        modal.style.display = 'flex';
        document.getElementById('folder-name-input').focus();
    }
}

function hideCreateFolderModal() {
    const modal = document.getElementById('create-folder-modal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('create-folder-form').reset();
    }
}

// Event listeners for modal
document.addEventListener('DOMContentLoaded', () => {
    // Create folder form submission
    const createFolderForm = document.getElementById('create-folder-form');
    if (createFolderForm) {
        createFolderForm.addEventListener('submit', handleCreateFolder);
    }

    // Cancel button
    const cancelButton = document.querySelector('#create-folder-modal .cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', hideCreateFolderModal);
    }

    // Close modal when clicking outside
    const modal = document.getElementById('create-folder-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideCreateFolderModal();
            }
        });
    }
});

function handleCreateFolder(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const folderName = formData.get('name').trim();
    let parentId = formData.get('parent_id');

    // Convert empty string to null for root folder
    if (parentId === '') {
        parentId = null;
    }

    if (!folderName) {
        showError('Please enter a folder name');
        return;
    }

    // Validate folder name
    if (folderName.includes('/') || folderName.includes('\\') || folderName.includes(':') ||
        folderName.includes('*') || folderName.includes('?') || folderName.includes('"') ||
        folderName.includes('<') || folderName.includes('>') || folderName.includes('|')) {
        showError('Folder name contains invalid characters');
        return;
    }

    fetch('/create-folder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: folderName,
            parent_id: parentId,
            created_by: 'user'
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to create folder');
        return response.json();
    })
    .then(data => {
        hideCreateFolderModal();
        loadFolders(); // Refresh folder tree
        showSuccess(`Folder "${folderName}" created successfully`);
    })
    .catch(error => {
        console.error('Error creating folder:', error);
        showError('Failed to create folder: ' + error.message);
    });
}

function renameFolder(folderId, currentName) {
    const newName = prompt('Enter new folder name:', currentName);
    if (!newName || newName.trim() === currentName) return;

    const trimmedName = newName.trim();

    // Validate folder name
    if (trimmedName.includes('/') || trimmedName.includes('\\') || trimmedName.includes(':') ||
        trimmedName.includes('*') || trimmedName.includes('?') || trimmedName.includes('"') ||
        trimmedName.includes('<') || trimmedName.includes('>') || trimmedName.includes('|')) {
        showError('Folder name contains invalid characters');
        return;
    }

    fetch(`/rename-folder/${folderId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: trimmedName
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to rename folder');
        return response.json();
    })
    .then(data => {
        loadFolders(); // Refresh folder tree
        showSuccess(`Folder renamed to "${trimmedName}"`);
    })
    .catch(error => {
        console.error('Error renaming folder:', error);
        showError('Failed to rename folder: ' + error.message);
    });
}

function deleteFolder(folderId, folderName) {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}" and all its contents?`)) {
        return;
    }

    fetch(`/delete-folder/${folderId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to delete folder');
        return response.json();
    })
    .then(data => {
        // If current folder was deleted, go to root
        if (currentFolderId == folderId) {
            // Select the root folder (first item in foldersData)
            if (foldersData.length > 0) {
                selectFolder(foldersData[0].id, foldersData[0].name);
            }
        }
        loadFolders(); // Refresh folder tree
        showSuccess(`Folder "${folderName}" deleted successfully`);
    })
    .catch(error => {
        console.error('Error deleting folder:', error);
        showError('Failed to delete folder: ' + error.message);
    });
}

// File upload functionality
function handleFileUpload(e) {
    const files = Array.from(e.target.files).slice(0, 8);
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach(file => {
        formData.append('file', file, file.name);
    });
    formData.append('storage_dir', 'file_share_uploads');

    // Add folder ID if a folder is selected
    if (currentFolderId !== null) {
        formData.append('folder_id', currentFolderId);
    }

    const uploadButton = document.querySelector('.file-share-container .upload-btn');
    const originalText = uploadButton.textContent;
    uploadButton.textContent = 'Uploading...';
    uploadButton.disabled = true;

    fetch('/upload-file', {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        const uploadedFiles = data.urls || [];
        console.log('Files uploaded (file share):', uploadedFiles);

        // Refresh file list after upload
        loadCurrentFolderFiles();
        showSuccess(`${files.length} file(s) uploaded successfully`);
    })
    .catch(error => {
        console.error('Upload error:', error);
        showError('Failed to upload files: ' + error.message);
    })
    .finally(() => {
        uploadButton.textContent = originalText;
        uploadButton.disabled = false;
        e.target.value = '';
    });
}

// Utility functions
function getFileIcon(filename) {
    // Handle undefined, null, or empty filename
    if (!filename || typeof filename !== 'string') {
        return 'fa-file';
    }

    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word',
        'docx': 'fa-file-word',
        'txt': 'fa-file-alt',
        'md': 'fa-file-code',
        'png': 'fa-file-image',
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'gif': 'fa-file-image',
        'webp': 'fa-file-image',
        'mp4': 'fa-file-video',
        'webm': 'fa-file-video',
        'avi': 'fa-file-video',
        'mov': 'fa-file-video'
    };
    return iconMap[ext] || 'fa-file';
}

function showSuccess(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.background = '#28a745';
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
}

// Helper functions for file display
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function openImageModal(imageUrl) {
    // Use the same image viewer as the main chat for consistency
    openImageViewer(imageUrl);
}