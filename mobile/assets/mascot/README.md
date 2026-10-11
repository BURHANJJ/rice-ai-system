# น้องข้าวหอม (Nong Khao Hom) — mascot kit

Mascot of Rice AI. The app draws it live from vector code (`lib/widgets/ricey.dart`), so
nothing in this folder is bundled into the app (it is not listed in `pubspec.yaml`).
These files are for the web, documents, slides and social posts.

| Folder | What | Use for |
|---|---|---|
| `svg/` | Static vector, 9 moods | Print, design tools, scaling to any size |
| `animated/` | Self-contained CSS-animated SVG (breathing, blinking, swaying panicle), 9 moods | Web pages — works in a plain `<img>`; stops when the viewer prefers reduced motion |
| `png/` | 1024 px wide, transparent | Slides, chat, social posts |
| `illustrations/` | Scenes: phone, shield, disease-scan — `.svg` still, `.animated.svg` moving, `.png` | Hero images, marketing (web hero + login use the animated ones) |

Moods: `hello` ทักทาย · `happy` ยิ้มแย้ม · `joy` ดีใจ · `scan` ส่องแว่น · `guard` ข้าวแข็งแรง ·
`worried` กังวล · `think` กำลังคิด · `sleep` พักผ่อน · `phone` ถือมือถือ

## Rules

- Name on the sash is always **KHAO HOM**; do not recolour the body or change proportions.
- Match the mood to the message — never `joy` with bad news.
- Full character guide (voice, do/don't): design canvas, board 19.

## Regenerating

Vector and PNG files are generated — edit the art in `tool/ricey/gen.py`, then from `mobile/`:

```
python tool/ricey/gen.py lib/widgets/ricey_art.dart   # app geometry
python tool/ricey/export.py                            # svg, animated, png (needs Google Chrome)
python tool/ricey/illus.py                             # illustrations
```

Sash lettering is outlined from Nunito Black (`tool/ricey/fonts`, SIL Open Font License).
