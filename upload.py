#!/usr/bin/env python3
"""VTube model upload handler - extracts ZIP to /home/ubuntu/vtube/models/"""
import cgi, cgitb, json, os, zipfile, tempfile, shutil, sys

cgitb.enable()
MODELS_DIR = '/home/ubuntu/vtube/models'

def error(msg):
    print('Content-Type: application/json\n')
    print(json.dumps({'ok': False, 'error': msg}))
    sys.exit(0)

form = cgi.FieldStorage()
if 'file' not in form:
    error('No file uploaded')

uploaded = form['file']
if not uploaded.filename.lower().endswith('.zip'):
    error('ZIP file required')

tmp = tempfile.mkdtemp()
try:
    with open(os.path.join(tmp, uploaded.filename), 'wb') as f:
        shutil.copyfileobj(uploaded.file, f)

    # extract
    with zipfile.ZipFile(os.path.join(tmp, uploaded.filename)) as zf:
        zf.extractall(tmp)

    # find model3.json
    models_found = []
    for root, dirs, files in os.walk(tmp):
        for f in files:
            if f.endswith('.model3.json'):
                rel = os.path.relpath(root, tmp)
                models_found.append(rel)
                dest = os.path.join(MODELS_DIR, rel)
                if os.path.exists(dest):
                    shutil.rmtree(dest)
                shutil.copytree(root, dest)

    if not models_found:
        error('No .model3.json found in ZIP')

    print('Content-Type: application/json\n')
    print(json.dumps({'ok': True, 'modelName': models_found[0], 'models': models_found}))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
