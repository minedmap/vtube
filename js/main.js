// ── Boot sequence: PIXI + MediaPipe + first model ──
// State lives in window.__state (see state.js)

const MODELS = window.__MODELS = window.__MODELS || [
  { path: '/models/20250913/20250913.model3.json', label: 'Hand', anchor: [0.5, 0.5], scale: 0.24 },
  { path: '/models/huohuo/huohuo.model3.json', label: 'Huohuo', anchor: [0.5, 0.45], scale: 0.2 },
  { path: '/models/Mao/Mao.model3.json', label: 'Mao', anchor: [0.5, 0.35], scale: 0.18 },
  { path: '/models/Frieren/Frieren.model3.json', label: 'Frieren', anchor: [0.5, 0.45], scale: 0.2 },
  { path: '/models/Hiyori/Hiyori.model3.json', label: 'Hiyori', anchor: [0.5, 0.15], scale: 0.22 },
];

async function init() {
  const s = window.__state;

  s.statusEl = document.getElementById('status');
  s.errEl = document.getElementById('error');

  if (!window.PIXI) return setError('PIXI 없음');
  if (!window.Live2DCubismCore) return setError('Core 없음');
  if (!window.PIXI.live2d || !window.PIXI.live2d.Live2DModel) return setError('live2d 없음');
  setStatus('로딩...');

  s.app = new PIXI.Application({
    view: document.getElementById('c'),
    width: window.innerWidth, height: window.innerHeight,
    backgroundColor: 0x1a1a2e, antialias: true,
    resolution: devicePixelRatio||1, autoDensity: true,
    resizeTo: document.getElementById('wrap'),
    premultipliedAlpha: true
  });
  // force WebGL state reset after Live2D draw — fixes black silhouettes
  const __origRender = PIXI.live2d.Live2DModel.prototype._render;
  PIXI.live2d.Live2DModel.prototype._render = function(r) {
    __origRender.call(this, r);
    const g = r.gl;
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.disable(g.BLEND);
    g.useProgram(null);
    g.bindTexture(g.TEXTURE_2D, null);
    g.activeTexture(g.TEXTURE0);
    r.state.reset();
    r.texture.reset();
  };

  setStatus('FaceMesh 로딩...');

  // ── load MediaPipe ──
  const mod = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/vision_bundle.mjs');
  const vision = await mod.FilesetResolver.forVisionTasks('/lib/mediapipe/');
  s.faceLandmarker = await mod.FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/lib/mediapipe/face_landmarker.task' },
    runningMode: 'VIDEO', numFaces: 1,
    minFaceDetectionConfidence: 0.5, minTrackingConfidence: 0.5
  });
  s.handLandmarker = await mod.HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/lib/mediapipe/hand_landmarker.task' },
    runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.3, minTrackingConfidence: 0.3
  });

  setStatus('준비 완료');

  // ── load first model ──
  if (window.__loadModel) {
    await window.__loadModel(MODELS[0]);
  } else {
    setStatus('모델 로더 없음');
  }
  setStatus('준비 완료');
}

window.addEventListener('load', () => {
  init().catch(err => {
    setError(err.message+'\n'+err.stack);
  });
});
