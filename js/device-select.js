// ── Camera + Mic device selection ──
(function() {
  const s = window.__state;
  s.selectedCameraId = '';
  s.selectedMicId = '';
  s._camPermGranted = false;
  s.ipCamUrl = '';
  s.ipCamMode = false;

  const camSelect = document.getElementById('camDeviceSelect');
  const micSelect = document.getElementById('micDeviceSelect');
  const ipInput = document.getElementById('ipCamUrlInput');

  async function enumerate() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const cams = devs.filter(d => d.kind === 'videoinput');
      const mics = devs.filter(d => d.kind === 'audioinput');

      const prevCamId = camSelect.value || s.selectedCameraId;
      const prevMicId = micSelect.value || s.selectedMicId;

      camSelect.innerHTML = '';
      cams.forEach((cam, i) => {
        const label = cam.label || `카메라 ${i+1} (${cam.deviceId.slice(0,8)}...)`;
        const opt = document.createElement('option');
        opt.value = cam.deviceId;
        opt.textContent = label;
        camSelect.appendChild(opt);
      });
      if (cams.some(c => c.deviceId === prevCamId)) {
        camSelect.value = prevCamId;
        s.selectedCameraId = prevCamId;
      } else if (cams.length > 0) {
        camSelect.value = cams[0].deviceId;
        s.selectedCameraId = cams[0].deviceId;
      }

      micSelect.innerHTML = '';
      mics.forEach((mic, i) => {
        const label = mic.label || `마이크 ${i+1} (${mic.deviceId.slice(0,8)}...)`;
        const opt = document.createElement('option');
        opt.value = mic.deviceId;
        opt.textContent = label;
        micSelect.appendChild(opt);
      });
      if (mics.some(m => m.deviceId === prevMicId)) {
        micSelect.value = prevMicId;
        s.selectedMicId = prevMicId;
      } else if (mics.length > 0) {
        micSelect.value = mics[0].deviceId;
        s.selectedMicId = mics[0].deviceId;
      }
    } catch(e) {
      console.warn('device enum fail:', e.message);
    }
  }

  camSelect.addEventListener('change', () => {
    s.selectedCameraId = camSelect.value;
    s.ipCamMode = false;
    if (s.stream) {
      document.getElementById('camBtn').click();
      setTimeout(() => document.getElementById('camBtn').click(), 300);
    }
  });

  micSelect.addEventListener('change', () => {
    s.selectedMicId = micSelect.value;
    const mb = document.getElementById('micBtn');
    if (mb && mb.style.background === 'rgb(74, 108, 247)') {
      mb.click();
      setTimeout(() => mb.click(), 400);
    }
  });

  // IP cam connect
  document.getElementById('ipCamConnectBtn').onclick = () => {
    const url = ipInput.value.trim();
    if (!url) return;
    s.ipCamUrl = url;
    s.ipCamMode = true;
    // if camera already on, restart
    if (s.stream) {
      document.getElementById('camBtn').click();
      setTimeout(() => document.getElementById('camBtn').click(), 300);
    } else {
      document.getElementById('camBtn').click();
    }
  };

  // re-enum with labels after first CAM ON
  document.getElementById('camBtn').addEventListener('click', () => {
    if (!s._camPermGranted) {
      setTimeout(() => { enumerate(); s._camPermGranted = true; }, 500);
    }
  });

  navigator.mediaDevices.addEventListener('devicechange', enumerate);
  document.getElementById('devRefreshBtn').onclick = enumerate;
  enumerate();
})();
