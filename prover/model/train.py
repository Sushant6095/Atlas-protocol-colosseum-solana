"""Atlas v1 strategy model — 3-layer MLP that scores Solana DeFi protocol allocations.

Inputs (8 features per protocol snapshot, normalized):
    [kamino_apy, drift_apy, jupiter_apy, mfi_apy,
     kamino_util, vault_idle_ratio, vol_7d, slippage_estimate]

Output: softmax over 5 buckets:
    [kamino_pct, drift_pct, jupiter_pct, mfi_pct, idle_pct]

Train on synthetic data + historical APY snapshots (Phase 2 plugs real data).
Export to ONNX, quantize weights to f32 little-endian, write to ./atlas-v1.bin
for the SP1 guest program to consume.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import struct
from pathlib import Path

N_FEATURES = 8
HIDDEN = 16
N_PROTOCOLS = 5
MODEL_PATH = Path(__file__).parent / "atlas-v1.bin"


class StrategyMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(N_FEATURES, HIDDEN)
        self.fc2 = nn.Linear(HIDDEN, N_PROTOCOLS)

    def forward(self, x):
        h = F.relu(self.fc1(x))
        return F.softmax(self.fc2(h), dim=-1)


def synth_dataset(n=20_000):
    """Generate synthetic (state, target_allocation) pairs.
    Heuristic: allocate proportional to risk-adjusted APY,
    de-rate by volatility + slippage.
    """
    rng = np.random.default_rng(42)
    X = rng.uniform(0.0, 1.0, size=(n, N_FEATURES)).astype(np.float32)
    apys = X[:, 0:4]
    vol = X[:, 6:7]
    slip = X[:, 7:8]
    raw = apys / (1.0 + 5.0 * vol + 2.0 * slip)
    idle_share = np.clip(0.1 + 0.5 * vol, 0.0, 0.5).reshape(-1, 1)
    risky_share = 1.0 - idle_share
    weights = raw / raw.sum(axis=1, keepdims=True)
    Y = np.concatenate([weights * risky_share, idle_share], axis=1).astype(np.float32)
    return torch.from_numpy(X), torch.from_numpy(Y)


def train():
    model = StrategyMLP()
    X, Y = synth_dataset()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    for epoch in range(50):
        idx = torch.randperm(len(X))[:512]
        pred = model(X[idx])
        loss = F.kl_div(pred.log(), Y[idx], reduction="batchmean")
        opt.zero_grad()
        loss.backward()
        opt.step()
        if epoch % 10 == 0:
            print(f"epoch={epoch} loss={loss.item():.5f}")
    return model


def export_bin(model: StrategyMLP, path: Path):
    """Pack weights as little-endian f32 in row-major order: w1, b1, w2, b2."""
    w1 = model.fc1.weight.detach().numpy().astype(np.float32).flatten()
    b1 = model.fc1.bias.detach().numpy().astype(np.float32).flatten()
    w2 = model.fc2.weight.detach().numpy().astype(np.float32).flatten()
    b2 = model.fc2.bias.detach().numpy().astype(np.float32).flatten()
    with path.open("wb") as f:
        for arr in (w1, b1, w2, b2):
            for v in arr:
                f.write(struct.pack("<f", float(v)))
    sizes = (len(w1), len(b1), len(w2), len(b2))
    print(f"wrote {path} sizes={sizes}")


if __name__ == "__main__":
    model = train()
    export_bin(model, MODEL_PATH)
