// ── Emotion → model-specific parameter mapper ──
// Uses gesture.js's classification (`window.__exprScores`)
// Only adds model-custom params (Param104, Param109, ParamCheek, etc.)
// Standard params already handled by gesture.js

(function() {
  const gestureUpdate = window.__updateExpression;

  window.__updateExpression = function(modelLabel) {
    // First: gesture.js runs its full classifier (sets __exprScores + standard params)
    if (gestureUpdate) gestureUpdate(modelLabel);

    const s = window.__state;
    const cm = s.currentModel;
    if (!cm || !cm._paramIdx || !cm.internalModel) return;

    const cfg = window.__EMOTION_CFG;
    if (!cfg) return;
    const modelCfg = cfg[modelLabel];
    if (!modelCfg) return;

    const pi = cm._paramIdx;
    const pv = cm.internalModel.coreModel._model.parameters.values;
    const exprScores = window.__exprScores;
    if (!exprScores) return;

    const h = exprScores.happy || 0;
    const su = exprScores.surprised || 0;
    const a = exprScores.angry || 0;
    const sa = exprScores.sad || 0;

    // Love/blush: happy + smile + soft eyes
    const loveVal = h > 0.15 ? Math.min(1, h * 0.5 + (s.mouthForm || 0) * 0.4 + Math.max(0, 0.3 - (s.eyeLOpen || 1)) * 0.3) : 0;

    // Find dominant emotion
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

    // Reset ALL custom params for this model first
    for (const stateName of Object.keys(modelCfg)) {
      for (const paramId of Object.keys(modelCfg[stateName])) {
        if (pi[paramId] >= 0) pv[pi[paramId]] = 0;
      }
    }

    // Apply custom params for dominant emotion
    const targetMap = modelCfg[dominant];
    if (targetMap) {
      for (const [paramId, val] of Object.entries(targetMap)) {
        if (pi[paramId] >= 0) pv[pi[paramId]] = val * maxVal;
      }
    }

    // Debug
    const emoji = { neutral:'😐', happy:'😊', surprised:'😮', angry:'😠', sad:'😢', love:'🥰', blush:'☺️' };
    window.__emotionDebug = `${emoji[dominant]||'?'} ${dominant} ${maxVal.toFixed(2)} h${h.toFixed(2)} su${su.toFixed(2)} a${a.toFixed(2)} sa${sa.toFixed(2)}`;
  };
})();
