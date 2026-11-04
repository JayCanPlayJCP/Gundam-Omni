#!/usr/bin/env python3
"""Small MLP value function (numpy, CPU) trained on selfplay.js datasets; exports JSON that valuefn.js runs in Node.

python3 train_mlp.py OUT.json d0[,d1,...] [hidden=64,32] [epochs=40] [val=15]
Same held-out split as train_lr.js (by game id hash), same standardization (train mean / sd).
"""
import json, sys, time
import numpy as np


def load_sets(spec):
    Xs, ys, gs, meta, names = [], [], [], [], None
    for k, base in enumerate(spec.split(',')):
        m = json.load(open(base + '.meta.json'))
        names = names or m['names']
        assert m['names'] == names, 'feature names differ: ' + base
        F = m['F']
        X = np.fromfile(base + '.x.f32', dtype=np.float32).reshape(-1, F)
        y = np.fromfile(base + '.y.f32', dtype=np.float32)
        g = np.fromfile(base + '.g.i32', dtype=np.int32).astype(np.float64) + 1e6 * (k + 1) * (m.get('seed') or 1)
        Xs.append(X); ys.append(y); gs.append(g); meta.append({'tag': base, 'rows': m['rows'], 'games': m['games'], 'ai': m['ai']})
    return np.concatenate(Xs), np.concatenate(ys), np.concatenate(gs), names, meta


def is_val(g, pct):
    a = (g.astype(np.uint64) & np.uint64(0xffffffff))
    return ((a * np.uint64(2654435761)) & np.uint64(0xffffffff)) % np.uint64(100) < np.uint64(pct)


def metrics(p, y):
    keep = y != 0.5
    p, y = np.clip(p[keep], 1e-7, 1 - 1e-7), y[keep]
    return {'logloss': float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))), 'acc': float(np.mean((p > 0.5) == (y > 0.5))), 'n': int(keep.sum())}


def forward(params, Z):
    h = Z
    acts = [h]
    for i, (W, b) in enumerate(params):
        h = h @ W.T + b
        if i < len(params) - 1:
            h = np.maximum(h, 0)
        acts.append(h)
    return acts


def main():
    out, spec = sys.argv[1], sys.argv[2]
    hidden = [int(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '64,32').split(',')]
    epochs = int(sys.argv[4]) if len(sys.argv) > 4 else 40
    VAL = int(sys.argv[5]) if len(sys.argv) > 5 else 15
    t0 = time.time()
    X, y, g, names, meta = load_sets(spec)
    v = is_val(g, VAL)
    Xtr, ytr, Xva, yva = X[~v], y[~v], X[v], y[v]
    mu = Xtr.mean(0).astype(np.float64)
    sd = Xtr.std(0).astype(np.float64)
    sd[sd == 0] = 1
    Ztr = ((Xtr - mu) / sd).astype(np.float32)
    Zva = ((Xva - mu) / sd).astype(np.float32)
    rng = np.random.default_rng(7)
    dims = [X.shape[1]] + hidden + [1]
    params = [(rng.normal(0, np.sqrt(2 / dims[i]), (dims[i + 1], dims[i])).astype(np.float32), np.zeros(dims[i + 1], np.float32)) for i in range(len(dims) - 1)]
    m = [(np.zeros_like(W), np.zeros_like(b)) for W, b in params]
    s = [(np.zeros_like(W), np.zeros_like(b)) for W, b in params]
    lr, b1, b2, eps, l2, bs = 1e-3, 0.9, 0.999, 1e-8, 1e-4, 512
    best, best_params, bad, t = 1e9, None, 0, 0
    sig = lambda z: 1 / (1 + np.exp(-z))
    for ep in range(epochs):
        perm = rng.permutation(len(ytr))
        for k in range(0, len(perm), bs):
            idx = perm[k:k + bs]
            acts = forward(params, Ztr[idx])
            p = sig(acts[-1][:, 0])
            delta = ((p - ytr[idx]) / len(idx))[:, None].astype(np.float32)
            t += 1
            for i in range(len(params) - 1, -1, -1):
                W, b = params[i]
                gW = delta.T @ acts[i] + l2 * W
                gb = delta.sum(0)
                if i > 0:
                    delta = (delta @ W) * (acts[i] > 0)
                mW, mb = m[i]; sW, sb = s[i]
                mW = b1 * mW + (1 - b1) * gW; mb = b1 * mb + (1 - b1) * gb
                sW = b2 * sW + (1 - b2) * gW * gW; sb = b2 * sb + (1 - b2) * gb * gb
                m[i], s[i] = (mW, mb), (sW, sb)
                c1, c2 = 1 - b1 ** t, 1 - b2 ** t
                params[i] = (W - lr * (mW / c1) / (np.sqrt(sW / c2) + eps), b - lr * (mb / c1) / (np.sqrt(sb / c2) + eps))
        pva = sig(forward(params, Zva)[-1][:, 0])
        mv = metrics(pva, yva)
        print(f'epoch {ep} held-out logloss {mv["logloss"]:.4f} acc {mv["acc"] * 100:.1f}%', flush=True)
        if mv['logloss'] < best - 1e-4:
            best, best_params, bad = mv['logloss'], [(W.copy(), b.copy()) for W, b in params], 0
        else:
            bad += 1
            if bad >= 4:
                break
    params = best_params
    mtr = metrics(sig(forward(params, Ztr)[-1][:, 0]), ytr)
    mva = metrics(sig(forward(params, Zva)[-1][:, 0]), yva)
    model = {'type': 'mlp', 'names': names, 'mu': mu.tolist(), 'sd': sd.tolist(), 'hidden': hidden,
             'layers': [{'W': W.astype(np.float64).round(6).tolist(), 'b': b.astype(np.float64).round(6).tolist()} for W, b in params],
             'trainedOn': meta, 'rows': {'train': int(len(ytr)), 'val': int(len(yva))}, 'metrics': {'mlp': {'train': mtr, 'val': mva}},
             'created': time.strftime('%Y-%m-%dT%H:%M:%S')}
    json.dump(model, open(out, 'w'))
    print(f'train {len(ytr)} / held-out {len(yva)} positions ({time.time() - t0:.0f}s)')
    print(f'  MLP {hidden}: train logloss {mtr["logloss"]:.4f} acc {mtr["acc"] * 100:.1f}% | held-out logloss {mva["logloss"]:.4f} acc {mva["acc"] * 100:.1f}%')


if __name__ == '__main__':
    main()
