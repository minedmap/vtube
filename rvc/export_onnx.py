# .pth → .onnx 변환 (config에서 직접 파싱)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch
from infer_pack.models_onnx import SynthesizerTrnMsNSFsidM

device = 'cpu'
model_path = 'models/voices/iu/IU-Zonas.pth'
output_path = 'static-models/IU-Zonas.onnx'
os.makedirs('static-models', exist_ok=True)

ckpt = torch.load(model_path, map_location=device, weights_only=False)
cfg = ckpt['config']  # list
print(f"Config: {cfg}")

# cfg = [spec_channels, segment_size, inter_channels, hidden_channels, filter_channels,
#        n_heads, n_layers, kernel_size, p_dropout, resblock, resblock_kernel_sizes,
#        resblock_dilation_sizes, upsample_rates, upsample_initial_channel,
#        upsample_kernel_sizes, n_speakers, gin_channels, sr]
(spec_channels, segment_size, inter_channels, hidden_channels, filter_channels,
 n_heads, n_layers, kernel_size, p_dropout, resblock, resblock_kernel_sizes,
 resblock_dilation_sizes, upsample_rates, upsample_initial_channel,
 upsample_kernel_sizes, n_speakers, gin_channels, sr) = cfg

# version from emb_phone
is_v2 = ckpt['weight']['enc_p.emb_phone.weight'].shape[1] == 768
version = 'v2' if is_v2 else 'v1'
print(f"version={version}, gin={gin_channels}, sr={sr}, n_speakers={n_speakers}")

net_g = SynthesizerTrnMsNSFsidM(
    spec_channels=spec_channels, segment_size=segment_size,
    inter_channels=inter_channels, hidden_channels=hidden_channels,
    filter_channels=filter_channels, n_heads=n_heads, n_layers=n_layers,
    kernel_size=kernel_size, p_dropout=p_dropout, resblock=resblock,
    resblock_kernel_sizes=resblock_kernel_sizes,
    resblock_dilation_sizes=resblock_dilation_sizes,
    upsample_rates=upsample_rates,
    upsample_initial_channel=upsample_initial_channel,
    upsample_kernel_sizes=upsample_kernel_sizes,
    spk_embed_dim=n_speakers, gin_channels=gin_channels,
    sr=sr, version=version, is_half=False,
)

sd = ckpt['weight']
missing, unexpected = net_g.load_state_dict(sd, strict=False)
print(f"Missing: {missing[:3]}")  
print(f"Unexpected: {unexpected[:3]}")
assert not unexpected, f"Unexpected: {unexpected}"

net_g.eval().to(device)

# Dummy inputs (80 frames)
n = 80
dummy_hubert = torch.randn(1, n, 768 if is_v2 else 256)
dummy_hubert_length = torch.tensor([n], dtype=torch.int64)
dummy_pitch = torch.randint(1, 255, (1, n), dtype=torch.int64)
dummy_pitchf = torch.randn(1, n)
dummy_ds = torch.tensor([0], dtype=torch.int64)
dummy_rnd = torch.randn(1, 192, n)

# Export with torch dynamo
from torch.export import Dim

frames = Dim('frames', min=1, max=2000)
samples = Dim('samples', min=1, max=100000)
# Use positional dynamic_shapes list matching args order
torch.onnx.export(
    net_g,
    (dummy_hubert, dummy_hubert_length, dummy_pitch, dummy_pitchf, dummy_ds, dummy_rnd),
    output_path,
    input_names=['phone', 'phone_lengths', 'pitch', 'nsff0', 'g', 'rnd'],
    output_names=['audio'],
    dynamic_shapes=(
        {1: frames},  # phone: [batch, frames, 768]
        None,  # phone_lengths: scalar
        {1: frames},  # pitch: [batch, frames]
        {1: frames},  # nsff0: [batch, frames]
        None,  # g: [batch]
        {2: frames},  # rnd: [batch, 192, frames]
    ),
    opset_version=18,
)

size_mb = os.path.getsize(output_path) / 1024 / 1024
print(f'✅ {output_path} ({size_mb:.1f} MB)')
print(f'Missing weights (expected): {missing}')
