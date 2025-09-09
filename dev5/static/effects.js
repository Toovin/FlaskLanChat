// === FALLING PASTA EFFECT ===
// STOLEN FROM HPOS10i.COM
const sparkles = 99;
let x = 0, y = 0, ox = 0, oy = 0;
let swide = 800, shigh = 600, sleft = 0, sdown = 0;
let currentTempMessageId = null; // New global variable to track temporary message ID

const tiny = [], star = [], starv = [], starx = [], stary = [], tinyx = [], tinyy = [], tinyv = [];
const starRotation = [], tinyRotation = [];
const starVelocityX = [], starVelocityY = [], tinyVelocityX = [], tinyVelocityY = [];
const starOpacity = [], tinyOpacity = [];

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

function createPasta(height, width) {
    const img = document.createElement('img');
    img.src = '/static/images/cursor.png';
    img.className = 'pasta-img'; // Add class for CSS styling
    img.style.position = 'absolute';
    img.style.height = height + 'px';
    img.style.width = width + 'px';
    img.style.cursor = 'url(/static/images/cursor2.png), auto';
    img.style.pointerEvents = 'none';
    img.style.zIndex = '999';
    img.style.opacity = '1';
    return img;
}

function sparkle() {
    if (Math.abs(x - ox) > 1 || Math.abs(y - oy) > 1) {
        ox = x;
        oy = y;
        for (let c = 0; c < sparkles; c++) {
            if (!starv[c]) {
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
    for (let c = 0; c < sparkles; c++) {
        if (starv[c]) update_star(c);
        if (tinyv[c]) update_tiny(c);
    }
    setTimeout(sparkle, 40);
}

function update_star(i) {
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

function update_tiny(i) {
    if (--tinyv[i] === 5) {
        tiny[i].style.width = '4px';
        tiny[i].style.height = '4px';
    }
    if (tinyv[i]) {
        tinyy[i] += tinyVelocityY[i] || (1 + Math.random() * 3);
        tinyx[i] += tinyVelocityX[i] || ((i % 5 - 2) / 5);
        tinyRotation[i] += 10;
        tinyOpacity[i] = tinyOpacity[i] !== undefined ? Math.max(tinyOpacity[i] - 0.05, 0) : 1;
        if (tinyy[i] < shigh + sdown && tinyx[i] < swide + sleft && tinyx[i] > 0 && tinyOpacity[i] > 0) {
            tiny[i].style.top = tinyy[i] + 'px';
            tiny[i].style.left = tinyx[i] + 'px';
            tiny[i].style.transform = `rotate(${tinyRotation[i]}deg)`;
            tiny[i].style.opacity = tinyOpacity[i];
        } else {
            tiny[i].style.visibility = 'hidden';
            tinyv[i] = 0;
        }
    } else {
        tiny[i].style.visibility = 'hidden';
    }
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
    console.log(`Explosion triggered at (${clickX}, ${clickY}), spawned ${spawned} particles`);
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

// Initialize pasta elements
for (let i = 0; i < sparkles; i++) {
    const pastaTiny = createPasta(8, 8);
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
    const pastaStar = createPasta(16, 16);
    pastaStar.style.visibility = 'hidden';
    document.body.appendChild(star[i] = pastaStar);
}

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

// === END FALLING PASTA EFFECT ===