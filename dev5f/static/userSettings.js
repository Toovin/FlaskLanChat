// User Settings Management

window.currentUserSettings = {
    display_name: '',
    status: 'online',
    custom_status: '',
    theme: 'darker',
    compact_mode: false,
    show_timestamps: true,
    animated_bg: false,
    cursor_effect: 'orbiting',
    allow_dms: true,
    show_online_status: true,
    typing_indicators: true,
    avatar_url: null
};

let settingsModal = null;
let settingsChanged = false;

function initUserSettings() {
    settingsModal = document.getElementById('user-settings-modal');

    // Setup tab switching
    setupSettingsTabs();

    // Setup form handlers
    setupSettingsFormHandlers();

    // Load user settings on authentication
    socket.on('user_registered', () => {
        loadUserSettings();
    });

    // Handle settings response
    socket.on('user_settings', (settings) => {
        window.currentUserSettings = { ...window.currentUserSettings, ...settings };
        populateSettingsForm();
        updateUIAfterSettingsChange();
        // Also update user info display after settings are loaded
        if (typeof updateUserInfo === 'function') {
            updateUserInfo();
        }
    });

    // Handle settings update response
    socket.on('settings_updated', (data) => {
        if (data.success) {
            showSettingsMessage('Settings saved successfully!', 'success');
            settingsChanged = false;
            updateUIAfterSettingsChange();
        }
    });

    // Handle errors
    socket.on('error', (data) => {
        if (data.msg && data.msg.includes('settings')) {
            showSettingsMessage(data.msg, 'error');
        }
    });
}

function openUserSettings() {
    if (settingsModal) {
        settingsModal.style.display = 'flex';
        loadUserSettings();
        settingsChanged = false;
    }
}

function closeUserSettings() {
    if (settingsModal) {
        if (settingsChanged) {
            if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                settingsModal.style.display = 'none';
                settingsChanged = false;
            }
        } else {
            settingsModal.style.display = 'none';
        }
    }
}

function setupSettingsTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const tabContents = document.querySelectorAll('.settings-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.style.display = 'none');

            // Add active class to clicked tab
            tab.classList.add('active');

            // Show corresponding tab content
            const tabName = tab.getAttribute('data-tab');
            const tabContent = document.getElementById(`settings-tab-${tabName}`);
            if (tabContent) {
                tabContent.style.display = 'block';
            }
        });
    });
}

function setupSettingsFormHandlers() {
    // Avatar upload handler
    const avatarInput = document.getElementById('settings-avatar-input');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarUpload);
    }

    // Form input handlers to detect changes
    const inputs = settingsModal.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            settingsChanged = true;
            updateSaveButtonState();
        });

        if (input.type === 'text' || input.tagName === 'TEXTAREA') {
            input.addEventListener('input', () => {
                settingsChanged = true;
                updateSaveButtonState();
            });
        }
    });

    // Theme option handlers
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            themeOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            settingsChanged = true;
            updateSaveButtonState();
        });
    });

    // Save button handler
    const saveButton = document.querySelector('.save-settings-btn');
    if (saveButton) {
        saveButton.addEventListener('click', saveUserSettings);
    }
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showSettingsMessage('Please select an image file', 'error');
        return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        showSettingsMessage('Image must be smaller than 5MB', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch('/upload-avatar', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.url) {
            // Update preview
            const avatarPreview = document.getElementById('settings-current-avatar');
            if (avatarPreview) {
                avatarPreview.src = data.url;
            }

            window.currentUserSettings.avatar_url = data.url;
            settingsChanged = true;
            updateSaveButtonState();
            showSettingsMessage('Avatar uploaded successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to upload avatar');
        }
    } catch (error) {
        showSettingsMessage(`Avatar upload failed: ${error.message}`, 'error');
    }
}

function loadUserSettings() {
    socket.emit('get_user_settings');
}

function populateSettingsForm() {
    // Profile tab
    const displayNameInput = document.getElementById('settings-display-name');
    const statusSelect = document.getElementById('settings-status');
    const customStatusInput = document.getElementById('settings-custom-status');
    const avatarImg = document.getElementById('settings-current-avatar');

    if (displayNameInput) displayNameInput.value = window.currentUserSettings.display_name || '';
    if (statusSelect) statusSelect.value = window.currentUserSettings.status || 'online';
    if (customStatusInput) customStatusInput.value = window.currentUserSettings.custom_status || '';
    if (avatarImg && window.currentUserSettings.avatar_url) {
        avatarImg.src = window.currentUserSettings.avatar_url;
    }

    // Appearance tab
    const compactModeCheckbox = document.getElementById('settings-compact-mode');
    const showTimestampsCheckbox = document.getElementById('settings-show-timestamps');
    const animatedBgCheckbox = document.getElementById('settings-animated-bg');
    const cursorEffectSelect = document.getElementById('settings-cursor-effect');

    if (compactModeCheckbox) compactModeCheckbox.checked = currentUserSettings.compact_mode;
    if (showTimestampsCheckbox) showTimestampsCheckbox.checked = currentUserSettings.show_timestamps;
    if (animatedBgCheckbox) animatedBgCheckbox.checked = currentUserSettings.animated_bg;
    if (cursorEffectSelect) cursorEffectSelect.value = currentUserSettings.cursor_effect || 'orbiting';

    // Theme selection
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
        option.classList.toggle('active', option.getAttribute('data-theme') === currentUserSettings.theme);
    });

    // Privacy tab
    const allowDmsCheckbox = document.getElementById('settings-allow-dms');
    const showOnlineStatusCheckbox = document.getElementById('settings-show-online-status');
    const typingIndicatorsCheckbox = document.getElementById('settings-typing-indicators');

    if (allowDmsCheckbox) allowDmsCheckbox.checked = currentUserSettings.allow_dms;
    if (showOnlineStatusCheckbox) showOnlineStatusCheckbox.checked = currentUserSettings.show_online_status;
    if (typingIndicatorsCheckbox) typingIndicatorsCheckbox.checked = window.currentUserSettings.typing_indicators;
}

function collectSettingsFromForm() {
    const settings = {};

    // Profile settings
    const displayName = document.getElementById('settings-display-name')?.value.trim();
    const status = document.getElementById('settings-status')?.value;
    const customStatus = document.getElementById('settings-custom-status')?.value.trim();

    if (displayName !== undefined) settings.display_name = displayName;
    if (status !== undefined) settings.status = status;
    if (customStatus !== undefined) settings.custom_status = customStatus;

    // Appearance settings
    const compactMode = document.getElementById('settings-compact-mode')?.checked;
    const showTimestamps = document.getElementById('settings-show-timestamps')?.checked;
    const animatedBg = document.getElementById('settings-animated-bg')?.checked;
    const cursorEffect = document.getElementById('settings-cursor-effect')?.value;

    if (compactMode !== undefined) settings.compact_mode = compactMode;
    if (showTimestamps !== undefined) settings.show_timestamps = showTimestamps;
    if (animatedBg !== undefined) settings.animated_bg = animatedBg;
    if (cursorEffect !== undefined) settings.cursor_effect = cursorEffect;

    // Theme
    const activeTheme = document.querySelector('.theme-option.active');
    if (activeTheme) {
        settings.theme = activeTheme.getAttribute('data-theme');
    }

    // Privacy settings
    const allowDms = document.getElementById('settings-allow-dms')?.checked;
    const showOnlineStatus = document.getElementById('settings-show-online-status')?.checked;
    const typingIndicators = document.getElementById('settings-typing-indicators')?.checked;

    if (allowDms !== undefined) settings.allow_dms = allowDms;
    if (showOnlineStatus !== undefined) settings.show_online_status = showOnlineStatus;
    if (typingIndicators !== undefined) settings.typing_indicators = typingIndicators;

    // Avatar URL if changed
    if (window.currentUserSettings.avatar_url) {
        settings.avatar_url = window.currentUserSettings.avatar_url;
    }

    return settings;
}

function saveUserSettings() {
    const settings = collectSettingsFromForm();

    // Update local settings immediately
    window.currentUserSettings = { ...window.currentUserSettings, ...settings };

    // Show loading state
    const saveButton = document.querySelector('.save-settings-btn');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
    }

    socket.emit('update_user_settings', { settings });

    // Reset button state after a delay (will be updated when response comes)
    setTimeout(() => {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Changes';
        }
    }, 3000);
}

function updateSaveButtonState() {
    const saveButton = document.querySelector('.save-settings-btn');
    if (saveButton) {
        saveButton.disabled = !settingsChanged;
    }
}

// Theme accent colors for cursor tinting
const themeAccentColors = {
    'darker': '#8b4513',     // Saddle brown
    'light': '#007bff',     // Blue
    'dark': '#ff6b35',      // Orange
    'blue': '#1da1f2',      // Twitter blue
    'purple': '#a855f7',    // Purple
    'retro-green': '#00ff00', // Bright green
    'ice-blue': '#29b6f6',  // Bright blue
    'pika-yellow': '#ffff00', // Bright yellow
    'nature': '#66bb6a'     // Bright green
};

function updateThemedCursor(theme) {
    const accentColor = themeAccentColors[theme] || themeAccentColors['darker'];

    // Create a canvas to generate tinted cursor
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image first
        ctx.drawImage(img, 0, 0);

        // Apply color tint only to non-transparent pixels using 'source-atop' at 35% opacity
        ctx.globalCompositeOperation = 'source-atop';
        const alpha = 0.35;
        const r = parseInt(accentColor.slice(1, 3), 16);
        const g = parseInt(accentColor.slice(3, 5), 16);
        const b = parseInt(accentColor.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Reset blend mode
        ctx.globalCompositeOperation = 'source-over';

        // Convert to data URL and set as cursor
        const tintedCursor = canvas.toDataURL();
        document.body.style.cursor = `url('${tintedCursor}'), auto`;
    };

    img.onerror = function() {
        // Fallback to default cursor if image fails to load
        document.body.style.cursor = `url('/static/images/cursor2.png'), auto`;
    };

    img.src = '/static/images/cursor2.png';
}

function updateUIAfterSettingsChange() {
    // Update user info display
    updateUserInfo();

    // Apply theme if changed
    const theme = window.currentUserSettings.theme;
    if (theme) {
        // Remove any existing theme classes
        document.documentElement.className = document.documentElement.className.replace(/theme-\w+/g, '').trim();
        // Add the new theme class
        document.documentElement.classList.add(`theme-${theme}`);

        // Update themed cursor
        updateThemedCursor(theme);

        // Update pasta particles theme
        if (window.updatePastaTheme) {
            window.updatePastaTheme();
        }
    }

    // Apply other UI changes based on settings
    if (window.currentUserSettings.compact_mode) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }

    // Apply animated background
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        if (window.currentUserSettings.animated_bg) {
            appContainer.classList.add('animated-bg');
        } else {
            appContainer.classList.remove('animated-bg');
        }
    }

    // Update cursor effect
    if (window.updateCursorEffect) {
        window.updateCursorEffect();
    }
}

function showSettingsMessage(message, type = 'info') {
    // Remove existing message
    const existingMessage = document.querySelector('.settings-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `settings-message ${type}`;
    messageDiv.textContent = message;

    // Insert at the top of the modal content
    const modalContent = settingsModal.querySelector('.modal-content');
    const firstChild = modalContent.querySelector('h2');
    if (firstChild) {
        modalContent.insertBefore(messageDiv, firstChild.nextSibling);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initUserSettings);

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
        closeUserSettings();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && settingsModal && settingsModal.style.display === 'flex') {
        closeUserSettings();
    }
});