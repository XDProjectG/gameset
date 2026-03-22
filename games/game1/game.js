(() => {
  const screens = {
    selection: document.getElementById("game-select-screen"),
    map: document.getElementById("map-screen"),
  };
  const launchGameButton = document.getElementById("launch-game");
  const canvas = document.getElementById("world-canvas");
  const ctx = canvas.getContext("2d");

  let currentMode = "selection";
  const state = window.SGZModel.createInitialState();
  const uiLayout = window.SGZModel.createUiLayout();

  const render = () => window.SGZRenderer.render(ctx, canvas, state, uiLayout);
  const controller = window.SGZController.createController({
    screens,
    canvas,
    state,
    uiLayout,
    render,
    isEnabled: () => currentMode === "game",
  });

  function showSelection() {
    currentMode = "selection";
    controller.stop();
    controller.showDomScreen("selection");
  }

  function startGame() {
    currentMode = "game";
    controller.resizeCanvas();
    controller.startOpeningSequence();
  }

  launchGameButton.addEventListener("click", startGame);

  controller.bindEvents();
  controller.resizeCanvas();
  showSelection();
})();
