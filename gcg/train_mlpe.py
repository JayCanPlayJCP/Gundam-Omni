#!/usr/bin/env python3
"""Embedding MLP value function ('mlpe'): dense features (valuefn NAMES) + card-identity embeddings summed into layer 1.

python3 train_mlpe.py OUT.json d1[,d2,...] [hidden=64,32] [epochs=40] [val=15]
Needs selfplay.js datasets with the .s.i16 sparse file. Same game-hash held-out split as train_lr.js / train_mlp.py.
"""
import json, sys, time
import numpy as np
from train_mlp import is_val, metrics


def load(spec):
    Xs, Ss, ys, gs, meta, names, nid, sw = [], [], [], [], [], None, None, None
    for k, base in enumerate(spec.split(',')):
        m = json.load(open(base + '.meta.json'))
        names = names or m['names']; nid = nid or m['NID']; sw = sw or m['SW']
        assert m['names'] == names and m['NID'] == nid and m['SW'] == sw, 'dataset mismatch: ' + base
        Xs.append(np.fromfile(base + '.x.f32', dtype=np.float32).reshape(-1, m['F']))
        Ss.append(np.fromfile(base + '.s.i16', dtype=np.int16).reshape(-1, sw).astype(np.int32))
        ys.append(np.fromfile(base + '.y.f32', dtype=np.float32))
        gs.append(np.fromfile(base + '.g.i32', dtype=np.int32).astype(np.float64) + 1e6 * (k + 1) * (m.get('seed') or 1))
        meta.append({'tag': base, 'rows': m['rows'], 'games': m['games'], 'ai': m['ai']})
    return np.concatenate(Xs), np.concatenate(Ss), np.concatenate(ys), np.concatenate(gs), names, nid, meta


def main():
    out, spec = sys.argv[1], sys.argv[2]
    hidden = [int(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '64,32').split(',')]
    epochs = int(sys.argv[4]) if len(sys.argv) > 4 else 40
    VAL = int(sys.argv[5]) if len(sys.argv) > 5 else 15
    t0 = time.time()
    X, S, y, g, names, nid, meta = load(spec)
    v = is_val(g, VAL)
    mu = X[~v].mean(0).astype(np.float64); sd = X[~v].std(0).astype(np.float64); sd[sd == 0] = 1
    Z = ((X - mu) / sd).astype(np.float32)
    Ztr, Str, ytr, Zva, Sva, yva = Z[~v], S[~v], y[~v], Z[v], S[v], y[v]
    NE = 3 * nid
    rng = np.random.default_rng(11)
    dims = [Z.shape[1]] + hidden + [1]
    P = {'E': np.zeros((NE + 1, hidden[0]), np.float32)}  # last row = padding (index -1), kept at 0
    for i in range(len(dims) - 1):
        P[f'W{i}'] = rng.normal(0, np.sqrt(2 / dims[i]), (dims[i + 1], dims[i])).astype(np.float32)
        P[f'b{i}'] = np.zeros(dims[i + 1], np.float32)
    L = len(dims) - 1
    M = {k: np.zeros_like(p) for k, p in P.items()}; V = {k: np.zeros_like(p) for k, p in P.items()}
    lr, b1, b2, eps, l2, l2e, bs = 1e-3, 0.9, 0.999, 1e-8, 1e-4, 1e-5, 512
    sig = lambda z: 1 / (1 + np.exp(-z))

    def fwd(Zb, Sb):
        Sb = np.where(Sb < 0, NE, Sb)
        acts = [Zb]
        h = Zb @ P['W0'].T + P['b0'] + P['E'][Sb].sum(1)
        pre = [h]
        h = np.maximum(h, 0) if L > 1 else h
        acts.append(h)
        for i in range(1, L):
            h = h @ P[f'W{i}'].T + P[f'b{i}']
            pre.append(h)
            if i < L - 1:
                h = np.maximum(h, 0)
            acts.append(h)
        return acts, pre, Sb

    best, bestP, bad, t = 1e9, None, 0, 0
    for ep in range(epochs):
        perm = rng.permutation(len(ytr))
        for k in range(0, len(perm), bs):
            idx = perm[k:k + bs]
            acts, pre, Sb = fwd(Ztr[idx], Str[idx])
            p = sig(acts[-1][:, 0])
            d = ((p - ytr[idx]) / len(idx))[:, None].astype(np.float32)
            G = {}
            for i in range(L - 1, -1, -1):
                G[f'W{i}'] = d.T @ acts[i] + l2 * P[f'W{i}']
                G[f'b{i}'] = d.sum(0)
                if i > 0:
                    d = (d @ P[f'W{i}']) * (pre[i - 1] > 0)
            # d is now the gradient wrt layer-1 pre-activation (before ReLU applied above)
            gE = np.zeros_like(P['E'])
            np.add.at(gE, Sb.reshape(-1), np.repeat(d, Sb.shape[1], axis=0))
            gE[NE] = 0
            G['E'] = gE + l2e * P['E']
            t += 1
            for key in P:
                M[key] = b1 * M[key] + (1 - b1) * G[key]; V[key] = b2 * V[key] + (1 - b2) * G[key] * G[key]
                P[key] = P[key] - lr * (M[key] / (1 - b1 ** t)) / (np.sqrt(V[key] / (1 - b2 ** t)) + eps)
            P['E'][NE] = 0
        mv = metrics(sig(fwd(Zva, Sva)[0][-1][:, 0]), yva)
        print(f'epoch {ep} held-out logloss {mv["logloss"]:.4f} acc {mv["acc"] * 100:.1f}%', flush=True)
        if mv['logloss'] < best - 1e-4:
            best, bestP, bad = mv['logloss'], {k: p.copy() for k, p in P.items()}, 0
        else:
            bad += 1
            if bad >= 4:
                break
    P = bestP
    mtr = metrics(sig(fwd(Ztr, Str)[0][-1][:, 0]), ytr)
    mva = metrics(sig(fwd(Zva, Sva)[0][-1][:, 0]), yva)
    E = {str(i): P['E'][i].astype(np.float64).round(5).tolist() for i in range(NE) if np.abs(P['E'][i]).max() > 1e-6}
    model = {'type': 'mlpe', 'names': names, 'nid': nid, 'mu': mu.tolist(), 'sd': sd.tolist(), 'hidden': hidden, 'E': E,
             'layers': [{'W': P[f'W{i}'].astype(np.float64).round(6).tolist(), 'b': P[f'b{i}'].astype(np.float64).round(6).tolist()} for i in range(L)],
             'trainedOn': meta, 'rows': {'train': int(len(ytr)), 'val': int(len(yva))}, 'metrics': {'mlpe': {'train': mtr, 'val': mva}},
             'created': time.strftime('%Y-%m-%dT%H:%M:%S')}
    json.dump(model, open(out, 'w'))
    print(f'train {len(ytr)} / held-out {len(yva)} positions, {len(E)} card embeddings ({time.time() - t0:.0f}s)')
    print(f'  MLPE {hidden}: train logloss {mtr["logloss"]:.4f} acc {mtr["acc"] * 100:.1f}% | held-out logloss {mva["logloss"]:.4f} acc {mva["acc"] * 100:.1f}%')


if __name__ == '__main__':
    main()
