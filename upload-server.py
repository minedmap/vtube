#!/usr/bin/env python3
"""upload handler server on port 8082"""
import http.server, json, os, zipfile, tempfile, shutil, cgi, sys, subprocess

MODELS_DIR = '/home/ubuntu/vtube/models'
PORT = 8082

class Handler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'upload handler')
            return
        self.send_error(404)

    def do_POST(self):
        if self.path != '/upload':
            self.send_error(404)
            return
        try:
            ctype, pdict = cgi.parse_header(self.headers.get('Content-Type', ''))
            if 'boundary' not in pdict:
                self._json({'ok': False, 'error': 'multipart/form-data expected'})
                return
            pdict['boundary'] = bytes(pdict['boundary'], 'utf-8')
            pdict['CONTENT-LENGTH'] = int(self.headers.get('Content-Length', 0))
            fields = cgi.parse_multipart(self.rfile, pdict)
            if 'file' not in fields:
                self._json({'ok': False, 'error': 'no file field'})
                return
            fdata = fields['file'][0]
            fname = fields.get('filename', [b'model.zip'])[0]
            if isinstance(fname, bytes): fname = fname.decode()

            tmp = tempfile.mkdtemp()
            try:
                zpath = os.path.join(tmp, fname)
                with open(zpath, 'wb') as f:
                    f.write(fdata)
                if fname.lower().endswith('.rar'):
                    r = subprocess.run(['unar', '-o', tmp, '-q', zpath], capture_output=True, timeout=60)
                    if r.returncode != 0:
                        self._json({'ok': False, 'error': 'unrar failed: ' + (r.stderr.decode() or r.stdout.decode() or str(r.returncode))})
                        return
                else:
                    with zipfile.ZipFile(zpath) as zf:
                        zf.extractall(tmp)
                models = []
                for root, dirs, files in os.walk(tmp):
                    for f in files:
                        if f.endswith('.model3.json'):
                            rel = os.path.relpath(root, tmp)
                            # flat zip: files at root -> use model name as dir
                            if rel == '.':
                                # strip .model3.json -> model name
                                base = f
                                for ext in ('.model3.json', '.model.json', '.json'):
                                    if base.endswith(ext):
                                        base = base[:-len(ext)]
                                        break
                                model_name = base
                                rel = model_name
                                model_root = os.path.join(tmp, model_name)
                                os.makedirs(model_root, exist_ok=True)
                                for item in os.listdir(tmp):
                                    ipath = os.path.join(tmp, item)
                                    if ipath != model_root and item != os.path.basename(zpath):
                                        shutil.move(ipath, os.path.join(model_root, item))
                                root = model_root
                            models.append(rel)
                            dest = os.path.join(MODELS_DIR, rel)
                            if os.path.exists(dest):
                                shutil.rmtree(dest)
                            os.makedirs(os.path.dirname(dest), exist_ok=True)
                            shutil.copytree(root, dest)
                if not models:
                    self._json({'ok': False, 'error': 'no .model3.json in zip'})
                    return
                self._json({'ok': True, 'modelName': models[0], 'models': models})
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        except Exception as e:
            self._json({'ok': False, 'error': str(e)})

    def _json(self, d):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(d).encode())

http.server.HTTPServer(('', PORT), Handler).serve_forever()
