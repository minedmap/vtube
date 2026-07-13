// ── Per-model emotion → parameter mappings ──
// Only model-CUSTOM params (not standard ones gesture.js handles)
// Standard: ParamEyeLSmile/R, ParamCheek, ParamBrowLY/RY, ParamBrowLForm/RForm, ParamBrowLAngle/RAngle, ParamMouthUp/Down/Angry
// Custom only: Param104(生气), Param109(爱心), Param130(泪眼), key1(黑脸), etc.

window.__EMOTION_CFG = {
  fuxuan: {
    neutral: {},
    happy:  {},
    angry:  { Param104: 1.0 },                // 生气
    sad:    { Param130: 1.0 },                // 泪眼
    love:   { Param109: 1.0 },                // 爱心
    surprised: {},
    blush:  { Param109: 0.4 },
  },
  '辉夜姬': {
    neutral: {},
    happy:  { ParamCheekPuff: 0.5 },          // 볼빵빵
    angry:  { ParamEyeSmile_Angry_L: 1.0, ParamEyeSmile_Angry_R: 1.0, ParamCheekPuff2: 0.3 },
    sad:    { ParamExpression_1: 1.0, ParamExpression_2: 0.8 },
    love:   { ParamCheekPuff: 0.3 },
    surprised: { ParamCheekPuff: 0.8 },       // 깜짝!
    blush:  { ParamCheekPuff: 0.4 },
  },
  '火花': {
    neutral: {},
    happy:  { key2: 1.0, CheekPuff: 0.6 },    // 脸红爱心 + 볼빵빵
    angry:  { key3: 1.0, Param146: 1.0 },
    sad:    { key8: 1.0, Param142: 0.8 },
    love:   { key2: 1.0, CheekPuff: 0.7 },    // 脸红爱心 + 볼빵빵
    surprised: { CheekPuff: 0.5 },
    blush:  { key2: 0.6, CheekPuff: 0.3 },
  },
  '薇薇安': {
    neutral: {},
    happy:  {},
    angry:  { Param150: 0.5 },                // 黑脸
    sad:    { Param144: 1.0, Param145: 0.8, Param146: 0.6 },
    love:   { Param16: 0.6 },                 // 鼓脸
    surprised: { Param16: 0.8 },              // 鼓脸
    blush:  {},
  },
  '魔女': {
    neutral: {},
    happy:  {},
    angry:  {},
    sad:    {},
    love:   {},
    surprised: { Param21: 0.8 },              // 鼓脸CheeckPuff
    blush:  {},
  },
  Frieren: {
    neutral: {},
    happy:  {},
    angry:  {},
    sad:    {},
    love:   {},
    surprised: { Param21: 0.8 },              // 鼓脸CheeckPuff
    blush:  {},
  },
  huohuo: {
    neutral: {},
    happy:  {},
    angry:  { Param107: 0.8 },                // 黑脸
    sad:    { Param108: 1.0 },                // 眼泪
    love:   {},
    surprised: { Param128: 1.0 },
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
