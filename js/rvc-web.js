// RVC — WebSocket + 2s chunk accumulation
const RVC_SR = 48000
const CHUNK_SEC = 2
const CHUNK_SAMPLES = RVC_SR * CHUNK_SEC // 96000

let rvc = {
  ws: null,
  enabled: false,
  loading: false,
  ready: false,
  accumBuf: new Float32Array(CHUNK_SAMPLES),
  accumPos: 0,
  pending: false,
  outputBuf: new Float32Array(CHUNK_SAMPLES * 2),
  outputRd: 0,
  outputWr: 0,
  outputMask: CHUNK_SAMPLES * 2 - 1,
  reconnectTimer: null,
  audioSr: RVC_SR,
  // settings
  settings: {
    pitch: 0,
    sampleLen: 3840,
    fadeLen: 256,
    responseThreshold: 0.01,
    indexRate: 0.5,
    extraTime: 0,
    inputNR: true,
    outputNR: true,
  },
}

const RVC_WS_URL = 'ws://' + location.hostname + '/ws/rvc'

async function rvcInit() {
  if (rvc.loading || rvc.ready) return
  rvc.loading = true
  updateRvcStatus('연결중...')

  // Detect actual audio sample rate
  if (window.__audioCtx) {
    rvc.audioSr = window.__audioCtx.sampleRate || RVC_SR
  }

  try {
    rvc.ws = new WebSocket(RVC_WS_URL)
    rvc.ws.binaryType = 'arraybuffer'

    rvc.ws.onopen = () => {
      rvc.ready = true
      rvc.loading = false
      rvc.ws.send(JSON.stringify({ type: 'config', ...rvc.settings }))
      // Flush accumulated buffer if any
      if (rvc.accumPos >= CHUNK_SAMPLES) {
        rvc.pending = true
        rvc.ws.send(rvc.accumBuf.slice().buffer)
        rvc.accumPos = 0
      }
      updateRvcStatus('RVC ✅')
      console.log('[RVC] connected')
    }

    rvc.ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        console.log('[RVC] server:', e.data)
        return
      }
      const data = new Float32Array(e.data)
      // Write to ring buffer
      for (let i = 0; i < data.length; i++) {
        rvc.outputBuf[rvc.outputWr] = data[i]
        rvc.outputWr = (rvc.outputWr + 1) & rvc.outputMask
      }
      rvc.pending = false
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

function rvcFeedChunk(chunk) {
  if (!rvc.enabled || !rvc.ws) return

  // Resample to 48kHz if needed
  if (rvc.audioSr !== RVC_SR) {
    const ratio = rvc.audioSr / RVC_SR
    const outLen = Math.round(chunk.length * ratio)
    const r = new Float32Array(outLen)
    for (let i = 0; i < outLen; i++) {
      const si = i / ratio
      const i0 = Math.floor(si), i1 = Math.min(i0+1, chunk.length-1)
      r[i] = chunk[i0] + (chunk[i1]-chunk[i0]) * (si-i0)
    }
    chunk = r
  }

  // Accumulate even before ready (connection in progress)
  const copyLen = Math.min(chunk.length, CHUNK_SAMPLES - rvc.accumPos)
  rvc.accumBuf.set(chunk.subarray(0, copyLen), rvc.accumPos)
  rvc.accumPos += copyLen

  // Send full chunk + no pending + ws open
  if (rvc.accumPos >= CHUNK_SAMPLES) {
    if (!rvc.pending && rvc.ws.readyState === WebSocket.OPEN) {
      rvc.pending = true
      rvc.ws.send(rvc.accumBuf.slice().buffer)
      rvc.accumPos = 0
    } else {
      // Can't send yet — reset to avoid stuck buffer
      rvc.accumPos = 0
    }
  }
}

function rvcReadOutput(outBuf) {
  if (!rvc.enabled || !rvc.ready || rvc.outputRd === rvc.outputWr) return false
  const avail = (rvc.outputWr - rvc.outputRd) & rvc.outputMask
  const copyLen = Math.min(outBuf.length, avail)
  if (copyLen <= 0) return false
  for (let i = 0; i < copyLen; i++) {
    outBuf[i] = rvc.outputBuf[rvc.outputRd]
    rvc.outputRd = (rvc.outputRd + 1) & rvc.outputMask
  }
  return true
}

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
    setTimeout(() => {
      if (!rvc.ready) updateRvcStatus('RVC 연결실패')
    }, 5000)
  }
  const panel = document.getElementById('rvcSettings')
  if (panel) panel.style.display = rvc.enabled && rvc.ready ? 'flex' : 'none'
  // Reset accum on toggle
  rvc.accumPos = 0
}

function updateRvcStatus(msg) {
  const el = document.getElementById('rvcStatus')
  if (el) el.textContent = msg
}

function rvcSendSetting(key, val) {
  rvc.settings[key] = val
  if (rvc.ws && rvc.ws.readyState === WebSocket.OPEN)
    rvc.ws.send(JSON.stringify({ type: 'config', ...rvc.settings }))
}

window.rvcInit = rvcInit
window.toggleRVC = toggleRVC
window.rvcFeedChunk = rvcFeedChunk
window.rvcReadOutput = rvcReadOutput
window.rvcSendSetting = rvcSendSetting
