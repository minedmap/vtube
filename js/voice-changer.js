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
  let noiseGateOn = true;
  let waveOverlayVisible = true;
  const GATE_THRESHOLD = 0.008;
  // 20 sound presets
  const VOICES = [];
  const pitches = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7];
  for (let i = 0; i < 20; i++) {
    VOICES.push({ label: `sound-${i+1}`, pitch: pitches[i] });
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
    if (!processor) return;
    const v = VOICES[currentVoice];
    processor._pitchRatio = Math.pow(2, v.pitch / 12);
    processor._writePos = 0;
    processor._readPos = 0;
  }

  // ── Waveform overlay canvas ──
  let waveOverlay = document.getElementById('waveOverlay');
  if (!waveOverlay) {
    waveOverlay = document.createElement('canvas');
    waveOverlay.id = 'waveOverlay';
    waveOverlay.style.cssText = 'position:absolute;bottom:0;left:0;width:100%;height:32px;z-index:15;pointer-events:none;display:none';
    document.getElementById('wrap').appendChild(waveOverlay);
  }
  const waveCtx = waveOverlay.getContext('2d');

  function drawWaveform() {
    if (!micOn || !analyser || !waveOverlayVisible) { waveAnimId = null; return; }
    waveOverlay.width = waveOverlay.clientWidth || 400;
    waveOverlay.height = waveOverlay.clientHeight || 32;
    const w = waveOverlay.width, h = waveOverlay.height;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    waveCtx.clearRect(0, 0, w, h);
    const mid = h / 2;

    const rms = data.reduce((s,v) => s + (v-128)*(v-128), 0) / data.length;
    const level = Math.sqrt(rms) / 60;
    if (level < 0.08) { waveAnimId = requestAnimationFrame(drawWaveform); return; }

    waveCtx.strokeStyle = '#8af';
    waveCtx.lineWidth = 2;
    waveCtx.beginPath();
    for (let x = 0; x < w; x++) {
      const idx = (x / w) * (data.length - 1);
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, data.length - 1);
      const frac = idx - i0;
      const v = data[i0] + (data[i1] - data[i0]) * frac;
      const amp = (v - 128) / 128;
      const barH = Math.abs(amp) * (mid - 2);
      const y = mid + (amp >= 0 ? -barH : barH);
      x === 0 ? waveCtx.moveTo(x, y) : waveCtx.lineTo(x, y);
    }
    waveCtx.stroke();
    waveAnimId = requestAnimationFrame(drawWaveform);
  }

  // ── Volume slider ──
  volSlider.addEventListener('input', () => {
    if (gainNode) gainNode.gain.value = parseInt(volSlider.value) / 100;
  });

  // ── Waveform toggle button ──
  let waveBtn = document.getElementById('waveToggleBtn');
  if (!waveBtn) {
    waveBtn = document.createElement('button');
    waveBtn.id = 'waveToggleBtn';
    waveBtn.textContent = '📊';
    waveBtn.style.cssText = 'position:absolute;bottom:64px;right:40px;z-index:20;padding:4px 10px;font:11px sans-serif;background:#4a6cf7;color:#fff;border:none;border-radius:5px;cursor:pointer;display:none';
    waveBtn.title = '파형 표시';
    waveBtn.onclick = function() {
      waveOverlayVisible = !waveOverlayVisible;
      this.style.background = waveOverlayVisible ? '#4a6cf7' : '#555';
      waveOverlay.style.display = waveOverlayVisible ? '' : 'none';
      if (waveOverlayVisible && micOn) drawWaveform();
    };
    document.getElementById('wrap').appendChild(waveBtn);
  }

  // ── Noise gate button ──
  let ngBtn = document.getElementById('noiseGateBtn');
  if (!ngBtn) {
    ngBtn = document.createElement('button');
    ngBtn.id = 'noiseGateBtn';
    ngBtn.textContent = '🔇';
    ngBtn.style.cssText = 'position:absolute;bottom:64px;right:10px;z-index:20;padding:4px 10px;font:11px sans-serif;background:#4a6cf7;color:#fff;border:none;border-radius:5px;cursor:pointer;display:none';
    ngBtn.title = '노이즈 게이트';
    ngBtn.onclick = function() {
      noiseGateOn = !noiseGateOn;
      this.style.background = noiseGateOn ? '#4a6cf7' : '#555';
    };
    document.getElementById('wrap').appendChild(ngBtn);
  }

  // ── RVC button ──
  const rvcBtn = document.getElementById('rvcBtn');
  const rvcSetBtn = document.getElementById('rvcSetBtn');
  const rvcSettingsPanel = document.getElementById('rvcSettings');
  if (rvcBtn && !rvcBtn._bound) {
    rvcBtn._bound = true;
    rvcBtn.onclick = function() {
      if (window.toggleRVC) window.toggleRVC();
    };
  }
  if (rvcSetBtn && !rvcSetBtn._bound) {
    rvcSetBtn._bound = true;
    rvcSetBtn.onclick = function() {
      const p = document.getElementById('rvcSettings');
      if (p) p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
    };
  }

  function applyGate(input) {
    if (!noiseGateOn) return;
    let sumSq = 0;
    for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i];
    if (Math.sqrt(sumSq / input.length) < GATE_THRESHOLD) {
      input.fill(0);
    }
  }

  micBtn.addEventListener('click', async () => {
    if (micOn) {
      if (waveAnimId) { cancelAnimationFrame(waveAnimId); waveAnimId = null; }
      navigator.mediaDevices.removeEventListener('devicechange', _applySink);
      if (processor) { processor.disconnect(); processor = null; }
      if (analyser) { analyser.disconnect(); analyser = null; }
      if (gainNode) { gainNode.disconnect(); gainNode = null; }
      if (source) { source.disconnect(); source = null; }
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      if (audioCtx) { audioCtx.close(); audioCtx = null; }
      micOn = false;
      micBtn.style.background = '#555'; micBtn.style.color = '#aaa';
      voiceSel.style.display = 'none';
      volSlider.style.display = 'none'; volLabel.style.display = 'none';
      waveOverlay.style.display = 'none';
      waveBtn.style.display = 'none';
      ngBtn.style.display = 'none';
      window._setStatus('MIC 꺼짐');
      // hide RVC buttons
      const _r = document.getElementById('rvcBtn');
      const _rs = document.getElementById('rvcSetBtn');
      if (_r) { _r.style.display = 'none'; _r.style.color = '#aaa'; }
      if (_rs) _rs.style.display = 'none';
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        window.__audioCtx = audioCtx;
        // Ensure context is running (mobile)
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        // Find headset output device (non-internal speaker)
        let _hsId = 'default';
        async function _findHeadset() {
          try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const outs = devs.filter(d => d.kind === 'audiooutput');
            const hs = outs.find(d => d.label && !/internal|speaker|Built-in/i.test(d.label) && d.deviceId)
              || outs.find(d => d.deviceId && d.deviceId !== 'default');
            if (hs) _hsId = hs.deviceId;
          } catch(e) {}
        }
        await _findHeadset();

        // Apply setSinkId (dynamic following)
        async function _applySink() {
          await _findHeadset();
          if (audioCtx.setSinkId) {
            audioCtx.setSinkId(_hsId).catch(() => {});
          }
        }
        _applySink();

        // Watch for device hotplug (headset plug/unplug)
        navigator.mediaDevices.addEventListener('devicechange', _applySink);

        // Direct routing: processor → destination (follows system routing natively)
        const dest = audioCtx.destination;
        source = audioCtx.createMediaStreamSource(stream);
        gainNode = audioCtx.createGain();
        gainNode.gain.value = parseInt(volSlider.value) / 100;
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        const bufLen = 16384;
        processor = audioCtx.createScriptProcessor(1024, 1, 1);
        processor._pitchRatio = Math.pow(2, VOICES[0].pitch / 12);
        processor._buffer = new Float32Array(bufLen);
        processor._writePos = 0;
        processor._readPos = 0;
        processor.onaudioprocess = function(e) {
          const input = e.inputBuffer.getChannelData(0);
          const output = e.outputBuffer.getChannelData(0);
          applyGate(input);

          // RVC mode
          if (window._rvcMode && window.rvcReadOutput) {
            rvcFeedChunk(new Float32Array(input));
            if (rvcReadOutput(output)) return;
            // fallback if no rvc output yet: passthrough
            for (let i = 0; i < output.length; i++) output[i] = input[i];
            return;
          }
          const ratio = this._pitchRatio;
          const buf = this._buffer;
          const bLen = buf.length;
          let wp = this._writePos;
          let rp = this._readPos;
          const fadeLen = 256;

          // write input (2x for overlap)
          for (let i = 0; i < input.length; i++) {
            buf[wp % bLen] = input[i];
            buf[(wp + input.length) % bLen] += input[i]; // overlap
            wp++;
          }
          this._writePos = wp;

          // read with crossfade at wrap
          for (let i = 0; i < output.length; i++) {
            let i0 = Math.floor(rp) % bLen;
            let i1 = (i0 + 1) % bLen;
            const frac = rp - Math.floor(rp);
            let s = buf[i0] + (buf[i1] - buf[i0]) * frac;

            // crossfade when read catches up to write
            let wrapDist = wp - rp;
            if (wrapDist < 0) wrapDist += bLen;
            if (wrapDist < fadeLen) {
              const gain = wrapDist / fadeLen;
              let rp2 = rp - (bLen / 2);
              if (rp2 < 0) rp2 += bLen;
              let j0 = Math.floor(rp2) % bLen;
              let j1 = (j0 + 1) % bLen;
              let s2 = buf[j0] + (buf[j1] - buf[j0]) * (rp2 - Math.floor(rp2));
              s = s * gain + s2 * (1 - gain);
            }

            output[i] = s;
            rp += ratio;
          }
          this._readPos = rp;
        };
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(processor);
        processor.connect(dest);
        micOn = true;
        micBtn.style.background = '#4a6cf7'; micBtn.style.color = '#fff';
        voiceSel.style.display = '';
        volSlider.style.display = ''; volLabel.style.display = '';
        waveOverlay.style.display = '';
        waveBtn.style.display = ''; waveOverlayVisible = true; waveBtn.style.background = '#4a6cf7';
        ngBtn.style.display = ''; noiseGateOn = true; ngBtn.style.background = '#4a6cf7';
        // RVC button show
        const rvcBtn = document.getElementById('rvcBtn');
        const rvcSetBtn2 = document.getElementById('rvcSetBtn');
        const rvcStatus = document.getElementById('rvcStatus');
        if (rvcBtn) { rvcBtn.style.display = ''; rvcBtn.style.color = '#fff'; }
        if (rvcSetBtn2) rvcSetBtn2.style.display = '';
        if (rvcStatus) rvcStatus.style.display = '';
        window.rvcInit();
        drawWaveform();
        window._setStatus('MIC 켜짐 - ' + VOICES[currentVoice].label);
      } catch(err) {
        window._setError('MIC: ' + err.message);
      }
    }
  });
})();
