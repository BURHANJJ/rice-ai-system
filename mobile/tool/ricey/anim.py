"""CSS-animated Ricey SVG for the design canvas (same rig as the Flutter painter)."""
from gen import *  # noqa

RICEY_CSS = """
.ricey{display:block;overflow:visible;cursor:pointer;flex:none}
.ricey g,.ricey path,.ricey text{transform-box:view-box}
.ricey .r-all{transform-origin:100px 210px;animation:r-in .7s cubic-bezier(.34,1.56,.64,1) both}
.ricey .r-rig{transform-origin:100px 206px;animation:r-breath 3.2s ease-in-out infinite}
.ricey .r-lift{animation:r-bob 3.2s ease-in-out infinite}
.ricey .r-shadow{transform-origin:100px 210px;animation:r-shadow 3.2s ease-in-out infinite}
.ricey .r-pan{transform-origin:101px 31px;animation:r-sway 3.2s ease-in-out infinite}
.ricey .r-sprout{transform-origin:100px 34px;animation:r-sway 3.2s ease-in-out -.9s infinite}
.ricey .r-eye{transform-box:fill-box;transform-origin:50% 70%;animation:r-blink 4.6s infinite}
.ricey .r-talk{transform-box:fill-box;transform-origin:50% 0;animation:r-talk 1.6s ease-in-out infinite}
.ricey .r-arm{transform-origin:0 0;animation:r-arm 3.2s ease-in-out infinite}
.ricey .r-arm.wave{animation:r-wave .8s ease-in-out infinite}
.ricey .r-arm.up{animation:r-up 1.6s ease-in-out infinite}
.ricey .r-arm.upR{animation:r-upR 1.6s ease-in-out infinite}
.ricey .r-held{transform-origin:160px 140px;animation:r-hold 3.2s ease-in-out infinite}
.ricey .r-spark{transform-box:fill-box;transform-origin:center;animation:r-twinkle 1.6s ease-in-out infinite}
.ricey .r-q{animation:r-qbob 1.6s ease-in-out infinite}
.ricey .r-z{transform-box:fill-box;transform-origin:center;opacity:0;animation:r-z 3.2s linear infinite}
.ricey.joy .r-lift{animation:r-jump .8s cubic-bezier(.3,0,.5,1) infinite}
.ricey.joy .r-shadow{animation:r-shadowj .8s cubic-bezier(.3,0,.5,1) infinite}
.ricey.sleep .r-rig{animation:r-breath2 3.2s ease-in-out infinite}
.ricey.worried .r-rig{animation:r-breath 3.2s ease-in-out infinite,r-shiver .23s linear infinite}
.ricey:hover .r-all,.ricey:active .r-all{animation:r-hop .64s ease-out}
@keyframes r-in{from{transform:scale(.4)}to{transform:scale(1)}}
@keyframes r-breath{0%,100%{transform:scale(1,1)}50%{transform:scale(.99,1.018)}}
@keyframes r-breath2{0%,100%{transform:scale(1,1)}50%{transform:scale(.98,1.035)}}
@keyframes r-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes r-shadow{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.96)}}
@keyframes r-jump{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes r-shadowj{0%,100%{transform:scaleX(1);opacity:1}50%{transform:scaleX(.8);opacity:.6}}
@keyframes r-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4.5deg)}}
@keyframes r-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes r-talk{0%,100%{transform:scaleY(.92)}50%{transform:scaleY(1.04)}}
@keyframes r-arm{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes r-wave{0%,100%{transform:rotate(-20deg)}50%{transform:rotate(20deg)}}
@keyframes r-up{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(12deg)}}
@keyframes r-upR{0%,100%{transform:rotate(12deg)}50%{transform:rotate(-12deg)}}
@keyframes r-hold{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes r-twinkle{0%,100%{transform:scale(.55);opacity:.35}50%{transform:scale(1.15);opacity:1}}
@keyframes r-qbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes r-z{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:1}75%{opacity:1}100%{transform:translate(30px,-52px) scale(1.5);opacity:0}}
@keyframes r-shiver{0%,100%{translate:0 0}50%{translate:.7px 0}}
@keyframes r-hop{0%{transform:scale(1.08,.92)}18%{transform:scale(1)}45%{transform:translateY(-22px) scale(.96,1.05)}78%{transform:translateY(0) scale(1)}88%{transform:scale(1.07,.93)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.ricey *{animation:none!important}}
"""

_uid = [0]


def ricey(mood, size=200, label='น้องข้าวหอม มาสคอตของ Rice AI'):
    _uid[0] += 1
    gid = f'rb{_uid[0]}'
    m = MOODS[mood]
    eyes = EYES[m['eyes']]

    def eye(side):
        kind = m['eyes']
        is_open = kind == 'open' or (kind == 'wink' and side == 'L')
        return f'<g class="r-eye">{g(eyes[side])}</g>' if is_open else g(eyes[side])

    mouth = g(MOUTHS[m['mouth']])
    if m['mouth'] in ('open', 'big'):
        mouth = f'<g class="r-talk">{mouth}</g>'
    face = (f'<g transform="translate(0 {FACE_DY})">' + g(CHEEKS) + eye('L') + eye('R')
            + g(BROWS[m['brows']]) + mouth + '</g>')

    def arm(side, pose):
        a = ARMS[side]
        ang = ARM_POSE[side][pose]
        flip = ' scale(-1 1)' if side == 'L' else ''
        cls = 'r-arm'
        if pose == 'wave':
            cls += ' wave'
        if pose == 'up':
            cls += ' up' if side == 'L' else ' upR'
        return f'<g transform="translate({a["x"]} {a["y"]}) rotate({ang}){flip}"><g class="{cls}">{g(ARM)}</g></g>'

    sparks = ''
    if 'sparkles' in m['props']:
        sparks = ''.join(f'<g class="r-spark" style="animation-delay:{-i * 0.45:.2f}s">{svg_shape(s)}</g>'
                         for i, s in enumerate(PROPS['sparkles']))
    held = ''
    for p in m['props']:
        if p == 'magnifier':
            held += f'<g class="r-held">{g(PROPS[p])}</g>'
        elif p == 'phone':
            held += f'<g class="r-held" style="transform-origin:40px 146px">{g(PROPS[p])}</g>'
    front = ''
    if 'shield' in m['props']:
        front += f'<g class="r-held" style="transform-origin:40px 146px">{g(PROPS["shield"])}</g>'
    if 'question' in m['props']:
        front += ('<g class="r-q"><circle cx="170" cy="50" r="17" fill="#FFFFFF" stroke="#E4DFD3" stroke-width="2"/>'
                  '<circle cx="152" cy="66" r="4" fill="#FFFFFF" stroke="#E4DFD3" stroke-width="1.6"/>'
                  '<text x="170" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" '
                  'font-size="22" fill="#6FAE2C">?</text></g>')
    if 'zzz' in m['props']:
        front += ''.join(f'<text class="r-z" style="animation-delay:{-i * 1.07:.2f}s" x="148" y="66" '
                         f'font-family="Arial,sans-serif" font-weight="900" font-size="16" fill="#6FAE2C">z</text>'
                         for i in range(3))
    body = g(layers['body'])
    rig = (sparks + g(layers['feet']) + g(layers['backLeaves']) + body + g(layers['bodyShine'])
           + f'<g class="r-pan">{g(layers["panicle"])}</g><g class="r-sprout">{g(layers["sprout"])}</g>'
           + face + g(layers['cloak']) + text_svg('SASHID') + held + arm('L', m['arms'][0]) + arm('R', m['arms'][1]) + front)
    h = size * 232 / 212
    content = ('<g class="r-all">'
               + f'<g class="r-shadow">{g(layers["shadow"])}</g>'
               + f'<g class="r-lift"><g class="r-rig">{rig}</g></g></g>')
    # ids are per-svg so several Riceys can share one page
    content = content.replace('url(#', f'url(#{gid}_').replace('SASHID', f'{gid}_sash')
    return (f'<svg class="ricey {mood}" role="img" aria-label="{label}" xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="-6 -10 212 232" width="{size:.0f}" height="{h:.0f}">'
            + defs(f'{gid}_') + content + '</svg>')


if __name__ == '__main__':
    html = ('<html><head><style>' + RICEY_CSS + '</style></head><body style="background:#F4F1E8;margin:0;display:flex;flex-wrap:wrap">'
            + ''.join(ricey(k, 180) for k in MOODS) + '</body></html>')
    open('anim.html', 'w', encoding='utf-8').write(html)
    print('ok')
