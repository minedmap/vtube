#!/usr/bin/env python3
"""VTube MMD upload handler - extracts .pmx/.pmd/.vmd from ZIP to /home/ubuntu/vtube/models/mmd/"""
import cgi, cgitb, json, os, zipfile, tempfile, shutil, sys

cgitb.enable()
MODELS_DIR = '/home/ubuntu/vtube/models/mmd'

def error(msg):
    print('Content-Type: application/json\n')
    print(json.dumps({'ok': False, 'error': msg}))
    sys.exit(0)

os.makedirs(MODELS_DIR, exist_ok=True)

form = cgi.FieldStorage()
if 'file' not in form:
    error('No file uploaded')

uploaded = form['file']
fname = uploaded.filename.lower()

tmp = tempfile.mkdtemp()
try:
    if fname.endswith('.zip'):
        # save zip
        zippath = os.path.join(tmp, uploaded.filename)
        with open(zippath, 'wb') as f:
            shutil.copyfileobj(uploaded.file, f)

        # extract
        with zipfile.ZipFile(zippath) as zf:
            zf.extractall(tmp)

        # find .pmx / .pmd / .vmd
        found = []
        for root, dirs, files in os.walk(tmp):
            # skip zip file itself
            if root == tmp:
                continue
            for f in files:
                if f.endswith(('.pmx', '.pmd', '.vmd')):
                    found.append(os.path.join(root, f))

        if not found:
            error('No .pmx / .pmd / .vmd found in ZIP')

        # copy to models/mmd/ (flat: flatten directory structure)
        copied = []
        for src in found:
            basename = os.path.basename(src)
            dst = os.path.join(MODELS_DIR, basename)
            # avoid overwrite collision
            if os.path.exists(dst):
                base, ext = os.path.splitext(basename)
                n = 1
                while os.path.exists(os.path.join(MODELS_DIR, f'{base}_{n}{ext}')):
                    n += 1
                dst = os.path.join(MODELS_DIR, f'{base}_{n}{ext}')
            shutil.copy2(src, dst)
            copied.append(os.path.basename(dst))

        print('Content-Type: application/json\n')
        print(json.dumps({'ok': True, 'files': copied}))
    else:
        error('ZIP file required for upload')

finally:
    shutil.rmtree(tmp, ignore_errors=True)
