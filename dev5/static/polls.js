// Poll functionality
let pollModal = null;
let pollForm = null;

function initializePolls() {
    pollModal = document.getElementById('poll-modal');
    pollForm = document.getElementById('poll-form');

    if (!pollModal || !pollForm) {
        console.error('Poll modal or form not found');
        return;
    }

    // Poll button click handler
    const pollBtn = document.querySelector('.poll-btn');
    if (pollBtn) {
        pollBtn.addEventListener('click', showPollModal);
    }

    // Form submit handler
    pollForm.addEventListener('submit', handlePollSubmit);

    // Cancel button handler
    const cancelBtn = pollModal.querySelector('.cancel-button');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hidePollModal);
    }

    // Add option button handler
    const addOptionBtn = document.getElementById('add-option-btn');
    if (addOptionBtn) {
        addOptionBtn.addEventListener('click', addPollOption);
    }

    // Modal click outside to close
    pollModal.addEventListener('click', (e) => {
        if (e.target === pollModal) {
            hidePollModal();
        }
    });

    setupOptionHandlers();
}

function showPollModal() {
    if (!isAuthenticated) {
        showError('You must be logged in to create polls');
        return;
    }
    pollModal.style.display = 'flex';
}

function hidePollModal() {
    pollModal.style.display = 'none';
    resetPollForm();
}

function resetPollForm() {
    pollForm.reset();

    // Reset to 2 options
    const container = document.getElementById('poll-options-container');
    if (container) {
        container.innerHTML = `
            <div class="poll-option-input">
                <input type="text" placeholder="Option 1" required>
                <button type="button" class="remove-option-btn" style="display: none;">&times;</button>
            </div>
            <div class="poll-option-input">
                <input type="text" placeholder="Option 2" required>
                <button type="button" class="remove-option-btn" style="display: none;">&times;</button>
            </div>
        `;
        setupOptionHandlers();
    }
}

function addPollOption() {
    const container = document.getElementById('poll-options-container');
    if (!container) return;

    const optionCount = container.children.length;
    if (optionCount >= 10) {
        showError('Maximum 10 options allowed');
        return;
    }

    const optionDiv = document.createElement('div');
    optionDiv.className = 'poll-option-input';
    optionDiv.innerHTML = `
        <input type="text" placeholder="Option ${optionCount + 1}" required>
        <button type="button" class="remove-option-btn">&times;</button>
    `;

    container.appendChild(optionDiv);
    updateRemoveButtons();
    setupOptionHandlers();
}

function removePollOption(button) {
    const optionDiv = button.parentElement;
    const container = document.getElementById('poll-options-container');

    if (container.children.length <= 2) {
        showError('At least 2 options are required');
        return;
    }

    optionDiv.remove();
    updateRemoveButtons();
    updatePlaceholders();
}

function updateRemoveButtons() {
    const container = document.getElementById('poll-options-container');
    const removeButtons = container.querySelectorAll('.remove-option-btn');

    removeButtons.forEach(btn => {
        btn.style.display = container.children.length > 2 ? 'inline-block' : 'none';
    });
}

function updatePlaceholders() {
    const container = document.getElementById('poll-options-container');
    const inputs = container.querySelectorAll('input[type="text"]');

    inputs.forEach((input, index) => {
        input.placeholder = `Option ${index + 1}`;
    });
}

function setupOptionHandlers() {
    const removeButtons = document.querySelectorAll('.remove-option-btn');
    removeButtons.forEach(btn => {
        btn.removeEventListener('click', handleRemoveOption);
        btn.addEventListener('click', handleRemoveOption);
    });
}

function handleRemoveOption(e) {
    removePollOption(e.target);
}

function handlePollSubmit(e) {
    e.preventDefault();

    const question = document.getElementById('poll-question-input').value.trim();
    const optionInputs = document.querySelectorAll('#poll-options-container input[type="text"]');
    const options = Array.from(optionInputs)
        .map(input => input.value.trim())
        .filter(option => option.length > 0);

    if (!question) {
        showError('Question is required');
        return;
    }

    if (options.length < 2) {
        showError('At least 2 options are required');
        return;
    }

    if (options.length > 10) {
        showError('Maximum 10 options allowed');
        return;
    }

    // Check for duplicate options
    const uniqueOptions = [...new Set(options)];
    if (uniqueOptions.length !== options.length) {
        showError('Duplicate options are not allowed');
        return;
    }

    // Send poll creation request
    socket.emit('create_poll', {
        channel: currentChannel,
        question: question,
        options: options
    });

    hidePollModal();
}

function renderPoll(poll) {
    const pollDiv = document.createElement('div');
    pollDiv.className = 'poll-message';
    pollDiv.dataset.pollId = poll.id;

    const totalVotes = poll.votes.length;
    const voteCounts = {};
    const userVotes = {};

    // Count votes for each option
    poll.options.forEach((_, index) => {
        voteCounts[index] = 0;
    });

    poll.votes.forEach(vote => {
        voteCounts[vote.option_index]++;
        userVotes[vote.user_uuid] = vote.option_index;
    });

    const currentUser = users_db.find(u => u.username === currentUsername);
    const currentUserUuid = currentUser ? Object.keys(users_db).find(key => users_db[key] === currentUser) : null;
    const userHasVoted = currentUserUuid && userVotes.hasOwnProperty(currentUserUuid);

    let pollHTML = `
        <div class="poll-header">
            <i class="fas fa-poll"></i>
            <span class="poll-question">${escapeHtml(poll.question)}</span>
            ${poll.is_active ? '<span class="poll-status active">Active</span>' : '<span class="poll-status closed">Closed</span>'}
        </div>
        <div class="poll-options">
    `;

    poll.options.forEach((option, index) => {
        const voteCount = voteCounts[index] || 0;
        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
        const isSelected = userHasVoted && userVotes[currentUserUuid] === index;
        const canVote = poll.is_active && isAuthenticated;

        pollHTML += `
            <div class="poll-option ${isSelected ? 'selected' : ''}"
                 ${canVote ? `onclick="votePoll(${poll.id}, ${index})"` : ''}
                 ${canVote ? 'style="cursor: pointer;"' : ''}>
                <div class="poll-option-content">
                    <span class="poll-option-text">${escapeHtml(option)}</span>
                    <span class="poll-option-votes">${voteCount} vote${voteCount !== 1 ? 's' : ''} (${percentage}%)</span>
                </div>
                <div class="poll-option-bar">
                    <div class="poll-option-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    });

    pollHTML += `</div>`;

    // Add poll footer with total votes and close button
    const creator = Object.values(users_db).find(user =>
        Object.keys(users_db).find(key => users_db[key] === user) === poll.creator_uuid
    );
    const creatorName = creator ? creator.username : 'Unknown';
    const isCreator = currentUserUuid === poll.creator_uuid;

    pollHTML += `
        <div class="poll-footer">
            <span class="poll-total">${totalVotes} total vote${totalVotes !== 1 ? 's' : ''}</span>
            <span class="poll-creator">Created by ${escapeHtml(creatorName)}</span>
            ${poll.is_active && isCreator ? `<button class="poll-close-btn" onclick="closePoll(${poll.id})">Close Poll</button>` : ''}
        </div>
    `;

    pollDiv.innerHTML = pollHTML;
    return pollDiv;
}

function votePoll(pollId, optionIndex) {
    if (!isAuthenticated) {
        showError('You must be logged in to vote');
        return;
    }

    socket.emit('vote_poll', {
        poll_id: pollId,
        option_index: optionIndex,
        channel: currentChannel
    });
}

function closePoll(pollId) {
    socket.emit('close_poll', {
        poll_id: pollId,
        channel: currentChannel
    });
}

function updatePollInDOM(poll) {
    const existingPoll = document.querySelector(`[data-poll-id="${poll.id}"]`);
    if (existingPoll) {
        const newPoll = renderPoll(poll);
        existingPoll.replaceWith(newPoll);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Socket event handlers for polls
if (typeof socket !== 'undefined') {
    socket.on('poll_created', (data) => {
        if (data.channel === currentChannel) {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                const pollElement = renderPoll(data.poll);
                messagesContainer.appendChild(pollElement);

                if (autoScrollEnabled) {
                    scrollToBottom();
                }
            }
        }
    });

    socket.on('poll_updated', (data) => {
        if (data.channel === currentChannel) {
            updatePollInDOM(data.poll);
        }
    });

    socket.on('channel_polls', (data) => {
        if (data.channel === currentChannel) {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer && data.polls && data.polls.length > 0) {
                data.polls.forEach(poll => {
                    const pollElement = renderPoll(poll);
                    messagesContainer.appendChild(pollElement);
                });

                if (autoScrollEnabled) {
                    scrollToBottom();
                }
            }
        }
    });
}

// Initialize polls when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializePolls, 100); // Small delay to ensure other scripts are loaded
});