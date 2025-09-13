const socket = io(window.location.hostname + ':6970', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,  // Limit reconnection attempts
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,  // Increase max delay
    timeout: 20000,  // Connection timeout
    withCredentials: true,  // Enable sending cookies with SocketIO connection
    forceNew: false,  // Reuse connection if possible
    upgrade: true  // Allow upgrading to websocket
});

window.currentChannel = 'general';
window.currentUsername = null;
window.users_db = [];
window.isAuthenticated = false;
let autoScrollEnabled = localStorage.getItem('autoScrollEnabled') !== 'false';
let selectedFile = null;
/*let currentImageViewer = null;*/

const appContainer = document.getElementById('app-container');
const loginModal = document.getElementById('login-modal');
const loadingSpinner = document.getElementById('loading-spinner');

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        console.error('Error div not found:', message);
        const fallbackErrorDiv = document.createElement('div');
        fallbackErrorDiv.id = 'error-message';
        fallbackErrorDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #dc3545;
            color: white;
            padding: 10px;
            border-radius: 4px;
            z-index: 1000;
        `;
        fallbackErrorDiv.textContent = message;
        document.body.appendChild(fallbackErrorDiv);
        setTimeout(() => fallbackErrorDiv.remove(), 5000);
    }
}

function updateChannelHeader(channel) {
    const channelTab = document.querySelector('.tab[data-tab="channel"] span');
    const channelDescription = document.querySelector('.channel-description');
    if (channelTab) channelTab.textContent = channel;
    if (channelDescription) channelDescription.textContent = `${channel} discussion channel`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setActiveTab(tabName) {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
}

function randomColor() {
    const colors = ['7289DA', '43B581', 'FAA61A', 'F04747'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function updateUserInfo() {
    const usernameElement = document.querySelector('.user-info .username');
    const avatarElement = document.querySelector('.user-info .avatar img');
    if (!usernameElement || !avatarElement) {
        console.error('User info elements not found');
        showError('User info elements not found. Please refresh.');
        return;
    }
    usernameElement.textContent = currentUsername || 'Guest';
    const user = users_db.find(u => u.username === currentUsername);
    avatarElement.src = user && user.avatar_url ? user.avatar_url : `/static/avatars/smile_1.png`;
}

function updateMemberList() {
    const memberHeader = document.querySelector('.member-header h3');
    const memberGroup = document.querySelector('.member-group');
    if (!memberHeader || !memberGroup) {
        console.error('Member header or group not found:', { memberHeader, memberGroup });
        showError('Member list elements not found. Please refresh.');
        return;
    }
    memberHeader.textContent = `MEMBERS - ${users_db.length}`;
    memberGroup.innerHTML = '';
    users_db.forEach(user => {
        const member = document.createElement('div');
        member.className = 'member';
        const avatarOptions = ['smile_1.png', 'smile_2.png', 'smile_3.png'];
        const randomAvatar = avatarOptions[Math.floor(Math.random() * avatarOptions.length)];
        member.innerHTML = `
            <div class="member-avatar">
                <img src="${user.avatar_url || `/static/avatars/${randomAvatar}`}" alt="Avatar">
                <div class="status-dot online"></div>
            </div>
            <div class="member-info">
                <span class="member-name">${escapeHtml(user.username)}</span>
                <span class="member-status">Online</span>
            </div>
        `;
        memberGroup.appendChild(member);
        updateStatuses();
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!appContainer || !loginModal || !loadingSpinner) {
        console.error('Core elements not found:', { appContainer, loginModal, loadingSpinner });
        showError('Failed to initialize UI. Please refresh.');
        return;
    }
    console.log('Initializing UI: showing login modal');
    appContainer.classList.remove('visible');
    loginModal.style.display = 'flex';
    loadingSpinner.style.display = 'none';

    // Example socket event handler for user registration
    socket.on('user_registered', (data) => {
        if (appContainer) {
            appContainer.classList.add('visible');
            appContainer.style.display = 'flex';  // Override inline display: none
            console.log('App container made visible');
        }
    });
});
