"""Ricey mascot rig: one source of geometry -> SVG previews + Dart art file.

Every shape is a path using only M/L/C/Q/Z absolute commands so the tiny Dart
parser can read it. ViewBox 0 0 200 220.
"""
import math, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sash import sash_paths

K = 0.5522847498

def f(v):
    s = f"{v:.2f}".rstrip('0').rstrip('.')
    return '0' if s == '-0' else s

def ellipse(cx, cy, rx, ry, rot=0.0):
    rad = math.radians(rot)
    c, s = math.cos(rad), math.sin(rad)
    def T(x, y):
        return (cx + x * c - y * s, cy + x * s + y * c)
    pts = [
        (T(rx, 0), T(rx, ry * K), T(rx * K, ry), T(0, ry)),
        (T(0, ry), T(-rx * K, ry), T(-rx, ry * K), T(-rx, 0)),
        (T(-rx, 0), T(-rx, -ry * K), T(-rx * K, -ry), T(0, -ry)),
        (T(0, -ry), T(rx * K, -ry), T(rx, -ry * K), T(rx, 0)),
    ]
    d = f"M{f(pts[0][0][0])} {f(pts[0][0][1])}"
    for p0, p1, p2, p3 in pts:
        d += f" C{f(p1[0])} {f(p1[1])} {f(p2[0])} {f(p2[1])} {f(p3[0])} {f(p3[1])}"
    return d + " Z"

def star(cx, cy, r, inner=0.38):
    d = ''
    for i in range(8):
        a = math.pi / 4 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * inner
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        d += ('M' if i == 0 else ' L') + f"{f(x)} {f(y)}"
    return d + ' Z'

# palette ---------------------------------------------------------------
C = dict(
    green='#8DCB45', greenMid='#6FAE2C', greenDeep='#4F8A22', greenDark='#3A6418', greenLight='#BEE485', greenPale='#D8F0A8',
    cream='#FFFBEF', creamEdge='#F0E3C2', bodyLine='#A9824A',
    gold='#F8CB4A', goldLight='#FFE48A', goldDeep='#E7A923', goldLine='#B9851A', ink='#22301C', cheek='#F59C9C',
    mouth='#B8352E', tongue='#F2817A', white='#FFFFFF', shadow='#1B4332',
    steel='#46525C', lens='#D6ECF7', shield='#5FA82A', shieldLight='#CFE8B0',
)

def S(d, fill=None, stroke=None, sw=0, op=1.0, fill2=None, blur=0):
    """fill2: bottom colour of a vertical gradient over the shape bounds. blur: gaussian sigma."""
    return dict(d=d, fill=fill, stroke=stroke, sw=sw, op=op, fill2=fill2, blur=blur)

LINE = 2.6

# rig --------------------------------------------------------------------
BODY = 'M100 27 C143 27 172 82 172 132 C172 174 141 198 100 198 C59 198 28 174 28 132 C28 82 57 27 100 27 Z'

layers = {}
layers['shadow'] = [S(ellipse(100, 210, 48, 7), fill=C['shadow'], op=0.2, blur=3)]
layers['feet'] = [
    S(ellipse(80, 202, 16, 11.5), fill=C['green'], fill2=C['greenDeep'], stroke=C['greenDark'], sw=LINE),
    S(ellipse(120, 202, 16, 11.5), fill=C['green'], fill2=C['greenDeep'], stroke=C['greenDark'], sw=LINE),
    S(ellipse(75, 197, 6.5, 3, -10), fill=C['greenPale'], op=0.75, blur=0.6),
    S(ellipse(115, 197, 6.5, 3, -10), fill=C['greenPale'], op=0.75, blur=0.6),
]
layers['backLeaves'] = [
    S('M44 150 C30 142 22 128 18 108 C34 118 44 128 52 144 Z', fill=C['green'], fill2=C['greenDeep'], stroke=C['greenDark'], sw=LINE),
    S('M46 146 C36 136 28 124 22 112', stroke=C['greenDark'], sw=1.2, op=0.45),
    S('M154 138 C166 124 176 112 186 92 C186 112 178 128 162 146 Z', fill=C['green'], fill2=C['greenDeep'], stroke=C['greenDark'], sw=LINE),
    S('M158 140 C168 128 176 116 184 98', stroke=C['greenDark'], sw=1.2, op=0.45),
    S('M160 150 C172 146 184 140 192 128 C190 144 180 154 166 160 Z', fill=C['greenLight'], fill2=C['green'], stroke=C['greenDark'], sw=LINE),
    S('M164 154 C174 150 182 144 189 134', stroke=C['greenDark'], sw=1.1, op=0.4),
]
layers['body'] = [S(BODY, fill='body', stroke=C['bodyLine'], sw=LINE)]
layers['bodyShine'] = [
    # warm core shade on the right and lower left
    S('M148 64 C166 92 174 132 162 166 C152 186 132 196 110 198 C142 180 158 150 157 112 C156 94 153 78 148 64 Z',
      fill='#E8D3A4', op=0.55, blur=2.5),
    S('M44 150 C52 168 70 180 92 184 C70 186 46 176 36 158 Z', fill='#E8D3A4', op=0.35, blur=2),
    # glossy highlight
    S('M60 80 C64 64 76 50 90 44 C82 58 74 70 70 88 Z', fill=C['white'], op=0.9, blur=0.8),
    S(ellipse(56, 98, 3.2, 5.5, 20), fill=C['white'], op=0.7, blur=0.6),
]

# panicle (pivot 101 31)
def bez(p0, p1, p2, p3, t):
    u = 1 - t
    x = u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0]
    y = u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]
    dx = 3*u*u*(p1[0]-p0[0]) + 6*u*t*(p2[0]-p1[0]) + 3*t*t*(p3[0]-p2[0])
    dy = 3*u*u*(p1[1]-p0[1]) + 6*u*t*(p2[1]-p1[1]) + 3*t*t*(p3[1]-p2[1])
    return x, y, math.degrees(math.atan2(dy, dx))

seg1 = ((101, 31), (112, 6), (150, 0), (168, 22))
seg2 = ((168, 22), (176, 32), (178, 44), (176, 58))
pan = [S('M101 31 C112 6 150 0 168 22 C176 32 178 44 176 58', stroke=C['goldLine'], sw=2.6)]
grains = []
for seg, ts in ((seg1, [0.5, 0.68, 0.86]), (seg2, [0.15, 0.45, 0.75, 1.0])):
    for i, t in enumerate(ts):
        x, y, a = bez(*seg, t)
        for side in (-1, 1):
            if seg is seg2 and t == 1.0 and side == 1:
                continue
            ang = a + side * 38
            ox = x + math.cos(math.radians(ang)) * 7.6
            oy = y + math.sin(math.radians(ang)) * 7.6
            grains.append(S(ellipse(ox, oy, 8.4, 4.5, ang), fill=C['goldLight'], fill2=C['goldDeep'], stroke=C['goldLine'], sw=1.6))
            hx = ox + math.cos(math.radians(ang + 200)) * 2.2
            hy = oy + math.sin(math.radians(ang + 200)) * 2.2
            grains.append(S(ellipse(hx, hy, 3.6, 1.2, ang), fill=C['white'], op=0.7))
pan += grains
pan.append(S(ellipse(176, 64, 8, 4.4, 95), fill=C['goldLight'], fill2=C['goldDeep'], stroke=C['goldLine'], sw=1.6))
pan.append(S(ellipse(174.6, 62.5, 3.4, 1.1, 95), fill=C['white'], op=0.7))
layers['panicle'] = pan

layers['sprout'] = [
    S('M100 34 C86 30 70 32 58 44 C74 46 90 42 100 34 Z', fill=C['green'], fill2=C['greenDeep'], stroke=C['greenDark'], sw=LINE),
    S('M97 35 C86 35 74 38 64 42', stroke=C['greenDark'], sw=1.1, op=0.45),
    S('M100 34 C88 26 80 16 76 0 C92 8 100 20 100 34 Z', fill=C['greenLight'], fill2=C['green'], stroke=C['greenDark'], sw=LINE),
    S('M98 31 C92 22 84 12 79 4', stroke=C['greenDark'], sw=1.1, op=0.45),
    S('M100 34 C104 22 112 14 124 8 C122 22 112 30 100 34 Z', fill=C['greenPale'], fill2=C['greenLight'], stroke=C['greenDark'], sw=LINE),
    S('M102 31 C107 23 114 16 121 11', stroke=C['greenDark'], sw=1.1, op=0.4),
    S(ellipse(101, 33, 3.2, 2.6), fill=C['goldLine']),
]

CLOAK = ('M16 124 C30 136 42 146 58 152 C94 162 140 144 188 98 C182 118 176 128 171 134 '
         'C171 176 141 200 100 200 C59 200 29 176 29 142 C25 135 21 129 16 124 Z')
layers['cloak'] = [
    S(CLOAK, fill=C['green'], fill2=C['greenMid'], stroke=C['greenDark'], sw=LINE),
    # sash band + its shading
    S('M40 176 C80 182 132 170 168 142 L170 157 C134 184 84 194 48 190 Z', fill=C['greenMid'], fill2=C['greenDeep'], op=0.95),
    S('M42 177 C82 183 132 171 168 143', stroke=C['greenPale'], sw=1.6, op=0.55),
    # folds
    S('M60 158 C70 168 84 172 100 172', stroke=C['greenDeep'], sw=2.2, op=0.5),
    S('M128 160 C142 154 156 146 166 136', stroke=C['greenDeep'], sw=2, op=0.45),
    S('M34 168 C38 178 46 186 56 191', stroke=C['greenDeep'], sw=2, op=0.4),
    # rim light
    S('M28 136 C44 150 66 158 92 158', stroke=C['greenPale'], sw=3, op=0.85),
    S('M120 154 C140 148 160 134 178 116', stroke=C['greenPale'], sw=2.4, op=0.7),
]
FACE_DY = 5
# Name lettering follows the centre line of the sash band.
TEXT = dict(path=((44, 183), (82, 188), (133, 177), (169, 149.5)), size=11.8, spacing=1.1, text='KHAO HOM')
layers['sashText'] = [
    S(sash_paths(TEXT['text'], TEXT['path'], TEXT['size'], TEXT['spacing'], dy=0.9), fill='#2E5212', op=0.5, blur=0.4),
    S(sash_paths(TEXT['text'], TEXT['path'], TEXT['size'], TEXT['spacing']), fill=C['white']),
]

# arms in local coords: shoulder at (0,0), pointing +y
ARM = [
    S('M-9 -2 C-12 12 -12 22 -6 29 C0 35 11 32 12 23 C13 13 11 4 8 -2 Z', fill=C['green'], fill2=C['greenMid'], stroke=C['greenDark'], sw=LINE),
    S(ellipse(10, 18, 5, 6.5, -20), fill=C['green'], fill2=C['greenMid'], stroke=C['greenDark'], sw=2),
    S('M-6 6 C-8 14 -7 20 -4 24', stroke=C['greenPale'], sw=2.4, op=0.85),
]
ARMS = dict(L=dict(x=40, y=146, rest=28), R=dict(x=160, y=140, rest=-28))

# face -------------------------------------------------------------------
EYE_L, EYE_R = (76, 108), (124, 108)
def open_eye(cx, cy):
    return [
        S(ellipse(cx, cy, 8.6, 10.8), fill='#2A3A22', fill2='#141C10'),
        S(ellipse(cx, cy + 4.6, 6.2, 4.4), fill='#4E6B32', op=0.75, blur=1),
        S(ellipse(cx + 2.9, cy - 4.2, 3.5, 3.9), fill=C['white']),
        S(ellipse(cx - 3.1, cy + 4.6, 1.7, 1.7), fill=C['white'], op=0.9),
    ]
def happy_eye(cx, cy):
    return [S(f'M{cx-9} {cy+3} Q{cx} {cy-9} {cx+9} {cy+3}', stroke=C['ink'], sw=3.6)]
def sleep_eye(cx, cy):
    return [S(f'M{cx-8} {cy} Q{cx} {cy+7} {cx+8} {cy}', stroke=C['ink'], sw=3.2)]
def wink_eye(cx, cy):
    return [S(f'M{cx-9} {cy-5} L{cx+7} {cy} L{cx-9} {cy+5}', stroke=C['ink'], sw=3.4)]

EYES = {
    'open': dict(L=open_eye(*EYE_L), R=open_eye(*EYE_R)),
    'happy': dict(L=happy_eye(*EYE_L), R=happy_eye(*EYE_R)),
    'sleep': dict(L=sleep_eye(*EYE_L), R=sleep_eye(*EYE_R)),
    'wink': dict(L=open_eye(*EYE_L), R=wink_eye(*EYE_R)),
}
CHEEKS = [S(ellipse(60, 126, 10, 6), fill=C['cheek'], op=0.6, blur=2.2), S(ellipse(140, 126, 10, 6), fill=C['cheek'], op=0.6, blur=2.2),
          S('M55 125 L57 128 M60 124 L62 127 M65 125 L67 128', stroke='#E57C7C', sw=1, op=0.55),
          S('M135 125 L137 128 M140 124 L142 127 M145 125 L147 128', stroke='#E57C7C', sw=1, op=0.55)]
MOUTHS = {
    'open': [
        S('M88 122 C90 140 110 140 112 122 C104 125 96 125 88 122 Z', fill='#C7443A', fill2='#8E2620', stroke=C['ink'], sw=2.2),
        S('M93 133 C96 128 104 128 107 133 C103 137 97 137 93 133 Z', fill=C['tongue']),
    ],
    'big': [
        S('M84 120 C86 146 114 146 116 120 C106 124 94 124 84 120 Z', fill='#C7443A', fill2='#8E2620', stroke=C['ink'], sw=2.2),
        S('M91 136 C95 129 105 129 109 136 C104 141 96 141 91 136 Z', fill=C['tongue']),
    ],
    'smile': [S('M90 124 Q100 134 110 124', stroke=C['ink'], sw=3)],
    'o': [S(ellipse(100, 129, 4.6, 5.6), fill=C['mouth'], stroke=C['ink'], sw=2)],
    'worry': [S('M90 132 Q100 124 110 132', stroke=C['ink'], sw=3)],
    'hmm': [S('M92 129 Q97 126 101 129 Q105 132 109 128', stroke=C['ink'], sw=2.8)],
}
BROWS = {
    'none': [],
    'worry': [S('M64 92 L82 88', stroke=C['ink'], sw=3), S('M118 88 L136 92', stroke=C['ink'], sw=3)],
    'think': [S('M66 92 Q75 87 84 91', stroke=C['ink'], sw=3), S('M116 86 Q126 80 136 84', stroke=C['ink'], sw=3)],
}

# props (absolute coords) ------------------------------------------------
PROPS = {
    'magnifier': [
        S('M186 116 L191 134', stroke=C['steel'], sw=8),
        S(ellipse(180, 98, 17, 17), fill='#EAF6FD', fill2='#B9DDF2', stroke=C['steel'], sw=5, op=0.95),
        S('M170 92 Q173 85 181 84', stroke=C['white'], sw=3, op=0.9),
    ],
    'shield': [
        S('M30 132 C40 136 50 134 58 128 C66 134 76 136 86 132 C88 158 76 176 58 184 C40 176 28 158 30 132 Z',
          fill='#79C23A', fill2='#3F8A1E', stroke=C['greenDark'], sw=LINE),
        S('M37 139 C44 141 52 139 58 135 C64 139 72 141 79 139 C79 157 70 170 58 176 C46 170 37 157 37 139 Z',
          fill=C['shieldLight'], op=0.35),
        S('M46 156 L55 165 L72 146', stroke=C['white'], sw=5.5),
    ],
    'phone': [
        S('M14 134 C14 130 17 128 20 128 L44 128 C47 128 50 130 50 134 L50 176 C50 179 47 182 44 182 L20 182 C17 182 14 179 14 176 Z',
          fill='#3A4247', fill2='#1E2326', stroke='#14181A', sw=2),
        S('M19 136 L45 136 L45 172 L19 172 Z', fill='#3A4247'),
        S(ellipse(32, 152, 6, 8, 20), fill=C['green'], op=0.9),
    ],
    'sparkles': [
        S(star(30, 64, 9), fill=C['gold']), S(star(176, 78, 7), fill=C['gold']),
        S(star(18, 102, 5), fill=C['gold'], op=0.8), S(star(186, 120, 4.5), fill=C['gold'], op=0.8),
    ],
    'question': [],
    'zzz': [],
    'heart': [
        S('M30 44 C30 36 40 30 46 38 C52 30 62 36 62 44 C62 54 50 60 46 64 C42 60 30 54 30 44 Z',
          fill='#EF5B5B', stroke='#B83A3A', sw=2),
    ],
}

BACK_PROPS = ('sparkles',)
HELD_PROPS = ('magnifier', 'phone')

# moods ------------------------------------------------------------------
MOODS = {
    'happy':   dict(eyes='open',  mouth='open',  brows='none',  arms=('rest', 'rest'), props=[]),
    'hello':   dict(eyes='wink',  mouth='open',  brows='none',  arms=('rest', 'wave'), props=[]),
    'joy':     dict(eyes='happy', mouth='big',   brows='none',  arms=('up', 'up'), props=['sparkles']),
    'think':   dict(eyes='open',  mouth='hmm',   brows='think', arms=('chin', 'rest'), props=['question']),
    'worried': dict(eyes='open',  mouth='worry', brows='worry', arms=('rest', 'rest'), props=[]),
    'sleep':   dict(eyes='sleep', mouth='o',     brows='none',  arms=('rest', 'rest'), props=['zzz']),
    'scan':    dict(eyes='wink',  mouth='open',  brows='none',  arms=('rest', 'hold'), props=['magnifier']),
    'guard':   dict(eyes='happy', mouth='open',  brows='none',  arms=('hold', 'thumb'), props=['shield']),
    'phone':   dict(eyes='wink',  mouth='open',  brows='none',  arms=('hold', 'thumb'), props=['phone']),
}
ARM_POSE = dict(L=dict(rest=28, up=150, chin=-118, hold=-30), R=dict(rest=-28, wave=-150, up=-150, hold=-112, thumb=-80))

# ---------------------------------------------------------------- SVG out
GRADS = {}
BLURS = set()


def grad_id(a, b):
    if (a, b) not in GRADS:
        GRADS[(a, b)] = f'g{len(GRADS)}'
    return GRADS[(a, b)]


def defs(prefix=''):
    out = ['<defs><radialGradient id="%srbody" cx="0.38" cy="0.32" r="0.75">'
           '<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#FFF9EA"/>'
           '<stop offset="1" stop-color="#EEDFBC"/></radialGradient>' % prefix]
    for (a, b), gid in GRADS.items():
        out.append(f'<linearGradient id="{prefix}{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{a}"/>'
                   f'<stop offset="1" stop-color="{b}"/></linearGradient>')
    for sd in sorted(BLURS):
        out.append(f'<filter id="{prefix}b{f(sd).replace(".", "_")}" x="-50%" y="-50%" width="200%" height="200%">'
                   f'<feGaussianBlur stdDeviation="{f(sd)}"/></filter>')
    return ''.join(out) + '</defs>'


def svg_shape(s, prefix=''):
    attrs = [f'd="{s["d"]}"']
    fill = s['fill']
    if fill == 'body':
        fill = f'url(#{prefix}rbody)'
    elif fill and s.get('fill2'):
        fill = f'url(#{prefix}{grad_id(fill, s["fill2"])})'
    if s.get('blur'):
        BLURS.add(s['blur'])
        attrs.append(f'filter="url(#{prefix}b{f(s["blur"]).replace(".", "_")})"')
    attrs.append(f'fill="{fill}"' if fill else 'fill="none"')
    if s['stroke']:
        attrs.append(f'stroke="{s["stroke"]}" stroke-width="{f(s["sw"])}" stroke-linecap="round" stroke-linejoin="round"')
    if s['op'] != 1:
        attrs.append(f'opacity="{f(s["op"])}"')
    return '<path ' + ' '.join(attrs) + '/>'

def g(shapes, prefix=''):
    return ''.join(svg_shape(s, prefix) for s in shapes)

DEFS = ('<defs><radialGradient id="rbody" cx="0.38" cy="0.32" r="0.75">'
        '<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#FFF9EA"/>'
        '<stop offset="1" stop-color="#EEDFBC"/></radialGradient></defs>')

def arm_svg(side, pose):
    a = ARMS[side]
    ang = ARM_POSE[side][pose]
    flip = ' scale(-1 1)' if side == 'L' else ''
    return f'<g transform="translate({a["x"]} {a["y"]}) rotate({ang}){flip}">{g(ARM)}</g>'

def text_svg(sid='sash'):
    return g(layers['sashText'])

def extra_svg(name):
    if name == 'question':
        return ('<g><circle cx="168" cy="52" r="17" fill="#FFFFFF" stroke="#E4DFD3" stroke-width="2"/>'
                '<text x="168" y="60" text-anchor="middle" font-family="Arial" font-weight="900" font-size="22" fill="#6FAE2C">?</text></g>')
    if name == 'zzz':
        return ('<g fill="#6FAE2C" font-family="Arial" font-weight="900">'
                '<text x="150" y="58" font-size="16">z</text><text x="164" y="42" font-size="20">z</text>'
                '<text x="180" y="22" font-size="24">Z</text></g>')
    return g(PROPS[name])

def mood_svg(mood, size=200):
    m = MOODS[mood]
    eyes = EYES[m['eyes']]
    body_parts = [g(layers['shadow']), g(layers['feet']), g(layers['backLeaves']), g(layers['body']),
                  g(layers['bodyShine']), g(layers['panicle']), g(layers['sprout']),
                  '<g transform="translate(0 %d)">' % FACE_DY + g(CHEEKS) + g(eyes['L']) + g(eyes['R']) + g(BROWS[m['brows']]) + g(MOUTHS[m['mouth']]) + '</g>',
                  g(layers['cloak']), text_svg()]
    back_props = ''.join(extra_svg(p) for p in m['props'] if p in BACK_PROPS)
    held = ''.join(extra_svg(p) for p in m['props'] if p in HELD_PROPS)
    front_props = ''.join(extra_svg(p) for p in m['props'] if p not in BACK_PROPS + HELD_PROPS)
    arms = arm_svg('L', m['arms'][0]) + arm_svg('R', m['arms'][1])
    content = back_props + ''.join(body_parts) + held + arms + front_props
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -10 212 232" width="{size}" height="{size*232/212:.0f}">'
            + defs() + content + '</svg>')

if __name__ == '__main__':
    out = os.path.dirname(os.path.abspath(__file__))
    cells = ''.join(f'<div style="display:inline-block;text-align:center;margin:8px;font:14px sans-serif">{mood_svg(k, 220)}<br>{k}</div>' for k in MOODS)
    open(os.path.join(out, 'preview.html'), 'w', encoding='utf-8').write(
        f'<html><body style="margin:0;background:#F4F1E8;width:1300px">{cells}</body></html>')
    json.dump(dict(layers=layers, ARM=ARM, ARMS=ARMS, ARM_POSE=ARM_POSE, EYES=EYES, CHEEKS=CHEEKS, MOUTHS=MOUTHS,
                   BROWS=BROWS, PROPS=PROPS, MOODS=MOODS, TEXT=TEXT, FACE_DY=FACE_DY, EYE_L=EYE_L, EYE_R=EYE_R),
              open(os.path.join(out, 'rig.json'), 'w'), indent=0)
    print('ok')


# ---------------------------------------------------------------- Dart out
def dcol(c):
    return '0xFF' + c[1:].upper()

def dshape(s):
    args = [f"'{s['d']}'"]
    if s['fill'] == 'body':
        args.append('body: true')
    elif s['fill']:
        args.append(f"fill: {dcol(s['fill'])}")
        if s.get('fill2'):
            args.append(f"fill2: {dcol(s['fill2'])}")
    if s['stroke']:
        args.append(f"stroke: {dcol(s['stroke'])}, sw: {f(s['sw'])}")
    if s['op'] != 1:
        args.append(f"op: {f(s['op'])}")
    if s.get('blur'):
        args.append(f"blur: {f(s['blur'])}")
    return 'RShape(' + ', '.join(args) + ')'

def dlist(shapes, ind='  '):
    if not shapes:
        return '[]'
    return '[\n' + ''.join(f'{ind}  {dshape(s)},\n' for s in shapes) + ind + ']'

def dmap(d):
    return '{\n' + ''.join(f"  '{k}': {dlist(v, '  ')},\n" for k, v in d.items()) + '}'

def write_dart(path):
    o = ['// GENERATED by tool/ricey/gen.py (python tool/ricey/gen.py lib/widgets/ricey_art.dart) — Ricey mascot geometry (viewBox 0 0 200 220).',
         '// ignore_for_file: lines_longer_than_80_chars', '',
         "part of 'ricey.dart';", '']
    for name in ['shadow', 'feet', 'backLeaves', 'body', 'bodyShine', 'panicle', 'sprout', 'cloak', 'sashText']:
        o.append(f'const _{name} = <RShape>{dlist(layers[name], "")};')
    o.append(f'const _arm = <RShape>{dlist(ARM, "")};')
    o.append(f'const _cheeks = <RShape>{dlist(CHEEKS, "")};')
    o.append('const _eyesL = <String, List<RShape>>' + dmap({k: v['L'] for k, v in EYES.items()}) + ';')
    o.append('const _eyesR = <String, List<RShape>>' + dmap({k: v['R'] for k, v in EYES.items()}) + ';')
    o.append('const _mouths = <String, List<RShape>>' + dmap(MOUTHS) + ';')
    o.append('const _brows = <String, List<RShape>>' + dmap(BROWS) + ';')
    o.append('const _props = <String, List<RShape>>' + dmap({k: v for k, v in PROPS.items() if v}) + ';')
    o.append('const _armPose = <String, Map<String, double>>{')
    for side, poses in ARM_POSE.items():
        o.append(f"  '{side}': {{" + ', '.join(f"'{k}': {f(v)}" for k, v in poses.items()) + '},')
    o.append('};')
    o.append(f"const _shoulderL = Offset({f(ARMS['L']['x'])}, {f(ARMS['L']['y'])});")
    o.append(f"const _shoulderR = Offset({f(ARMS['R']['x'])}, {f(ARMS['R']['y'])});")
    o.append(f"const _eyeL = Offset({f(EYE_L[0])}, {f(EYE_L[1])});")
    o.append(f"const _eyeR = Offset({f(EYE_R[0])}, {f(EYE_R[1])});")
    o.append(f"const _faceDy = {f(FACE_DY)}.0;")
    o.append('')
    open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(o) + '\n')

if __name__ == '__main__' and len(sys.argv) > 1:
    write_dart(sys.argv[1])
    print('dart ok')
