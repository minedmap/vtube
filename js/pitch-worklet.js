// WSOLA pitch shifter AudioWorklet — crossfade at wrap point
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

    // SOLA-style write: overwrite at wp, overlap-add at wp+inCh.length
    let wp = this._wp;
    for (let i = 0; i < inCh.length; i++) {
      const p = (wp + i) & mask;
      buf[p] = gated ? 0 : (buf[p] * 0.3 + inCh[i] * 0.7);
    }
    wp += inCh.length;

    // WSOLA read with crossfade at wrap
    let rp = this._rp;
    let crossfading = false;
    for (let i = 0; i < outCh.length; i++) {
      let fi = Math.floor(rp);
      let i0 = fi & mask;
      let i1 = (i0 + 1) & mask;
      let frac = rp - fi;
      let s = buf[i0] + (buf[i1] - buf[i0]) * frac;

      // Crossfade when read catches up to write
      const wrapDist = wp - rp;
      if (wrapDist >= 0 && wrapDist < fadeLen) {
        crossfading = true;
        const gain = wrapDist / fadeLen;
        const rp2 = rp - (bLen / 2);
        fi = Math.floor(rp2);
        i0 = fi & mask;
        i1 = (i0 + 1) & mask;
        frac = rp2 - fi;
        const s2 = buf[i0] + (buf[i1] - buf[i0]) * frac;
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
