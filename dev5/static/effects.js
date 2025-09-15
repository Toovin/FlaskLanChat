// === CURSOR EFFECTS ===
let sparkles = 5; // Default to 5 for orbiting, will change based on effect
let x = 0, y = 0, ox = 0, oy = 0;
let swide = 800, shigh = 600, sleft = 0, sdown = 0;
let currentTempMessageId = null; // New global variable to track temporary message ID

const tiny = [], star = [], starv = [], starx = [], stary = [], tinyx = [], tinyy = [], tinyv = [];
const starRotation = [], tinyRotation = [];
const starVelocityX = [], starVelocityY = [], tinyVelocityX = [], tinyVelocityY = [];
const starOpacity = [], tinyOpacity = [];
const starOrbitAngle = [], starOrbitRadius = [], starOrbitSpeed = []; // Orbiting properties

let currentCursorEffect = 'orbiting'; // Current effect type

function set_width() {
    let sw_min = 999999, sh_min = 999999;
    if (document.documentElement && document.documentElement.clientWidth) {
        if (document.documentElement.clientWidth > 0) sw_min = document.documentElement.clientWidth;
        if (document.documentElement.clientHeight > 0) sh_min = document.documentElement.clientHeight;
    }
    if (typeof(self.innerWidth) === 'number' && self.innerWidth) {
        if (self.innerWidth > 0 && self.innerWidth < sw_min) sw_min = self.innerWidth;
        if (self.innerHeight > 0 && self.innerHeight < sh_min) sh_min = self.innerHeight;
    }
    if (document.body.clientWidth) {
        if (document.body.clientWidth > 0 && document.body.clientWidth < sw_min) sw_min = document.body.clientWidth;
        if (document.body.clientHeight > 0 && document.body.clientHeight < sh_min) sh_min = document.body.clientHeight;
    }
    swide = sw_min === 999999 ? 800 : sw_min;
    shigh = sh_min === 999999 ? 600 : sh_min;
}

// Theme accent colors for pasta tinting (matching cursor theming)
const pastaThemeColors = {
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

function getCurrentTheme() {
    // Get current theme from document classes
    const themeClasses = Array.from(document.documentElement.classList);
    const themeClass = themeClasses.find(cls => cls.startsWith('theme-'));
    const theme = themeClass ? themeClass.replace('theme-', '') : 'darker';
    console.log('Current theme detected:', theme); // Debug logging
    return theme;
}

function getCurrentCursorEffect() {
    // Get cursor effect from user settings
    return window.currentUserSettings?.cursor_effect || 'orbiting';
}

function updateCursorEffect() {
    const newEffect = getCurrentCursorEffect();
    if (newEffect !== currentCursorEffect) {
        currentCursorEffect = newEffect;

        // Reset all particles when changing effects
        for (let i = 0; i < star.length; i++) {
            if (star[i]) {
                star[i].style.visibility = 'hidden';
                starv[i] = 0;
            }
            if (tiny[i]) {
                tiny[i].style.visibility = 'hidden';
                tinyv[i] = 0;
            }
        }

        // Set sparkles count based on effect
        if (newEffect === 'orbiting') {
            sparkles = 5;
        } else if (newEffect === 'falling') {
            sparkles = 99;
        } else { // 'none'
            sparkles = 0;
        }

        console.log('Cursor effect changed to:', newEffect, 'sparkles:', sparkles);
    }
}

function createThemedPasta(height, width) {
    const theme = getCurrentTheme();
    const accentColor = pastaThemeColors[theme] || pastaThemeColors['darker'];

    // Create canvas for tinting
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    return new Promise((resolve) => {
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw original pasta image
            ctx.drawImage(img, 0, 0);

            // Apply theme tint using source-atop (only affects non-transparent pixels) at 35% opacity
            ctx.globalCompositeOperation = 'source-atop';
            const alpha = 0.35;
            const r = parseInt(accentColor.slice(1, 3), 16);
            const g = parseInt(accentColor.slice(3, 5), 16);
            const b = parseInt(accentColor.slice(5, 7), 16);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Reset blend mode
            ctx.globalCompositeOperation = 'source-over';

            // Create the themed pasta element
            const pastaImg = document.createElement('img');
            pastaImg.src = canvas.toDataURL();
            pastaImg.className = 'pasta-img';
            pastaImg.style.position = 'absolute';
            pastaImg.style.height = height + 'px';
            pastaImg.style.width = width + 'px';
            pastaImg.style.pointerEvents = 'none';
            pastaImg.style.zIndex = '999';
            pastaImg.style.opacity = '1';

            resolve(pastaImg);
        };

        img.onerror = function() {
            // Fallback to regular pasta if theming fails
            const pastaImg = document.createElement('img');
            pastaImg.src = '/static/images/cursor.png';
            pastaImg.className = 'pasta-img';
            pastaImg.style.position = 'absolute';
            pastaImg.style.height = height + 'px';
            pastaImg.style.width = width + 'px';
            pastaImg.style.pointerEvents = 'none';
            pastaImg.style.zIndex = '999';
            pastaImg.style.opacity = '1';
            resolve(pastaImg);
        };

        img.src = '/static/images/cursor.png';
    });
}

async function createPasta(height, width) {
    return await createThemedPasta(height, width);
}

function sparkle() {
    // Only run if pasta elements are initialized
    if (!star[0] || !star[0].style) {
        setTimeout(sparkle, 40);
        return;
    }

    // Update cursor effect setting
    updateCursorEffect();

    // Skip if no effect selected
    if (currentCursorEffect === 'none') {
        setTimeout(sparkle, 40);
        return;
    }

    if (currentCursorEffect === 'orbiting') {
        // Initialize orbiting pastas if not already active
        for (let c = 0; c < sparkles; c++) {
            if (!starv[c] && star[c]) {
                // Initialize orbiting pasta
                const angle = (c / sparkles) * 2 * Math.PI; // Evenly distribute around circle
                const radius = 50 + Math.random() * 30; // Random radius between 50-80px
                const speed = 0.02 + Math.random() * 0.01; // Random orbital speed

                starx[c] = x + Math.cos(angle) * radius;
                stary[c] = y + Math.sin(angle) * radius;
                star[c].style.left = starx[c] + 'px';
                star[c].style.top = stary[c] + 'px';
                star[c].style.width = '20px';
                star[c].style.height = '20px';
                star[c].style.visibility = 'visible';
                star[c].style.opacity = '0.8';
                starv[c] = 9999; // Long-lived orbiting particles
                starRotation[c] = angle * (180 / Math.PI); // Convert to degrees
                starOrbitAngle[c] = angle;
                starOrbitRadius[c] = radius;
                starOrbitSpeed[c] = speed;
                starVelocityX[c] = 0;
                starVelocityY[c] = 0;
                starOpacity[c] = 0.8;
            }
        }
    } else if (currentCursorEffect === 'falling') {
        // Handle falling effect (original behavior)
        if (Math.abs(x - ox) > 1 || Math.abs(y - oy) > 1) {
            ox = x;
            oy = y;
            for (let c = 0; c < sparkles; c++) {
                if (!starv[c] && star[c]) {
                    star[c].style.left = (starx[c] = x) + 'px';
                    star[c].style.top = (stary[c] = y + 1) + 'px';
                    star[c].style.width = '24px';
                    star[c].style.height = '24px';
                    star[c].style.visibility = 'visible';
                    star[c].style.opacity = '1';
                    starv[c] = 20;
                    starRotation[c] = 0;
                    starVelocityX[c] = 0;
                    starVelocityY[c] = 0;
                    starOpacity[c] = 1;
                    break;
                }
            }
        }
    }

    // Update all particles based on current effect
    for (let c = 0; c < sparkles; c++) {
        if (starv[c] && star[c]) update_star(c);
        if (tinyv[c] && tiny[c]) update_tiny(c);
    }
    setTimeout(sparkle, 40);
}

function update_star(i) {
    if (starv[i]) {
        if (currentCursorEffect === 'orbiting') {
            // Calculate gravitational attraction to cursor
            const dx = x - starx[i];
            const dy = y - stary[i];
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Gravitational force (weaker when closer, stronger when farther)
            const force = Math.min(distance * 0.01, 2);
            const angleToCursor = Math.atan2(dy, dx);

            // Orbital motion: combine orbital velocity with gravitational attraction
            starOrbitAngle[i] += starOrbitSpeed[i];

            // Calculate desired orbital position
            const desiredX = x + Math.cos(starOrbitAngle[i]) * starOrbitRadius[i];
            const desiredY = y + Math.sin(starOrbitAngle[i]) * starOrbitRadius[i];

            // Move towards desired position with some gravitational pull
            const orbitDx = desiredX - starx[i];
            const orbitDy = desiredY - stary[i];
            const orbitDistance = Math.sqrt(orbitDx * orbitDx + orbitDy * orbitDy);

            // Apply movement
            if (orbitDistance > 1) {
                starx[i] += orbitDx * 0.1 + Math.cos(angleToCursor) * force * 0.5;
                stary[i] += orbitDy * 0.1 + Math.sin(angleToCursor) * force * 0.5;
            }

            // Update rotation
            starRotation[i] += 5;

            // Keep opacity high for orbiting pastas
            starOpacity[i] = 0.8;

            // Update position and style
            if (starx[i] >= 0 && starx[i] <= swide + sleft && stary[i] >= 0 && stary[i] <= shigh + sdown) {
                star[i].style.left = starx[i] + 'px';
                star[i].style.top = stary[i] + 'px';
                star[i].style.transform = `rotate(${starRotation[i]}deg)`;
                star[i].style.opacity = starOpacity[i];
                star[i].style.visibility = 'visible';
            } else {
                // If pasta goes off-screen, reset its position
                starOrbitAngle[i] = Math.random() * 2 * Math.PI;
                starOrbitRadius[i] = 50 + Math.random() * 30;
                starx[i] = x + Math.cos(starOrbitAngle[i]) * starOrbitRadius[i];
                stary[i] = y + Math.sin(starOrbitAngle[i]) * starOrbitRadius[i];
            }
        } else if (currentCursorEffect === 'falling') {
            // Original falling behavior
            if (--starv[i] === 10) {
                star[i].style.width = '12px';
                star[i].style.height = '12px';
            }
            if (starv[i]) {
                stary[i] += starVelocityY[i] || (1 + Math.random() * 4);
                starx[i] += starVelocityX[i] || ((i % 5 - 2) / 4);
                starRotation[i] += 10;
                starOpacity[i] = starOpacity[i] !== undefined ? Math.max(starOpacity[i] - 0.05, 0) : 1;
                if (stary[i] < shigh + sdown && starx[i] < swide + sleft && starx[i] > 0 && starOpacity[i] > 0) {
                    star[i].style.top = stary[i] + 'px';
                    star[i].style.left = starx[i] + 'px';
                    star[i].style.transform = `rotate(${starRotation[i]}deg)`;
                    star[i].style.opacity = starOpacity[i];
                } else {
                    star[i].style.visibility = 'hidden';
                    starv[i] = 0;
                }
                if (starOpacity[i] <= 0) {
                    star[i].style.visibility = 'hidden';
                    starv[i] = 0;
                }
            } else {
                tinyv[i] = 15;
                tiny[i].style.top = (tinyy[i] = stary[i]) + 'px';
                tiny[i].style.left = (tinyx[i] = starx[i]) + 'px';
                tiny[i].style.width = '8px';
                tiny[i].style.height = '8px';
                tinyRotation[i] = starRotation[i];
                tinyVelocityX[i] = starVelocityX[i];
                tinyVelocityY[i] = starVelocityY[i];
                tinyOpacity[i] = starOpacity[i];
                star[i].style.visibility = 'hidden';
                tiny[i].style.visibility = 'visible';
            }
        }
    }
}

function update_tiny(i) {
    // Tiny pastas not used in orbiting mode - keep hidden
    tiny[i].style.visibility = 'hidden';
    tinyv[i] = 0;
}

function explode(clickX, clickY) {
    const numExplosions = 10; // Number of pasta images to spawn
    let spawned = 0;
    for (let c = 0; c < sparkles && spawned < numExplosions; c++) {
        if (!starv[c]) {
            star[c].style.left = (starx[c] = clickX) + 'px';
            star[c].style.top = (stary[c] = clickY) + 'px';
            star[c].style.width = '24px';
            star[c].style.height = '24px';
            star[c].style.visibility = 'visible';
            starv[c] = 20;
            starRotation[c] = Math.random() * 360;
            const angle = Math.random() * 2 * Math.PI;
            const speed = 2 + Math.random() * 3;
            starVelocityX[c] = Math.cos(angle) * speed;
            starVelocityY[c] = Math.sin(angle) * speed;
            starOpacity[c] = Math.random() < 0.5 ? 1 : 0.8;
            spawned++;
        }
    }
    // console.log(`Explosion triggered at (${clickX}, ${clickY}), spawned ${spawned} particles`);
}

function mouse(e) {
    y = e ? e.pageY : event.y + sdown;
    x = e ? e.pageX : event.x + sleft;
}

function click(e) {
    if (e.target.closest('.image-viewer, .video-viewer, .message-input, #username-input, #password-input, .reaction-picker, .action-btn, .channel, .tab, .member, .close-modal, .cancel-button, .reply-indicator, .reply-bar')) {
        return;
    }
    const clickX = e ? e.pageX : event.x + sleft;
    const clickY = e ? e.pageY : event.y + sdown;
    explode(clickX, clickY);
}

function set_scroll() {
    sdown = typeof(self.pageYOffset) === 'number' ? self.pageYOffset :
            document.body && (document.body.scrollTop || document.body.scrollLeft) ? document.body.scrollTop :
            document.documentElement && document.documentElement.scrollTop ? document.documentElement.scrollTop : 0;
    sleft = typeof(self.pageXOffset) === 'number' ? self.pageXOffset :
            document.body && document.body.scrollLeft ? document.body.scrollLeft :
            document.documentElement && document.documentElement.scrollLeft ? document.documentElement.scrollLeft : 0;
}

// Initialize pasta elements asynchronously
async function initPastaElements() {
    for (let i = 0; i < sparkles; i++) {
        const pastaTiny = await createPasta(8, 8);
        pastaTiny.style.visibility = 'hidden';
        document.body.appendChild(tiny[i] = pastaTiny);
        starv[i] = 0;
        tinyv[i] = 0;
        starRotation[i] = 0;
        tinyRotation[i] = 0;
        starVelocityX[i] = 0;
        starVelocityY[i] = 0;
        starOpacity[i] = 1;
        tinyOpacity[i] = 1;
        starOrbitAngle[i] = 0;
        starOrbitRadius[i] = 50;
        starOrbitSpeed[i] = 0.02;
        const pastaStar = await createPasta(16, 16);
        pastaStar.style.visibility = 'hidden';
        document.body.appendChild(star[i] = pastaStar);
    }
}

// Function to update all existing pasta particles with new theme
async function updatePastaTheme() {
    const theme = getCurrentTheme();
    const accentColor = pastaThemeColors[theme] || pastaThemeColors['darker'];

    // Update all star (large) pasta particles
    for (let i = 0; i < sparkles; i++) {
        if (star[i]) {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = '/static/images/cursor.png';
                });

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                ctx.globalCompositeOperation = 'source-atop';
                const alpha = 0.35;
                const r = parseInt(accentColor.slice(1, 3), 16);
                const g = parseInt(accentColor.slice(3, 5), 16);
                const b = parseInt(accentColor.slice(5, 7), 16);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';

                star[i].src = canvas.toDataURL();
            } catch (error) {
                console.warn('Failed to update pasta theme for star', i, error);
            }
        }

        if (tiny[i]) {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = '/static/images/cursor.png';
                });

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                ctx.globalCompositeOperation = 'source-atop';
                const alpha = 0.35;
                const r = parseInt(accentColor.slice(1, 3), 16);
                const g = parseInt(accentColor.slice(3, 5), 16);
                const b = parseInt(accentColor.slice(5, 7), 16);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';

                tiny[i].src = canvas.toDataURL();
            } catch (error) {
                console.warn('Failed to update pasta theme for tiny', i, error);
            }
        }
    }
}

// Make updatePastaTheme available globally for theme switching
window.updatePastaTheme = updatePastaTheme;

// Make updateCursorEffect available globally for settings changes
window.updateCursorEffect = updateCursorEffect;

// Start initialization
initPastaElements();

// Workaround for input and textarea cursors
const focusableInputs = [
    '.message-input',
    '#username-input',
    '#password-input',
    '#prompt',
    '#width',
    '#height',
    '#steps',
    '#cfg_scale',
    '#clip_skip',
    '#negative_prompt'
];

focusableInputs.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
        el.addEventListener('focus', () => {
            el.style.cursor = 'url(/static/images/cursor2.png), auto';
        });
        el.addEventListener('select', () => {
            el.style.cursor = 'url(/static/images/cursor2.png), auto';
        });
        el.addEventListener('blur', () => {
            el.style.cursor = 'default';
        });
    });
});

set_width();
sparkle();
window.addEventListener('mousemove', mouse);
window.addEventListener('click', click);
window.addEventListener('scroll', set_scroll);
window.addEventListener('resize', set_width);

// === END ORBITING PASTA EFFECT ===