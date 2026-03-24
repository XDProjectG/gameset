/////////////////
// model
///

const seasonNames = ["春", "夏", "秋", "冬"];
const officers = ["諸葛亮", "荀彧", "周瑜", "陳群", "法正", "魯肅"];
const commands = ["內政", "人事", "外交", "軍事", "其他", "系統"];
const titleActions = [
  { key: "new", label: "1. 新遊戲" },
  { key: "load", label: "2. 載入遊戲" },
  { key: "settings", label: "3. 設定" },
];
const openingText = "天下大勢分久必合，合久必分。漢室衰微，群雄並起，州郡之間既要安民治政，也要整軍經武。此刻，你將自一城一地起，觀時勢、蓄糧兵，逐步寫下屬於自己的經略篇章。";
const openingCharInterval = 90;
const openingAutoAdvanceDelay = 5000;

const citySeed = [
  { id: "luoyang", name: "洛陽", x: 0.48, y: 0.4, major: true, pop: 890000, money: 54000, grain: 69000, soldiers: 24000, geo: "平原", crop: "小麥", ruler: "曹操" },
  { id: "xuchang", name: "許昌", x: 0.54, y: 0.48, major: true, pop: 760000, money: 47000, grain: 62000, soldiers: 21000, geo: "平原", crop: "粟", ruler: "曹操" },
  { id: "chengdu", name: "成都", x: 0.26, y: 0.66, major: true, pop: 810000, money: 52000, grain: 78000, soldiers: 19000, geo: "盆地", crop: "稻米", ruler: "劉備" },
  { id: "jianye", name: "建業", x: 0.76, y: 0.62, major: true, pop: 700000, money: 56000, grain: 66000, soldiers: 20000, geo: "江南", crop: "稻米", ruler: "孫權" },
  { id: "xiangyang", name: "襄陽", x: 0.56, y: 0.58, major: true, pop: 670000, money: 43000, grain: 61000, soldiers: 17500, geo: "江漢", crop: "稻麥輪作", ruler: "曹魏" },
  { id: "ye", name: "鄴城", x: 0.57, y: 0.3, major: false, pop: 580000, money: 39000, grain: 52000, soldiers: 16000, geo: "平原", crop: "小麥", ruler: "曹魏" },
  { id: "hanzhong", name: "漢中", x: 0.34, y: 0.56, major: false, pop: 360000, money: 28000, grain: 49000, soldiers: 14000, geo: "山地", crop: "粟", ruler: "蜀漢" },
  { id: "jiangling", name: "江陵", x: 0.62, y: 0.66, major: false, pop: 500000, money: 35000, grain: 54000, soldiers: 15000, geo: "江陵澤地", crop: "稻米", ruler: "東吳" },
];

const passes = [
  { name: "虎牢關", x: 0.5, y: 0.42 },
  { name: "潼關", x: 0.41, y: 0.44 },
  { name: "劍閣", x: 0.3, y: 0.6 },
  { name: "夷陵", x: 0.58, y: 0.68 },
];

function createUiLayout() {
  return {
    commandBlocks: [],
    modal: null,
    cityHit: [],
    titleButtons: [],
  };
}

function createInitialState() {
  return {
    scene: "opening",
    year: 196,
    season: 0,
    selectedCityId: null,
    cities: [],
    hoverCommand: null,
    hoverTitleAction: null,
    activeModal: null,
    modalMessage: "",
    titleMessage: "",
    opening: {
      text: openingText,
      visibleCount: 0,
      fadeProgress: 0,
      startedAt: 0,
      completedAt: null,
    },
  };
}

function createNewGameState(previousState) {
  return {
    ...previousState,
    scene: "map",
    year: 196,
    season: 0,
    selectedCityId: "luoyang",
    cities: deepCloneSeed(),
    hoverCommand: null,
    activeModal: null,
    modalMessage: "",
    titleMessage: "",
  };
}

function deepCloneSeed() {
  return citySeed.map((city, idx) => ({
    ...city,
    preparedness: 45,
    tax: 18,
    law: 5,
    literacy: 42,
    workforce: { scholar: 0.08, farmer: 0.58, artisan: 0.16, merchant: 0.18 },
    offices: [
      { role: "治中從事", duty: "法律與稅率", assigned: officers[(idx + 1) % officers.length] },
      { role: "都尉", duty: "招兵與練兵", assigned: officers[(idx + 2) % officers.length] },
      { role: "農政掾", duty: "農業生產", assigned: officers[(idx + 3) % officers.length] },
      { role: "市舶掾", duty: "商業流通", assigned: officers[(idx + 4) % officers.length] },
    ],
  }));
}

function selectedCity(state) {
  return state.cities.find((city) => city.id === state.selectedCityId) || null;
}

function formatDate(state) {
  return `建安${state.year - 195}年（${state.year}年）${seasonNames[state.season]}`;
}

function cropMultiplier(state, city) {
  const seasonal = [1.1, 1.25, 1.35, 0.75][state.season];
  const geoBonus = city.geo === "盆地" ? 1.15 : city.geo.includes("江") ? 1.1 : city.geo === "山地" ? 0.85 : 1;
  return seasonal * geoBonus;
}

function progressSeason(state) {
  state.cities = state.cities.map((city) => {
    const farmerPop = city.pop * city.workforce.farmer;
    const grainGain = Math.round((farmerPop / 10) * cropMultiplier(state, city));
    const mineAndCraft = Math.round(city.pop * city.workforce.artisan * 0.03);
    const tradeTax = Math.round(city.money * (city.tax / 100) * 0.08);
    const scholarshipBoost = Math.max(1, Math.round(city.pop * city.workforce.scholar * 0.00003));
    return {
      ...city,
      grain: city.grain + grainGain - Math.round(city.soldiers * 0.25),
      money: city.money + mineAndCraft + tradeTax,
      literacy: Math.min(95, city.literacy + scholarshipBoost),
      preparedness: Math.min(100, city.preparedness + Math.round(city.law / 2)),
      pop: Math.max(100000, city.pop + Math.round(city.pop * 0.004) - Math.round(city.tax * 4)),
    };
  });

  state.season += 1;
  if (state.season > 3) {
    state.season = 0;
    state.year += 1;
  }
}

function saveGame(state) {
  localStorage.setItem("sgz-canvas-save", JSON.stringify(state));
}

function loadGame(currentState) {
  const raw = localStorage.getItem("sgz-canvas-save");
  if (!raw) {
    currentState.titleMessage = "目前沒有存檔。";
    return false;
  }

  const loaded = JSON.parse(raw);
  Object.assign(currentState, loaded, {
    scene: "map",
    hoverCommand: null,
    hoverTitleAction: null,
    activeModal: null,
    modalMessage: "",
    titleMessage: "",
  });
  return true;
}

const SGZModel = {
  commands,
  titleActions,
  passes,
  openingCharInterval,
  openingAutoAdvanceDelay,
  createInitialState,
  createNewGameState,
  createUiLayout,
  selectedCity,
  formatDate,
  cropMultiplier,
  progressSeason,
  saveGame,
  loadGame,
};


/////////////////
// renderer
///

function fillRoundRect(ctx, x, y, w, h, r, fill, stroke = null) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function wrapText(ctx, text, maxWidth) {
  const chars = [...text];
  const lines = [];
  let line = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function findHit(list, x, y) {
  return list.find((item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) || null;
}

function drawOpeningScene(ctx, canvas, state) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const chars = [...state.opening.text];
  const fontSize = Math.max(28, Math.min(42, canvas.height * 0.045));
  const lineGap = fontSize * 1.15;
  const columnGap = fontSize * 1.35;
  const top = 72;
  const bottom = canvas.height - 120;
  const usableHeight = Math.max(lineGap, bottom - top);
  const rowsPerColumn = Math.max(1, Math.floor(usableHeight / lineGap));
  const totalColumns = Math.ceil(chars.length / rowsPerColumn);
  const right = canvas.width - 110;

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `${fontSize}px 'Noto Serif TC', 'Noto Sans TC', serif`;

  chars.forEach((char, index) => {
    const column = Math.floor(index / rowsPerColumn);
    const row = index % rowsPerColumn;
    const x = right - column * columnGap;
    const y = top + row * lineGap;
    const alpha = Math.max(0, Math.min(1, state.opening.fadeProgress - index));
    if (alpha <= 0) return;

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillText(char, x, y);
  });

  const titleAlpha = Math.min(1, 0.25 + state.opening.fadeProgress / 14);
  ctx.fillStyle = `rgba(255,255,255,${titleAlpha})`;
  ctx.font = "28px 'Noto Serif TC', 'Noto Sans TC', serif";
  ctx.fillText("三國志：州郡經略", Math.max(120, right - totalColumns * columnGap - 100), top);

  ctx.font = "16px 'Noto Sans TC', sans-serif";
  ctx.fillStyle = "rgba(220,228,240,0.9)";
  const hint = state.opening.completedAt ? "任意鍵或點擊滑鼠可立即進入主畫面" : "開場白播放中，亦可按任意鍵跳過";
  ctx.fillText(hint, canvas.width / 2, canvas.height - 48);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawTitleScene(ctx, canvas, state, uiLayout) {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#1a2537");
  gradient.addColorStop(0.55, "#101726");
  gradient.addColorStop(1, "#080b12");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let i = 0; i < 7; i += 1) {
    ctx.fillRect(70 + i * 120, 90 + (i % 2) * 36, 56, canvas.height - 220);
  }

  ctx.fillStyle = "#f3f5fa";
  ctx.textAlign = "center";
  ctx.font = "40px 'Noto Serif TC', 'Noto Sans TC', serif";
  ctx.fillText("三國志：州郡經略", canvas.width / 2, 140);
  ctx.font = "18px 'Noto Sans TC', sans-serif";
  ctx.fillStyle = "#b8c9e8";
  ctx.fillText("以正史《三國志》為背景的 2D Canvas 策略原型", canvas.width / 2, 180);

  const panel = {
    x: canvas.width / 2 - 220,
    y: 230,
    w: 440,
    h: 250,
  };
  fillRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 18, "rgba(15,23,37,0.84)", "rgba(125,153,196,0.5)");

  uiLayout.titleButtons = [];
  SGZModel.titleActions.forEach((action, idx) => {
    const button = {
      key: action.key,
      x: panel.x + 60,
      y: panel.y + 44 + idx * 62,
      w: panel.w - 120,
      h: 44,
    };
    const isHover = state.hoverTitleAction === action.key;
    fillRoundRect(ctx, button.x, button.y, button.w, button.h, 10, isHover ? "rgba(66,96,132,0.92)" : "rgba(31,50,76,0.85)", "rgba(109,134,172,0.88)");
    ctx.fillStyle = "#ecf2ff";
    ctx.font = "18px 'Noto Sans TC', sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(action.label, button.x + button.w / 2, button.y + button.h / 2);
    uiLayout.titleButtons.push(button);
  });

  if (state.titleMessage) {
    ctx.font = "16px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#cde6ff";
    ctx.fillText(state.titleMessage, canvas.width / 2, panel.y + panel.h - 26);
  }

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawMapBackground(ctx, canvas) {
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, "#2f4d36");
  g.addColorStop(0.5, "#496447");
  g.addColorStop(1, "#2f5063");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(220,240,255,0.08)";
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, (canvas.height / 8) * i + 30);
    ctx.bezierCurveTo(canvas.width * 0.3, (canvas.height / 8) * i, canvas.width * 0.7, (canvas.height / 8) * i + 50, canvas.width, (canvas.height / 8) * i + 20);
    ctx.stroke();
  }
}

function cityToPixel(canvas, city) {
  return { x: city.x * canvas.width, y: city.y * canvas.height };
}

function drawCities(ctx, canvas, state, uiLayout) {
  uiLayout.cityHit = [];

  SGZModel.passes.forEach((pass) => {
    const x = pass.x * canvas.width;
    const y = pass.y * canvas.height;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#ad6f4f";
    ctx.strokeStyle = "#2d1a11";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
  });

  state.cities.forEach((city) => {
    const { x, y } = cityToPixel(canvas, city);
    const radius = city.major ? 12 : 9;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = city.major ? "#f0ba53" : "#e4d7b4";
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (city.id === state.selectedCityId) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = "#f7fbff";
    ctx.font = "15px 'Noto Sans TC', sans-serif";
    ctx.fillText(city.name, x - 18, y + 24);

    uiLayout.cityHit.push({ id: city.id, x, y, r: radius + 8 });
  });
}

function drawCanvasPanels(ctx, canvas, state, uiLayout) {
  const city = SGZModel.selectedCity(state);

  const timePanel = { x: 18, y: 18, w: 250, h: 90 };
  fillRoundRect(ctx, timePanel.x, timePanel.y, timePanel.w, timePanel.h, 12, "rgba(20,32,48,0.72)", "rgba(125,153,196,0.45)");
  ctx.fillStyle = "#ecf2ff";
  ctx.font = "18px 'Noto Sans TC', sans-serif";
  ctx.fillText("時間", timePanel.x + 16, timePanel.y + 28);
  ctx.font = "16px 'Noto Sans TC', sans-serif";
  ctx.fillText(SGZModel.formatDate(state), timePanel.x + 16, timePanel.y + 58);

  const cityPanel = { x: canvas.width - 430, y: 18, w: 412, h: canvas.height - 36 };
  fillRoundRect(ctx, cityPanel.x, cityPanel.y, cityPanel.w, cityPanel.h, 14, "rgba(20,32,48,0.72)", "rgba(125,153,196,0.45)");

  ctx.fillStyle = "#ecf2ff";
  ctx.font = "18px 'Noto Sans TC', sans-serif";
  const title = city ? `${city.name}｜太守：${city.ruler}` : "請點擊城池";
  ctx.fillText(title, cityPanel.x + 14, cityPanel.y + 28);

  if (city) {
    ctx.font = "14px 'Noto Sans TC', sans-serif";
    const rows = [
      `人口 ${city.pop.toLocaleString()}   士兵 ${city.soldiers.toLocaleString()}`,
      `錢 ${city.money.toLocaleString()}   糧 ${city.grain.toLocaleString()}`,
      `士${Math.round(city.workforce.scholar * 100)}% 農${Math.round(city.workforce.farmer * 100)}% 工${Math.round(city.workforce.artisan * 100)}% 商${Math.round(city.workforce.merchant * 100)}%`,
      `文教 ${city.literacy}  戰備 ${city.preparedness}  稅率 ${city.tax}%  法律 ${city.law}`,
      `文人：講學、說書、政令宣導（季增文教）`,
      `農業：${city.geo}/${city.crop}，生產係數 ${SGZModel.cropMultiplier(state, city).toFixed(2)}`,
      `工業：採礦、伐木、器具生產`,
      `商業：糧材書器轉賣，商稅受稅率影響`,
      `內府：${city.offices.map((o) => `${o.role}:${o.assigned}`).join(" / ")}`,
    ];

    let y = cityPanel.y + 54;
    for (const row of rows) {
      const lines = wrapText(ctx, row, cityPanel.w - 28);
      for (const line of lines) {
        ctx.fillText(line, cityPanel.x + 14, y);
        y += 22;
      }
    }
  }

  const menuX = 18;
  const menuY = canvas.height - 238;
  const blockW = 118;
  const blockH = 102;
  const gap = 10;
  uiLayout.commandBlocks = [];

  ctx.font = "16px 'Noto Sans TC', sans-serif";
  SGZModel.commands.forEach((name, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = menuX + col * (blockW + gap);
    const y = menuY + row * (blockH + gap);
    const isHover = state.hoverCommand === name;
    fillRoundRect(ctx, x, y, blockW, blockH, 10, isHover ? "rgba(66,96,132,0.8)" : "rgba(20,32,48,0.72)", "rgba(125,153,196,0.45)");
    ctx.fillStyle = "#ecf2ff";
    ctx.fillText(name, x + 36, y + 56);
    uiLayout.commandBlocks.push({ name, x, y, w: blockW, h: blockH });
  });
}

function drawModalIfNeeded(ctx, canvas, state, uiLayout) {
  if (!state.activeModal) return;

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const modal = {
    x: canvas.width / 2 - 250,
    y: canvas.height / 2 - 160,
    w: 500,
    h: 320,
    close: { x: canvas.width / 2 + 210, y: canvas.height / 2 - 130, w: 24, h: 24 },
    actions: [
      { key: "save", label: "儲存遊戲", x: canvas.width / 2 - 180, y: canvas.height / 2 - 40, w: 360, h: 46 },
      { key: "next", label: "推進一季", x: canvas.width / 2 - 180, y: canvas.height / 2 + 22, w: 360, h: 46 },
      { key: "back", label: "返回主畫面", x: canvas.width / 2 - 180, y: canvas.height / 2 + 84, w: 360, h: 46 },
    ],
  };
  uiLayout.modal = modal;

  fillRoundRect(ctx, modal.x, modal.y, modal.w, modal.h, 14, "rgba(20,32,48,0.94)", "rgba(171,195,231,0.6)");
  ctx.fillStyle = "#ecf2ff";
  ctx.font = "22px 'Noto Sans TC', sans-serif";
  ctx.fillText("系統選單", modal.x + 20, modal.y + 40);

  fillRoundRect(ctx, modal.close.x, modal.close.y, modal.close.w, modal.close.h, 6, "rgba(116,68,68,0.8)");
  ctx.font = "14px 'Noto Sans TC', sans-serif";
  ctx.fillText("X", modal.close.x + 8, modal.close.y + 17);

  modal.actions.forEach((action) => {
    fillRoundRect(ctx, action.x, action.y, action.w, action.h, 8, "rgba(39,63,92,0.88)", "rgba(171,195,231,0.45)");
    ctx.fillStyle = "#ecf2ff";
    ctx.font = "18px 'Noto Sans TC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(action.label, action.x + action.w / 2, action.y + action.h / 2);
  });
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  if (state.modalMessage) {
    ctx.font = "14px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#cde6ff";
    ctx.fillText(state.modalMessage, modal.x + 20, modal.y + modal.h - 20);
  }
}

function render(ctx, canvas, state, uiLayout) {
  if (state.scene === "opening") {
    drawOpeningScene(ctx, canvas, state);
    return;
  }
  if (state.scene === "title") {
    drawTitleScene(ctx, canvas, state, uiLayout);
    return;
  }

  drawMapBackground(ctx, canvas);
  drawCities(ctx, canvas, state, uiLayout);
  drawCanvasPanels(ctx, canvas, state, uiLayout);
  drawModalIfNeeded(ctx, canvas, state, uiLayout);
}

const SGZRenderer = {
  render,
  findHit,
};


/////////////////
// controller
///

function createController({ screens, canvas, state, uiLayout, render, isEnabled, onBackToSelection = null }) {
  const model = SGZModel;
  const renderer = SGZRenderer;
  let openingTimerId = null;
  let animationFrameId = null;

  function showDomScreen(name) {
    Object.entries(screens).forEach(([screenName, element]) => {
      element.classList.toggle("active", screenName === name);
    });
  }

  function switchToCanvasScene(scene) {
    showDomScreen("map");
    state.scene = scene;
    render();
  }

  function updateOpeningFrame() {
    if (state.scene !== "opening" || !isEnabled()) return;

    const elapsed = performance.now() - state.opening.startedAt;
    const totalChars = [...state.opening.text].length;
    const nextFadeProgress = Math.min(totalChars, elapsed / model.openingCharInterval);
    const nextVisibleCount = Math.min(totalChars, Math.ceil(nextFadeProgress));

    if (nextFadeProgress !== state.opening.fadeProgress || nextVisibleCount !== state.opening.visibleCount) {
      state.opening.fadeProgress = nextFadeProgress;
      state.opening.visibleCount = nextVisibleCount;
      render();
    }

    if (state.opening.fadeProgress >= totalChars) {
      if (!state.opening.completedAt) {
        state.opening.completedAt = performance.now();
        render();
      }
      if (!openingTimerId) {
        openingTimerId = window.setTimeout(() => {
          openingTimerId = null;
          goToTitle();
        }, model.openingAutoAdvanceDelay);
      }
      return;
    }

    animationFrameId = window.requestAnimationFrame(updateOpeningFrame);
  }

  function startOpeningSequence() {
    if (openingTimerId) {
      window.clearTimeout(openingTimerId);
      openingTimerId = null;
    }
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
    }

    state.opening.visibleCount = 0;
    state.opening.fadeProgress = 0;
    state.opening.startedAt = performance.now();
    state.opening.completedAt = null;
    switchToCanvasScene("opening");
    animationFrameId = window.requestAnimationFrame(updateOpeningFrame);
  }

  function goToTitle() {
    if (openingTimerId) {
      window.clearTimeout(openingTimerId);
      openingTimerId = null;
    }
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    state.hoverTitleAction = null;
    state.titleMessage = "";
    switchToCanvasScene("title");
  }

  function stop() {
    if (openingTimerId) {
      window.clearTimeout(openingTimerId);
      openingTimerId = null;
    }
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    state.activeModal = null;
    state.modalMessage = "";
    state.hoverCommand = null;
    state.hoverTitleAction = null;
  }

  function startNewGame() {
    Object.assign(state, model.createNewGameState(state));
    switchToCanvasScene("map");
  }

  function handleTitleAction(actionKey) {
    if (actionKey === "new") {
      startNewGame();
      return;
    }
    if (actionKey === "load") {
      if (model.loadGame(state)) {
        switchToCanvasScene("map");
      } else {
        switchToCanvasScene("title");
      }
      render();
      return;
    }
    if (actionKey === "settings") {
      state.titleMessage = "設定已併入遊戲內『系統』指令。";
      render();
    }
  }

  function handleCommand(name) {
    const city = model.selectedCity(state);
    if (name === "系統") {
      state.activeModal = "system";
      state.modalMessage = "";
      render();
      return;
    }
    if (!city) return;

    if (name === "內政") {
      city.tax = Math.min(40, city.tax + 1);
      city.law = Math.min(10, city.law + 1);
    } else if (name === "人事") {
      city.literacy = Math.min(95, city.literacy + 2);
    } else if (name === "外交") {
      state.modalMessage = `${city.name}已派使節至鄰郡。`;
    } else if (name === "軍事") {
      if (city.money >= 3000 && city.pop >= 550000) {
        city.soldiers += 500;
        city.money -= 3000;
        city.pop -= 500;
      }
    } else if (name === "其他") {
      city.preparedness = Math.min(100, city.preparedness + 5);
    }
    render();
  }

  function handleModalClick(x, y) {
    const modal = uiLayout.modal;
    if (!modal) return;

    if (renderer.findHit([modal.close], x, y)) {
      state.activeModal = null;
      state.modalMessage = "";
      render();
      return;
    }

    const action = renderer.findHit(modal.actions, x, y);
    if (!action) return;

    if (action.key === "save") {
      model.saveGame(state);
      state.modalMessage = "已儲存目前進度。";
    }
    if (action.key === "next") {
      model.progressSeason(state);
      state.modalMessage = "時間已推進一季。";
    }
    if (action.key === "back") {
      stop();
      onBackToSelection?.();
      return;
    }
    render();
  }

  function getCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handlePointerMove(event) {
    if (!isEnabled() || !screens.map.classList.contains("active")) return;
    const { x, y } = getCanvasPoint(event);

    if (state.scene === "title") {
      const hit = renderer.findHit(uiLayout.titleButtons, x, y);
      const nextHover = hit ? hit.key : null;
      if (nextHover !== state.hoverTitleAction) {
        state.hoverTitleAction = nextHover;
        render();
      }
      return;
    }

    if (state.scene !== "map" || state.activeModal) return;
    const hit = renderer.findHit(uiLayout.commandBlocks, x, y);
    const nextHover = hit ? hit.name : null;
    if (nextHover !== state.hoverCommand) {
      state.hoverCommand = nextHover;
      render();
    }
  }

  function handleCanvasClick(event) {
    if (!isEnabled() || !screens.map.classList.contains("active")) return;
    const { x, y } = getCanvasPoint(event);

    if (state.scene === "opening") {
      goToTitle();
      return;
    }

    if (state.scene === "title") {
      const action = renderer.findHit(uiLayout.titleButtons, x, y);
      if (action) handleTitleAction(action.key);
      return;
    }

    if (state.activeModal) {
      handleModalClick(x, y);
      return;
    }

    const command = renderer.findHit(uiLayout.commandBlocks, x, y);
    if (command) {
      handleCommand(command.name);
      return;
    }

    const cityHit = uiLayout.cityHit.find((city) => Math.hypot(x - city.x, y - city.y) <= city.r);
    if (cityHit) {
      state.selectedCityId = cityHit.id;
      render();
    }
  }

  function handleKeydown() {
    if (!isEnabled()) return;
    if (state.scene === "opening") {
      goToTitle();
    }
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (isEnabled()) render();
  }

  function bindEvents() {
    canvas.addEventListener("mousemove", handlePointerMove);
    canvas.addEventListener("click", handleCanvasClick);
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", resizeCanvas);
  }

  function unbindEvents() {
    canvas.removeEventListener("mousemove", handlePointerMove);
    canvas.removeEventListener("click", handleCanvasClick);
    window.removeEventListener("keydown", handleKeydown);
    window.removeEventListener("resize", resizeCanvas);
  }

  return {
    bindEvents,
    resizeCanvas,
    unbindEvents,
    showDomScreen,
    startOpeningSequence,
    stop,
  };
}

const SGZController = {
  createController,
};

/////////////////
// camera
///



export function startGame(canvas, onExit) {
  const screens = {
    selection: document.getElementById("game-select-screen"),
    map: document.getElementById("map-screen"),
  };
  const ctx = canvas.getContext("2d");

  let currentMode = "game";
  const state = SGZModel.createInitialState();
  const uiLayout = SGZModel.createUiLayout();

  const render = () => SGZRenderer.render(ctx, canvas, state, uiLayout);
  const controller = SGZController.createController({
    screens,
    canvas,
    state,
    uiLayout,
    render,
    isEnabled: () => currentMode === "game",
    onBackToSelection: onExit,
  });

  controller.bindEvents();
  controller.resizeCanvas();
  controller.startOpeningSequence();

  return {
    stop() {
      currentMode = "selection";
      controller.stop();
      controller.unbindEvents();
    },
  };
}
