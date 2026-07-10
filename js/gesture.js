// ── Face expression classifier → model expression params ──
// Uses state.s.lastFaceLM (MediaPipe face landmarks from tracking.js)

const EXPRESSION_PARAMS = {
  happy:     { ParamMouthForm: 0.8, ParamMouthOpenY: 0.1 },
  sad:       { ParamMouthForm: -0.5, ParamEyeLOpen: 0.3 },
  angry:     { ParamMouthForm: -0.3, ParamBrowLAngle: -0.5, ParamBrowRAngle: -0.5 },
  surprised: { ParamMouthOpenY: 0.6, ParamEyeLOpen: 1, ParamEyeROpen: 1 },
  neutral:   null
};

const MODEL_EXPR_OVERRIDES = {
};

let lastExpr = null;
let exprStable = 0;

function classifyExpression(lm) {
  if (!lm || lm.length < 478) return 'neutral';

  // ── mouth ──
  const mouthDist = Math.abs(lm[13].y - lm[14].y);
  const mouthW = Math.hypot(lm[61].x - lm[291].x, lm[61].y - lm[291].y);
  const mouthCornerY = (lm[61].y + lm[291].y) / 2;
  const lipCenterY = (lm[13].y + lm[14].y) / 2;
  const faceH = Math.max(0.05, lm[152].y - lm[168].y);
  const mouthOpen = Math.min(1, Math.max(0, (mouthDist / faceH - 0.025) * 30));
  const mouthForm = ((lipCenterY - mouthCornerY) / faceH) * 4;

  // ── eyebrows ──
  const lBrowH = (lm[105].y - lm[67].y) / faceH;
  const rBrowH = (lm[334].y - lm[297].y) / faceH;
  const browRaise = (lBrowH + rBrowH) / 2;

  // ── eyes ──
  const lEyeH = Math.abs(lm[159].y - lm[145].y) / faceH * 10;
  const rEyeH = Math.abs(lm[386].y - lm[374].y) / faceH * 10;
  const eyeOpen = (Math.min(1, lEyeH) + Math.min(1, rEyeH)) / 2;

  // classify
  if (mouthForm > 0.3 && mouthOpen < 0.3) return 'happy';       // 웃음, 입 다물
  if (mouthOpen > 0.4 && eyeOpen > 0.8) return 'surprised';      // 입벌림+눈큼
  if (mouthForm < -0.2 && browRaise > 0.03) return 'sad';       // 찡그림+눈썹올림
  if (mouthForm < -0.2 && browRaise < -0.02) return 'angry';    // 찡그림+눈썹내림
  return 'neutral';
}

function applyExprToModel(model, expr, modelLabel) {
  const pi = model._paramIdx;
  if (!pi) return;
  const im = model.internalModel;
  if (!im || !im.coreModel || !im.coreModel._model) return;
  const pv = im.coreModel._model.parameters.values;

  const base = EXPRESSION_PARAMS[expr];
  if (base) {
    for (const [id, val] of Object.entries(base)) {
      if (pi[id] >= 0) pv[pi[id]] = val;
    }
  }
  const over = MODEL_EXPR_OVERRIDES[modelLabel];
  if (over && over[expr]) {
    for (const [id, val] of Object.entries(over[expr])) {
      if (pi[id] >= 0) pv[pi[id]] = val;
    }
  }
}

function updateExpressionFromFace(modelLabel) {
  const s = window.__state;
  const model = s.currentModel;
  const lm = s.lastFaceLM;
  if (!lm) {
    if (lastExpr !== null && lastExpr !== 'neutral') {
      lastExpr = 'neutral';
      if (model) applyExprToModel(model, 'neutral', modelLabel);
    }
    return;
  }

  const expr = classifyExpression(lm);
  window.__exprDebug = expr;
  if (expr === lastExpr) { exprStable++; }
  else { lastExpr = expr; exprStable = 0; return; }

  if (exprStable >= 3 && model) {
    applyExprToModel(model, expr, modelLabel);
  }
}

window.__updateExpression = updateExpressionFromFace;
