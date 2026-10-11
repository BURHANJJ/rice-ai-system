"""Exports the น้องข้าวหอม mascot kit into assets/mascot/.

    python tool/ricey/export.py            (run from mobile/)

Writes, for every mood:
  svg/khao_hom_<mood>.svg        static vector
  animated/khao_hom_<mood>.svg   self-contained CSS-animated vector (works in <img>)
  png/khao_hom_<mood>.png        1024 px wide, transparent (rendered with headless Chrome)
"""
import os, subprocess, sys, tempfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen  # noqa: E402
import anim  # noqa: E402

OUT = os.path.join(HERE, '..', '..', 'assets', 'mascot')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PNG_W = 1024
MOODS = list(gen.MOODS)


def static_svg(mood):
    s = gen.mood_svg(mood, 212)
    return s.replace('<svg ', f'<svg role="img" aria-label="น้องข้าวหอม ({mood})" ', 1)


def animated_svg(mood):
    s = anim.ricey(mood, 212, f'น้องข้าวหอม ({mood})')
    css = anim.RICEY_CSS.replace('.ricey:hover .r-all,.ricey:active .r-all{animation:r-hop .64s ease-out}\n', '')
    i = s.index('>') + 1
    return s[:i] + f'<style>{css}</style>' + s[i:]


def main():
    for sub in ('svg', 'animated', 'png'):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)
    tmp = tempfile.mkdtemp()
    try:
        for m in MOODS:
            svg = static_svg(m)
            open(os.path.join(OUT, 'svg', f'khao_hom_{m}.svg'), 'w', encoding='utf-8').write(svg)
            open(os.path.join(OUT, 'animated', f'khao_hom_{m}.svg'), 'w', encoding='utf-8').write(animated_svg(m))
            h = round(PNG_W * 232 / 212)
            page = os.path.join(tmp, f'{m}.html')
            open(page, 'w', encoding='utf-8').write(
                '<html><body style="margin:0;background:transparent">'
                + svg.replace('width="212"', f'width="{PNG_W}"').replace('height="232"', f'height="{h}"')
                + '</body></html>')
            png = os.path.join(OUT, 'png', f'khao_hom_{m}.png')
            subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                            '--default-background-color=00000000', f'--window-size={PNG_W},{h}',
                            f'--screenshot={png}', 'file:///' + page.replace('\\', '/')],
                           check=True, capture_output=True)
            print('exported', m)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
