let typingSet = new Set(); /* 9-6-2025 1950pm for multiple people typing */
const currentVoiceRoom = null; /* Track active LiveKit voice room */

const tabRegistry = {
    'channel': {
        render: () => {
            const content = document.getElementById('tab-content-channel');
            if (content) {
                content.style.display = 'block';
                console.log('Channel tab rendered');

                // Attach voice button handler
                const voiceButton = document.querySelector('.voice-btn');
                if (voiceButton) {
                    voiceButton.addEventListener('click', () => {
                        if (window.currentVoiceRoom) {
                            window.currentVoiceRoom.disconnect();
                            voiceButton.innerHTML = '<i class="fas fa-microphone"></i> Join Voice';
                            window.currentVoiceRoom = null;
                        } else {
                            socket.emit('join_voice', { channel: currentChannel });
                        }
                    });
                } else {
                    console.error('Voice button not found');
                    showError('Voice button not found. Please refresh.');
                }

                if (typeof handleChatInput === 'function') handleChatInput();
            } else {
                console.error('Channel tab content not found');
                showError('Channel tab content not found. Please refresh.');
            }
            socket.emit('update_channels', { channels: [] });
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
});

socket.on('test_response', (data) => {
    console.log('Test response:', data);
});

socket.on('user_registered', () => {
    isAuthenticated = true;
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
});

socket.on('login_error', (data) => {
    console.error('Login error:', data.msg);
    showError(data.msg);
    if (loadingSpinner) loadingSpinner.style.display = 'none';
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

socket.on('update_channels', (data) => {
    const channelList = document.querySelector('.channel-category');
    if (channelList) {
        const textChannels = document.querySelectorAll('.channel');
        textChannels.forEach(c => c.remove());
        data.channels.forEach(channel => {
            const channelDiv = document.createElement('div');
            channelDiv.className = `channel ${channel === currentChannel ? 'active' : ''}`;
            channelDiv.innerHTML = `<i class="fas fa-hashtag"></i><span>${channel}</span>`;
            channelDiv.addEventListener('click', () => {
                document.querySelectorAll('.channel').forEach(c => c.classList.remove('active'));
                channelDiv.classList.add('active');
                currentChannel = channel;
                socket.emit('join_channel', { channel });
                updateChannelHeader(channel);
                setActiveTab('channel');
                // Disconnect from voice room if switching channels
                if (window.currentVoiceRoom) {
                    window.currentVoiceRoom.disconnect();
                    const voiceButton = document.querySelector('.voice-btn');
                    if (voiceButton) {
                        voiceButton.innerHTML = '<i class="fas fa-microphone"></i> Join Voice';
                    }
                    window.currentVoiceRoom = null;
                }
            });
            channelList.appendChild(channelDiv);
        });
    }
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
        addMessage(msg.sender, msg.message, msg.is_media, msg.timestamp, false, msg.id, msg.replied_to);
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
        addMessage(data.sender, data.message, data.is_media, data.timestamp, false, data.id, data.replied_to);
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
        prompt: data.modal_data.initial_prompt || data.modal_data.prompt || '',
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

    for (const [name, value] of Object.entries(fields)) {
        const input = form.querySelector(`#${name}-input`);
        if (input) {
            input.value = value;
        } else {
            console.warn(`Form field #${name}-input not found.`);
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
        samplerSelect.innerHTML = `
            <option value="Simple">Simple</option>
            <option value="exponential">Exponential</option>
        `;
    }

    modal.style.display = 'flex';
});

socket.on('voice_token', async (data) => {
    const { token, ws_url, room } = data;
    window.currentVoiceRoom = new LivekitClient.Room();

    try {
        await window.currentVoiceRoom.connect(ws_url, token);
        console.log('Joined voice room:', room);

        // Enable microphone
        const tracks = await LivekitClient.createLocalTracks({ audio: true, video: false });
        for (const track of tracks) {
            await window.currentVoiceRoom.localParticipant.publishTrack(track);
        }

        // Handle remote participants' audio
        window.currentVoiceRoom.on('trackSubscribed', (track, publication, participant) => {
            if (track.kind === 'audio') {
                const audioElement = track.attach();
                document.body.appendChild(audioElement);
                audioElement.play().catch(err => console.error('Audio play failed:', err));
            }
        });

        // Update UI
        const voiceButton = document.querySelector('.voice-btn');
        voiceButton.innerHTML = '<i class="fas fa-microphone-slash"></i> Leave Voice';
    } catch (err) {
        console.error('Voice join failed:', err);
        showError('Failed to join voice: ' + err.message);
        window.currentVoiceRoom = null;
    }
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
                        addMessage(msg.sender, msg.message, msg.is_media, msg.timestamp, false, msg.id, msg.replied_to);
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