let selectedDice = null;
let currentRoll = null;

function openDiceModal() {
    const modal = document.getElementById('dice-modal');
    if (modal) {
        modal.style.display = 'flex';
        resetDiceModal();
    }
}

function closeDiceModal() {
    const modal = document.getElementById('dice-modal');
    if (modal) {
        modal.style.display = 'none';
        resetDiceModal();
    }
}

function resetDiceModal() {
    selectedDice = null;
    currentRoll = null;
    
    // Reset selected dice
    document.querySelectorAll('.dice-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Reset form values
    document.getElementById('dice-count').value = 1;
    document.getElementById('dice-modifier').value = 0;
    document.getElementById('custom-dice-sides').value = 20;
    document.getElementById('custom-dice-count').value = 1;
    document.getElementById('custom-dice-modifier').value = 0;
    
    // Hide current roll display
    const currentRollDiv = document.querySelector('.current-roll');
    if (currentRollDiv) {
        currentRollDiv.style.display = 'none';
    }
    
    // Set to standard tab
    setActiveDiceTab('standard');
}

function setActiveDiceTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.dice-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.dice-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    const activeContent = document.getElementById(`dice-tab-${tabName}`);
    if (activeContent) {
        activeContent.style.display = 'block';
    }
}

function rollDice(sides, count = 1, modifier = 0) {
    const rolls = [];
    let total = 0;
    
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
    }
    
    total += modifier;
    
    return {
        sides,
        count,
        modifier,
        rolls,
        total,
        formula: `${count}d${sides}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`
    };
}

function displayRoll(rollData) {
    const currentRollDiv = document.querySelector('.current-roll');
    const formulaSpan = document.querySelector('.roll-formula');
    const resultSpan = document.querySelector('.roll-result');
    
    if (currentRollDiv && formulaSpan && resultSpan) {
        currentRollDiv.style.display = 'block';
        
        // Show individual rolls if more than one die
        let rollDetails = '';
        if (rollData.count > 1) {
            rollDetails = ` [${rollData.rolls.join(', ')}]`;
        }
        
        formulaSpan.textContent = `${rollData.formula}${rollDetails}`;
        resultSpan.textContent = rollData.total;
        
        currentRoll = rollData;
    }
}

function sendDiceRoll(rollData) {
    if (!socket || !currentChannel) {
        showError('Not connected to chat');
        return;
    }
    
    // Create a formatted message for the dice roll
    let message = `🎲 **${rollData.formula}** = **${rollData.total}**`;
    
    if (rollData.count > 1) {
        message += ` [${rollData.rolls.join(', ')}]`;
    }
    
    // Add critical hit/fail indicators for d20
    if (rollData.sides === 20 && rollData.count === 1) {
        if (rollData.rolls[0] === 20) {
            message += ' 🔥 **CRITICAL HIT!**';
        } else if (rollData.rolls[0] === 1) {
            message += ' 💥 **CRITICAL FAIL!**';
        }
    }
    
    socket.emit('send_dice_roll', {
        channel: currentChannel,
        roll_data: rollData,
        message: message,
        request_id: Date.now() + Math.random()
    });
    
    closeDiceModal();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Dice button in chat input area
    const diceButton = document.querySelector('.action-btn.dice-btn');
    if (diceButton) {
        diceButton.addEventListener('click', openDiceModal);
    }
    
    // Tab switching
    document.querySelectorAll('.dice-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            setActiveDiceTab(tab.dataset.tab);
        });
    });
    
    // Standard dice buttons
    document.querySelectorAll('.dice-btn[data-sides]').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove previous selection
            document.querySelectorAll('.dice-btn').forEach(b => b.classList.remove('selected'));
            
            // Select this dice
            btn.classList.add('selected');
            selectedDice = parseInt(btn.dataset.sides);
            
            // Perform roll
            const count = parseInt(document.getElementById('dice-count').value) || 1;
            const modifier = parseInt(document.getElementById('dice-modifier').value) || 0;
            
            const rollData = rollDice(selectedDice, count, modifier);
            displayRoll(rollData);
        });
    });
    
    // Custom dice roll button
    const customRollBtn = document.querySelector('.roll-custom-dice-btn');
    if (customRollBtn) {
        customRollBtn.addEventListener('click', () => {
            const sides = parseInt(document.getElementById('custom-dice-sides').value);
            const count = parseInt(document.getElementById('custom-dice-count').value) || 1;
            const modifier = parseInt(document.getElementById('custom-dice-modifier').value) || 0;
            
            if (sides < 2) {
                showError('Dice must have at least 2 sides');
                return;
            }
            
            if (count < 1 || count > 20) {
                showError('Number of dice must be between 1 and 20');
                return;
            }
            
            const rollData = rollDice(sides, count, modifier);
            displayRoll(rollData);
        });
    }
    
    // Modal close button
    const closeBtn = document.querySelector('#dice-modal .close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDiceModal);
    }
    
    // Click outside modal to close
    const diceModal = document.getElementById('dice-modal');
    if (diceModal) {
        diceModal.addEventListener('click', (e) => {
            if (e.target === diceModal) {
                closeDiceModal();
            }
        });
    }
    
    // Send roll on Enter key when roll is displayed
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && currentRoll && diceModal && diceModal.style.display === 'flex') {
            sendDiceRoll(currentRoll);
        }
    });
});

// Re-roll functionality
function reRoll() {
    if (!selectedDice && !currentRoll) return;
    
    const activeTab = document.querySelector('.dice-tab.active').dataset.tab;
    
    if (activeTab === 'standard' && selectedDice) {
        const count = parseInt(document.getElementById('dice-count').value) || 1;
        const modifier = parseInt(document.getElementById('dice-modifier').value) || 0;
        
        const rollData = rollDice(selectedDice, count, modifier);
        displayRoll(rollData);
    } else if (activeTab === 'custom') {
        const sides = parseInt(document.getElementById('custom-dice-sides').value);
        const count = parseInt(document.getElementById('custom-dice-count').value) || 1;
        const modifier = parseInt(document.getElementById('custom-dice-modifier').value) || 0;
        
        const rollData = rollDice(sides, count, modifier);
        displayRoll(rollData);
    }
}

// Add send button functionality
document.addEventListener('DOMContentLoaded', () => {
    // Add send button to current roll display
    const currentRollDiv = document.querySelector('.current-roll');
    if (currentRollDiv) {
        const sendButton = document.createElement('button');
        sendButton.textContent = 'Send to Chat';
        sendButton.className = 'send-roll-btn';
        sendButton.style.cssText = `
            margin-top: 10px;
            padding: 8px 16px;
            background: var(--accent);
            color: var(--text-primary);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            width: 100%;
        `;
        
        sendButton.addEventListener('click', () => {
            if (currentRoll) {
                sendDiceRoll(currentRoll);
            }
        });
        
        currentRollDiv.appendChild(sendButton);
    }
});