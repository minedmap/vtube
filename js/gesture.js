// ── Hand gesture classifier → expression params ──

// 제스처 분류: 5개 손가락 굽힘값(0~1) 받아서 이름 반환
function classifyGesture(curls) {
  const [thumb, index, middle, ring, pinky] = curls;
  const ext = c => c < 0.3;  // 펴짐
  const curled = c => c > 0.6; // 말림

  if (ext(index) && curled(middle) && curled(ring) && curled(pinky)) return 'point';
  if (ext(index) && ext(middle) && curled(ring) && curled(pinky)) return 'v';
  if (ext(thumb) && ext(index) && ext(middle) && curled(ring) && curled(pinky)) return 'three';
  if (ext(thumb) && ext(index) && ext(middle) && ext(ring) && curled(pinky)) return 'four';
  if (curled(thumb) && curled(index) && curled(middle) && curled(ring) && curled(pinky)) return 'fist';
  if (ext(thumb) && curled(index) && curled(middle) && curled(ring) && curled(pinky)) return 'thumbs_up';
  if (ext(thumb) && ext(index) && curled(middle) && curled(ring) && ext(pinky)) return 'rock'; // 코르나
  if (ext(index) && curled(middle) && curled(ring) && ext(pinky)) return 'spider';
  if (ext(thumb) && curled(index) && curled(middle) && curled(ring) && curled(pinky)) return 'like';
  if (curled(thumb) && ext(index) && ext(middle) && ext(ring) && ext(pinky)) return 'ok';
  if (ext(thumb) && ext(index) && ext(middle) && ext(ring) && ext(pinky)) return 'open_palm';
  return 'neutral';
}

// 제스처 → 모델 파라미터 값 매핑
// 각 모델별 custom param 적용 가능, 기본은 live2d 표준
// 값이 null이면 해당 파라미터 변경 안 함
const GESTURE_PARAMS = {
  point:    { ParamMouthOpenY: 0.3, ParamMouthForm: 0.5 },  // 지적 → 신난 표정
  v:        { ParamMouthForm: -0.5, ParamEyeLOpen: 0.3 },   // 브이 → 윙크
  three:    { ParamMouthOpenY: 0.4 },                        // 3 → 놀람
  four:     { ParamMouthOpenY: 0.5 },
  fist:     { ParamMouthForm: -0.3 },                        // 주먹 → 진지
  thumbs_up: { ParamMouthForm: 0.8, ParamEyeLOpen: 1 },     // 최고 → 크게 웃음
  rock:     { ParamMouthOpenY: 0.2, ParamMouthForm: 0.3 },
  spider:   { ParamMouthOpenY: 0.2 },
  like:     { ParamMouthForm: 0.8 },
  ok:       { ParamMouthOpenY: 0.3, ParamEyeLOpen: 0.2 },
  open_palm: null,   // 손 전체 펼침 → 변화 없음
  neutral:  null     // 기본
};

// 모델별 제스처 파라미터 오버라이드
const MODEL_GESTURE_OVERRIDES = {
  Sparkle: {
    point:   { Param25: 0.5 },
    v:       { Param25: 0.5, Param22: 0 },
    three:   { Param25: 0.3 },
    four:    { Param25: 0.7 },
    fist:    { Param25: 1.0 },
    thumbs_up: { Param25: 1.0, Param139: 0 },
    rock:    { Param25: 0.5 },
    spider:  { Param25: 0.3 },
    like:    { Param25: 1.0 },
    ok:      { Param25: 0.5 },
    open_palm: { Param25: 0 },
    neutral: { Param25: 0 }
  }
};

let lastGesture = null;
let gestureStableCount = 0;

function applyGestureToModel(model, gesture, modelLabel) {
  const pi = model._paramIdx;
  if (!pi) return;
  const im = model.internalModel;
  if (!im || !im.coreModel || !im.coreModel._model) return;
  const pv = im.coreModel._model.parameters.values;

  // 기본 파라미터
  const baseParams = GESTURE_PARAMS[gesture];
  if (baseParams) {
    for (const [id, val] of Object.entries(baseParams)) {
      if (pi[id] >= 0) pv[pi[id]] = val;
    }
  }

  // 모델별 오버라이드
  const overrides = MODEL_GESTURE_OVERRIDES[modelLabel];
  if (overrides) {
    const gp = overrides[gesture];
    if (gp) {
      for (const [id, val] of Object.entries(gp)) {
        if (pi[id] >= 0) pv[pi[id]] = val;
      }
    }
  }

  window.__gestureDebug = { gesture, params: { ...baseParams, ...(overrides?.[gesture]||{}) } };
}

// 메인 분류 함수: handData에서 손가락 curl 계산 → 제스처 → 모델 적용
function updateGestureFromHand(handData, model, modelLabel) {
  if (!handData || handData.length === 0) {
    if (lastGesture !== null) {
      lastGesture = null;
      gestureStableCount = 0;
      // 기본값 복원 (neutral)
      if (model) applyGestureToModel(model, 'neutral', modelLabel);
    }
    return;
  }

  // 첫 번째 손만 사용
  const hd = handData[0];
  if (!hd.worldLandmarks) return;

  const curls = [];
  for (let fi = 0; fi < 5; fi++) {
    curls.push(fingerCurlAngle(hd.worldLandmarks, fi));
  }

  const gesture = classifyGesture(curls);

  // 안정화: 같은 제스처 3프레임 유지 시 적용
  if (gesture === lastGesture) {
    gestureStableCount++;
  } else {
    lastGesture = gesture;
    gestureStableCount = 0;
    return;
  }

  if (gestureStableCount >= 3 && model) {
    applyGestureToModel(model, gesture, modelLabel);
  }
}

// init: __state에 함수 노출
window.__updateGesture = updateGestureFromHand;
