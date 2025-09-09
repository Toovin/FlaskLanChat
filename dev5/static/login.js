// DOM Ready & Login Handling
console.log('Initial DOM state:', {
    loginModal: !!loginModal,
    appContainer: !!appContainer,
    loadingSpinner: !!loadingSpinner
});

if (appContainer) appContainer.style.display = 'none';
if (loginModal) loginModal.style.display = 'flex';

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('username-input');
        const passwordInput = document.getElementById('password-input');
        const avatarInput = document.getElementById('avatar-input');
        const submitter = e.submitter;

        if (!usernameInput || !passwordInput) {
            console.error('Username or password input not found');
            showError('Form setup error. Please refresh.');
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const isRegister = submitter && submitter.id === 'register-button';

        if (!username || !password || username.length < 3 || password.length < 6) {
            showError('Username (min 3 chars) and password (min 6 chars) are required.');
            return;
        }

        currentUsername = username;
        if (loadingSpinner) loadingSpinner.style.display = 'block';

        let avatarUrl = null;
        if (avatarInput && avatarInput.files[0]) {
            console.log('Uploading avatar...');
            const formData = new FormData();
            formData.append('avatar', avatarInput.files[0]);
            try {
                const response = await fetch('/upload-avatar', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error('Avatar upload failed');
                const data = await response.json();
                if (data.url) {
                    avatarUrl = data.url;
                } else {
                    showError('Avatar upload failed.');
                    if (loadingSpinner) loadingSpinner.style.display = 'none';
                    return;
                }
            } catch (error) {
                console.error('Avatar upload error:', error);
                showError('Avatar upload failed.');
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                return;
            }
        }

        if (isRegister) {
            socket.emit('register_user_with_password', { username, password, avatar_url: avatarUrl });
        } else {
            socket.emit('login_user', { username, password, avatar_url: avatarUrl });
        }
    });
}