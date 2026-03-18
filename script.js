// =========================================
// SISTEMA DE AUDIO
// =========================================
// =========================================
// SISTEMA DE AUDIO (FIRE AND FORGET)
// =========================================
const soundPaths = {
    start: 'start.mp3', 
    slash: 'slash.mp3'  
};

// =========================================
// ESTADO DEL JUEGO Y CÁMARA
// =========================================
const cameraViews = ['view-side', 'view-diag', 'view-top'];
let currentViewIndex = 0;

const game = {
    state: 'BOOT', 
    level: 1,
    score: 0,      
    highScore: 0,  
    baseLimit: 600, 
    currentLimit: 600,
    startTime: 0,
    timerInterval: null,
    currentStance: 'stance-low'
};

const dom = {
    body: document.body,
    gameContainer: document.getElementById('game-container'),
    startScreen: document.getElementById('start-screen'),
    streak: document.getElementById('ui-streak'),
    record: document.getElementById('ui-record'),
    temp: document.getElementById('ui-temp'),
    weatherDesc: document.getElementById('ui-desc'),
    weatherIcon: document.getElementById('weather-visual'),
    clouds: document.getElementById('clouds'), // <--- NUBES
    clock: document.getElementById('ui-clock'),
    msg: document.getElementById('ui-message'),
    player: document.getElementById('player-samurai'),
    enemy: document.getElementById('enemy-samurai'),
    enemySword: document.getElementById('enemy-sword'),
    splatterLayer: document.getElementById('splatter-layer')
};

window.onload = () => {
    game.highScore = parseInt(localStorage.getItem('zanshinRecord')) || 0;
    updateScoreUI();
    fetchRealWeather();
    setupInput();
    updateClock();
    setInterval(updateClock, 1000);
};

function updateScoreUI() {
    dom.streak.innerText = `Muertes: ${game.score}`;
    dom.record.innerText = `Mejor Racha: ${game.highScore}`;
}

function changeCamera() {
    dom.gameContainer.classList.remove(cameraViews[currentViewIndex]);
    currentViewIndex = (currentViewIndex + 1) % cameraViews.length;
    dom.gameContainer.classList.add(cameraViews[currentViewIndex]);
}

function updateClock() {
    const now = new Date();
    dom.clock.innerText = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

async function fetchRealWeather() {
    try {
        const lat = 41.3850; const lon = 2.1734; 
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        const response = await fetch(url);
        const data = await response.json();
        const temp = data.current_weather.temperature;
        const code = data.current_weather.weathercode;
        
        let icon = '☀️'; let condition = 'Cielo Despejado';
        
        // LÓGICA DE NUBES
        if (code === 1) { icon = '🌤️'; condition = 'Mayormente Soleado'; dom.clouds.style.opacity = '0.3'; }
        else if (code === 2) { icon = '⛅'; condition = 'Nubes y Claros'; dom.clouds.style.opacity = '0.6'; }
        else if (code >= 3 && code <= 48) { icon = '☁️'; condition = 'Día Nublado'; dom.clouds.style.opacity = '0.9'; }
        else if (code >= 51 && code <= 67) { icon = '🌧️'; condition = 'Lluvia'; dom.clouds.style.opacity = '1'; }
        else if (code >= 71) { icon = '❄️'; condition = 'Nieve/Tormenta'; dom.clouds.style.opacity = '1'; }
        else { dom.clouds.style.opacity = '0'; } // Despejado total

        dom.temp.innerText = `${temp}°C`;
        dom.weatherDesc.innerText = condition;
        dom.weatherIcon.innerText = icon;
    } catch (error) {
        dom.temp.innerText = "--°C";
        dom.weatherDesc.innerText = "Sin datos del viento";
    }
}

// =========================================
// CONTROLES Y REPRODUCCIÓN AUDIO
// =========================================
// =========================================
// CONTROLES Y REPRODUCCIÓN AUDIO (CORREGIDO)
// =========================================
function setupInput() {
    dom.startScreen.addEventListener('click', () => {
        dom.startScreen.style.display = 'none';
        game.state = 'IDLE';
        
        // Forma limpia de desbloquear el audio en el primer clic sin causar errores
        audio.start.load();
        audio.slash.load();
    });

    dom.player.addEventListener('click', (e) => {
        e.stopPropagation(); 
        if (game.state === 'IDLE') startDuel();
    });

    dom.body.addEventListener('click', () => {
        if (game.state === 'PLAYER_INPUT') playerStrikes();
        else if (game.state === 'ENEMY_READY' || game.state === 'DUEL_START') duelFailed('TE HAS PRECIPITADO');
    });

    // MODO KUROSAWA
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'k') {
            game.kurosawa = !game.kurosawa;
            dom.body.classList.toggle('kurosawa-mode');
        }
    });
}

function playSound(type) {
    // Crea una instancia de audio completamente nueva y limpia cada vez
    let snd = new Audio(soundPaths[type]);
    let playPromise = snd.play();
    
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log("Audio temporalmente bloqueado:", error);
        });
    }
}

function spawnKillBillBlood(isPlayerDead = false) {
    const particleCount = 80; 
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'blood-particle';
        particle.style.left = '30px'; 
        particle.style.top = '20px';
        const size = Math.random() * 15 + 2;
        particle.style.width = size + 'px'; particle.style.height = size + 'px';
        
        // Si muere el jugador, la sangre sale hacia la izquierda
        const direction = isPlayerDead ? -1 : 1;
        const dx = ((Math.random() * 600) + 100) * direction; 
        const dy = (Math.random() * -500) - 100; 
        
        particle.style.setProperty('--dx', dx + 'px'); particle.style.setProperty('--dy', dy + 'px');
        
        if (isPlayerDead) dom.player.appendChild(particle);
        else dom.enemy.appendChild(particle);
        
        setTimeout(() => particle.remove(), 700);
    }
}

// =========================================
// LÓGICA DEL DUELO
// =========================================
function startDuel() {
    game.state = 'DUEL_START';
    game.currentLimit = Math.max(150, game.baseLimit - (game.level * 35));
    
    dom.msg.innerText = `Ronda ${game.level}`;
    
    game.currentStance = Math.random() > 0.5 ? 'stance-low' : 'stance-high';
    dom.enemy.classList.remove('stance-low', 'stance-high');
    dom.enemy.classList.add(game.currentStance);

    playSound('start');

    dom.enemy.style.transition = 'right 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
    dom.enemy.style.right = '25vw'; 

    const tenseWait = Math.random() * 4000 + 2000;
    setTimeout(enemyRaisesSword, tenseWait);
}

function enemyRaisesSword() {
    if (game.state !== 'DUEL_START') return; 
    game.state = 'ENEMY_READY';
    dom.msg.innerText = "";
    
    let targetTransform = '';
    if (game.currentStance === 'stance-low') {
        // Desde abajo hacia arriba
        if (currentViewIndex === 0) targetTransform = 'rotate(-10deg) translateX(10px)';
        // NUEVO: En diagonal, la espada se estira al dar el tajo
        else if (currentViewIndex === 1) targetTransform = 'rotate(-20deg) scaleX(1.3) translateX(10px)';
        else targetTransform = 'rotate(0deg)';
    } else {
        // Desde arriba hacia abajo
        if (currentViewIndex === 0) targetTransform = 'rotate(30deg) translateX(10px)';
        // NUEVO: En diagonal, la espada se estira al dar el tajo
        else if (currentViewIndex === 1) targetTransform = 'rotate(40deg) scaleX(1.3) translateX(10px)';
        else targetTransform = 'rotate(20deg)';
    }
    
    dom.enemySword.style.transition = `transform ${game.currentLimit}ms linear`;
    dom.enemySword.style.transform = targetTransform; 
    
    // Encendemos el rastro de la espada enemiga
    dom.enemySword.style.boxShadow = '0 0 15px #fff';
    
    game.state = 'PLAYER_INPUT';
    game.startTime = Date.now();
    
    game.timerInterval = setTimeout(() => {
        if(game.state === 'PLAYER_INPUT') {
            duelFailed("¡TE HA CORTADO!");
        }
    }, game.currentLimit);
}

function playerStrikes() {
    game.state = 'GAME_OVER';
    clearTimeout(game.timerInterval);
    
    const reactionTime = Date.now() - game.startTime;
    
    const computedTransform = window.getComputedStyle(dom.enemySword).getPropertyValue('transform');
    dom.enemySword.style.transition = 'none'; 
    dom.enemySword.style.transform = computedTransform; 

    dom.player.classList.add('attack'); // 1. Mueve a tu samurái
    playSound('slash')
    
    // Activa el temblor de la cámara al impactar
    dom.body.classList.add('shake-active');
    setTimeout(() => dom.body.classList.remove('shake-active'), 25);
    
    if (reactionTime <= game.currentLimit) {
        // VICTORIA
        spawnKillBillBlood(false); 
        game.score++; 
        
        let extraMsg = "";
        if (game.score > game.highScore) {
            game.highScore = game.score;
            localStorage.setItem('zanshinRecord', game.highScore);
            extraMsg = "\n¡NUEVO RÉCORD!";
            dom.streak.style.color = "#44ff44"; 
        }
        updateScoreUI();

        dom.enemy.classList.add('dead'); 
        dom.msg.style.color = '#44ff44';
        dom.msg.innerText = `¡TAJO PRECISO!\nTiempo: ${reactionTime}ms${extraMsg}`;
        
        setTimeout(() => { if (game.score >= 8) changeCamera(); }, 1200); 

        setTimeout(() => {
            dom.player.classList.remove('attack');
            game.level++;
            resetScene();
            startDuel();
        }, 3500); 
        
    }
}

function duelFailed(reason) {
    game.state = 'GAME_OVER';
    clearTimeout(game.timerInterval);

    if (reason === "¡TE HA CORTADO!") {
        playSound('slash');
        // NUEVO: Sangramos nosotros y nos caemos
        spawnKillBillBlood(true); 
        dom.player.classList.add('dead');
    }

    game.score = 0;
    dom.streak.style.color = "#ffcc00"; 
    updateScoreUI();

    dom.msg.style.color = '#ff3333';
    dom.msg.innerText = `HAS CAÍDO\n${reason}`;
    
    setTimeout(() => {
        dom.player.classList.remove('attack', 'dead');
        game.level = 1;
        currentViewIndex = 0; 
        dom.gameContainer.className = cameraViews[0]; 
        resetScene();
        dom.msg.style.color = '#ffcc00';
        dom.msg.innerText = "Haz clic en tu samurái para empezar";
        game.state = 'IDLE';
    }, 4000);
}

function resetScene() {
    dom.enemy.style.transition = 'none'; 
    dom.enemy.style.right = '-35vw'; 
    dom.enemy.classList.remove('dead', 'stance-low', 'stance-high');
    
    dom.enemySword.style.transition = '';
    dom.enemySword.style.transform = '';
    dom.enemySword.style.boxShadow = '';
}