// RVC 서버 모드 — WebSocket으로 Python RVC 서버와 통신
// no ONNX in browser, no 294MB download

let rvc = {
  ws: null,
  enabled: false,
  loading: false,
  ready: false,
  outputBuf: new Float32Array(0),
  outPos: 0,
  outLen: 0,
  reconnectTimer: null,
  chunkSize: 3840, // 80ms @48k
}

const RVC_WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') +
  location.host + '/ws/rvc'

async function rvcInit() {
  if (rvc.loading || rvc.ready) return
  rvc.loading = true
  updateRvcStatus('연결중...')

  try {
    rvc.ws = new WebSocket(RVC_WS_URL)
    rvc.ws.binaryType = 'arraybuffer'

    rvc.ws.onopen = () => {
      rvc.ready = true
      rvc.loading = false
      updateRvcStatus('RVC ✅')
      console.log('[RVC] ws connected')
    }

    rvc.ws.onmessage = (e) => {
      // Received processed audio
      const data = new Float32Array(e.data)
      rvc.outputBuf = data
      rvc.outLen = data.length
      rvc.outPos = 0
    }

    rvc.ws.onerror = (e) => {
      console.error('[RVC] ws error', e)
      rvc.ready = false
      rvc.loading = false
      updateRvcStatus('RVC 오류')
    }

    rvc.ws.onclose = () => {
      console.log('[RVC] ws closed')
      rvc.ready = false
      rvc.loading = false
      if (rvc.enabled) {
        updateRvcStatus('재연결...')
        setTimeout(rvcInit, 3000)
      }
    }
  } catch(e) {
    rvc.loading = false
    updateRvcStatus('RVC 오류')
    console.error('[RVC] init fail:', e)
  }
}

// Send audio chunk to server
function rvcFeedChunk(chunk48k) {
  if (!rvc.enabled || !rvc.ready || !rvc.ws || rvc.ws.readyState !== WebSocket.OPEN) return
  // WebSocket message is self-framed — send copy of float32 bytes
  rvc.ws.send(chunk48k.slice().buffer)
}

// Read processed audio (called from ScriptProcessor)
function rvcReadOutput(outBuf) {
  if (!rvc.enabled || !rvc.ready || rvc.outLen === 0) return false
  const copyLen = Math.min(outBuf.length, rvc.outLen - rvc.outPos)
  if (copyLen <= 0) return false
  for (let i = 0; i < copyLen; i++)
    outBuf[i] = rvc.outputBuf[rvc.outPos + i]
  rvc.outPos += copyLen
  return true
}

// Toggle RVC on/off
async function toggleRVC() {
  if (!rvc.ready && !rvc.loading) await rvcInit()

  rvc.enabled = !rvc.enabled
  window._rvcMode = rvc.enabled

  const btn = document.getElementById('rvcBtn')
  if (btn) {
    btn.textContent = rvc.enabled ? 'RVC' : '피치'
    btn.style.background = rvc.enabled ? '#4a6cf7' : '#555'
  }

  if (rvc.enabled && !rvc.ready) {
    // Wait a bit for connection
    setTimeout(() => {
      if (!rvc.ready) updateRvcStatus('RVC 연결실패')
    }, 5000)
  }
}

function updateRvcStatus(msg) {
  const el = document.getElementById('rvcStatus')
  if (el) el.textContent = msg
}

window.rvcInit = rvcInit
window.toggleRVC = toggleRVC
window.rvcFeedChunk = rvcFeedChunk
window.rvcReadOutput = rvcReadOutput
