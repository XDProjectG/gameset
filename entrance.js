import { startGame } from './games/game1/game.js'
import { startDemo } from './system/demo.js'

let currentRuntime = null

function initializeEntrance() {
  const screens = {
    selection: document.getElementById("game-select-screen"),
    map: document.getElementById("map-screen"),
  }
  const canvas = document.getElementById("world-canvas")
  const launchGameButton = document.getElementById("launch-game")
  const launchDemoButton = document.getElementById("launch-demo")

  if (!screens.selection || !screens.map || !canvas || !launchGameButton || !launchDemoButton) return

  function showSelection() {
    screens.selection.classList.add("active")
    screens.map.classList.remove("active")

    if (currentRuntime?.stop) {
      currentRuntime.stop()
      currentRuntime = null
    }
  }

  function showMap() {
    screens.selection.classList.remove("active")
    screens.map.classList.add("active")
  }

  function launch(startFn) {
    showMap()
    try {
      currentRuntime = startFn(canvas, showSelection)
    } catch (error) {
      console.error("啟動失敗：", error)
      showSelection()
    }
  }

  launchGameButton.addEventListener("click", () => launch(startGame))
  launchDemoButton.addEventListener("click", () => launch(startDemo))

  showSelection()
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initializeEntrance, { once: true })
} else {
  initializeEntrance()
}
