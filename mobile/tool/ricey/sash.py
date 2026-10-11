"""Outlines the sash lettering (Nunito Black) along the sash curve.

The result is plain M/L/Q/C/Z path data, so the app, the SVG exports and the PNGs
all show identical lettering without needing the font at runtime.
"""
import math, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.basePen import BasePen

FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts', 'Nunito.ttf')


def _bez(p, t):
    u = 1 - t
    x = u ** 3 * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t ** 3 * p[3][0]
    y = u ** 3 * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t ** 3 * p[3][1]
    dx = 3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0])
    dy = 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1])
    return x, y, math.atan2(dy, dx)


class _Pen(BasePen):
    def __init__(self, glyphset, xf):
        super().__init__(glyphset)
        self.d, self.xf = [], xf

    def _pt(self, p):
        x, y = self.xf(p)
        return f'{x:.2f} {y:.2f}'

    def _moveTo(self, p):
        self.d.append('M' + self._pt(p))

    def _lineTo(self, p):
        self.d.append('L' + self._pt(p))

    def _curveToOne(self, a, b, c):
        self.d.append('C' + ' '.join(self._pt(q) for q in (a, b, c)))

    def _qCurveToOne(self, a, b):
        self.d.append('Q' + self._pt(a) + ' ' + self._pt(b))

    def _closePath(self):
        self.d.append('Z')


def sash_paths(text, curve, size, spacing, weight=900, dy=0.0):
    font = TTFont(FONT)
    font = instantiateVariableFont(font, {'wght': weight})
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font['head'].unitsPerEm
    k = size / upm
    cap = font['OS/2'].sCapHeight * k
    # arc-length table
    n = 200
    pts = [_bez(curve, i / n) for i in range(n + 1)]
    L = [0.0]
    for i in range(1, n + 1):
        L.append(L[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))

    def at(s):
        for i in range(1, n + 1):
            if L[i] >= s:
                f = (s - L[i - 1]) / (L[i] - L[i - 1])
                return _bez(curve, (i - 1 + f) / n)
        return _bez(curve, 1)

    names = [cmap[ord(ch)] for ch in text]
    adv = [gs[nm].width * k for nm in names]
    total = sum(adv) + spacing * (len(text) - 1)
    s = (L[-1] - total) / 2
    d = []
    for nm, w in zip(names, adv):
        cx, cy, a = at(s + w / 2)
        ca, sa = math.cos(a), math.sin(a)

        def xf(p, w=w, cx=cx, cy=cy, ca=ca, sa=sa):
            lx = p[0] * k - w / 2
            ly = -p[1] * k + cap / 2 + dy
            return cx + lx * ca - ly * sa, cy + lx * sa + ly * ca

        pen = _Pen(gs, xf)
        gs[nm].draw(pen)
        d.extend(pen.d)
        s += w + spacing
    return ' '.join(d)
