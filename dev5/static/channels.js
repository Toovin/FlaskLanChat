window.currentChannels = ['general'];

function showCreateChannelModal() {
    const modal = document.getElementById('create-channel-modal');
    if (modal) {
        modal.style.display = 'block';
        const input = document.getElementById('channel-name-input');
        if (input) {
            input.focus();
        }
    }
}

function hideCreateChannelModal() {
    const modal = document.getElementById('create-channel-modal');
    if (modal) {
        modal.style.display = 'none';
        const form = document.getElementById('create-channel-form');
        if (form) {
            form.reset();
        }
    }
}

function sanitizeChannelName(name) {
    return name.toLowerCase()
               .replace(/[^a-z0-9-_]/g, '-')
               .replace(/[-_]+/g, '-')
               .replace(/^[-_]|[-_]$/g, '')
               .substring(0, 50);
}

function createChannel(channelName) {
    const sanitizedName = sanitizeChannelName(channelName);

    if (!sanitizedName) {
        showError('Invalid channel name');
        return;
    }

    if (currentChannels.includes(sanitizedName)) {
        showError('Channel already exists');
        return;
    }

    socket.emit('create_channel', {
        channel: sanitizedName
    });
}

function switchToChannel(channelName) {
    if (window.currentChannel === channelName) return;

    const channels = document.querySelectorAll('.channel');
    channels.forEach(ch => ch.classList.remove('active'));

    const targetChannel = document.querySelector(`.channel[data-channel="${channelName}"]`);
    if (targetChannel) {
        targetChannel.classList.add('active');
    }

    window.currentChannel = channelName;
    updateChannelHeader(channelName);

    const messageInput = document.querySelector('.message-input');
    if (messageInput) {
        messageInput.placeholder = `Message #${channelName}`;
    }

    socket.emit('join_channel', {
        channel: channelName
    });
}

function renderChannelList(channels) {
    const channelsList = document.getElementById('channels-list');
    if (!channelsList) return;

    window.currentChannels = channels;
    channelsList.innerHTML = '';

    // Check if currentChannel exists in the channels list
    if (!channels.includes(window.currentChannel)) {
        window.currentChannel = 'general';
        updateChannelHeader('general');
        const messageInput = document.querySelector('.message-input');
        if (messageInput) {
            messageInput.placeholder = 'Message #general';
        }
    }

    channels.forEach(channel => {
        const channelElement = document.createElement('div');
        channelElement.className = `channel${channel === window.currentChannel ? ' active' : ''}`;
        channelElement.setAttribute('data-channel', channel);

        channelElement.innerHTML = `
            <i class="fas fa-hashtag"></i>
            <span>${escapeHtml(channel)}</span>
            ${channel !== 'general' ? '<button class="delete-channel-btn" onclick="deleteChannel(\'' + channel + '\')" title="Delete Channel"><i class="fas fa-times"></i></button>' : ''}
        `;

        channelElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-channel-btn') && !e.target.closest('.delete-channel-btn')) {
                switchToChannel(channel);
            }
        });

        channelsList.appendChild(channelElement);
    });
}

function deleteChannel(channelName) {
    if (channelName === 'general') {
        showError('Cannot delete the general channel');
        return;
    }

    if (confirm(`Are you sure you want to delete #${channelName}? This will delete all messages in the channel.`)) {
        socket.emit('delete_channel', {
            channel: channelName
        });

        if (window.currentChannel === channelName) {
            switchToChannel('general');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const createChannelForm = document.getElementById('create-channel-form');
    if (createChannelForm) {
        createChannelForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('channel-name-input');
            if (input && input.value.trim()) {
                createChannel(input.value.trim());
                hideCreateChannelModal();
            }
        });
    }

    const cancelButton = document.querySelector('#create-channel-modal .cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', hideCreateChannelModal);
    }

    const modal = document.getElementById('create-channel-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideCreateChannelModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('create-channel-modal');
            if (modal && modal.style.display === 'block') {
                hideCreateChannelModal();
            }
        }
    });
});

if (typeof socket !== 'undefined') {
    socket.on('update_channels', (data) => {
        if (data.channels) {
            renderChannelList(data.channels);
        }
    });
}