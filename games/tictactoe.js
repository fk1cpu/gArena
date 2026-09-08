/**
 * Tic Tac Toe - Classic 3x3 Grid Game
 * Improvements: Winning line animation, localStorage scoreboard (W/L/D)
 */

let gameState = {
  board: Array(9).fill(null),
  currentPlayer: 'X',
  gameActive: true,
  scores: { X: 0, O: 0, draws: 0 },
  winningLine: null
};

let boardEl, statusEl;
let api;

export function mount(boardWrap, gameApi, config = {}) {
  api = gameApi;
  
  // Load scores from localStorage
  const saved = localStorage.getItem('tictactoe_scores');
  if (saved) {
    gameState.scores = JSON.parse(saved);
  }
  
  boardWrap.innerHTML = `
    <style>
      .ttt-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 2rem;
      }
      .ttt-board {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin: 2rem 0;
      }
      .ttt-cell {
        width: 100px;
        height: 100px;
        background: rgba(255,255,255,0.1);
        border: 3px solid rgba(255,255,255,0.2);
        border-radius: 12px;
        font-size: 3rem;
        font-weight: bold;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ttt-cell:hover:not(.taken) {
        background: rgba(255,255,255,0.2);
        transform: scale(1.05);
      }
      .ttt-cell.taken {
        cursor: not-allowed;
      }
      .ttt-cell.winner {
        background: rgba(76, 175, 80, 0.5);
        animation: pulse 0.5s ease-in-out infinite alternate;
      }
      @keyframes pulse {
        from { transform: scale(1); }
        to { transform: scale(1.1); }
      }
      .ttt-scoreboard {
        display: flex;
        gap: 2rem;
        margin-bottom: 1rem;
      }
      .ttt-score {
        text-align: center;
      }
      .ttt-score-value {
        font-size: 2rem;
        font-weight: bold;
      }
      .ttt-x { color: #e74c3c; }
      .ttt-o { color: #3498db; }
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
      .hint-btn:hover {
        background: rgba(255,255,255,0.2);
      }
    </style>
    <div class="ttt-container">
      <div class="ttt-scoreboard">
        <div class="ttt-score ttt-x">
          <div>X Wins</div>
          <div class="ttt-score-value" id="ttt-x-wins">${gameState.scores.X}</div>
        </div>
        <div class="ttt-score">
          <div>Draws</div>
          <div class="ttt-score-value" id="ttt-draws">${gameState.scores.draws}</div>
        </div>
        <div class="ttt-score ttt-o">
          <div>O Wins</div>
          <div class="ttt-score-value" id="ttt-o-wins">${gameState.scores.O}</div>
        </div>
      </div>
      <div class="ttt-board" id="ttt-board"></div>
      <div id="ttt-status"></div>
      <button class="hint-btn" id="ttt-hint-btn">💡 Get Hint</button>
    </div>
  `;
  
  boardEl = document.getElementById('ttt-board');
  statusEl = document.getElementById('ttt-status');
  
  renderBoard();
  updateStatus();
  
  document.getElementById('ttt-hint-btn').addEventListener('click', showHint);
}

export function unmount() {
  // Cleanup handled by DOM removal
}

function renderBoard() {
  boardEl.innerHTML = '';
  gameState.board.forEach((cell, idx) => {
    const cellEl = document.createElement('div');
    cellEl.className = `ttt-cell${cell ? ' taken' : ''}`;
    cellEl.textContent = cell || '';
    cellEl.addEventListener('click', () => handleCellClick(idx));
    boardEl.appendChild(cellEl);
  });
}

function handleCellClick(idx) {
  if (!gameState.gameActive || gameState.board[idx]) return;
  
  gameState.board[idx] = gameState.currentPlayer;
  renderBoard();
  
  const winInfo = checkWin();
  if (winInfo) {
    endGame(winInfo.player);
    highlightWinningLine(winInfo.line);
  } else if (gameState.board.every(cell => cell)) {
    endGame('draw');
  } else {
    gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
    updateStatus();
    
    // CPU move for single player
    if (gameState.currentPlayer === 'O') {
      setTimeout(cpuMove, 500);
    }
  }
}

function cpuMove() {
  if (!gameState.gameActive) return;
  
  // Minimax AI
  const bestMove = findBestMove();
  if (bestMove !== null) {
    handleCellClick(bestMove);
  }
}

function findBestMove() {
  let bestScore = -Infinity;
  let bestMove = null;
  
  for (let i = 0; i < 9; i++) {
    if (!gameState.board[i]) {
      gameState.board[i] = 'O';
      const score = minimax(gameState.board, 0, false);
      gameState.board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  
  return bestMove;
}

function minimax(board, depth, isMaximizing) {
  const winInfo = checkWinInternal(board);
  if (winInfo) {
    return winInfo.player === 'O' ? 10 - depth : depth - 10;
  }
  if (board.every(cell => cell)) return 0;
  
  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'O';
        bestScore = Math.max(bestScore, minimax(board, depth + 1, false));
        board[i] = null;
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'X';
        bestScore = Math.min(bestScore, minimax(board, depth + 1, true));
        board[i] = null;
      }
    }
    return bestScore;
  }
}

function checkWinInternal(board) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8], // rows
    [0,3,6], [1,4,7], [2,5,8], // cols
    [0,4,8], [2,4,6]            // diagonals
  ];
  
  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { player: board[a], line };
    }
  }
  return null;
}

function checkWin() {
  return checkWinInternal(gameState.board);
}

function highlightWinningLine(line) {
  const cells = boardEl.querySelectorAll('.ttt-cell');
  line.forEach(idx => {
    cells[idx].classList.add('winner');
  });
}

function showHint() {
  if (!gameState.gameActive) return;
  
  // Find best move for current player
  const originalPlayer = gameState.currentPlayer;
  gameState.currentPlayer = originalPlayer === 'X' ? 'O' : 'X'; // Swap for opponent analysis
  
  const bestMove = findBestMove();
  gameState.currentPlayer = originalPlayer;
  
  if (bestMove !== null) {
    const cells = boardEl.querySelectorAll('.ttt-cell');
    cells[bestMove].style.background = 'rgba(255, 255, 0, 0.3)';
    setTimeout(() => {
      cells[bestMove].style.background = '';
    }, 1000);
  }
}

function endGame(result) {
  gameState.gameActive = false;
  
  if (result === 'draw') {
    gameState.scores.draws++;
    statusEl.textContent = "It's a Draw!";
    api.recordResult('Draw', Math.round((Date.now() - startTime) / 1000));
  } else {
    gameState.scores[result]++;
    statusEl.textContent = `${result} Wins! 🎉`;
    api.recordResult(`${result} wins`, Math.round((Date.now() - startTime) / 1000));
  }
  
  // Save scores
  localStorage.setItem('tictactoe_scores', JSON.stringify(gameState.scores));
  updateScoreboard();
}

function updateScoreboard() {
  document.getElementById('ttt-x-wins').textContent = gameState.scores.X;
  document.getElementById('ttt-o-wins').textContent = gameState.scores.O;
  document.getElementById('ttt-draws').textContent = gameState.scores.draws;
}

function updateStatus() {
  statusEl.textContent = `${gameState.currentPlayer}'s Turn`;
}

let startTime = Date.now();
