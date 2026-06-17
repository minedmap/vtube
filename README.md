# VTube

Browser-based Live2D VTuber with face + hand tracking + RVC voice conversion + 3D model support.

## Models

| Name | Type | Notes |
|------|------|-------|
| Hand (20250913) | VTS Hand | Full finger tracking, wrist rotation |
| Huohuo | Cubism4 | Chinese params (Param95/124) |
| Mao | Cubism4 | Traditional CubismSample |
| Frieren | Cubism4 | Traditional CubismSample |
| Hiyori | Cubism4 | Traditional CubismSample |
| MMD (.pmx) | Three.js | BowlRoll/DeviantArt/Pixiv import |
| VRM | Three.js | @pixiv/three-vrm 0.7.0 |

## Stack

- pixi.js 6.5.10 + pixi-live2d-display (Cubism4)
- @mediapipe/tasks-vision 0.10.17 (Face + Hand Landmarker)
- Cubism5 Core
- three.js 0.160 + @pixiv/three-vrm 0.7.0 (3D/MMD)
- RVC server (Python, onnxruntime, WebSocket port 8002)
- nginx reverse proxy (WebSocket /ws/rvc → 8002)

## Features

- Face tracking (head rotation, eye blink, mouth)
- Hand tracking (arm IK, finger curl, wrist rotation)
- Auto-calibration for hand open/close
- Side view support (confidence blending)
- VTS WebSocket inject
- MIC + pitch shift (sound-1~20, +12~-7 semitones)
- RVC real-time voice conversion (2s chunk, ~4s latency)
  - WebSocket → ONNX (ContentVec + IU-Zonas)
  - Settings: pitch, response threshold, sample length, input/output noise reduction
- 3D model toggle (VRM / MMD via upload)
- Waveform overlay + noise gate + volume slider
- Mobile optimization (staggered frame detection)

## Setup

```bash
git clone https://github.com/minedmap/vtube.git
# Python HTTP server for static files
python3 vtube-server.py  # port 3000
# RVC server (requires export-venv)
cd rvc && python3 rvc-server-v2.py  # port 8002
# Serve via nginx at /vtube/
```

## RVC

RVC uses ONNX models (ContentVec 768 + IU-Zonas synth) through Python WebSocket server on port 8002. Nginx proxies `/ws/rvc` → 8002. Audio accumulates in 2s chunks for efficient CPU inference.

## Finger Tracking

3D worldLandmarks ratio-based curl. Per-finger normalization constants:

| Finger | offset | range |
|--------|--------|-------|
| Thumb | 0.15 | 0.3 |
| Index | 0.3 | 0.5 |
| Middle | 0.3 | 0.5 |
| Ring | 0.25 | 0.45 |
| Pinky | 0.15 | 0.4 |

Side view fallback via confidence blend (score 0.4~0.7).
