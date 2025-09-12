// User Settings Management

let currentUserSettings = {
    display_name: '',
    status: 'online',
    custom_status: '',
    theme: 'darker',
    custom_theme: null,
    compact_mode: false,
    show_timestamps: true,
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
        currentUserSettings = { ...currentUserSettings, ...settings };
        populateSettingsForm();
    });
    
    // Handle settings update response
    socket.on('settings_updated', (data) => {
        if (data.success) {
            showSettingsMessage('Settings saved successfully!', 'success');
            settingsChanged = false;
            // Update currentUserSettings with the saved data if provided
            if (data.settings) {
                currentUserSettings = { ...currentUserSettings, ...data.settings };
                console.log('Settings updated, current theme:', currentUserSettings.theme); // Debug log
            }
            // Don't call updateUIAfterSettingsChange here since theme should already be applied from preview
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
            
            const selectedTheme = option.getAttribute('data-theme');
            
            // Show/hide custom theme section
            const customSection = document.getElementById('custom-theme-section');
            if (selectedTheme === 'custom') {
                customSection.style.display = 'block';
                loadCustomThemeColors();
            } else {
                customSection.style.display = 'none';
            }
            
            // Apply theme immediately for preview
            previewTheme(selectedTheme);
            
            settingsChanged = true;
            updateSaveButtonState();
        });
    });
    
    // Custom theme handlers
    const customColorInputs = document.querySelectorAll('#custom-theme-section input[type="color"]');
    customColorInputs.forEach(input => {
        input.addEventListener('change', () => {
            settingsChanged = true;
            updateSaveButtonState();
            updateCustomThemePreview();
            
            // If custom theme is currently selected, apply changes immediately
            const activeTheme = document.querySelector('.theme-option.active');
            if (activeTheme && activeTheme.getAttribute('data-theme') === 'custom') {
                const colors = getCustomThemeData();
                applyCustomTheme(colors);
            }
        });
        
        // Also listen for input events for real-time preview
        input.addEventListener('input', () => {
            updateCustomThemePreview();
            
            // If custom theme is currently selected, apply changes immediately
            const activeTheme = document.querySelector('.theme-option.active');
            if (activeTheme && activeTheme.getAttribute('data-theme') === 'custom') {
                const colors = getCustomThemeData();
                applyCustomTheme(colors);
            }
        });
    });
    
    // Preview custom theme button
    const previewBtn = document.getElementById('preview-custom-theme');
    if (previewBtn) {
        previewBtn.addEventListener('click', previewCustomTheme);
    }
    
    // Reset custom theme button
    const resetBtn = document.getElementById('reset-custom-theme');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetCustomTheme);
    }
    
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
            
            currentUserSettings.avatar_url = data.url;
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
    
    if (displayNameInput) displayNameInput.value = currentUserSettings.display_name || '';
    if (statusSelect) statusSelect.value = currentUserSettings.status || 'online';
    if (customStatusInput) customStatusInput.value = currentUserSettings.custom_status || '';
    if (avatarImg && currentUserSettings.avatar_url) {
        avatarImg.src = currentUserSettings.avatar_url;
    }
    
    // Appearance tab
    const compactModeCheckbox = document.getElementById('settings-compact-mode');
    const showTimestampsCheckbox = document.getElementById('settings-show-timestamps');
    
    if (compactModeCheckbox) compactModeCheckbox.checked = currentUserSettings.compact_mode;
    if (showTimestampsCheckbox) showTimestampsCheckbox.checked = currentUserSettings.show_timestamps;
    
    // Theme selection - always set to match current settings
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
        option.classList.toggle('active', option.getAttribute('data-theme') === currentUserSettings.theme);
    });
    
    // Apply the current theme to make sure UI matches settings
    previewTheme(currentUserSettings.theme);
    
    // Show custom theme section if custom theme is selected
    const customSection = document.getElementById('custom-theme-section');
    if (currentUserSettings.theme === 'custom') {
        customSection.style.display = 'block';
        loadCustomThemeColors();
    } else {
        customSection.style.display = 'none';
    }
    
    // Privacy tab
    const allowDmsCheckbox = document.getElementById('settings-allow-dms');
    const showOnlineStatusCheckbox = document.getElementById('settings-show-online-status');
    const typingIndicatorsCheckbox = document.getElementById('settings-typing-indicators');
    
    if (allowDmsCheckbox) allowDmsCheckbox.checked = currentUserSettings.allow_dms;
    if (showOnlineStatusCheckbox) showOnlineStatusCheckbox.checked = currentUserSettings.show_online_status;
    if (typingIndicatorsCheckbox) typingIndicatorsCheckbox.checked = currentUserSettings.typing_indicators;
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
    
    if (compactMode !== undefined) settings.compact_mode = compactMode;
    if (showTimestamps !== undefined) settings.show_timestamps = showTimestamps;
    
    // Theme
    const activeTheme = document.querySelector('.theme-option.active');
    if (activeTheme) {
        settings.theme = activeTheme.getAttribute('data-theme');
        console.log('Collecting theme from form:', settings.theme); // Debug log
    }
    
    // Privacy settings
    const allowDms = document.getElementById('settings-allow-dms')?.checked;
    const showOnlineStatus = document.getElementById('settings-show-online-status')?.checked;
    const typingIndicators = document.getElementById('settings-typing-indicators')?.checked;
    
    if (allowDms !== undefined) settings.allow_dms = allowDms;
    if (showOnlineStatus !== undefined) settings.show_online_status = showOnlineStatus;
    if (typingIndicators !== undefined) settings.typing_indicators = typingIndicators;
    
    // Avatar URL if changed
    if (currentUserSettings.avatar_url) {
        settings.avatar_url = currentUserSettings.avatar_url;
    }
    
    // Custom theme data if custom theme is selected
    if (settings.theme === 'custom') {
        const customTheme = getCustomThemeData();
        settings.custom_theme = JSON.stringify(customTheme);
        console.log('Saving custom theme:', customTheme); // Debug log
    }
    
    return settings;
}

function saveUserSettings() {
    const settings = collectSettingsFromForm();
    
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

function updateUIAfterSettingsChange() {
    // Update user info display
    updateUserInfo();
    
    // Apply other UI changes based on settings (but not theme - that's handled by preview)
    if (currentUserSettings.compact_mode) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
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

// Custom Theme Functions
function loadCustomThemeColors() {
    const defaultColors = {
        primaryBg: '#000000',
        secondaryBg: '#333333',
        accent: '#6b6b6b',
        textPrimary: '#ffffff',
        textSecondary: '#e6f7ff',
        border: '#33aa33'
    };
    
    let customTheme = defaultColors;
    if (currentUserSettings.custom_theme) {
        try {
            customTheme = { ...defaultColors, ...JSON.parse(currentUserSettings.custom_theme) };
        } catch (e) {
            console.warn('Failed to parse custom theme, using defaults');
        }
    }
    
    document.getElementById('primary-bg-color').value = customTheme.primaryBg;
    document.getElementById('secondary-bg-color').value = customTheme.secondaryBg;
    document.getElementById('accent-color').value = customTheme.accent;
    document.getElementById('text-primary-color').value = customTheme.textPrimary;
    document.getElementById('text-secondary-color').value = customTheme.textSecondary;
    document.getElementById('border-color').value = customTheme.border;
    
    updateCustomThemePreview();
}

function getCustomThemeData() {
    return {
        primaryBg: document.getElementById('primary-bg-color').value,
        secondaryBg: document.getElementById('secondary-bg-color').value,
        accent: document.getElementById('accent-color').value,
        textPrimary: document.getElementById('text-primary-color').value,
        textSecondary: document.getElementById('text-secondary-color').value,
        border: document.getElementById('border-color').value
    };
}

function updateCustomThemePreview() {
    const colors = getCustomThemeData();
    const customPreview = document.querySelector('.custom-theme');
    
    if (customPreview) {
        customPreview.style.setProperty('--custom-bg-primary', colors.primaryBg);
        customPreview.style.setProperty('--custom-bg-secondary', colors.secondaryBg);
    }
}

function previewCustomTheme() {
    const colors = getCustomThemeData();
    applyCustomTheme(colors);
    showSettingsMessage('Custom theme preview applied! Save to make permanent.', 'success');
}

function resetCustomTheme() {
    document.getElementById('primary-bg-color').value = '#000000';
    document.getElementById('secondary-bg-color').value = '#333333';
    document.getElementById('accent-color').value = '#6b6b6b';
    document.getElementById('text-primary-color').value = '#ffffff';
    document.getElementById('text-secondary-color').value = '#e6f7ff';
    document.getElementById('border-color').value = '#33aa33';
    
    updateCustomThemePreview();
    settingsChanged = true;
    updateSaveButtonState();
}

function applyCustomTheme(colors) {
    const root = document.documentElement;
    root.style.setProperty('--bg-primary', colors.primaryBg);
    root.style.setProperty('--bg-secondary', colors.secondaryBg);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--border', colors.border);
    root.style.setProperty('--border-light', colors.border);
    
    // Generate hover and active states
    const accentRgb = hexToRgb(colors.accent);
    if (accentRgb) {
        root.style.setProperty('--hover', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.1)`);
        root.style.setProperty('--active', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.2)`);
        root.style.setProperty('--pulse-color', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.3)`);
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function clearAllThemes() {
    // Remove all theme classes
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    
    // Clear custom CSS properties that might have been set
    const root = document.documentElement;
    const customProperties = [
        '--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-quaternary',
        '--text-primary', '--text-secondary', '--text-muted',
        '--accent', '--accent-hover', '--border', '--border-light',
        '--hover', '--active', '--pulse-color', '--neon-glow', '--green'
    ];
    
    customProperties.forEach(prop => {
        root.style.removeProperty(prop);
    });
}

function previewTheme(themeName) {
    // Clear existing themes first
    clearAllThemes();
    
    if (themeName === 'custom') {
        // For custom theme, first try to get colors from form inputs
        // If form isn't populated yet, use saved custom_theme data
        let colors;
        try {
            colors = getCustomThemeData();
            // Check if we have actual color data (not just default empty values)
            if (!colors.primaryBg || colors.primaryBg === '#000000') {
                // Try to use saved custom theme data
                if (currentUserSettings.custom_theme) {
                    colors = { ...colors, ...JSON.parse(currentUserSettings.custom_theme) };
                }
            }
        } catch (e) {
            // Fallback to default colors if parsing fails
            colors = {
                primaryBg: '#000000',
                secondaryBg: '#333333',
                accent: '#6b6b6b',
                textPrimary: '#ffffff',
                textSecondary: '#e6f7ff',
                border: '#33aa33'
            };
        }
        applyCustomTheme(colors);
    } else {
        // For built-in themes, just add the theme class
        document.body.classList.add(`theme-${themeName}`);
    }
}