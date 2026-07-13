#!/usr/bin/env python3
"""Upload server for VTube - MMD + Live2D ZIP uploads"""
import json, os, zipfile, tempfile, shutil, sys, re
from http.server import HTTPServer, BaseHTTPRequestHandler

MMD_DIR = '/home/ubuntu/vtube/models/mmd'
L2D_DIR = '/home/ubuntu/vtube/models'
os.makedirs(MMD_DIR, exist_ok=True)

def parse_multipart(body, ctype):
    import email.parser
    from email.policy import default
    msg = email.parser.BytesParser(policy=default).parsebytes(
        b'Content-Type: ' + ctype.encode() + b'\n\n' + body)
    for part in msg.walk():
        if part.get_content_maintype() == 'multipart': continue
        fn = part.get_filename()
        if fn: return fn, part.get_payload(decode=True)
    return None, None

class UploadHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write((UPLOAD_HTML).encode())

    def do_POST(self):
        try:
            clen = int(self.headers.get('Content-Length', 0))
            ctype = self.headers.get('Content-Type', '')
            if clen == 0 or 'multipart/form-data' not in ctype:
                return self._resp(400, {'ok':False,'error':'Bad request'})
            body = self.rfile.read(clen)
            fname, data = parse_multipart(body, ctype)
            if not fname:
                return self._resp(400, {'ok':False,'error':'No file'})
            fnl = fname.lower()
            if not fnl.endswith('.zip'):
                return self._resp(400, {'ok':False,'error':'ZIP only'})
            tmp = tempfile.mkdtemp()
            try:
                zippath = os.path.join(tmp, fname)
                with open(zippath, 'wb') as f: f.write(data)
                with zipfile.ZipFile(zippath) as zf: zf.extractall(tmp)

                # Detect type
                l2d_files = []
                mmd_files = []
                for root, dirs, files in os.walk(tmp):
                    for f in files:
                        if f.endswith('.model3.json'): l2d_files.append(os.path.join(root, f))
                        if f.endswith(('.pmx', '.pmd', '.vmd')): mmd_files.append(os.path.join(root, f))

                if l2d_files:
                    # Live2D - extract to /models/<dirname>/
                    mf = l2d_files[0]
                    base = os.path.dirname(mf)
                    dirname = os.path.basename(base)
                    if not dirname or dirname == tmp.strip('/'):
                        # Use ZIP filename
                        dirname = re.sub(r'[^a-zA-Z0-9_-]', '_', os.path.splitext(fname)[0])
                    dst = os.path.join(L2D_DIR, dirname)
                    n = 1
                    while os.path.exists(dst):
                        dst = os.path.join(L2D_DIR, f'{dirname}_{n}')
                        n += 1
                    shutil.copytree(base, dst, dirs_exist_ok=True)
                    # Find .model3.json path relative to models/
                    rel = os.path.relpath(os.path.join(dst, os.path.basename(mf)), L2D_DIR)
                    return self._resp(200, {'ok':True, 'type':'live2d', 'dir':dirname, 'model3':f'/models/{rel}', 'path':f'/models/{rel}'})

                if mmd_files:
                    copied = []
                    for src in mmd_files:
                        bn = os.path.basename(src)
                        d = os.path.join(MMD_DIR, bn)
                        if os.path.exists(d):
                            base, ext = os.path.splitext(bn)
                            n = 1
                            while os.path.exists(os.path.join(MMD_DIR, f'{base}_{n}{ext}')): n += 1
                            d = os.path.join(MMD_DIR, f'{base}_{n}{ext}')
                        shutil.copy2(src, d)
                        copied.append(os.path.basename(d))
                    return self._resp(200, {'ok':True, 'type':'mmd', 'files':copied})

                return self._resp(400, {'ok':False,'error':'No supported files found in ZIP'})
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        except Exception as e:
            return self._resp(500, {'ok':False,'error':str(e)})

    def _resp(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

UPLOAD_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;font:14px/1.5 sans-serif}
body{background:#0a0a0f;color:#fff;display:flex;height:100vh;align-items:center;justify-content:center}
#box{text-align:center;padding:40px;border:1px solid #333;border-radius:12px;background:#1a1a2e;width:420px}
#dropzone{border:2px dashed #4a6cf7;border-radius:8px;padding:30px;margin:20px 0;cursor:pointer;transition:.2s}
#dropzone:hover,#dropzone.dragover{border-color:#6a8cf7;background:#2a2a4e}
#dropzone input{display:none}
#btn{padding:10px 24px;background:#4a6cf7;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:15px}
#btn:hover{background:#5a7cf7}
#btn:disabled{opacity:.5;cursor:default}
#progress{display:none;margin:15px 0}
#bar{height:6px;background:#333;border-radius:3px;overflow:hidden}
#fill{height:100%;width:0%;background:linear-gradient(90deg,#4a6cf7,#6a8cf7);border-radius:3px;transition:width .3s}
#pct{font-size:12px;color:#888;margin-top:4px}
#result{margin-top:15px;padding:10px;border-radius:6px;display:none}
#result.ok{background:#0a2a1a;color:#4c4;display:block}
#result.err{background:#2a0a0a;color:#f44;display:block}
#type-tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;margin-top:8px}
#fileLabel{font-size:13px;color:#888;margin-top:8px}
</style></head><body>
<div id="box">
<h2>모델 업로드</h2>
<p style="color:#888;font-size:12px">Live2D / MMD ZIP</p>
<div id="dropzone" onclick="document.getElementById('file').click()">
  <div style="font-size:40px;color:#4a6cf7;margin-bottom:10px">📁</div>
  <div>ZIP 파일 선택</div>
  <input type="file" id="file" accept=".zip">
  <div id="fileLabel"></div>
</div>
<button id="btn" onclick="upload()">업로드</button>
<div id="progress"><div id="bar"><div id="fill"></div></div><div id="pct">0%</div></div>
<div id="result"></div>
</div>
<script>
const fi=document.getElementById('file'),btn=document.getElementById('btn');
const bar=document.getElementById('fill'),pct=document.getElementById('pct');
const prog=document.getElementById('progress'),res=document.getElementById('result');
const drop=document.getElementById('dropzone'),label=document.getElementById('fileLabel');
fi.onchange=()=>{label.textContent=fi.files[0]?.name||''};
drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragover')};
drop.ondragleave=()=>drop.classList.remove('dragover');
drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragover');
  fi.files=e.dataTransfer.files;label.textContent=fi.files[0]?.name||''};
async function upload(){
  if(!fi.files[0])return;
  btn.disabled=true;prog.style.display='block';res.style.display='none';
  bar.style.width='0%';pct.textContent='0%';
  const fd=new FormData();fd.append('file',fi.files[0]);
  const xhr=new XMLHttpRequest();
  xhr.upload.onprogress=e=>{if(e.lengthComputable){
    const p=Math.round(e.loaded/e.total*100);
    bar.style.width=p+'%';pct.textContent=p+'%';
  }};
  xhr.onload=()=>{
    btn.disabled=false;
    try{const j=JSON.parse(xhr.responseText);
      if(j.ok){
        if(j.type==='live2d'){
          res.innerHTML='✅ Live2D 업로드 완료<br><span id="type-tag" style="background:#1a4a2e;color:#4c4">'+j.dir+'</span>';
        } else {
          res.innerHTML='✅ MMD: '+j.files.join(', ');
        }
      } else {
        res.className='result err';res.innerHTML='❌ '+j.error;
      }
    }catch(e){res.className='result err';res.textContent='❌ 서버 오류: '+e.message}
    res.style.display='block';
  };
  xhr.onerror=()=>{btn.disabled=false;res.className='result err';res.textContent='❌ 전송 실패';res.style.display='block'};
  xhr.open('POST','/upload-zip');xhr.send(fd);
}
</script></body></html>'''

port = 3002
print(f'Upload server on :{port}')
HTTPServer(('127.0.0.1', port), UploadHandler).serve_forever()
