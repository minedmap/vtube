#!/usr/bin/env python3
"""RVC WebSocket server — onnxruntime only"""
import asyncio, json, struct, sys, os, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import onnxruntime
import librosa
import websockets

PORT = 8002
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'static-models')

_loop = None
_models_loaded = False
vec_model = None
syn_model = None

def _load_models():
    global _models_loaded, vec_model, syn_model
    if _models_loaded:
        return
    print('[RVC] loading models...')
    vec_path = os.path.join(MODEL_DIR, 'contentvec_768l12_q8.onnx')
    syn_path = os.path.join(MODEL_DIR, 'IU-Zonas.onnx')
    vec_model = onnxruntime.InferenceSession(vec_path, providers=['CPUExecutionProvider'])
    syn_model = onnxruntime.InferenceSession(syn_path, providers=['CPUExecutionProvider'])
    _models_loaded = True
    print('[RVC] ready')

def process_sync(audio_bytes: bytes) -> bytes:
    """Synchronous processing — run in executor thread"""
    global vec_model, syn_model
    if not _models_loaded:
        _load_models()

    audio = np.frombuffer(audio_bytes, dtype=np.float32)
    if len(audio) < 100:
        return b''

    sr = 40000
    wav = librosa.resample(audio, orig_sr=48000, target_sr=sr)
    wav = np.clip(wav, -1, 1).astype(np.float32)

    wav16k = librosa.resample(wav, orig_sr=sr, target_sr=16000)

    # 1. ContentVec
    feats = np.expand_dims(wav16k, 0)
    mask = np.ones((1, feats.shape[1]), dtype=np.int64)
    hubert = vec_model.run(None, {'input_values': feats, 'attention_mask': mask})[0]
    hubert = np.repeat(hubert, 2, axis=1).astype(np.float32)
    hl = hubert.shape[1]

    # 2. F0 via pyin
    f0, _, _ = librosa.pyin(wav16k.astype(np.float64),
                             fmin=50.0, fmax=1100.0,
                             sr=16000, frame_length=1024, hop_length=160)
    f0 = np.nan_to_num(f0, nan=0.0).astype(np.float32)
    if len(f0) < hl:
        f0 = np.pad(f0, (0, hl - len(f0)))
    else:
        f0 = f0[:hl]

    # 3. Quantize to pitch tokens
    f0_mel_min = 1127 * np.log(1 + 50 / 700)
    f0_mel_max = 1127 * np.log(1 + 1100 / 700)
    fmel = 1127 * np.log(1 + np.maximum(f0, 1e-10) / 700)
    fmel[fmel > 0] = (fmel[fmel > 0] - f0_mel_min) * 254 / (f0_mel_max - f0_mel_min) + 1
    fmel = np.clip(fmel, 1, 255)
    pitch = np.rint(fmel).astype(np.int64)

    pitchf = f0.reshape(1, -1).astype(np.float32)
    pitch = pitch.reshape(1, -1)
    rnd = np.random.randn(1, 192, hl).astype(np.float32)

    inp = {
        syn_model.get_inputs()[0].name: hubert,
        syn_model.get_inputs()[1].name: np.array([hl], dtype=np.int64),
        syn_model.get_inputs()[2].name: pitch,
        syn_model.get_inputs()[3].name: pitchf,
        syn_model.get_inputs()[4].name: np.array([0], dtype=np.int64),
        syn_model.get_inputs()[5].name: rnd,
    }
    out = syn_model.run(None, inp)[0]
    wav_out = out.squeeze().astype(np.float32) / 32767
    wav_out = librosa.resample(wav_out, orig_sr=sr, target_sr=48000)
    return wav_out.astype(np.float32).tobytes()

async def handle_ws(ws):
    """WebSocket handler — binary in/out, CPU work in executor"""
    print('[RVC] client connected')
    _load_models()  # warm up on connect

    async for msg in ws:
        if isinstance(msg, bytes):
            try:
                out_bytes = await asyncio.get_event_loop().run_in_executor(None, process_sync, msg)
                if out_bytes:
                    await ws.send(out_bytes)
            except Exception as e:
                print(f'[RVC] process error: {e}')
                import traceback
                traceback.print_exc()
    print('[RVC] client disconnected')

async def main():
    print(f'[RVC] WS server on :{PORT}')
    _load_models()  # preload at startup
    async with websockets.serve(handle_ws, '0.0.0.0', PORT):
        await asyncio.Future()

if __name__ == '__main__':
    asyncio.run(main())
