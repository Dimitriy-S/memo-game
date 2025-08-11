// =================== DOM-элементы ===================
const board            = document.getElementById('board');
const movesEl          = document.getElementById('moves');
const bestEl           = document.getElementById('best');
const restartBtn       = document.getElementById('restart');
const duplicatesInput  = document.getElementById('duplicatesInput');
const maxMovesInput    = document.getElementById('maxMovesInput');
const difficultyInputs = document.querySelectorAll('input[name="difficulty"]');
const toggleThemeBtn   = document.getElementById('toggleTheme');

const modal            = document.getElementById('gameOverModal');
const modalTitle       = document.getElementById('modalTitle');
const modalMessage     = document.getElementById('modalMessage');
const modalRetry       = document.getElementById('modalRetry');

// =================== Значения по умолчанию ===================
const DEFAULT_DUPLICATES = 2;
const DEFAULT_MAX_MOVES  = 999;
const DEFAULT_DIFFICULTY = 'easy';
const MIN_CARD_SIZE = 48;
const MAX_CARD_SIZE = 160;

let moves          = 0;
let matches        = 0;
let flipped        = [];
let duplicateCount = DEFAULT_DUPLICATES;
let maxMoves       = DEFAULT_MAX_MOVES;
let gridSize       = 4;

// Пути к картинкам
const images = Array.from({ length: 32 }, (_, i) => `assets/images/${i + 1}.png`);

// Палитра для случайных цветов (светлая тема)
const frontColors = [
  ['#2196f3', '#1976d2'],
  ['#ff9800', '#f57c00'],
  ['#4caf50', '#388e3c'],
  ['#e91e63', '#ad1457'],
  ['#9c27b0', '#6a1b9a'],
  ['#00bcd4', '#0097a7'],
  ['#ffc107', '#ff9800'],
  ['#8bc34a', '#689f38']
];

// =================== Звуки ===================
const sounds = {
  flip: new Audio('assets/sounds/flip.mp3'),
  unflip: new Audio('assets/sounds/unflip.mp3'),
  match: new Audio('assets/sounds/match.mp3'),
  win: new Audio('assets/sounds/win.mp3'),
  lose: new Audio('assets/sounds/lose.mp3')
};

function playSound(name) {
  if (sounds[name]) {
    sounds[name].currentTime = 0;
    sounds[name].play().catch(() => {});
  }
}

// =================== Обработчики ===================
restartBtn.addEventListener('click', () => {
  setDifficulty(DEFAULT_DIFFICULTY);
  fadeAndStart();
});

modalRetry.addEventListener('click', () => {
  modal.classList.add('hidden');
  fadeAndStart();
});

window.addEventListener('resize', () => {
  clearTimeout(window.__memoResizeTimer);
  window.__memoResizeTimer = setTimeout(() => fadeAndStart(), 120);
});

difficultyInputs.forEach(input => {
  input.addEventListener('change', () => {
    setDifficulty(input.value);
    fadeAndStart();
  });
});

duplicatesInput.addEventListener('change', fadeAndStart);
maxMovesInput.addEventListener('change', fadeAndStart);
duplicatesInput.addEventListener('keydown', e => { if (e.key === 'Enter') fadeAndStart(); });
maxMovesInput.addEventListener('keydown', e => { if (e.key === 'Enter') fadeAndStart(); });

// =================== Темы ===================
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
    toggleThemeBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    toggleThemeBtn.textContent = '🌙';
  }
}

function loadTheme() {
  let theme = localStorage.getItem('memo-theme');
  if (!theme) {
    theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  applyTheme(theme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  const newTheme = isDark ? 'light' : 'dark';
  applyTheme(newTheme);
  localStorage.setItem('memo-theme', newTheme);
}

toggleThemeBtn.addEventListener('click', toggleTheme);

// =================== Рекорды ===================
function loadBestScore() {
  const best = localStorage.getItem(`memo-best-${gridSize}`);
  bestEl.textContent = best !== null ? `Рекорд: ${best} ходів` : `Рекорд: —`;
}

// =================== Уровни сложности ===================
function setDifficulty(level) {
  switch (level) {
    case 'easy':
      gridSize = 4;
      duplicateCount = 2;
      maxMoves = 50;
      break;
    case 'medium':
      gridSize = 6;
      duplicateCount = 4;
      maxMoves = 120;
      break;
    case 'hard':
      gridSize = 8;
      duplicateCount = 6;
      maxMoves = 200;
      break;
  }
  duplicatesInput.value = duplicateCount;
  maxMovesInput.value = maxMoves;
  document.querySelector(`input[name="difficulty"][value="${level}"]`).checked = true;
}

function updateStats() {
  movesEl.textContent = `Ходи: ${moves}`;
}

function fadeAndStart() {
  document.body.classList.add('fade-out');
  document.body.addEventListener('transitionend', onFaded);
}

function onFaded(e) {
  if (e.propertyName !== 'opacity') return;
  document.body.removeEventListener('transitionend', onFaded);
  startGame();
  setTimeout(() => document.body.classList.remove('fade-out'), 0);
}

function buildCardsArray(totalCards, duplicates) {
  const uniqueNeeded = Math.ceil(totalCards / duplicates);
  const imgs = [];
  for (let i = 0; i < uniqueNeeded; i++) {
    imgs.push(images[i % images.length]);
  }
  const cards = [];
  imgs.forEach(img => {
    for (let k = 0; k < duplicates; k++) {
      cards.push(img);
    }
  });
  while (cards.length < totalCards) {
    cards.push(images[cards.length % images.length]);
  }
  return shuffle(cards).slice(0, totalCards);
}

// =================== Игра ===================
function startGame() {
  let inputDuplicates = parseInt(duplicatesInput.value) || DEFAULT_DUPLICATES;
  if (inputDuplicates > 10) inputDuplicates = 10;
  duplicateCount = Math.max(2, inputDuplicates);
  duplicatesInput.value = duplicateCount;

  let inputMaxMoves = parseInt(maxMovesInput.value) || DEFAULT_MAX_MOVES;
  if (inputMaxMoves > 999) inputMaxMoves = DEFAULT_MAX_MOVES;
  maxMoves = Math.max(1, inputMaxMoves);
  maxMovesInput.value = maxMoves;

  board.innerHTML = '';
  moves = 0;
  matches = 0;
  flipped = [];
  updateStats();
  loadBestScore();

  const totalCards = gridSize * gridSize;
  const cards = buildCardsArray(totalCards, duplicateCount);

  const computed = getComputedStyle(board);
  let gap = parseInt(computed.gap) || 10;

  const headerH   = document.querySelector('header')?.offsetHeight || 0;
  const settingsH = document.querySelector('.settings')?.offsetHeight || 0;
  const availH    = Math.max(200, window.innerHeight - headerH - settingsH - 40);

  let boardW = board.getBoundingClientRect().width || document.documentElement.clientWidth - 40;
  const totalGapWidth = gap * (gridSize - 1);
  const usableW = Math.max(100, boardW - totalGapWidth - 20);

  let cardSize = Math.floor(Math.min(usableW / gridSize, availH / gridSize));
  cardSize = Math.max(MIN_CARD_SIZE, Math.min(MAX_CARD_SIZE, cardSize));

  board.style.display = 'grid';
  board.style.gridTemplateColumns = `repeat(${gridSize}, ${cardSize}px)`;
  board.style.gridAutoRows        = `${cardSize}px`;
  board.style.gap = `${gap}px`;

  let color1, color2;
  if (document.body.classList.contains('dark-mode')) {
    color1 = '#0d47a1';
    color2 = '#1976d2';
  } else {
    [color1, color2] = frontColors[Math.floor(Math.random() * frontColors.length)];
  }

  [restartBtn, toggleThemeBtn].forEach(btn => {
    if (!btn) return;
    if (document.body.classList.contains('dark-mode')) {
      btn.style.background = `linear-gradient(145deg, ${color1}, ${color2})`;
      btn.style.color = '#fff';
    } else {
      btn.style.background = '';
      btn.style.color = '';
    }
  });

  cards.forEach(src => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.width  = `${cardSize}px`;
    card.style.height = `${cardSize}px`;
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-face front" style="background:linear-gradient(145deg, ${color1}, ${color2});"></div>
        <div class="card-face back" style="background-image:url('${src}')"></div>
      </div>`;
    card.addEventListener('click', handleCardClick);
    board.appendChild(card);
  });
}

function handleCardClick(e) {
  const card = e.currentTarget;
  if (
    card.classList.contains('flipped') ||
    card.classList.contains('matched') ||
    flipped.length >= duplicateCount ||
    (moves >= maxMoves && flipped.length === 0)
  ) return;

  card.classList.add('flipped');
  playSound('flip');

  flipped.push(card);

  if (flipped.length === duplicateCount) {
    moves++;
    updateStats();
    const firstBg = flipped[0].querySelector('.back').style.backgroundImage;
    const allSame = flipped.every(c => c.querySelector('.back').style.backgroundImage === firstBg);

    if (allSame) {
      playSound('match');
      flipped.forEach(c => c.classList.add('matched'));
      matches++;
      flipped = [];

      if (matches === Math.floor((gridSize * gridSize) / duplicateCount)) {
        playSound('win');
        modalTitle.textContent   = 'Вітаю!';
        modalMessage.textContent = `Ви завершили гру за ${moves} ходів!`;
        modal.classList.remove('hidden');

        const bestKey = `memo-best-${gridSize}`;
        const prevBest = localStorage.getItem(bestKey);
        if (prevBest === null || moves < parseInt(prevBest)) {
          localStorage.setItem(bestKey, moves);
          bestEl.textContent = `Рекорд: ${moves} ходів`;
        }
      }
    } else {
      setTimeout(() => {
        flipped.forEach(c => c.classList.remove('flipped'));
        playSound('unflip');
        flipped = [];
      }, 900);
    }

    if (moves >= maxMoves) {
      playSound('lose');
      modalTitle.textContent   = 'Упс!';
      modalMessage.textContent = 'Ліміт ходів досягнуто. Спробуйте ще раз.';
      modal.classList.remove('hidden');
    }
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =================== Инициализация ===================
loadTheme();
setDifficulty(DEFAULT_DIFFICULTY);
startGame();
