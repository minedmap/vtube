// ── MLP emotion classifier (from FER2013 training) ──
// Tiny 2-layer: 24×24 (576) → 128 ReLU → 7 softmax
// Weights exported from Python training
(function() {
  let model = null;

  window.__loadEmotionModel = async function() {
    try {
      const resp = await fetch('js/emotion_model.json');
      model = await resp.json();
      console.log('[EmotionML] model loaded,', model.labels.join(','));
    } catch(e) {
      console.warn('[EmotionML] load failed:', e);
    }
  };

  // Predict emotion from a cropped 48×48 face region (canvas/imageData)
  // Returns { label, scores: {angry,disgust,fear,happy,neutral,sad,surprise} }
  window.__predictEmotion = function(imageData) {
    if (!model) return null;

    // Downsample to 24×24
    const W = model.input_size || 24;
    const sw = imageData.width / W;
    const sh = imageData.height / W;
    const pixels = new Float32Array(W * W);

    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const sx = Math.floor(x * sw);
        const sy = Math.floor(y * sh);
        const idx = (sy * imageData.width + sx) * 4;
        // Grayscale from first channel (face is grayscale anyway)
        pixels[y * W + x] = imageData.data[idx] / 255.0;
      }
    }

    // Normalize and flatten
    const input = new Float32Array(W * W);
    for (let i = 0; i < W * W; i++) {
      input[i] = (pixels[i] - model.x_mean) / model.x_std;
    }

    // Layer 1: input(576) @ W1(576×128) + b1(128) → ReLU
    const h = new Float32Array(128);
    for (let j = 0; j < 128; j++) {
      let sum = model.b1[j];
      for (let i = 0; i < W * W; i++) {
        sum += input[i] * model.W1[i][j];
      }
      h[j] = sum > 0 ? sum : 0; // ReLU
    }

    // Layer 2: h(128) @ W2(128×7) + b2(7)
    const scores = new Float32Array(7);
    for (let j = 0; j < 7; j++) {
      scores[j] = model.b2[j];
      for (let i = 0; i < 128; i++) {
        scores[j] += h[i] * model.W2[i][j];
      }
    }

    // Softmax
    let max = scores[0];
    for (let i = 1; i < 7; i++) if (scores[i] > max) max = scores[i];
    let sumExp = 0;
    const probs = new Float32Array(7);
    for (let i = 0; i < 7; i++) {
      probs[i] = Math.exp(scores[i] - max);
      sumExp += probs[i];
    }
    for (let i = 0; i < 7; i++) probs[i] /= sumExp;

    // Argmax
    let bestIdx = 0;
    for (let i = 1; i < 7; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;

    const result = { label: model.labels[bestIdx], score: probs[bestIdx] };
    result.scores = {};
    for (let i = 0; i < 7; i++) result.scores[model.labels[i]] = probs[i];
    return result;
  };
})();
