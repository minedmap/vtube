// RVC-Web: ONNX Runtime Web (WebGPU) 실시간 음성 변환
// 설치 없음. 모델 1회 다운로드 (384MB)
// 기존 오디오 체인에 rvc-on/rvc-off 토글

class RVCWebProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(0)
    this.sampleRate = 24000
    this.chunkSize = 1920 // 80ms @24k
    this.processing = false
    this.port.onmessage = this.onMessage.bind(this)
  }

  onMessage(e) {
    if (e.data.type === 'model-ready') this.processing = true
    if (e.data.type === 'model-unload') this.processing = false
  }

  process(inputs, outputs) {
    if (!this.processing) return true
    const input = inputs[0]
    if (!input || !input[0]) return true

    const samples = input[0]
    this.buffer = concatFloat32(this.buffer, new Float32Array(samples))

    if (this.buffer.length >= this.chunkSize) {
      const chunk = this.buffer.slice(0, this.chunkSize)
      this.buffer = this.buffer.slice(this.chunkSize)
      this.port.postMessage({ type: 'audio', data: chunk.buffer }, [chunk.buffer])
    }

    return true
  }
}

function concatFloat32(a, b) {
  const r = new Float32Array(a.length + b.length)
  r.set(a); r.set(b, a.length)
  return r
}

registerProcessor('rvc-web-processor', RVCWebProcessor)
