// Passthrough only — zero processing
class PitchProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;
    const inCh = input[0];
    const outCh = output[0];
    for (let i = 0; i < outCh.length; i++) outCh[i] = inCh[i];
    return true;
  }
}
registerProcessor('pitch-processor', PitchProcessor);
