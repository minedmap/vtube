// WSOLA pitch shifter AudioWorklet
class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(32768);
    this._wp = 0;
    this._rp = 0;
    this._ratio = 1;
    this._gate = 0.02;
    this._fadeLen = 512;
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
    const fadeLen = this._fadeLen;

    // Noise gate
    let sumSq = 0;
    for (let i = 0; i < inCh.length; i++) sumSq += inCh[i] * inCh[i];
    const gated = Math.sqrt(sumSq / inCh.length) < gateT;

    // Write to ring buffer
    let wp = this._wp;
    const halfW = fadeLen;
    for (let i = 0; i < inCh.length; i++) {
      const p = (wp + i) & mask;
      const v = gated ? 0 : inCh[i];
      const overlap = (i < halfW) ? buf[p] * (1 - i/halfW) + v * (i/halfW) : v;
      buf[p] = overlap;
    }
    wp += inCh.length;

    // Read with crossfade
    let rp = this._rp;
    for (let i = 0; i < outCh.length; i++) {
      const fi = Math.floor(rp);
      const i0 = fi & mask;
      const i1 = (i0 + 1) & mask;
      const frac = rp - fi;
      let s = buf[i0] + (buf[i1] - buf[i0]) * frac;

      // Crossfade when read approaches write
      const gap = wp - rp;
      if (gap >= 0 && gap < fadeLen) {
        const gain = gap / fadeLen;
        const rp2 = rp + bLen / 2;
        const fi2 = Math.floor(rp2);
        const j0 = fi2 & mask;
        const j1 = (j0 + 1) & mask;
        const frac2 = rp2 - fi2;
        const s2 = buf[j0] + (buf[j1] - buf[j0]) * frac2;
        s = s * gain + s2 * (1 - gain);
      }

      outCh[i] = Math.tanh(s * 0.7);
      rp += ratio;
    }

    this._wp = wp;
    this._rp = rp;
    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
