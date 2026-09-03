import knowledgeGraphSrc from './assets/general/CCSS 2.MD.C.8 Knowledge Graph.png'

const MIN_SCALE = 1
const MAX_SCALE = 8

const viewport = document.getElementById('viewport')
const image = document.getElementById('knowledge-graph')
image.src = knowledgeGraphSrc

let scale = 1
let translateX = 0
let translateY = 0

function applyTransform() {
  image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
}

function clampScale(value) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

viewport.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()

    const rect = viewport.getBoundingClientRect()
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top

    const newScale = clampScale(scale * Math.pow(1.0015, -event.deltaY))

    // Keep the point under the cursor fixed on screen while zooming.
    translateX = cursorX - ((cursorX - translateX) * newScale) / scale
    translateY = cursorY - ((cursorY - translateY) * newScale) / scale
    scale = newScale

    applyTransform()
  },
  { passive: false },
)

let isPanning = false
let lastX = 0
let lastY = 0

viewport.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return
  isPanning = true
  lastX = event.clientX
  lastY = event.clientY
  viewport.classList.add('dragging')
})

window.addEventListener('mousemove', (event) => {
  if (!isPanning) return
  translateX += event.clientX - lastX
  translateY += event.clientY - lastY
  lastX = event.clientX
  lastY = event.clientY
  applyTransform()
})

window.addEventListener('mouseup', () => {
  isPanning = false
  viewport.classList.remove('dragging')
})
