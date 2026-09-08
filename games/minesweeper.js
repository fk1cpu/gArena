/**
 * Minesweeper - Classic Mine Detection Game
 * Improvements: Chord feature, time-based hurry indicator
 */

let gameState = {
  board: [],
  width: 10,
  height: 10,
  mines: 15,
  revealed: [],
  flagged: [],
  gameActive: true,
  firstClick: true,
  startTime: 0,
  elapsedTime: 0
};

let boardEl, timerEl, flagCountEl;
let api;

export function mount(boardWrap, gameApi, config = {}) {
  api = gameApi;
  
  gameState.width = config.width || 10;
  gameState.height = config.height || 10;
  gameState.mines = config.mines || 15;
  
  boardWrap.innerHTML = `
    <style>
      .mines-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 1rem;
      }
      .mines-header {
        display: flex;
        gap: 2rem;
        margin-bottom: 1rem;
        align-items: center;
      }
      .mines-stat {
        font-size: 1.2rem;
      }
      .hurry-indicator {
        color: #f44336;
        animation: blink 0.5s infinite;
        display: none;
      }
      .hurry-indicator.active {
        display: inline;
      }
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      .mines-board {
        display: grid;
        gap: 2px;
        background: #2c3e50;
        padding: 5px;
        border-radius: 8px;
      }
      .mine-cell {
        width: 35px;
        height: 35px;
        background: #34495e;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        font-size: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.1s;
      }
      .mine-cell:hover:not(.revealed) {
        background: #4a6278;
      }
      .mine-cell.revealed {
        background: #ecf0f1;
        cursor: default;
      }
      .mine-cell.flagged {
        background: #e74c3c;
      }
      .mine-cell.mine {
        background: #c0392b;
      }
      .mine-cell.exploded {
        background: #ff0000;
        animation: explode 0.3s;
      }
      @keyframes explode {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      .num-1 { color: #3498db; }
      .num-2 { color: #2ecc71; }
      .num-3 { color: #e74c3c; }
      .num-4 { color: #9b59b6; }
      .num-5 { color: #f39c12; }
      .num-6 { color: #1abc9c; }
      .num-7 { color: #34495e; }
      .num-8 { color: #7f8c8d; }
    </style>
    <div class="mines-container">
      <div class="mines-header">
        <div class="mines-stat">🚩 <span id="mine-flags">${gameState.mines}</span></div>
        <div class="mines-stat">⏱️ <span id="mine-timer">0</span>s</div>
        <div class="mines-stat hurry-indicator" id="mine-hurry">⚡ HURRY!</div>
      </div>
      <div class="mines-board" id="mine-board"></div>
    </div>
  `;
  
  boardEl = document.getElementById('mine-board');
  timerEl = document.getElementById('mine-timer');
  flagCountEl = document.getElementById('mine-flags');
  
  initGame();
  startTimer();
}

export function unmount() {
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);
}

function initGame() {
  gameState.board = [];
  gameState.revealed = [];
  gameState.flagged = [];
  gameState.gameActive = true;
  gameState.firstClick = true;
  gameState.startTime = Date.now();
  gameState.elapsedTime = 0;
  
  // Initialize empty board
  for (let y = 0; y < gameState.height; y++) {
    gameState.board[y] = [];
    for (let x = 0; x < gameState.width; x++) {
      gameState.board[y][x] = { mine: false, count: 0 };
    }
  }
  
  renderBoard();
}

function placeMines(excludeX, excludeY) {
  let placed = 0;
  while (placed < gameState.mines) {
    const x = Math.floor(Math.random() * gameState.width);
    const y = Math.floor(Math.random() * gameState.height);
    
    // Don't place mine on first click or adjacent cells
    const dx = Math.abs(x - excludeX);
    const dy = Math.abs(y - excludeY);
    if (dx <= 1 && dy <= 1) continue;
    
    if (!gameState.board[y][x].mine) {
      gameState.board[y][x].mine = true;
      placed++;
    }
  }
  
  // Calculate counts
  for (let y = 0; y < gameState.height; y++) {
    for (let x = 0; x < gameState.width; x++) {
      if (!gameState.board[y][x].mine) {
        gameState.board[y][x].count = countAdjacentMines(x, y);
      }
    }
  }
}

function countAdjacentMines(x, y) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < gameState.width && ny >= 0 && ny < gameState.height) {
        if (gameState.board[ny][nx].mine) count++;
      }
    }
  }
  return count;
}

function renderBoard() {
  boardEl.style.gridTemplateColumns = `repeat(${gameState.width}, 1fr)`;
  boardEl.innerHTML = '';
  
  for (let y = 0; y < gameState.height; y++) {
    for (let x = 0; x < gameState.width; x++) {
      const cell = document.createElement('button');
      cell.className = 'mine-cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      
      // Left click to reveal
      cell.addEventListener('click', () => handleClick(x, y));
      
      // Right click to flag
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleRightClick(x, y);
      });
      
      // Middle click / chord
      cell.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          handleChord(x, y);
        }
      });
      
      boardEl.appendChild(cell);
    }
  }
}

function handleClick(x, y) {
  if (!gameState.gameActive) return;
  const key = `${x},${y}`;
  if (gameState.revealed.includes(key) || gameState.flagged.includes(key)) return;
  
  if (gameState.firstClick) {
    placeMines(x, y);
    gameState.firstClick = false;
  }
  
  const cellData = gameState.board[y][x];
  
  if (cellData.mine) {
    gameOver(false, x, y);
    return;
  }
  
  revealCell(x, y);
  checkWin();
}

function handleRightClick(x, y) {
  if (!gameState.gameActive) return;
  const key = `${x},${y}`;
  
  if (gameState.flagged.includes(key)) {
    gameState.flagged = gameState.flagged.filter(k => k !== key);
  } else {
    gameState.flagged.push(key);
  }
  
  updateCell(x, y);
  flagCountEl.textContent = gameState.mines - gameState.flagged.length;
}

function handleChord(x, y) {
  if (!gameState.gameActive) return;
  const key = `${x},${y}`;
  if (!gameState.revealed.includes(key)) return;
  
  const cellData = gameState.board[y][x];
  if (cellData.count === 0) return;
  
  // Count adjacent flags
  let flagCount = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < gameState.width && ny >= 0 && ny < gameState.height) {
        if (gameState.flagged.includes(`${nx},${ny}`)) flagCount++;
      }
    }
  }
  
  // If flags match count, reveal adjacent
  if (flagCount === cellData.count) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < gameState.width && ny >= 0 && ny < gameState.height) {
          const nKey = `${nx},${ny}`;
          if (!gameState.revealed.includes(nKey) && !gameState.flagged.includes(nKey)) {
            handleClick(nx, ny);
          }
        }
      }
    }
  }
}

function revealCell(x, y) {
  const key = `${x},${y}`;
  if (gameState.revealed.includes(key) || gameState.flagged.includes(key)) return;
  
  gameState.revealed.push(key);
  updateCell(x, y);
  
  const cellData = gameState.board[y][x];
  if (cellData.count === 0) {
    // Reveal adjacent cells
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < gameState.width && ny >= 0 && ny < gameState.height) {
          revealCell(nx, ny);
        }
      }
    }
  }
}

function updateCell(x, y) {
  const key = `${x},${y}`;
  const cellEl = boardEl.querySelector(`[data-x="${x}"][data-y="${y}"]`);
  const cellData = gameState.board[y][x];
  
  cellEl.className = 'mine-cell';
  cellEl.textContent = '';
  
  if (gameState.flagged.includes(key)) {
    cellEl.classList.add('flagged');
    cellEl.textContent = '🚩';
  } else if (gameState.revealed.includes(key)) {
    cellEl.classList.add('revealed');
    if (cellData.mine) {
      cellEl.classList.add('mine');
      cellEl.textContent = '💣';
    } else if (cellData.count > 0) {
      cellEl.textContent = cellData.count;
      cellEl.classList.add(`num-${cellData.count}`);
    }
  }
}

function checkWin() {
  const totalCells = gameState.width * gameState.height;
  if (gameState.revealed.length === totalCells - gameState.mines) {
    gameOver(true);
  }
}

function gameOver(won, explodedX, explodedY) {
  gameState.gameActive = false;
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);
  
  const duration = Math.round((Date.now() - gameState.startTime) / 1000);
  
  // Reveal all mines
  for (let y = 0; y < gameState.height; y++) {
    for (let x = 0; x < gameState.width; x++) {
      const cellData = gameState.board[y][x];
      if (cellData.mine) {
        const key = `${x},${y}`;
        if (!gameState.flagged.includes(key)) {
          gameState.revealed.push(key);
          updateCell(x, y);
          if (x === explodedX && y === explodedY) {
            const cellEl = boardEl.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            cellEl.classList.add('exploded');
          }
        }
      }
    }
  }
  
  if (won) {
    boardEl.parentElement.querySelector('#mine-status').textContent = `🎉 Won in ${duration}s!`;
    api.recordResult(`Won`, duration);
  } else {
    boardEl.parentElement.querySelector('#mine-status').textContent = '💥 Game Over!';
    api.recordResult(`Lost`, duration);
  }
}

function startTimer() {
  gameState.timerInterval = setInterval(() => {
    gameState.elapsedTime = Math.round((Date.now() - gameState.startTime) / 1000);
    timerEl.textContent = gameState.elapsedTime;
    
    // Show hurry indicator after 5 minutes
    const hurryEl = document.getElementById('mine-hurry');
    if (gameState.elapsedTime >= 300) {
      hurryEl.classList.add('active');
    }
  }, 1000);
}
