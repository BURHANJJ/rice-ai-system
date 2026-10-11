"""Thai/Latin text -> outlined SVG path data (HarfBuzz shaping + fontTools outlines).

Outlined text renders identically everywhere, including inside <img> where web fonts cannot load.
"""
import os
from functools import lru_cache
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts')
FILES = {'semibold': 'IBMPlexSansThai-SemiBold.ttf', 'bold': 'IBMPlexSansThai-Bold.ttf'}


@lru_cache(None)
def _load(weight):
    path = os.path.join(FONTS, FILES[weight])
    blob = hb.Blob.from_file_path(path)
    face = hb.Face(blob)
    font = hb.Font(face)
    tt = TTFont(path)
    return font, tt, tt.getGlyphSet(), tt.getGlyphOrder(), tt['head'].unitsPerEm


def text_path(text, x, y, size, weight='bold', anchor='start'):
    """Path for `text` with its baseline at y. anchor: start | middle | end."""
    font, tt, gs, order, upm = _load(weight)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {})
    k = size / upm
    width = sum(p.x_advance for p in buf.glyph_positions) * k
    x0 = x - (width / 2 if anchor == 'middle' else width if anchor == 'end' else 0)
    pen = SVGPathPen(gs, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.'))
    cx = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        gx = x0 + (cx + pos.x_offset) * k
        gy = y - pos.y_offset * k
        gs[order[info.codepoint]].draw(TransformPen(pen, (k, 0, 0, -k, gx, gy)))
        cx += pos.x_advance
    return pen.getCommands()


def text(t, x, y, size, fill, weight='bold', anchor='start', extra=''):
    return f'<path d="{text_path(t, x, y, size, weight, anchor)}" fill="{fill}"{extra}/>'
