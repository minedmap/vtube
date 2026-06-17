// ── Voice Changer ──
(function(){
  const micBtn = document.getElementById('micBtn');
  const voiceSel = document.getElementById('voiceSel');
  const waveCanvas = document.getElementById('waveCanvas');
  const volSlider = document.getElementById('volSlider');
  const volLabel = document.getElementById('volLabel');
  let audioCtx, source, processor, stream, gainNode, analyser;
  let micOn = false;
  let waveAnimId = null;
  // 20 female voice presets (pitch shift semitones)
  const VOICES = [];
  for (let i = 0; i < 20; i++) {
    const pitch = 8 + i * 0.316; // 8.0 ~ 14.0 semitones
    VOICES.push({ label: `여음${i+1}`, pitch });
  }
  VOICES.forEach((v,i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = v.label;
    voiceSel.appendChild(opt);
  });
  let currentVoice = 0;
  voiceSel.addEventListener('change', () => {
    currentVoice = parseInt(voiceSel.value);
    if (micOn) updatePitch();
  });
  function updatePitch() {
    const v = VOICES[currentVoice];
    const ratio = Math.pow(2, v.pitch / 12);
    if (processor) {
      processor._pitchRatio = ratio;
      processor._writePos = 0;
      processor._readPos = 0;
    }
  }
  // ── Waveform render ──
  function drawWave() {
    if (!micOn || !analyser) { waveAnimId = null; return; }
    const w = waveCanvas.width, h = waveCanvas.height;
    const ctx = waveCanvas.getContext('2d');
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    // draw level bar (left side)
    const rms = data.reduce((s,v) => s + (v-128)*(v-128), 0) / data.length;
    const level = Math.min(1, Math.sqrt(rms) / 60);
    const barW = 4;
    ctx.fillStyle = level > 0.5 ? '#f44' : '#4a6cf7';
    ctx.fillRect(2, h - level * (h-4), barW, level * (h-4));
    // draw waveform line (right side)
    const step = Math.max(1, Math.floor(data.length / (w - barW - 4)));
    ctx.strokeStyle = '#8af';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = barW + 4, i = 0; i < w - barW - 4; i++) {
      const idx = Math.min(i * step, data.length - 1);
      const y = mid + ((data[idx] - 128) / 128) * (mid - 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x++;
    }
    ctx.stroke();
    waveAnimId = requestAnimationFrame(drawWave);
  }
  // ── Volume slider ──
  volSlider.addEventListener('input', () => {
    if (gainNode) gainNode.gain.value = parseInt(volSlider.value) / 100;
  });
  micBtn.addEventListener('click', async () => {
    if (micOn) {
      // turn off
      if (waveAnimId) { cancelAnimationFrame(waveAnimId); waveAnimId = null; }
      if (processor) { processor.disconnect(); processor = null; }
      if (analyser) { analyser.disconnect(); analyser = null; }
      if (gainNode) { gainNode.disconnect(); gainNode = null; }
      if (source) { source.disconnect(); source = null; }
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      if (audioCtx) { audioCtx.close(); audioCtx = null; }
      micOn = false;
      micBtn.style.background = '#555';
      micBtn.style.color = '#aaa';
      voiceSel.style.display = 'none';
      waveCanvas.style.display = 'none';
      volSlider.style.display = 'none';
      volLabel.style.display = 'none';
      window._setStatus('MIC 꺼짐');
    } else {
      // turn on
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        source = audioCtx.createMediaStreamSource(stream);
        // gain node for volume control
        gainNode = audioCtx.createGain();
        gainNode.gain.value = parseInt(volSlider.value) / 100;
        // analyser node for waveform
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        const bufferSize = 4096;
        processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
        processor._pitchRatio = Math.pow(2, VOICES[0].pitch / 12);
        processor._buffer = new Float32Array(bufferSize * 4);
        processor._writePos = 0;
        processor._readPos = 0;
        processor.onaudioprocess = function(e) {
          const input = e.inputBuffer.getChannelData(0);
          const output = e.outputBuffer.getChannelData(0);
          const ratio = this._pitchRatio;
          const buf = this._buffer;
          const bufLen = buf.length;
          let wp = this._writePos;
          let rp = this._readPos;
          for (let i = 0; i < input.length; i++) {
            buf[wp % bufLen] = input[i];
            wp++;
          }
          this._writePos = wp;
          for (let i = 0; i < output.length; i++) {
            let idx = rp;
            const frac = idx - Math.floor(idx);
            const i0 = Math.floor(idx) % bufLen;
            const i1 = (i0 + 1) % bufLen;
            output[i] = buf[i0] + (buf[i1] - buf[i0]) * frac;
            rp += ratio;
          }
          this._readPos = rp;
        };
        // chain: source -> gain -> analyser -> processor -> destination
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(processor);
        processor.connect(audioCtx.destination);
        micOn = true;
        micBtn.style.background = '#4a6cf7';
        micBtn.style.color = '#fff';
        voiceSel.style.display = '';
        waveCanvas.style.display = '';
        volSlider.style.display = '';
        volLabel.style.display = '';
        drawWave();
        window._setStatus('MIC 켜짐 - ' + VOICES[currentVoice].label);
      } catch(err) {
        window._setError('MIC: ' + err.message);
      }
    }
  });
})();
