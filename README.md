# VTube

웹 기반 Live2D VTuber 앱. 얼굴/손 추적, 표정 인식, RVC 음성 변환 지원.

## 기술 스택

- pixi.js 6.5.10 + pixi-live2d-display (Cubism4)
- @mediapipe/tasks-vision 0.10.17 (얼굴 + 손 랜드마커)
- Cubism5 Core
- three.js 0.160 + @pixiv/three-vrm 0.7.0 (3D/MMD)
- RVC 서버 (Python, onnxruntime, WebSocket)
- nginx 리버스 프록시

## 기능

- 얼굴 추적 (머리 회전, 눈 깜빡임, 입)
- 손 추적 (팔 IK, 손가락 컬, 손목 회전)
- 자동 캘리브레이션 (손 열기/닫기)
- 측면 보기 지원 (confidence blending)
- VTS WebSocket 인젝션
- RVC 실시간 음성 변환 (2s 청크, ~4s 지연)
- 3D 모델 지원 (VRM / MMD 업로드)
- 웨이브폼 오버레이 + 노이즈 게이트
- 모바일 최적화

## 실행

```bash
python3 vtube-server.py  # 포트 3000
# RVC 서버 (별도)
cd rvc && python3 rvc-server-v2.py  # 포트 8002
```
