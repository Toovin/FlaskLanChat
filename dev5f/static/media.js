// static/media.js
let selectedFileItem = null;

document.addEventListener('DOMContentLoaded', () => {
    const mediaUrlInput = document.getElementById('media-url-input');
    const mediaDownloadButton = document.querySelector('#tab-content-media .download-btn');
    const mediaUploadButton = document.querySelector('#tab-content-media .upload-btn');
    const mediaUploadInput = document.getElementById('media-upload-input');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const videoPlayer = document.getElementById('media-player-video');
    const audioPlayer = document.getElementById('media-player-audio');

    if (mediaUploadButton) {
        mediaUploadButton.addEventListener('click', () => {
            mediaUploadInput.click();
        });
    }

    if (mediaUploadInput) {
        mediaUploadInput.addEventListener('change', async (event) => {
            const files = event.target.files;
            if (!files || files.length === 0) return;

            for (const file of files) {
                await uploadMediaFile(file);
            }
            // Clear the input
            mediaUploadInput.value = '';
            // Reload media content
            loadMediaContent();
        });
    }

    if (mediaDownloadButton) {
        mediaDownloadButton.addEventListener('click', async () => {
            const url = mediaUrlInput.value.trim();
            if (!url) {
                showError('Please enter a valid URL');
                return;
            }

            // Disable button and show loading state
            mediaDownloadButton.disabled = true;
            mediaDownloadButton.textContent = 'Downloading...';

            try {
                const response = await fetch('/download-media', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                console.log('Media download initiated:', data.download_id);

                // The progress will be handled by socket events
                // We'll reload media content when download completes
            } catch (error) {
                console.error('Download error:', error);
                showError('Failed to download media: ' + error.message);
                // Reset button state on error
                mediaDownloadButton.disabled = false;
                mediaDownloadButton.textContent = 'Download';
            }
            mediaUrlInput.value = '';
        });
    }

    // Player controls
    playPauseBtn.addEventListener('click', () => {
        const activePlayer = videoPlayer.style.display !== 'none' ? videoPlayer : audioPlayer;
        if (activePlayer.paused) {
            activePlayer.play();
            playPauseBtn.textContent = 'Pause';
        } else {
            activePlayer.pause();
            playPauseBtn.textContent = 'Play';
        }
    });

    stopBtn.addEventListener('click', () => {
        videoPlayer.pause();
        audioPlayer.pause();
        videoPlayer.src = '';
        audioPlayer.src = '';
        videoPlayer.style.display = 'none';
        audioPlayer.style.display = 'none';
        document.querySelector('.player-placeholder').style.display = 'block';
        playPauseBtn.textContent = 'Play';
        if (selectedFileItem) {
            selectedFileItem.classList.remove('selected');
            selectedFileItem = null;
        }
    });

    // Update play/pause button on player events
    [videoPlayer, audioPlayer].forEach(player => {
        player.addEventListener('play', () => {
            playPauseBtn.textContent = 'Pause';
        });
        player.addEventListener('pause', () => {
            playPauseBtn.textContent = 'Play';
        });
        player.addEventListener('ended', () => {
            playPauseBtn.textContent = 'Play';
        });
    });

    // General tab switching logic
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchToTab(tabName);
            if (tabName === 'media') {
                loadMediaContent();
            }
            // Add other tab-specific loads if needed
        });
    });

    // Initialize tab display
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        switchToTab(activeTab.dataset.tab);
    }
});

function switchToTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.style.display = 'none';
    });

    // Show the selected tab content
    const targetContent = document.getElementById(`tab-content-${tabName}`);
    if (targetContent) {
        targetContent.style.display = 'flex';
    }

    // Update active tab
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
}

function loadMediaContent() {
    const filesGrid = document.querySelector('#tab-content-media .media-files-grid');
    if (!filesGrid) {
        console.error('Media files grid not found');
        showError('Media files grid not found. Please refresh.');
        return;
    }

    fetch('/files?storage_dir=media_downloaded')
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch media files');
            return response.json();
        })
        .then(data => {
            filesGrid.innerHTML = '';
            data.files.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'media-file-item';
                const sizeMB = (file.size / 1024 / 1024).toFixed(2);
                fileItem.innerHTML = `
                    <i class="fas ${getFileIcon(file.name)}"></i>
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    <div class="file-size">${sizeMB} MB</div>
                    <div class="media-file-actions">
                        <button class="rename-btn" title="Rename file"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" title="Delete file"><i class="fas fa-trash"></i></button>
                    </div>
                `;

                // Store lazy URL for later use
                fileItem.dataset.lazyUrl = file.lazy_url;

                // Main click handler for selecting file
                fileItem.addEventListener('click', (e) => {
                    // Don't select if clicking on action buttons
                    if (e.target.closest('.media-file-actions')) {
                        return;
                    }
                    // Load content on demand using lazy URL
                    loadMediaOnDemand(fileItem, file.lazy_url, file.name);
                });

                // Rename button handler
                const renameBtn = fileItem.querySelector('.rename-btn');
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showRenameDialog(file.name, fileItem);
                });

                // Delete button handler
                const deleteBtn = fileItem.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showDeleteDialog(file.name, fileItem);
                });

                filesGrid.appendChild(fileItem);
            });
        })
        .catch(error => {
            console.error('Error fetching media files:', error);
            showError('Failed to load media files: ' + error.message);
        });
}

function selectMediaFile(fileItem, url, name) {
    // Remove previous selection
    if (selectedFileItem) {
        selectedFileItem.classList.remove('selected');
    }

    // Select new item
    selectedFileItem = fileItem;
    fileItem.classList.add('selected');

    // Load into player
    loadMediaIntoPlayer(url, name);
}

function loadMediaOnDemand(fileItem, lazyUrl, name) {
    // Remove previous selection
    if (selectedFileItem) {
        selectedFileItem.classList.remove('selected');
    }

    // Select new item
    selectedFileItem = fileItem;
    fileItem.classList.add('selected');

    // Show loading state
    const videoPlayer = document.getElementById('media-player-video');
    const audioPlayer = document.getElementById('media-player-audio');
    const placeholder = document.querySelector('.player-placeholder');

    videoPlayer.style.display = 'none';
    audioPlayer.style.display = 'none';
    placeholder.style.display = 'block';
    placeholder.textContent = 'Loading...';

    // Load content from lazy URL
    loadMediaIntoPlayer(lazyUrl, name);
}

function loadMediaIntoPlayer(url, name) {
    const videoPlayer = document.getElementById('media-player-video');
    const audioPlayer = document.getElementById('media-player-audio');
    const placeholder = document.querySelector('.player-placeholder');

    // Determine file type
    const ext = name.split('.').pop().toLowerCase();
    const isVideo = ['mp4', 'webm', 'avi', 'mov'].includes(ext);
    const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);

    if (!isVideo && !isAudio) {
        showError('Unsupported file format for playback');
        return;
    }

    // Set up player
    videoPlayer.style.display = isVideo ? 'block' : 'none';
    audioPlayer.style.display = isAudio ? 'block' : 'none';
    placeholder.style.display = 'none';

    const player = isVideo ? videoPlayer : audioPlayer;
    player.src = url;
    player.load(); // Ensure load
}

async function uploadMediaFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload-media', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        console.log('Media file uploaded successfully:', data.filename);
    } catch (error) {
        console.error('Upload error:', error);
        showError('Failed to upload media file: ' + error.message);
    }
}

function resetDownloadButton() {
    const mediaDownloadButton = document.querySelector('#tab-content-media .download-btn');
    if (mediaDownloadButton) {
        mediaDownloadButton.disabled = false;
        mediaDownloadButton.textContent = 'Download';
    }
}

function handleDownloadComplete() {
    // Reload media content to show the new file
    loadMediaContent();
    // Reset download button
    resetDownloadButton();
}

// Update the download progress handler to handle thumbnail URLs
// This will be called from socketEvents.js when download completes

function handleDownloadError() {
    // Reset download button on error
    resetDownloadButton();
}

function showRenameDialog(currentName, fileItem) {
    const newName = prompt('Enter new filename:', currentName);
    if (newName && newName !== currentName && newName.trim()) {
        renameMediaFile(currentName, newName.trim(), fileItem);
    }
}

function showDeleteDialog(filename, fileItem) {
    if (confirm(`Are you sure you want to delete "${filename}"?`)) {
        deleteMediaFile(filename, fileItem);
    }
}

async function renameMediaFile(oldName, newName, fileItem) {
    try {
        const response = await fetch('/rename-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                old_name: oldName,
                new_name: newName,
                storage_dir: 'media_downloaded'
            })
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Update the UI
        const fileNameElement = fileItem.querySelector('.file-name');
        fileNameElement.textContent = escapeHtml(newName);

        // Update the selected file reference if this was the selected file
        if (selectedFileItem === fileItem) {
            const iconElement = fileItem.querySelector('i');
            const currentClass = iconElement.className;
            selectMediaFile(fileItem, data.new_url, newName);
        }

        console.log('File renamed successfully:', data);
    } catch (error) {
        console.error('Rename error:', error);
        showError('Failed to rename file: ' + error.message);
    }
}

async function deleteMediaFile(filename, fileItem) {
    try {
        const response = await fetch('/delete-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: filename,
                storage_dir: 'media_downloaded'
            })
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Remove from UI
        if (selectedFileItem === fileItem) {
            // If this was the selected file, clear selection
            selectedFileItem.classList.remove('selected');
            selectedFileItem = null;
            // Clear player
            const videoPlayer = document.getElementById('media-player-video');
            const audioPlayer = document.getElementById('media-player-audio');
            videoPlayer.pause();
            audioPlayer.pause();
            videoPlayer.src = '';
            audioPlayer.src = '';
            videoPlayer.style.display = 'none';
            audioPlayer.style.display = 'none';
            document.querySelector('.player-placeholder').style.display = 'block';
        }

        fileItem.remove();
        console.log('File deleted successfully:', filename);
    } catch (error) {
        console.error('Delete error:', error);
        showError('Failed to delete file: ' + error.message);
    }
}