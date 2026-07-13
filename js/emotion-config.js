// ── Per-model emotion → parameter mappings ──
// Each entry: { stateName: { paramName: value, ... } }
// Values: 0-1 float. null = disable that param
window.__EMOTION_CFG = {
  fuxuan: {
    neutral: {},
    happy:  { Param109: 0.8 },               // 爱心
    angry:  { Param104: 1.0 },               // 生气
    sad:    { Param130: 1.0 },               // 泪眼
    love:   { Param109: 1.0, ParamCheek: 0.6 },
    surprised: {},
    blush:  { ParamCheek: 0.5, Param109: 0.3 },
  },
  '辉夜姬': {
    neutral: {},
    happy:  { ParamExpression_3: 1.0, ParamEyeLSmile: 0.8, ParamEyeRSmile: 0.8, ParamCheek: 0.4 },
    angry:  { ParamEyeSmile_Angry_L: 1.0, ParamEyeSmile_Angry_R: 1.0 },
    sad:    { ParamExpression_1: 1.0, ParamExpression_2: 1.0 },  // 眼泪+泪珠
    love:   { ParamCheek: 0.7 },
    surprised: { ParamEyeLSmile: 0.5, ParamEyeRSmile: 0.5 },
    blush:  { ParamCheek: 0.6 },
  },
  '火花': {
    neutral: { key1: 0, key2: 0, key3: 0, key8: 0 },
    happy:  { key2: 1.0, CheekPuff: 0.3 },  // 脸红爱心
    angry:  { key3: 1.0, key1: 0.5, Param146: 1.0 },  // 生气+黑脸
    sad:    { key8: 1.0, Param142: 0.8 },    // 流泪
    love:   { key2: 1.0, CheekPuff: 0.5 },
    surprised: {},
    blush:  { key2: 0.6 },
  },
  '薇薇安': {
    neutral: {},
    happy:  { ParamCheek: 0.4, ParamEyeLSmile: 0.6, ParamEyeRSmile: 0.6 },
    angry:  { Param150: 0.5 },                // 黑脸
    sad:    { Param144: 1.0, Param145: 0.8, Param146: 0.6 },  // 哭
    love:   { ParamCheek: 0.6, Param16: 0.3 },
    surprised: { Param16: 0.8 },             // 鼓脸
    blush:  { ParamCheek: 0.7 },
  },
  huohuo: {
    neutral: {},
    happy:  { ParamCheek: 0.4, Param3: 0.5, Param6: 0.5 },
    angry:  { Param107: 0.8 },
    sad:    { Param108: 1.0 },
    love:   { ParamCheek: 0.6, Param3: 0.3, Param6: 0.3 },
    surprised: { Param128: 1.0 },            // 旗子挡脸
    blush:  { ParamCheek: 0.7 },
  },
  RuanMei: {
    neutral: {},
    happy:  { ParamCheek: 0.5, ParamEyeLSmile: 0.7, ParamEyeRSmile: 0.7 },
    angry:  {},
    sad:    {},
    love:   { ParamCheek: 0.7, Param3: 0.4, Param6: 0.4 },
    surprised: {},
    blush:  { ParamCheek: 0.8 },
  },
};
