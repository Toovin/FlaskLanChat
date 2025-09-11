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

    // Explicitly hide image-gen-modal on load
    const imageGenModal = document.getElementById('image-gen-modal');
    if (imageGenModal) {
        imageGenModal.style.display = 'none';
        console.log('image-gen-modal hidden on page load');
    } else {
        console.warn('image-gen-modal not found in DOM');
    }

    // Ensure modal stays hidden initially
    setTimeout(() => {
        if (imageGenModal && imageGenModal.style.display !== 'none') {
            imageGenModal.style.display = 'none';
            console.log('image-gen-modal re-hidden after timeout');
        }
    }, 100);

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
                    messageInput.placeholder = `Message #${currentChannel}`;
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
            if (!text.startsWith('!image')) {
                addMessage(currentUsername || 'You', text || 'Sending...', !!selectedFiles.length, null, true, tempMessageId, replyTo);
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
                console.log('Sending !image command:', { channel: currentChannel, prompt, replyTo, requestId });
                socket.emit('send_message', {
                    channel: currentChannel,
                    message: '!image',
                    is_media: false,
                    initial_prompt: prompt,
                    reply_to: replyTo,
                    request_id: requestId
                });
            } else {
                console.log('Sending message:', { channel: currentChannel, messageContent, is_media: uploadedUrls.length > 0, replyTo, requestId });
                socket.emit('send_message', {
                    channel: currentChannel,
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
                        socket.emit('start_typing', { channel: currentChannel });
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
                            channel: currentChannel,
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
                socket.emit('start_typing', { channel: currentChannel });
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
            document.getElementById('image-gen-modal').style.display = 'none';
        });
    }
    const imageGenForm = document.getElementById('image-gen-modal')?.querySelector('#image-gen-form');
    if (imageGenForm) {
        // Debug existing event listeners
        console.log('Existing submit listeners on image-gen-form:', imageGenForm.__lookupGetter__('onsubmit'));
        // Remove existing listeners to prevent duplicates
        const newForm = imageGenForm.cloneNode(true);
        imageGenForm.parentNode.replaceChild(newForm, imageGenForm);
        console.log('Attaching submit listener to image-gen-form');
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (isSending) {
                console.log('Form submission ignored, send in progress');
                return;
            }
            isSending = true;
            try {
                console.log('Form submit triggered');
                const formData = new FormData(newForm);
                const payload = {
                    prompt: formData.get('prompt') || '',
                    batch_size: parseInt(formData.get('batch_size')) || 1,
                    width: parseInt(formData.get('width')) || 1024,
                    height: parseInt(formData.get('height')) || 1024,
                    steps: parseInt(formData.get('steps')) || 33,
                    cfg_scale: parseFloat(formData.get('cfg_scale')) || 7,
                    clip_skip: parseInt(formData.get('clip_skip')) || 2,
                    negative_prompt: formData.get('negative_prompt') || '',
                    sampler_name: formData.get('sampler_name') || 'Euler',
                    scheduler_name: formData.get('scheduler_name') || 'Simple'
                };

                if (!payload.prompt.trim()) {
                    showError('Prompt is required.');
                    return;
                }
                if (payload.batch_size < 1 || payload.batch_size > 4) {
                    showError('Batch size must be between 1 and 4.');
                    return;
                }

                const replyTo = messageInput.dataset.replyTo || null;
                const requestId = Date.now().toString();
                console.log('Sending !image command (form submit):', { channel: currentChannel, payload, replyTo, requestId });
                socket.emit('send_message', {
                    channel: currentChannel,
                    message: '!image',
                    is_media: false,
                    form_data: payload,
                    reply_to: replyTo,
                    request_id: requestId
                });
                document.getElementById('image-gen-modal').style.display = 'none';
                delete messageInput.dataset.replyTo;
                replyBar.style.display = 'none';
            } finally {
                isSending = false;
            }
        });
    }

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
            document.getElementById('image-gen-modal').style.display = 'none';
            console.log('Modal display set to none');
            delete messageInput.dataset.replyTo;
            replyBar.style.display = 'none';
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
