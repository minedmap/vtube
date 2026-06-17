// ── Camera + Face/Hand tracking loop ──
// Uses window.__state for all shared state

(function() {
  const s = window.__state;
  const SMOOTH = 0.25;

  const camBtn = document.getElementById('camBtn');
  const boxToggle = document.getElementById('boxToggle');
  const camBox = document.getElementById('camBox');

  boxToggle.onclick = () => {
    s.boxVisible = !s.boxVisible;
    camBox.style.display = s.boxVisible ? 'block' : 'none';
    boxToggle.textContent = s.boxVisible ? '박스 OFF' : '박스 ON';
  };

  camBtn.onclick = async () => {
    if (s.stream) {
      s.stream.getTracks().forEach(t=>t.stop());
      s.stream = null;
      camBox.style.display = 'none';
      boxToggle.style.display = 'none';
      camBtn.textContent = 'CAM ON';
      s.headX = 0; s.headY = 0;
      window.setStatus('준비 완료');
      return;
    }
    if (!navigator.mediaDevices) return window.setError('HTTPS 필요 (cloudflare tunnel 사용)');
    window.setStatus('카메라 권한 요청...');
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({
        video: { width:640, height:480, facingMode:'user' }
      });
      const v = document.getElementById('cam');
      v.srcObject = s.stream;
      await v.play();
      camBox.style.display = 'block';
      boxToggle.style.display = 'block';
      s.boxVisible = true;
      boxToggle.textContent = '박스 OFF';
      camBtn.textContent = 'CAM OFF';
      window.setStatus('트래킹 시작...');

      const ov = document.getElementById('ov'), oc = ov.getContext('2d', {willReadFrequently: false});
      const CW = 640, CH = 480;
      ov.width = CW; ov.height = CH;
      const handTex = new Image();
      handTex.onload = () => { s.handwearImg = handTex; };
      handTex.src = '/textures/20250913_handwear.webp';
      s.calHandMin = 0.08; s.calHandMax = 0.35;
      s.calSamples = 0;
      let tracking = false, frameCount = 0;
      s.lastHandResult = null;
      s.smoothHand = [];
      s.handChanged = false;
      s.lastFaceLM = null;
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      let tabHidden = false;
      document.addEventListener('visibilitychange', () => { tabHidden = document.hidden; });

      const HCONN = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]];

      function fingerCurlAngle(worldHl, fi) {
        if (!worldHl) return 0.5;
        const tips = [4,8,12,16,20], mcps = [2,5,9,13,17];
        const tip = worldHl[tips[fi]], mcp = worldHl[mcps[fi]], w = worldHl[0], midMcp = worldHl[9];
        if (!tip || !mcp || !w || !midMcp) return 0.5;
        const td = Math.hypot(tip.x-mcp.x, tip.y-mcp.y, tip.z-mcp.z);
        const hs = Math.hypot(midMcp.x-w.x, midMcp.y-w.y, midMcp.z-w.z) || 0.001;
        const ratio = td / hs;
        const offsets = [0.15, 0.3, 0.3, 0.25, 0.15];
        const ranges  = [0.3,  0.5, 0.5, 0.45, 0.4];
        let curl = 1 - Math.min(1, Math.max(0, (ratio - offsets[fi]) / ranges[fi]));
        if (fi === 0) curl = Math.min(1, curl * 2.5);
        return Math.min(1, Math.max(0, curl));
      }

      function hdIsRight(hd, flip) {
        return (hd.landmarks[0].x > 0.5) === flip;
      }
      function hdPrefix(hd, flip) {
        return (hd.landmarks[0].x > 0.5) !== flip ? 'HandRight' : 'HandLeft';
      }

      function loop() {
        try {
          if (tabHidden) { requestAnimationFrame(loop); return; }
          if (v.readyState >= 2) {
            oc.clearRect(0, 0, CW, CH);
            oc.drawImage(v, 0, 0, CW, CH);
            let faceResult = null;
            if (s.faceOn) {
              const fr = s.faceLandmarker.detectForVideo(v, performance.now() + 0.1);
              if (fr.faceLandmarks && fr.faceLandmarks.length > 0) {
                faceResult = fr;
                s.lastFaceLM = fr.faceLandmarks[0];
              }
            }
            if (s.faceOn && s.overlayShow && s.lastFaceLM) {
              const lm = s.lastFaceLM;
              oc.fillStyle = 'rgba(0,0,0,0.25)';
              oc.fillRect(0, 0, CW, CH);
              oc.fillStyle = '#0f0';
              for (let i = 0; i < lm.length; i++) { oc.beginPath(); oc.arc(lm[i].x*CW, lm[i].y*CH, 2, 0, Math.PI*2); oc.fill(); }
            }
            if (s.handOn) {
              const hr = s.handLandmarker.detectForVideo(v, performance.now());
              const newVal = (hr && hr.landmarks && hr.landmarks.length > 0 &&
                hr.handednesses?.length > 0 &&
                hr.handednesses.some((h, i) => h[0]?.score > 0.6)) ? hr : null;
              if (newVal) {
                s.lastHandResult = newVal;
                if (s.smoothHand.length !== newVal.landmarks.length) {
                  s.smoothHand = newVal.landmarks.map(hl => hl.map(l => ({x: l.x, y: l.y})));
                }
                s.handChanged = true;
              } else {
                s.lastHandResult = null;
                s.smoothHand = [];
              }
            } else {
              s.lastHandResult = null;
              s.smoothHand = [];
            }
            frameCount++;
            if (s.lastHandResult) {
              for (let h = 0; h < s.lastHandResult.landmarks.length; h++) {
                const raw = s.lastHandResult.landmarks[h];
                if (!s.smoothHand[h]) { s.smoothHand[h] = raw.map(l => ({x:l.x,y:l.y})); continue; }
                for (let i = 0; i < raw.length; i++) {
                  if (!s.smoothHand[h][i]) { s.smoothHand[h][i] = {x:raw[i].x,y:raw[i].y}; continue; }
                  s.smoothHand[h][i].x += (raw[i].x - s.smoothHand[h][i].x) * 0.85;
                  s.smoothHand[h][i].y += (raw[i].y - s.smoothHand[h][i].y) * 0.85;
                }
              }
            }
            s.handData = [];
            let faceBox = null;
            const faceLm = faceResult?.faceLandmarks?.[0] || s.lastFaceLM;
            if (faceLm) {
              const lm = faceLm;
              let minX=1, minY=1, maxX=0, maxY=0;
              for (let i=0;i<lm.length;i++) {
                if (lm[i].x<minX) minX=lm[i].x;
                if (lm[i].y<minY) minY=lm[i].y;
                if (lm[i].x>maxX) maxX=lm[i].x;
                if (lm[i].y>maxY) maxY=lm[i].y;
              }
              const padX = (maxX-minX)*0.15, padY = (maxY-minY)*0.15;
              faceBox = {x1:minX-padX, y1:minY-padY, x2:maxX+padX, y2:maxY+padY};
            }
            if (s.smoothHand.length > 0) {
              for (let h = 0; h < s.smoothHand.length; h++) {
                const hl = s.smoothHand[h];
                if (faceBox && hl[0].x >= faceBox.x1 && hl[0].x <= faceBox.x2 &&
                    hl[0].y >= faceBox.y1 && hl[0].y <= faceBox.y2) continue;
                const wlm = s.lastHandResult?.worldLandmarks?.[h];
                s.handData.push({
                  landmarks: hl,
                  worldLandmarks: wlm || null,
                  handedness: s.lastHandResult?.handednesses?.[h]?.[0]?.categoryName || '',
                  score: s.lastHandResult?.handednesses?.[h]?.[0]?.score || 0.7
                });
              }
            }
            if (s.overlayShow && s.handData.length > 0) {
              for (let h = 0; h < s.handData.length; h++) {
                const hl = s.handData[h].landmarks;
                const col = h === 0 ? '255,255,0' : '0,255,255';
                oc.strokeStyle = `rgba(${col},0.4)`; oc.lineWidth = 2; oc.beginPath();
                for (const [a,b] of HCONN) { oc.moveTo(hl[a].x*CW, hl[a].y*CH); oc.lineTo(hl[b].x*CW, hl[b].y*CH); }
                oc.stroke();
                oc.fillStyle = `rgb(${col})`;
                for (let i = 0; i < hl.length; i++) { oc.beginPath(); oc.arc(hl[i].x*CW, hl[i].y*CH, 3, 0, Math.PI*2); oc.fill(); }
                if (s.handwearImg) {
                  const wrist = hl[0], midMcp = hl[9], midTip = hl[12];
                  if (wrist && midMcp) {
                    const wx = wrist.x * CW, wy = wrist.y * CH;
                    const mx = midMcp.x * CW, my = midMcp.y * CH;
                    const angle = Math.atan2(my - wy, mx - wx);
                    let handSize = 160;
                    if (midTip) { const tx = midTip.x * CW, ty = midTip.y * CH; handSize = Math.hypot(tx - wx, ty - wy) * 2.0; }
                    oc.save();
                    oc.translate(wx, wy);
                    oc.rotate(angle);
                    const scale = handSize / s.handwearImg.width;
                    const sw = s.handwearImg.width * scale, sh = s.handwearImg.height * scale;
                    oc.globalAlpha = 0.85;
                    oc.drawImage(s.handwearImg, -sw/2, -sh/2, sw, sh);
                    oc.restore();
                  }
                }
              }
            }
            // ── arm from hand ──
            if (s.handData.length > 0) {
              s.armL.open = 0; s.armR.open = 0; s.armL.wx = 0; s.armR.wx = 0; s.armL.wy = 0; s.armR.wy = 0;
              for (const hd of s.handData) {
                const hl = hd.landmarks, w = hl[0], wlm = hd.worldLandmarks;
                let d = 0;
                if (wlm) {
                  for (const i of [4,8,12,16,20]) d += Math.hypot(wlm[i].x-wlm[0].x, wlm[i].y-wlm[0].y, wlm[i].z-wlm[0].z);
                } else {
                  for (const i of [4,8,12,16,20]) d += Math.hypot(hl[i].x-w.x, hl[i].y-w.y);
                }
                d = d / 5;
                s.calSamples++;
                if (d < s.calHandMin) s.calHandMin = d;
                if (d > s.calHandMax) s.calHandMax = d;
                if (s.calSamples > 30) {
                  s.calHandMin *= 0.995; s.calHandMax *= 1.005;
                }
                const range = Math.max(0.02, s.calHandMax - s.calHandMin);
                const open = Math.min(1, Math.max(0, (d - s.calHandMin) / range));
                const wx = (w.x - 0.5) * 2;
                const wy = (0.5 - w.y) * 2;
                const isRight = hdIsRight(hd, s.flipX);
                if (isRight) { s.armR.open = open; s.armR.wx = wx; s.armR.wy = wy; }
                else { s.armL.open = open; s.armL.wx = wx; s.armL.wy = wy; }
              }
            } else {
              const decay = 0.92;
              for (const arm of [s.armL, s.armR]) {
                arm.open *= decay; arm.wx *= decay; arm.wy *= decay;
                if (Math.abs(arm.open) < 0.001) arm.open = 0;
                if (Math.abs(arm.wx) < 0.001) arm.wx = 0;
                if (Math.abs(arm.wy) < 0.001) arm.wy = 0;
              }
            }
            const cm = s.currentModel;
            if (cm) {
              const pi = cm._paramIdx;
              if (pi) {
                const pv = cm.internalModel.coreModel._model.parameters.values;
                const pi15 = pi.Param15, pi21 = pi.Param21;
                let handTrackR = 0, handTrackL = 0;
                for (const hd of s.handData) {
                  if (hdIsRight(hd, s.flipX)) handTrackR = 1; else handTrackL = 1;
                }
                if (pi15 >= 0) pv[pi15] = handTrackR * 30;
                if (pi21 >= 0) pv[pi21] = handTrackL * 30;
                // VTS inject
                if (window.__vtsConnected && s.handData.length > 0) {
                  const vtsParams = [];
                  for (const hd of s.handData) {
                    const isRight = hdIsRight(hd, s.flipX);
                    const side = isRight ? 'Right' : 'Left';
                    const wx = (hd.landmarks[0].x - 0.5) * 2, wy = (0.5 - hd.landmarks[0].y) * 2;
                    const open = isRight ? s.armR.open : s.armL.open;
                    vtsParams.push({id: 'Hand'+side+'AngleZ', value: wx * 30});
                    vtsParams.push({id: 'Hand'+side+'AngleX', value: wy * 30});
                    vtsParams.push({id: side==='Right'?'handRightOpen':'handLeftOpen', value: open * 60 - 30});
                    vtsParams.push({id: 'Hand'+side+'PositionX', value: wx * 0.5});
                    vtsParams.push({id: 'Hand'+side+'PositionY', value: wy * 0.5});
                    const blend = Math.min(1, Math.max(0, (hd.score - 0.4) / 0.3));
                    for (let fi = 0; fi < 5; fi++) {
                      const fn = ['_1_Thumb','_2_Index','_3_Middle','_4_Ring','_5_Pinky'][fi];
                      const flex = fingerCurlAngle(hd.worldLandmarks, fi);
                      vtsParams.push({id: 'Hand'+side+'Finger'+fn, value: flex * 60 * blend + open * 60 * (1 - blend) - 30});
                    }
                  }
                  window.__vtsInject(vtsParams);
                }
                // finger tracking
                const fingerNames = ['_1_Thumb', '_2_Index', '_3_Middle', '_4_Ring', '_5_Pinky'];
                for (const hd of s.handData) {
                  const prefix = hdPrefix(hd, s.flipX);
                  const isRight = hdIsRight(hd, s.flipX);
                  const open = isRight ? s.armR.open : s.armL.open;
                  const blend = Math.min(1, Math.max(0, (hd.score - 0.4) / 0.3));
                  for (let fi = 0; fi < 5; fi++) {
                    const fid = prefix + 'Finger' + fingerNames[fi];
                    if (pi[fid] >= 0) {
                      const flex = fingerCurlAngle(hd.worldLandmarks, fi);
                      pv[pi[fid]] = (flex * 60 - 30) * blend + (open * 60 - 30) * (1 - blend);
                    }
                  }
                }
                // wrist rotation
                if (pi.Param18 >= 0) {
                  for (const hd of s.handData) {
                    if (!hdIsRight(hd, s.flipX)) continue;
                    const raw = s.lastHandResult?.landmarks?.[s.handData.indexOf(hd)];
                    if (!raw) continue;
                    const roll = Math.atan2(raw[17].y - raw[5].y, raw[17].x - raw[5].x);
                    pv[pi.Param18] = roll * 20;
                  }
                }
                // universal hand-to-arm mapping
                for (const hd of s.handData) {
                  const isRight = hdIsRight(hd, s.flipX);
                  const wx = (hd.landmarks[0].x - 0.5) * 2;
                  const wy = (0.5 - hd.landmarks[0].y) * 2;
                  if (pi['Param95'] >= 0) pv[pi['Param95']] = (isRight ? s.armR.open : s.armL.open) * 30;
                  if (pi['Param124'] >= 0) pv[pi['Param124']] = Math.max(0, (0.5 - wy)) * 30;
                  if (pi['Param91'] >= 0) pv[pi['Param91']] = s.flipX ? 30 : 0;
                  if (pi['Param7'] >= 0) pv[pi['Param7']] = wx * 15;
                  if (pi['Param8'] >= 0) pv[pi['Param8']] = wy * 15;
                  if (pi['Param113'] >= 0 && !isRight) pv[pi['Param113']] = wx * 30;
                  if (pi['Param114'] >= 0 && isRight) pv[pi['Param114']] = wx * 30;
                  if (pi['Param112'] >= 0) pv[pi['Param112']] = (isRight ? 1:-1) * wx * 20;
                  if (pi['Param29'] >= 0) pv[pi['Param29']] = (isRight ? 1:-1) * wx * 20;
                  if (pi['Param30'] >= 0) pv[pi['Param30']] = wy * 20;
                  if (pi['Param31'] >= 0) pv[pi['Param31']] = (isRight ? s.armR.open : s.armL.open) * 30;
                }
              }
            }
            // face tracking data
            let handsOff = 1;
            if (s.handData.length > 0) {
              for (const hd of s.handData) {
                const w = hd.landmarks[0];
                if (w.x > 0.2 && w.x < 0.8 && w.y > 0.05 && w.y < 0.55) { handsOff = 0; break; }
              }
            }
            if (faceResult && faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
              const lm = faceResult.faceLandmarks[0];
              if (!tracking) { tracking = true; window.setStatus('트래킹 중'); }
              const nose = lm[1], lEar = lm[234], rEar = lm[454];
              const chin = lm[152], noseBridge = lm[168];
              const faceW = Math.max(0.05, rEar.x - lEar.x);
              const yawRaw = ((nose.x - (lEar.x + rEar.x)/2) / faceW) * 2;
              const faceH = Math.max(0.05, chin.y - noseBridge.y);
              const pitchRaw = (0.32 - (nose.y - noseBridge.y) / faceH) * 6;
              const yawClamp = Math.max(-1, Math.min(1, yawRaw));
              const pitchClamp = Math.max(-1, Math.min(1, pitchRaw));
              const smoothFactor = SMOOTH * (handsOff > 0 ? 1 : 0.1);
              s.rawX += (yawClamp - s.rawX) * smoothFactor;
              s.rawY += (pitchClamp - s.rawY) * smoothFactor;
              s.headX = s.flipX ? -s.rawX : s.rawX;
              s.headY = s.rawY;
              window.__mmdFace = { yaw: s.headX * 0.3, pitch: -s.headY * 0.3 };
              const mouthDist = Math.abs(lm[13].y - lm[14].y);
              const mOpen = Math.min(1, Math.max(0, (mouthDist / faceH - 0.025) * 30));
              s.mouthOpen = mOpen < 0.1 ? 0 : mOpen;
              const lEyeH = Math.abs(lm[159].y - lm[145].y) / faceH * 10;
              const rEyeH = Math.abs(lm[386].y - lm[374].y) / faceH * 10;
              s.eyeLOpen = Math.min(1, Math.max(0.05, lEyeH));
              s.eyeROpen = Math.min(1, Math.max(0.05, rEyeH));
              window.setStatus('X:'+Math.round(s.rawX*100)+' Y:'+Math.round(s.rawY*100)+' 손:'+s.handData.length);
            } else if (s.handData.length > 0 && !tracking) {
              tracking = true;
              window.setStatus('트래킹 중');
            } else if (faceResult && tracking) {
              tracking = false;
              window.setStatus('얼굴 감지 안 됨');
            }
          }
        } catch(e) {}
        requestAnimationFrame(loop);
      }
      loop();
    } catch(err) {
      window.setError('카메라: '+err.message);
    }
  };
})();
