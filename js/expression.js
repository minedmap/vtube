// ── Face expression classifier ──
// Reads face landmarks from tracking state, outputs expression parameter.
// Called from cubism-core.js im.update

window.__updateExpression = function(modelLabel) {
  const s = window.__state;
  const cm = s.currentModel;
  if (!cm || !cm._paramIdx || !cm.internalModel) return;
  const pi = cm._paramIdx;
  const pv = cm.internalModel.coreModel._model.parameters.values;
  const lm = s.lastFaceLM;
  if (!lm) return;

  // 얼굴 랜드마크 기반 표정 분류
  const faceH = Math.max(0.01, lm[152].y - lm[168].y);  // chin - noseBridge
  const mouthOpen = s.mouthOpen || 0;
  const eyeA = s.eyeLOpen || 1;
  const eyeB = s.eyeROpen || 1;
  const avgEye = (eyeA + eyeB) / 2;
  const mouthForm = s.mouthForm || 0;

  // 눈썹 높이 (눈썹-눈 거리 / 얼굴 높이)
  const browL = (lm[105].y - lm[159].y) / faceH;
  const browR = (lm[334].y - lm[386].y) / faceH;
  const browAvg = (browL + browR) / 2;

  // 분류
  let exprId = null;

  // 慌张 (flustered): 입 벌림 + 눈 큼 + 눈썹 올림
  if (mouthOpen > 0.25 && avgEye > 0.7 && browAvg > 0.08) {
    exprId = 'Param132';
  }
  // 哭 (cry): 입 약간 벌림 + 눈썹 내림
  else if (mouthOpen > 0.1 && browAvg < 0.02) {
    exprId = 'Param144';
  }
  // 害羞 (shy): 웃음 + 눈 약간 감음
  else if (mouthForm > 0.3 && avgEye < 0.6) {
    exprId = 'Param149';
  }
  // 白眼 (eye roll): 눈 감고 눈썹 올림 (눈을 위로)
  else if (avgEye < 0.3 && browAvg > 0.06) {
    exprId = 'Param135';
  }
  // 伞关闭: 고개 숙임
  else if (s.headY > 0.5) {
    exprId = 'Param140';
  }
  // 黑脸: 아무 표정
  else if (mouthOpen < 0.05 && avgEye > 0.7 && browAvg < 0.04) {
    exprId = null; // neutral
  }

  // 기존 표현 파라미터 초기화
  const allExpr = ['Param132','Param144','Param149','Param135','Param140','Param150'];
  for (const pid of allExpr) {
    if (pi[pid] >= 0) pv[pi[pid]] = 0;
  }

  // 현재 표정 적용
  if (exprId && pi[exprId] >= 0) {
    pv[pi[exprId]] = 1.0;
  }

  // 디버그 표시
  const names = {Param132:'慌张',Param144:'哭',Param149:'害羞',Param135:'白眼',Param140:'伞关闭',Param150:'黑脸'};
  window.__exprDebug = exprId ? (names[exprId]||exprId) : 'normal';
};
