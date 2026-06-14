# VTube

Browser-based Live2D VTuber with face + hand tracking.

## Models

| Name | Type | Notes |
|------|------|-------|
| Hand (20250913) | VTS Hand | Full finger tracking, wrist rotation |
| Huohuo | Cubism4 | Chinese params (Param95/124) |
| Mao | Cubism4 | Traditional CubismSample |
| Frieren | Cubism4 | Traditional CubismSample |
| Hiyori | Cubism4 | Traditional CubismSample |

## Stack

- pixi.js 6.5.10 + pixi-live2d-display (Cubism4)
- @mediapipe/tasks-vision 0.10.17 (Face + Hand Landmarker)
- Cubism5 Core (live2dcubismcore.min.js)
- nginx reverse proxy (via Cloudflare tunnel for HTTPS)

## Features

- Face tracking (head rotation, eye blink, mouth)
- Hand tracking (arm IK, finger curl, wrist rotation)
- Auto-calibration for hand open/close
- Side view support (confidence blending)
- VTS WebSocket inject
- Mobile optimization (staggered frame detection)

## Setup

```
git clone https://github.com/minedmap/vtube.git
# Serve via nginx at /vtube/
# HTTPS required for camera access
```

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
