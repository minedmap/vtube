(function() {
  const setStatus = t => { const el = document.getElementById('status'); if (el) el.textContent = t; };

  // ── VTS WebSocket ──
  let vtsWs = null, vtsToken = null, vtsAuthed = false, vtsConnecting = false;
  function vtsConnect() {
    if (vtsWs || vtsConnecting) return;
    vtsConnecting = true;
    try {
      const ws = new WebSocket('wss://' + location.host + '/vts/');
      ws.onopen = () => {
        vtsWs = ws; vtsConnecting = false;
        setStatus('VTS 연결됨');
        ws.send(JSON.stringify({
          apiName: 'VTubeStudioPublicAPI', apiVersion: '1.0',
          requestID: 'auth', messageType: 'AuthenticationRequest',
          data: { pluginName: 'HermesVTube', pluginDeveloper: 'user',
            authenticationToken: vtsToken || '' }
        }));
      };
      ws.onmessage = e => {
        try {
          const r = JSON.parse(e.data);
          if (r.messageType === 'AuthenticationResponse') {
            if (r.data.authenticated) {
              vtsAuthed = true; vtsToken = r.data.authenticationToken;
              setStatus('VTS 인증됨');
            } else if (r.data.authenticationToken) {
              vtsToken = r.data.authenticationToken;
              setStatus('VTS: 토큰 입력 필요');
            }
          }
        } catch(e2) {}
      };
      ws.onclose = () => { vtsWs = null; vtsAuthed = false; vtsConnecting = false; };
      ws.onerror = () => { vtsWs = null; vtsAuthed = false; vtsConnecting = false; };
    } catch(e) { vtsConnecting = false; }
  }
  // VTS param inject helper
  const vtsInject = (paramValues) => {
    if (!vtsWs || !vtsAuthed) return;
    vtsWs.send(JSON.stringify({
      apiName: 'VTubeStudioPublicAPI', apiVersion: '1.0',
      requestID: 'param' + Date.now(), messageType: 'InjectParameterDataRequest',
      data: { parameterValues: paramValues, setValue: false }
    }));
  };
  window.__vtsConnect = vtsConnect;
  window.__vtsInject = vtsInject;
  window.__vts = { connect: vtsConnect, inject: vtsInject, get token() { return vtsToken; } };
  Object.defineProperty(window, '__vtsToken', { get: () => vtsToken, configurable: true });
  Object.defineProperty(window, '__vtsConnected', { get: () => vtsAuthed, configurable: true });
  // try connect VTS on load
  setTimeout(vtsConnect, 2000);
})();
