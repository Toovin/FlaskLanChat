let typingSet = new Set();

const tabRegistry = {
    'channel': {
        render: () => {
            const content = document.getElementById('tab-content-channel');
            if (content) {
                content.style.display = 'block';
                console.log('Channel tab rendered');
                if (typeof handleChatInput === 'function') handleChatInput();
            } else {
                console.error('Channel tab content not found');
                showError('Channel tab content not found. Please refresh.');
            }
        }
    },
    'file-share': {
        render: () => {
            const content = document.getElementById('tab-content-file-share');
            if (content) {
                content.style.display = 'block';
                console.log('File share tab rendered');
            } else {
                console.error('File share tab content not found');
                showError('File share tab content not found. Please refresh.');
            }
            loadFileShareContent();
        }
    },
    'media': {
        render: () => {
            const content = document.getElementById('tab-content-media');
            if (content) {
                content.style.display = 'block';
                console.log('Media tab rendered');
            } else {
                console.error('Media tab content not found');
                showError('Media tab content not found. Please refresh.');
            }
            if (typeof loadMediaContent === 'function') {
                loadMediaContent();
            }
        }
    },
    'adventure': {
        render: () => {
            const content = document.getElementById('tab-content-adventure');
            if (content) {
                content.style.display = 'block';
                console.log('Adventure tab rendered');
            } else {
                console.error('Adventure tab content not found');
                showError('Adventure tab content not found. Please refresh.');
            }
            if (typeof activateAdventureTab === 'function') {
                activateAdventureTab();
            }
        }
    }
};

function setActiveTab(tabName) {
    console.log('Switching to tab:', tabName);
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });

    if (tabRegistry[tabName] && tabRegistry[tabName].render) {
        tabRegistry[tabName].render();
    }

    if (tabName === 'channel') {
        updateChannelHeader(currentChannel);
    }
}

function updateStatuses() {
    document.querySelectorAll('.member').forEach(member => {
        const nameSpan = member.querySelector('.member-name');
        const statusSpan = member.querySelector('.member-status');
        if (nameSpan && statusSpan) {
            const name = nameSpan.textContent;
            statusSpan.textContent = typingSet.has(name) ? 'Typing...' : 'Online';
        }
    });
}

socket.on('connect', () => {
    console.log('Socket.IO connected');
    socket.emit('test_event', { msg: 'Hello server' });

    // Start heartbeat ping
    startHeartbeat();
});

socket.on('reconnect', () => {
    console.log('Socket.IO reconnected');
    // Rejoin the current channel on reconnect to ensure we receive messages
    if (isAuthenticated) {
        let channelToJoin = currentChannel || 'general';
        // Check if currentChannel exists in available channels
        if (typeof currentChannels !== 'undefined' && currentChannels.length > 0) {
            if (!currentChannels.includes(channelToJoin)) {
                channelToJoin = 'general';
                currentChannel = 'general';
            }
        }
        console.log(`Rejoining channel: ${channelToJoin}`);
        socket.emit('join_channel', { channel: channelToJoin });
    }
});

socket.on('disconnect', (reason) => {
    console.log('Socket.IO disconnected:', reason);
    stopHeartbeat();

    if (reason === 'io server disconnect') {
        // Server disconnected, manual reconnection
        console.log('Server disconnected, attempting manual reconnect...');
        setTimeout(() => {
            socket.connect();
        }, 1000);
    }
});

socket.on('connect_error', (error) => {
    console.error('Socket.IO connect error:', error);
    showError('Failed to connect to server. Retrying...');
    // Attempt manual reconnection after a delay
    setTimeout(() => {
        if (!socket.connected) {
            console.log('Attempting manual reconnection...');
            socket.connect();
        }
    }, 5000);
});

socket.on('error', (data) => {
    console.error('Server error:', data.msg);
    showError(data.msg);
    if (loadingSpinner) loadingSpinner.style.display = 'none';
});

// Connection recovery mechanism
let connectionRecoveryAttempts = 0;
const maxRecoveryAttempts = 5;

socket.on('disconnect', (reason) => {
    console.log('Socket.IO disconnected:', reason);
    stopHeartbeat();

    if (reason === 'io server disconnect') {
        // Server disconnected, attempt recovery
        connectionRecoveryAttempts = 0;
        attemptConnectionRecovery();
    } else if (reason === 'io client disconnect') {
        // Client disconnected, this is normal
        console.log('Client disconnected normally');
    } else {
        // Other disconnection reasons, attempt recovery
        connectionRecoveryAttempts = 0;
        attemptConnectionRecovery();
    }
});

function attemptConnectionRecovery() {
    if (connectionRecoveryAttempts >= maxRecoveryAttempts) {
        console.error('Max connection recovery attempts reached');
        showError('Unable to reconnect to server. Please refresh the page.');
        return;
    }

    connectionRecoveryAttempts++;
    const delay = Math.min(1000 * Math.pow(2, connectionRecoveryAttempts), 30000);

    console.log(`Attempting connection recovery ${connectionRecoveryAttempts}/${maxRecoveryAttempts} in ${delay}ms`);

    setTimeout(() => {
        if (!socket.connected) {
            socket.connect();
        }
    }, delay);
}

socket.on('reconnect_error', (error) => {
    console.error('Socket.IO reconnect error:', error);
});

socket.on('reconnect_failed', () => {
    console.error('Socket.IO reconnect failed');
    showError('Failed to reconnect to server. Please refresh the page.');
});

socket.on('connection_status', (data) => {
    console.log('Connection status:', data);
    if (data.status === 'connected' && data.user_uuid) {
        isAuthenticated = true;
        console.log('User authenticated via connection status');
    }
});

socket.on('pong', () => {
    console.log('Received pong from server');
});

// Heartbeat functionality
let heartbeatInterval;

function startHeartbeat() {
    stopHeartbeat(); // Clear any existing heartbeat
    heartbeatInterval = setInterval(() => {
        if (socket.connected) {
            socket.emit('ping');
        }
    }, 30000); // Ping every 30 seconds
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

socket.on('test_response', (data) => {
    console.log('Test response:', data);
});

socket.on('user_registered', () => {
    isAuthenticated = true;
    currentChannel = 'general';  // Ensure currentChannel is set
    socket.emit('join_channel', { channel: 'general' });
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const avatarInput = document.getElementById('avatar-input');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (avatarInput) avatarInput.value = '';
    if (loginModal) loginModal.style.display = 'none';
    if (appContainer) {
        appContainer.classList.add('visible');
        console.log('App container made visible');
    }
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    updateUserInfo();
    updateMemberList();
    setActiveTab('channel');
});

socket.on('update_users', (data) => {
    users_db = data.users || [];
    const user = users_db.find(u => u.username === currentUsername);
    if (user || isAuthenticated) {
        if (loginModal) loginModal.style.display = 'none';
        if (appContainer) {
            appContainer.classList.add('visible');
            console.log('App container updated to visible');
        }
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        updateUserInfo();
        updateMemberList();
    }
});

socket.on('receive_reactions', (data) => {
    console.log('Received receive_reactions:', data);
    updateReactions(data.message_id, data.reactions);
});

socket.on('register_error', (data) => {
    console.error('Register error:', data.msg);
    showError(data.msg);
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    // Shake and flash the login modal
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.classList.add('shake', 'flash-red');
        setTimeout(() => {
            loginModal.classList.remove('shake', 'flash-red');
        }, 500);
    }
});

socket.on('login_error', (data) => {
    console.error('Login error:', data.msg);
    showError(data.msg);
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    // Shake and flash the login modal
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.classList.add('shake', 'flash-red');
        setTimeout(() => {
            loginModal.classList.remove('shake', 'flash-red');
        }, 500);
    }
});

socket.on('connect_error', (error) => {
    console.error('Socket.IO connect error:', error);
    showError('Failed to connect to server. Please try again.');
    if (loadingSpinner) loadingSpinner.style.display = 'none';
});

socket.on('error', (data) => {
    console.error('Server error:', data.msg);
    showError(data.msg);
    if (loadingSpinner) loadingSpinner.style.display = 'none';
});

socket.on('channel_history', (data) => {
    console.log('Received channel_history:', data);
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) {
        console.error('messages-container not found in DOM');
        showError('Messages container not found. Please refresh.');
        return;
    }
    if (!data.is_load_more) {
        messagesContainer.innerHTML = '';
    }
    data.messages.forEach(msg => {
        console.log('Adding message:', msg);
        addMessage(
            msg.sender,
            msg.message,
            msg.is_media,
            msg.timestamp,
            false,
            msg.id,
            msg.replied_to,
            msg.replies_count || 0,
            msg.image_url,
            msg.thumbnail_url
        );
        if (msg.reactions && msg.reactions.length > 0) {
            updateReactions(msg.id, msg.reactions);
        }
    });
    scrollMessagesToBottom(true);
    console.log('Messages rendered, checking visibility');
    const computedStyle = getComputedStyle(messagesContainer);
    if (computedStyle.display === 'none' || computedStyle.opacity === '0') {
        console.warn('Messages container is hidden:', { display: computedStyle.display, opacity: computedStyle.opacity });
        showError('Messages container is hidden. Please refresh.');
    }
});

socket.on('receive_message', (data) => {
    console.log('Received message:', data);
    if (data.channel === currentChannel) {
        if (data.message.startsWith('Reeeee,')) {
            console.log('Error message received, displaying:', data.message);
            showError(data.message);
            return;
        }
        const tempMessage = document.querySelector(`.message-group.temp[data-message-id="${data.id}"]`) || document.querySelector('.message-group.temp');
        if (tempMessage) tempMessage.remove();
        let messageData = data.message;
        if (data.is_media) {
            // Check if message contains JSON with attachments
            let hasAttachments = false;
            let parsedMessage = null;
            if (typeof data.message === 'string') {
                try {
                    parsedMessage = JSON.parse(data.message);
                    if (parsedMessage.attachments && Array.isArray(parsedMessage.attachments) && parsedMessage.attachments.length > 0) {
                        hasAttachments = true;
                    }
                } catch (e) {
                    // Not JSON, continue with normal processing
                }
            }

            if (hasAttachments) {
                // Handle messages with attachments (both single and multiple)
                if (parsedMessage.attachments.length > 1) {
                    // Multiple attachments - keep original JSON for carousel
                    messageData = data.message;
                } else {
                    // Single attachment - extract from JSON
                    const attachment = parsedMessage.attachments[0];
                    if (!attachment.url || typeof attachment.url !== 'string') {
                        console.error('Invalid single attachment data:', attachment);
                        showError('Received invalid media message.');
                        return;
                    }
                    messageData = {
                        message: parsedMessage.text || '',
                        image_url: attachment.url,
                        thumbnail_url: attachment.thumbnail_url || null
                    };
                }
            } else {
                // Fallback for old format or direct media messages
                // Allow thumbnail_url to be null for videos and other files without thumbnails
                if (!data.image_url || typeof data.image_url !== 'string' ||
                    (data.thumbnail_url !== null && data.thumbnail_url !== undefined && typeof data.thumbnail_url !== 'string')) {
                    console.error('Invalid media message data:', data);
                    showError('Received invalid media message.');
                    return;
                }
                messageData = {
                    message: data.message || '',
                    image_url: data.image_url,
                    thumbnail_url: data.thumbnail_url
                };
            }
        }
        addMessage(
            data.sender,
            messageData,
            data.is_media,
            data.timestamp,
            false,
            data.id,
            data.replied_to,
            data.replies_count || 0,
            data.image_url,
            data.thumbnail_url
        );
        if (data.reactions && data.reactions.length > 0) {
            updateReactions(data.id, data.reactions);
        }
        if (autoScrollEnabled) {
            scrollMessagesToBottom();
        } else {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                const isNearBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 10;
                const newMessagesButton = document.getElementById('new-messages-button');
                if (newMessagesButton && !isNearBottom) {
                    newMessagesButton.style.display = 'flex';
                }
            }
        }
    }
});

socket.on('message_deleted', (data) => {
    if (data.channel === currentChannel) {
        const messageGroup = document.querySelector(`.message-group[data-message-id="${data.message_id}"]`);
        if (messageGroup) {
            messageGroup.remove();
        }
    }
});

socket.on('typing', (data) => {
    typingSet = new Set(data.users || []);
    updateStatuses();
});

socket.on('show_modal', (data) => {
    if (!currentUsername || !isAuthenticated) {
        console.log('Ignoring show_modal event - user not authenticated');
        return;
    }

    const modal = document.getElementById('image-gen-modal');
    if (!modal || !data.modal_data) {
        console.error('Modal or modal_data missing:', { modal, modal_data: data.modal_data });
        showError('Failed to open image generation modal.');
        return;
    }

    const form = modal.querySelector('#image-gen-form');
    if (!form) {
        console.error('Image generation form not found.');
        showError('Image generation form not found.');
        return;
    }

    const fields = {
        prompt: data.modal_data.prompt || '',
        batch_size: parseInt(data.modal_data.batch_size) || 1,
        width: parseInt(data.modal_data.width) || 1024,
        height: parseInt(data.modal_data.height) || 1024,
        steps: parseInt(data.modal_data.steps) || 33,
        cfg_scale: parseFloat(data.modal_data.cfg_scale) || 7,
        clip_skip: parseInt(data.modal_data.clip_skip) || 1,
        negative_prompt: data.modal_data.negative_prompt || '',
        sampler_name: data.modal_data.sampler_name || 'Euler',
        scheduler_name: data.modal_data.scheduler_name || 'Simple'
    };

    // Map field names to HTML IDs (convert underscores to hyphens)
    const fieldIdMap = {
        prompt: 'prompt-input',
        batch_size: 'batch-size-input',
        width: 'width-input',
        height: 'height-input',
        steps: 'steps-input',
        cfg_scale: 'cfg-scale-input',
        clip_skip: 'clip-skip-input',
        negative_prompt: 'negative-prompt-input',
        sampler_name: 'sampler-name-input',
        scheduler_name: 'scheduler-name-input'
    };

    for (const [name, value] of Object.entries(fields)) {
        const inputId = fieldIdMap[name];
        const input = form.querySelector(`#${inputId}`);
        if (input) {
            input.value = value;
        } else {
            console.warn(`Form field #${inputId} not found.`);
        }
    }

    const samplerSelect = form.querySelector('#sampler-name-input');
    const schedulerSelect = form.querySelector('#scheduler-name-input');
    if (samplerSelect && data.modal_data.sampler_options) {
        samplerSelect.innerHTML = '';
        const options = data.modal_data.sampler_options.length > 0 ? data.modal_data.sampler_options : [
            { value: 'Euler', label: 'Euler' },
            { value: 'DPM++ 3M SDE', label: 'DPM++ 3M SDE', recommended_scheduler: 'exponential' }
        ];
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label || opt.value;
            samplerSelect.appendChild(option);
        });
    } else if (samplerSelect) {
        console.warn('No sampler options provided, using fallback.');
        samplerSelect.innerHTML = `
            <option value="Euler">Euler</option>
            <option value="DPM++ 3M SDE">DPM++ 3M SDE</option>
        `;
    }
    if (schedulerSelect && data.modal_data.scheduler_options) {
        schedulerSelect.innerHTML = '';
        const options = data.modal_data.scheduler_options.length > 0 ? data.modal_data.scheduler_options : [
            { value: 'Simple', label: 'Simple' },
            { value: 'exponential', label: 'Exponential' }
        ];
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label || opt.value;
            schedulerSelect.appendChild(option);
        });
    } else if (schedulerSelect) {
        console.warn('No scheduler options provided, using fallback.');
        schedulerSelect.innerHTML = `
            <option value="Simple">Simple</option>
            <option value="exponential">Exponential</option>
        `;
    }

    modal.classList.add('active');

    // Handle cancel button
    const cancelButton = form.querySelector('.cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            modal.classList.remove('active');
            // Refocus chat input
            const messageInput = document.querySelector('.message-input');
            if (messageInput) messageInput.focus();
        });
    }
    const handleFormSubmit = (e) => {
        e.preventDefault(); // Stop page reload
        console.log('Image gen form submitted');

        // Prevent multiple submissions
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn.disabled) {
            console.log('Form already submitted, ignoring duplicate');
            return;
        }

        // Collect form data into object (matches server expectation for 'args')
        const formData = new FormData(form);
        const args = Object.fromEntries(formData.entries());
        // Coerce types to match server (int/float as needed)
        args.width = parseInt(args.width) || 1024;
        args.height = parseInt(args.height) || 1024;
        args.steps = parseInt(args.steps) || 35;
        args.cfg_scale = parseFloat(args.cfg_scale) || 7;
        args.clip_skip = parseInt(args.clip_skip) || 2;
        args.batch_size = Math.max(1, Math.min(parseInt(args.batch_size) || 1, 4)); // Clamp 1-4

        console.log('Emitting form data to server:', args);

        // Show loading on button
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Generating...';
        submitBtn.disabled = true;

        // Emit to server - adjust event name if your lc_socket_handlers.py uses something else
        // (e.g., 'submit_image_form' or 'process_command'). This assumes it routes back to command_processor.
        socket.emit('submit_image_form', {
            command: 'image',
            args: args,
            channel: currentChannel,
            sender: currentUsername
        });

        // Close modal immediately after sending request
        modal.classList.remove('active');
        const messageInput = document.querySelector('.message-input');
        if (messageInput) messageInput.focus();

        // Reset button after a delay (normal message flow will handle the response)
        setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 1000);

    };

    // Remove any existing submit handler to prevent duplicates
    form.removeEventListener('submit', handleFormSubmit);
    // Attach the submit handler (one-time per modal open)
    form.addEventListener('submit', handleFormSubmit);

});



let isLoadingMessages = false;

socket.on('load_more_messages', async (data) => {
    if (isLoadingMessages) {
        console.log('Skipping load_more_messages: already loading');
        return;
    }
    isLoadingMessages = true;
    try {
        socket.emit('load_more_messages', { channel: currentChannel, before_message_id: data.before_message_id });
        await new Promise((resolve) => {
            socket.once('channel_history', (data) => {
                if (data.channel === currentChannel) {
                    data.messages.forEach(msg => {
                        addMessage(
                            msg.sender,
                            msg.message,
                            msg.is_media,
                            msg.timestamp,
                            false,
                            msg.id,
                            msg.replied_to,
                            msg.replies_count || 0,
                            msg.image_url,
                            msg.thumbnail_url
                        );
                        if (msg.reactions && msg.reactions.length > 0) {
                            updateReactions(msg.id, msg.reactions);
                        }
                    });
                    resolve();
                }
            });
            socket.once('error', (data) => {
                console.error('Failed to load more messages:', data.msg);
                showError(data.msg);
                resolve();
            });
        });
    } finally {
        isLoadingMessages = false;
    }
});

socket.on('download_progress', (data) => {
    console.log('Download progress:', data);
    updateDownloadProgress(data);
});

function updateDownloadProgress(data) {
    const progressContainer = document.getElementById('download-progress-container');
    const progressFill = document.getElementById('download-progress-fill');
    const filenameElement = document.getElementById('download-filename');
    const statusElement = document.getElementById('download-status');
    const speedElement = document.getElementById('download-speed');
    const etaElement = document.getElementById('download-eta');

    if (!progressContainer || !progressFill || !filenameElement || !statusElement || !speedElement || !etaElement) {
        console.error('Download progress elements not found');
        return;
    }

    progressContainer.style.display = 'block';

    if (data.filename) {
        filenameElement.textContent = data.filename;
    }

    if (typeof data.progress === 'number') {
        progressFill.style.width = data.progress + '%';
        statusElement.textContent = Math.round(data.progress) + '%';
    }

    if (data.speed && data.speed > 0) {
        const speedKB = (data.speed / 1024).toFixed(1);
        speedElement.textContent = `Speed: ${speedKB} KB/s`;
    } else {
        speedElement.textContent = 'Speed: --';
    }

    if (data.eta && data.eta > 0) {
        const etaMinutes = Math.floor(data.eta / 60);
        const etaSeconds = Math.floor(data.eta % 60);
        etaElement.textContent = `ETA: ${etaMinutes}:${etaSeconds.toString().padStart(2, '0')}`;
    } else {
        etaElement.textContent = 'ETA: --';
    }

    if (data.status === 'finished' || data.status === 'completed') {
        statusElement.textContent = 'Completed';
        speedElement.textContent = 'Speed: --';
        etaElement.textContent = 'ETA: --';
        if (typeof handleDownloadComplete === 'function') {
            handleDownloadComplete();
        }
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 3000);
    } else if (data.status === 'error') {
        statusElement.textContent = 'Error';
        statusElement.style.color = '#dc3545';
        speedElement.textContent = 'Speed: --';
        etaElement.textContent = 'ETA: --';
        if (typeof handleDownloadError === 'function') {
            handleDownloadError();
        }
        setTimeout(() => {
            progressContainer.style.display = 'none';
            statusElement.style.color = '';
        }, 5000);
    }
}