document.addEventListener('DOMContentLoaded', () => {
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

    const imageGenModal = document.getElementById('image-gen-modal');
    const imageGenForm = document.getElementById('image-gen-form'); // Moved to the top

    if (imageGenModal) {
        // Ensure modal is hidden by default
        imageGenModal.classList.remove('active');
        console.log('image-gen-modal hidden on page load');



        // Remove the initial timeout that re-hides the modal after 100ms
        // This was interfering with open_image_modal on login or page load

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
            console.log('Login success, setting up image-gen-form');
            if (!imageGenForm) {
                console.warn('image-gen-form not found in DOM after login');
                return;
            }
            if (!imageGenForm.parentNode) {
                console.warn('image-gen-form not attached to DOM, skipping setup');
                return;
            }

            // Form submission is now handled by socketEvents.js to avoid duplicate handlers
        });
    } else {
        console.warn('image-gen-modal not found in DOM');
    }

    // Removed the initial timeout that re-hides modal after 100ms
    // It was causing issues when open_image_modal fires shortly after login

    const messageInput = document.querySelector('.message-input');
    const fileInput = document.getElementById('chat-file-upload-input');
    const sendButton = document.querySelector('.send-image-btn');
    const uploadButton = document.querySelector('.upload-btn');

    console.log('Chat input elements:', { messageInput, fileInput, sendButton, uploadButton, chatInputContainer });
    if (!messageInput || !fileInput || !sendButton || !uploadButton || !chatInputContainer) {
        showError('Chat input elements not found. Please refresh.');
        return;
    }

    if (getComputedStyle(chatInputContainer).display === 'none') {
        console.warn('Chat input container is hidden');
        showError('Chat input is hidden. Please refresh or check authentication.');
    }

    const replyBar = document.createElement('div');
    replyBar.className = 'reply-bar';
    replyBar.style.display = 'none';

    if (messageInput && messageInput.parentElement) {
        messageInput.parentElement.insertBefore(replyBar, messageInput);
    }

    let selectedFiles = [];
    let isSending = false;

    // Upload button event listener
    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            if (fileInput) {
                fileInput.click();
            }
        });
    }

    if (fileInput) {
        fileInput.multiple = true;
        fileInput.setAttribute('accept', 'image/png,image/webp,image/jpeg,image/gif,application/pdf,.doc,.docx,text/plain,.md,video/mp4,video/webm,video/avi,video/quicktime');
        fileInput.addEventListener('change', (e) => {
            selectedFiles = Array.from(e.target.files).slice(0, 8);
            console.log('Files selected:', selectedFiles.map(f => f.name));
            if (messageInput) {
                if (selectedFiles.length > 0) {
                    messageInput.disabled = true;
                    messageInput.placeholder = `Sending ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...`;
                } else {
                    selectedFiles = [];
                    messageInput.disabled = false;
            messageInput.placeholder = `Message #${window.currentChannel}`;
                }
            }
        });
    }

    async function sendMessage() {
        if (isSending) {
            console.log('Send already in progress, ignoring');
            return;
        }
        isSending = true;
        try {
            const text = messageInput ? messageInput.value.trim() : '';
            if (!text && selectedFiles.length === 0) {
                showError('Please enter a message or select files to send.');
                return;
            }

            if (messageInput) {
                messageInput.disabled = true;
                messageInput.placeholder = `Sending...`;
            }

            const replyTo = messageInput.dataset.replyTo || null;
            const tempMessageId = `temp-${Date.now()}`;
            const requestId = Date.now().toString();

            // For !image command, treat as non-media for temporary message
            if (text.startsWith('!image')) {
                addMessage(currentUsername || 'You', 'Generating image...', false, null, true, tempMessageId, replyTo);
            } else {
                const tempText = selectedFiles.length > 0 ? JSON.stringify({ text: text || 'Sending...', attachments: [] }) : text || 'Sending...';
                addMessage(currentUsername || 'You', tempText, !!selectedFiles.length, null, true, tempMessageId, replyTo);
            }

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
                    console.log('Files uploaded:', uploadedUrls);
                } catch (error) {
                    console.error('File upload error:', error.message);
                    showError(`Failed to send files: ${error.message}`);
                    const tempMessage = document.querySelector('.message-group.temp');
                    if (tempMessage) tempMessage.remove();
                    resetInput();
                    return;
                }
            }

            let messageContent = text;
            if (uploadedUrls.length > 0) {
                messageContent = JSON.stringify({
                    text: text || '',
                    attachments: uploadedUrls
                });
            }

            if (text && text.startsWith('!image')) {
                const parts = text.trim().split(' ');
                const prompt = parts.length > 1 ? parts.slice(1).join(' ').trim() : '';
                console.log('Sending !image command:', { channel: window.currentChannel, prompt, replyTo, requestId });
                socket.emit('send_message', {
                    channel: window.currentChannel,
                    message: '!image',
                    is_media: false,
                    initial_prompt: prompt,
                    reply_to: replyTo,
                    request_id: requestId
                });
            } else {
                console.log('Sending message:', { channel: window.currentChannel, messageContent, is_media: uploadedUrls.length > 0, replyTo, requestId });
                socket.emit('send_message', {
                    channel: window.currentChannel,
                    message: messageContent,
                    is_media: uploadedUrls.length > 0,
                    reply_to: replyTo,
                    request_id: requestId
                });
            }

            resetInput();
            const tempMessage = document.querySelector('.message-group.temp');
            if (tempMessage) tempMessage.remove();
        } finally {
            isSending = false;
        }
    }

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        messageInput.addEventListener('paste', async (e) => {
            if (isSending) {
                console.log('Paste event ignored, send in progress');
                return;
            }
            try {
                e.preventDefault(); // Prevent default paste behavior
                const clipboardData = e.clipboardData || window.clipboardData;
                if (!clipboardData) {
                    console.error('No clipboard data available');
                    return;
                }

                const items = clipboardData.items;
                let pastedFiles = [];
                let pastedText = clipboardData.getData('text/plain') || '';

                // Handle pasted files
                for (const item of items) {
                    if (item.kind === 'file' && item.type.startsWith('image/') && pastedFiles.length < 8) {
                        const file = item.getAsFile();
                        if (file) {
                            pastedFiles.push(file);
                        }
                    }
                }

                // Append pasted text to existing input content
                if (pastedText) {
                    const currentText = messageInput.value;
                    const cursorPosition = messageInput.selectionStart;
                    // Insert text at cursor position or append if no selection
                    const newText =
                        currentText.slice(0, cursorPosition) +
                        pastedText +
                        currentText.slice(cursorPosition);
                    messageInput.value = newText;
                    // Move cursor to end of pasted text
                    const newCursorPosition = cursorPosition + pastedText.length;
                    messageInput.setSelectionRange(newCursorPosition, newCursorPosition);
                    console.log('Pasted text appended:', { pastedText, newText });
                    // Emit typing event if there's text
                    if (newText.trim() && selectedFiles.length === 0 && pastedFiles.length === 0) {
                        socket.emit('start_typing', { channel: window.currentChannel });
                    }
                }

                // Handle pasted files
                if (pastedFiles.length > 0) {
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
                                text: messageInput.value.trim(), // Include current input text
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
                }
            } finally {
                isSending = false;
            }
        });

        messageInput.addEventListener('input', () => {
            if (messageInput.value.trim() && selectedFiles.length === 0) {
                socket.emit('start_typing', { channel: window.currentChannel });
            }
        });
    }

    function resetInput() {
        selectedFiles = [];
        if (fileInput) fileInput.value = '';
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = `Message #${currentChannel}`;
            messageInput.value = '';
            delete messageInput.dataset.replyTo;
            replyBar.style.display = 'none';
            messageInput.focus();
        }
    }

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

    function adjustMessagesPadding() {
        const messagesContainer = document.getElementById('messages-container');
        const chatInputContainer = document.querySelector('.chat-input-container');
        if (messagesContainer && chatInputContainer) {
            const inputHeight = chatInputContainer.getBoundingClientRect().height;
            messagesContainer.style.paddingBottom = (inputHeight + 20) + 'px'; // 20px buffer
        }
    }

    // Adjust padding on load
    adjustMessagesPadding();

    // Adjust on window resize
    window.addEventListener('resize', adjustMessagesPadding);

    // Adjust when input height changes (textarea resize)
    if (messageInput) {
        messageInput.addEventListener('input', adjustMessagesPadding);
    }

    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.addEventListener('scroll', () => {
            if (!autoScrollEnabled) {
                const newMessagesButton = document.getElementById('new-messages-button');
                if (newMessagesButton) {
                    const isNearBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 10;
                    newMessagesButton.style.display = isNearBottom ? 'none' : 'flex';
                }
            }
        });
    }

    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            setActiveTab(tab.dataset.tab);
        });
    });

    const closeModal = document.getElementById('image-gen-modal')?.querySelector('.close-modal');
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            console.log('Close modal clicked');
            document.getElementById('image-gen-modal').classList.remove('active');
        });
    }

    // Handle cancel button in modal
    const cancelButton = document.querySelector('#image-gen-modal .cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cancel button clicked, sending cancel command');
            const requestId = Date.now().toString();
            socket.emit('send_message', {
                channel: currentChannel,
                message: '!image',
                is_media: false,
                form_data: { cancel: true },
                request_id: requestId
            });
            document.getElementById('image-gen-modal').classList.remove('active');
            console.log('Modal display set to none');
            delete messageInput.dataset.replyTo;
            replyBar.style.display = 'none';
            messageInput.placeholder = `Message #${currentChannel}`;
            messageInput.value = '';
            const tempMessage = document.querySelector('.message-group.temp');
            if (tempMessage) {
                console.log('Removing temporary message');
                tempMessage.remove();
            }
        });
    } else {
        console.warn('Cancel button not found in image-gen-modal');
    }
});
