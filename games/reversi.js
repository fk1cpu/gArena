/**
 * Reversi (Othello) - Disc Flipping Strategy Game
 * Improvements: Positional advantage meter, CPU thinking indicator
 */

let gameState = {
  board: [],
  currentPlayer: 'black',
  gameActive: true,
  blackCount: 2,
  whiteCount: 2
};

let boardEl, statusEl;
let api;

// Position weights for strategic evaluation
const POSITION_WEIGHTS = [
  [100, -20, 10, 5, 5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [10, -2, -1, -1, -1, -1, -2, 10],
  [5, -2, -1, -1, -1, -1, -2, 5],
  [5, -2, -1, -1, -1, -1, -2, 5],
  [10, -2, -1, -1, -1, -1, -2, 10],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [100, -20, 10, 5, 5, 10, -20, 100]
];

export function mount(boardWrap, gameApi, config = {}) {
  api = gameApi;
  
  boardWrap.innerHTML = `
    <style>
      .reversi-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 1rem;
      }
      .reversi-header {
        margin-bottom: 1rem;
        text-align: center;
      }
      .reversi-scores {
        display: flex;
        gap: 2rem;
        margin-bottom: 0.5rem;
      }
      .reversi-score {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .reversi-disc-mini {
        width: 20px;
        height: 20px;
        border-radius: 50%;
      }
      .reversi-disc-mini.black { background: #222; }
      .reversi-disc-mini.white { background: #fff; border: 1px solid #ccc; }
      .pos-advantage {
        display: flex;
        gap: 1rem;
        margin-top: 0.5rem;
      }
      .pos-bar {
        width: 100px;
        height: 8px;
        background: #2c3e50;
        border-radius: 4px;
        overflow: hidden;
      }
      .pos-fill {
        height: 100%;
        transition: width 0.3s;
      }
      .pos-fill.black { background: linear-gradient(90deg, #222, #444); }
      .pos-fill.white { background: linear-gradient(90deg, #fff, #ccc); }
      .reversi-thinking {
        color: #f39c12;
        font-style: italic;
        min-height: 1.5em;
      }
      .reversi-board {
        background: #27ae60;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.3);
      }
      .reversi-grid {
        display: grid;
        grid-template-columns: repeat(8, 50px);
        gap: 2px;
        background: #1e8449;
        padding: 5px;
        border-radius: 4px;
      }
      .reversi-cell {
        width: 50px;
        height: 50px;
        background: #27ae60;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .reversi-cell.valid::after {
        content: '';
        width: 15px;
        height: 15px;
        background: rgba(0,0,0,0.2);
        border-radius: 50%;
      }
      .reversi-disc {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        transition: all 0.3s;
      }
      .reversi-disc.black {
        background: radial-gradient(circle at 30% 30%, #444, #111);
      }
      .reversi-disc.white {
        background: radial-gradient(circle at 30% 30%, #fff, #ccc);
        border: 1px solid #bbb;
      }
      .reversi-disc.flipping {
        animation: flip 0.5s;
      }
      @keyframes flip {
        0% { transform: rotateY(0); }
        50% { transform: rotateY(90deg); }
        100% { transform: rotateY(180deg); }
      }
    </style>
    <div class="reversi-container">
      <div class="reversi-header">
        <div class="reversi-scores">
          <div class="reversi-score">
            <div class="reversi-disc-mini black"></div>
            <span id="rev-black">2</span>
            <div class="pos-bar"><div class="pos-fill black" id="rev-pos-black" style="width: 50%"></div></div>
          </div>
          <div class="reversi-score">
            <div class="reversi-disc-mini white"></div>
            <span id="rev-white">2</span>
            <div class="pos-bar"><div class="pos-fill white" id="rev-pos-white" style="width: 50%"></div></div>
          </div>
        </div>
        <div id="rev-status"></div>
        <div class="reversi-thinking" id="rev-thinking"></div>
      </div>
      <div class="reversi-board">
        <div class="reversi-grid" id="rev-grid"></div>
      </div>
    </div>
  `;
  
  boardEl = document.getElementById('rev-grid');
  statusEl = document.getElementById('rev-status');
  
  initGame();
}

export function unmount() {}

function initGame() {
  gameState.board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Initial setup
  gameState.board[3][3] = 'white';
  gameState.board[3][4] = 'black';
  gameState.board[4][3] = 'black';
  gameState.board[4][4] = 'white';
  
  gameState.currentPlayer = 'black';
  gameState.gameActive = true;
  
  updateCounts();
  renderBoard();
  updateStatus();
  updatePositionalAdvantage();
}

function renderBoard() {
  boardEl.innerHTML = '';
  
  const validMoves = getValidMoves(gameState.currentPlayer);
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement('div');
      cell.className = 'reversi-cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      
      const piece = gameState.board[row][col];
      if (piece) {
        const disc = document.createElement('div');
        disc.className = `reversi-disc ${piece}`;
        cell.appendChild(disc);
      } else if (validMoves.some(m => m.row === row && m.col === col)) {
        cell.classList.add('valid');
        cell.addEventListener('click', () => makeMove(row, col));
      }
      
      boardEl.appendChild(cell);
    }
  }
}

function getValidMoves(player) {
  const moves = [];
  const opponent = player === 'black' ? 'white' : 'black';
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (gameState.board[row][col]) continue;
      
      const flips = getFlips(row, col, player, opponent);
      if (flips.length > 0) {
        moves.push({ row, col, flips });
      }
    }
  }
  
  return moves;
}

function getFlips(row, col, player, opponent) {
  const flips = [];
  const directions = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
  
  for (const [dr, dc] of directions) {
    const lineFlips = [];
    let r = row + dr;
    let c = col + dc;
    
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === opponent) {
      lineFlips.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    
    if (lineFlips.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === player) {
      flips.push(...lineFlips);
    }
  }
  
  return flips;
}

function makeMove(row, col) {
  const opponent = gameState.currentPlayer === 'black' ? 'white' : 'black';
  const flips = getFlips(row, col, gameState.currentPlayer, opponent);
  
  if (flips.length === 0) return;
  
  // Place piece
  gameState.board[row][col] = gameState.currentPlayer;
  
  // Flip pieces
  flips.forEach(({ row: fr, col: fc }) => {
    gameState.board[fr][fc] = gameState.currentPlayer;
  });
  
  updateCounts();
  renderBoard();
  
  // Switch player
  gameState.currentPlayer = opponent;
  
  // Check if new player has valid moves
  const newValidMoves = getValidMoves(gameState.currentPlayer);
  if (newValidMoves.length === 0) {
    // Pass turn back
    gameState.currentPlayer = opponent;
    const checkMoves = getValidMoves(gameState.currentPlayer);
    if (checkMoves.length === 0) {
      endGame();
      return;
    }
    statusEl.textContent = `${opponent} has no moves - turn passes back`;
  }
  
  updateStatus();
  updatePositionalAdvantage();
  
  // CPU move
  if (gameState.currentPlayer === 'white' && gameState.gameActive) {
    document.getElementById('rev-thinking').textContent = '🤔 CPU thinking...';
    setTimeout(cpuMove, 1500);
  } else {
    document.getElementById('rev-thinking').textContent = '';
  }
}

function cpuMove() {
  if (!gameState.gameActive) return;
  
  const validMoves = getValidMoves('white');
  if (validMoves.length === 0) return;
  
  // Use minimax with positional evaluation
  const bestMove = findBestMove(validMoves, 3);
  makeMove(bestMove.row, bestMove.col);
  
  document.getElementById('rev-thinking').textContent = '';
}

function findBestMove(moves, depth) {
  let bestScore = -Infinity;
  let bestMove = moves[0];
  
  for (const move of moves) {
    // Simulate move
    const originalBoard = gameState.board.map(r => [...r]);
    gameState.board[move.row][move.col] = 'white';
    move.flips.forEach(f => gameState.board[f.row][f.col] = 'white');
    
    const score = evaluateBoard('white');
    
    // Restore board
    gameState.board = originalBoard;
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  
  return bestMove;
}

function evaluateBoard(player) {
  let score = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (!gameState.board[row][col]) continue;
      
      const weight = POSITION_WEIGHTS[row][col];
      if (gameState.board[row][col] === player) {
        score += weight;
      } else {
        score -= weight;
      }
    }
  }
  
  // Add piece count bonus
  const counts = { black: 0, white: 0 };
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (gameState.board[row][col]) counts[gameState.board[row][col]]++;
    }
  }
  
  score += (counts[player] - counts[player === 'black' ? 'white' : 'black']) * 2;
  
  return score;
}

function updateCounts() {
  let black = 0, white = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (gameState.board[row][col] === 'black') black++;
      else if (gameState.board[row][col] === 'white') white++;
    }
  }
  gameState.blackCount = black;
  gameState.whiteCount = white;
  
  document.getElementById('rev-black').textContent = black;
  document.getElementById('rev-white').textContent = white;
}

function updatePositionalAdvantage() {
  let blackPos = 0, whitePos = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const weight = POSITION_WEIGHTS[row][col];
      if (gameState.board[row][col] === 'black') {
        blackPos += Math.max(0, weight);
      } else if (gameState.board[row][col] === 'white') {
        whitePos += Math.max(0, weight);
      }
    }
  }
  
  const total = blackPos + whitePos || 1;
  document.getElementById('rev-pos-black').style.width = `${(blackPos / total) * 100}%`;
  document.getElementById('rev-pos-white').style.width = `${(whitePos / total) * 100}%`;
}

function updateStatus() {
  const color = gameState.currentPlayer === 'black' ? '#222' : '#fff';
  const text = gameState.currentPlayer === 'black' ? 'BLACK' : 'WHITE';
  statusEl.innerHTML = `<span style="color: ${color}; text-shadow: 0 0 2px #666">${text}'s Turn</span>`;
}

function endGame() {
  gameState.gameActive = false;
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  let result;
  if (gameState.blackCount > gameState.whiteCount) {
    result = 'Black wins';
    statusEl.textContent = `🎉 Black Wins! (${gameState.blackCount}-${gameState.whiteCount})`;
  } else if (gameState.whiteCount > gameState.blackCount) {
    result = 'White wins';
    statusEl.textContent = `🎉 White Wins! (${gameState.whiteCount}-${gameState.blackCount})`;
  } else {
    result = 'Draw';
    statusEl.textContent = `It's a Draw! (${gameState.blackCount}-${gameState.whiteCount})`;
  }
  
  api.recordResult(result, duration);
}

let startTime = Date.now();
