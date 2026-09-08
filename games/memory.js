/**
 * Memory Game - Card Matching
 * Improvements: CPU difficulty toggle, streak counter
 */

let gameState = {
  cards: [],
  flipped: [],
  matched: [],
  moves: 0,
  streak: 0,
  bestStreak: 0,
  gameActive: true,
  cpuDifficulty: 'perfect', // 'easy' or 'perfect'
  cpuMemory: new Map(), // For easy mode - what CPU has seen
  startTime: 0
};

let boardEl, statusEl, streakEl;
let api;

const CARD_ICONS = ['🍎', '🍌', '🍇', '🍊', '🍋', '🍉', '🍒', '🍓', '🥝', '🍍', '🥭', '🍑'];

export function mount(boardWrap, gameApi, config = {}) {
  api = gameApi;
  
  const pairs = config.pairs || 6;
  gameState.cpuDifficulty = config.cpuDifficulty || 'perfect';
  gameState.cpuMemory.clear();
  
  boardWrap.innerHTML = `
    <style>
      .memory-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 1rem;
      }
      .memory-stats {
        display: flex;
        gap: 2rem;
        margin-bottom: 1rem;
      }
      .memory-stat {
        text-align: center;
      }
      .memory-stat-value {
        font-size: 1.5rem;
        font-weight: bold;
        color: #f39c12;
      }
      .memory-board {
        display: grid;
        grid-template-columns: repeat(${Math.ceil(Math.sqrt(pairs * 2))}, 1fr);
        gap: 10px;
        max-width: 600px;
      }
      .memory-card {
        width: 80px;
        height: 80px;
        position: relative;
        transform-style: preserve-3d;
        transition: transform 0.5s;
        cursor: pointer;
      }
      .memory-card.flipped {
        transform: rotateY(180deg);
      }
      .memory-card.matched {
        animation: matchPulse 0.5s ease-in-out;
      }
      @keyframes matchPulse {
        0%, 100% { transform: rotateY(180deg) scale(1); }
        50% { transform: rotateY(180deg) scale(1.1); }
      }
      .memory-card-front,
      .memory-card-back {
        position: absolute;
        width: 100%;
        height: 100%;
        backface-visibility: hidden;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
      }
      .memory-card-front {
        background: linear-gradient(135deg, #667eea, #764ba2);
        transform: rotateY(180deg);
      }
      .memory-card-back {
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        border: 2px solid rgba(255,255,255,0.2);
      }
      .streak-good { color: #4caf50; }
      .streak-bad { color: #f44336; }
    </style>
    <div class="memory-container">
      <div class="memory-stats">
        <div class="memory-stat">
          <div>Moves</div>
          <div class="memory-stat-value" id="mem-moves">0</div>
        </div>
        <div class="memory-stat">
          <div>Streak</div>
          <div class="memory-stat-value" id="mem-streak">0</div>
        </div>
        <div class="memory-stat">
          <div>Best Streak</div>
          <div class="memory-stat-value" id="mem-best">0</div>
        </div>
      </div>
      <div class="memory-board" id="mem-board"></div>
      <div id="mem-status"></div>
    </div>
  `;
  
  boardEl = document.getElementById('mem-board');
  statusEl = document.getElementById('mem-status');
  streakEl = document.getElementById('mem-streak');
  
  initGame(pairs);
}

export function unmount() {}

function initGame(pairs) {
  gameState.startTime = Date.now();
  gameState.moves = 0;
  gameState.streak = 0;
  gameState.matched = [];
  gameState.flipped = [];
  gameState.gameActive = true;
  gameState.cpuMemory.clear();
  
  // Create card pairs
  const selectedIcons = CARD_ICONS.slice(0, pairs);
  const deck = [...selectedIcons, ...selectedIcons];
  
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  gameState.cards = deck.map((icon, idx) => ({ icon, id: idx }));
  
  renderBoard();
  updateStats();
  statusEl.textContent = 'Find matching pairs!';
}

function renderBoard() {
  boardEl.innerHTML = '';
  gameState.cards.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'memory-card';
    cardEl.dataset.index = idx;
    cardEl.innerHTML = `
      <div class="memory-card-front">${card.icon}</div>
      <div class="memory-card-back">❓</div>
    `;
    cardEl.addEventListener('click', () => handleCardClick(idx));
    boardEl.appendChild(cardEl);
  });
}

function handleCardClick(idx) {
  if (!gameState.gameActive) return;
  if (gameState.flipped.length >= 2) return;
  if (gameState.flipped.includes(idx)) return;
  if (gameState.matched.includes(idx)) return;
  
  flipCard(idx);
  gameState.flipped.push(idx);
  
  if (gameState.flipped.length === 2) {
    gameState.moves++;
    checkMatch();
  }
}

function flipCard(idx) {
  const cardEl = boardEl.querySelector(`[data-index="${idx}"]`);
  cardEl.classList.add('flipped');
}

function checkMatch() {
  const [idx1, idx2] = gameState.flipped;
  const card1 = gameState.cards[idx1];
  const card2 = gameState.cards[idx2];
  
  // Update CPU memory
  if (gameState.cpuDifficulty === 'easy') {
    gameState.cpuMemory.set(card1.icon, idx1);
    gameState.cpuMemory.set(card2.icon, idx2);
  }
  
  setTimeout(() => {
    if (card1.icon === card2.icon) {
      // Match!
      gameState.matched.push(idx1, idx2);
      gameState.streak++;
      if (gameState.streak > gameState.bestStreak) {
        gameState.bestStreak = gameState.streak;
      }
      
      const cardEl1 = boardEl.querySelector(`[data-index="${idx1}"]`);
      const cardEl2 = boardEl.querySelector(`[data-index="${idx2}"]`);
      cardEl1.classList.add('matched');
      cardEl2.classList.add('matched');
      
      gameState.flipped = [];
      updateStats();
      
      if (gameState.matched.length === gameState.cards.length) {
        endGame();
      }
    } else {
      // No match
      gameState.streak = 0;
      
      const cardEl1 = boardEl.querySelector(`[data-index="${idx1}"]`);
      const cardEl2 = boardEl.querySelector(`[data-index="${idx2}"]`);
      cardEl1.classList.remove('flipped');
      cardEl2.classList.remove('flipped');
      
      gameState.flipped = [];
      updateStats();
    }
  }, 1000);
}

function updateStats() {
  document.getElementById('mem-moves').textContent = gameState.moves;
  const streakEl = document.getElementById('mem-streak');
  streakEl.textContent = gameState.streak;
  streakEl.className = `memory-stat-value ${gameState.streak >= 3 ? 'streak-good' : ''}`;
  document.getElementById('mem-best').textContent = gameState.bestStreak;
}

function endGame() {
  gameState.gameActive = false;
  const duration = Math.round((Date.now() - gameState.startTime) / 1000);
  statusEl.textContent = `🎉 Complete! ${gameState.moves} moves in ${duration}s`;
  api.recordResult(`${gameState.moves} moves, streak: ${gameState.bestStreak}`, duration);
}
