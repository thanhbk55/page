// gesture-slide.js

(() => {
  const EXISTING = window.__gestureSlideController

  if (EXISTING?.stop) {
    EXISTING.stop()
  }
})()

const CONFIG = {
  mediapipeVersion: "0.10.22",

  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",

  wasmBaseUrl:
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm",

  // Camera preview
  previewWidth: 180,

  // Detect only every N ms to reduce CPU.
  detectIntervalMs: 80,

  // Swipe detection window.
  historyMs: 650,

  // Prevent multiple slide jumps.
  cooldownMs: 1400,

  // Minimum horizontal movement.
  minSwipeDx: 0.23,

  // Maximum vertical movement allowed.
  maxSwipeDy: 0.18,

  // Need at least this many samples in history.
  minSamples: 4,

  // If your camera feels reversed, switch this.
  mirrorCamera: true,

  // If slide direction feels reversed, switch this.
  reverseSlideDirection: false,

  debug: false,
}

const state = {
  handLandmarker: null,
  stream: null,
  video: null,
  root: null,
  statusEl: null,
  lastDetectAt: 0,
  lastTriggerAt: 0,
  history: [],
  running: false,
  rafId: null,
}

window.__gestureSlideController = {
  stop,
}

main().catch((error) => {
  console.error("[GestureSlide] Failed to start:", error)
  showFatalError(error)
})

async function main() {
  createUI()
  setStatus("Loading MediaPipe...")

  const visionModule = await import(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CONFIG.mediapipeVersion}`
  )

  const { HandLandmarker, FilesetResolver } = visionModule

  const vision = await FilesetResolver.forVisionTasks(CONFIG.wasmBaseUrl)

  state.handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: CONFIG.modelUrl,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
  })

  setStatus("Opening camera...")

  state.video = createVideo()
  state.stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: "user",
    },
    audio: false,
  })

  state.video.srcObject = state.stream

  await waitForVideoReady(state.video)

  state.running = true
  setStatus("Ready: swipe left/right")

  loop()
}

function createUI() {
  const root = document.createElement("div")
  root.id = "gesture-slide-root"

  Object.assign(root.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    width: `${CONFIG.previewWidth}px`,
    zIndex: "2147483647",
    background: "rgba(20, 20, 20, 0.88)",
    color: "white",
    borderRadius: "12px",
    overflow: "hidden",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  })

  const header = document.createElement("div")
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: "600",
  })

  const title = document.createElement("div")
  title.textContent = "Gesture Slide"

  const stopButton = document.createElement("button")
  stopButton.textContent = "Stop"
  Object.assign(stopButton.style, {
    border: "0",
    borderRadius: "8px",
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: "12px",
  })
  stopButton.onclick = stop

  const status = document.createElement("div")
  Object.assign(status.style, {
    padding: "8px 10px",
    fontSize: "12px",
    lineHeight: "1.4",
    borderTop: "1px solid rgba(255,255,255,0.12)",
  })
  status.textContent = "Starting..."

  header.appendChild(title)
  header.appendChild(stopButton)

  root.appendChild(header)
  root.appendChild(status)

  document.documentElement.appendChild(root)

  state.root = root
  state.statusEl = status
}

function createVideo() {
  const video = document.createElement("video")

  video.autoplay = true
  video.muted = true
  video.playsInline = true

  Object.assign(video.style, {
    display: "block",
    width: "100%",
    height: "auto",
    background: "#111",
    transform: CONFIG.mirrorCamera ? "scaleX(-1)" : "none",
  })

  state.root.insertBefore(video, state.statusEl)

  return video
}

function setStatus(text) {
  if (state.statusEl) {
    state.statusEl.textContent = text
  }

  if (CONFIG.debug) {
    console.log("[GestureSlide]", text)
  }
}

function showFatalError(error) {
  createUI()

  setStatus(
    [
      "Error starting Gesture Slide.",
      "",
      String(error?.message || error),
      "",
      "Possible causes: CSP blocked script, camera permission denied, or MediaPipe CDN blocked.",
    ].join("\n")
  )
}

function waitForVideoReady(video) {
  return new Promise((resolve) => {
    if (video.readyState >= 2) {
      resolve()
      return
    }

    video.onloadeddata = () => resolve()
  })
}

function loop() {
  if (!state.running) return

  const now = performance.now()

  if (now - state.lastDetectAt >= CONFIG.detectIntervalMs) {
    state.lastDetectAt = now
    detectFrame(now)
  }

  state.rafId = requestAnimationFrame(loop)
}

function detectFrame(now) {
  if (!state.handLandmarker || !state.video) return

  const result = state.handLandmarker.detectForVideo(state.video, now)
  const landmarks = result?.landmarks?.[0]

  if (!landmarks) {
    trimHistory(Date.now())
    setStatus("No hand detected")
    return
  }

  const gesture = detectSwipe(landmarks)

  if (gesture) {
    handleGesture(gesture)
  } else {
    setStatus("Hand detected. Swipe left/right.")
  }
}

function detectSwipe(landmarks) {
  const now = Date.now()

  // Landmark 0 = wrist.
  // Landmark 9 = middle finger MCP, often more stable as hand center.
  const wrist = landmarks[0]
  const palm = landmarks[9] || wrist

  const point = {
    x: palm.x,
    y: palm.y,
    t: now,
  }

  state.history.push(point)
  trimHistory(now)

  if (state.history.length < CONFIG.minSamples) return null
  if (now - state.lastTriggerAt < CONFIG.cooldownMs) return null

  const first = state.history[0]
  const last = state.history[state.history.length - 1]

  let dx = last.x - first.x
  const dy = last.y - first.y

  // If camera preview is mirrored, user's visual left/right can feel inverted.
  // This normalizes gesture direction to what user sees.
  if (CONFIG.mirrorCamera) {
    dx = -dx
  }

  if (Math.abs(dx) < CONFIG.minSwipeDx) return null
  if (Math.abs(dy) > CONFIG.maxSwipeDy) return null

  state.lastTriggerAt = now
  state.history = []

  return dx > 0 ? "swipe_right" : "swipe_left"
}

function trimHistory(now) {
  state.history = state.history.filter((p) => now - p.t <= CONFIG.historyMs)
}

function handleGesture(gesture) {
  let effectiveGesture = gesture

  if (CONFIG.reverseSlideDirection) {
    if (gesture === "swipe_right") effectiveGesture = "swipe_left"
    else if (gesture === "swipe_left") effectiveGesture = "swipe_right"
  }

  if (effectiveGesture === "swipe_right") {
    setStatus("Swipe right → Next slide")
    nextSlide()
    flash("Next ▶")
    return
  }

  if (effectiveGesture === "swipe_left") {
    setStatus("Swipe left → Previous slide")
    previousSlide()
    flash("◀ Previous")
    return
  }
}

function nextSlide() {
  pressArrow("right")
}

function previousSlide() {
  pressArrow("left")
}

function pressArrow(direction) {
  const isLeft = direction === "left"
  const key = isLeft ? "ArrowLeft" : "ArrowRight"
  const keyCode = isLeft ? 37 : 39

  const targets = [
    document.activeElement,
    document.body,
    document.documentElement,
    document,
    window,
  ].filter(Boolean)

  for (const target of targets) {
    dispatchKeyboard(target, "keydown", key, keyCode)
    dispatchKeyboard(target, "keyup", key, keyCode)
  }

  // Fallback for pages where synthetic key events do not work well.
  // Try clicking next/previous buttons by accessible labels.
  setTimeout(() => {
    const clicked = clickSlideButton(direction)

    if (clicked && CONFIG.debug) {
      console.log("[GestureSlide] clicked slide button fallback:", direction)
    }
  }, 80)
}

function dispatchKeyboard(target, type, key, keyCode) {
  const event = new KeyboardEvent(type, {
    key,
    code: key,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    composed: true,
  })

  try {
    target.dispatchEvent(event)
  } catch {
    // Some targets such as window/document may behave differently.
  }
}

function clickSlideButton(direction) {
  const labels =
    direction === "right"
      ? [
          "next",
          "next slide",
          "次",
          "次へ",
          "sau",
          "tiếp",
          "tiếp theo",
        ]
      : [
          "previous",
          "previous slide",
          "prev",
          "back",
          "前",
          "戻る",
          "trước",
          "quay lại",
        ]

  const candidates = [
    ...document.querySelectorAll('button, [role="button"], [aria-label], [title]'),
  ]

  const button = candidates.find((el) => {
    const text = [
      el.getAttribute("aria-label"),
      el.getAttribute("title"),
      el.getAttribute("data-tooltip"),
      el.textContent,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return labels.some((label) => text.includes(label.toLowerCase()))
  })

  if (!button) return false

  button.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
    })
  )

  return true
}

function flash(text) {
  const el = document.createElement("div")
  el.textContent = text

  Object.assign(el.style, {
    position: "fixed",
    left: "50%",
    top: "18%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    background: "rgba(0,0,0,0.78)",
    color: "white",
    padding: "14px 20px",
    borderRadius: "999px",
    fontSize: "20px",
    fontWeight: "700",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    pointerEvents: "none",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  })

  document.documentElement.appendChild(el)

  setTimeout(() => {
    el.remove()
  }, 650)
}

function stop() {
  state.running = false

  if (state.rafId) {
    cancelAnimationFrame(state.rafId)
    state.rafId = null
  }

  if (state.stream) {
    for (const track of state.stream.getTracks()) {
      track.stop()
    }

    state.stream = null
  }

  if (state.handLandmarker) {
    try {
      state.handLandmarker.close()
    } catch {
      // ignore
    }

    state.handLandmarker = null
  }

  if (state.root) {
    state.root.remove()
    state.root = null
  }

  state.video = null
  state.statusEl = null
  state.history = []

  delete window.__gestureSlideController
}
