/**
 * Connect 4 - Vertical Drop Game
 * Improvements: Win probability bar, CPU thinking animation
 */

let gameState = {
  board: [],
  rows: 6,
  cols: 7,
  currentPlayer: 'red',
  gameActive: true,
  winner: null
};

let boardEl, statusEl, probBarEl;
let api;

export function mount(boardWrap, gameApi, config = {}) {
  api = gameApi;
  
  boardWrap.innerHTML = `
    <style>
      .c4-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 1rem;
      }
      .c4-header {
        margin-bottom: 1rem;
        text-align: center;
      }
      .c4-prob-bar {
        width: 300px;
        height: 20px;
        background: #2c3e50;
        border-radius: 10px;
        overflow: hidden;
        display: flex;
        margin: 1rem auto;
      }
      .c4-prob-red {
        background: linear-gradient(90deg, #e74c3c, #ff6b6b);
        transition: width 0.3s;
      }
      .c4-prob-yellow {
        background: linear-gradient(90deg, #f1c40f, #f39c12);
        transition: width 0.3s;
      }
      .c4-thinking {
        color: #f39c12;
        font-style: italic;
        min-height: 1.5em;
      }
      .c4-board {
        background: #3498db;
        padding: 10px;
        border-radius: 12px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.3);
      }
      .c4-column {
        display: flex;
        flex-direction: column;
        gap: 5px;
        cursor: pointer;
        padding: 5px;
        border-radius: 8px;
        transition: background 0.2s;
      }
      .c4-column:hover {
        background: rgba(255,255,255,0.2);
      }
      .c4-cell {
        width: 50px;
        height: 50px;
        background: #1a1a2e;
        border-radius: 50%;
        transition: all 0.3s;
      }
      .c4-cell.red {
        background: radial-gradient(circle at 30% 30%, #e74c3c, #c0392b);
      }
      .c4-cell.yellow {
        background: radial-gradient(circle at 30% 30%, #f1c40f, #f39c12);
      }
      .c4-cell.winner {
        animation: winPulse 0.5s ease-in-out infinite alternate;
      }
      @keyframes winPulse {
        from { transform: scale(1); }
        to { transform: scale(1.1); }
      }
    </style>
    <div class="c4-container">
      <div class="c4-header">
        <div id="c4-status"></div>
        <div class="c4-prob-bar">
          <div class="c4-prob-red" id="c4-prob-red" style="width: 50%"></div>
          <div class="c4-prob-yellow" id="c4-prob-yellow" style="width: 50%"></div>
        </div>
        <div class="c4-thinking" id="c4-thinking"></div>
      </div>
      <div class="c4-board" id="c4-board"></div>
    </div>
  `;
  
  boardEl = document.getElementById('c4-board');
  statusEl = document.getElementById('c4-status');
  probBarEl = document.getElementById('c4-prob-red');
  
  initGame();
}

export function unmount() {}

function initGame() {
  gameState.board = Array(gameState.rows).fill(null).map(() => Array(gameState.cols).fill(null));
  gameState.currentPlayer = 'red';
  gameState.gameActive = true;
  gameState.winner = null;
  
  renderBoard();
  updateStatus();
  updateWinProbability();
}

function renderBoard() {
  boardEl.innerHTML = '';
  
  for (let col = 0; col < gameState.cols; col++) {
    const colEl = document.createElement('div');
    colEl.className = 'c4-column';
    colEl.dataset.col = col;
    colEl.addEventListener('click', () => dropPiece(col));
    
    for (let row = gameState.rows - 1; row >= 0; row--) {
      const cell = document.createElement('div');
      cell.className = 'c4-cell';
      if (gameState.board[row][col]) {
        cell.classList.add(gameState.board[row][col]);
      }
      colEl.appendChild(cell);
    }
    
    boardEl.appendChild(colEl);
  }
}

function dropPiece(col) {
  if (!gameState.gameActive) return;
  if (gameState.currentPlayer === 'yellow') return; // CPU turn
  
  const row = getAvailableRow(col);
  if (row === null) return;
  
  placePiece(row, col);
}

function getAvailableRow(col) {
  for (let row = 0; row < gameState.rows; row++) {
    if (!gameState.board[row][col]) return row;
  }
  return null;
}

function placePiece(row, col) {
  gameState.board[row][col] = gameState.currentPlayer;
  renderBoard();
  
  const winLine = checkWin();
  if (winLine) {
    endGame(gameState.currentPlayer, winLine);
    return;
  }
  
  if (gameState.board.every(r => r.every(c => c))) {
    endGame('draw');
    return;
  }
  
  gameState.currentPlayer = gameState.currentPlayer === 'red' ? 'yellow' : 'red';
  updateStatus();
  updateWinProbability();
  
  // CPU move
  if (gameState.currentPlayer === 'yellow' && gameState.gameActive) {
    document.getElementById('c4-thinking').textContent = '🤔 CPU thinking...';
    setTimeout(cpuMove, 2000);
  } else {
    document.getElementById('c4-thinking').textContent = '';
  }
}

function cpuMove() {
  if (!gameState.gameActive) return;
  
  // Minimax with depth 4
  const bestCol = findBestColumn(4);
  placePiece(getAvailableRow(bestCol), bestCol);
  document.getElementById('c4-thinking').textContent = '';
}

function findBestColumn(depth) {
  let bestScore = -Infinity;
  let bestCol = Math.floor(gameState.cols / 2);
  
  for (let col = 0; col < gameState.cols; col++) {
    const row = getAvailableRow(col);
    if (row === null) continue;
    
    gameState.board[row][col] = 'yellow';
    const score = minimax(gameState.board, depth - 1, false);
    gameState.board[row][col] = null;
    
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }
  
  return bestCol;
}

function minimax(board, depth, isMaximizing) {
  // Check terminal states
  if (checkWinInternal(board, 'yellow')) return 1000;
  if (checkWinInternal(board, 'red')) return -1000;
  if (board.every(r => r.every(c => c))) return 0;
  if (depth === 0) return evaluateBoard(board);
  
  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let col = 0; col < gameState.cols; col++) {
      const row = getAvailableRowInternal(board, col);
      if (row === null) continue;
      board[row][col] = 'yellow';
      bestScore = Math.max(bestScore, minimax(board, depth - 1, false));
      board[row][col] = null;
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let col = 0; col < gameState.cols; col++) {
      const row = getAvailableRowInternal(board, col);
      if (row === null) continue;
      board[row][col] = 'red';
      bestScore = Math.min(bestScore, minimax(board, depth - 1, true));
      board[row][col] = null;
    }
    return bestScore;
  }
}

function getAvailableRowInternal(board, col) {
  for (let row = 0; row < gameState.rows; row++) {
    if (!board[row][col]) return row;
  }
  return null;
}

function evaluateBoard(board) {
  let score = 0;
  
  // Center control bonus
  const centerCol = Math.floor(gameState.cols / 2);
  for (let row = 0; row < gameState.rows; row++) {
    if (board[row][centerCol] === 'yellow') score += 3;
    if (board[row][centerCol] === 'red') score -= 3;
  }
  
  return score;
}

function checkWin() {
  return checkWinInternal(gameState.board, gameState.currentPlayer);
}

function checkWinInternal(board, player) {
  const directions = [[0,1], [1,0], [1,1], [1,-1]];
  
  for (let row = 0; row < gameState.rows; row++) {
    for (let col = 0; col < gameState.cols; col++) {
      if (board[row][col] !== player) continue;
      
      for (const [dr, dc] of directions) {
        const line = [];
        for (let i = 0; i < 4; i++) {
          const r = row + dr * i;
          const c = col + dc * i;
          if (r < 0 || r >= gameState.rows || c < 0 || c >= gameState.cols) break;
          if (board[r][c] !== player) break;
          line.push({ row: r, col: c });
        }
        if (line.length === 4) return line;
      }
    }
  }
  
  return null;
}

function updateWinProbability() {
  // Run quick minimax to estimate win probability
  const wins = { red: 0, yellow: 0, draws: 0 };
  const simulations = 10;
  
  for (let i = 0; i < simulations; i++) {
    const result = simulateGame();
    if (result === 'red') wins.red++;
    else if (result === 'yellow') wins.yellow++;
    else wins.draws++;
  }
  
  const total = wins.red + wins.yellow + wins.draws;
  const redProb = (wins.red / total) * 100;
  const yellowProb = (wins.yellow / total) * 100;
  
  document.getElementById('c4-prob-red').style.width = `${redProb}%`;
  document.getElementById('c4-prob-yellow').style.width = `${yellowProb}%`;
}

function simulateGame() {
  const simBoard = gameState.board.map(r => [...r]);
  let simPlayer = gameState.currentPlayer;
  
  for (let i = 0; i < 50; i++) {
    const col = Math.floor(Math.random() * gameState.cols);
    const row = getAvailableRowSim(simBoard, col);
    if (row === null) continue;
    
    simBoard[row][col] = simPlayer;
    
    if (checkWinSim(simBoard, simPlayer)) return simPlayer;
    
    simPlayer = simPlayer === 'red' ? 'yellow' : 'red';
  }
  
  return 'draw';
}

function getAvailableRowSim(board, col) {
  for (let row = 0; row < gameState.rows; row++) {
    if (!board[row][col]) return row;
  }
  return null;
}

function checkWinSim(board, player) {
  return checkWinInternal(board, player);
}

function updateStatus() {
  const playerColor = gameState.currentPlayer === 'red' ? '#e74c3c' : '#f1c40f';
  statusEl.innerHTML = `<span style="color: ${playerColor}">${gameState.currentPlayer.toUpperCase()}'s Turn</span>`;
}

function endGame(result, winLine) {
  gameState.gameActive = false;
  gameState.winner = result;
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  if (result === 'draw') {
    statusEl.textContent = "It's a Draw!";
    api.recordResult('Draw', duration);
  } else {
    statusEl.innerHTML = `<span style="color: ${result === 'red' ? '#e74c3c' : '#f1c40f'}">${result.toUpperCase()} WINS! 🎉</span>`;
    api.recordResult(`${result} wins`, duration);
    
    // Highlight winning line
    if (winLine) {
      winLine.forEach(({ row, col }) => {
        const cell = boardEl.children[col].children[gameState.rows - 1 - row];
        cell.classList.add('winner');
      });
    }
  }
}

let startTime = Date.now();
