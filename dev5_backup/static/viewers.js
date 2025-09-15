let currentImageViewer = null;
let currentVideoViewer = null;

function openImageViewer(imageUrls, initialIndex = 0) {
    if (currentImageViewer) {
        closeImageViewer();
    }

    const images = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    let currentIndex = Math.max(0, Math.min(initialIndex, images.length - 1));

    const viewer = document.createElement('div');
    viewer.className = 'image-viewer';
    viewer.style.position = 'fixed';
    viewer.style.top = '0';
    viewer.style.left = '0';
    viewer.style.width = '100%';
    viewer.style.height = '100%';
    viewer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    viewer.style.display = 'flex';
    viewer.style.alignItems = 'center';
    viewer.style.justifyContent = 'center';
    viewer.style.zIndex = '2000';

    const img = document.createElement('img');
    img.src = images[currentIndex];
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    img.style.borderRadius = '8px';
    img.style.cursor = 'pointer';
    img.style.opacity = '1';
    img.style.background = '#ffffff'; // Solid background for transparency
    img.style.filter = 'none';
    img.style.mixBlendMode = 'normal';
    img.style.objectFit = 'contain';

    viewer.addEventListener('click', (e) => {
        if (e.target === viewer) {
            closeImageViewer();
        }
    });

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.className = 'close-btn'; // Use consistent class
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '20px';
    closeBtn.style.right = '30px';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.color = 'var(--text-primary)';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    closeBtn.addEventListener('click', () => {
        closeImageViewer();
    });

    // Left navigation button
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '&lt;';
    prevBtn.className = 'carousel-prev';
    prevBtn.style.position = 'absolute';
    prevBtn.style.left = '20px';
    prevBtn.style.top = '50%';
    prevBtn.style.transform = 'translateY(-50%)';
    prevBtn.style.fontSize = '24px';
    prevBtn.style.color = 'var(--text-primary)';
    prevBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    prevBtn.style.border = 'none';
    prevBtn.style.borderRadius = '4px';
    prevBtn.style.padding = '10px';
    prevBtn.style.cursor = 'pointer';
    prevBtn.style.transition = 'background-color 0.2s ease';
    prevBtn.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        img.src = images[currentIndex];
        img.style.opacity = '1'; // Re-apply to avoid darkening
        img.style.background = 'none';
        img.style.filter = 'none';
        img.style.mixBlendMode = 'normal';
        updateImageCount();
    });

    // Right navigation button
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '&gt;';
    nextBtn.className = 'carousel-next';
    nextBtn.style.position = 'absolute';
    nextBtn.style.right = '20px';
    nextBtn.style.top = '50%';
    nextBtn.style.transform = 'translateY(-50%)';
    nextBtn.style.fontSize = '24px';
    nextBtn.style.color = 'var(--text-primary)';
    nextBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    nextBtn.style.border = 'none';
    nextBtn.style.borderRadius = '4px';
    nextBtn.style.padding = '10px';
    nextBtn.style.cursor = 'pointer';
    nextBtn.style.transition = 'background-color 0.2s ease';
    nextBtn.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % images.length;
        img.src = images[currentIndex];
        img.style.opacity = '1'; // Re-apply to avoid darkening
        img.style.background = 'none';
        img.style.filter = 'none';
        img.style.mixBlendMode = 'normal';
        updateImageCount();
    });

    // Image count indicator
    const imageCount = document.createElement('span');
    imageCount.className = 'carousel-count';
    imageCount.style.position = 'absolute';
    imageCount.style.bottom = '20px';
    imageCount.style.left = '50%';
    imageCount.style.transform = 'translateX(-50%)';
    imageCount.style.color = 'var(--text-primary)';
    imageCount.style.fontSize = '16px';
    imageCount.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    imageCount.style.padding = '5px 10px';
    imageCount.style.borderRadius = '4px';

    // Update image count text
    function updateImageCount() {
        imageCount.textContent = `${currentIndex + 1} / ${images.length}`;
    }
    updateImageCount();

    // Keyboard navigation
    function handleKeydown(e) {
        if (e.key === 'ArrowLeft') {
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            img.src = images[currentIndex];
            img.style.opacity = '1'; // Re-apply to avoid darkening
            img.style.background = 'none';
            img.style.filter = 'none';
            img.style.mixBlendMode = 'normal';
            updateImageCount();
        } else if (e.key === 'ArrowRight') {
            currentIndex = (currentIndex + 1) % images.length;
            img.src = images[currentIndex];
            img.style.opacity = '1'; // Re-apply to avoid darkening
            img.style.background = 'none';
            img.style.filter = 'none';
            img.style.mixBlendMode = 'normal';
            updateImageCount();
        }
    }
    document.addEventListener('keydown', handleKeydown);

    // Clean up keyboard listener when closing
    function cleanup() {
        document.removeEventListener('keydown', handleKeydown);
    }
    closeBtn.addEventListener('click', cleanup, { once: true });
    viewer.addEventListener('click', (e) => {
        if (e.target === viewer) {
            cleanup();
        }
    }, { once: true });

    viewer.appendChild(img);
    viewer.appendChild(closeBtn);
    if (images.length > 1) {
        viewer.appendChild(prevBtn);
        viewer.appendChild(nextBtn);
        viewer.appendChild(imageCount);
    }

    document.body.appendChild(viewer);
    currentImageViewer = viewer;
}

function closeImageViewer() {
    if (currentImageViewer) {
        document.body.removeChild(currentImageViewer);
        currentImageViewer = null;
    }
}

function openVideoViewer(videoSrc, shouldLoop) {
    if (currentVideoViewer) {
        closeVideoViewer();
    }

    const viewer = document.createElement('div');
    viewer.className = 'video-viewer';
    viewer.style.position = 'fixed';
    viewer.style.top = '0';
    viewer.style.left = '0';
    viewer.style.width = '100%';
    viewer.style.height = '100%';
    viewer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    viewer.style.display = 'flex';
    viewer.style.alignItems = 'center';
    viewer.style.justifyContent = 'center';
    viewer.style.zIndex = '2000';

    const video = document.createElement('video');
    video.src = videoSrc;
    video.controls = true;
    video.muted = true; // Mute by default for autoplay compatibility
    video.loop = shouldLoop;
    video.style.maxWidth = '90%';
    video.style.maxHeight = '90%';
    video.style.borderRadius = '8px';
    video.style.cursor = 'pointer';

    // Auto-play the video in the viewer
    video.play().catch((error) => {
        console.error('Video auto-play failed:', error);
    });

    // Close on click outside the video
    viewer.addEventListener('click', (e) => {
        if (e.target === viewer) {
            closeVideoViewer();
        }
    });

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '20px';
    closeBtn.style.right = '30px';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.color = 'white';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';

    closeBtn.addEventListener('click', () => {
        closeVideoViewer();
    });

    viewer.appendChild(video);
    viewer.appendChild(closeBtn);

    document.body.appendChild(viewer);
    currentVideoViewer = viewer;
}

function closeVideoViewer() {
    if (currentVideoViewer) {
        const video = currentVideoViewer.querySelector('video');
        if (video) video.pause(); // Pause the video when closing
        document.body.removeChild(currentVideoViewer);
        currentVideoViewer = null;
    }
}

// Escape Key Listener
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (currentImageViewer) {
            closeImageViewer();
        }
        if (currentVideoViewer) {
            closeVideoViewer();
        }
    }
});