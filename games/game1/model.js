(() => {
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

  window.SGZModel = {
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
})();
