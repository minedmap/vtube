// ── Shared state for all modules ──
window.__state = {};

// DOM helpers
window.$ = id => document.getElementById(id);
window.setStatus = t => { __state.statusEl.textContent = t; };
window.setError = m => { __state.errEl.style.display='block'; __state.errEl.textContent=m; };
window._setStatus = window.setStatus;
window._setError = window.setError;

// State vars
(function() {
  const s = window.__state;
  s.app = null;
  s.faceLandmarker = null;
  s.handLandmarker = null;
  s.currentModel = null;
  s.stream = null;
  s.headX = 0; s.headY = 0;
  s.rawX = 0; s.rawY = 0;
  s.trackingLoop = null;
  s.boxVisible = true;
  s.mouthOpen = 0;
  s.eyeLOpen = 1; s.eyeROpen = 1;
  s.blinkTimer = 0;
  s.flipX = false;
  s.overlayShow = true;
  s.faceOn = true;
  s.handOn = true;
  s.handwearImg = null;
  s.handData = [];
  s.armL = { open:0, wx:0, wy:0 };
  s.armR = { open:0, wx:0, wy:0 };
  s.modelIdx = 0;
  s.lastFaceLM = null;
  s.smoothHand = [];
  s.calHandMin = 0.08;
  s.calHandMax = 0.35;
  s.calSamples = 0;
  s.lastHandResult = null;
  s.handChanged = false;
  s.tracking = false;
  s.frameCount = 0;
  s.armDecayL = { open:0, wx:0, wy:0 };
  s.armDecayR = { open:0, wx:0, wy:0 };
  window.__debug = { armL: s.armL, armR: s.armR };
})();
