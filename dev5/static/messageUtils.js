let scrollTimeout;
let modalData = null;

function loadLazyMedia(element) {
    const mediaUrl = element.dataset.mediaUrl;
    const mediaType = element.dataset.mediaType;
    const videoExt = element.dataset.videoExt;

    if (!mediaUrl || !mediaType) {
        console.error('Missing media URL or type:', { mediaUrl, mediaType });
        element.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>Missing media info</span></div>';
        element.classList.remove('loading');
        return;
    }

    element.classList.add('loading');
    const placeholder = element.querySelector('.media-placeholder');
    if (placeholder) {
        placeholder.innerHTML = '<i class="fas fa-spinner fa-2x"></i><span>Loading...</span>';
    }

    if (mediaType === 'image') {
        loadLazyImage(element, mediaUrl);
    } else if (mediaType === 'video') {
        loadLazyVideo(element, mediaUrl, videoExt);
    } else {
        console.error('Unsupported media type:', mediaType);
        element.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>Unsupported media type</span></div>';
        element.classList.remove('loading');
    }
}

function scrollMessagesToTop(force = false) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) {
        console.error('messages-container not found');
        showError('Chat container not found. Please refresh.');
        return;
    }
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        messagesContainer.scrollTo({
            top: 0,
            behavior: force ? 'instant' : 'smooth'
        });
    }, 100);
}

function scrollMessagesToBottom(force = false) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) {
        console.error('messages-container not found');
        showError('Chat container not found. Please refresh.');
        return;
    }
    clearTimeout(scrollTimeout);

    requestAnimationFrame(() => {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: force ? 'instant' : 'smooth'
        });

        console.log('Scrolled to bottom:', messagesContainer.scrollHeight);

        const newMessagesButton = document.getElementById('new-messages-button');
        if (newMessagesButton) newMessagesButton.style.display = 'none';
    });
}

async function addMessage(sender, text, isMedia, timestamp, isTemp = false, messageId = null, repliedTo = null, repliesCount = 0, imageUrl = null, thumbnailUrl = null) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) {
        console.error('messages-container not found in DOM.');
        return;
    }
    const messageGroup = document.createElement('div');
    messageGroup.className = 'message-group';
    messageGroup.style.position = 'relative';
    if (isTemp) messageGroup.classList.add('temp');
    if (messageId) messageGroup.dataset.messageId = messageId;

    const user = users_db.find(u => u.username === sender);
    const avatarOptions = ['smile_1.png', 'smile_2.png', 'smile_3.png'];
    const randomAvatar = avatarOptions[Math.floor(Math.random() * avatarOptions.length)];
    const avatarUrl = user && user.avatar_url ? user.avatar_url : `/static/avatars/${randomAvatar}`;

    let replyIndicator = '';
    if (repliedTo) {
        const repliedMessage = await getMessageById(repliedTo);
        const repliedSender = repliedMessage?.sender || 'Unknown';
        const repliedText = repliedMessage?.message ? escapeHtml(repliedMessage.message.substring(0, 50)) + (repliedMessage.message.length > 50 ? '...' : '') : 'Message not found';
        replyIndicator = `
            <div class="reply-indicator" data-replied-to="${repliedTo}">
                <i class="fas fa-reply"></i>
                <span>Replying to ${escapeHtml(repliedSender)}: ${repliedText}</span>
            </div>`;
    }
    let repliesIndicator = '';
    if (repliesCount > 0) {
        repliesIndicator = `<div class="replies-indicator"><i class="fas fa-reply"></i> ${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}</div>`;
    }

    let parsedText = text;
    let attachments = [];

    if (isMedia) {
        // First try to parse JSON format (new format with attachments)
        if (typeof text === 'string') {
            try {
                const parsed = JSON.parse(text);
                parsedText = parsed.text || '';
                attachments = Array.isArray(parsed.attachments) ? parsed.attachments.filter(att =>
                    att && att.url && typeof att.url === 'string' &&
                    (att.thumbnail_url === null || att.thumbnail_url === undefined ||
                     (typeof att.thumbnail_url === 'string' && att.thumbnail_url.trim()))
                ).map(att => ({
                    url: att.url,
                    thumbnail_url: att.thumbnail_url || null,
                    size: att.size || 0
                })) : [];
            } catch (e) {
                // Not JSON, fall back to legacy format
                parsedText = text || '';
                if (imageUrl && thumbnailUrl && typeof imageUrl === 'string' && typeof thumbnailUrl === 'string') {
                    attachments = [{ url: imageUrl, thumbnail_url: thumbnailUrl }];
                } else if (imageUrl && typeof imageUrl === 'string') {
                    // Handle case where thumbnail_url is null but image_url is valid (e.g., videos)
                    attachments = [{ url: imageUrl, thumbnail_url: thumbnailUrl || null }];
                } else {
                    console.warn('No valid image_url or thumbnail_url, treating as text message');
                    isMedia = false; // Override to prevent media rendering
                }
            }
        } else if (typeof text === 'object' && text.image_url && text.thumbnail_url && typeof text.image_url === 'string' && typeof text.thumbnail_url === 'string') {
            // Legacy object format
            parsedText = text.message || '';
            attachments = [{ url: text.image_url, thumbnail_url: text.thumbnail_url }];
        } else if (typeof text === 'object' && text.image_url && typeof text.image_url === 'string') {
            // Handle legacy object format with null thumbnail_url
            parsedText = text.message || '';
            attachments = [{ url: text.image_url, thumbnail_url: text.thumbnail_url || null }];
        } else {
            console.error('Invalid media message format:', JSON.stringify(text, null, 2));
            showError('Invalid media message received.');
            return;
        }
    }

    let messageContent = `<div class="message-text${String(parsedText).startsWith('!') ? ' command' : ''}">${escapeHtml(String(parsedText))}</div>`;

    if (isMedia && attachments.length > 0) {
        if (attachments.length === 1) {
            const att = attachments[0];
            const url = att.url;
            if (!url || typeof url !== 'string') {
                console.error('Invalid attachment: URL is missing or invalid', att);
                messageContent += `
                    <div class="message-file">
                        <i class="fas fa-exclamation-triangle fa-2x"></i>
                        <span>Invalid attachment</span>
                    </div>`;
            } else {
                // Construct thumbnail URL with proper subdirectory structure
                let thumbnailUrl = att.thumbnail_url;
                if (!thumbnailUrl) {
                    // Fallback: replace /static/{dir}/ with /static/thumbnails/{dir}/ and add _thumb.jpg
                    const urlParts = url.split('/');
                    if (urlParts.length >= 3 && urlParts[1] === 'static') {
                        const storageDir = urlParts[2]; // e.g., 'uploads', 'media_downloaded'
                        const filename = urlParts[urlParts.length - 1];
                        const baseName = filename.replace(/\.[^.]+$/, '');
                        thumbnailUrl = `/static/thumbnails/${storageDir}/${baseName}_thumb.jpg`;
                    } else {
                        // Fallback to old pattern if URL structure is unexpected
                        thumbnailUrl = url.replace('/static/', '/static/thumbnails/').replace(/\.[^.]+$/, '_thumb.jpg');
                    }
                }

                // Handle both old and new thumbnail URL formats for backward compatibility
                if (thumbnailUrl && !thumbnailUrl.includes('/uploads/') && url.includes('/uploads/')) {
                    // Old format: add /uploads/ to match the full image path
                    thumbnailUrl = thumbnailUrl.replace('/static/thumbnails/', '/static/thumbnails/uploads/');
                }
                const ext = url.split('.').pop().toLowerCase();
                const imageExtensions = ['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'];
                const videoExtensions = ['mp4', 'webm', 'avi', 'mov'];
                const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'md', 'zip'];

                if (imageExtensions.includes(ext)) {
                    messageContent += `
                        <div class="message-image" data-full-url="${escapeHtml(url)}" data-thumbnail-url="${escapeHtml(thumbnailUrl)}">
                            <div class="media-placeholder">
                                <i class="fas fa-image fa-2x"></i>
                                <span>Loading thumbnail...</span>
                            </div>
                        </div>`;
                } else if (videoExtensions.includes(ext)) {
                    const lazyUrl = url.replace('/static/', '/lazy-file/');
                    const size = att.size || 0;
                    messageContent += `
                        <div class="message-video lazy-media" data-media-url="${escapeHtml(lazyUrl)}" data-media-type="video" data-video-ext="${ext}" data-size="${size}">
                            <div class="media-placeholder">
                                <i class="fas fa-video fa-2x"></i>
                                <span>Click to load video${size > 0 ? ` (${(size / (1024 * 1024)).toFixed(1)}MB)` : ''}</span>
                            </div>
                        </div>`;
                }
            }
        } else {
            messageContent += createCarousel(attachments, messageId);
        }
    }

    const isOwnMessage = sender === currentUsername;
    const deleteButton = isOwnMessage ? `<button class="action-btn delete-btn" aria-label="Delete message"><i class="fas fa-trash"></i></button>` : '';

    messageGroup.innerHTML = `
        <div class="message-avatar">
            <img src="${avatarUrl}" alt="Avatar">
        </div>
        <div class="message-content">
            ${replyIndicator}
            <div class="message-header">
                <span class="username">${escapeHtml(sender)}</span>
                <span class="timestamp">${timestamp ? moment(timestamp).format('MMM D, YYYY h:mm A') : 'Just now'}</span>
            </div>
            ${repliesIndicator}
            ${messageContent}
            <div class="message-actions">
                <div class="reactions-container"></div>
                <button class="action-btn reply-btn" aria-label="Reply"><i class="fas fa-reply"></i></button>
                <button class="action-btn add-reaction-btn" aria-label="Add reaction"><i class="fas fa-smile"></i><span class="reaction-count">0</span></button>
                ${deleteButton}
            </div>
        </div>
    `;

    const messages = Array.from(messagesContainer.children);
    const timestampMoment = timestamp ? moment(timestamp) : moment();
    let inserted = false;

    for (let i = 0; i < messages.length; i++) {
        const existingMessage = messages[i];
        const existingTimestamp = existingMessage.querySelector('.timestamp')?.textContent;
        const existingMoment = existingTimestamp && existingTimestamp !== 'Just now'
            ? moment(existingTimestamp, 'MMM D, YYYY h:mm A')
            : moment();

        if (timestampMoment.isBefore(existingMoment)) {
            messagesContainer.insertBefore(messageGroup, existingMessage);
            inserted = true;
            break;
        }
    }

    if (!inserted) {
        messagesContainer.appendChild(messageGroup);
    }

    if (isTemp || autoScrollEnabled) {
        scrollMessagesToBottom(true);
    }

    const addReactionBtn = messageGroup.querySelector('.add-reaction-btn');
    if (addReactionBtn && messageId) {
        console.log('Binding click event to add-reaction-btn for message:', messageId);
        addReactionBtn.addEventListener('click', () => {
            console.log('add-reaction-btn clicked for message:', messageId);
            showReactionPicker(messageId, messageGroup);
        });
    } else {
        console.warn('Failed to bind add-reaction-btn:', { addReactionBtn, messageId });
    }

    const replyBtn = messageGroup.querySelector('.reply-btn');
    if (replyBtn && messageId) {
        replyBtn.addEventListener('click', () => {
            const messageInput = document.querySelector('.message-input');
            const replyBar = document.querySelector('.reply-bar');
            if (messageInput && replyBar) {
                messageInput.placeholder = `Replying to ${sender}...`;
                messageInput.dataset.replyTo = messageId;
                replyBar.innerHTML = `
                    <span>Replying to ${escapeHtml(sender)}</span>
                    <button class="cancel-reply-btn" aria-label="Cancel reply"><i class="fas fa-times"></i></button>
                `;
                replyBar.style.display = 'flex';
                const cancelReplyBtn = replyBar.querySelector('.cancel-reply-btn');
                if (cancelReplyBtn) {
                    cancelReplyBtn.addEventListener('click', () => {
                        delete messageInput.dataset.replyTo;
                        messageInput.placeholder = `Message #${currentChannel}`;
                        replyBar.style.display = 'none';
                    });
                }
                messageInput.focus();
            }
        });
    }

    const deleteBtn = messageGroup.querySelector('.delete-btn');
    if (deleteBtn && messageId) {
        deleteBtn.addEventListener('click', () => {
            socket.emit('delete_message', {
                message_id: messageId,
                channel: currentChannel
            });
        });
    }

    if (attachments.length > 0) {
        const imgElement = messageGroup.querySelector('.message-image img');
        if (imgElement && messageId) {
            const cleanSrc = imgElement.src.replace(/[\n\r]/g, '');
            console.log('Binding image click for src:', cleanSrc);
            imgElement.addEventListener('click', () => {
                console.log('Opening image viewer with src:', cleanSrc);
                openImageViewer(cleanSrc);
            });
        }

        const videoElement = messageGroup.querySelector('.message-video video');
        if (videoElement && messageId) {
            const cleanSrc = videoElement.src.replace(/[\n\r]/g, '');
            console.log('Binding video click for src:', cleanSrc);
            videoElement.addEventListener('click', () => {
                console.log('Opening video viewer with src:', cleanSrc);
                openVideoViewer(cleanSrc, videoElement.loop);
            });
        }
    }

    const replyIndicatorEl = messageGroup.querySelector('.reply-indicator');
    if (replyIndicatorEl && repliedTo) {
        replyIndicatorEl.addEventListener('click', (e) => {
            e.stopPropagation();
            scrollToMessage(repliedTo);
        });
    }

    if (messageId) {
        socket.emit('get_reactions', { message_id: messageId, channel: currentChannel });
    }

    requestAnimationFrame(() => setupLazyMediaLoading(messageGroup));
}

function setupLazyMediaLoading(messageGroup) {
    // Handle automatic loading for single images
    const singleImageElements = messageGroup.querySelectorAll('.message-image');
    singleImageElements.forEach(element => {
        if (!element.classList.contains('lazy-media')) {
            // This is a single image that should load automatically
            const fullUrl = element.dataset.fullUrl;
            const thumbnailUrl = element.dataset.thumbnailUrl;
            if (fullUrl) {
                setTimeout(() => loadSingleImage(element, fullUrl, thumbnailUrl), 10);
            }
        }
    });

    // Handle click-to-load for videos and other lazy media
    const lazyMediaElements = messageGroup.querySelectorAll('.lazy-media');
    lazyMediaElements.forEach(element => {
        element.addEventListener('click', () => loadLazyMedia(element));
    });
}

function loadSingleImage(element, fullUrl, thumbnailUrl) {
    // Use the unified thumbnail loader
    thumbnailLoader.loadSingleImage(element, fullUrl, thumbnailUrl, {
        onClick: () => openImageViewer(fullUrl)
    });
}

function loadLazyImage(element, mediaUrl) {
    const thumbnailUrl = element.dataset.thumbnailUrl;
    console.log(`Attempting to load thumbnail: ${thumbnailUrl}, full URL: ${mediaUrl}`);

    if (thumbnailUrl) {
        const thumbImg = new Image();
        thumbImg.onload = () => {
            console.log(`Thumbnail loaded successfully: ${thumbnailUrl}`);
            element.innerHTML = `<img src="${thumbnailUrl}" alt="Shared image thumbnail" style="max-width: 300px; max-height: 200px; object-fit: contain; border-radius: 8px; cursor: pointer;" data-full-url="${mediaUrl}">`;
            element.classList.remove('loading');
            const imgElement = element.querySelector('img');
            if (imgElement) {
                imgElement.addEventListener('click', () => {
                    loadFullResolutionImage(element, mediaUrl);
                });
            }
        };
        thumbImg.onerror = () => {
            console.warn(`Thumbnail failed to load: ${thumbnailUrl}, falling back to full image`);
            loadFullResolutionImage(element, mediaUrl);
        };
        thumbImg.src = thumbnailUrl;
    } else {
        console.warn(`No thumbnail URL for ${mediaUrl}, loading full image`);
        loadFullResolutionImage(element, mediaUrl);
    }
}




function loadCarouselImage(element, fullUrl, thumbnailUrl, index, attachments) {
    console.log(`Loading carousel image: ${thumbnailUrl}, full: ${fullUrl}`);

    if (thumbnailUrl) {
        const thumbImg = new Image();
        thumbImg.onload = () => {
            console.log(`Carousel thumbnail loaded: ${thumbnailUrl}`);
            element.innerHTML = `<img src="${thumbnailUrl}" alt="Carousel image thumbnail" style="max-width: 300px; max-height: 200px; object-fit: contain; border-radius: 8px; cursor: pointer;" data-full-url="${fullUrl}" data-index="${index}">`;
            element.classList.remove('loading');

            const imgElement = element.querySelector('img');
            if (imgElement) {
                imgElement.addEventListener('click', () => {
                    // Get all image URLs from attachments for the viewer
                    const allImageUrls = attachments
                        .filter(att => {
                            const url = typeof att === 'string' ? att : att.url;
                            const ext = url.split('.').pop().toLowerCase();
                            return ['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'].includes(ext);
                        })
                        .map(att => typeof att === 'string' ? att : att.url);

                    openImageViewer(allImageUrls, index);
                });
            }
        };
        thumbImg.onerror = () => {
            console.warn(`Carousel thumbnail failed: ${thumbnailUrl}, loading full image`);
            loadFullCarouselImage(element, fullUrl, index, attachments);
        };
        thumbImg.src = thumbnailUrl;
    } else {
        console.warn(`No thumbnail for carousel image: ${fullUrl}`);
        loadFullCarouselImage(element, fullUrl, index, attachments);
    }
}

function loadFullCarouselImage(element, fullUrl, index, attachments) {
    const img = new Image();
    img.onload = () => {
        element.innerHTML = `<img src="${fullUrl}" alt="Carousel image" style="max-width: 300px; max-height: 200px; object-fit: contain; border-radius: 8px; cursor: pointer;" data-full-url="${fullUrl}" data-index="${index}">`;
        element.classList.remove('loading');

        const imgElement = element.querySelector('img');
        if (imgElement) {
            imgElement.addEventListener('click', () => {
                // Get all image URLs from attachments for the viewer
                const allImageUrls = attachments
                    .filter(att => {
                        const url = typeof att === 'string' ? att : att.url;
                        const ext = url.split('.').pop().toLowerCase();
                        return ['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'].includes(ext);
                    })
                    .map(att => typeof att === 'string' ? att : att.url);

                openImageViewer(allImageUrls, index);
            });
        }
    };
    img.onerror = () => {
        element.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>Failed to load image</span></div>';
        element.classList.remove('loading');
    };
    img.src = fullUrl;
}

function loadFullSingleImage(element, fullUrl) {
    const img = new Image();
    img.onload = () => {
        element.innerHTML = `<img src="${fullUrl}" alt="Shared image" style="max-width: 300px; max-height: 200px; object-fit: contain; border-radius: 8px; cursor: pointer;">`;
        element.classList.remove('loading');

        const imgElement = element.querySelector('img');
        if (imgElement) {
            imgElement.addEventListener('click', () => {
                openImageViewer(fullUrl);
            });
        }
    };
    img.onerror = () => {
        element.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>Failed to load image</span></div>';
        element.classList.remove('loading');
    };
    img.src = fullUrl;
}

function loadCarouselVideo(element, mediaUrl, videoExt, index, attachments) {
    console.log(`Loading carousel video: ${mediaUrl}`);

    const tempVideo = document.createElement('video');
    tempVideo.src = mediaUrl;
    tempVideo.onloadedmetadata = () => {
        const shouldLoop = tempVideo.duration < 60;
        tempVideo.remove();

        element.innerHTML = `
            <video controls autoplay muted ${shouldLoop ? 'loop' : ''} style="max-width: 300px; max-height: 200px; border-radius: 8px; cursor: pointer;" data-index="${index}">
                <source src="${mediaUrl}" type="video/${videoExt === 'mov' ? 'quicktime' : videoExt}">
                Your browser does not support the video tag.
            </video>`;
        element.classList.remove('loading');

        const videoElement = element.querySelector('video');
        if (videoElement) {
            videoElement.addEventListener('click', () => {
                // Get all video URLs from attachments for the viewer
                const allVideoUrls = attachments
                    .filter(att => {
                        const url = typeof att === 'string' ? att : att.url;
                        const ext = url.split('.').pop().toLowerCase();
                        return ['mp4', 'webm', 'avi', 'mov'].includes(ext);
                    })
                    .map(att => typeof att === 'string' ? att : att.url);

                openVideoViewer(allVideoUrls, index);
            });
        }
    };
    tempVideo.onerror = () => {
        element.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>Failed to load video</span></div>';
        element.classList.remove('loading');
    };
    tempVideo.load();
}

function createCarousel(attachments, messageId) {
    if (!attachments || attachments.length === 0) return '';

    let carouselHtml = '<div class="image-carousel">';

    // Main image display
    carouselHtml += '<div class="carousel-main-image">';
    carouselHtml += '<img id="carousel-main-' + messageId + '" src="" alt="Carousel image" style="max-width: 100%; max-height: 400px; object-fit: contain; border-radius: 8px;">';
    carouselHtml += '</div>';

    // Thumbnail strip
    carouselHtml += '<div class="carousel-thumbnails">';
    attachments.forEach((att, index) => {
        // Use server-provided thumbnail URL if available, otherwise construct it
        let thumbnailUrl = att.thumbnail_url;
        if (!thumbnailUrl && att.url) {
            // Construct thumbnail URL: replace /static/{dir}/ with /static/thumbnails/{dir}/ and add _thumb.jpg
            const urlParts = att.url.split('/');
            if (urlParts.length >= 3 && urlParts[1] === 'static') {
                const storageDir = urlParts[2]; // e.g., 'uploads', 'media_downloaded'
                const filename = urlParts[urlParts.length - 1];
                const baseName = filename.replace(/\.[^.]+$/, '');
                thumbnailUrl = `/static/thumbnails/${storageDir}/${baseName}_thumb.jpg`;
            } else {
                // Fallback to old pattern if URL structure is unexpected
                thumbnailUrl = att.url.replace('/static/', '/static/thumbnails/').replace(/\.[^.]+$/, '_thumb.jpg');
            }
        }

        // Handle both old and new thumbnail URL formats for backward compatibility
        if (thumbnailUrl && !thumbnailUrl.includes('/uploads/') && att.url && att.url.includes('/uploads/')) {
            // Old format: add /uploads/ to match the full image path
            thumbnailUrl = thumbnailUrl.replace('/static/thumbnails/', '/static/thumbnails/uploads/');
        }
        // Final fallback to full image if thumbnail URL construction failed
        if (!thumbnailUrl) {
            thumbnailUrl = att.url;
        }
        carouselHtml += `<div class="carousel-thumb" data-index="${index}" data-full-url="${escapeHtml(att.url)}" data-thumb-url="${escapeHtml(thumbnailUrl)}">`;
        carouselHtml += '<div class="thumb-placeholder loading">';
        carouselHtml += '<i class="fas fa-image"></i>';
        carouselHtml += '</div>';
        carouselHtml += '</div>';
    });
    carouselHtml += '</div>';

    carouselHtml += '</div>';

    // Add carousel functionality after the HTML is inserted
    setTimeout(() => {
        setupCarousel(messageId, attachments);
    }, 10);

    return carouselHtml;
}

function setupCarousel(messageId, attachments) {
    const mainImage = document.getElementById('carousel-main-' + messageId);
    const thumbnails = document.querySelectorAll(`.carousel-thumb[data-index]`);

    if (!mainImage || thumbnails.length === 0) return;

    // Load first image by default
    if (attachments.length > 0) {
        loadCarouselImage(mainImage, attachments[0].url);
    }

    // Setup thumbnail click handlers
    thumbnails.forEach((thumb, index) => {
        const thumbPlaceholder = thumb.querySelector('.thumb-placeholder');
        const att = attachments[index];

        // Load thumbnail with fallback to full image
        loadThumbImageWithFallback(thumbPlaceholder, att.url, att.thumbnail_url, index);

        // Click handler
        thumb.addEventListener('click', () => {
            // Update main image
            loadCarouselImage(mainImage, att.url);

            // Update active thumbnail
            document.querySelectorAll('.carousel-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        });
    });

    // Set first thumbnail as active
    if (thumbnails.length > 0) {
        thumbnails[0].classList.add('active');
    }
}

function loadCarouselImage(imgElement, fullUrl, thumbnailUrl, index, attachments) {
    // Use the unified thumbnail loader for carousel main image
    thumbnailLoader.loadCarouselMainImage(imgElement, fullUrl, thumbnailUrl, {
        onClick: () => {
            // Get all image URLs from attachments for the viewer
            const allImageUrls = attachments
                .filter(att => {
                    const url = typeof att === 'string' ? att : att.url;
                    const ext = url.split('.').pop().toLowerCase();
                    return ['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'].includes(ext);
                })
                .map(att => typeof att === 'string' ? att : att.url);

            openImageViewer(allImageUrls, index);
        }
    });
}

function loadThumbImageWithFallback(element, fullUrl, thumbnailUrl, index) {
    // Use the unified thumbnail loader
    thumbnailLoader.loadCarouselThumbnail(element, fullUrl, thumbnailUrl, index, {
        onClick: () => {
            // This will be handled by the carousel setup
        }
    });
}

function loadThumbImage(element, fullUrl, thumbnailUrl, index) {
    // Use the unified thumbnail loader
    thumbnailLoader.loadCarouselThumbnail(element, fullUrl, thumbnailUrl, index);
}

function loadFullResolutionImage(element, mediaUrl) {
    const img = new Image();
    img.onload = () => {
        element.innerHTML = `<img src="${mediaUrl}" alt="Shared image" style="max-width: 300px; max-height: 200px; object-fit: contain; border-radius: 8px;">`;
        element.classList.remove('loading');

        const imgElement = element.querySelector('img');
        if (imgElement) {
            imgElement.addEventListener('click', () => {
                openImageViewer(mediaUrl);
            });
        }
    };
    img.onerror = () => {
        element.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>Failed to load image</span></div>';
        element.classList.remove('loading');
    };
    img.src = mediaUrl;
}

function loadLazyVideo(element, mediaUrl, videoExt) {
    // Auto-load all videos regardless of size
    loadVideoDirectly(element, mediaUrl, videoExt);
}

function loadVideoDirectly(element, mediaUrl, videoExt) {
    const tempVideo = document.createElement('video');
    tempVideo.src = mediaUrl;
    tempVideo.onloadedmetadata = () => {
        const shouldLoop = tempVideo.duration < 60;
        tempVideo.remove();

        element.innerHTML = `
            <video controls autoplay muted ${shouldLoop ? 'loop' : ''} style="max-width: 300px; max-height: 200px; border-radius: 8px;">
                <source src="${mediaUrl}" type="video/${videoExt === 'mov' ? 'quicktime' : videoExt}">
                Your browser does not support the video tag.
            </video>`;
        element.classList.remove('loading');

        const videoElement = element.querySelector('video');
        if (videoElement) {
            videoElement.addEventListener('click', () => {
                openVideoViewer(mediaUrl, shouldLoop);
            });
        }
    };
    tempVideo.onerror = () => {
        element.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>Failed to load video</span></div>';
        element.classList.remove('loading');
    };
    tempVideo.load();
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        const messageInput = document.querySelector('.message-input');
        const replyBar = document.querySelector('.reply-bar');
        if (messageInput && replyBar && messageInput.dataset.replyTo) {
            delete messageInput.dataset.replyTo;
            messageInput.placeholder = `Message #${currentChannel}`;
            replyBar.style.display = 'none';
        }
    }
});

async function getMessageById(messageId) {
    return new Promise((resolve) => {
        socket.emit('get_message', { message_id: messageId, channel: currentChannel });
        socket.once('message_data', (data) => {
            resolve(data.message || null);
        });
        socket.once('error', (data) => {
            console.error('Failed to fetch message:', data.msg);
            resolve(null);
        });
    });
}

function scrollToMessage(messageId) {
    const messageGroup = document.querySelector(`.message-group[data-message-id="${messageId}"]`);
    if (messageGroup) {
        messageGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageGroup.style.transition = 'background-color 0.5s ease';
        messageGroup.style.backgroundColor = 'rgba(255, 107, 107, 0.3)';
        setTimeout(() => {
            messageGroup.style.backgroundColor = 'var(--bg-secondary)';
        }, 1000);
    } else {
        socket.emit('load_more_messages', { channel: currentChannel, before_message_id: messageId });
        socket.once('channel_history', (data) => {
            if (data.channel === currentChannel) {
                data.messages.forEach(msg => {
                    addMessage(msg.sender, msg.message, msg.is_media, msg.timestamp, false, msg.id, msg.replied_to, msg.replies_count || 0);
                    if (msg.reactions && msg.reactions.length > 0) {
                        updateReactions(msg.id, msg.reactions);
                    }
                });
                const messageGroupRetry = document.querySelector(`.message-group[data-message-id="${messageId}"]`);
                if (messageGroupRetry) {
                    messageGroupRetry.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    messageGroupRetry.style.transition = 'background-color 0.5s ease';
                    messageGroupRetry.style.backgroundColor = 'rgba(255, 107, 107, 0.3)';
                    setTimeout(() => {
                        messageGroupRetry.style.backgroundColor = 'var(--bg-secondary)';
                    }, 1000);
                }
            }
        });
    }
}

async function getMessageById(messageId) {
    return new Promise((resolve) => {
        socket.emit('get_message', { message_id: messageId, channel: currentChannel });
        socket.once('message_data', (data) => {
            resolve(data.message || null);
        });
        socket.once('error', (data) => {
            console.error('Failed to fetch message:', data.msg);
            resolve(null);
        });
    });
}

function showReactionPicker(messageId, messageGroup) {
    console.log('showReactionPicker called', { messageId, messageGroup });
    try {
        if (!currentChannel) {
            console.error('currentChannel is undefined');
            showError('Channel not set. Please refresh.');
            return;
        }
        if (!users_db || !users_db.length) {
            console.error('users_db is empty or undefined');
            showError('User data not loaded. Please refresh.');
            return;
        }

        document.querySelectorAll('.reaction-picker').forEach(picker => picker.remove());
        const picker = document.createElement('div');
        picker.className = 'reaction-picker';
        console.log('Reaction picker created');

        const emojis = ['👍', '👎', '❤️', '☠', '😂', '😮', '😢', '😡', '🙂', '😱', '🐕', '🐈', '🐿', '🐓'];
        emojis.forEach(emoji => {
            const button = document.createElement('button');
            button.className = 'reaction-emoji-btn';
            button.textContent = emoji;
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Emoji clicked:', emoji);
                socket.emit('add_reaction', {
                    message_id: messageId,
                    emoji: emoji,
                    channel: currentChannel
                });
                picker.remove();
            });
            picker.appendChild(button);
        });

        const addReactionBtn = messageGroup.querySelector('.add-reaction-btn');
        if (!addReactionBtn) {
            console.error('add-reaction-btn not found in messageGroup');
            showError('Reaction button not found. Please refresh.');
            return;
        }
        messageGroup.appendChild(picker);
        console.log('Picker appended to messageGroup');

        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) {
            console.error('messages-container not found');
            showError('Messages container not found. Please refresh.');
            return;
        }
        const buttonRect = addReactionBtn.getBoundingClientRect();
        const containerRect = messagesContainer.getBoundingClientRect();
        const pickerWidth = 200;

        const spaceRight = window.innerWidth - buttonRect.right;
        const wouldOverflowRight = spaceRight < pickerWidth;

        picker.style.position = 'absolute';
        if (wouldOverflowRight) {
            picker.style.left = 'auto';
            picker.style.right = '100%';
            picker.style.marginRight = '8px';
            picker.style.marginLeft = '0';
        } else {
            picker.style.left = '';
            picker.style.right = 'auto';
            picker.style.marginLeft = '';
            picker.style.marginRight = '0';
        }

        const pickerRect = picker.getBoundingClientRect();
        if (pickerRect.bottom > containerRect.bottom) {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollTop + (pickerRect.bottom - containerRect.bottom + 10),
                behavior: 'smooth'
            });
        }

        const closePicker = (event) => {
            if (!picker.contains(event.target) && !event.target.closest('.add-reaction-btn')) {
                console.log('Closing picker');
                picker.remove();
                document.removeEventListener('click', closePicker);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closePicker);
        }, 0);
    } catch (error) {
        console.error('Error in showReactionPicker:', error);
        showError('Failed to show reaction picker. Please refresh.');
    }
}

function updateReactions(messageId, reactions) {
    const messageGroup = document.querySelector(`.message-group[data-message-id="${messageId}"]`);
    if (!messageGroup) return;
    const reactionsContainer = messageGroup.querySelector('.reactions-container');
    const reactionCountSpan = messageGroup.querySelector('.add-reaction-btn .reaction-count');
    if (!reactionsContainer) return;
    const reactionCounts = {};
    reactions.forEach(r => {
        reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
    });
    reactionsContainer.innerHTML = '';
    Object.entries(reactionCounts).forEach(([emoji, count]) => {
        const reactionEl = document.createElement('span');
        reactionEl.className = 'reaction';
        const userUuid = users_db.find(u => u.username === currentUsername)?.uuid;
        const isUserReaction = reactions.some(r => r.user_uuid === userUuid && r.emoji === emoji);
        reactionEl.classList.toggle('user-reacted', isUserReaction);
        reactionEl.innerHTML = `${emoji} ${count}`;
        reactionEl.addEventListener('click', () => {
            if (isUserReaction) {
                socket.emit('remove_reaction', { message_id: messageId, emoji, channel: currentChannel });
            } else {
                socket.emit('add_reaction', { message_id: messageId, emoji, channel: currentChannel });
            }
        });
        reactionsContainer.appendChild(reactionEl);
    });
    if (reactionCountSpan) {
        reactionCountSpan.textContent = reactions.length || '0';
    }
}

function getDocIcon(ext) {
    const iconMap = {
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word',
        'docx': 'fa-file-word',
        'txt': 'fa-file-alt',
        'md': 'fa-file-code'
    };
    return iconMap[ext] || 'fa-file';
}

function createCarousel(attachments, messageId) {
    const carouselId = `carousel-${messageId || Date.now()}`;
    let carouselHtml = `<div class="carousel-container" id="${carouselId}">`;
    carouselHtml += `<div class="carousel-main"></div>`;
    carouselHtml += `<div class="carousel-thumbs"></div>`;
    carouselHtml += `<button class="carousel-prev">&lt;</button>`;
    carouselHtml += `<button class="carousel-next">&gt;</button>`;
    carouselHtml += `<button class="carousel-slideshow">▶️</button>`;
    carouselHtml += `<span class="carousel-count">${attachments.length} images</span>`;
    carouselHtml += `</div>`;
    setTimeout(() => initCarousel(carouselId, attachments), 0);
    return carouselHtml;
}

function initCarousel(id, attachments) {
    const container = document.getElementById(id);
    if (!container) return;
    attachments = attachments.filter(att => {
        if (typeof att === 'string' && att.trim()) {
            return true;
        } else if (typeof att === 'object' && att !== null && att.url && typeof att.url === 'string') {
            return true;
        }
        console.warn('Skipping invalid carousel attachment:', att);
        return false;
    });
    if (attachments.length === 0) {
        container.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>No valid attachments</span></div>';
        return;
    }
    const main = container.querySelector('.carousel-main');
    const thumbs = container.querySelector('.carousel-thumbs');
    const prevBtn = container.querySelector('.carousel-prev');
    const nextBtn = container.querySelector('.carousel-next');
    const slideshowBtn = container.querySelector('.carousel-slideshow');
    let currentIndex = 0;
    let slideshowInterval = null;

    function renderAttachment(index) {
        const att = attachments[index];
        const url = typeof att === 'string' ? att : att.url;
        if (!url) {
            main.innerHTML = '<div class="media-placeholder"><i class="fas fa-exclamation-triangle fa-2x"></i><span>Invalid attachment</span></div>';
            return;
        }
        const cleanAtt = url.replace(/[\n\r]/g, '');
        const ext = cleanAtt.split('.').pop().toLowerCase();
        let content = '';
        const imageExtensions = ['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'];
        const videoExtensions = ['mp4', 'webm', 'avi', 'mov'];
        if (imageExtensions.includes(ext)) {
            const pathParts = cleanAtt.split('/');
            const storageDir = pathParts[2];
            let thumbnailUrl = (typeof att === 'object' && att.thumbnail_url) ?
                att.thumbnail_url :
                cleanAtt.replace(`/static/${storageDir}/`, `/static/thumbnails/${storageDir}/`).replace(/\.[^.]+$/, '_thumb.jpg');

            // Handle both old and new thumbnail URL formats for backward compatibility
            if (thumbnailUrl && !thumbnailUrl.includes('/uploads/') && cleanAtt.includes('/uploads/')) {
                // Old format: add /uploads/ to match the full image path
                thumbnailUrl = thumbnailUrl.replace('/static/thumbnails/', '/static/thumbnails/uploads/');
            }
            content = `
                <div class="carousel-main-image" data-full-url="${escapeHtml(cleanAtt)}" data-thumbnail-url="${escapeHtml(thumbnailUrl)}" data-index="${index}">
                    <div class="media-placeholder">
                        <i class="fas fa-image fa-3x"></i>
                        <span>Loading thumbnail...</span>
                    </div>
                </div>`;
                // Load thumbnail immediately
                setTimeout(() => {
                    const mainImageElement = main.querySelector('.carousel-main-image');
                    if (mainImageElement) {
                        loadCarouselImage(mainImageElement, cleanAtt, thumbnailUrl, index, attachments);
                    }
                }, 10);
        } else if (videoExtensions.includes(ext)) {
            const lazyUrl = cleanAtt.replace('/static/', '/lazy-file/');
            const size = (typeof att === 'object' && att.size) ? att.size : 0;

            // Auto-load all videos regardless of size
            content = `
                <div class="carousel-main-video" data-media-url="${escapeHtml(lazyUrl)}" data-media-type="video" data-video-ext="${ext}" data-size="${size}">
                    <div class="media-placeholder">
                        <i class="fas fa-video fa-3x"></i>
                        <span>Loading video...</span>
                    </div>
                </div>`;
            // Load video immediately
            setTimeout(() => {
                const mainVideoElement = main.querySelector('.carousel-main-video');
                if (mainVideoElement) {
                    loadCarouselVideo(mainVideoElement, lazyUrl, ext, index, attachments);
                }
            }, 10);
        } else {
            const icon = getDocIcon(ext);
            const fileName = cleanAtt.split('/').pop();
            content = `
                <div class="carousel-main-file">
                    <i class="fas ${icon} fa-3x"></i>
                    <a href="${escapeHtml(cleanAtt)}" target="_blank" class="file-link">${escapeHtml(fileName)}</a>
                </div>`;
        }
        main.innerHTML = content;
    }

    function renderThumbs() {
        thumbs.innerHTML = '';
        attachments.forEach((att, idx) => {
            const url = typeof att === 'string' ? att : att.url;
            if (!url) return;
            const cleanAtt = url.replace(/[\n\r]/g, '');
            const ext = cleanAtt.split('.').pop().toLowerCase();
            let thumb = '';
            if (['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'].includes(ext)) {
                const pathParts = cleanAtt.split('/');
                const storageDir = pathParts[2] || 'uploads';
                let thumbnailUrl = (typeof att === 'object' && att.thumbnail_url) ?
                    att.thumbnail_url :
                    cleanAtt.replace(`/static/${storageDir}/`, `/static/thumbnails/${storageDir}/`).replace(/\.[^.]+$/, '_thumb.jpg');

                // Handle both old and new thumbnail URL formats for backward compatibility
                if (thumbnailUrl && !thumbnailUrl.includes('/uploads/') && cleanAtt.includes('/uploads/')) {
                    // Old format: add /uploads/ to match the full image path
                    thumbnailUrl = thumbnailUrl.replace('/static/thumbnails/', '/static/thumbnails/uploads/');
                }
                thumb = `<div class="carousel-thumb-image" data-full-url="${escapeHtml(cleanAtt)}" data-thumbnail-url="${escapeHtml(thumbnailUrl)}" data-index="${idx}">
                    <div class="media-placeholder">
                        <i class="fas fa-image fa-2x"></i>
                        <span>Loading...</span>
                    </div>
                </div>`;
                setTimeout(() => {
                    const thumbElement = thumbs.querySelectorAll('.carousel-thumb-image')[idx];
                    if (thumbElement) {
                        loadThumbImage(thumbElement, cleanAtt, thumbnailUrl, idx);
                    }
                }, 10 + (idx * 20));
            } else if (['mp4', 'webm', 'avi', 'mov'].includes(ext)) {
                thumb = `<div class="carousel-thumb-video" data-index="${idx}"><i class="fas fa-video"></i></div>`;
            } else {
                thumb = `<div class="carousel-thumb-file" data-index="${idx}"><i class="fas ${getDocIcon(ext)}"></i></div>`;
            }
            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'carousel-thumb' + (idx === currentIndex ? ' active' : '');
            thumbDiv.innerHTML = thumb;
            thumbDiv.onclick = () => {
                // For all carousels, navigate within the carousel consistently
                // This provides uniform behavior regardless of media type
                showIndex(idx);
            };
            thumbs.appendChild(thumbDiv);
        });
    }

    function showIndex(index) {
        currentIndex = (index + attachments.length) % attachments.length;
        renderAttachment(currentIndex);
        renderThumbs();
    }

    function toggleSlideshow() {
        if (slideshowInterval) {
            clearInterval(slideshowInterval);
            slideshowInterval = null;
            slideshowBtn.textContent = '▶️';
        } else {
            slideshowInterval = setInterval(() => showIndex(currentIndex + 1), 3000);
            slideshowBtn.textContent = '⏸️';
        }
    }

    prevBtn.onclick = () => showIndex(currentIndex - 1);
    nextBtn.onclick = () => showIndex(currentIndex + 1);
    slideshowBtn.onclick = toggleSlideshow;
    renderThumbs();
    showIndex(0);
}