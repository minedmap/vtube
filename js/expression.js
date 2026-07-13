// ── Emotion → model-specific parameter mapper ──
// Overwrites gesture.js's blended output → only dominant emotion applied

(function() {
  const gestureUpdate = window.__updateExpression;
  let prevState = null;

  // Standard params that gesture.js controls (must clear before re-apply)
  const STD_PARAMS = [
    'ParamEyeLSmile','ParamEyeRSmile','ParamCheek',
    'ParamBrowLY','ParamBrowRY','ParamBrowLForm','ParamBrowRForm',
    'ParamBrowLAngle','ParamBrowRAngle',
    'ParamMouthUp','ParamMouthDown','ParamMouthAngry','ParamMouthAngryLine',
  ];

  // Standard param mapping for each emotion (isolated, no blend)
  const STD_EXPR = {
    happy:    { ParamEyeLSmile: 0.9, ParamEyeRSmile: 0.9, ParamCheek: 0.6, ParamBrowLY: 0.15, ParamBrowRY: 0.15, ParamMouthUp: 0.8 },
    surprised:{ ParamBrowLY: 1.0, ParamBrowRY: 1.0, ParamBrowLForm: 0.5, ParamBrowRForm: 0.5, ParamEyeLSmile: -0.3, ParamEyeRSmile: -0.3 },
    angry:    { ParamBrowLAngle: -1.0, ParamBrowRAngle: -1.0, ParamBrowLY: -0.6, ParamBrowRY: -0.6, ParamBrowLForm: -1.0, ParamBrowRForm: -1.0, ParamMouthAngry: 0.8 },
    sad:      { ParamBrowLAngle: 0.6, ParamBrowRAngle: 0.6, ParamBrowLY: 0.3, ParamBrowRY: 0.3, ParamBrowLForm: 0.6, ParamBrowRForm: 0.6, ParamMouthDown: 0.8 },
  };

  window.__updateExpression = function(modelLabel) {
    // Run gesture.js classifier to get __exprScores (emotion intensities)
    // But ignore its param application
    if (gestureUpdate) gestureUpdate(modelLabel);

    const s = window.__state;
    const cm = s.currentModel;
    if (!cm || !cm._paramIdx || !cm.internalModel) return;
    const pi = cm._paramIdx;
    const pv = cm.internalModel.coreModel._model.parameters.values;

    // Clear ALL standard gesture params first
    for (const pid of STD_PARAMS) {
      if (pi[pid] >= 0) pv[pi[pid]] = 0;
    }

    const cfg = window.__EMOTION_CFG;
    const modelCfg = cfg && cfg[modelLabel] ? cfg[modelLabel] : null;

    const exprScores = window.__exprScores;
    if (!exprScores) return;

    const h = exprScores.happy || 0;
    const su = exprScores.surprised || 0;
    const a = exprScores.angry || 0;
    const sa = exprScores.sad || 0;

    const loveVal = h > 0.15 ? Math.min(1, h * 0.5 + (s.mouthForm || 0) * 0.4 + Math.max(0, 0.3 - (s.eyeLOpen || 1)) * 0.3) : 0;

    const emotions = [
      { name: 'surprised', val: su },
      { name: 'angry', val: a },
      { name: 'sad', val: sa },
      { name: 'love', val: loveVal },
      { name: 'blush', val: loveVal * 0.6 },
      { name: 'happy', val: h },
    ];
    let dominant = 'neutral', maxVal = 0.15;
    for (const e of emotions) {
      if (e.val > maxVal) { dominant = e.name; maxVal = e.val; }
    }

    // Apply ONLY dominant emotion's standard params
    if (dominant !== 'neutral' && STD_EXPR[dominant]) {
      for (const [pid, val] of Object.entries(STD_EXPR[dominant])) {
        if (pi[pid] >= 0) pv[pi[pid]] = val * maxVal;
      }
    }

    // Model-specific custom params
    if (modelCfg) {
      if (prevState && prevState !== dominant && modelCfg[prevState]) {
        for (const paramId of Object.keys(modelCfg[prevState])) {
          if (pi[paramId] >= 0) pv[pi[paramId]] = 0;
        }
      }
      prevState = dominant;
      const targetMap = modelCfg[dominant];
      if (targetMap) {
        for (const [paramId, val] of Object.entries(targetMap)) {
          if (pi[paramId] >= 0) pv[pi[paramId]] = val * maxVal;
        }
      }
    }

    const emoji = { neutral:'😐', happy:'😊', surprised:'😮', angry:'😠', sad:'😢', love:'🥰', blush:'☺️' };
    const dbg = `${emoji[dominant]||'?'} ${dominant} ${maxVal.toFixed(2)} h${h.toFixed(2)} su${su.toFixed(2)} a${a.toFixed(2)} sa${sa.toFixed(2)}`;
    window.__emotionDebug = dbg;
    window.__exprDebug = dbg;
  };
})();
