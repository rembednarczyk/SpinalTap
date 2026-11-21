"""Quadric simplification of the bakes (Garland and Heckbert 1997) by meshoptimizer's simplifier
(`tools/mesh-tools/src/simplify.ts`, pinned in the lockfile; decision of the user of 20.11).

Vertex clustering (`city_ccby.simplify`) moves every corner to its grid cell's mean: cut hard, it
collapses thin parts (wheels, arms) and leaves scraps. Edge collapse by quadric error keeps the
silhouette at the same budget, so the cars' near and phone versions and the crowd's phone figures
use it. A triangle soup with one swatch per triangle goes in; its vertices are welded by position
(a seam between swatches would hold the simplifier back and, let loose, tear: the audit of 20.11),
and a triangle that comes out takes the swatch of the nearest one of the original facing its way.
With `seams`, the vertices are welded by position and swatch instead.
"""
import json
import os
import subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, 'mesh-tools', 'src', 'simplify.ts')


def _nearest_roles(Q, P, roles):
    """The swatch of each triangle of `Q`: that of the triangle of `P` whose centre is nearest, among those facing its way."""
    cq, cp = Q.mean(1), P.mean(1)
    nq = np.cross(Q[:, 1] - Q[:, 0], Q[:, 2] - Q[:, 0])
    npn = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    nq /= np.linalg.norm(nq, axis=1, keepdims=True) + 1e-12
    npn /= np.linalg.norm(npn, axis=1, keepdims=True) + 1e-12
    out = []
    for k in range(0, len(Q), 256):
        d = ((cq[k:k + 256, None, :] - cp[None, :, :]) ** 2).sum(-1)
        # A triangle facing away is no match: a sheet's two sides carry different swatches.
        d = d + (np.einsum('ij,kj->ik', nq[k:k + 256], npn) < 0.3) * 1e6
        out += [roles[j] for j in d.argmin(1)]
    return out


def qem_simplify(P, roles, target, error=0.05):
    """`P` [T,3,3] and its swatch per triangle down to at most `target` triangles; the same shapes out.
    First with the swatches' seams kept (clean colours); where they hold it over the target, welded by
    position alone, the colours from the original."""
    if len(P) <= target:
        return P, roles
    Q, R = _simplify(P, roles, target, error, True)
    return (Q, R) if len(Q) <= target else _simplify(P, roles, target, error, False)


def _simplify(P, roles, target, error, seams):
    keys = {}
    verts, vroles, idx = [], [], []
    for t in range(len(P)):
        for k in range(3):
            key = (tuple(np.round(P[t, k], 5)), roles[t] if seams else None)
            vi = keys.get(key)
            if vi is None:
                vi = keys[key] = len(verts)
                verts.append(P[t, k])
                vroles.append(roles[t])
            idx.append(vi)
    job = {'positions': np.asarray(verts, np.float64).reshape(-1).tolist(), 'indices': idx, 'target': int(target), 'error': error}
    out = subprocess.run(['node', SCRIPT], input=json.dumps(job), capture_output=True, text=True, check=True, cwd=os.path.join(HERE, 'mesh-tools'))
    res = json.loads(out.stdout)
    I = np.array(res['indices'], np.int64).reshape(-1, 3)
    V = np.asarray(verts)
    Q = V[I]
    return Q, ([vroles[a] for a, _, _ in I] if seams else _nearest_roles(Q, P, roles))
