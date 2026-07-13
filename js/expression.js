// ── Face expression classifier ──
// Reads MediaPipe face landmarks → emotion state → model-specific params
// Called from cubism-core.js im.update

window.__updateExpression = function(modelLabel) {
  const s = window.__state;
  const cm = s.currentModel;
  if (!cm || !cm._paramIdx || !cm.internalModel) return;

  const cfg = window.__EMOTION_CFG;
  if (!cfg) return;
  const modelCfg = cfg[modelLabel];
  if (!modelCfg) {
    window.__emotionDebug = 'no-cfg';
    return;
  }

  const pi = cm._paramIdx;
  const pv = cm.internalModel.coreModel._model.parameters.values;
  const lm = s.lastFaceLM;
  if (!lm) return;

  const faceH = Math.max(0.01, lm[152].y - lm[168].y);  // chin - noseBridge

  // ── Extract face features ──
  // Mouth
  const mouthOpen = s.mouthOpen || 0;
  const mouthForm = s.mouthForm || 0;  // -1 pucker ~ 0 neutral ~ +1 smile

  // Eyes
  const eyeA = s.eyeLOpen !== undefined ? s.eyeLOpen : 1;
  const eyeB = s.eyeROpen !== undefined ? s.eyeROpen : 1;
  const avgEye = (eyeA + eyeB) / 2;

  // Eyebrows (relative height: brow-upperLid / faceH)
  const browL = lm[105] && lm[159] ? (lm[105].y - lm[159].y) / faceH : 0.05;
  const browR = lm[334] && lm[386] ? (lm[334].y - lm[386].y) / faceH : 0.05;
  const browAvg = (browL + browR) / 2;

  // Cheek raise (smile indicator: nasolabial fold area)
  const cheekL = lm[50] && lm[205] ? lm[50].y - lm[205].y : 0;

  // ── Emotion classification ──
  let emotion = 'neutral';
  let confidence = 0;

  // 1. Surprised: brows up + eyes wide + mouth open
  if (browAvg > 0.10 && avgEye > 0.75 && mouthOpen > 0.2) {
    emotion = 'surprised';
    confidence = Math.min(1, (browAvg - 0.08) * 15 + avgEye * 0.5 + mouthOpen * 0.5);
  }
  // 2. Angry: brows down + eyes narrow + mouth tight/compressed
  else if (browAvg < 0.0 && avgEye < 0.6 && mouthForm < 0.1) {
    emotion = 'angry';
    confidence = Math.min(1, (0.04 - browAvg) * 20 + (0.7 - avgEye) * 2);
  }
  // 3. Sad: brows up (inner) + mouth corners down + eyes slightly closed
  else if (browAvg > 0.06 && mouthForm < -0.05 && avgEye < 0.7) {
    emotion = 'sad';
    confidence = Math.min(1, (browAvg - 0.04) * 15 + (0.75 - avgEye) * 2 + Math.abs(Math.min(0, mouthForm)) * 3);
  }
  // 4. Blush/love: smile + cheeks raised + soft eyes
  else if (mouthForm > 0.25 && cheekL > 0.02 && avgEye > 0.5 && avgEye < 0.8) {
    emotion = 'love';
    confidence = Math.min(1, (mouthForm - 0.2) * 3 + cheekL * 10);
  }
  // 5. Happy: smile + eyes soft (squinted) + brows normal/slightly up
  else if (mouthForm > 0.15 && avgEye < 0.85) {
    emotion = 'happy';
    confidence = Math.min(1, mouthForm * 2 + (0.85 - avgEye) * 2);
  }
  // 6. Blush (gentle): slight smile + cheeks raised
  else if (mouthForm > 0.1 && cheekL > 0.01) {
    emotion = 'blush';
    confidence = Math.min(1, mouthForm * 1.5 + cheekL * 5);
  }
  // 7. Neutral
  else {
    emotion = 'neutral';
    confidence = 1;
  }

  // ── Apply model-specific params ──
  const exprMap = modelCfg[emotion];
  if (!exprMap) {
    window.__emotionDebug = emotion + '(no-map)';
    return;
  }

  // Reset ALL known state params for this model first
  for (const stateName of Object.keys(modelCfg)) {
    for (const paramId of Object.keys(modelCfg[stateName])) {
      if (pi[paramId] >= 0) pv[pi[paramId]] = 0;
    }
  }

  // Apply target emotion
  for (const [paramId, val] of Object.entries(exprMap)) {
    if (pi[paramId] >= 0) {
      pv[pi[paramId]] = val * confidence;
    }
  }

  // Override standard face tracking params with emotion-driven values
  // Only when expression is active (not neutral)
  if (emotion !== 'neutral') {
    // Eye smile for happy/love/blush
    if ((emotion === 'happy' || emotion === 'love' || emotion === 'blush') && pi.ParamEyeLSmile >= 0) {
      pv[pi.ParamEyeLSmile] = Math.max(pv[pi.ParamEyeLSmile] || 0, confidence * 0.6);
    }
  }

  // ── Debug ──
  const emojiMap = {
    neutral: '😐', happy: '😊', angry: '😠', sad: '😢',
    surprised: '😮', love: '🥰', blush: '☺️'
  };
  window.__emotionDebug = `${emojiMap[emotion]||'?'} ${emotion} ${confidence.toFixed(2)}`;
};
