// ── Emotion + cheek puff mapper ──
// Dominant emotion only (no blend). Cheek puff detected separately.

(function() {
  const gestureUpdate = window.__updateExpression;
  let prevState = null;

  const STD_PARAMS = [
    'ParamEyeLSmile','ParamEyeRSmile','ParamCheek',
    'ParamBrowLY','ParamBrowRY','ParamBrowLForm','ParamBrowRForm',
    'ParamBrowLAngle','ParamBrowRAngle',
    'ParamMouthUp','ParamMouthDown','ParamMouthAngry','ParamMouthAngryLine',
  ];

  const STD_EXPR = {
    happy:    { ParamEyeLSmile: 0.9, ParamEyeRSmile: 0.9, ParamCheek: 0.6, ParamBrowLY: 0.15, ParamBrowRY: 0.15, ParamMouthUp: 0.8 },
    surprised:{ ParamBrowLY: 1.0, ParamBrowRY: 1.0, ParamBrowLForm: 0.5, ParamBrowRForm: 0.5, ParamEyeLSmile: -0.3, ParamEyeRSmile: -0.3 },
    angry:    { ParamBrowLAngle: -1.0, ParamBrowRAngle: -1.0, ParamBrowLY: -0.6, ParamBrowRY: -0.6, ParamBrowLForm: -1.0, ParamBrowRForm: -1.0, ParamMouthAngry: 0.8 },
    sad:      { ParamBrowLAngle: 0.6, ParamBrowRAngle: 0.6, ParamBrowLY: 0.3, ParamBrowRY: 0.3, ParamBrowLForm: 0.6, ParamBrowRForm: 0.6, ParamMouthDown: 0.8 },
  };

  window.__updateExpression = function(modelLabel) {
    if (gestureUpdate) gestureUpdate(modelLabel);

    const s = window.__state;
    const cm = s.currentModel;
    if (!cm || !cm._paramIdx || !cm.internalModel) return;
    const pi = cm._paramIdx;
    const pv = cm.internalModel.coreModel._model.parameters.values;

    // ── Emotion ──
    const cfg = window.__EMOTION_CFG;
    const modelCfg = cfg && cfg[modelLabel] ? cfg[modelLabel] : null;
    const exclusive = modelCfg && modelCfg.exclusiveKeys ? true : false;

    // ── Clear gesture std params (skip for exclusive models — they use their own keys) ──
    if (!exclusive) {
      for (const pid of STD_PARAMS) if (pi[pid] >= 0) pv[pi[pid]] = 0;
    }

    const exprScores = window.__exprScores;
    if (exprScores) {
      const h = exprScores.happy || 0, su = exprScores.surprised || 0;
      const a = exprScores.angry || 0, sa = exprScores.sad || 0;
      const loveVal = h > 0.15 ? Math.min(1, h * 0.5 + (s.mouthForm || 0) * 0.4 + Math.max(0, 0.3 - (s.eyeLOpen || 1)) * 0.3) : 0;
      const emotions = [
        { name:'surprised',val:su },{ name:'angry',val:a },
        { name:'sad',val:sa },{ name:'love',val:loveVal },
        { name:'blush',val:loveVal*0.6 },{ name:'happy',val:h },
      ];
      let dominant='neutral', maxVal=0.2;
      for (const e of emotions) if (e.val > maxVal) { dominant=e.name; maxVal=e.val; }
      // ── Apply expression ──
      if (exclusive) {
        // Exclusive-key model: clear gesture params too, then set only dominant at full 1.0
        for (const pid of STD_PARAMS) if (pi[pid] >= 0) pv[pi[pid]] = 0;
        if (prevState) {
          const prevKeys = modelCfg[prevState];
          if (prevKeys) for (const pid of Object.keys(prevKeys))
            if (pi[pid] >= 0) pv[pi[pid]] = 0;
        }
        prevState = dominant;
        if (dominant !== 'neutral') {
          const t = modelCfg[dominant];
          if (t) for (const [pid,val] of Object.entries(t))
            if (pi[pid] >= 0) pv[pi[pid]] = val;
        }
      } else {
        // Standard model: blend with intensity
        if (dominant !== 'neutral' && STD_EXPR[dominant])
          for (const [pid,val] of Object.entries(STD_EXPR[dominant]))
            if (pi[pid] >= 0) pv[pi[pid]] = val * maxVal;
        if (modelCfg) {
          if (prevState && prevState !== dominant && modelCfg[prevState])
            for (const paramId of Object.keys(modelCfg[prevState]))
              if (pi[paramId] >= 0) pv[pi[paramId]] = 0;
          prevState = dominant;
          const t = modelCfg[dominant];
          if (t) for (const [pid,val] of Object.entries(t))
            if (pi[pid] >= 0) pv[pi[pid]] = val * maxVal;
        }
      }
    }

    // ── Cheek puff (independent detector) ──
    const puffCfg = window.__CHEEKPUFF_CFG;
    const puffMap = puffCfg && puffCfg[modelLabel] ? puffCfg[modelLabel] : null;
    if (puffMap) {
      const lm = s.lastFaceLM;
      let puffVal = 0;
      if (lm && lm.length > 454) {
        // Measure cheek width: distance between left/right cheek landmarks
        // Normalized by face width (ear-to-ear)
        const faceW = Math.abs(lm[454].x - lm[234].x);
        const cheekW = Math.abs(lm[280].x - lm[50].x);
        const ratio = cheekW / faceW;
        // Puffed cheeks > ~0.65 ratio. Normal ~0.55
        puffVal = ratio > 0.66 ? Math.min(1, (ratio - 0.66) * 8) : 0;
      }
      // Smooth puff
      s._puffVal = s._puffVal || 0;
      s._puffVal += (puffVal - s._puffVal) * 0.25;
      if (s._puffVal > 0.1) {
        for (const [pid,val] of Object.entries(puffMap))
          if (pi[pid] >= 0) pv[pi[pid]] = val * s._puffVal;
      } else {
        for (const pid of Object.keys(puffMap))
          if (pi[pid] >= 0) pv[pi[pid]] = 0;
      }
    }

    // Debug
    const emoji={neutral:'😐',happy:'😊',surprised:'😮',angry:'😠',sad:'😢',love:'🥰',blush:'☺️'};
    const dbg=`${emoji[prevState||'neutral']||'?'} ${prevState||'neutral'} puff:${(s._puffVal||0).toFixed(2)}`;
    window.__emotionDebug = dbg;
    window.__exprDebug = dbg;
  };
})();
