/**
 * Game Arena - Main Application Shell
 * Handles game switching, UI state, history, daily challenges, keyboard shortcuts
 */

// ============== STATE MANAGEMENT ==============
const AppState = {
  currentGame: null,
  currentModule: null,
  isMuted: false,
  history: [],
  tournamentState: null,
  dailyChallenge: null
};

// ============== AUDIO SYSTEM (Web Audio API) ==============
const AudioSys = {
  ctx: null,
  
  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  
  playTone(freq, duration, type = 'sine', vol = 0.3) {
    if (AppState.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  
  playClick() { this.playTone(800, 0.1, 'square', 0.1); },
  playSuccess() { 
    this.playTone(523, 0.15, 'sine', 0.3);
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.3), 100);
    setTimeout(() => this.playTone(784, 0.2, 'sine', 0.3), 200);
  },
  playError() {
    this.playTone(200, 0.3, 'sawtooth', 0.2);
  },
  playWin() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.3, 'sine', 0.3), i * 150);
    });
  }
};

// ============== GAME HISTORY ==============
const GameHistory = {
  STORAGE_KEY: 'gameArena_history',
  MAX_ENTRIES: 20,
  
  load() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  },
  
  save(history) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  },
  
  add(game, result, duration) {
    let history = this.load();
    history.unshift({
      game,
      result,
      duration,
      date: new Date().toISOString()
    });
    if (history.length > this.MAX_ENTRIES) {
      history = history.slice(0, this.MAX_ENTRIES);
    }
    this.save(history);
    AppState.history = history;
    this.render();
  },
  
  clear() {
    this.save([]);
    AppState.history = [];
    this.render();
  },
  
  render() {
    const tbody = document.querySelector('#history-table tbody');
    if (!tbody) return;
    tbody.innerHTML = AppState.history.map(h => `
      <tr>
        <td>${h.game}</td>
        <td>${h.result}</td>
        <td>${h.duration}s</td>
        <td>${new Date(h.date).toLocaleDateString()}</td>
      </tr>
    `).join('');
  }
};

// ============== DAILY CHALLENGE ==============
const DailyChallenge = {
  getTodaySeed() {
    const today = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = ((hash << 5) - hash) + today.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  },
  
  getConfig() {
    const seed = this.getTodaySeed();
    const games = ['tictactoe', 'memory', 'minesweeper', 'checkers', 'connect4', 'reversi', '2048', 'ludo'];
    const gameIndex = seed % games.length;
    const configs = {
      tictactoe: { difficulty: 'hard' },
      memory: { pairs: 8 },
      minesweeper: { width: 10, height: 10, mines: 15 },
      checkers: { difficulty: 'hard' },
      connect4: { difficulty: 'medium' },
      reversi: { difficulty: 'medium' },
      2048: {},
      ludo: { mode: 'classic', difficulty: 'medium' }
    };
    return {
      game: games[gameIndex],
      config: configs[games[gameIndex]],
      seed
    };
  },
  
  activate() {
    const challenge = this.getConfig();
    AppState.dailyChallenge = challenge;
    AppUI.showScreen('game-board-screen');
    AppUI.loadGame(challenge.game, challenge.config);
  }
};

// ============== APP UI CONTROLLER ==============
const AppUI = {
  screens: ['game-select-screen', 'ludo-mode-screen', 'ludo-custom-screen', 'game-board-screen'],
  
  showScreen(id) {
    this.screens.forEach(s => {
      document.getElementById(s)?.classList.toggle('active', s === id);
    });
  },
  
  setStatus(msg) {
    const el = document.getElementById('hud-status');
    if (el) el.textContent = msg;
  },
  
  setTurnIndicator(html) {
    const el = document.getElementById('hud-turn-indicator');
    if (el) el.innerHTML = html;
  },
  
  setScore(score) {
    const el = document.getElementById('hud-score');
    if (el) el.textContent = score;
  },
  
  setControls(controlsHtml) {
    // For games that need custom controls in HUD
    const right = document.querySelector('.hud-right');
    if (right && controlsHtml) {
      // Insert before restart/exit buttons
    }
  },
  
  showVictory(title, message, onPlayAgain, onExit) {
    document.getElementById('victory-title').textContent = title;
    document.getElementById('victory-message').textContent = message;
    document.getElementById('victory-overlay').classList.remove('hidden');
    
    const playBtn = document.getElementById('play-again-btn');
    const exitBtn = document.getElementById('victory-exit-btn');
    
    playBtn.onclick = () => {
      document.getElementById('victory-overlay').classList.add('hidden');
      if (onPlayAgain) onPlayAgain();
    };
    
    exitBtn.onclick = () => {
      document.getElementById('victory-overlay').classList.add('hidden');
      if (onExit) onExit();
    };
  },
  
  hideVictory() {
    document.getElementById('victory-overlay').classList.add('hidden');
  },
  
  loadGame(gameName, config = {}) {
    // Unload current game
    if (AppState.currentModule?.unmount) {
      AppState.currentModule.unmount();
    }
    AppState.currentGame = gameName;
    
    const boardWrap = document.getElementById('board-wrap');
    boardWrap.innerHTML = '';
    
    // Import and mount game
    import(`../games/${gameName}.js`).then(module => {
      AppState.currentModule = module;
      const api = {
        setStatus: (msg) => this.setStatus(msg),
        setTurnIndicator: (html) => this.setTurnIndicator(html),
        setScore: (score) => this.setScore(score),
        setControls: (html) => this.setControls(html),
        showVictory: (title, msg) => this.showVictory(title, msg, null, () => this.exitGame()),
        recordResult: (result, duration) => GameHistory.add(gameName, result, duration)
      };
      
      // Pass config for games that support it
      module.mount(boardWrap, api, config);
    }).catch(err => {
      console.error(`Failed to load game ${gameName}:`, err);
      this.setStatus(`Error loading ${gameName}`);
    });
  },
  
  exitGame() {
    if (AppState.currentModule?.unmount) {
      AppState.currentModule.unmount();
    }
    AppState.currentGame = null;
    AppState.currentModule = null;
    this.showScreen('game-select-screen');
    document.getElementById('board-wrap').innerHTML = '';
  }
};

// ============== KEYBOARD SHORTCUTS ==============
const KeyboardShortcuts = {
  init() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const key = e.key.toLowerCase();
      
      // Number keys 1-8: switch games
      if (key >= '1' && key <= '8') {
        const games = ['tictactoe', 'memory', 'minesweeper', 'checkers', 'connect4', 'reversi', '2048', 'ludo'];
        const game = games[key - '1'];
        if (game) {
          AudioSys.playClick();
          AppUI.loadGame(game);
          AppUI.showScreen('game-board-screen');
        }
      }
      
      // R: Restart
      if (key === 'r' && AppState.currentGame) {
        AudioSys.playClick();
        AppUI.loadGame(AppState.currentGame);
      }
      
      // M: Mute toggle
      if (key === 'm') {
        AppState.isMuted = !AppState.isMuted;
        document.getElementById('mute-btn').textContent = AppState.isMuted ? '🔇' : '🔊';
      }
      
      // Escape: Close panels / Exit game
      if (key === 'escape') {
        document.querySelector('.panel.open')?.classList.remove('open');
      }
    });
  }
};

// ============== INITIALIZATION ==============
const App = {
  init() {
    // Initialize audio on first interaction
    document.addEventListener('click', () => AudioSys.init(), { once: true });
    
    // Load history
    AppState.history = GameHistory.load();
    GameHistory.render();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize keyboard shortcuts
    KeyboardShortcuts.init();
    
    // Show initial screen
    AppUI.showScreen('game-select-screen');
    
    console.log('Game Arena initialized');
  },
  
  setupEventListeners() {
    // Game card clicks
    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        AudioSys.playClick();
        const game = card.dataset.game;
        if (game === 'ludo') {
          AppUI.showScreen('ludo-mode-screen');
        } else {
          AppUI.loadGame(game);
          AppUI.showScreen('game-board-screen');
        }
      });
    });
    
    // Ludo mode selection
    document.querySelectorAll('.mode-card').forEach(mode => {
      mode.addEventListener('click', () => {
        AudioSys.playClick();
        const modeName = mode.dataset.mode;
        if (modeName === 'custom') {
          AppUI.showScreen('ludo-custom-screen');
        } else {
          AppUI.loadGame('ludo', { mode: modeName });
          AppUI.showScreen('game-board-screen');
        }
      });
    });
    
    // Ludo back button
    document.getElementById('ludo-back-to-select')?.addEventListener('click', () => {
      AudioSys.playClick();
      AppUI.showScreen('game-select-screen');
    });
    
    // Custom config form
    document.getElementById('ludo-custom-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      AudioSys.playClick();
      const config = {
        mode: 'custom',
        players: parseInt(document.getElementById('cfg-players').value),
        tokensPerPlayer: parseInt(document.getElementById('cfg-tokens').value),
        safeCellsEnabled: document.getElementById('cfg-safe-cells').checked,
        consecutiveSixLimit: parseInt(document.getElementById('cfg-six-limit').value),
        difficulty: document.getElementById('cfg-difficulty').value,
        theme: document.getElementById('cfg-theme').value
      };
      AppUI.loadGame('ludo', config);
      AppUI.showScreen('game-board-screen');
    });
    
    document.getElementById('cfg-cancel')?.addEventListener('click', () => {
      AudioSys.playClick();
      AppUI.showScreen('ludo-mode-screen');
    });
    
    // History panel
    document.getElementById('history-btn')?.addEventListener('click', () => {
      AudioSys.playClick();
      document.getElementById('history-panel').classList.add('open');
    });
    
    document.querySelector('.close-panel')?.addEventListener('click', () => {
      document.getElementById('history-panel').classList.remove('open');
    });
    
    document.getElementById('clear-history')?.addEventListener('click', () => {
      AudioSys.playClick();
      GameHistory.clear();
    });
    
    // Daily challenge
    document.getElementById('daily-challenge-btn')?.addEventListener('click', () => {
      AudioSys.playClick();
      DailyChallenge.activate();
    });
    
    // Mute toggle
    document.getElementById('mute-btn')?.addEventListener('click', () => {
      AudioSys.playClick();
      AppState.isMuted = !AppState.isMuted;
      this.textContent = AppState.isMuted ? '🔇' : '🔊';
    });
    
    // Global restart/exit
    document.getElementById('restart-btn')?.addEventListener('click', () => {
      if (AppState.currentGame) {
        AudioSys.playClick();
        AppUI.loadGame(AppState.currentGame);
      }
    });
    
    document.getElementById('exit-btn')?.addEventListener('click', () => {
      AudioSys.playClick();
      AppUI.exitGame();
    });
  }
};

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
