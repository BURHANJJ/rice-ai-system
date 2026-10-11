"""Illustrations of น้องข้าวหอม in the vector style (phone, shield, disease-scan scene).

    python tool/ricey/illus.py      (from mobile/; needs Google Chrome)

Writes to assets/mascot/illustrations/:
  khao_hom_<name>.svg            static vector
  khao_hom_<name>.animated.svg   self-contained CSS animation (works in a plain <img>)
  khao_hom_<name>.png            transparent PNG
All text is outlined (IBM Plex Sans Thai), so files look identical everywhere.
"""
import math, os, subprocess, sys, tempfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen  # noqa: E402
import anim  # noqa: E402
from textpath import text  # noqa: E402

OUT = os.path.join(HERE, '..', '..', 'assets', 'mascot', 'illustrations')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

CSS = """
.i-float{animation:i-float 3.6s ease-in-out infinite}
.i-float.b{animation-duration:4.4s;animation-delay:-1.2s}
.i-float.c{animation-duration:5s;animation-delay:-2.4s}
.i-tw{transform-box:fill-box;transform-origin:center;animation:i-tw 1.8s ease-in-out infinite}
.i-leaf{transform-box:fill-box;transform-origin:center;animation:i-leaf 5s ease-in-out infinite}
.i-heart{transform-box:fill-box;transform-origin:center;animation:i-beat 1.4s ease-in-out infinite}
.i-ring{transform-box:fill-box;transform-origin:center;animation:i-ring 2.4s ease-out infinite}
.i-ring.b{animation-delay:-1.2s}
.i-sway{transform-box:fill-box;transform-origin:50% 100%;animation:i-sway 4s ease-in-out infinite}
.i-glow{animation:i-glow 2.4s ease-in-out infinite}
.i-corners{transform-box:fill-box;transform-origin:center;animation:i-corners 2.4s ease-in-out infinite}
.i-dash{animation:i-dash 1.2s linear infinite}
.i-bar{transform-box:fill-box;transform-origin:0 50%;animation:i-bar 6s cubic-bezier(.2,.8,.2,1) infinite}
.i-line{stroke-dasharray:420;animation:i-line 6s ease-out infinite}
.i-dot{transform-box:fill-box;transform-origin:center;animation:i-dot 6s ease-out infinite}
.i-badge{transform-box:fill-box;transform-origin:center;animation:i-badge 6s ease-out infinite}
.i-shine{animation:i-shine 4s ease-in-out infinite}
.i-pop{transform-box:fill-box;transform-origin:50% 100%;animation:i-pop 6s cubic-bezier(.34,1.56,.64,1) infinite}
@keyframes i-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes i-tw{0%,100%{transform:scale(.5);opacity:.35}50%{transform:scale(1.12);opacity:1}}
@keyframes i-leaf{0%,100%{transform:translate(0,0) rotate(0)}50%{transform:translate(6px,-10px) rotate(12deg)}}
@keyframes i-beat{0%,60%,100%{transform:scale(1)}20%{transform:scale(1.18)}40%{transform:scale(.96)}}
@keyframes i-ring{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.25);opacity:0}}
@keyframes i-sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2.2deg)}}
@keyframes i-glow{0%,100%{opacity:.35}50%{opacity:.85}}
@keyframes i-corners{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes i-dash{to{stroke-dashoffset:-28}}
@keyframes i-bar{0%{transform:scaleX(0)}22%,100%{transform:scaleX(1)}}
@keyframes i-line{0%{stroke-dashoffset:420}30%,100%{stroke-dashoffset:0}}
@keyframes i-dot{0%,24%{transform:scale(0)}34%{transform:scale(1.3)}40%,100%{transform:scale(1)}}
@keyframes i-badge{0%,30%{transform:scale(1)}36%{transform:scale(1.35)}44%,100%{transform:scale(1)}}
@keyframes i-shine{0%,55%{transform:translateX(-260px)}85%,100%{transform:translateX(260px)}}
@keyframes i-pop{0%{transform:scale(.7)}8%{transform:scale(1.04)}12%,100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
"""


class Ctx:
    def __init__(self, animated):
        self.a = animated

    def g(self, cls, inner, extra=''):
        return f'<g class="{cls}"{extra}>{inner}</g>' if self.a else inner

    def mascot(self, mood, x, y, w):
        h = w * 232 / 212
        if self.a:
            s = anim.ricey(mood, 212, 'น้องข้าวหอม')
            return s.replace('<svg class=', f'<svg x="{x:.1f}" y="{y:.1f}" class=', 1) \
                    .replace('width="212" height="232"', f'width="{w:.1f}" height="{h:.1f}"', 1)
        s = gen.mood_svg(mood, 212)
        return s.replace('<svg xmlns="http://www.w3.org/2000/svg"',
                         f'<svg x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"', 1) \
                .replace('width="212" height="232"', '', 1)


def star(c, cx, cy, r, fill='#F8CB4A', op=1, delay=0):
    p = f'<path d="{gen.star(cx, cy, r)}" fill="{fill}" opacity="{op}"/>'
    return c.g('i-tw', p, f' style="animation-delay:{delay}s"')


def heart_bubble(c, cx, cy, r, cls='i-float'):
    bub = (f'<g filter="url(#soft)"><circle cx="{cx}" cy="{cy}" r="{r}" fill="#FFFFFF"/>'
           f'<path d="M{cx - r * .28} {cy + r * .55} L{cx - r * .45} {cy + r * 1.05} L{cx + r * .05} {cy + r * .8}Z" fill="#FFFFFF"/></g>')
    heart = (f'<path transform="translate({cx} {cy + 2}) scale({r / 34})" d="M0 14 C-10 6 -18 0 -18 -8 C-18 -15 -12 -19 -7 -19 '
             f'C-3 -19 -1 -17 0 -14 C1 -17 3 -19 7 -19 C12 -19 18 -15 18 -8 C18 0 10 6 0 14Z" fill="#EF4444"/>')
    return c.g(cls, bub + c.g('i-heart', heart))


def leaf_path(x, y, ang, length, width):
    a = math.radians(ang)
    tx, ty = x + math.sin(a) * length, y - math.cos(a) * length
    nx, ny = math.cos(a) * width, math.sin(a) * width
    mx, my = (x + tx) / 2, (y + ty) / 2
    return (f'<path d="M{x:.1f} {y:.1f} Q{mx + nx:.1f} {my + ny:.1f} {tx:.1f} {ty:.1f} Q{mx - nx:.1f} {my - ny:.1f} {x:.1f} {y:.1f}Z" '
            f'fill="url(#lf)" stroke="#2F6B16" stroke-width="2"/>'
            f'<path d="M{x:.1f} {y:.1f} L{tx:.1f} {ty:.1f}" stroke="#2F6B16" stroke-width="1.2" opacity=".45"/>')


def float_leaf(c, x, y, ang, length, width, delay=0):
    return c.g('i-leaf', leaf_path(x, y, ang, length, width), f' style="animation-delay:{delay}s"')


DEFS = '''<defs>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#1B4332" flood-opacity=".18"/></filter>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
<linearGradient id="lf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A6DA5E"/><stop offset="1" stop-color="#3F8A1E"/></linearGradient>
<linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1F6B45"/><stop offset="1" stop-color="#0F3D2A"/></linearGradient>
<linearGradient id="shieldG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8DD24F"/><stop offset="1" stop-color="#2F7A1A"/></linearGradient>
<linearGradient id="soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9C6B3E"/><stop offset="1" stop-color="#6B4425"/></linearGradient>
<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<radialGradient id="ring" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#4ADE80" stop-opacity="0"/><stop offset=".85" stop-color="#4ADE80" stop-opacity=".45"/><stop offset="1" stop-color="#4ADE80" stop-opacity="0"/></radialGradient>
<clipPath id="zoom"><circle cx="0" cy="0" r="92"/></clipPath>
</defs>'''


def doc(c, w, h, body):
    style = f'<style>{anim.RICEY_CSS}{CSS}</style>' if c.a else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
            f'aria-label="น้องข้าวหอม มาสคอตของ Rice AI">{style}{DEFS}{body}</svg>')


def phone(c):
    body = (heart_bubble(c, 250, 230, 52)
            + star(c, 820, 250, 26) + star(c, 870, 330, 13, op=.8, delay=-.6) + star(c, 170, 470, 15, op=.8, delay=-1.1)
            + float_leaf(c, 120, 620, -60, 90, 16) + float_leaf(c, 880, 560, 55, 80, 14, -2)
            + c.mascot('phone', 140, 120, 720))
    return doc(c, 1000, 1000, body)


def shield(c):
    body = (star(c, 150, 260, 28) + star(c, 860, 230, 22, delay=-.7) + star(c, 900, 330, 12, op=.8, delay=-1.2)
            + star(c, 110, 380, 12, op=.8, delay=-.3)
            + float_leaf(c, 110, 640, -60, 90, 16) + float_leaf(c, 890, 600, 55, 80, 14, -2.5)
            + c.mascot('guard', 140, 120, 720))
    return doc(c, 1000, 1000, body)


def rice_plant(c, bx, by):
    out = [f'<ellipse cx="{bx}" cy="{by + 6}" rx="170" ry="34" fill="url(#soil)"/>',
           f'<ellipse cx="{bx - 30}" cy="{by - 4}" rx="90" ry="12" fill="#B58256" opacity=".55"/>']
    blades = [(-34, 300, 22), (-18, 360, 24), (-6, 400, 22), (8, 380, 24), (22, 330, 22), (38, 270, 20), (-48, 230, 18)]
    lesions = {-18: [(-.42, .55, 13, -30), (-.25, .38, 10, -25)], 22: [(.7, .62, 12, 25), (.95, .42, 9, 30)], -6: [(.1, .72, 9, 5)]}
    for i, (ang, ln, wd) in enumerate(blades):
        x = bx + ang * .8
        blade = leaf_path(x, by, ang, ln, wd)
        a = math.radians(ang)
        for (fx, fy, r, rot) in lesions.get(ang, []):
            lx, ly = x + math.sin(a) * ln * fy, by - math.cos(a) * ln * fy
            blade += (f'<ellipse cx="{lx:.1f}" cy="{ly:.1f}" rx="{r * 1.9}" ry="{r * 1.2}" transform="rotate({ang} {lx:.1f} {ly:.1f})" fill="#F2D35B" opacity=".75"/>'
                      f'<ellipse cx="{lx:.1f}" cy="{ly:.1f}" rx="{r * 1.35}" ry="{r * .8}" transform="rotate({ang} {lx:.1f} {ly:.1f})" fill="#8A4B1F"/>'
                      f'<ellipse cx="{lx:.1f}" cy="{ly:.1f}" rx="{r * .6}" ry="{r * .35}" transform="rotate({ang} {lx:.1f} {ly:.1f})" fill="#C9C2B4"/>')
        out.append(c.g('i-sway', blade, f' style="animation-delay:{-i * .55:.2f}s"'))
    return ''.join(out)


def zoom_callout(c, cx, cy):
    spots = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="{r * 2}" ry="{r * 1.25}" transform="rotate(-35 {x} {y})" fill="#F2D35B" opacity=".8"/>'
                    f'<ellipse cx="{x}" cy="{y}" rx="{r * 1.4}" ry="{r * .85}" transform="rotate(-35 {x} {y})" fill="#8A4B1F"/>'
                    f'<ellipse cx="{x}" cy="{y}" rx="{r * .65}" ry="{r * .38}" transform="rotate(-35 {x} {y})" fill="#CFC8BA"/>'
                    for x, y, r in [(-20, -10, 16), (30, -45, 11), (-55, 35, 10), (40, 30, 8)])
    corner = 'stroke="#F8CB4A" stroke-width="7" fill="none" stroke-linecap="round"'
    corners = (f'<path d="M-118 -70 V-118 H-70" {corner}/><path d="M70 -118 H118 V-70" {corner}/>'
               f'<path d="M118 70 V118 H70" {corner}/><path d="M-70 118 H-118 V70" {corner}/>')
    scanline = ''
    if c.a:
        scanline = ('<g clip-path="url(#zoom)"><rect x="-92" y="-3" width="184" height="6" fill="#4ADE80" opacity=".85">'
                    '<animate attributeName="y" values="-92;88;-92" dur="2.6s" repeatCount="indefinite"/></rect></g>')
    return (f'<g transform="translate({cx} {cy})">'
            + c.g('i-glow', '<circle r="112" fill="#4ADE80" opacity=".25" filter="url(#glow)"/>')
            + f'<g clip-path="url(#zoom)"><rect x="-100" y="-100" width="200" height="200" fill="#DDF3C4"/>'
            f'<path d="M-150 90 C-60 10 40 -60 150 -120 L150 -40 C50 10 -40 70 -150 160Z" fill="url(#lf)"/>'
            f'<path d="M-150 125 C-50 40 50 -20 150 -80" stroke="#2F6B16" stroke-width="2" opacity=".4" fill="none"/>{spots}</g>'
            + scanline
            + '<circle r="92" fill="none" stroke="#FFFFFF" stroke-width="9"/>'
            '<circle r="98" fill="none" stroke="#2F6B16" stroke-width="2.5" opacity=".6"/>'
            + c.g('i-corners', corners) + '</g>')


def alert(c, x, y):
    inner = (f'<g filter="url(#soft)"><rect x="{x}" y="{y}" width="290" height="112" rx="24" fill="#FFFFFF"/>'
             f'<path d="M{x + 120} {y + 110} L{x + 150} {y + 146} L{x + 168} {y + 110}Z" fill="#FFFFFF"/></g>'
             f'<path d="M{x + 52} {y + 26} L{x + 82} {y + 80} L{x + 22} {y + 80}Z" fill="#EF4444" stroke="#EF4444" stroke-width="8" stroke-linejoin="round"/>'
             f'<path d="M{x + 52} {y + 44} V{y + 62}" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>'
             f'<circle cx="{x + 52}" cy="{y + 73}" r="4" fill="#FFFFFF"/>'
             + text('ตรวจพบโรค', x + 104, y + 48, 30, '#1C211E')
             + f'<rect x="{x + 104}" y="{y + 62}" width="150" height="36" rx="18" fill="#EF4444"/>'
             + text('โรคใบไหม้', x + 179, y + 88, 21, '#FFFFFF', anchor='middle'))
    return c.g('i-float b', c.g('i-pop', inner))


def mini_leaf(x, y, w, h, kind):
    base = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="#E9F5DC"/>'
            f'<path d="M{x + 14} {y + h - 12} C{x + w * .3} {y + h * .4} {x + w * .6} {y + h * .2} {x + w - 12} {y + 12} '
            f'C{x + w * .75} {y + h * .45} {x + w * .45} {y + h * .75} {x + 14} {y + h - 12}Z" fill="url(#lf)"/>')
    if kind == 'blast':
        base += ''.join(f'<ellipse cx="{x + w * fx}" cy="{y + h * fy}" rx="7" ry="4" transform="rotate(-40 {x + w * fx} {y + h * fy})" fill="#8A4B1F"/>'
                        for fx, fy in [(.45, .5), (.62, .35), (.32, .66)])
    elif kind == 'blight':
        base += (f'<path d="M{x + w * .55} {y + h * .3} C{x + w * .7} {y + h * .2} {x + w - 14} {y + 14} {x + w - 12} {y + 12} '
                 f'C{x + w * .8} {y + h * .35} {x + w * .65} {y + h * .45} {x + w * .55} {y + h * .3}Z" fill="#E8B23A"/>')
    return base


def dashboard(c, x, y):
    w, h = 470, 500
    rows = [('#EF4444', 'โรคใบไหม้', .68, '68%'), ('#F59E0B', 'ขอบใบแห้ง', .24, '24%'), ('#22C55E', 'ปกติ', .08, '8%')]
    r = ''
    for i, (col, lab, v, pct) in enumerate(rows):
        yy = y + 104 + i * 58
        grow = (f'<animate attributeName="width" values="0;{150 * v:.0f};{150 * v:.0f}" keyTimes="0;.22;1" dur="6s" '
                f'begin="{i * .12:.2f}s" repeatCount="indefinite" calcMode="spline" keySplines=".2 .8 .2 1;0 0 1 1"/>') if c.a else ''
        bar = f'<rect x="{x + 72}" y="{yy + 24}" width="{150 * v:.0f}" height="8" rx="4" fill="{col}">{grow}</rect>'
        r += (f'<rect x="{x + 26}" y="{yy}" width="34" height="34" rx="9" fill="{col}"/>'
              + text(lab, x + 72, yy + 17, 17, '#E8F5E9', 'semibold')
              + f'<rect x="{x + 72}" y="{yy + 24}" width="150" height="8" rx="4" fill="#FFFFFF" opacity=".15"/>'
              + bar
              + text(pct, x + 262, yy + 31, 17, '#FFFFFF', anchor='end'))
    pts = [(x + 300, y + 260), (x + 335, y + 236), (x + 365, y + 246), (x + 400, y + 200), (x + 440, y + 160)]
    poly = ' '.join(f'{a},{b}' for a, b in pts)
    bars = ''.join(f'<rect x="{x + 300 + i * 30}" y="{y + 290 - hh}" width="18" height="{hh}" rx="4" fill="#4ADE80" opacity=".35"/>'
                   for i, hh in enumerate([30, 52, 40, 70, 96]))
    line = f'<polyline class="{"i-line" if c.a else ""}" points="{poly}" fill="none" stroke="#86EFAC" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    dots = ''.join(c.g('i-dot', f'<circle cx="{a}" cy="{b}" r="5" fill="#FFFFFF"/>', f' style="animation-delay:{i * .25:.2f}s"')
                   for i, (a, b) in enumerate(pts))
    thumbs = ''.join(mini_leaf(x + 26 + i * 146, y + 340, 128, 100, k)
                     + text(lab, x + 90 + i * 146, y + 472, 16, '#E8F5E9', 'semibold', 'middle')
                     for i, (k, lab) in enumerate([('blast', 'ใบไหม้'), ('blight', 'ขอบใบแห้ง'), ('ok', 'ปกติ')]))
    badge = (f'<circle cx="{x + w - 42}" cy="{y + 40}" r="17" fill="#22C55E"/>'
             f'<path d="M{x + w - 50} {y + 40} l6 6 l11 -12" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
    inner = (f'<g filter="url(#soft)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="30" fill="url(#panel)"/></g>'
             f'<rect x="{x + 1.5}" y="{y + 1.5}" width="{w - 3}" height="{h - 3}" rx="29" fill="none" stroke="#86EFAC" stroke-opacity=".45" stroke-width="3"/>'
             f'<rect x="{x}" y="{y}" width="{w}" height="78" rx="30" fill="#FFFFFF" opacity=".06"/>'
             f'<circle cx="{x + 44}" cy="{y + 40}" r="20" fill="#86EFAC" opacity=".25"/>'
             f'<path d="M{x + 44} {y + 52} V{y + 40} M{x + 44} {y + 42} C{x + 44} {y + 32} {x + 50} {y + 27} {x + 57} {y + 27} C{x + 57} {y + 37} {x + 51} {y + 42} {x + 44} {y + 42}Z '
             f'M{x + 44} {y + 46} C{x + 44} {y + 39} {x + 39} {y + 35} {x + 32} {y + 35} C{x + 32} {y + 42} {x + 37} {y + 46} {x + 44} {y + 46}Z" fill="#BBF7D0" stroke="#BBF7D0" stroke-width="2"/>'
             + text('เฝ้าระวังโรคข้าว', x + 76, y + 50, 25, '#FFFFFF')
             + c.g('i-badge', badge)
             + r + text('สถิติการตรวจ', x + 300, y + 127, 16, '#BBF7D0', 'semibold') + bars + line + dots + thumbs)
    return c.g('i-float c', inner)


def big_shield(c, cx, cy, s):
    p = (f'M0 -{s} C{s * .35} -{s * .82} {s * .62} -{s * .82} {s * .8} -{s * .9} C{s * .86} -{s * .2} {s * .6} {s * .55} 0 {s} '
         f'C-{s * .6} {s * .55} -{s * .86} -{s * .2} -{s * .8} -{s * .9} C-{s * .62} -{s * .82} -{s * .35} -{s * .82} 0 -{s}Z')
    shine = ''
    if c.a:
        shine = (f'<clipPath id="shieldClip"><path d="{p}"/></clipPath>'
                 f'<g clip-path="url(#shieldClip)"><g class="i-shine"><rect x="-60" y="-{s * 1.2}" width="70" height="{s * 2.4}" '
                 f'fill="url(#shine)" transform="rotate(20)"/></g></g>')
    inner = (f'<g filter="url(#soft)"><path d="{p}" fill="url(#shieldG)" stroke="#256312" stroke-width="5"/></g>'
             f'<path d="{p}" transform="scale(.8)" fill="#FFFFFF" opacity=".16"/>' + shine
             + f'<path d="M-{s * .36} {s * .02} L-{s * .08} {s * .3} L{s * .42} -{s * .26}" stroke="#FFFFFF" stroke-width="{s * .17}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
             f'<path d="M-{s * .55} -{s * .62} C-{s * .3} -{s * .7} -{s * .1} -{s * .74} 0 -{s * .82}" stroke="#FFFFFF" stroke-width="{s * .06}" opacity=".6" fill="none" stroke-linecap="round"/>')
    return f'<g transform="translate({cx} {cy})">' + c.g('i-float', inner) + '</g>'


def scene(c):
    rings = (c.g('i-ring', '<ellipse cx="770" cy="900" rx="215" ry="40" fill="none" stroke="#4ADE80" stroke-width="4" opacity=".55"/>')
             + c.g('i-ring b', '<ellipse cx="770" cy="900" rx="215" ry="40" fill="none" stroke="#86EFAC" stroke-width="3" opacity=".5"/>')
             if c.a else
             '<ellipse cx="770" cy="900" rx="215" ry="40" fill="none" stroke="#4ADE80" stroke-width="4" opacity=".55"/>'
             '<ellipse cx="770" cy="900" rx="160" ry="28" fill="none" stroke="#86EFAC" stroke-width="3" opacity=".5"/>')
    leader = (f'<path class="{"i-dash" if c.a else ""}" d="M300 560 Q300 600 270 640" stroke="#4ADE80" stroke-width="4" '
              f'stroke-dasharray="4 10" fill="none" stroke-linecap="round"/>')
    body = (
        c.g('i-glow', '<ellipse cx="770" cy="900" rx="260" ry="52" fill="url(#ring)"/>')
        + rings
        + rice_plant(c, 300, 880)
        + leader
        + c.g('i-float', zoom_callout(c, 250, 450))
        + alert(c, 70, 170)
        + dashboard(c, 1010, 150)
        + float_leaf(c, 560, 330, -40, 70, 13) + float_leaf(c, 985, 720, 40, 60, 11, -1.6) + float_leaf(c, 470, 760, -70, 60, 11, -3)
        + star(c, 640, 260, 22) + star(c, 980, 120, 16, op=.85, delay=-.5) + star(c, 1480, 700, 18, op=.85, delay=-1)
        + star(c, 500, 620, 12, op=.8, delay=-1.4)
        + c.mascot('scan', 525, 395, 470)
        + heart_bubble(c, 935, 330, 40, 'i-float b')
        + big_shield(c, 1300, 790, 118)
    )
    return doc(c, 1536, 1024, body)


def render(svg, png, w, h, tmp):
    page = os.path.join(tmp, os.path.basename(png) + '.html')
    open(page, 'w', encoding='utf-8').write('<html><body style="margin:0;background:transparent">' + svg + '</body></html>')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                    f'--window-size={w},{h}', f'--screenshot={png}', 'file:///' + page.replace('\\', '/')],
                   check=True, capture_output=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    try:
        for name, fn, w, h in [('phone', phone, 1000, 1000), ('shield', shield, 1000, 1000), ('scene', scene, 1536, 1024)]:
            still = fn(Ctx(False))
            open(os.path.join(OUT, f'khao_hom_{name}.svg'), 'w', encoding='utf-8').write(still)
            open(os.path.join(OUT, f'khao_hom_{name}.animated.svg'), 'w', encoding='utf-8').write(fn(Ctx(True)))
            render(still, os.path.join(OUT, f'khao_hom_{name}.png'), w, h, tmp)
            print('illustration', name)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
