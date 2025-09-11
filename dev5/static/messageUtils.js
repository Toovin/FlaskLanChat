let scrollTimeout;
let modalData = null;

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
        // Force layout reflow to ensure scrollbar visibility
        messagesContainer.style.overflowY = 'hidden';
        void messagesContainer.offsetHeight;
        messagesContainer.style.overflowY = 'auto';

        // Simple scroll to bottom - let the browser handle the calculations
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: force ? 'instant' : 'smooth'
        });

        console.log('Scrolled to bottom:', messagesContainer.scrollHeight);

        // Hide new messages button
        const newMessagesButton = document.getElementById('new-messages-button');
        if (newMessagesButton) newMessagesButton.style.display = 'none';
    });
}

async function addMessage(sender, text, isMedia, timestamp, isTemp = false, messageId = null, repliedTo = null, repliesCount = 0) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) {
        console.error('messages-container not found in DOM.');
        return;
    }
    const messageGroup = document.createElement('div');
    messageGroup.className = 'message-group';
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
        try {
            const parsed = JSON.parse(text);
            parsedText = parsed.text || '';
            attachments = parsed.attachments || [];
        } catch {
            attachments = [text];
        }
    }
    let messageContent = `<div class="message-text${parsedText.startsWith('!') ? ' command' : ''}">${escapeHtml(parsedText)}</div>`;
    if (attachments.length > 0) {
        if (attachments.length === 1) {
            const ext = attachments[0].split('.').pop().toLowerCase();
            const imageExtensions = ['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'];
            const videoExtensions = ['mp4', 'webm', 'avi', 'mov'];
            const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'md', 'zip'];
            if (imageExtensions.includes(ext)) {
                messageContent += `<div class="message-image"><img src="${escapeHtml(attachments[0])}" alt="Shared image" style="max-width: 300px; max-height: 200px; object-fit: contain; border-radius: 8px;"></div>`;
            } else if (videoExtensions.includes(ext)) {
                let shouldLoop = false;
                try {
                    const video = document.createElement('video');
                    video.src = attachments[0];
                    video.onloadedmetadata = () => {
                        if (video.duration < 60) shouldLoop = true;
                        video.remove();
                    };
                    video.onerror = () => {};
                    video.load();
                } catch (error) {
                    console.error('Error checking video duration:', error);
                }
                messageContent += `
                    <div class="message-video">
                        <video controls autoplay muted ${shouldLoop ? 'loop' : ''} style="max-width: 300px; max-height: 200px; border-radius: 8px;">
                            <source src="${escapeHtml(attachments[0])}" type="video/${ext === 'mov' ? 'quicktime' : ext}">
                            Your browser does not support the video tag.
                        </video>
                    </div>`;
            } else if (documentExtensions.includes(ext)) {
                const iconMap = {
                    'pdf': 'fa-file-pdf',
                    'doc': 'fa-file-word',
                    'docx': 'fa-file-word',
                    'txt': 'fa-file-alt',
                    'md': 'fa-file-code'
                };
                const iconClass = iconMap[ext] || 'fa-file';
                const fileName = attachments[0].split('/').pop();
                messageContent += `
                    <div class="message-file">
                        <i class="fas ${iconClass} fa-2x"></i>
                        <a href="${escapeHtml(attachments[0])}" target="_blank" class="file-link">${escapeHtml(fileName)}</a>
                    </div>`;
            } else {
                const fileName = attachments[0].split('/').pop();
                messageContent += `
                    <div class="message-file">
                        <i class="fas fa-file fa-2x"></i>
                        <a href="${escapeHtml(attachments[0])}" target="_blank" class="file-link">${escapeHtml(fileName)}</a>
                    </div>`;
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
        const existingMoment = existingTimestamp && existingTimestamp !== 'Just now' ? moment(existingTimestamp, 'MMM D, YYYY h:mm A') : moment();
        if (timestampMoment.isBefore(existingMoment)) {
            messagesContainer.insertBefore(messageGroup, existingMessage);
            inserted = true;
            break;
        }
    }
    if (!inserted) messagesContainer.appendChild(messageGroup);
    if (isTemp || autoScrollEnabled) scrollMessagesToBottom(true);
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
                    addMessage(msg.sender, msg.message, msg.is_media, msg.timestamp, false, msg.id, msg.replied_to, msg.replies_count);
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
    const main = container.querySelector('.carousel-main');
    const thumbs = container.querySelector('.carousel-thumbs');
    const prevBtn = container.querySelector('.carousel-prev');
    const nextBtn = container.querySelector('.carousel-next');
    const slideshowBtn = container.querySelector('.carousel-slideshow');
    let currentIndex = 0;
    let slideshowInterval = null;

    function renderAttachment(index) {
        const att = attachments[index];
        const cleanAtt = att.replace(/[\n\r]/g, '');
        const ext = cleanAtt.split('.').pop().toLowerCase();
        let content = '';
        const imageExtensions = ['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'];
        const videoExtensions = ['mp4', 'webm', 'avi', 'mov'];
        if (imageExtensions.includes(ext)) {
            console.log('Rendering carousel image:', cleanAtt);
            content = `<img src="${escapeHtml(cleanAtt)}" alt="Attachment ${index + 1}">`;
        } else if (videoExtensions.includes(ext)) {
            let shouldLoop = false;
            const video = document.createElement('video');
            video.src = cleanAtt;
            video.onloadedmetadata = () => {
                if (video.duration < 60) shouldLoop = true;
                video.remove();
            };
            video.load();
            console.log('Rendering carousel video:', cleanAtt);
            content = `<video controls ${shouldLoop ? 'loop' : ''}>
                        <source src="${escapeHtml(cleanAtt)}" type="video/${ext === 'mov' ? 'quicktime' : ext}">
                        Your browser does not support the video tag.
                    </video>`;
        } else {
            const icon = getDocIcon(ext);
            const fileName = cleanAtt.split('/').pop();
            console.log('Rendering carousel document:', cleanAtt);
            content = `<div class="doc-preview"><i class="fas ${icon} fa-3x"></i><a href="${escapeHtml(cleanAtt)}" target="_blank">${escapeHtml(fileName)}</a></div>`;
        }
        main.innerHTML = content;

        const imgElement = main.querySelector('img');
        if (imgElement) {
            imgElement.addEventListener('click', () => {
                const imageUrls = attachments.filter(att => {
                    const ext = att.split('.').pop().toLowerCase();
                    return ['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'].includes(ext);
                });
                openImageViewer(imageUrls, index);
            });
        }
    }

    function renderThumbs() {
        thumbs.innerHTML = '';
        attachments.forEach((att, idx) => {
            const cleanAtt = att.replace(/[\n\r]/g, '');
            const ext = cleanAtt.split('.').pop().toLowerCase();
            let thumb = '';
            if (['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'].includes(ext)) {
                thumb = `<img src="${escapeHtml(cleanAtt)}" alt="Thumb ${idx + 1}">`;
            } else if (['mp4', 'webm', 'avi', 'mov'].includes(ext)) {
                thumb = `<i class="fas fa-video"></i>`;
            } else {
                thumb = `<i class="fas ${getDocIcon(ext)}"></i>`;
            }
            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'carousel-thumb' + (idx === currentIndex ? ' active' : '');
            thumbDiv.innerHTML = thumb;
            thumbDiv.onclick = () => {
                console.log('Thumbnail clicked:', cleanAtt);
                if (['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'].includes(ext)) {
                    const imageUrls = attachments.filter(att => {
                        const ext = att.split('.').pop().toLowerCase();
                        return ['png', 'webp', 'jpg', 'jpeg', 'gif', 'jfif'].includes(ext);
                    });
                    openImageViewer(imageUrls, idx);
                } else if (['mp4', 'webm', 'avi', 'mov'].includes(ext)) {
                    let shouldLoop = false;
                    const video = document.createElement('video');
                    video.src = cleanAtt;
                    video.onloadedmetadata = () => {
                        if (video.duration < 60) shouldLoop = true;
                        video.remove();
                    };
                    video.load();
                    openVideoViewer(escapeHtml(cleanAtt), shouldLoop);
                }
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
