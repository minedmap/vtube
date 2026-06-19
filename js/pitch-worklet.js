// Pitch shift AudioWorklet — no glitches, real-time thread
class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(16384);
    this._wp = 0;
    this._rp = 0;
    this._ratio = 1;
    this._gate = 0.02;
    this.port.onmessage = (e) => {
      if (e.data.type === 'pitch') this._ratio = Math.pow(2, e.data.value / 12);
      if (e.data.type === 'gate') this._gate = e.data.value;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const inCh = input[0];
    const outCh = output[0];
    const buf = this._buf;
    const bLen = buf.length;
    const mask = bLen - 1;
    const ratio = this._ratio;
    const gateT = this._gate;

    // Noise gate
    let sumSq = 0;
    for (let i = 0; i < inCh.length; i++) sumSq += inCh[i] * inCh[i];
    const rms = Math.sqrt(sumSq / inCh.length);
    const gated = rms < gateT;

    // Write to ring buffer (overwrite)
    let wp = this._wp;
    for (let i = 0; i < inCh.length; i++) {
      buf[wp & mask] = gated ? 0 : inCh[i];
      wp++;
    }

    // Read with linear interpolation
    let rp = this._rp;
    // Keep read behind write
    if (rp > wp - inCh.length) rp = wp - bLen / 2;

    for (let i = 0; i < outCh.length; i++) {
      const fi = Math.floor(rp);
      const i0 = fi & mask;
      const i1 = (i0 + 1) & mask;
      const frac = rp - fi;
      const s = buf[i0] + (buf[i1] - buf[i0]) * frac;
      outCh[i] = Math.tanh(s * 0.8);
      rp += ratio;
    }

    this._wp = wp;
    this._rp = rp;
    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
