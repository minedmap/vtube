// RVC-Web 메인 로더 — ONNX Runtime Web (WebGPU)
// 실행: rvcWebInit() 후 AudioWorklet 연결 + 토글 버튼

const RVC_MODEL_BASE = '/rvc-models/'
const RVC_MODELS = {
  contentvec: 'contentvec_768l12_q8.onnx',  // 91MB
  rmvpe: 'rmvpe_q8.onnx',                   // 95MB
  synthesizer: 'IU-Zonas.onnx'              // 53MB (변환 필요: .pth → .onnx)
}

let rvcOrtSession = null
let rvcEnabled = false
let rvcAudioWorklet = null
let rvcAudioNode = null

async function rvcWebInit() {
  if (typeof ort === 'undefined') {
    await loadONNXRuntimeWeb()
  }

  // WebGPU 지원 확인
  const ep = await checkWebGPU() ? 'webgpu' : 'wasm'
  console.log(`[RVC-Web] backend: ${ep}`)

  // 모델 로딩 상태 표시
  showRVCLoading()

  // 3개 모델 로드 (병렬)
  const [contentvec, rmvpe, synth] = await Promise.all([
    loadONNX(`${RVC_MODEL_BASE}${RVC_MODELS.contentvec}`, ep),
    loadONNX(`${RVC_MODEL_BASE}${RVC_MODELS.rmvpe}`, ep),
    loadONNX(`${RVC_MODEL_BASE}${RVC_MODELS.synthesizer}`, ep),
  ])

  rvcOrtSession = { contentvec, rmvpe, synth }

  // AudioWorklet 등록
  await setupRVCAudioWorklet()

  hideRVCLoading()
  console.log('[RVC-Web] ready')
}

async function loadONNXRuntimeWeb() {
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21/dist/ort.min.js'
    s.onload = res
    s.onerror = rej
    document.head.appendChild(s)
  })
}

async function checkWebGPU() {
  if (!navigator.gpu) return false
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return !!adapter
  } catch { return false }
}

async function loadONNX(url, ep) {
  const resp = await fetch(url)
  const blob = await resp.arrayBuffer()
  return await ort.InferenceSession.create(blob, {
    executionProviders: [ep, 'wasm'],
    graphOptimizationLevel: 'all'
  })
}

async function setupRVCAudioWorklet() {
  const ctx = audioCtx || (window.audioCtx = new AudioContext())
  await ctx.audioWorklet.addModule('/rvc-web.js')
  rvcAudioNode = new AudioWorkletNode(ctx, 'rvc-web-processor')
  rvcAudioNode.port.onmessage = handleRVCResult
}

function handleRVCResult(e) {
  if (e.data.type === 'audio') {
    runRVCInference(e.data.data)
  }
}

async function runRVCInference(inputAudio) {
  if (!rvcOrtSession) return

  // 1. ContentVec 특징 추출
  const cvInput = reshapeInput(inputAudio, 1, 768) // dummy shape
  const cvFeat = await rvcOrtSession.contentvec.run({ input: cvInput })
  
  // 2. RMVPE 피치 추출
  const f0 = await rvcOrtSession.rmvpe.run({ audio: inputAudio })

  // 3. Synthesizer 변환
  const result = await rvcOrtSession.synth.run({
    features: cvFeat.output,
    pitch: f0.f0
  })

  // 변환된 오디오를 출력 버퍼에 추가
  writeRvcOutput(result.audio)
}

// UI
function showRVCLoading() {
  const el = document.getElementById('rvc-status')
  if (el) el.textContent = 'RVC 모델 로딩중...'
}

function hideRVCLoading() {
  const el = document.getElementById('rvc-status')
  if (el) el.textContent = 'RVC ✅'
}

function reshapeInput(arr, ...dims) {
  return new ort.Tensor('float32', arr, dims)
}

// RVC on/off 토글 (기존 vtube 오디오 체인에 삽입)
function toggleRVC() {
  rvcEnabled = !rvcEnabled
  const btn = document.getElementById('rvc-toggle')
  btn.textContent = rvcEnabled ? 'RVC ON' : 'RVC OFF'
  btn.className = rvcEnabled ? 'btn-on' : 'btn-off'

  if (rvcEnabled && rvcAudioNode) {
    // 기존 gain 체인 → rvcAudioNode → destination
    microphoneSource.disconnect()
    microphoneSource.connect(rvcAudioNode)
    rvcAudioNode.connect(gainNode)
  } else {
    microphoneSource.disconnect()
    microphoneSource.connect(gainNode)
  }
}

function writeRvcOutput(audioData) {
  // output 버퍼에 기록 (기존 피치변조 다음 단계)
  if (!window.rvcOutputBuffer) {
    window.rvcOutputBuffer = new Float32Array(24000) // 1초 버퍼
    window.rvcOutputPos = 0
  }
  const buf = window.rvcOutputBuffer
  let pos = window.rvcOutputPos
  for (let i = 0; i < audioData.length && pos < buf.length; i++, pos++)
    buf[pos] = audioData[i]
  window.rvcOutputPos = pos
}

// 초기화 (모델 있는 경우만)
window.rvcWebInit = rvcWebInit
window.toggleRVC = toggleRVC
