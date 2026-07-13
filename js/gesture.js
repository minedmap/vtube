// ── 얼굴 표정 분석 → 모델 표정 파라미터 (연속 블렌딩) ──
// MediaPipe FaceMesh 랜드마크(s.lastFaceLM)에서 표정 특징을 뽑아
// happy/surprised/angry/sad 강도(0~1)를 계산하고, 라이브 트래킹이
// 건드리지 않는 파라미터(눈썹/눈웃음/볼/입 특수)를 강도에 비례해 얹는다.
//
// 라이브 트래킹(cubism-core.js im.update)이 먼저 머리/입/눈깜빡임을 세팅한 뒤
// 이 함수가 호출되므로, 여기선 "표정 레이어"만 추가로 덮어쓴다.

(function() {

  // ── 튜닝 상수 (window.__exprCfg 로 런타임 조정 가능) ──
  const CFG = window.__exprCfg = {
    gainHappy:     20,   // 웃음(입꼬리) 민감도
    gainHappyWide: 0,    // 입 가로 벌어짐 미사용
    happyMinSmile: 0.004, // 입꼬리 최소 변화량(이하 무시)
    gainSurprise:  5,    // 놀람(입 벌림) 민감도
    gainSurpBrow:  11,   // 놀람(눈썹 올림) 민감도
    gainSurpEye:   8,    // 놀람(눈 크게) 민감도
    gainAngryBrow: 10,   // 화남(눈썹 내림) 민감도 ↓ (고개들때 false 방지)
    gainAngryFurr: 18,   // 화남(미간 좁힘) 민감도 ↓
    gainSadCorner: 12,   // 슬픔(입꼬리 내림) 민감도
    gainSadBrow:   9,    // 슬픔(눈썹 안쪽 올림) 민감도
    smooth:        0.4,  // 강도 시간 스무딩(클수록 빠름)
    calRate:       0.015, // 중립 기준 자동 학습 속도 ↑
    calActivity:   0.12, // 이 강도 미만일 때만 중립 기준 갱신 ↓
  };

  // 표정별 → 파라미터 기여도. value = 강도(0~1) * gain 으로 곱해 절대값 세팅.
  // 여기 나열된 파라미터는 라이브 트래킹이 안 건드리는 것만(표정 레이어 전용).
  const EMOTION_PARAMS = {
    happy: {
      ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0,   // 눈웃음(반달눈)
      ParamCheek: 0.7,                             // 볼 홍조
      ParamBrowLY: 0.15, ParamBrowRY: 0.15,        // 눈썹 살짝 올림
      ParamMouthUp: 1.0,                           // Mao 전용
    },
    surprised: {
      ParamBrowLY: 1.0, ParamBrowRY: 1.0,          // 눈썹 확 올림
      ParamBrowLForm: 0.5, ParamBrowRForm: 0.5,
      ParamEyeLSmile: -0.4, ParamEyeRSmile: -0.4,  // 눈웃음 해제(동그란 눈)
    },
    angry: {
      ParamBrowLAngle: -1.0, ParamBrowRAngle: -1.0, // 눈썹 안쪽 내림(V자)
      ParamBrowLY: -0.6, ParamBrowRY: -0.6,
      ParamBrowLForm: -1.0, ParamBrowRForm: -1.0,
      ParamMouthAngry: 1.0, ParamMouthAngryLine: 0.8, // Mao 전용
    },
    sad: {
      ParamBrowLAngle: 0.6, ParamBrowRAngle: 0.6,   // 눈썹 안쪽 올림(八자)
      ParamBrowLY: 0.3, ParamBrowRY: 0.3,
      ParamBrowLForm: 0.6, ParamBrowRForm: 0.6,
      ParamMouthDown: 1.0,                          // Mao 전용
    },
  };

  // 표정 레이어가 관리하는 전체 파라미터(안 쓰일 때 0으로 리셋 → 잔상 방지)
  const RESET_IF_UNUSED = [
    'ParamEyeLSmile','ParamEyeRSmile','ParamCheek',
    'ParamBrowLY','ParamBrowRY','ParamBrowLForm','ParamBrowRForm',
    'ParamBrowLAngle','ParamBrowRAngle',
    'ParamMouthUp','ParamMouthDown','ParamMouthAngry','ParamMouthAngryLine',
  ];

  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

  // 표정 강도(스무딩된 값) + 자동 보정 중립 기준
  const emo = { happy: 0, surprised: 0, angry: 0, sad: 0 };
  let neutral = null; // 사용자별 무표정 특징 기준

  // ── 랜드마크 → 정규화된 표정 특징 추출 ──
  function extractFeatures(lm) {
    const faceH = Math.max(0.05, lm[152].y - lm[168].y);      // 턱-콧대
    const faceW = Math.max(0.05, Math.abs(lm[454].x - lm[234].x)); // 좌우 귀

    // 입
    const mouthOpen = Math.abs(lm[13].y - lm[14].y) / faceH;
    const mouthWidth = Math.abs(lm[61].x - lm[291].x) / faceW;
    const cornerY = (lm[61].y + lm[291].y) / 2;
    const lipCenterY = (lm[13].y + lm[14].y) / 2;
    const smile = (lipCenterY - cornerY) / faceH;   // +면 입꼬리가 위(웃음)

    // 눈썹 (위로 갈수록 y 작음 → gap 클수록 올라간 것)
    const browRaiseL = (lm[159].y - lm[52].y) / faceH;
    const browRaiseR = (lm[386].y - lm[282].y) / faceH;
    const browRaise = (browRaiseL + browRaiseR) / 2;
    const innerGap = Math.abs(lm[55].x - lm[285].x) / faceW; // 미간 폭(좁으면 찡그림)

    // 눈 열림
    const eyeOpenL = Math.abs(lm[159].y - lm[145].y) / faceH;
    const eyeOpenR = Math.abs(lm[386].y - lm[374].y) / faceH;
    const eyeOpen = (eyeOpenL + eyeOpenR) / 2;

    return { mouthOpen, mouthWidth, smile, browRaise, innerGap, eyeOpen };
  }

  // ── 특징 → 표정 강도 계산 ──
  function computeEmotions(f, n) {
    const dSmile  = f.smile - n.smile;
    const dWidth  = f.mouthWidth - n.mouthWidth;
    const dOpen   = f.mouthOpen - n.mouthOpen;
    const dBrow   = f.browRaise - n.browRaise;
    const dFurrow = n.innerGap - f.innerGap;   // +면 미간 좁혀짐
    const dEye    = f.eyeOpen - n.eyeOpen;

    const happy = clamp01(dSmile > CFG.happyMinSmile ? dSmile * CFG.gainHappy : 0);
    // 놀람: 입 벌림 + 눈썹 올림 + 눈 크게 (여러 신호 합)
    const surprised = clamp01(
      Math.max(0, dOpen) * CFG.gainSurprise * 0.5 +
      Math.max(0, dBrow) * CFG.gainSurpBrow * 0.3 +
      Math.max(0, dEye)  * CFG.gainSurpEye  * 0.2
    );
    // 화남: 눈썹 내림 + 미간 좁힘
    const angry = clamp01(
      Math.max(0, -dBrow) * CFG.gainAngryBrow * 0.6 +
      Math.max(0, dFurrow) * CFG.gainAngryFurr * 0.4
    );
    // 슬픔: 입꼬리 내림 + 눈썹 안쪽 올림 (웃음/놀람일 땐 억제)
    let sad = clamp01(
      Math.max(0, -dSmile) * CFG.gainSadCorner * 0.7 +
      Math.max(0, dBrow) * CFG.gainSadBrow * 0.3
    );
    sad *= (1 - Math.max(happy, surprised));

    return { happy, surprised, angry, sad };
  }

  // ── 중립 기준 자동 보정 ──
  function updateNeutral(f) {
    if (!neutral) { neutral = { ...f }; return; }
    // 현재 표정 활동량이 낮을 때만 무표정 기준을 천천히 따라감
    const activity = Math.max(emo.happy, emo.surprised, emo.angry, emo.sad);
    if (activity < CFG.calActivity) {
      for (const k in neutral) neutral[k] += (f[k] - neutral[k]) * CFG.calRate;
    }
  }
  // 수동 재보정: 무표정으로 있을 때 호출
  window.__exprCal = function() { neutral = null; };

  // ── 모델에 표정 파라미터 적용 ──
  function applyToModel(model, modelLabel) {
    const pi = model._paramIdx;
    if (!pi) return;
    // exclusive-key model: gesture.js emotion params not needed — expression.js handles it
    const cfg = window.__EMOTION_CFG;
    if (cfg && cfg[modelLabel] && cfg[modelLabel].exclusiveKeys) return;
    const im = model.internalModel;
    if (!im || !im.coreModel || !im.coreModel._model) return;
    const pv = im.coreModel._model.parameters.values;

    // 표정 레이어 전용 파라미터: 강도 합산 후 절대값 세팅(중립이면 0 → 자연 복귀)
    const off = {};
    for (const name in EMOTION_PARAMS) {
      const intensity = emo[name];
      if (intensity < 0.01) continue;
      const map = EMOTION_PARAMS[name];
      for (const id in map) off[id] = (off[id] || 0) + map[id] * intensity;
    }
    for (const id in off) {
      const i = pi[id];
      if (i >= 0) pv[i] = Math.max(-1, Math.min(1.4, off[id]));
    }
    // EMOTION_PARAMS 에 없는 표정 전용 파라미터도 확실히 0으로(잔상 방지)
    for (const id of RESET_IF_UNUSED) {
      if (!(id in off) && pi[id] >= 0) pv[pi[id]] = 0;
    }

    // 라이브 트래킹이 매 프레임 절대값으로 다시 쓰는 파라미터엔 부스트만 더함
    // (놀람: 눈 크게 + 입 더 벌림)
    const u = emo.surprised;
    if (u > 0.01) {
      if (pi.ParamEyeLOpen >= 0 && pv[pi.ParamEyeLOpen] > 0.4)
        pv[pi.ParamEyeLOpen] = Math.min(1.4, pv[pi.ParamEyeLOpen] + u * 0.4);
      if (pi.ParamEyeROpen >= 0 && pv[pi.ParamEyeROpen] > 0.4)
        pv[pi.ParamEyeROpen] = Math.min(1.4, pv[pi.ParamEyeROpen] + u * 0.4);
      if (pi.ParamMouthOpenY >= 0)
        pv[pi.ParamMouthOpenY] = Math.min(1, pv[pi.ParamMouthOpenY] + u * 0.3);
    }
  }

  // ── 매 프레임 진입점 (cubism-core.js im.update 에서 호출) ──
  function updateExpressionFromFace(modelLabel) {
    const s = window.__state;
    const model = s.currentModel;
    const lm = s.lastFaceLM;

    let target;
    if (!lm || lm.length < 478) {
      target = { happy: 0, surprised: 0, angry: 0, sad: 0 }; // 얼굴 없으면 무표정으로 복귀
    } else {
      const f = extractFeatures(lm);
      updateNeutral(f);
      target = neutral ? computeEmotions(f, neutral) : { happy: 0, surprised: 0, angry: 0, sad: 0 };
    }

    // 강도 시간 스무딩
    for (const k in emo) emo[k] += (target[k] - emo[k]) * CFG.smooth;

    if (model) applyToModel(model, modelLabel);

    // 디버그 표시(상태줄 EXPR:)
    let dom = 'neutral', dv = 0.12;
    for (const k in emo) if (emo[k] > dv) { dom = k; dv = emo[k]; }
    window.__exprDebug = dom === 'neutral' ? 'neutral' : `${dom} ${dv.toFixed(2)}`;
    window.__exprScores = emo;
  }

  window.__updateExpression = updateExpressionFromFace;
})();
