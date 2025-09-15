document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-share-upload-input');
    const uploadButton = document.querySelector('.file-share-container .upload-btn');

    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files).slice(0, 8);
            if (files.length === 0) return;

            const formData = new FormData();
            files.forEach(file => {
                formData.append('file', file, file.name);
            });
            formData.append('storage_dir', 'file_share_Uploads');

            try {
                const response = await fetch('/upload-file', {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                const data = await response.json();
                const uploadedUrls = data.urls || [];
                console.log('Files uploaded (file share):', uploadedUrls);

                socket.emit('send_message', {
                    channel: currentChannel,
                    message: JSON.stringify({
                        text: '',
                        attachments: uploadedUrls
                    }),
                    is_media: true,
                    request_id: Date.now().toString()
                });

                loadFileShareContent();
            } catch (error) {
                console.error('Upload error:', error);
                showError('Failed to upload files: ' + error.message);
            }
            fileInput.value = '';
        });
    }

    loadFileShareContent();
});

function loadFileShareContent() {
    const fileList = document.querySelector('#tab-content-file-share .file-list');
    if (!fileList) {
        console.error('File list container not found');
        showError('File list container not found. Please refresh.');
        return;
    }

    fetch('/files?storage_dir=file_share_Uploads')
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch files');
            return response.json();
        })
        .then(data => {
            fileList.innerHTML = '';
            data.files.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                const sizeMB = (file.size / 1024 / 1024).toFixed(2);
                fileItem.innerHTML = `
                    <i class="fas ${getFileIcon(file.name)}"></i>
                    <span class="file-name">${escapeHtml(file.name)}</span>
                    <span class="file-size">${sizeMB} MB</span>
                    <a href="${file.url}" download="${escapeHtml(file.name)}" class="file-download">Download</a>
                `;
                fileList.appendChild(fileItem);
            });
        })
        .catch(error => {
            console.error('Error fetching files:', error);
            showError('Failed to load files: ' + error.message);
        });
}

function getFileIcon(filename) {
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