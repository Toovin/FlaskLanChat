document.addEventListener('DOMContentLoaded', () => {
    // Initialize chat input container with safety checks
    let chatInputContainer = document.querySelector('.chat-input-container');
    if (!chatInputContainer) {
        console.warn('Chat input container not found, creating it');
        chatInputContainer = document.createElement('div');
        chatInputContainer.className = 'chat-input-container';
        chatInputContainer.innerHTML = `
            <div id="typing-indicator-bar" style="display: none;">
                <span id="typing-text"></span>
            </div>
            <div class="reply-bar" style="display: none;"></div>
            <div class="input-wrapper">
                <textarea class="message-input" placeholder="Message #${currentChannel}"></textarea>
                <div class="input-actions">
                    <input type="file" id="chat-file-upload-input" multiple style="display: none;" accept="image/png,image/webp,image/jpeg,image/gif,application/pdf,.doc,.docx,text/plain,.md,video/mp4,video/webm,video/avi,video/quicktime">
                    <button class="action-btn send-image-btn"><i class="fas fa-paper-plane"></i></button>
                    <button class="action-btn upload-btn"><i class="fas fa-upload"></i></button>
                    <label class="auto-scroll-label">
                        <input type="checkbox" id="auto-scroll-checkbox"> Auto-Scroll
                    </label>
                </div>
            </div>
        `;
        const tabContent = document.querySelector('#tab-content-channel');
        if (tabContent) {
            tabContent.appendChild(chatInputContainer);
        } else {
            console.error('tab-content-channel not found, cannot append chat-input-container');
            showError('Chat input container could not be created. Please refresh.');
            return;
        }
    }

    // Initialize image generation modal
    const imageGenModal = document.getElementById('image-gen-modal');
    const imageGenForm = document.getElementById('image-gen-form');

    if (imageGenModal) {
        imageGenModal.classList.remove('active');
        console.log('image-gen-modal hidden on page load');

        // Handle modal close buttons
        const closeButtons = imageGenModal.querySelectorAll('.cancel-button, .close-modal');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                imageGenModal.classList.remove('active');
                console.log('Modal closed via button');
            });
        });

        // Defer form setup until login success
        socket.on('login_success', () => {
            if (!imageGenForm) return;
            if (!imageGenForm.parentNode) return;

            // Form submission handled by socketEvents.js
        });
    } else {
        console.warn('image-gen-modal not found in DOM');
    }

    // Initialize chat input elements with safety checks
    const messageInput = document.querySelector('.message-input');
    const fileInput = document.getElementById('chat-file-upload-input');
    const sendButton = document.querySelector('.send-image-btn');
    const uploadButton = document.querySelector('.upload-btn');

    console.log('Chat input elements:', {
        messageInput,
        fileInput,
        sendButton,
        uploadButton,
        chatInputContainer
    });

    // Critical fix: Validate all inputs exist before use
    if (!messageInput || !fileInput || !sendButton || !uploadButton || !chatInputContainer) {
        showError('Chat input elements not found. Please refresh.');
        return;
    }

    // Check if container is visible
    const containerStyle = getComputedStyle(chatInputContainer);
    if (containerStyle.display === 'none') {
        console.warn('Chat input container is hidden');
        showError('Chat input is hidden. Please refresh or check authentication.');
        return;
    }

    // Create reply bar element
    const replyBar = document.createElement('div');
    replyBar.className = 'reply-bar';
    replyBar.style.display = 'none';

    if (messageInput.parentElement) {
        messageInput.parentElement.insertBefore(replyBar, messageInput);
    }

    // Initialize state variables
    let selectedFiles = [];
    let isSending = false;
    let messageHistory = [];
    let historyIndex = -1;

    // Upload button event listener
    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }

    // Voice button event listener
    const voiceButton = document.querySelector('.voice-btn');
    if (voiceButton) {
        voiceButton.addEventListener('click', () => {
            const modal = document.getElementById('voice-warning-modal');
            if (modal) {
                modal.style.display = 'flex';
                const okButton = modal.querySelector('.cancel-button');
                if (okButton) {
                    okButton.addEventListener('click', () => {
                        modal.style.display = 'none';
                    });
                }
            }
        });
    }

    // File input initialization
    if (fileInput) {
        fileInput.multiple = true;
        fileInput.setAttribute('accept', 'image/png,image/webp,image/jpeg,image/gif,application/pdf,.doc,.docx,text/plain,.md,video/mp4,video/webm,video/avi,video/quicktime');

        // Critical fix: Add proper null check for event listener
        fileInput.addEventListener('change', (e) => {
            if (!messageInput) return;

            selectedFiles = Array.from(e.target.files).slice(0, 8);
            console.log('Files selected:', selectedFiles.map(f => f.name));

            // Update input state safely
            if (selectedFiles.length > 0) {
                messageInput.disabled = true;
                messageInput.placeholder = `Sending ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...`;
            } else {
                selectedFiles = [];
                messageInput.disabled = false;
                messageInput.placeholder = `Message #${window.currentChannel}`;
            }
        });
    }

    // Critical fix: Properly initialize sendMessage function with null checks
    async function sendMessage() {
        if (!messageInput) return; // Prevent access when element is missing

        if (isSending) {
            console.log('Send already in progress, ignoring');
            return;
        }
        isSending = true;

        try {
            const text = messageInput.value.trim();
            if (!text && selectedFiles.length === 0) {
                showError('Please enter a message or select files to send.');
                return;
            }

            // Update input state
            if (messageInput) {
                messageInput.disabled = true;
                messageInput.placeholder = `Sending...`;
            }

            const replyTo = messageInput.dataset.replyTo || null;
            const tempMessageId = `temp-${Date.now()}`;
            const requestId = Date.now().toString();

            // Handle !image command
            if (text.startsWith('!image')) {
                addMessage(currentUsername || 'You', 'Generating image...', false, null, true, tempMessageId, replyTo);
            } else {
                const tempText = selectedFiles.length > 0
                    ? JSON.stringify({ text: text || 'Sending...', attachments: [] })
                    : text || 'Sending...';
                addMessage(currentUsername || 'You', tempText, !!selectedFiles.length, null, true, tempMessageId, replyTo);
            }

            // Handle file uploads
            let uploadedUrls = [];
            if (selectedFiles.length > 0) {
                const formData = new FormData();
                selectedFiles.forEach(file => formData.append('file', file));

                try {
                    const response = await fetch('/upload-file', {
                        method: 'POST',
                        body: formData,
                        headers: { 'Accept': 'application/json' }
                    });

                    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                    const data = await response.json();
                    uploadedUrls = data.urls || [];
                } catch (error) {
                    console.error('File upload error:', error.message);
                    showError(`Failed to send files: ${error.message}`);
                    const tempMessage = document.querySelector('.message-group.temp');
                    if (tempMessage) tempMessage.remove();
                    return;
                }
            }

            // Prepare message content
            let messageContent = text;
            if (uploadedUrls.length > 0) {
                messageContent = JSON.stringify({
                    text: text || '',
                    attachments: uploadedUrls
                });
            }

            // Send messages based on type
            if (text && text.startsWith('!image')) {
                const parts = text.trim().split(' ');
                const prompt = parts.length > 1 ? parts.slice(1).join(' ').trim() : '';

                socket.emit('send_message', {
                    channel: window.currentChannel,
                    message: '!image',
                    is_media: false,
                    initial_prompt: prompt,
                    reply_to: replyTo,
                    request_id: requestId
                });
            } else {
                socket.emit('send_message', {
                    channel: window.currentChannel,
                    message: messageContent,
                    is_media: uploadedUrls.length > 0,
                    reply_to: replyTo,
                    request_id: requestId
                });
            }

            // Update history (safe check)
            if (text) {
                messageHistory.push(text);
                if (messageHistory.length > 50) messageHistory.shift();
            }
            historyIndex = -1;

            resetInput();
        } finally {
            isSending = false;
        }
    }

    // Critical fix: Only attach send button listener if elements exist
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    // Input event handlers with null checks
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (!messageInput) return;

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            } else if (e.key === 'ArrowUp' && !e.shiftKey) {
                e.preventDefault();
                if (messageHistory.length > 0) {
                    if (historyIndex === -1) {
                        historyIndex = messageHistory.length - 1;
                    } else {
                        historyIndex = Math.max(0, historyIndex - 1);
                    }
                    messageInput.value = messageHistory[historyIndex];
                    messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
                }
            } else if (e.key === 'ArrowDown' && !e.shiftKey) {
                e.preventDefault();
                if (historyIndex >= 0) {
                    historyIndex++;
                    if (historyIndex >= messageHistory.length) {
                        historyIndex = -1;
                        messageInput.value = '';
                    } else {
                        messageInput.value = messageHistory[historyIndex];
                        messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
                    }
                }
            } else if (e.key === 'Escape') {
                historyIndex = -1;
                messageInput.value = '';
            }
        });
    }

    // Critical fix: Paste event handler with proper null checks
    if (messageInput) {
        messageInput.addEventListener('paste', async (e) => {
            if (isSending) {
                console.log('Paste event ignored, send in progress');
                return;
            }
            try {
                const clipboardData = e.clipboardData || window.clipboardData;
                if (!clipboardData) {
                    console.error('No clipboard data available');
                    return;
                }

                const items = clipboardData.items;
                let pastedFiles = [];
                let hasText = false;

                // Check for pasted content
                for (const item of items) {
                    if (item.kind === 'string' && item.type === 'text/plain') {
                        hasText = true;
                    } else if (item.kind === 'file' && item.type.startsWith('image/') && pastedFiles.length < 8) {
                        const file = item.getAsFile();
                        if (file) {
                            pastedFiles.push(file);
                        }
                    }
                }

                // If there are image files, prevent default and ask for confirmation
                if (pastedFiles.length > 0) {
                    e.preventDefault();
                    const confirmed = confirm(`Upload ${pastedFiles.length} pasted image${pastedFiles.length > 1 ? 's' : ''}?`);
                    if (!confirmed) return;

                    isSending = true;
                    messageInput.disabled = true;
                    messageInput.placeholder = `Sending ${pastedFiles.length} pasted file${pastedFiles.length > 1 ? 's' : ''}...`;

                    const replyTo = messageInput.dataset.replyTo || null;
                    const requestId = Date.now().toString();
                    addMessage(currentUsername || 'You', 'Sending...', true, null, true, null, replyTo);

                    const formData = new FormData();
                    pastedFiles.forEach(file => formData.append('file', file));

                    try {
                        const response = await fetch('/upload-file', {
                            method: 'POST',
                            body: formData,
                            headers: { 'Accept': 'application/json' }
                        });
                        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                        const data = await response.json();
                        const uploadedUrls = data.urls || [];
                        console.log('Pasted files uploaded:', uploadedUrls);

                        socket.emit('send_message', {
                            channel: window.currentChannel,
                            message: JSON.stringify({
                                text: messageInput.value.trim(),
                                attachments: uploadedUrls
                            }),
                            is_media: true,
                            reply_to: replyTo,
                            request_id: requestId
                        });
                    } catch (error) {
                        console.error('File upload error:', error.message);
                        showError(`Failed to send pasted files: ${error.message}`);
                        const tempMessage = document.querySelector('.message-group.temp');
                        if (tempMessage) tempMessage.remove();
                    }

                    resetInput(); // Reset input after sending files
                } else if (hasText) {
                    // For text only, let default paste happen and emit typing
                    setTimeout(() => {
                        if (messageInput.value.trim()) {
                            socket.emit('start_typing', { channel: window.currentChannel });
                        }
                    }, 0);
                }
            } catch (error) {
                console.error('Paste handler error:', error);
                // Reset input state
                messageInput.disabled = false;
                messageInput.placeholder = `Message #${window.currentChannel}`;
            } finally {
                isSending = false;
            }
        });
    }

    // Input change handler with null checks
    if (messageInput) {
        messageInput.addEventListener('input', () => {
            if (!messageInput || !messageInput.value.trim()) return;

            if (selectedFiles.length === 0 && !messageInput.dataset.replyTo) {
                socket.emit('start_typing', { channel: window.currentChannel });
            }
        });
    }

    // Reset input function with null checks
    function resetInput() {
        selectedFiles = [];

        if (fileInput) fileInput.value = '';

        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = `Message #${window.currentChannel}`;
            messageInput.value = '';
            delete messageInput.dataset.replyTo;
            const replyBar = document.querySelector('.reply-bar');
            if (replyBar) replyBar.style.display = 'none';
            messageInput.focus();
        }
    }

    // Auto-scroll checkbox handler
    const autoScrollCheckbox = document.getElementById('auto-scroll-checkbox');
    if (autoScrollCheckbox) {
        autoScrollCheckbox.checked = autoScrollEnabled;
        autoScrollCheckbox.addEventListener('change', (e) => {
            autoScrollEnabled = e.target.checked;
            localStorage.setItem('autoScrollEnabled', autoScrollEnabled);

            if (autoScrollEnabled) {
                scrollMessagesToBottom(true);
                const newMessagesButton = document.getElementById('new-messages-button');
                if (newMessagesButton) newMessagesButton.style.display = 'none';
            }
        });
    }

    // Adjust messages container padding
    function adjustMessagesPadding() {
        const messagesContainer = document.getElementById('messages-container');
        const chatInputContainer = document.querySelector('.chat-input-container');

        if (!messagesContainer || !chatInputContainer) return;

        const scrollTop = messagesContainer.scrollTop;
        messagesContainer.style.paddingBottom = '10px'; // Reduced to 10px spacing
        messagesContainer.scrollTop = scrollTop;
    }

    // Initial padding adjustment
    adjustMessagesPadding();
    setTimeout(adjustMessagesPadding, 100);

    // Handle window resize
    window.addEventListener('resize', adjustMessagesPadding);

    // Handle input height changes
    if (messageInput) {
        messageInput.addEventListener('input', adjustMessagesPadding);
    }

    // Messages container scroll handling
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.addEventListener('scroll', () => {
            if (!autoScrollEnabled) {
                const newMessagesButton = document.getElementById('new-messages-button');
                if (newMessagesButton) {
                    const isNearBottom =
                        messagesContainer.scrollTop + messagesContainer.clientHeight >=
                        messagesContainer.scrollHeight - 10;

                    newMessagesButton.style.display = isNearBottom ? 'none' : 'flex';
                }
            }
        });
    }

    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            setActiveTab(tab.dataset.tab);

            // Force scroll reflow
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                messagesContainer.style.overflow = 'hidden';
                setTimeout(() => messagesContainer.style.overflow = 'auto', 0);
            }
        });
    });

    // Close modal handler
    const closeModal = document.getElementById('image-gen-modal')?.querySelector('.close-modal');
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            document.getElementById('image-gen-modal').classList.remove('active');
        });
    }

    // Cancel button in image gen modal
    const cancelButton = document.querySelector('#image-gen-modal .cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            console.log('Cancel button clicked, sending cancel command');
            const requestId = Date.now().toString();

            try {
                socket.emit('send_message', {
                    channel: currentChannel,
                    message: '!image',
                    is_media: false,
                    form_data: { cancel: true },
                    request_id: requestId
                });

                document.getElementById('image-gen-modal').classList.remove('active');
                console.log('Modal hidden');

                // Reset input state
                if (messageInput) {
                    delete messageInput.dataset.replyTo;
                    replyBar.style.display = 'none';
                    messageInput.placeholder = `Message #${currentChannel}`;
                    messageInput.value = '';

                    const tempMessage = document.querySelector('.message-group.temp');
                    if (tempMessage) tempMessage.remove();
                }
            } catch (error) {
                console.error('Cancel command failed:', error);
            }
        });
    }

    // Focus input on load
    if (messageInput) messageInput.focus();

    // Refocus on window focus
    window.addEventListener('focus', () => {
        const messageInput = document.querySelector('.message-input');
        if (messageInput) messageInput.focus();
    });

    console.log('Chat input system initialized successfully');
});
