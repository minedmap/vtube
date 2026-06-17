#!/usr/bin/env python3
import http.server, json, os, sys, cgi, shutil, tempfile, zipfile, re
PORT = 3000
ROOT = os.path.expanduser('~/vtube')
MMD_DIR = os.path.join(ROOT, 'models', 'mmd')
MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.moc3': 'application/octet-stream',
    '.motion3.json': 'application/json',
    '.exp3.json': 'application/json',
    '.cdi3.json': 'application/json',
    '.physics3.json': 'application/json',
    '.model3.json': 'application/json',
    '.task': 'application/octet-stream',
    '.wasm': 'application/wasm',
    '.pmx': 'application/octet-stream',
    '.pmd': 'application/octet-stream',
    '.vmd': 'application/octet-stream',
}
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        p = self.path.split('?')[0]
        if p == '/': p = '/index.html'
        if p == '/upload': p = '/upload-mmd.html'
        # MMD model list
        if p == '/models/mmd/list.json':
            self._mmd_list()
            return
        if '..' in p: self.send_error(403); return
        fp = os.path.join(ROOT, p.lstrip('/'))
        if not os.path.isfile(fp): self.send_error(404); return
        _, ext = os.path.splitext(fp)
        data = open(fp, 'rb').read()
        self.send_response(200)
        self.send_header('Content-Type', MIME.get(ext, 'application/octet-stream'))
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(data)
    def do_POST(self):
        p = self.path.split('?')[0]
        if p == '/upload-mmd':
            self._upload_mmd()
            return
        self.send_error(404)
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    def _mmd_list(self):
        os.makedirs(MMD_DIR, exist_ok=True)
        files = [f for f in os.listdir(MMD_DIR) if f.lower().endswith(('.pmx', '.pmd'))]
        data = json.dumps(files).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)
    def _upload_mmd(self):
        ctype, pdict = cgi.parse_header(self.headers.get('Content-Type', ''))
        if 'boundary' not in pdict:
            self._json({'ok': False, 'error': 'multipart expected'})
            return
        pdict['boundary'] = bytes(pdict['boundary'], 'utf-8');
        pdict['CONTENT-LENGTH'] = int(self.headers.get('Content-Length', 0))
        fields = cgi.parse_multipart(self.rfile, pdict)
        if 'file' not in fields:
            self._json({'ok': False, 'error': 'no file'})
            return
        fdata = fields['file'][0]
        fname = 'model.pmx'
        if 'filename' in fields:
            raw = fields['filename'][0]
            if isinstance(raw, bytes): raw = raw.decode()
            fname = os.path.basename(raw)
        os.makedirs(MMD_DIR, exist_ok=True)
        if fname.lower().endswith('.zip'):
            # extract zip
            import zipfile, tempfile, shutil
            tmp = tempfile.mkdtemp()
            try:
                zippath = os.path.join(tmp, fname)
                with open(zippath, 'wb') as f: f.write(fdata)
                extracted = []
                with zipfile.ZipFile(zippath) as zf:
                    zf.extractall(tmp)
                for root, dirs, files in os.walk(tmp):
                    for f in files:
                        if f.endswith(('.pmx', '.pmd', '.vmd')):
                            src = os.path.join(root, f)
                            dst = os.path.join(MMD_DIR, f)
                            if os.path.exists(dst):
                                b, e = os.path.splitext(f)
                                n = 1
                                while os.path.exists(os.path.join(MMD_DIR, f'{b}_{n}{e}')):
                                    n += 1
                                dst = os.path.join(MMD_DIR, f'{b}_{n}{e}')
                            shutil.copy2(src, dst)
                            extracted.append(os.path.basename(dst))
                self._json({'ok': True, 'files': extracted})
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        else:
            fp = os.path.join(MMD_DIR, fname)
            with open(fp, 'wb') as f: f.write(fdata)
            self._json({'ok': True, 'path': f'/models/mmd/{fname}'})
    def _json(self, d, code=200):
        data = json.dumps(d).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)
http.server.HTTPServer(('', PORT), H).serve_forever()
