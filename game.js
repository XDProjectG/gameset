const screens = {
  opening: document.getElementById("opening-screen"),
  title: document.getElementById("title-screen"),
  map: document.getElementById("map-screen"),
};

const canvas = document.getElementById("world-canvas");
const ctx = canvas.getContext("2d");

const openingContinue = document.getElementById("opening-continue");
const menuMessage = document.getElementById("menu-message");
const menuButtons = document.querySelectorAll(".menu button");
const settingsDialog = document.getElementById("settings-dialog");
const nextSeasonBtn = document.getElementById("next-season");
const saveBtn = document.getElementById("save-game");
const backTitleBtn = document.getElementById("back-title");

const cityName = document.getElementById("city-name");
const cityOverview = document.getElementById("city-overview");
const cityActivities = document.getElementById("city-activities");
const officeList = document.getElementById("office-list");
const gameDate = document.getElementById("game-date");

const taxRate = document.getElementById("tax-rate");
const lawLevel = document.getElementById("law-level");
const recruitBtn = document.getElementById("recruit-btn");
const trainBtn = document.getElementById("train-btn");

const officers = ["諸葛亮", "荀彧", "周瑜", "陳群", "法正", "魯肅"];
const seasonNames = ["春", "夏", "秋", "冬"];

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

let state = {
  year: 196,
  season: 0,
  selectedCityId: null,
  settings: { volume: 60, scale: 100 },
  cities: [],
};

function switchScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove("active"));
  screens[name].classList.add("active");
  if (name === "map") renderMapCanvas();
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

function formatDate() {
  return `建安${state.year - 195}年（${state.year}年）${seasonNames[state.season]}`;
}

function cropMultiplier(city) {
  const seasonal = [1.1, 1.25, 1.35, 0.75][state.season];
  const geoBonus = city.geo === "盆地" ? 1.15 : city.geo.includes("江") ? 1.1 : city.geo === "山地" ? 0.85 : 1;
  return seasonal * geoBonus;
}

function selectedCity() {
  return state.cities.find((city) => city.id === state.selectedCityId) || null;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderMapCanvas();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#2f4d36");
  gradient.addColorStop(0.45, "#496447");
  gradient.addColorStop(1, "#2f5063");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(220,240,255,0.08)";
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, (canvas.height / 8) * i + 30);
    ctx.bezierCurveTo(canvas.width * 0.3, (canvas.height / 8) * i, canvas.width * 0.7, (canvas.height / 8) * i + 50, canvas.width, (canvas.height / 8) * i + 20);
    ctx.stroke();
  }
}

function cityToPixel(city) {
  return { x: city.x * canvas.width, y: city.y * canvas.height };
}

function renderMapCanvas() {
  if (!screens.map.classList.contains("active")) return;

  drawBackground();

  passes.forEach((pass) => {
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
    const { x, y } = cityToPixel(city);
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
  });
}

function renderCityInfo(city) {
  if (!city) {
    cityName.textContent = "請點擊城池";
    cityOverview.innerHTML = "";
    cityActivities.innerHTML = "";
    officeList.innerHTML = "";
    return;
  }

  cityName.textContent = `${city.name}｜太守：${city.ruler}`;
  cityOverview.innerHTML = [
    `人口：${city.pop.toLocaleString()}`,
    `錢：${city.money.toLocaleString()}`,
    `糧：${city.grain.toLocaleString()}`,
    `士兵：${city.soldiers.toLocaleString()}`,
    `士：${Math.round(city.workforce.scholar * 100)}% 農：${Math.round(city.workforce.farmer * 100)}%`,
    `工：${Math.round(city.workforce.artisan * 100)}% 商：${Math.round(city.workforce.merchant * 100)}%`,
    `文教風氣：${city.literacy}`,
    `戰備：${city.preparedness}`,
  ].map((row) => `<div>${row}</div>`).join("");

  cityActivities.innerHTML = "";
  [
    `文人活動：書院講學、說書與政令宣導，季增文教 ${Math.max(1, Math.round(city.workforce.scholar * 10))}。`,
    `農業活動：${city.geo}地形，以${city.crop}為主，本季生產係數 ${cropMultiplier(city).toFixed(2)}。`,
    `工業活動：採礦伐木，季增工值 ${Math.round(city.pop * city.workforce.artisan * 0.01).toLocaleString()}。`,
    `商業活動：市集轉賣糧食、書籍、器具，稅率 ${city.tax}% 影響商稅。`,
  ].forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    cityActivities.appendChild(li);
  });

  officeList.innerHTML = city.offices
    .map((office) => `<div>${office.role}（${office.duty}）：${office.assigned}</div>`)
    .join("");

  taxRate.value = city.tax;
  lawLevel.value = city.law;
}

function applyCityPolicy(update) {
  const city = selectedCity();
  if (!city) return;
  Object.assign(city, update);
  renderCityInfo(city);
}

function progressSeason() {
  state.cities = state.cities.map((city) => {
    const farmerPop = city.pop * city.workforce.farmer;
    const grainGain = Math.round((farmerPop / 10) * cropMultiplier(city));
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

  gameDate.textContent = formatDate();
  renderCityInfo(selectedCity());
  renderMapCanvas();
}

function saveGame() {
  localStorage.setItem("sgz-proto-save", JSON.stringify(state));
  menuMessage.textContent = "已儲存目前進度。";
}

function loadGame() {
  const raw = localStorage.getItem("sgz-proto-save");
  if (!raw) {
    menuMessage.textContent = "目前沒有存檔。";
    return false;
  }

  state = JSON.parse(raw);
  gameDate.textContent = formatDate();
  renderCityInfo(selectedCity());
  renderMapCanvas();
  return true;
}

function startNewGame() {
  state = {
    year: 196,
    season: 0,
    selectedCityId: "luoyang",
    settings: state.settings,
    cities: deepCloneSeed(),
  };
  gameDate.textContent = formatDate();
  renderCityInfo(selectedCity());
  switchScreen("map");
}

canvas.addEventListener("click", (event) => {
  if (!screens.map.classList.contains("active")) return;
  const rect = canvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;

  let nearest = null;
  let nearestDistance = Infinity;

  state.cities.forEach((city) => {
    const { x, y } = cityToPixel(city);
    const distance = Math.hypot(clickX - x, clickY - y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = city;
    }
  });

  if (nearest && nearestDistance <= 20) {
    state.selectedCityId = nearest.id;
    renderCityInfo(nearest);
    renderMapCanvas();
  }
});

openingContinue.addEventListener("click", () => switchScreen("title"));

menuButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "new") {
      menuMessage.textContent = "";
      startNewGame();
    }
    if (action === "load" && loadGame()) {
      switchScreen("map");
    }
    if (action === "settings") {
      settingsDialog.showModal();
    }
  });
});

nextSeasonBtn.addEventListener("click", progressSeason);
saveBtn.addEventListener("click", saveGame);
backTitleBtn.addEventListener("click", () => switchScreen("title"));

taxRate.addEventListener("input", () => applyCityPolicy({ tax: Number(taxRate.value) }));
lawLevel.addEventListener("input", () => applyCityPolicy({ law: Number(lawLevel.value) }));

recruitBtn.addEventListener("click", () => {
  const city = selectedCity();
  if (!city || city.money < 3000 || city.pop < 550000) return;
  applyCityPolicy({ soldiers: city.soldiers + 500, money: city.money - 3000, pop: city.pop - 500 });
  renderMapCanvas();
});

trainBtn.addEventListener("click", () => {
  const city = selectedCity();
  if (!city || city.grain < 1800) return;
  applyCityPolicy({ preparedness: Math.min(100, city.preparedness + 8), grain: city.grain - 1800 });
});

settingsDialog.addEventListener("close", () => {
  state.settings = {
    volume: Number(document.getElementById("volume").value),
    scale: Number(document.getElementById("scale").value),
  };
  document.body.style.zoom = `${state.settings.scale}%`;
});

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
switchScreen("opening");
