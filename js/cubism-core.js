// ── Cubism Live2D model loading & parameter management ──
// Uses window.__state for shared state

(async function() {
  const s = window.__state;
  const MODELS = window.__MODELS;

  async function loadModel(cfg) {
    const app = s.app;
    if (s.currentModel) { app.stage.removeChild(s.currentModel); s.currentModel.destroy(true); }
    window.setStatus('모델 로딩... '+cfg.label);
    const m = await PIXI.live2d.Live2DModel.from(cfg.path);
    m.anchor.set(cfg.anchor[0], cfg.anchor[1]);
    m.scale.set(cfg.scale);
    m.interactive = false;
    m.position.set(app.screen.width/2, app.screen.height * 0.2);
    app.stage.addChild(m);

    await new Promise(r => { if (m.internalModel) return r(); m.once('modelLoaded', r); });

    const im = m.internalModel;
    for (let i = 0; i < 20; i++) {
      if (im && im.coreModel && im.coreModel._model) break;
      await new Promise(r => setTimeout(r, 50));
    }
    if (!im || !im.coreModel || !im.coreModel._model) { throw new Error('coreModel not ready'); }
    const pVals = im.coreModel._model.parameters.values;
    const pIds = im.coreModel._model.parameters.ids;

    const idx = {};
    for (let i = 0; i < pIds.length; i++) idx[pIds[i]] = i;
    m._paramIdx = idx;

    const isFrieren = cfg.label === 'Frieren';
    if (isFrieren && im && im.coreModel && im.coreModel._model) {
      const dc = im.coreModel._model.drawables;
      if (dc && dc.multiplyColors && dc.screenColors) {
        for (let di = 0; di < dc.count; di++) {
          dc.multiplyColors[di*4] = 1; dc.multiplyColors[di*4+1] = 1;
          dc.multiplyColors[di*4+2] = 1; dc.multiplyColors[di*4+3] = 1;
          dc.screenColors[di*4] = 0; dc.screenColors[di*4+1] = 0;
          dc.screenColors[di*4+2] = 0; dc.screenColors[di*4+3] = 0;
        }
      }
      if (im.coreModel._model.parts && im.coreModel._model.parts.opacities) {
        for (let pi = 0; pi < im.coreModel._model.parts.opacities.length; pi++)
          im.coreModel._model.parts.opacities[pi] = 1;
      }
      if (im.renderer && im.renderer.useHighPrecisionMask)
        im.renderer.useHighPrecisionMask(false);
    }

    const pts = im.coreModel._model.parts;
    if (pts && pts.ids) {
      for (let pi2 = 0; pi2 < pts.ids.length; pi2++) {
        const pid2 = pts.ids[pi2];
        if (pid2 === 'Part70' || pid2 === 'Part59' || pid2 === 'Part48') {
          pts.opacities[pi2] = 1.0;
        }
      }
    }
    if (idx.Param15 >= 0) pVals[idx.Param15] = 0.0;
    if (idx.Param21 >= 0) pVals[idx.Param21] = 0.0;
    // 모델별 기본 자세 보정
    if (!window.__armPv) window.__armPv = {};

    if (im.expressionManager) { im.expressionManager.stopAll(); im.expressionManager.updateParameters = () => {}; }
    // 모션이 있는 모델(Motions in model3)은 updateParameters nullify
    if (im.motionManager) { im.motionManager.updateParameters = () => {}; }
    if (im.mainMotionManager) im.mainMotionManager.stopAll();
    // 숨쉬기+눈깜빡임만 유지 (모션 없이)
    const fc = im.focusController;
    if (fc) { fc.x = 0; fc.y = 0; fc.targetX = 0; fc.targetY = 0; fc.vx = 0; fc.vy = 0; fc.enabled = false; }
    if (m.focus) m.focus = () => {};

    const origUpdate = im.update;
    im.update = function() {
      // physics+호흡+눈깜빡임 (origUpdate 안에 있음)
      const ret = origUpdate.apply(this, arguments);
      // face tracking 덮어쓰기 (카메라 있을 때만)
      if (s.stream !== null) {
        const pi = idx, pv = pVals;
        const invertX = cfg.label === 'Huohuo' ? -1 : 1;
        const invertY = cfg.label === 'Huohuo' ? -1 : 1;
        if (s.headX || s.headY) {
          if (pi.ParamAngleX >= 0) pv[pi.ParamAngleX] = s.headX * 68 * invertX;
          if (pi.ParamAngleY >= 0) pv[pi.ParamAngleY] = s.headY * 114 * invertY;
          if (pi.ParamBodyAngleX >= 0) pv[pi.ParamBodyAngleX] = s.headX * Math.abs(s.headX) * 80;
          if (pi.ParamBodyAngleY >= 0) pv[pi.ParamBodyAngleY] = s.headY * Math.abs(s.headY) * 100;
        }
        if (pi.ParamMouthOpenY >= 0) pv[pi.ParamMouthOpenY] = s.mouthOpen;
        if (pi.ParamA >= 0) pv[pi.ParamA] = s.mouthOpen;
        if (s.mouthForm) {
          if (pi.ParamMouthForm >= 0) pv[pi.ParamMouthForm] = s.mouthForm;
          if (pi.ParamMouthOpenX >= 0) pv[pi.ParamMouthOpenX] = s.mouthForm;
        }
        if (s.eyeLOpen !== undefined) {
          if (pi.ParamEyeLOpen >= 0) pv[pi.ParamEyeLOpen] = s.eyeLOpen;
          if (pi.ParamEyeROpen >= 0) pv[pi.ParamEyeROpen] = s.eyeROpen;
        }
        // face expression classifier (표정 분류값이 raw tracking 덮어씀)
        if (window.__updateExpression) {
          window.__updateExpression(cfg.label);
        }
      }
      return ret;
    };
    s.currentModel = m;
    s.modelLabel = cfg.label;
    window.__m = m;
    if (window.__updateModelSel) window.__updateModelSel(s.modelIdx);
    return m;
  }

  window.__loadModel = loadModel;
})();
