/**
 * Ludo 3D - Full 3D Implementation with Three.js + Cannon-es Physics
 * 
 * Features:
 * - 3D board with 15x15 grid, colored quadrants, safe zones
 * - 3D tokens (spheres) with animations
 * - Physics-based dice rolling with Cannon-es
 * - Multiple game modes (Classic, Quick, Blitz, Custom, Tournament)
 * - 3-level CPU AI
 * - Sound effects via Web Audio API
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import * as CANNON from 'cannon-es';

// ============== CONSTANTS ==============
const COLORS = {
  red: 0xe74c3c,
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  blue: 0x3498db,
  white: 0xffffff,
  board: 0xecf0f1,
  safe: 0x9b59b6,
  star: 0xf39c12
};

const PLAYER_COLORS = ['red', 'green', 'yellow', 'blue'];
const CELL_SIZE = 1;
const BOARD_SIZE = 15;

// Track positions (52 cells clockwise starting from red start)
const TRACK_CELLS = [
  // Red side (bottom-left quadrant area)
  { x: 1, z: 6 }, { x: 2, z: 6 }, { x: 3, z: 6 }, { x: 4, z: 6 }, { x: 5, z: 6 },
  { x: 6, z: 5 }, { x: 6, z: 4 }, { x: 6, z: 3 }, { x: 6, z: 2 }, { x: 6, z: 1 },
  { x: 6, z: 0 }, { x: 7, z: 0 }, // Top middle
  { x: 8, z: 1 }, { x: 8, z: 2 }, { x: 8, z: 3 }, { x: 8, z: 4 }, { x: 8, z: 5 },
  { x: 9, z: 6 }, { x: 10, z: 6 }, { x: 11, z: 6 }, { x: 12, z: 6 }, { x: 13, z: 6 },
  { x: 14, z: 7 }, // Right middle
  { x: 13, z: 8 }, { x: 12, z: 8 }, { x: 11, z: 8 }, { x: 10, z: 8 }, { x: 9, z: 8 },
  { x: 8, z: 9 }, { x: 8, z: 10 }, { x: 8, z: 11 }, { x: 8, z: 12 }, { x: 8, z: 13 },
  { x: 7, z: 14 }, // Bottom middle
  { x: 6, z: 13 }, { x: 6, z: 12 }, { x: 6, z: 11 }, { x: 6, z: 10 }, { x: 6, z: 9 },
  { x: 5, z: 8 }, { x: 4, z: 8 }, { x: 3, z: 8 }, { x: 2, z: 8 }, { x: 1, z: 8 },
  { x: 0, z: 7 }   // Left middle
];

// Safe cells (star positions + start positions)
const SAFE_CELLS = [0, 8, 13, 21, 26, 34, 39, 47];

// Start positions for each player (index into TRACK_CELLS)
const START_INDICES = [0, 13, 26, 39];

// Home column positions (6 cells leading to center)
const HOME_COLUMNS = {
  0: [{ x: 1, z: 7 }, { x: 2, z: 7 }, { x: 3, z: 7 }, { x: 4, z: 7 }, { x: 5, z: 7 }, { x: 6, z: 7 }],
  1: [{ x: 7, z: 1 }, { x: 7, z: 2 }, { x: 7, z: 3 }, { x: 7, z: 4 }, { x: 7, z: 5 }, { x: 7, z: 6 }],
  2: [{ x: 13, z: 7 }, { x: 12, z: 7 }, { x: 11, z: 7 }, { x: 10, z: 7 }, { x: 9, z: 7 }, { x: 8, z: 7 }],
  3: [{ x: 7, z: 13 }, { x: 7, z: 12 }, { x: 7, z: 11 }, { x: 7, z: 10 }, { x: 7, z: 9 }, { x: 7, z: 8 }]
};

// Base positions for tokens (where they sit when not on track)
const BASE_POSITIONS = {
  0: [{ x: 2, z: 2 }, { x: 3, z: 2 }, { x: 2, z: 3 }, { x: 3, z: 3 }],
  1: [{ x: 11, z: 2 }, { x: 12, z: 2 }, { x: 11, z: 3 }, { x: 12, z: 3 }],
  2: [{ x: 11, z: 11 }, { x: 12, z: 11 }, { x: 11, z: 12 }, { x: 12, z: 12 }],
  3: [{ x: 2, z: 11 }, { x: 3, z: 11 }, { x: 2, z: 12 }, { x: 3, z: 12 }]
};

// Camera target positions for each player
const CAMERA_TARGETS = {
  0: { x: 5, y: 12, z: 5 },
  1: { x: 10, y: 12, z: 5 },
  2: { x: 10, y: 12, z: 10 },
  3: { x: 5, y: 12, z: 10 }
};

// ============== GAME STATE ==============
let gameState = {
  mode: 'classic',
  players: [],
  currentPlayer: 0,
  consecutiveSixes: 0,
  tokensPerPlayer: 4,
  safeCellsEnabled: true,
  consecutiveSixLimit: 3,
  difficulty: 'medium',
  theme: 'classic',
  turnTimer: null,
  blitzTime: 45,
  startTime: 0,
  isRolling: false,
  isMoving: false,
  diceValue: 0,
  winners: [],
  tournamentState: null
};

// Three.js globals
let scene, camera, renderer, controls;
let world; // Cannon-es physics world
let diceBodies = [];
let diceMeshes = [];
let tokenMeshes = [];
let tokenPositions = []; // { playerId, tokenIndex, position: {x,z}, state: 'base'|'track'|'home'|'captured' }
let raycaster, mouse;
let animationId;
let clock;

// DOM elements
let boardWrap, hudStatus, hudTurnIndicator, hudScore;

// ============== AUDIO SYSTEM ==============
const AudioSys = {
  ctx: null,
  init() { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  play(freq, duration, type = 'sine', vol = 0.2) {
    if (!this.ctx) return;
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
  playDiceClack() { this.play(300, 0.1, 'square', 0.3); },
  playTokenMove() { this.play(400, 0.1, 'sine', 0.15); },
  playCapture() { 
    this.play(200, 0.2, 'sawtooth', 0.3);
    setTimeout(() => this.play(150, 0.2, 'sawtooth', 0.3), 100);
  },
  playSuccess() { 
    this.play(600, 0.1, 'sine', 0.2);
    setTimeout(() => this.play(800, 0.15, 'sine', 0.2), 100);
  },
  playWin() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.play(f, 0.3, 'sine', 0.3), i * 150));
  }
};

// ============== INITIALIZATION ==============
export function mount(boardWrapEl, api, config = {}) {
  boardWrap = boardWrapEl;
  
  // Initialize audio
  AudioSys.init();
  
  // Parse config
  gameState.mode = config.mode || 'classic';
  gameState.players = config.players || 4;
  gameState.tokensPerPlayer = config.tokensPerPlayer || 4;
  gameState.safeCellsEnabled = config.safeCellsEnabled !== false;
  gameState.consecutiveSixLimit = config.consecutiveSixLimit || 3;
  gameState.difficulty = config.difficulty || 'medium';
  gameState.theme = config.theme || 'classic';
  gameState.blitzTime = config.blitzTime || 45;
  
  // Setup player types (for now, player 0 is human, rest are CPU)
  // In a full implementation, this would be configurable
  gameState.playerTypes = ['human'];
  for (let i = 1; i < gameState.players; i++) {
    gameState.playerTypes.push('cpu');
  }
  
  // Store API reference
  gameState.api = api;
  
  // Initialize Three.js scene
  initThreeJS();
  
  // Initialize physics world
  initPhysics();
  
  // Create the board
  createBoard();
  
  // Create dice for each player
  createDice();
  
  // Create tokens
  createTokens();
  
  // Setup event listeners
  setupEventListeners();
  
  // Start game
  gameState.startTime = Date.now();
  startTurn();
  
  // Start animation loop
  clock = new THREE.Clock();
  animate();
}

export function unmount() {
  if (animationId) cancelAnimationFrame(animationId);
  if (gameState.turnTimer) clearTimeout(gameState.turnTimer);
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
  // Clean up Three.js objects
  if (scene) {
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
  diceBodies = [];
  diceMeshes = [];
  tokenMeshes = [];
  tokenPositions = [];
}

// ============== THREE.JS SETUP ==============
function initThreeJS() {
  const width = boardWrap.clientWidth;
  const height = boardWrap.clientHeight;
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  
  // Camera
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(7.5, 18, 15);
  camera.lookAt(7.5, 0, 7.5);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  boardWrap.appendChild(renderer.domElement);
  
  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.minDistance = 10;
  controls.maxDistance = 30;
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -10;
  dirLight.shadow.camera.right = 20;
  dirLight.shadow.camera.top = 20;
  dirLight.shadow.camera.bottom = -10;
  scene.add(dirLight);
  
  // Raycaster
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  
  // Handle resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  if (!boardWrap) return;
  const width = boardWrap.clientWidth;
  const height = boardWrap.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// ============== PHYSICS SETUP ==============
function initPhysics() {
  world = new CANNON.World();
  world.gravity.set(0, -20, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;
  
  // Create ground plane for dice
  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({ mass: 0 });
  groundBody.addShape(groundShape);
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  groundBody.position.set(7.5, 0, 7.5);
  world.addBody(groundBody);
  
  // Create invisible walls around dice rolling area
  createDiceWalls();
}

function createDiceWalls() {
  const wallOptions = { mass: 0, friction: 0.5 };
  const positions = [
    { pos: [0, 1, 7.5], rot: [0, Math.PI/2, 0] },  // Left
    { pos: [15, 1, 7.5], rot: [0, Math.PI/2, 0] }, // Right
    { pos: [7.5, 1, 0], rot: [0, 0, 0] },          // Front
    { pos: [7.5, 1, 15], rot: [0, 0, 0] }          // Back
  ];
  
  positions.forEach(({ pos, rot }) => {
    const wall = new CANNON.Body(wallOptions);
    wall.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 1, 8)));
    wall.position.set(...pos);
    wall.quaternion.setFromEuler(...rot);
    world.addBody(wall);
  });
}

// ============== BOARD CREATION ==============
function createBoard() {
  // Main board base
  const boardGeo = new THREE.BoxGeometry(BOARD_SIZE, 0.5, BOARD_SIZE);
  const boardMat = new THREE.MeshStandardMaterial({ color: getThemeColor('board') });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.set(7.5, -0.25, 7.5);
  board.receiveShadow = true;
  scene.add(board);
  
  // Create cells
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let z = 0; z < BOARD_SIZE; z++) {
      const cellType = getCellType(x, z);
      const color = getCellColor(x, z, cellType);
      
      const cellGeo = new THREE.BoxGeometry(CELL_SIZE * 0.95, 0.1, CELL_SIZE * 0.95);
      const cellMat = new THREE.MeshStandardMaterial({ 
        color,
        roughness: 0.8
      });
      const cell = new THREE.Mesh(cellGeo, cellMat);
      cell.position.set(x, 0.05, z);
      cell.receiveShadow = true;
      scene.add(cell);
      
      // Add border lines
      const edges = new THREE.EdgesGeometry(cellGeo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 }));
      line.position.copy(cell.position);
      scene.add(line);
    }
  }
  
  // Add safe zone stars
  SAFE_CELLS.forEach(index => {
    const pos = TRACK_CELLS[index];
    createStar(pos.x, 0.15, pos.z);
  });
  
  // Create home columns (center area)
  createHomeColumn(0, 0x1a1a2e);
  createHomeColumn(1, 0x1a1a2e);
  createHomeColumn(2, 0x1a1a2e);
  createHomeColumn(3, 0x1a1a2e);
  
  // Center victory platform
  const centerGeo = new THREE.CylinderGeometry(2, 2, 0.3, 8);
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xf39c12 });
  const center = new THREE.Mesh(centerGeo, centerMat);
  center.position.set(7.5, 0.15, 7.5);
  center.receiveShadow = true;
  scene.add(center);
  
  // Add trophy symbol
  const trophyText = createTextSprite('🏆');
  trophyText.position.set(7.5, 0.5, 7.5);
  scene.add(trophyText);
}

function getCellType(x, z) {
  // Check if it's a base area
  if (x < 6 && z < 6) return 'base-red';
  if (x > 8 && z < 6) return 'base-green';
  if (x > 8 && z > 8) return 'base-yellow';
  if (x < 6 && z > 8) return 'base-blue';
  
  // Check if it's a home column
  if (z === 7 && x > 0 && x < 7) return 'home-red';
  if (x === 7 && z > 0 && z < 7) return 'home-green';
  if (z === 7 && x > 7 && x < 14) return 'home-yellow';
  if (x === 7 && z > 7 && z < 14) return 'home-blue';
  
  // Check if it's track
  for (const cell of TRACK_CELLS) {
    if (cell.x === x && cell.z === z) return 'track';
  }
  
  return 'decorative';
}

function getCellColor(x, z, type) {
  if (type.startsWith('base-')) {
    const colorName = type.split('-')[1];
    return COLORS[colorName];
  }
  if (type.startsWith('home-')) {
    const colorName = type.split('-')[1];
    return COLORS[colorName];
  }
  if (type === 'track') {
    return COLORS.board;
  }
  return 0xbdc3c7; // Decorative
}

function createStar(x, y, z) {
  const starShape = new THREE.Shape();
  const outer = 0.3;
  const inner = 0.15;
  
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) {
      starShape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    } else {
      starShape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
  }
  starShape.closePath();
  
  const extrudeSettings = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02 };
  const starGeo = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
  const starMat = new THREE.MeshStandardMaterial({ color: COLORS.star, emissive: COLORS.star, emissiveIntensity: 0.3 });
  const star = new THREE.Mesh(starGeo, starMat);
  star.rotation.x = -Math.PI / 2;
  star.position.set(x, y, z);
  star.castShadow = true;
  scene.add(star);
}

function createHomeColumn(playerIdx, color) {
  // Visual indicator for home column entrance
  const pos = TRACK_CELLS[START_INDICES[playerIdx]];
  const markerGeo = new THREE.RingGeometry(0.3, 0.4, 8);
  const markerMat = new THREE.MeshBasicMaterial({ color: COLORS[PLAYER_COLORS[playerIdx]] });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(pos.x, 0.16, pos.z);
  scene.add(marker);
}

function createTextSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = 'Bold 64px Arial';
  ctx.fillStyle = '#f39c12';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2, 2, 1);
  return sprite;
}

// ============== DICE CREATION ==============
function createDice() {
  for (let i = 0; i < gameState.players; i++) {
    const playerColor = PLAYER_COLORS[i];
    
    // Position near player's base corner
    const positions = [
      { x: 3, z: 3 },   // Red
      { x: 12, z: 3 },  // Green
      { x: 12, z: 12 }, // Yellow
      { x: 3, z: 12 }   // Blue
    ];
    const pos = positions[i];
    
    // Create die mesh
    const size = 0.8;
    const dieGeo = new THREE.BoxGeometry(size, size, size);
    
    // Create materials with pips
    const materials = createDiceMaterials(playerColor);
    
    const dieMesh = new THREE.Mesh(dieGeo, materials);
    dieMesh.position.set(pos.x, size, pos.z);
    dieMesh.castShadow = true;
    
    // Store face data for pip rendering
    dieMesh.userData = { playerId: i, isActive: false };
    
    scene.add(dieMesh);
    diceMeshes.push(dieMesh);
    
    // Create physics body
    const dieShape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
    const dieBody = new CANNON.Body({ 
      mass: 1,
      friction: 0.5,
      restitution: 0.3
    });
    dieBody.addShape(dieShape);
    dieBody.position.set(pos.x, 5, pos.z); // Start above board
    dieBody.linearDamping = 0.5;
    dieBody.angularDamping = 0.5;
    dieBody.sleepSpeedLimit = 0.1;
    dieBody.sleepTimeLimit = 0.5;
    
    // Store initial position
    dieBody.userData = { 
      playerId: i, 
      initialPos: new CANNON.Vec3(pos.x, size, pos.z),
      isRolling: false,
      result: 1
    };
    
    world.addBody(dieBody);
    diceBodies.push(dieBody);
  }
}

function createDiceMaterials(playerColor) {
  const color = COLORS[playerColor];
  const materials = [];
  
  // Create 6 faces with different pip counts
  const pipConfigs = [
    [5], // Face 1 (index 0) - right
    [1, 2, 3, 4, 5, 6], // Face 2 (index 1) - left
    [1, 2, 3], // Face 3 (index 2) - top
    [1, 4], // Face 4 (index 3) - bottom
    [1, 2, 4, 5], // Face 5 (index 4) - front
    [1, 3, 5] // Face 6 (index 5) - back
  ];
  
  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, 256, 256);
    
    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 252);
    
    // Pips
    ctx.fillStyle = '#ffffff';
    const pipPositions = getPipPositions(i + 1);
    pipPositions.forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 25, 0, Math.PI * 2);
      ctx.fill();
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    materials.push(new THREE.MeshStandardMaterial({ 
      map: texture,
      roughness: 0.3
    }));
  }
  
  return materials;
}

function getPipPositions(value) {
  const positions = {
    1: [[128, 128]],
    2: [[64, 64], [192, 192]],
    3: [[64, 64], [128, 128], [192, 192]],
    4: [[64, 64], [192, 64], [64, 192], [192, 192]],
    5: [[64, 64], [192, 64], [128, 128], [64, 192], [192, 192]],
    6: [[64, 64], [192, 64], [64, 128], [192, 128], [64, 192], [192, 192]]
  };
  return positions[value] || [[128, 128]];
}

// ============== TOKEN CREATION ==============
function createTokens() {
  tokenMeshes = [];
  tokenPositions = [];
  
  for (let p = 0; p < gameState.players; p++) {
    tokenMeshes[p] = [];
    tokenPositions[p] = [];
    
    for (let t = 0; t < gameState.tokensPerPlayer; t++) {
      const color = COLORS[PLAYER_COLORS[p]];
      
      // Token geometry (sphere/capsule)
      const tokenGeo = new THREE.SphereGeometry(0.35, 16, 16);
      const tokenMat = new THREE.MeshStandardMaterial({ 
        color,
        metalness: 0.5,
        roughness: 0.3,
        emissive: color,
        emissiveIntensity: 0.2
      });
      const token = new THREE.Mesh(tokenGeo, tokenMat);
      token.castShadow = true;
      
      // Initial position in base
      const basePos = BASE_POSITIONS[p][t % BASE_POSITIONS[p].length];
      token.position.set(basePos.x, 0.5, basePos.z);
      
      scene.add(token);
      tokenMeshes[p].push(token);
      
      tokenPositions[p].push({
        playerId: p,
        tokenIndex: t,
        position: { ...basePos },
        state: 'base',
        trackIndex: -1,
        homeIndex: -1
      });
    }
  }
}

// ============== EVENT LISTENERS ==============
function setupEventListeners() {
  renderer.domElement.addEventListener('click', onMouseClick);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
}

function onMouseClick(event) {
  if (gameState.isRolling || gameState.isMoving) return;
  
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  // Check if clicking on active die
  const activeDieIndex = gameState.currentPlayer;
  const activeDie = diceMeshes[activeDieIndex];
  
  if (activeDie && activeDie.userData.isActive) {
    const intersects = raycaster.intersectObject(activeDie);
    if (intersects.length > 0) {
      rollDice(activeDieIndex);
    }
  }
}

function onMouseMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  // Update cursor based on hover
  let canRoll = false;
  const activeDieIndex = gameState.currentPlayer;
  const activeDie = diceMeshes[activeDieIndex];
  
  if (activeDie && activeDie.userData.isActive && !gameState.isRolling) {
    const intersects = raycaster.intersectObject(activeDie);
    canRoll = intersects.length > 0;
  }
  
  renderer.domElement.style.cursor = canRoll ? 'pointer' : 'default';
}

// ============== DICE ROLLING ==============
function rollDice(playerIndex) {
  if (gameState.isRolling) return;
  
  const dieBody = diceBodies[playerIndex];
  if (!dieBody || dieBody.userData.isRolling) return;
  
  gameState.isRolling = true;
  dieBody.userData.isRolling = true;
  
  // Reset die position and rotation
  dieBody.position.copy(dieBody.userData.initialPos);
  dieBody.position.y = 3;
  dieBody.quaternion.set(0, 0, 0, 1);
  dieBody.velocity.set(0, 0, 0);
  dieBody.angularVelocity.set(0, 0, 0);
  dieBody.wakeUp();
  
  AudioSys.playDiceClack();
  
  // Apply random impulse
  const impulseX = (Math.random() - 0.5) * 5;
  const impulseY = 8 + Math.random() * 4;
  const impulseZ = (Math.random() - 0.5) * 5;
  
  dieBody.applyImpulse(new CANNON.Vec3(impulseX, impulseY, impulseZ), dieBody.position);
  
  // Apply random angular velocity
  dieBody.angularVelocity.set(
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20
  );
  
  // Wait for die to settle
  setTimeout(() => checkDiceSettle(playerIndex), 1500);
}

function checkDiceSettle(playerIndex) {
  const dieBody = diceBodies[playerIndex];
  const speed = dieBody.velocity.length();
  
  if (speed < 0.5 && !dieBody.sleepState) {
    finalizeDiceRoll(playerIndex);
  } else {
    setTimeout(() => checkDiceSettle(playerIndex), 200);
  }
}

function finalizeDiceRoll(playerIndex) {
  const dieBody = diceBodies[playerIndex];
  dieBody.userData.isRolling = false;
  
  // Determine result from die orientation
  const result = getDiceResult(dieBody);
  dieBody.userData.result = result;
  gameState.diceValue = result;
  
  // Show result floating above die
  showDiceResult(result, diceMeshes[playerIndex].position);
  
  // Update game state
  handleDiceResult(playerIndex, result);
}

function getDiceResult(dieBody) {
  // Get the up vector in world coordinates
  const up = new CANNON.Vec3(0, 1, 0);
  
  // Transform the die's local axes to world space
  const quat = dieBody.quaternion;
  
  // Get which face normal is most aligned with world up
  // Face normals in local space
  const faces = [
    new CANNON.Vec3(0, 1, 0),   // Top face
    new CANNON.Vec3(0, -1, 0),  // Bottom face
    new CANNON.Vec3(1, 0, 0),   // Right face
    new CANNON.Vec3(-1, 0, 0),  // Left face
    new CANNON.Vec3(0, 0, 1),   // Front face
    new CANNON.Vec3(0, 0, -1)   // Back face
  ];
  
  // Corresponding dice values for each face
  const values = [6, 1, 2, 5, 3, 4];
  
  let maxDot = -Infinity;
  let result = 6;
  
  for (let i = 0; i < faces.length; i++) {
    // Transform face normal to world space
    const worldNormal = quat.vmult(faces[i]);
    // Dot product with world up
    const dot = worldNormal.dot(up);
    if (dot > maxDot) {
      maxDot = dot;
      result = values[i];
    }
  }
  
  return result;
}

function showDiceResult(value, position) {
  // Create floating text
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = 'Bold 80px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value.toString(), 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(position.x, position.y + 2, position.z);
  sprite.scale.set(1.5, 1.5, 1);
  
  scene.add(sprite);
  
  // Animate and remove
  const startTime = Date.now();
  const animateSprite = () => {
    const elapsed = Date.now() - startTime;
    sprite.position.y += 0.01;
    sprite.material.opacity = 1 - elapsed / 1200;
    
    if (elapsed < 1200) {
      requestAnimationFrame(animateSprite);
    } else {
      scene.remove(sprite);
      texture.dispose();
      mat.dispose();
    }
  };
  animateSprite();
}

// ============== GAME LOGIC ==============
function handleDiceResult(playerIndex, value) {
  const playerType = gameState.playerTypes[playerIndex];
  
  // Check for 6 to release token
  if (value === 6) {
    gameState.consecutiveSixes++;
    
    if (gameState.consecutiveSixes >= gameState.consecutiveSixLimit) {
      // Skip turn after too many 6s
      gameState.api.setStatus(`Too many 6s! Turn passes.`);
      nextTurn();
      return;
    }
  } else {
    gameState.consecutiveSixes = 0;
  }
  
  // Check for valid moves
  const validMoves = getValidMoves(playerIndex, value);
  
  if (validMoves.length === 0) {
    gameState.api.setStatus(`No valid moves for ${PLAYER_COLORS[playerIndex]}`);
    if (value !== 6) {
      setTimeout(() => nextTurn(), 1000);
      return;
    }
  }
  
  // If only one move, auto-execute
  if (validMoves.length === 1) {
    executeMove(playerIndex, validMoves[0], value);
    return;
  }
  
  // Multiple moves - highlight and wait for selection
  if (playerType === 'human') {
    highlightValidMoves(validMoves, playerIndex, value);
    gameState.api.setStatus(`Select a token to move`);
  } else {
    // CPU chooses move
    setTimeout(() => {
      const chosenMove = chooseCPUMove(validMoves, playerIndex, value);
      executeMove(playerIndex, chosenMove, value);
    }, 1000 + Math.random() * 500);
  }
}

function getValidMoves(playerIndex, diceValue) {
  const moves = [];
  const tokens = tokenPositions[playerIndex];
  
  tokens.forEach((token, idx) => {
    if (token.state === 'base') {
      // Can only move out with 6 (or always in Quick mode)
      if (diceValue === 6 || gameState.mode === 'quick') {
        moves.push({ tokenIndex: idx, type: 'release' });
      }
    } else if (token.state === 'track') {
      // Check if can enter home column
      const lapsCompleted = Math.floor(token.trackIndex / 52);
      const positionInLap = token.trackIndex % 52;
      const startIdx = START_INDICES[playerIndex];
      
      // Calculate distance to home entrance
      let distToHome = (startIdx - positionInLap + 52) % 52;
      
      if (distToHome <= diceValue && diceValue <= distToHome + 6) {
        // Can move into home column
        const homeIndex = diceValue - distToHome - 1;
        if (homeIndex < 6 && homeIndex >= 0) {
          moves.push({ tokenIndex: idx, type: 'home', homeIndex });
        }
      } else if (diceValue < distToHome) {
        // Regular track movement
        moves.push({ tokenIndex: idx, type: 'track', steps: diceValue });
      }
    } else if (token.state === 'home') {
      // Already in home, check if can move further
      if (token.homeIndex + diceValue < 6) {
        moves.push({ tokenIndex: idx, type: 'home', homeIndex: token.homeIndex + diceValue });
      } else if (token.homeIndex + diceValue === 5) {
        // Reached home!
        moves.push({ tokenIndex: idx, type: 'home-complete' });
      }
    }
  });
  
  return moves;
}

function highlightValidMoves(moves, playerIndex, diceValue) {
  // Flash the valid tokens
  moves.forEach(move => {
    const token = tokenMeshes[playerIndex][move.tokenIndex];
    const originalY = token.position.y;
    
    const flash = () => {
      let count = 0;
      const interval = setInterval(() => {
        token.position.y = originalY + (count % 2 === 0 ? 0.3 : 0);
        count++;
        if (count > 5) {
          clearInterval(interval);
          token.position.y = originalY;
        }
      }, 200);
    };
    flash();
  });
}

function executeMove(playerIndex, move, diceValue) {
  gameState.isMoving = true;
  const token = tokenMeshes[playerIndex][move.tokenIndex];
  const tokenData = tokenPositions[playerIndex][move.tokenIndex];
  
  AudioSys.playTokenMove();
  
  if (move.type === 'release') {
    // Move from base to start position
    const startPos = TRACK_CELLS[START_INDICES[playerIndex]];
    animateTokenMove(token, tokenData, startPos, () => {
      tokenData.state = 'track';
      tokenData.trackIndex = START_INDICES[playerIndex];
      completeMove(playerIndex, diceValue);
    });
  } else if (move.type === 'track') {
    // Move along track
    const currentIdx = tokenData.trackIndex;
    const newIdx = (currentIdx + move.steps) % 52;
    const newPos = TRACK_CELLS[newIdx];
    
    animateTokenMoveAlongTrack(token, tokenData, currentIdx, newIdx, () => {
      tokenData.trackIndex = newIdx;
      checkCapture(playerIndex, tokenData, newPos, () => {
        completeMove(playerIndex, diceValue);
      });
    });
  } else if (move.type === 'home') {
    // Move into home column
    const homePos = HOME_COLUMNS[playerIndex][move.homeIndex];
    animateTokenMove(token, tokenData, homePos, () => {
      tokenData.state = 'home';
      tokenData.homeIndex = move.homeIndex;
      completeMove(playerIndex, diceValue);
    });
  } else if (move.type === 'home-complete') {
    // Token reached home!
    tokenData.state = 'home-complete';
    token.position.y = 1;
    AudioSys.playSuccess();
    checkWinCondition(playerIndex);
    completeMove(playerIndex, diceValue);
  }
}

function animateTokenMove(token, tokenData, targetPos, callback) {
  const startPos = { ...token.position };
  const targetVec = new THREE.Vector3(targetPos.x, 0.5, targetPos.z);
  const distance = startPos.distanceTo(targetVec);
  const duration = 500;
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Linear interpolation with vertical hop
    const hopHeight = 0.5 * Math.sin(progress * Math.PI);
    
    token.position.lerpVectors(
      new THREE.Vector3(startPos.x, startPos.y, startPos.z),
      targetVec,
      progress
    );
    token.position.y += hopHeight;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      token.position.copy(targetVec);
      if (callback) callback();
    }
  };
  animate();
}

function animateTokenMoveAlongTrack(token, tokenData, startIdx, endIdx, callback) {
  const steps = (endIdx - startIdx + 52) % 52;
  let currentStep = 0;
  
  const stepDuration = 100;
  
  const animateStep = () => {
    if (currentStep >= steps) {
      if (callback) callback();
      return;
    }
    
    const currentTrackIdx = (startIdx + currentStep) % 52;
    const nextTrackIdx = (startIdx + currentStep + 1) % 52;
    
    const startPos = TRACK_CELLS[currentTrackIdx];
    const targetPos = TRACK_CELLS[nextTrackIdx];
    
    const startPosVec = new THREE.Vector3(startPos.x, 0.5, startPos.z);
    const targetPosVec = new THREE.Vector3(targetPos.x, 0.5, targetPos.z);
    
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / stepDuration, 1);
      const hopHeight = 0.3 * Math.sin(progress * Math.PI);
      
      token.position.lerpVectors(startPosVec, targetPosVec, progress);
      token.position.y = 0.5 + hopHeight;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        currentStep++;
        setTimeout(animateStep, 50);
      }
    };
    animate();
  };
  
  animateStep();
}

function checkCapture(playerIndex, tokenData, position, callback) {
  if (!gameState.safeCellsEnabled) {
    callback();
    return;
  }
  
  // Check if this is a safe cell
  const trackIdx = tokenData.trackIndex;
  if (SAFE_CELLS.includes(trackIdx)) {
    callback();
    return;
  }
  
  // Check for opponent tokens at same position
  let captured = false;
  for (let p = 0; p < gameState.players; p++) {
    if (p === playerIndex) continue;
    
    tokenPositions[p].forEach((oppToken, oppIdx) => {
      if (oppToken.state === 'track' && oppToken.trackIndex === trackIdx && !captured) {
        // Capture!
        captured = true;
        AudioSys.playCapture();
        
        // Animate capture
        const oppMesh = tokenMeshes[p][oppIdx];
        animateTokenToBase(oppMesh, oppToken, p, () => {
          oppToken.state = 'base';
          oppToken.trackIndex = -1;
          gameState.api.setStatus(`Captured!`);
        });
      }
    });
  }
  
  // Wait a bit for capture animation then continue
  setTimeout(callback, captured ? 500 : 100);
}

function animateTokenToBase(token, tokenData, playerId, callback) {
  const basePos = BASE_POSITIONS[playerId][tokenData.tokenIndex % BASE_POSITIONS[playerId].length];
  const targetVec = new THREE.Vector3(basePos.x, 0.5, basePos.z);
  
  const startPos = token.position.clone();
  const duration = 800;
  const startTime = Date.now();
  
  // Spin animation
  const spinAxis = new THREE.Vector3(0, 1, 0);
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    token.position.lerpVectors(startPos, targetVec, progress);
    token.position.y = 0.5 + (1 - progress) * 1; // Arc up then down
    
    token.rotateOnWorldAxis(spinAxis, 0.3);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      token.position.copy(targetVec);
      token.quaternion.set(0, 0, 0, 1);
      if (callback) callback();
    }
  };
  animate();
}

function completeMove(playerIndex, diceValue) {
  gameState.isMoving = false;
  
  // Check if rolled 6 - extra turn
  if (diceValue === 6) {
    gameState.api.setStatus(`${PLAYER_COLORS[playerIndex]} rolls again!`);
    if (gameState.playerTypes[playerIndex] === 'cpu') {
      setTimeout(() => rollDice(playerIndex), 1000);
    }
  } else {
    nextTurn();
  }
}

function nextTurn() {
  gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players;
  gameState.consecutiveSixes = 0;
  startTurn();
}

function startTurn() {
  const playerIdx = gameState.currentPlayer;
  const playerName = PLAYER_COLORS[playerIdx];
  const playerType = gameState.playerTypes[playerIdx];
  
  // Update UI
  gameState.api.setStatus(`${playerName.toUpperCase()}'s Turn`);
  gameState.api.setTurnIndicator(`<span style="color: #${COLORS[PLAYER_COLORS[playerIdx]].toString(16)}">${playerName} (${playerType})</span>`);
  
  // Update score
  updateScore();
  
  // Move camera to player's side
  moveCameraToPlayer(playerIdx);
  
  // Activate/deactivate dice
  diceMeshes.forEach((die, i) => {
    const isActive = i === playerIdx;
    die.userData.isActive = isActive;
    die.material.forEach(mat => {
      mat.emissiveIntensity = isActive ? 0.3 : 0;
    });
  });
  
  // Auto-roll for CPU
  if (playerType === 'cpu') {
    setTimeout(() => {
      rollDice(playerIdx);
    }, 1500);
  }
  
  // Blitz mode timer
  if (gameState.mode === 'blitz' && playerType === 'human') {
    let timeLeft = gameState.blitzTime;
    gameState.api.setStatus(`${playerName}: ${timeLeft}s`);
    
    gameState.turnTimer = setInterval(() => {
      timeLeft--;
      gameState.api.setStatus(`${playerName}: ${timeLeft}s`);
      if (timeLeft <= 0) {
        clearInterval(gameState.turnTimer);
        // Auto-roll or pass turn
        nextTurn();
      }
    }, 1000);
  }
}

function moveCameraToPlayer(playerIdx) {
  const target = CAMERA_TARGETS[playerIdx];
  const targetPos = new THREE.Vector3(target.x, target.y, target.z);
  const lookAt = new THREE.Vector3(7.5, 0, 7.5);
  
  // Smooth lerp
  const duration = 1000;
  const startPos = camera.position.clone();
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    
    camera.position.lerpVectors(startPos, targetPos, easeProgress);
    controls.target.lerpVectors(controls.target, lookAt, easeProgress);
    controls.update();
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  animate();
}

function updateScore() {
  let scoreHtml = '';
  for (let p = 0; p < gameState.players; p++) {
    const homeCount = tokenPositions[p].filter(t => t.state === 'home-complete').length;
    const color = PLAYER_COLORS[p];
    scoreHtml += `<span style="color: #${COLORS[color].toString(16)}">●${homeCount}/${gameState.tokensPerPlayer} </span>`;
  }
  gameState.api.setScore(scoreHtml);
}

function checkWinCondition(playerIndex) {
  const allHome = tokenPositions[playerIndex].every(t => t.state === 'home-complete');
  
  if (allHome) {
    gameState.winners.push(playerIndex);
    AudioSys.playWin();
    
    const duration = Math.round((Date.now() - gameState.startTime) / 1000);
    
    if (gameState.winners.length >= gameState.players - 1 || gameState.mode === 'tournament') {
      // Game over
      const winnerName = PLAYER_COLORS[gameState.winners[0]];
      gameState.api.showVictory(`🎉 ${winnerName.toUpperCase()} WINS!`, `Game completed in ${duration} seconds`);
      gameState.api.recordResult(`${winnerName} wins`, duration);
    }
  }
}

// ============== CPU AI ==============
function chooseCPUMove(moves, playerIndex, diceValue) {
  const difficulty = gameState.difficulty;
  
  if (difficulty === 'easy') {
    // Random move
    return moves[Math.floor(Math.random() * moves.length)];
  }
  
  if (difficulty === 'medium') {
    // Prefer captures > safe cells > progress
    return evaluateMovesMedium(moves, playerIndex, diceValue);
  }
  
  // Hard difficulty - full evaluation
  return evaluateMovesHard(moves, playerIndex, diceValue);
}

function evaluateMovesMedium(moves, playerIndex, diceValue) {
  let bestMove = moves[0];
  let bestScore = -Infinity;
  
  moves.forEach(move => {
    let score = 0;
    const tokenData = tokenPositions[playerIndex][move.tokenIndex];
    
    if (move.type === 'release') {
      score = 10; // Good to release
    } else if (move.type === 'home-complete') {
      score = 100; // Best!
    } else if (move.type === 'home') {
      score = 20 + move.homeIndex * 5; // Progress toward home
    } else if (move.type === 'track') {
      const newIdx = (tokenData.trackIndex + move.steps) % 52;
      
      // Check if landing on safe cell
      if (SAFE_CELLS.includes(newIdx)) {
        score += 15;
      }
      
      // Check for capture opportunity
      for (let p = 0; p < gameState.players; p++) {
        if (p === playerIndex) continue;
        tokenPositions[p].forEach(opp => {
          if (opp.state === 'track' && opp.trackIndex === newIdx) {
            score += 30; // Capture!
          }
        });
      }
      
      score += move.steps; // Prefer longer moves
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  });
  
  return bestMove;
}

function evaluateMovesHard(moves, playerIndex, diceValue) {
  let bestMove = moves[0];
  let bestScore = -Infinity;
  
  moves.forEach(move => {
    let score = 0;
    const tokenData = tokenPositions[playerIndex][move.tokenIndex];
    
    if (move.type === 'release') {
      score = 15;
      // Check if safe to release (no opponents nearby start)
      const startIdx = START_INDICES[playerIndex];
      for (let p = 0; p < gameState.players; p++) {
        if (p === playerIndex) continue;
        tokenPositions[p].forEach(opp => {
          if (opp.state === 'track') {
            const dist = Math.abs(opp.trackIndex - startIdx);
            if (dist < 6 || dist > 46) {
              score -= 10; // Opponent nearby
            }
          }
        });
      }
    } else if (move.type === 'home-complete') {
      score = 150;
    } else if (move.type === 'home') {
      score = 30 + move.homeIndex * 8;
    } else if (move.type === 'track') {
      const newIdx = (tokenData.trackIndex + move.steps) % 52;
      
      // Safe cell bonus
      if (SAFE_CELLS.includes(newIdx)) {
        score += 20;
      }
      
      // Capture opportunity
      for (let p = 0; p < gameState.players; p++) {
        if (p === playerIndex) continue;
        tokenPositions[p].forEach(opp => {
          if (opp.state === 'track' && opp.trackIndex === newIdx) {
            score += 40;
          }
        });
      }
      
      // Avoid danger - check if opponents can capture us next turn
      for (let p = 0; p < gameState.players; p++) {
        if (p === playerIndex) continue;
        tokenPositions[p].forEach(opp => {
          if (opp.state === 'track' && !SAFE_CELLS.includes(newIdx)) {
            const dist = (newIdx - opp.trackIndex + 52) % 52;
            if (dist >= 1 && dist <= 6) {
              score -= 25; // Danger zone
            }
          }
        });
      }
      
      // Block opponent home column
      // (simplified - just prefer blocking positions)
      
      // Race logic - if leading, prefer getting tokens home
      const myHomeCount = tokenPositions[playerIndex].filter(t => t.state === 'home-complete').length;
      if (myHomeCount >= 2) {
        score += 10;
      }
    }
    
    // Add small random factor to avoid predictability
    score += Math.random() * 5;
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  });
  
  return bestMove;
}

// ============== ANIMATION LOOP ==============
function animate() {
  animationId = requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  
  // Update physics
  world.step(1 / 60, delta, 3);
  
  // Sync dice meshes with physics bodies
  diceBodies.forEach((body, i) => {
    if (diceMeshes[i]) {
      diceMeshes[i].position.copy(body.position);
      diceMeshes[i].quaternion.copy(body.quaternion);
    }
  });
  
  // Idle animation for base tokens
  tokenMeshes.forEach((playerTokens, p) => {
    playerTokens.forEach((token, t) => {
      const tokenData = tokenPositions[p][t];
      if (tokenData.state === 'base') {
        token.position.y = 0.5 + Math.sin(Date.now() * 0.003 + t) * 0.05;
      }
    });
  });
  
  // Update controls
  controls.update();
  
  // Render
  renderer.render(scene, camera);
}

// ============== THEME COLORS ==============
function getThemeColor(name) {
  const themes = {
    classic: { board: 0xecf0f1 },
    neon: { board: 0x2c3e50 },
    pastel: { board: 0xffecd2 },
    dark: { board: 0x2c3e50 }
  };
  return themes[gameState.theme]?.[name] || 0xecf0f1;
}
