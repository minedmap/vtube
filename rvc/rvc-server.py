#!/usr/bin/env python3
"""
RVC WebSocket server for VTube.
Uses official RVC inference code from RVC-WebUI.
"""
import asyncio, json, time, os, sys, io
import numpy as np
import torch
import soundfile as sf
from fastapi import FastAPI, WebSocket
import uvicorn

SRC_DIR = os.path.dirname(__file__)
MODEL_DIR = os.path.join(SRC_DIR, 'models')
VOICE_DIR = os.path.join(MODEL_DIR, 'voices', 'iu')

# Add RVC inference code to path
sys.path.insert(0, SRC_DIR)

from infer_pack.models import SynthesizerTrnMs768NSFsid

# ── Load config ──
with open(os.path.join(VOICE_DIR, 'config.json')) as f:
    CONFIG = json.load(f)
SR = CONFIG['data']['sampling_rate']
HOP = CONFIG['data']['hop_length']
GIN_CHANNELS = CONFIG['model']['gin_channels']
SPK_DIM = CONFIG['model']['spk_embed_dim']

# ── Load model ──
device = torch.device('cpu')
ckpt = torch.load(os.path.join(VOICE_DIR, 'IU-Zonas.pth'), map_location='cpu', weights_only=False)
weight = ckpt['weight']

model = SynthesizerTrnMs768NSFsid(
    CONFIG['data']['n_mel_channels'],  # spec_channels
    CONFIG['train']['segment_size'] // HOP,  # segment_size
    CONFIG['model']['inter_channels'],
    CONFIG['model']['hidden_channels'],
    CONFIG['model']['filter_channels'],
    CONFIG['model']['n_heads'],
    CONFIG['model']['n_layers'],
    CONFIG['model']['kernel_size'],
    CONFIG['model']['p_dropout'],
    CONFIG['model']['resblock'],
    CONFIG['model']['resblock_kernel_sizes'],
    CONFIG['model']['resblock_dilation_sizes'],
    CONFIG['model']['upsample_rates'],
    CONFIG['model']['upsample_initial_channel'],
    CONFIG['model']['upsample_kernel_sizes'],
    spk_embed_dim=SPK_DIM,
    gin_channels=GIN_CHANNELS,
    sr=SR,
    is_half=False,
).eval()

# Remove emb_g from weight if present (loaded from model)
if 'emb_g.weight' in weight:
    del weight['emb_g.weight']

model.load_state_dict(weight, strict=False)
model = model.to(device)
model.eval()

# ── Speaker embedding from FAISS ──
import faiss
index_path = os.path.join(VOICE_DIR, 'added_IVF1231_Flat_nprobe_1_IU-Zonas_v2.index')
if os.path.exists(index_path):
    index = faiss.read_index(index_path)
    # Try first speaker, fallback to zero if direct map not ready
    try:
        spk_emb = torch.from_numpy(index.reconstruct(0)).float().unsqueeze(0)
    except:
        spk_emb = None
else:
    spk_emb = None
if spk_emb is None:
    print("WARN: using zero speaker embedding", flush=True)

# ── Load ONNX models ──
import onnxruntime as ort
ort_opts = ort.SessionOptions()
ort_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
ort_opts.intra_op_num_threads = 2
ort_opts.inter_op_num_threads = 1

hubert_sess = ort.InferenceSession(
    os.path.join(MODEL_DIR, 'contentvec', 'contentvec_768l12_q8.onnx'),
    ort_opts, providers=['CPUExecutionProvider']
)
rmvpe_sess = ort.InferenceSession(
    os.path.join(MODEL_DIR, 'rmvpe', 'rmvpe_q8.onnx'),
    ort_opts, providers=['CPUExecutionProvider']
)

from scipy import signal

app = FastAPI()

@app.websocket('/ws/rvc')
async def rvc_ws(ws: WebSocket):
    await ws.accept()
    chunk_count = 0
    while True:
        try:
            msg = await asyncio.wait_for(ws.receive(), timeout=5.0)
        except asyncio.TimeoutError:
            continue
        except Exception:
            break
        
        if isinstance(msg, dict) and msg.get('type') == 'websocket.disconnect':
            break
        
        data = msg.get('bytes') if isinstance(msg, dict) else msg
        if isinstance(data, str):
            try:
                ctrl = json.loads(data)
                continue
            except:
                pass
        if not data:
            continue
        
        try:
            t0 = time.time()
            raw = np.frombuffer(data, dtype=np.float32)
            
            # RVC pipeline
            # 1. Resample to model SR
            if len(raw) < 800:
                continue
            
            # 2. Extract hubert features via ONNX
            raw_16k = signal.resample(raw, int(len(raw) * 16000 / SR)).astype(np.float32)
            hubert_in = raw_16k.reshape(1, 1, -1)
            hubert_feat = hubert_sess.run(None, {'input': hubert_in})[0]
            hubert_t = torch.from_numpy(hubert_feat).float()
            
            # 3. Extract F0 via RMVPE
            mel = rmvpe_sess.run(None, {'input': hubert_in})[0]
            f0 = mel[0, 0]
            
            # 4. Downsample F0 to hubert length
            f0_len = hubert_t.size(-1)
            f0_resampled = signal.resample(f0, f0_len).astype(np.float32)
            f0_t = torch.from_numpy(f0_resampled).float().unsqueeze(0).unsqueeze(-1)
            
            # 5. Volume
            vol_t = torch.ones(1, 1, f0_t.size(-1))
            
            # 6. Speaker embedding
            if spk_emb is not None:
                g = spk_emb
            else:
                g = torch.zeros(1, SPK_DIM)
            
            # 7. Generate
            with torch.no_grad():
                audio_out = model(hubert_t, f0_t, vol_t, g, None)
            
            out_np = audio_out.squeeze().cpu().numpy().astype(np.float32)
            
            # Send back
            await ws.send_bytes(out_np.tobytes())
            
            chunk_count += 1
            if chunk_count % 10 == 0:
                dt = (time.time() - t0) * 1000
                print(f"RVC chunk: {len(raw)/SR:.2f}s in {dt:.0f}ms", flush=True)
                
        except Exception as e:
            print(f"RVC error: {e}", flush=True)
            continue

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8002, log_level='warning')
