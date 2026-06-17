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
    if (!window.__armPv) window.__armPv = {};

    if (im.motionManager) { im.motionManager.updateParameters = () => {}; im.motionManager.startMotionPriority = () => {}; }
    if (im.mainMotionManager) im.mainMotionManager.stopAll();
    if (im.expressionManager) im.expressionManager.stopAll();
    if (im.breath) { im.breath.def = () => 0; im.breath.running = false; }
    if (im.eyeBlink) { im.eyeBlink.def = () => 0; im.eyeBlink.running = false; }
    if (im.physicsManager) im.physicsManager.update = () => {};

    const fc = im.focusController;
    if (fc) { fc.x = 0; fc.y = 0; fc.targetX = 0; fc.targetY = 0; fc.vx = 0; fc.vy = 0; fc.enabled = false; }
    if (m.focus) m.focus = () => {};

    const origUpdate = im.update;
    im.update = function() {
      const pi = idx, pv = pVals;
      if (pi.ParamAngleX >= 0) pv[pi.ParamAngleX] = s.headX * 68;
      if (pi.ParamAngleY >= 0) pv[pi.ParamAngleY] = s.headY * 114;
      if (pi.ParamBodyAngleX >= 0) pv[pi.ParamBodyAngleX] = s.headX * Math.abs(s.headX) * 80;
      if (pi.ParamBodyAngleY >= 0) pv[pi.ParamBodyAngleY] = s.headY * Math.abs(s.headY) * 100;
      if (pi.ParamMouthOpenY >= 0) pv[pi.ParamMouthOpenY] = s.mouthOpen;
      if (pi.ParamA >= 0) pv[pi.ParamA] = s.mouthOpen;
      if (pi.ParamEyeLOpen >= 0) pv[pi.ParamEyeLOpen] = s.eyeLOpen;
      if (pi.ParamEyeROpen >= 0) pv[pi.ParamEyeROpen] = s.eyeROpen;
      s.blinkTimer++;
      if (s.blinkTimer > 120 + Math.random() * 180) {
        const blinkPhase = Math.min(1, (s.blinkTimer - 120) / 6);
        const bk = blinkPhase < 0.5 ? blinkPhase * 2 : (1 - blinkPhase) * 2;
        const blinkVal = 1 - Math.max(0, bk) * 0.9;
        if (pi.ParamEyeLOpen >= 0) pv[pi.ParamEyeLOpen] = Math.min(s.eyeLOpen, blinkVal);
        if (pi.ParamEyeROpen >= 0) pv[pi.ParamEyeROpen] = Math.min(s.eyeROpen, blinkVal);
        if (blinkPhase >= 1) s.blinkTimer = 0;
      }
      const armL = s.armL, armR = s.armR;
      if (pi.ParamRightShoulderUp >= 0) pv[pi.ParamRightShoulderUp] = -armR.wy * 10;
      if (pi.ParamArmRA01 >= 0) pv[pi.ParamArmRA01] = -armR.wy * 20;
      if (pi.ParamArmRA02 >= 0) pv[pi.ParamArmRA02] = -armR.wx * 15;
      if (pi.ParamArmRA03 >= 0) pv[pi.ParamArmRA03] = armR.open * 30;
      if (pi.ParamArmRB01 >= 0) pv[pi.ParamArmRB01] = armR.wy * 20;
      if (pi.ParamArmRB02 >= 0) pv[pi.ParamArmRB02] = -armR.wx * 20;
      if (pi.ParamArmRB02Y !== undefined && pi.ParamArmRB02Y >= 0) pv[pi.ParamArmRB02Y] = armR.wy < 0 ? -armR.wy * 20 : 0;
      if (pi.ParamArmRB03 >= 0) pv[pi.ParamArmRB03] = armR.open * 15;
      if (pi.ParamArmRA >= 0) pv[pi.ParamArmRA] = -armR.wy * 10;
      if (pi.ParamArmRB >= 0) pv[pi.ParamArmRB] = armR.wx * 10;
      if (pi.ParamHandR >= 0) pv[pi.ParamHandR] = armR.open;
      if (pi.ParamHandRA >= 0) pv[pi.ParamHandRA] = (1 - armR.open) * -10;
      if (pi.ParamHandRB >= 0) pv[pi.ParamHandRB] = armR.open * 10;
      if (pi.ParamLeftShoulderUp >= 0) pv[pi.ParamLeftShoulderUp] = -armL.wy * 10;
      if (pi.ParamArmLA01 >= 0) pv[pi.ParamArmLA01] = -armL.wy * 20;
      if (pi.ParamArmLA02 >= 0) pv[pi.ParamArmLA02] = armL.wx * 15;
      if (pi.ParamArmLA03 >= 0) pv[pi.ParamArmLA03] = armL.open * 30;
      if (pi.ParamArmLB01 >= 0) pv[pi.ParamArmLB01] = armL.wy * 20;
      if (pi.ParamArmLB02 >= 0) pv[pi.ParamArmLB02] = armL.wx * 20;
      if (pi.ParamArmLB03 >= 0) pv[pi.ParamArmLB03] = armL.open * 10;
      if (pi.ParamArmLA >= 0) pv[pi.ParamArmLA] = -armL.wy * 10;
      if (pi.ParamArmLB >= 0) pv[pi.ParamArmLB] = -armL.wx * 10;
      if (pi.ParamHandL >= 0) pv[pi.ParamHandL] = armL.open;
      if (pi.ParamHandLA >= 0) pv[pi.ParamHandLA] = (1 - armL.open) * -10;
      if (pi.ParamHandLB >= 0) pv[pi.ParamHandLB] = armL.open * 10;
      if (pi.ParamArmAR01 >= 0) pv[pi.ParamArmAR01] = -armR.wy * 20;
      if (pi.ParamArmAR02 >= 0) pv[pi.ParamArmAR02] = -armR.wx * 15;
      if (pi.ParamArmAR03 >= 0) pv[pi.ParamArmAR03] = armR.open * 20;
      if (pi.ParamArmAR04 >= 0) pv[pi.ParamArmAR04] = (1 - armR.open) * -1;
      if (pi.ParamArmAL01 >= 0) pv[pi.ParamArmAL01] = -armL.wy * 20;
      if (pi.ParamArmAL02 >= 0) pv[pi.ParamArmAL02] = armL.wx * 15;
      if (pi.ParamArmAL03 >= 0) pv[pi.ParamArmAL03] = armL.open * 20;
      if (pi.ParamArmAL04 >= 0) pv[pi.ParamArmAL04] = (1 - armL.open) * -1;
      if (pi.handLeftOpen >= 0) pv[pi.handLeftOpen] = (armL.open * 60) - 30;
      if (pi.HandLeftAngleX >= 0) pv[pi.HandLeftAngleX] = armL.wy * 30;
      if (pi.HandLeftAngleZ >= 0) pv[pi.HandLeftAngleZ] = armL.wx * 30;
      if (pi.HandLeftPositionX >= 0) pv[pi.HandLeftPositionX] = armL.wx * 0.5;
      if (pi.HandLeftPositionY >= 0) pv[pi.HandLeftPositionY] = armL.wy * 0.5;
      if (pi.HandRightAngleX >= 0) pv[pi.HandRightAngleX] = armR.wy * 30;
      if (pi.HandRightAngleZ >= 0) pv[pi.HandRightAngleZ] = armR.wx * 30;
      if (pi.HandRightPositionX >= 0) pv[pi.HandRightPositionX] = armR.wx * 0.5;
      if (pi.HandRightPositionY >= 0) pv[pi.HandRightPositionY] = armR.wy * 0.5;
      if (pi.Param7 >= 0) pv[pi.Param7] = -armL.wy * 10;
      if (pi.Param17 >= 0) pv[pi.Param17] = -armR.wy * 8;
      if (pi.Param19 >= 0) pv[pi.Param19] = armL.wx * 15;
      if (!window.__armPv) window.__armPv = {};
      for (const k of Object.keys(pi)) {
        if (k.includes('Arm') || k.includes('Hand') || k.includes('Shoulder'))
          window.__armPv[k] = pv[pi[k]];
      }
      return origUpdate.apply(this, arguments);
    };
    s.currentModel = m;
    window.__m = m;
    document.getElementById('modelSel').value = '' + s.modelIdx;
    return m;
  }

  window.__loadModel = loadModel;
})();
