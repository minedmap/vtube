// ── UI controls (buttons, sliders, selectors) ──
// Uses window.__state and window.__MODELS

(function() {
  const $ = id => document.getElementById(id);
  const s = window.__state;
  const MODELS = window.__MODELS;

  // ── populate model dropdown ──
  const sel = $('modelSel');
  MODELS.forEach((m,i) => { sel.innerHTML += `<option value="${i}">${m.label}</option>`; });
  sel.value = '0';

  // ── model switch ──
  sel.onchange = async () => {
    if (s.stream) return;
    s.modelIdx = parseInt(sel.value);
    if (window.__loadModel) await window.__loadModel(MODELS[s.modelIdx]);
    $('sizeSlider').value = Math.round((s.currentModel?.scale?.x || 0.2) * 100);
    $('sizeVal').textContent = $('sizeSlider').value;
    $('ySlider').value = 0;
    $('yVal').textContent = '0';
    window.setStatus('준비 완료');
  };

  // ── size slider ──
  $('sizeSlider').oninput = () => {
    if (!s.currentModel) return;
    const v = $('sizeSlider').value / 100;
    s.currentModel.scale.set(v);
    $('sizeVal').textContent = $('sizeSlider').value;
  };

  // ── Y position slider ──
  $('ySlider').oninput = () => {
    if (!s.currentModel || !s.app) return;
    const val = +$('ySlider').value;
    s.currentModel.position.y = s.app.screen.height * 0.2 + val * 4;
    $('yVal').textContent = val;
  };

  // ── MMD mode toggle ──
  let mmdMode = false;
  const mmdCanvas = $('c3d');
  const liveCanvas = $('c');
  $('modeBtn').onclick = async () => {
    mmdMode = !mmdMode;
    $('modeBtn').style.background = mmdMode ? '#4a6cf7' : '#555';
    $('modeBtn').textContent = mmdMode ? 'Live2D' : '3D';
    if (mmdMode) {
      liveCanvas.style.display = 'none';
      mmdCanvas.style.display = 'block';
      const wrap = $('wrap');
      mmdCanvas.width = wrap.clientWidth;
      mmdCanvas.height = wrap.clientHeight;
      if (!window.__mmd._initialized) {
        window.__mmd.initMMD(mmdCanvas);
        window.__mmd._initialized = true;
      }
      window.__mmd.resizeMMD(mmdCanvas.width, mmdCanvas.height);
      fetch('/models/vrm/list.json').then(r => {
        if (!r.ok) {
          // fallback to MMD
          fetch('/models/mmd/list.json').then(r2 => {
            if (!r2.ok) { window.setStatus('3D: /models/vrm/ 또는 /models/mmd/ 에 모델 필요'); return; }
            r2.json().then(list => {
              if (list.length > 0) {
                window.__mmd.loadMMDModel('/models/mmd/' + list[0]);
                window.__mmd.mmdLoop(mmdCanvas.width, mmdCanvas.height);
                window.setStatus('3D (MMD) / ' + list[0]);
              } else { window.setStatus('3D: .pmx 파일 필요 (models/mmd/)'); }
            });
          }).catch(() => { window.setStatus('3D: /models/vrm/ 또는 /models/mmd/ 에 모델 필요'); });
          return;
        }
        r.json().then(list => {
          if (list.length > 0) {
            window.__mmd.loadVRMModel('/models/vrm/' + list[0]);
            window.__mmd._activeVrm = list[0];
            window.setStatus('3D (VRM) / ' + list[0]);
          } else {
            window.setStatus('3D: .vrm 파일 필요 (models/vrm/)');
          }
        });
      });
      $('ctrl').style.display = 'none';
      $('modelSel').style.display = 'none';
    } else {
      mmdCanvas.style.display = 'none';
      liveCanvas.style.display = 'block';
      if (window.__mmd.destroyMMD) window.__mmd.destroyMMD();
      window.__mmd._initialized = false;
      $('ctrl').style.display = '';
      $('modelSel').style.display = '';
      window.setStatus('Live2D 모드');
    }
  };

  // ── MMD file upload ──
  const mmdUpload = document.createElement('input');
  mmdUpload.type = 'file';
  mmdUpload.accept = '.pmx,.pmd,.vmd';
  mmdUpload.style.display = 'none';
  mmdUpload.onchange = async () => {
    const file = mmdUpload.files[0];
    if (!file || !file.name.match(/\.(pmx|pmd|vmd)$/i)) return;
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    try {
      const r = await fetch('/upload-mmd', { method: 'POST', body: form });
      const j = await r.json();
      if (j.ok) {
        window.setStatus('업로드 완료: ' + file.name);
        if (mmdMode && file.name.match(/\.(pmx|pmd)$/i)) {
          window.__mmd.loadMMDModel('/models/mmd/' + file.name);
          window.__mmd.mmdLoop(mmdCanvas.width, mmdCanvas.height);
        }
      } else {
        window.setStatus('업로드 실패: ' + j.error);
      }
    } catch(e) { window.setStatus('업로드 에러'); }
    mmdUpload.value = '';
  };
  document.body.appendChild(mmdUpload);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'u' || e.key === 'U') mmdUpload.click();
  });

  // ── flip ──
  $('flipBtn').onclick = () => {
    s.flipX = !s.flipX;
    $('flipBtn').style.background = s.flipX ? '#4a6cf7' : '#555';
  };

  // ── overlay toggle ──
  $('overlayBtn').onclick = () => {
    s.overlayShow = !s.overlayShow;
    $('overlayBtn').style.background = s.overlayShow ? '#4a6cf7' : '#555';
  };

  // ── VTS ──
  $('vtsBtn').onclick = () => {
    if (window.__vts) window.__vts.connect();
    fib = $('vtsBtn');
    fib.textContent = 'VTS...';
    setTimeout(() => { fib.textContent = 'VTS ✅'; }, 2000);
  };

  // ── face toggle ──
  $('faceToggle').onclick = () => {
    s.faceOn = !s.faceOn;
    $('faceToggle').style.background = s.faceOn ? '#4a6cf7' : '#555';
  };

  // ── hand toggle ──
  $('handToggle').onclick = () => {
    s.handOn = !s.handOn;
    $('handToggle').style.background = s.handOn ? '#4a6cf7' : '#555';
  };
})();
