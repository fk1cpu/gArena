/**
 * 2048 - Sliding Tile Puzzle
 * Improvements: Ghost tile preview, combo counter with multiplier
 */

let gameState = {
  grid: [],
  score: 0,
  bestScore: 0,
  gameOver: false,
  won: false,
  comboCount: 0,
  comboMultiplier: 1,
  ghostGrid: []
};

let boardEl, scoreEl, bestScoreEl, comboEl;
let api;

export function mount(boardWrap, gameApi, config = {}) {
  api = gameApi;
  
  // Load best score
  const savedBest = localStorage.getItem('game2048_best');
  if (savedBest) gameState.bestScore = parseInt(savedBest);
  
  boardWrap.innerHTML = `
    <style>
      .g2048-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 1rem;
      }
      .g2048-header {
        display: flex;
        justify-content: space-between;
        width: 320px;
        margin-bottom: 1rem;
      }
      .g2048-score-box {
        background: rgba(255,255,255,0.1);
        padding: 0.5rem 1rem;
        border-radius: 8px;
        text-align: center;
      }
      .g2048-score-label { font-size: 0.8rem; color: #aaa; }
      .g2048-score-value { font-size: 1.5rem; font-weight: bold; }
      .g2048-combo {
        color: #f39c12;
        font-weight: bold;
        animation: comboPulse 0.3s ease-in-out;
      }
      @keyframes comboPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
      }
      .g2048-board {
        background: #bbada0;
        padding: 10px;
        border-radius: 8px;
        position: relative;
      }
      .g2048-grid {
        display: grid;
        grid-template-columns: repeat(4, 75px);
        gap: 10px;
      }
      .g2048-cell {
        width: 75px;
        height: 75px;
        background: rgba(238, 228, 218, 0.35);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: bold;
        position: relative;
      }
      .g2048-cell.ghost {
        opacity: 0.4;
        border: 2px dashed rgba(255,255,255,0.5);
      }
      .g2048-2 { background: #eee4da; color: #776e65; }
      .g2048-4 { background: #ede0c8; color: #776e65; }
      .g2048-8 { background: #f2b179; color: #f9f6f2; }
      .g2048-16 { background: #f59563; color: #f9f6f2; }
      .g2048-32 { background: #f67c5f; color: #f9f6f2; }
      .g2048-64 { background: #f65e3b; color: #f9f6f2; }
      .g2048-128 { background: #edcf72; color: #f9f6f2; font-size: 1.7rem; }
      .g2048-256 { background: #edcc61; color: #f9f6f2; font-size: 1.7rem; }
      .g2048-512 { background: #edc850; color: #f9f6f2; font-size: 1.7rem; }
      .g2048-1024 { background: #edc53f; color: #f9f6f2; font-size: 1.4rem; }
      .g2048-2048 { background: #edc22e; color: #f9f6f2; font-size: 1.4rem; }
      .g2048-super { background: #3c3a32; color: #f9f6f2; font-size: 1.2rem; }
      .tile-new { animation: pop 0.2s; }
      .tile-merged { animation: merged 0.2s; }
      @keyframes pop {
        0% { transform: scale(0); }
        100% { transform: scale(1); }
      }
      @keyframes merged {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      .g2048-message {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(238, 228, 218, 0.9);
        padding: 2rem;
        border-radius: 12px;
        text-align: center;
        display: none;
      }
      .g2048-message.show { display: block; }
    </style>
    <div class="g2048-container">
      <div class="g2048-header">
        <div class="g2048-score-box">
          <div class="g2048-score-label">Score</div>
          <div class="g2048-score-value" id="g2048-score">0</div>
        </div>
        <div class="g2048-score-box">
          <div class="g2048-score-label">Best</div>
          <div class="g2048-score-value" id="g2048-best">${gameState.bestScore}</div>
        </div>
      </div>
      <div style="margin-bottom: 0.5rem; min-height: 1.5em;">
        <span id="g2048-combo"></span>
      </div>
      <div class="g2048-board">
        <div class="g2048-grid" id="g2048-grid"></div>
        <div class="g2048-message" id="g2048-message">
          <h2 id="g2048-msg-title"></h2>
          <button onclick="initGame()" style="padding: 0.8rem 1.5rem; background: #f67c5f; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;">Play Again</button>
        </div>
      </div>
    </div>
  `;
  
  boardEl = document.getElementById('g2048-grid');
  scoreEl = document.getElementById('g2048-score');
  bestScoreEl = document.getElementById('g2048-best');
  comboEl = document.getElementById('g2048-combo');
  
  initGame();
  
  // Keyboard controls
  document.addEventListener('keydown', handleKey);
}

export function unmount() {
  // Remove keyboard listener
}

function initGame() {
  gameState.grid = Array(4).fill(null).map(() => Array(4).fill(0));
  gameState.score = 0;
  gameState.gameOver = false;
  gameState.won = false;
  gameState.comboCount = 0;
  gameState.comboMultiplier = 1;
  
  document.getElementById('g2048-message').classList.remove('show');
  
  addRandomTile();
  addRandomTile();
  renderBoard();
  updateScore();
}

function addRandomTile() {
  const empty = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (gameState.grid[r][c] === 0) empty.push({ r, c });
    }
  }
  
  if (empty.length > 0) {
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    gameState.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }
}

function renderBoard() {
  boardEl.innerHTML = '';
  
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const cell = document.createElement('div');
      cell.className = 'g2048-cell';
      
      const value = gameState.grid[r][c];
      const ghostValue = gameState.ghostGrid?.[r]?.[c] || 0;
      
      if (value > 0) {
        cell.textContent = value;
        cell.classList.add(value <= 2048 ? `g2048-${value}` : 'g2048-super');
      } else if (ghostValue > 0) {
        cell.textContent = ghostValue;
        cell.classList.add('ghost');
      }
      
      boardEl.appendChild(cell);
    }
  }
}

function handleKey(e) {
  if (gameState.gameOver) return;
  
  let moved = false;
  const key = e.key;
  
  // Calculate ghost positions before move
  calculateGhost(key);
  
  if (key === 'ArrowUp' || key === 'w') moved = move('up');
  else if (key === 'ArrowDown' || key === 's') moved = move('down');
  else if (key === 'ArrowLeft' || key === 'a') moved = move('left');
  else if (key === 'ArrowRight' || key === 'd') moved = move('right');
  
  if (moved) {
    addRandomTile();
    renderBoard();
    updateScore();
    checkGameStatus();
    
    // Clear ghost after short delay
    setTimeout(() => { gameState.ghostGrid = []; renderBoard(); }, 200);
  }
}

function calculateGhost(direction) {
  gameState.ghostGrid = Array(4).fill(null).map(() => Array(4).fill(0));
  
  // Simulate move to find where tiles will land
  const simGrid = gameState.grid.map(r => [...r]);
  
  if (direction === 'left' || direction === 'right') {
    for (let r = 0; r < 4; r++) {
      const row = simGrid[r].filter(v => v !== 0);
      if (direction === 'right') row.reverse();
      
      for (let i = 0; i < row.length - 1; i++) {
        if (row[i] === row[i + 1]) {
          row.splice(i + 1, 1);
        }
      }
      
      while (row.length < 4) row.push(0);
      if (direction === 'right') row.reverse();
      
      for (let c = 0; c < 4; c++) {
        if (row[c] !== 0 && simGrid[r][c] === 0) {
          gameState.ghostGrid[r][c] = row[c];
        }
      }
    }
  } else {
    for (let c = 0; c < 4; c++) {
      const col = simGrid.map(r => r[c]).filter(v => v !== 0);
      if (direction === 'down') col.reverse();
      
      for (let i = 0; i < col.length - 1; i++) {
        if (col[i] === col[i + 1]) {
          col.splice(i + 1, 1);
        }
      }
      
      while (col.length < 4) col.push(0);
      if (direction === 'down') col.reverse();
      
      for (let r = 0; r < 4; r++) {
        if (col[r] !== 0 && simGrid[r][c] === 0) {
          gameState.ghostGrid[r][c] = col[r];
        }
      }
    }
  }
}

function move(direction) {
  let moved = false;
  let mergeCount = 0;
  
  const rotate = () => {
    const newGrid = Array(4).fill(null).map(() => Array(4).fill(0));
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        newGrid[c][3 - r] = gameState.grid[r][c];
      }
    }
    gameState.grid = newGrid;
  };
  
  const slideLeft = () => {
    for (let r = 0; r < 4; r++) {
      const row = gameState.grid[r].filter(v => v !== 0);
      
      for (let i = 0; i < row.length - 1; i++) {
        if (row[i] === row[i + 1]) {
          row[i] *= 2;
          gameState.score += row[i];
          row.splice(i + 1, 1);
          mergeCount++;
        }
      }
      
      while (row.length < 4) row.push(0);
      
      if (row.join(',') !== gameState.grid[r].join(',')) moved = true;
      gameState.grid[r] = row;
    }
  };
  
  // Rotate grid so we always slide left
  if (direction === 'up') rotate();
  else if (direction === 'right') { rotate(); rotate(); }
  else if (direction === 'down') { rotate(); rotate(); rotate(); }
  
  slideLeft();
  
  // Rotate back
  if (direction === 'up') { rotate(); rotate(); rotate(); }
  else if (direction === 'right') { rotate(); rotate(); }
  else if (direction === 'down') rotate();
  
  // Update combo
  if (mergeCount > 0) {
    gameState.comboCount += mergeCount;
    gameState.comboMultiplier = 1 + Math.floor(gameState.comboCount / 4);
    updateCombo();
  } else {
    gameState.comboCount = 0;
    gameState.comboMultiplier = 1;
    updateCombo();
  }
  
  return moved;
}

function updateScore() {
  scoreEl.textContent = gameState.score;
  if (gameState.score > gameState.bestScore) {
    gameState.bestScore = gameState.score;
    bestScoreEl.textContent = gameState.bestScore;
    localStorage.setItem('game2048_best', gameState.bestScore.toString());
  }
}

function updateCombo() {
  if (gameState.comboMultiplier > 1) {
    comboEl.innerHTML = `<span class="g2048-combo">🔥 Combo x${gameState.comboMultiplier} (${gameState.comboCount} merges)</span>`;
  } else {
    comboEl.textContent = '';
  }
}

function checkGameStatus() {
  // Check for 2048 win
  if (!gameState.won) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (gameState.grid[r][c] === 2048) {
          gameState.won = true;
          showMessage('🎉 You Win!', 'You reached 2048!');
          api.recordResult('Won (2048)', 0);
          return;
        }
      }
    }
  }
  
  // Check for game over
  if (!canMove()) {
    gameState.gameOver = true;
    showMessage('Game Over', `Final Score: ${gameState.score}`);
    api.recordResult(`Lost (score: ${gameState.score})`, 0);
  }
}

function canMove() {
  // Check for empty cells
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (gameState.grid[r][c] === 0) return true;
    }
  }
  
  // Check for possible merges
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = gameState.grid[r][c];
      if (c < 3 && val === gameState.grid[r][c + 1]) return true;
      if (r < 3 && val === gameState.grid[r + 1][c]) return true;
    }
  }
  
  return false;
}

function showMessage(title, msg) {
  document.getElementById('g2048-msg-title').textContent = `${title}\n${msg}`;
  document.getElementById('g2048-message').classList.add('show');
}
