(() => {
  const screens = {
    selection: document.getElementById("game-select-screen"),
    map: document.getElementById("map-screen"),
  };
  const launchGameButton = document.getElementById("launch-game");
  const launchDemoButton = document.getElementById("launch-demo");
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
    window.DemoSystem?.stop();
    controller.stop();
    controller.showDomScreen("selection");
  }

  function startGame() {
    window.DemoSystem?.stop();
    currentMode = "game";
    controller.resizeCanvas();
    controller.startOpeningSequence();
  }

  function startDemo() {
    controller.stop();
    currentMode = "demo";
    controller.showDomScreen("map");
    window.DemoSystem.start({
      canvas,
      onExit: showSelection,
    });
  }

  launchGameButton.addEventListener("click", startGame);
  launchDemoButton.addEventListener("click", startDemo);

  controller.bindEvents();
  controller.resizeCanvas();
  showSelection();
})();
