// Adventure System Client-side Logic

let currentCity = null;

// Initialize adventure system
function initAdventure() {
    // Load user's city data when authenticated
    socket.on('user_registered', () => {
        loadCityData();
    });

    // Handle city data response
    socket.on('city_data', (data) => {
        currentCity = data.city;
        updateCityDisplay();
    });

    // Handle recruitment responses
    socket.on('recruitment_result', (data) => {
        if (data.success) {
            loadCityData(); // Refresh data
            showAdventureMessage(data.message, 'success');
        } else {
            showAdventureMessage(data.message, 'error');
        }
    });

    // Handle task assignment responses
    socket.on('task_assignment_result', (data) => {
        if (data.success) {
            loadCityData(); // Refresh data
            showAdventureMessage(data.message, 'success');
        } else {
            showAdventureMessage(data.message, 'error');
        }
    });
}

// Function called when adventure tab is activated
function activateAdventureTab() {
    if (window.isAuthenticated) {
        loadCityData();
    }
}

// Load city data from server
function loadCityData() {
    socket.emit('get_city_data');
}

// Update the city display with current data
function updateCityDisplay() {
    if (!currentCity) return;

    // Update resources
    document.getElementById('city-gold').textContent = currentCity.resources.gold || 0;
    document.getElementById('city-wood').textContent = currentCity.resources.wood || 0;
    document.getElementById('city-stone').textContent = currentCity.resources.stone || 0;
    document.getElementById('city-food').textContent = currentCity.resources.food || 0;

    // Update villagers
    updateVillagersList();

    // Update adventurers
    updateAdventurersList();

    // Update guards
    updateGuardsList();
}

function updateVillagersList() {
    const container = document.getElementById('villagers-list');
    container.innerHTML = '';

    if (!currentCity.villagers || currentCity.villagers.length === 0) {
        container.innerHTML = '<p>No villagers yet. Recruit some to generate resources!</p>';
        return;
    }

    currentCity.villagers.forEach(villager => {
        const villagerDiv = document.createElement('div');
        villagerDiv.className = 'unit-item';
        villagerDiv.innerHTML = `
            <div class="unit-info">
                <span class="unit-name">Villager</span>
                <span class="unit-task">${villager.task || 'Idle'}</span>
            </div>
            <div class="unit-actions">
                <select onchange="assignVillagerTask(${villager.id}, this.value)">
                    <option value="idle" ${villager.task === 'idle' ? 'selected' : ''}>Idle</option>
                    <option value="wood" ${villager.task === 'wood' ? 'selected' : ''}>Gather Wood</option>
                    <option value="stone" ${villager.task === 'stone' ? 'selected' : ''}>Mine Stone</option>
                    <option value="food" ${villager.task === 'food' ? 'selected' : ''}>Farm Food</option>
                </select>
            </div>
        `;
        container.appendChild(villagerDiv);
    });
}

function updateAdventurersList() {
    const container = document.getElementById('adventurers-list');
    container.innerHTML = '';

    if (!currentCity.adventurers || currentCity.adventurers.length === 0) {
        container.innerHTML = '<p>No adventurers yet. Recruit some heroes!</p>';
        return;
    }

    currentCity.adventurers.forEach(adventurer => {
        const advDiv = document.createElement('div');
        advDiv.className = 'unit-item';
        advDiv.innerHTML = `
            <div class="unit-info">
                <span class="unit-name">${adventurer.name}</span>
                <span class="unit-class">${adventurer.class} (${adventurer.subclass})</span>
                <span class="unit-level">Level ${adventurer.level}</span>
            </div>
            <div class="unit-stats">
                <span>HP: ${adventurer.hp}/${adventurer.max_hp}</span>
                <span>MP: ${adventurer.mp}/${adventurer.max_mp}</span>
            </div>
        `;
        container.appendChild(advDiv);
    });
}

function updateGuardsList() {
    const container = document.getElementById('guards-list');
    container.innerHTML = '';

    if (!currentCity.guards || currentCity.guards.length === 0) {
        container.innerHTML = '<p>No guards yet. Recruit some for protection!</p>';
        return;
    }

    currentCity.guards.forEach(guard => {
        const guardDiv = document.createElement('div');
        guardDiv.className = 'unit-item';
        guardDiv.innerHTML = `
            <div class="unit-info">
                <span class="unit-name">Guard</span>
                <span class="unit-level">Level ${guard.level}</span>
            </div>
            <div class="unit-stats">
                <span>HP: ${guard.hp}/${guard.max_hp}</span>
            </div>
        `;
        container.appendChild(guardDiv);
    });
}

// Recruitment functions
function recruitVillager() {
    socket.emit('recruit_unit', { type: 'villager' });
}

function recruitGuard() {
    socket.emit('recruit_unit', { type: 'guard' });
}

function showAdventurerRecruitModal() {
    document.getElementById('adventurer-recruit-modal').style.display = 'flex';

    // Add event listeners to class buttons
    document.querySelectorAll('.class-btn').forEach(btn => {
        btn.onclick = () => {
            const adventurerClass = btn.getAttribute('data-class');
            recruitAdventurer(adventurerClass);
        };
    });
}

function closeAdventurerRecruitModal() {
    document.getElementById('adventurer-recruit-modal').style.display = 'none';
}

function recruitAdventurer(adventurerClass) {
    socket.emit('recruit_unit', { type: 'adventurer', class: adventurerClass });
    closeAdventurerRecruitModal();
}

// Task assignment
function assignVillagerTask(villagerId, task) {
    socket.emit('assign_villager_task', { villager_id: villagerId, task: task });
}

// City interactions (placeholder)
function viewOtherCities() {
    showAdventureMessage('City viewing not implemented yet', 'info');
}

function sendMission() {
    showAdventureMessage('Mission system not implemented yet', 'info');
}

// Message display
function showAdventureMessage(message, type = 'info') {
    // Remove existing message
    const existing = document.querySelector('.adventure-message');
    if (existing) existing.remove();

    // Create new message
    const msgDiv = document.createElement('div');
    msgDiv.className = `adventure-message ${type}`;
    msgDiv.textContent = message;

    // Add to adventure container
    const container = document.querySelector('.adventure-container');
    if (container) {
        container.insertBefore(msgDiv, container.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (msgDiv.parentNode) {
                msgDiv.remove();
            }
        }, 5000);
    }
}

// Initialize socket listeners when script loads
initAdventure();