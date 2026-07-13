window.__EMOTION_CFG = {
  fuxuan: {
    neutral: {},
    happy:  {},
    angry:  { Param104: 1.0 },
    sad:    { Param130: 1.0 },
    love:   { Param109: 1.0 },
    surprised: {},
    blush:  { Param109: 0.4 },
  },
  '辉夜姬': {
    neutral: {},
    happy:  {},
    angry:  { ParamEyeSmile_Angry_L: 1.0, ParamEyeSmile_Angry_R: 1.0, ParamCheekPuff2: 0.3 },
    sad:    { ParamExpression_1: 1.0, ParamExpression_2: 0.8 },
    love:   {},
    surprised: {},
    blush:  {},
  },
  '火花': {
    exclusiveKeys: true,
    neutral: {},
    happy:  { key2: 1.0 },
    angry:  { key3: 1.0, Param146: 1.0, Param148: 0.8 },
    sad:    { key8: 1.0, Param142: 1.0 },
    love:   { key2: 1.0, key10: 0.5 },
    surprised: { key5: 1.0 },
    blush:  { key2: 0.6 },
  },
  vivian: {
    neutral: {},
    happy:  {},
    angry:  { Param150: 0.5 },
    sad:    { Param144: 1.0, Param145: 0.8, Param146: 0.6 },
    love:   {},
    surprised: {},
    blush:  {},
  },
  '魔女': {
    neutral: {},
    happy:  {},
    angry:  {},
    sad:    {},
    love:   {},
    surprised: {},
    blush:  {},
  },
  Frieren: {
    neutral: {},
    happy:  {},
    angry:  {},
    sad:    {},
    love:   {},
    surprised: {},
    blush:  {},
  },
  huohuo: {
    neutral: {},
    happy:  {},
    angry:  { Param107: 0.8 },
    sad:    { Param108: 1.0 },
    love:   {},
    surprised: {},
    blush:  {},
  },
  RuanMei: {
    neutral: {},
    happy:  {},
    angry:  {},
    sad:    {},
    love:   {},
    surprised: {},
    blush:  {},
  },
};

// ── Cheek puff config (separate from emotion) ──
// Detected when user physically puffs cheeks
// Maps cheek puff param per model
window.__CHEEKPUFF_CFG = {
  '火花':       { CheekPuff: 1.0, CheekPuff2: 0.3, RCheekPuff: 0.5, LCheekPuff: 0.5 },
  '辉夜姬':     { ParamCheekPuff: 1.0, ParamCheekPuff2: 0.3 },
  vivian:       { Param16: 1.0 },   // 鼓脸 (Param134 鼓脸联动 is physics-linked)
  '魔女':       { Param21: 1.0 },
  Frieren:      { Param21: 1.0 },
  ellot:        { Param3: 1.0 },    // 볼부풀기
};
