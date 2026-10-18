// ========================================================
// Tic Tac Toe: Player vs Computer with Persistent Stats
// ========================================================

const STORAGE_KEY = 'tictactoe_saved_stats_v2';

// --- State Variables ---
let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X'; // X is always the human player
let isGameActive = true;
let gameMode = 'ai-smart'; // Default: Player vs Smart Computer
let isAiThinking = false;
let isMuted = false;

// Persistent Statistics Model
let stats = {
    playerWins: 0,
    computerWins: 0,
    ties: 0,
    totalGames: 0,
    currentStreak: 0,
    bestStreak: 0,
    history: []
};

// Winning lines
const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// --- DOM References ---
const tiles = document.querySelectorAll('.tile');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const scoreXEl = document.getElementById('score-x');
const scoreOEl = document.getElementById('score-o');
const scoreTieEl = document.getElementById('score-tie');
const labelPlayerX = document.getElementById('label-player-x');
const labelPlayerO = document.getElementById('label-player-o');
const playerCardX = document.getElementById('card-player-x');
const playerCardO = document.getElementById('card-player-o');
const modeTabs = document.querySelectorAll('.mode-tab');
const resetRoundBtn = document.getElementById('reset-round-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const soundIcon = document.getElementById('sound-icon');
const strikeLine = document.getElementById('strike-line');
const gameBoardEl = document.getElementById('game-board');

// Analytics DOM elements
const statTotalGames = document.getElementById('stat-total-games');
const statWinRate = document.getElementById('stat-win-rate');
const statBestStreak = document.getElementById('stat-best-streak');
const streakBadge = document.getElementById('streak-badge');
const historyList = document.getElementById('history-list');

// Modal Elements
const resultModal = document.getElementById('result-modal');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalPlayAgainBtn = document.getElementById('modal-play-again-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');

// --- Storage Persistence Functions ---
function loadStatsFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            stats = {
                playerWins: parsed.playerWins || 0,
                computerWins: parsed.computerWins || 0,
                ties: parsed.ties || 0,
                totalGames: parsed.totalGames || 0,
                currentStreak: parsed.currentStreak || 0,
                bestStreak: parsed.bestStreak || 0,
                history: Array.isArray(parsed.history) ? parsed.history : []
            };
        }
    } catch (e) {
        console.warn('LocalStorage error or not available:', e);
    }
    renderStatsUI();
}

function saveStatsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
        console.warn('Could not save to LocalStorage:', e);
    }
    renderStatsUI();
}

function renderStatsUI() {
    scoreXEl.innerText = stats.playerWins;
    scoreOEl.innerText = stats.computerWins;
    scoreTieEl.innerText = stats.ties;

    statTotalGames.innerText = stats.totalGames;

    const winRate = stats.totalGames > 0
        ? Math.round((stats.playerWins / stats.totalGames) * 100)
        : 0;
    statWinRate.innerText = `${winRate}%`;

    statBestStreak.innerText = stats.bestStreak;
    streakBadge.innerText = `🔥 Streak: ${stats.currentStreak}`;

    // Render Recent Matches Log
    if (!historyList) return;
    if (stats.history.length === 0) {
        historyList.innerHTML = `<div class="history-empty">No games played yet. Play your first round against Computer!</div>`;
        return;
    }

    historyList.innerHTML = stats.history.slice(0, 8).map(item => {
        let badgeClass = 'badge-tie';
        let badgeText = 'DRAW';
        if (item.result === 'win') {
            badgeClass = 'badge-win';
            badgeText = 'YOU WON';
        } else if (item.result === 'loss') {
            badgeClass = 'badge-loss';
            badgeText = 'COMPUTER WON';
        }

        return `
            <div class="history-item">
                <div class="history-match-info">
                    <span class="history-badge ${badgeClass}">${badgeText}</span>
                    <span>vs ${item.opponent || 'Computer'}</span>
                </div>
                <span class="history-time">${item.time || ''}</span>
            </div>
        `;
    }).join('');
}

// --- Web Audio Synthesizer (Zero External Files) ---
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSound(type) {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (type === 'move-x') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.13);
        } else if (type === 'move-o') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.15);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.16);
        } else if (type === 'win') {
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const noteTime = now + (i * 0.09);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, noteTime);
                gain.gain.setValueAtTime(0.2, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(noteTime);
                osc.stop(noteTime + 0.3);
            });
        } else if (type === 'tie') {
            const notes = [440, 370, 311];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const noteTime = now + (i * 0.1);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, noteTime);
                gain.gain.setValueAtTime(0.08, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(noteTime);
                osc.stop(noteTime + 0.22);
            });
        } else if (type === 'click') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.05);
        }
    } catch (e) {
        console.warn('Audio warning:', e);
    }
}

// --- Confetti Particles ---
const confettiCanvas = document.getElementById('confetti-canvas');
let confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
let confettiParticles = [];
let confettiAnimationId = null;

function resizeConfetti() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfetti);
resizeConfetti();

function triggerConfetti() {
    if (!confettiCanvas || !confettiCtx) return;
    resizeConfetti();
    confettiParticles = [];
    const colors = ['#00f2fe', '#4facfe', '#ff0844', '#ff758c', '#a855f7', '#fbbf24', '#34d399'];

    for (let i = 0; i < 90; i++) {
        confettiParticles.push({
            x: window.innerWidth / 2 + (Math.random() - 0.5) * 160,
            y: window.innerHeight / 2 - 40,
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.8) * 16 - 2,
            size: Math.random() * 9 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            vRot: (Math.random() - 0.5) * 15,
            opacity: 1,
            shape: Math.random() > 0.4 ? 'rect' : 'circle'
        });
    }

    if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
    animateConfetti();
}

function animateConfetti() {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let aliveCount = 0;

    confettiParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35;
        p.vx *= 0.98;
        p.rotation += p.vRot;
        p.opacity -= 0.008;

        if (p.opacity > 0 && p.y < confettiCanvas.height + 20) {
            aliveCount++;
            confettiCtx.save();
            confettiCtx.globalAlpha = Math.max(0, p.opacity);
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate((p.rotation * Math.PI) / 180);
            confettiCtx.fillStyle = p.color;

            if (p.shape === 'rect') {
                confettiCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                confettiCtx.beginPath();
                confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                confettiCtx.fill();
            }
            confettiCtx.restore();
        }
    });

    if (aliveCount > 0) {
        confettiAnimationId = requestAnimationFrame(animateConfetti);
    } else {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiAnimationId = null;
    }
}

// --- Strike-Through Line Calculator ---
function drawStrikeLine(comboIndex) {
    if (!strikeLine || !gameBoardEl) return;
    const boardRect = gameBoardEl.getBoundingClientRect();
    const [c1, c2, c3] = WINNING_COMBOS[comboIndex];
    const tile1 = tiles[c1].getBoundingClientRect();
    const tile3 = tiles[c3].getBoundingClientRect();

    const x1 = tile1.left + tile1.width / 2 - boardRect.left;
    const y1 = tile1.top + tile1.height / 2 - boardRect.top;
    const x2 = tile3.left + tile3.width / 2 - boardRect.left;
    const y2 = tile3.top + tile3.height / 2 - boardRect.top;

    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    strikeLine.style.width = `${length + 30}px`;
    strikeLine.style.height = `6px`;
    strikeLine.style.left = `${midX - (length + 30) / 2}px`;
    strikeLine.style.top = `${midY - 3}px`;
    strikeLine.style.transform = `rotate(${angle}deg) scaleX(1)`;
    strikeLine.classList.add('visible');
}

function clearStrikeLine() {
    if (!strikeLine) return;
    strikeLine.classList.remove('visible');
    strikeLine.style.transform = 'scaleX(0)';
}

// --- Gameplay & Interaction ---
function handleTileClick(e) {
    const tile = e.currentTarget;
    const index = parseInt(tile.getAttribute('data-index'), 10);

    if (board[index] !== '' || !isGameActive || isAiThinking) {
        return;
    }

    makeMove(index, currentPlayer);

    if (!isGameActive) return;

    // If playing against Computer and it's Computer's turn
    if (gameMode !== 'pvp' && currentPlayer === 'O') {
        triggerComputerMove();
    }
}

function makeMove(index, player) {
    board[index] = player;
    const tile = tiles[index];
    tile.classList.add('taken');

    const span = document.createElement('span');
    span.className = `symbol symbol-${player.toLowerCase()}`;
    span.innerText = player;
    tile.innerHTML = '';
    tile.appendChild(span);

    playSound(player === 'X' ? 'move-x' : 'move-o');

    const winResult = checkWinner(board);

    if (winResult) {
        handleWin(winResult);
    } else if (isBoardFull(board)) {
        handleTie();
    } else {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        updateTurnDisplay();
    }
}

function updateTurnDisplay() {
    if (!isGameActive) return;

    if (currentPlayer === 'X') {
        statusText.innerText = gameMode === 'pvp' ? "Player X's Turn" : "Your Turn (X)";
        statusDot.className = 'status-dot';
        playerCardX.classList.add('active-turn');
        playerCardO.classList.remove('active-turn');
    } else {
        const oName = gameMode === 'pvp' ? "Player O" : "Computer (Thinking...)";
        statusText.innerText = oName;
        statusDot.className = 'status-dot dot-o';
        playerCardO.classList.add('active-turn');
        playerCardX.classList.remove('active-turn');
    }
}

function checkWinner(bd) {
    for (let i = 0; i < WINNING_COMBOS.length; i++) {
        const [a, b, c] = WINNING_COMBOS[i];
        if (bd[a] && bd[a] === bd[b] && bd[a] === bd[c]) {
            return {
                winner: bd[a],
                comboIndex: i,
                combo: [a, b, c]
            };
        }
    }
    return null;
}

function isBoardFull(bd) {
    return bd.every(cell => cell !== '');
}

function getFormattedTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function handleWin(result) {
    isGameActive = false;
    const { winner, comboIndex, combo } = result;

    // Highlight winning tiles
    combo.forEach(idx => {
        tiles[idx].classList.add('winner-tile', `winner-${winner.toLowerCase()}`);
    });

    drawStrikeLine(comboIndex);

    const isHumanWin = (winner === 'X');
    const isComputer = (gameMode !== 'pvp');

    // Update Persistent Stats
    stats.totalGames++;
    if (isHumanWin) {
        stats.playerWins++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.bestStreak) {
            stats.bestStreak = stats.currentStreak;
        }
        stats.history.unshift({
            result: 'win',
            opponent: isComputer ? (gameMode === 'ai-hard' ? 'Unbeatable AI' : 'Computer') : 'Player O',
            time: getFormattedTime()
        });
    } else {
        stats.computerWins++;
        stats.currentStreak = 0;
        stats.history.unshift({
            result: 'loss',
            opponent: isComputer ? (gameMode === 'ai-hard' ? 'Unbeatable AI' : 'Computer') : 'Player O',
            time: getFormattedTime()
        });
    }

    saveStatsToStorage();

    // Celebration & Audio
    playSound('win');
    if (isHumanWin) {
        triggerConfetti();
    }

    const winnerName = isHumanWin
        ? (isComputer ? "You Won!" : "Player X Won!")
        : (isComputer ? "Computer Won!" : "Player O Won!");

    statusText.innerText = `🎉 ${winnerName}`;

    setTimeout(() => {
        modalTitle.innerText = winnerName;
        modalTitle.className = `modal-title win-${winner.toLowerCase()}`;
        modalSubtitle.innerText = isHumanWin
            ? "Fantastic win! Result successfully saved in your browser record."
            : "Good effort! Practice makes perfect against the Computer.";
        resultModal.classList.add('active');
    }, 600);
}

function handleTie() {
    isGameActive = false;
    stats.totalGames++;
    stats.ties++;
    stats.currentStreak = 0;

    stats.history.unshift({
        result: 'tie',
        opponent: gameMode !== 'pvp' ? 'Computer' : 'Player O',
        time: getFormattedTime()
    });

    saveStatsToStorage();

    playSound('tie');
    statusText.innerText = "It's a Draw!";
    playerCardX.classList.remove('active-turn');
    playerCardO.classList.remove('active-turn');

    setTimeout(() => {
        modalTitle.innerText = "Game Tied!";
        modalTitle.className = "modal-title tie-result";
        modalSubtitle.innerText = "Equally matched! Result saved to records.";
        resultModal.classList.add('active');
    }, 450);
}

// --- Computer AI Decision Engine ---
function triggerComputerMove() {
    isAiThinking = true;
    updateTurnDisplay();

    // Realistic thinking pause (450ms)
    setTimeout(() => {
        if (!isGameActive) {
            isAiThinking = false;
            return;
        }

        let bestIndex;
        if (gameMode === 'ai-hard') {
            bestIndex = getBestMinimaxMove();
        } else {
            bestIndex = getSmartComputerMove();
        }

        isAiThinking = false;
        if (bestIndex !== undefined && bestIndex !== -1) {
            makeMove(bestIndex, 'O');
        }
    }, 450);
}

// Smart AI: wins if it can, blocks player, controls center, else random/strategic
function getSmartComputerMove() {
    const empty = board.map((v, i) => v === '' ? i : null).filter(v => v !== null);
    if (empty.length === 0) return -1;

    // 1. Can Computer Win on this move? Take it!
    for (let idx of empty) {
        board[idx] = 'O';
        if (checkWinner(board)) {
            board[idx] = '';
            return idx;
        }
        board[idx] = '';
    }

    // 2. Can Human (X) win on next move? Block it! (85% probability)
    if (Math.random() < 0.85) {
        for (let idx of empty) {
            board[idx] = 'X';
            if (checkWinner(board)) {
                board[idx] = '';
                return idx;
            }
            board[idx] = '';
        }
    }

    // 3. Take Center if available
    if (board[4] === '' && Math.random() < 0.7) {
        return 4;
    }

    // 4. Take available Corners (0, 2, 6, 8)
    const corners = [0, 2, 6, 8].filter(c => board[c] === '');
    if (corners.length > 0 && Math.random() < 0.6) {
        return corners[Math.floor(Math.random() * corners.length)];
    }

    // 5. Random empty tile
    return empty[Math.floor(Math.random() * empty.length)];
}

// Unbeatable Minimax AI
function getBestMinimaxMove() {
    if (board[4] === '') return 4;

    let bestScore = -Infinity;
    let move = -1;

    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            let score = minimax(board, 0, false);
            board[i] = '';
            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
    }
    return move;
}

function minimax(bd, depth, isMaximizing) {
    const winResult = checkWinner(bd);
    if (winResult) {
        return winResult.winner === 'O' ? (10 - depth) : (depth - 10);
    }
    if (isBoardFull(bd)) return 0;

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (bd[i] === '') {
                bd[i] = 'O';
                let evaluation = minimax(bd, depth + 1, false);
                bd[i] = '';
                maxEval = Math.max(maxEval, evaluation);
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let i = 0; i < 9; i++) {
            if (bd[i] === '') {
                bd[i] = 'X';
                let evaluation = minimax(bd, depth + 1, true);
                bd[i] = '';
                minEval = Math.min(minEval, evaluation);
            }
        }
        return minEval;
    }
}

// --- Controls & Reset Handlers ---
function resetRound() {
    board = ['', '', '', '', '', '', '', '', ''];
    isGameActive = true;
    isAiThinking = false;
    currentPlayer = 'X';

    clearStrikeLine();

    tiles.forEach(tile => {
        tile.innerHTML = '';
        tile.className = 'tile';
    });

    resultModal.classList.remove('active');
    updateTurnDisplay();
    playSound('click');
}

function resetAllSavedData() {
    const confirmed = confirm("Are you sure you want to clear all saved game records and stats from your browser?");
    if (!confirmed) return;

    stats = {
        playerWins: 0,
        computerWins: 0,
        ties: 0,
        totalGames: 0,
        currentStreak: 0,
        bestStreak: 0,
        history: []
    };
    saveStatsToStorage();
    resetRound();
}

function switchMode(newMode) {
    if (gameMode === newMode) return;
    gameMode = newMode;

    modeTabs.forEach(tab => {
        if (tab.getAttribute('data-mode') === newMode) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    if (newMode === 'pvp') {
        labelPlayerX.innerText = 'Player X';
        labelPlayerO.innerText = 'Player O';
    } else if (newMode === 'ai-hard') {
        labelPlayerX.innerText = 'You';
        labelPlayerO.innerText = 'Unbeatable AI';
    } else {
        labelPlayerX.innerText = 'You';
        labelPlayerO.innerText = 'Computer';
    }

    resetRound();
}

function toggleSound() {
    isMuted = !isMuted;
    if (isMuted) {
        soundIcon.innerText = '🔇';
        soundToggleBtn.classList.add('muted');
    } else {
        soundIcon.innerText = '🔊';
        soundToggleBtn.classList.remove('muted');
        playSound('click');
    }
}

// --- Setup Event Listeners ---
tiles.forEach(tile => {
    tile.addEventListener('click', handleTileClick);
});

modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode');
        switchMode(mode);
    });
});

resetRoundBtn.addEventListener('click', resetRound);
resetScoresBtn.addEventListener('click', resetAllSavedData);
soundToggleBtn.addEventListener('click', toggleSound);

modalPlayAgainBtn.addEventListener('click', resetRound);
modalCloseBtn.addEventListener('click', () => {
    resultModal.classList.remove('active');
    playSound('click');
});

resultModal.addEventListener('click', (e) => {
    if (e.target === resultModal) {
        resultModal.classList.remove('active');
    }
});

// Keyboard support
window.addEventListener('keydown', (e) => {
    const key = parseInt(e.key, 10);
    if (!isNaN(key) && key >= 1 && key <= 9) {
        const tileIdx = key - 1;
        if (tileIdx >= 0 && tileIdx < 9) {
            tiles[tileIdx].click();
        }
    } else if (e.key === 'r' || e.key === 'R') {
        resetRound();
    } else if (e.key === 'Escape') {
        resultModal.classList.remove('active');
    }
});

// Initialize on load
loadStatsFromStorage();
updateTurnDisplay();
