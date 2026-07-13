// ── Emotion + cheek puff mapper ──
// Dominant emotion only (no blend). Cheek puff detected separately.

(function() {
  const gestureUpdate = window.__updateExpression;
  let prevState = null;
  // exclusive-key 모델용 상태머신 (노이즈로 표정이 널뛰는 것 방지)
  let exCand = null, exCandN = 0, exHold = 999;

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
      // love: 크게 웃으면서(happy 강함) 눈웃음으로 눈이 거의 감겼을 때만
      // (mouthForm 기반이면 말만 해도 발동하던 문제 수정)
      const eyeAvg = ((s.eyeLOpen ?? 1) + (s.eyeROpen ?? 1)) / 2;
      const loveVal = (h > 0.5 && eyeAvg < 0.4) ? Math.min(1, h * 1.1) : 0;
      const emotions = [
        { name:'surprised',val:su },{ name:'angry',val:a },
        { name:'sad',val:sa },{ name:'love',val:loveVal },
        { name:'blush',val:loveVal*0.6 },{ name:'happy',val:h },
      ];
      let dominant='neutral', maxVal=0.2;
      for (const e of emotions) if (e.val > maxVal) { dominant=e.name; maxVal=e.val; }
      // ── Apply expression ──
      if (exclusive) {
        // Exclusive-key model: 키가 1.0 풀강도 토글이므로 히스테리시스+유지시간으로
        // 상태 전환을 디바운스 (ML 점수 노이즈가 그대로 풀표정으로 터지던 문제)
        const ENTER = 0.45, EXIT = 0.28, DWELL = 10, MIN_HOLD = 24;
        const cur = prevState || 'neutral';
        let curVal = 0;
        if (cur !== 'neutral') for (const e of emotions) if (e.name === cur) curVal = e.val;
        exHold++;
        let next = cur;
        if (cur !== 'neutral' && curVal < EXIT && exHold >= MIN_HOLD) next = 'neutral';
        if (dominant !== 'neutral' && maxVal >= ENTER && dominant !== cur) {
          if (exCand === dominant) exCandN++; else { exCand = dominant; exCandN = 1; }
          if (exCandN >= DWELL && exHold >= MIN_HOLD) next = dominant;
        } else { exCand = null; exCandN = 0; }
        if (next !== cur) exHold = 0;

        // 이전 상태 키 + std 파라미터 정리 후 현재 상태 키만 세팅 (겹침 방지)
        for (const pid of STD_PARAMS) if (pi[pid] >= 0) pv[pi[pid]] = 0;
        if (prevState && modelCfg[prevState]) {
          for (const pid of Object.keys(modelCfg[prevState]))
            if (pi[pid] >= 0) pv[pi[pid]] = 0;
        }
        prevState = next;
        if (next !== 'neutral') {
          const t = modelCfg[next];
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
      // ── Restore eye tracking (blink) after expression override ──
      if (pi.ParamEyeLOpen >= 0 && s.eyeLOpen !== undefined) {
        const eyeScale = modelLabel === 'huohuo' ? s.eyeLOpen * s.eyeLOpen : Math.min(2.0, s.eyeLOpen * 1.8);
        pv[pi.ParamEyeLOpen] = eyeScale;
      }
      if (pi.ParamEyeROpen >= 0 && s.eyeROpen !== undefined) {
        const eyeScaleR = modelLabel === 'huohuo' ? s.eyeROpen * s.eyeROpen : Math.min(2.0, s.eyeROpen * 1.8);
        pv[pi.ParamEyeROpen] = eyeScaleR;
      }
    }

    // ── Cheek puff (independent detector) ──
    const puffCfg = window.__CHEEKPUFF_CFG;
    const puffMap = puffCfg && puffCfg[modelLabel] ? puffCfg[modelLabel] : null;
    if (puffMap) {
      // Blendshape score and landmark ratio both computed; strongest wins.
      // MediaPipe cheekPuff blendshape scores run low even when fully puffed.
      let bsScore = 0, ratio = 0, puffVal = 0;
      const bs = s.faceBlend;
      if (bs) {
        if (s._puffBsIdx === undefined)
          s._puffBsIdx = bs.findIndex(c => c.categoryName === 'cheekPuff');
        if (s._puffBsIdx >= 0) {
          bsScore = bs[s._puffBsIdx].score;
          puffVal = bsScore > 0.06 ? Math.min(1, (bsScore - 0.06) / 0.2) : 0;
        }
      }
      const lm = s.lastFaceLM;
      if (lm && lm.length > 454) {
        // Cheek width / face width. Measured: rest ~0.68, full puff ~0.71
        const faceW = Math.abs(lm[454].x - lm[234].x);
        const cheekW = Math.abs(lm[280].x - lm[50].x);
        ratio = cheekW / faceW;
        const lmVal = ratio > 0.69 ? Math.min(1, (ratio - 0.69) * 50) : 0;
        puffVal = Math.max(puffVal, lmVal);
      }
      s._puffDbg = ` bs:${bsScore.toFixed(2)} r:${ratio.toFixed(2)}`;
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
    const dbg=`${emoji[prevState||'neutral']||'?'} ${prevState||'neutral'} puff:${(s._puffVal||0).toFixed(2)}${s._puffDbg||''}`;
    window.__emotionDebug = dbg;
    window.__exprDebug = dbg;
  };
})();
