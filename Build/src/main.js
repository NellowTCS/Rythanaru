import { MapGenerator } from "./mapGenerator";
import { AudioEngine } from "./audioEngine";
import { CONSTANTS, ICONS } from "./constants";

const audio = new AudioEngine();
let gameState = {
    screen: 'menu', // menu, playing, results
    paused: false,
    difficulty: 'NORMAL',
    theme: { primary: '#22d3ee', secondary: '#c084fc', accent: '#f43f5e', bg: '#050010' },
    score: 0,
    combo: 0,
    maxCombo: 0,
    health: 100,
    notes: [],
    particles: [],
    startTime: 0,
    pauseTime: 0,
    totalPauseDuration: 0,
    activeKeys: new Set(),
    audioFile: null
};

let animationFrame;
let canvas, ctx;

// --- 4. HELPERS ---

const generateBackupTheme = (filename) => {
    let hash = 0;
    for (let i = 0; i < filename.length; i++) hash = filename.charCodeAt(i) + ((hash << 5) - hash);
    const c1 = Math.abs(hash % 360);
    return {
        primary: `hsl(${c1}, 80%, 60%)`,
        secondary: `hsl(${(c1 + 40) % 360}, 70%, 50%)`,
        accent: `hsl(${(c1 + 180) % 360}, 90%, 60%)`,
        bg: `hsl(${c1}, 60%, 5%)`
    };
};

const createExplosion = (x, y, color, type = 'normal') => {
    const count = type === 'gold' ? 20 : type === 'mine' ? 30 : 12;
    const speed = type === 'gold' ? 8 : type === 'mine' ? 10 : 5;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        gameState.particles.push({
            x, y,
            vx: Math.cos(angle) * (Math.random() * speed + 2),
            vy: Math.sin(angle) * (Math.random() * speed + 2),
            life: 1.0,
            color: type === 'gold' ? '#FFD700' : type === 'mine' ? '#ff0000' : color,
            type
        });
    }
};

const showJudgment = (text, color, subtext) => {
    const container = document.getElementById('judgment-container');
    const el = document.createElement('div');
    el.className = 'absolute text-center bounce-text';
    el.innerHTML = `
        <h2 class="text-6xl font-black italic" style="color: ${color}; text-shadow: 0 0 20px ${color}">${text}</h2>
        <p class="text-xs font-bold uppercase tracking-[1em] mt-2 text-white animate-pulse">${subtext}</p>
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 600);
};

// --- 5. DOM & GAME LOGIC ---

function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    setupDifficultyButtons();
    
    // Event Listeners
    document.getElementById('audio-input').addEventListener('change', handleFileUpload);
    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-back').addEventListener('click', resetMenu);
    document.getElementById('btn-pause-header').addEventListener('click', togglePause);
    document.getElementById('btn-resume').addEventListener('click', togglePause);
    document.getElementById('btn-quit').addEventListener('click', quitGame);
    document.getElementById('btn-menu-return').addEventListener('click', quitGame); // Reuse quit logic
    document.getElementById('btn-retry').addEventListener('click', startGame);
    
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);

    // Mobile Touch
    canvas.addEventListener('touchstart', handleTouch, {passive: false});
    
    updateDOM();
}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

function setupDifficultyButtons() {
    const container = document.getElementById('difficulty-selector');
    container.innerHTML = '';
    ['EASY', 'NORMAL', 'HARD'].forEach(level => {
        const btn = document.createElement('button');
        btn.className = `py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${gameState.difficulty === level ? 'bg-white text-black' : 'bg-white/5 text-white/40'}`;
        btn.innerText = level;
        btn.onclick = () => {
            gameState.difficulty = level;
            // Re-generate notes if song is loaded
            if(audio.buffer) {
                gameState.notes = MapGenerator.generate(audio.buffer, level);
                document.getElementById('note-count').innerText = `${gameState.notes.length} NOTES READY`;
            }
            setupDifficultyButtons(); // redraw state
        };
        container.appendChild(btn);
    });
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('loading-text').classList.remove('hidden');
    gameState.audioFile = file.name;
    gameState.theme = generateBackupTheme(file.name);
    
    // Apply theme to CSS
    document.getElementById('bg-layer').style.backgroundColor = gameState.theme.bg;
    document.documentElement.style.setProperty('--primary', gameState.theme.primary);

    const buffer = await audio.loadFile(file);
    gameState.notes = MapGenerator.generate(buffer, gameState.difficulty);
    
    // Switch Menu View
    document.getElementById('upload-area').classList.add('hidden');
    document.getElementById('ready-area').classList.remove('hidden');
    document.getElementById('song-name').innerText = file.name;
    document.getElementById('note-count').innerText = `${gameState.notes.length} NOTES READY`;
    
    // Update icon color
    document.getElementById('ready-icon-container').style.borderColor = gameState.theme.primary;
    document.getElementById('ready-icon-container').style.color = gameState.theme.primary;
}

function resetMenu() {
    document.getElementById('upload-area').classList.remove('hidden');
    document.getElementById('loading-text').classList.add('hidden');
    document.getElementById('ready-area').classList.add('hidden');
    document.getElementById('audio-input').value = '';
}

function switchScreen(screen) {
    gameState.screen = screen;
    ['screen-menu', 'screen-playing', 'screen-results'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(`screen-${screen}`).classList.remove('hidden');
    
    const headerBtn = document.getElementById('btn-pause-header');
    if(screen === 'playing') headerBtn.classList.remove('hidden');
    else headerBtn.classList.add('hidden');
}

function startGame() {
    gameState.score = 0;
    gameState.combo = 0;
    gameState.maxCombo = 0;
    gameState.health = 100;
    gameState.particles = [];
    gameState.paused = false;
    gameState.totalPauseDuration = 0;
    gameState.notes.forEach(n => { n.hit = false; n.missed = false; n.holding = false; }); // Reset notes

    switchScreen('playing');
    updateHUD();
    resizeCanvas();

    gameState.startTime = performance.now();
    audio.play(() => showResults());
    
    // Theme update for HUD
    document.getElementById('app-title').style.backgroundImage = `linear-gradient(to right, ${gameState.theme.primary}, ${gameState.theme.secondary})`;
    document.getElementById('btn-pause-header').innerHTML = ICONS.pause;

    gameLoop();
}

function showResults() {
    cancelAnimationFrame(animationFrame);
    audio.stop();
    switchScreen('results');
    document.getElementById('result-score').innerText = gameState.score.toLocaleString();
    document.getElementById('result-combo').innerText = gameState.maxCombo;
    document.getElementById('result-combo').style.color = gameState.theme.primary;
    
    let rank = 'F';
    if(gameState.health > 80) rank = 'S';
    else if(gameState.health > 60) rank = 'A';
    else if(gameState.health > 40) rank = 'B';
    else if(gameState.health > 0) rank = 'C';
    
    document.getElementById('result-rank').innerText = rank;
}

function togglePause() {
    if(gameState.screen !== 'playing') return;

    gameState.paused = !gameState.paused;
    const overlay = document.getElementById('overlay-pause');
    const btn = document.getElementById('btn-pause-header');

    if (gameState.paused) {
        audio.pause();
        gameState.pauseTime = performance.now();
        cancelAnimationFrame(animationFrame);
        overlay.classList.remove('hidden');
        btn.innerHTML = ICONS.play;
    } else {
        audio.resume();
        gameState.totalPauseDuration += performance.now() - gameState.pauseTime;
        overlay.classList.add('hidden');
        btn.innerHTML = ICONS.pause;
        gameLoop();
    }
}

function quitGame() {
    audio.stop();
    cancelAnimationFrame(animationFrame);
    switchScreen('menu');
}

function updateHUD() {
    // Desktop
    document.getElementById('hud-score').innerText = gameState.score.toLocaleString();
    document.getElementById('hud-combo').innerText = gameState.combo;
    document.getElementById('hud-combo').style.color = gameState.combo > 0 ? gameState.theme.primary : 'rgba(255,255,255,0.2)';
    
    const healthBar = document.getElementById('hud-health');
    healthBar.style.width = `${gameState.health}%`;
    healthBar.className = `h-full transition-all duration-300 w-full ${gameState.health < 30 ? 'bg-red-500' : 'bg-green-400'}`;

    // Mobile
    document.getElementById('hud-score-mobile').innerText = gameState.score.toLocaleString();
    document.getElementById('hud-combo-mobile').innerText = gameState.combo;
    document.getElementById('hud-combo-mobile').style.color = gameState.combo > 0 ? gameState.theme.primary : 'white';
    document.getElementById('hud-health-mobile').style.width = `${gameState.health}%`;
    document.getElementById('hud-health-mobile').className = `h-full ${gameState.health < 30 ? 'bg-red-500' : 'bg-green-400'}`;
}

function updateDOM() {
    // Generally handled by events, but initial setup here
}

// --- 6. INPUT HANDLING ---

function handleKey(e) {
    if (gameState.screen !== 'playing' || gameState.paused) {
        if (e.key === 'Escape') togglePause();
        return;
    }
    
    const laneMap = { 'd': 0, 'f': 1, 'j': 2, 'k': 3 };
    const lane = laneMap[e.key.toLowerCase()];
    if (lane === undefined) return;

    if (e.type === 'keydown' && !gameState.activeKeys.has(lane)) {
        gameState.activeKeys.add(lane);
        processHit(lane);
    } else if (e.type === 'keyup') {
        gameState.activeKeys.delete(lane);
    }
}

function handleTouch(e) {
    if (gameState.screen !== 'playing' || gameState.paused) return;
    e.preventDefault();
    
    const w = canvas.width;
    const laneWidth = w / 4;
    const touches = Array.from(e.touches);
    
    const currentLanes = new Set();

    touches.forEach(t => {
        const rect = canvas.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const lane = Math.floor(x / laneWidth);
        if (lane >= 0 && lane <= 3) currentLanes.add(lane);
    });

    // Trigger presses for new touches
    currentLanes.forEach(lane => {
        if (!gameState.activeKeys.has(lane)) {
            processHit(lane);
        }
    });

    gameState.activeKeys = currentLanes;
}

function processHit(lane) {
    const elapsed = performance.now() - gameState.startTime - gameState.totalPauseDuration;
    const note = gameState.notes.find(n => 
        !n.hit && !n.missed && n.lane === lane && Math.abs(n.time - elapsed) < CONSTANTS.WINDOW_GOOD
    );

    if (note) {
        if (note.type === 'mine') {
            note.hit = true;
            gameState.combo = 0;
            gameState.health = Math.max(0, gameState.health - 20);
            showJudgment('OUCH!', '#f00', 'Mine!');
            createExplosion(0, 0, '#f00', 'mine');
        } else {
            const diff = Math.abs(note.time - elapsed);
            
            // Visual calcs
            const w = canvas.width;
            const h = canvas.height;
            const laneWidth = w / 4;
            const x = lane * laneWidth + laneWidth/2;
            const y = h * CONSTANTS.HIT_ZONE_PERCENT;
            const isInner = lane === 1 || lane === 2;
            let color = isInner ? gameState.theme.primary : gameState.theme.secondary;
            if (note.type === 'gold') color = '#FFD700';

            createExplosion(x, y, color, note.type);

            note.hit = true;

            // Scoring
            let points = note.type === 'gold' ? 300 : 100;
            if (diff < CONSTANTS.WINDOW_PERFECT) {
                gameState.score += points * 2 + gameState.combo * 10;
                showJudgment(note.type === 'gold' ? 'JACKPOT!' : 'PERFECT', '#fff', 'Pure!');
            } else {
                gameState.score += points + gameState.combo * 5;
                showJudgment('GOOD', color, 'Hit');
            }
            gameState.combo++;
            if(gameState.combo > gameState.maxCombo) gameState.maxCombo = gameState.combo;
        }
        updateHUD();
    }
}

// --- 7. GAME LOOP ---

function gameLoop() {
    if (gameState.paused) return;

    const w = canvas.width;
    const h = canvas.height;
    const time = performance.now();
    const elapsed = time - gameState.startTime - gameState.totalPauseDuration;
    const { bass, mids, freqData } = audio.getAnalysis();

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, gameState.theme.bg);
    bgGrad.addColorStop(1, '#000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Bass Pulse
    ctx.fillStyle = gameState.theme.primary;
    ctx.globalAlpha = bass * 0.2;
    ctx.fillRect(0,0,w,h);
    ctx.globalAlpha = 1.0;

    // Visualizer Circle
    const cx = w/2, cy = h/2;
    const radius = Math.min(w,h) * 0.2 * (1 + bass * 0.2);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = gameState.theme.secondary;
    ctx.fill();

    // Frequency Bars
    const bars = 40;
    const step = (Math.PI*2)/bars;
    ctx.strokeStyle = gameState.theme.primary;
    ctx.lineWidth = 4;
    for(let i=0; i<bars; i++){
        const val = freqData[i] || 0;
        const len = (val/255) * 100 * (0.5+bass);
        const angle = i*step + (elapsed*0.0005);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle)*radius, cy + Math.sin(angle)*radius);
        ctx.lineTo(cx + Math.cos(angle)*(radius+len), cy + Math.sin(angle)*(radius+len));
        ctx.stroke();
    }

    // Highway
    const laneWidth = w/4;
    const hitY = h * CONSTANTS.HIT_ZONE_PERCENT;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0,0,w,h);

    // Lane Flashes
    gameState.activeKeys.forEach(lane => {
        const lg = ctx.createLinearGradient(0,h,0,0);
        lg.addColorStop(0, gameState.theme.primary);
        lg.addColorStop(1, 'transparent');
        ctx.fillStyle = lg;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(lane * laneWidth, 0, laneWidth, h);
        ctx.globalAlpha = 1.0;
    });

    // Hit Line
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2 + (bass * 6);
    ctx.beginPath();
    ctx.moveTo(0, hitY); ctx.lineTo(w, hitY);
    ctx.stroke();

    // Notes
    gameState.notes.forEach(note => {
        const pxPerMs = CONSTANTS.NOTE_SPEED * (h / 800);
        const y = hitY - (note.time - elapsed) * pxPerMs;

        // Miss Logic
        if (y > h + 50 && !note.missed && !note.hit) {
            if (note.type !== 'mine') {
                note.missed = true;
                gameState.combo = 0;
                gameState.health = Math.max(0, gameState.health - 10);
                showJudgment('MISS', '#888', '...');
                updateHUD();
            } else {
                note.missed = true; // Safe pass
            }
        }

        if (y > -100 && y < h + 50) {
            const x = note.lane * laneWidth + laneWidth/2;
            const isInner = note.lane === 1 || note.lane === 2;
            let color = isInner ? gameState.theme.primary : gameState.theme.secondary;
            if (note.type === 'gold') color = '#FFD700';
            if (note.type === 'mine') color = '#f00';

            const nw = laneWidth * 0.8;
            const nh = h * 0.06;

            ctx.fillStyle = note.missed && note.type !== 'mine' ? '#333' : color;

            if (!note.hit || note.type === 'mine') {
                ctx.shadowBlur = note.type === 'gold' ? 30 : 15;
                ctx.shadowColor = color;
                
                ctx.beginPath();
                if (note.type === 'gold') {
                    ctx.moveTo(x, y - nh); ctx.lineTo(x + nw/2, y); ctx.lineTo(x, y + nh); ctx.lineTo(x - nw/2, y);
                } else if (note.type === 'mine') {
                    ctx.arc(x, y, nw/3, 0, Math.PI*2);
                } else {
                    ctx.roundRect(x - nw/2, y - nh/2, nw, nh, 8);
                }
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    });

    // Particles
    gameState.particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.05;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.type==='gold'?6:4, 0, Math.PI*2);
        ctx.fill();
        if(p.life <= 0) gameState.particles.splice(i, 1);
    });
    ctx.globalAlpha = 1.0;

    if(gameState.health <= 0) {
        showResults();
    } else {
        animationFrame = requestAnimationFrame(gameLoop);
    }
}

// Initialize
window.onload = init;

