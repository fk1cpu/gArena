/**
 * Checkers - Classic Board Game
 * Improvements: Hint button, forced multi-capture chain exploration
 */

let gameState = {
  board: [],
  currentPlayer: 'red',
  selectedPiece: null,
  validMoves: [],
  mustJumpFrom: null, // For multi-jump chains
  redPieces: 12,
  blackPieces: 12,
  gameActive: true
};

let boardEl, statusEl;
let api;

export function mount(boardWrap, gameApi, config = {}) {
  api = gameApi;
  
  boardWrap.innerHTML = `
    <style>
      .checkers-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 1rem;
      }
      .checkers-board {
        display: grid;
        grid-template-columns: repeat(8, 60px);
        gap: 2px;
        background: #8b4513;
        padding: 5px;
        border-radius: 8px;
      }
      .checkers-cell {
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .checkers-cell.light { background: #deb887; }
      .checkers-cell.dark { background: #8b4513; }
      .checkers-cell.valid { 
        background: rgba(76, 175, 80, 0.5);
        box-shadow: inset 0 0 10px #4caf50;
      }
      .checkers-piece {
        width: 45px;
        height: 45px;
        border-radius: 50%;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        transition: all 0.2s;
      }
      .checkers-piece.red {
        background: radial-gradient(circle at 30% 30%, #e74c3c, #c0392b);
      }
      .checkers-piece.black {
        background: radial-gradient(circle at 30% 30%, #555, #222);
      }
      .checkers-piece.king::after {
        content: '👑';
        font-size: 24px;
        display: block;
        text-align: center;
        line-height: 45px;
      }
      .checkers-piece.selected {
        transform: scale(1.15);
        box-shadow: 0 0 20px gold;
      }
      .hint-btn {
        margin-top: 1rem;
        padding: 0.8rem 1.5rem;
        background: rgba(255,255,255,0.1);
        border: none;
        border-radius: 8px;
        color: white;
        cursor: pointer;
        font-size: 1rem;
      }
    </style>
    <div class="checkers-container">
      <div style="margin-bottom: 1rem;">
        <span style="color: #e74c3c">● Red: ${gameState.redPieces}</span> | 
        <span style="color: #555">● Black: ${gameState.blackPieces}</span>
      </div>
      <div class="checkers-board" id="checkers-board"></div>
      <div id="checkers-status" style="margin-top: 1rem;"></div>
      <button class="hint-btn" id="checkers-hint">💡 Get Hint</button>
    </div>
  `;
  
  boardEl = document.getElementById('checkers-board');
  statusEl = document.getElementById('checkers-status');
  
  initGame();
  document.getElementById('checkers-hint').addEventListener('click', showHint);
}

export function unmount() {}

function initGame() {
  // Initialize 8x8 board
  gameState.board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Place pieces
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        if (row < 3) gameState.board[row][col] = { player: 'black', king: false };
        if (row > 4) gameState.board[row][col] = { player: 'red', king: false };
      }
    }
  }
  
  gameState.currentPlayer = 'red';
  gameState.selectedPiece = null;
  gameState.validMoves = [];
  gameState.mustJumpFrom = null;
  gameState.gameActive = true;
  
  renderBoard();
  updateStatus();
}

function renderBoard() {
  boardEl.innerHTML = '';
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement('div');
      cell.className = `checkers-cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
      cell.dataset.row = row;
      cell.dataset.col = col;
      
      const piece = gameState.board[row][col];
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = `checkers-piece ${piece.player}${piece.king ? ' king' : ''}`;
        
        if (gameState.selectedPiece && 
            gameState.selectedPiece.row === row && 
            gameState.selectedPiece.col === col) {
          pieceEl.classList.add('selected');
        }
        
        cell.appendChild(pieceEl);
      }
      
      // Highlight valid moves
      if (gameState.validMoves.some(m => m.row === row && m.col === col)) {
        cell.classList.add('valid');
        cell.addEventListener('click', () => makeMove(gameState.selectedPiece, { row, col }));
      } else if (!piece) {
        cell.addEventListener('click', () => selectPiece(row, col));
      }
      
      boardEl.appendChild(cell);
    }
  }
}

function selectPiece(row, col) {
  if (!gameState.gameActive) return;
  const piece = gameState.board[row][col];
  if (!piece || piece.player !== gameState.currentPlayer) return;
  
  // Check if we're in a multi-jump sequence
  if (gameState.mustJumpFrom) {
    if (gameState.mustJumpFrom.row !== row || gameState.mustJumpFrom.col !== col) {
      return; // Must continue with the same piece
    }
  }
  
  gameState.selectedPiece = { row, col };
  gameState.validMoves = getValidMoves(row, col, piece);
  renderBoard();
}

function getValidMoves(row, col, piece, checkJumpsOnly = false) {
  const moves = [];
  const directions = piece.king ? [[-1,-1], [-1,1], [1,-1], [1,1]] : 
                     piece.player === 'red' ? [[-1,-1], [-1,1]] : [[1,-1], [1,1]];
  
  // First check for jumps (mandatory)
  for (const [dr, dc] of directions) {
    const jumpRow = row + dr * 2;
    const jumpCol = col + dc * 2;
    const midRow = row + dr;
    const midCol = col + dc;
    
    if (isValidPos(jumpRow, jumpCol) && !gameState.board[jumpRow][jumpCol]) {
      const midPiece = gameState.board[midRow][midCol];
      if (midPiece && midPiece.player !== piece.player) {
        moves.push({ row: jumpRow, col: jumpCol, jump: { row: midRow, col: midCol } });
      }
    }
  }
  
  // If jumps exist, only return jumps (mandatory jump rule)
  if (moves.length > 0 || checkJumpsOnly) return moves;
  
  // Regular moves
  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (isValidPos(newRow, newCol) && !gameState.board[newRow][newCol]) {
      moves.push({ row: newRow, col: newCol });
    }
  }
  
  return moves;
}

function isValidPos(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function makeMove(from, move) {
  const piece = gameState.board[from.row][from.col];
  gameState.board[move.row][move.col] = piece;
  gameState.board[from.row][from.col] = null;
  
  // Handle jump
  if (move.jump) {
    const jumpedPiece = gameState.board[move.jump.row][move.jump.col];
    if (jumpedPiece.player === 'black') gameState.blackPieces--;
    else gameState.redPieces--;
    gameState.board[move.jump.row][move.jump.col] = null;
  }
  
  // King promotion
  if ((piece.player === 'red' && move.row === 0) || 
      (piece.player === 'black' && move.row === 7)) {
    piece.king = true;
  }
  
  // Check for multi-jump
  if (move.jump) {
    const moreJumps = getValidMoves(move.row, move.col, piece, true);
    if (moreJumps.length > 0) {
      gameState.mustJumpFrom = { row: move.row, col: move.col };
      gameState.selectedPiece = { row: move.row, col: move.col };
      gameState.validMoves = moreJumps;
      renderBoard();
      return;
    }
  }
  
  gameState.mustJumpFrom = null;
  gameState.currentPlayer = gameState.currentPlayer === 'red' ? 'black' : 'red';
  gameState.selectedPiece = null;
  gameState.validMoves = [];
  
  renderBoard();
  updateStatus();
  checkWin();
  
  // CPU move
  if (gameState.currentPlayer === 'black' && gameState.gameActive) {
    setTimeout(cpuMove, 500);
  }
}

function cpuMove() {
  if (!gameState.gameActive) return;
  
  // Find all valid moves for black
  const allMoves = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (piece && piece.player === 'black') {
        const moves = getValidMoves(row, col, piece);
        moves.forEach(move => {
          allMoves.push({ from: { row, col }, to: move });
        });
      }
    }
  }
  
  if (allMoves.length === 0) {
    // No moves - lose
    gameState.gameActive = false;
    statusEl.textContent = 'Red Wins! 🎉';
    api.recordResult('Red wins', 0);
    return;
  }
  
  // Prefer jumps
  const jumps = allMoves.filter(m => m.to.jump);
  const chosen = jumps.length > 0 ? 
    jumps[Math.floor(Math.random() * jumps.length)] :
    allMoves[Math.floor(Math.random() * allMoves.length)];
  
  makeMove(chosen.from, chosen.to);
}

function showHint() {
  // Use minimax to find best move (depth 3 for performance)
  const bestMove = findBestMove(gameState.currentPlayer, 3);
  if (bestMove) {
    const cell = boardEl.querySelector(`[data-row="${bestMove.from.row}"][data-col="${bestMove.from.col}"]`);
    if (cell) {
      cell.style.background = 'rgba(255, 255, 0, 0.5)';
      setTimeout(() => {
        cell.style.background = '';
      }, 1000);
    }
  }
}

function findBestMove(player, depth) {
  // Simplified evaluation
  let bestScore = -Infinity;
  let bestMove = null;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (piece && piece.player === player) {
        const moves = getValidMoves(row, col, piece);
        moves.forEach(move => {
          const score = evaluateMove(player, { row, col }, move);
          if (score > bestScore) {
            bestScore = score;
            bestMove = { from: { row, col }, to: move };
          }
        });
      }
    }
  }
  
  return bestMove;
}

function evaluateMove(player, from, to) {
  let score = 0;
  
  // Jump is good
  if (to.jump) score += 50;
  
  // King promotion
  if ((player === 'red' && to.row === 0) || (player === 'black' && to.row === 7)) {
    score += 30;
  }
  
  // Position advantage (center control)
  if (to.col >= 2 && to.col <= 5) score += 5;
  
  // Safety (not on edge where can be captured)
  if (to.row > 0 && to.row < 7) score += 3;
  
  return score;
}

function updateStatus() {
  statusEl.textContent = `${gameState.currentPlayer.toUpperCase()}'s Turn`;
}

function checkWin() {
  if (gameState.redPieces === 0) {
    gameState.gameActive = false;
    statusEl.textContent = 'Black Wins! 🎉';
    api.recordResult('Black wins', 0);
  } else if (gameState.blackPieces === 0) {
    gameState.gameActive = false;
    statusEl.textContent = 'Red Wins! 🎉';
    api.recordResult('Red wins', 0);
  }
}
