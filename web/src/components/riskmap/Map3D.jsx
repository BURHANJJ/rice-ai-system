import { useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Interactive extruded 3D choropleth on a <canvas> — a port of the mobile app's
 * Map3D (mobile/lib/widgets/map3d.dart) so web and app show the same map.
 *
 * Drag to pan, wheel / pinch to zoom, right-drag or two fingers to rotate.
 * Click a region to select it; click the selected region again to drill in.
 */

const DEFAULT_TILT = 0.88;
const COS_LAT = Math.cos((13.5 * Math.PI) / 180);
const toWorld = (lon, lat) => [lon * COS_LAT * 100, -lat * 100];

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => {
  const c1 = 1.20158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const lerp = (a, b, t) => a + (b - a) * t;
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  l = Math.min(1, Math.max(0, l + amount));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  [r, g, b] = s === 0 ? [l, l, l] : [f(h + 1 / 3), f(h), f(h - 1 / 3)];
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

const signedArea = (r) => {
  let a = 0;
  for (let i = 0; i < r.length; i += 2) {
    const j = (i + 2) % r.length;
    a += r[i] * r[j + 1] - r[j] * r[i + 1];
  }
  return a;
};

export default function Map3D({
  regions,
  context = [],
  fitKey,
  selectedCode,
  onSelect,
  onDrill,
  onHover,
  onCamera,
  maxHeight = 70,
  padding = { top: 0, right: 0, bottom: 0, left: 0 },
  apiRef,
  // ============================================================================
  // 🗺️ จุดปรับแต่งสีโมเดล 3D บนเว็บ (3D Canvas Styling)
  // ============================================================================
  contextColor = '#E4DFD3',             // สีแผ่นดินจังหวัดข้างเคียง (โทนครีมอมเทา)
  edgeColor = 'rgba(255,255,255,0.75)', // สีเส้นขอบโมเดล 3D (ขาวโปร่งแสง)
  labelColor = '#1C211E',              // สีตัวอักษรชื่อจังหวัดบนแผนที่
  labelHalo = '#F4F1E8',               // สีเงารัศมีรอบตัวหนังสือให้อ่านง่าย (โทนกระดาษ)
  font = "'IBM Plex Sans Thai', sans-serif",
}) {
  const canvasRef = useRef(null);
  const s = useRef({
    cam: { fx: 0, fy: 0, zoom: 1, tilt: DEFAULT_TILT, rot: 0 },
    camFrom: null, camTo: null, camT0: 0, camDur: 750,
    hFrom: {}, hTo: {}, hT0: 0,
    size: { w: 0, h: 0, dpr: 1 },
    fitZoom: 1,
    tops: [],
    raf: 0,
    needsFit: true,
    first: true,
    props: {},
  }).current;

  s.props = { regions, context, selectedCode, onSelect, onDrill, onHover, onCamera, maxHeight, padding, contextColor, edgeColor, labelColor, labelHalo, font };

  /* ── camera helpers ─────────────────────────────────────── */

  const worldBounds = () => {
    let b = null;
    const lit = s.props.regions.filter((r) => !r.dimmed);
    for (const r of lit.length ? lit : s.props.regions) {
      const g = r.geo.bounds;
      const [x0, y0] = toWorld(g.minX, g.maxY);
      const [x1, y1] = toWorld(g.maxX, g.minY);
      b = b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 };
    }
    return b || { x0: 0, y0: 0, x1: 1, y1: 1 };
  };

  const fitCamera = (tilt) => {
    const b = worldBounds();
    const pad = s.props.padding;
    const w = Math.max(40, s.size.w - pad.left - pad.right - 24);
    const h = Math.max(40, s.size.h - pad.top - pad.bottom - 24);
    const squash = Math.cos(tilt) + 0.08;
    const zoom = Math.min(w / (b.x1 - b.x0), h / ((b.y1 - b.y0) * squash)) * 0.94;
    s.fitZoom = zoom;
    return { fx: (b.x0 + b.x1) / 2, fy: (b.y0 + b.y1) / 2, zoom, tilt, rot: 0 };
  };

  const animateTo = (target, dur = 750) => {
    s.camFrom = { ...s.cam };
    s.camTo = target;
    s.camT0 = performance.now();
    s.camDur = reduceMotion() ? 0 : dur;
    kick();
  };

  const emitCamera = () => s.props.onCamera?.({ is3D: s.cam.tilt > 0.2, rotation: s.cam.rot });

  useImperativeHandle(apiRef, () => ({
    toggle3D: () => animateTo({ ...fitCamera(s.cam.tilt > 0.2 ? 0 : DEFAULT_TILT), rot: s.cam.rot }),
    resetView: () => animateTo(fitCamera(s.cam.tilt)),
    resetRotation: () => animateTo({ ...s.cam, rot: 0 }),
    zoomBy: (k) => animateTo({ ...s.cam, zoom: clampZoom(s.cam.zoom * k) }, 300),
    focusOn: (geo) => {
      const g = geo.bounds;
      const [x0, y0] = toWorld(g.minX, g.maxY);
      const [x1, y1] = toWorld(g.maxX, g.minY);
      const pad = s.props.padding;
      const w = Math.max(40, s.size.w - pad.left - pad.right);
      const h = Math.max(40, s.size.h - pad.top - pad.bottom);
      const fit = Math.min(w / (x1 - x0), h / ((y1 - y0) * (Math.cos(s.cam.tilt) + 0.08))) * 0.45;
      const zoom = Math.min(s.fitZoom * 3, Math.max(s.fitZoom * 1.6, fit));
      animateTo({ ...s.cam, fx: (x0 + x1) / 2, fy: (y0 + y1) / 2, zoom }, 800);
    },
  }));

  const clampZoom = (z) => Math.min(s.fitZoom * 12, Math.max(s.fitZoom * 0.6, z));

  /* ── heights ────────────────────────────────────────────── */

  const targets = () => Object.fromEntries(s.props.regions.map((r) => [r.geo.code, r.dimmed ? 0 : r.height]));
  const currentHeights = (now) => {
    const t = reduceMotion() ? 1 : Math.min(1, Math.max(0, (now - s.hT0) / 1100));
    const e = easeOutBack(t);
    const out = {};
    for (const k of Object.keys(s.hTo)) out[k] = lerp(s.hFrom[k] ?? 0, s.hTo[k] ?? 0, e);
    return out;
  };

  /* ── projection ─────────────────────────────────────────── */

  const projector = () => {
    const { fx, fy, zoom, tilt, rot } = s.cam;
    const pad = s.props.padding;
    const cx = pad.left + (s.size.w - pad.left - pad.right) / 2;
    const cy = pad.top + (s.size.h - pad.top - pad.bottom) / 2;
    const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    return (x, y, z) => {
      const x1 = (x - fx) * zoom, y1 = (y - fy) * zoom, z1 = z * zoom;
      const x2 = x1 * cr - y1 * sr, y2 = x1 * sr + y1 * cr;
      const y3 = y2 * ct + z1 * st, z3 = -y2 * st + z1 * ct;
      let w = 1 + z3 / 1500;
      if (w < 0.05) w = 0.05;
      return [x2 / w + cx, y3 / w + cy, w];
    };
  };

  /* ── render ─────────────────────────────────────────────── */

  const draw = (now) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    const P = s.props;
    let animating = false;

    if (s.camTo) {
      const t = s.camDur === 0 ? 1 : Math.min(1, (now - s.camT0) / s.camDur);
      const e = easeInOutCubic(t);
      const a = s.camFrom, b = s.camTo;
      s.cam = {
        fx: lerp(a.fx, b.fx, e), fy: lerp(a.fy, b.fy, e),
        zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), e)),
        tilt: lerp(a.tilt, b.tilt, e), rot: lerp(a.rot, b.rot, e),
      };
      emitCamera();
      if (t >= 1) s.camTo = null;
      else animating = true;
    }
    if (!reduceMotion() && now - s.hT0 < 1100) animating = true;

    const { w, h, dpr } = s.size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const proj = projector();
    const heights = currentHeights(now);
    const scale = P.maxHeight / s.fitZoom;
    const cam = s.cam;

    const ringPath = (g, z) => {
      const path = new Path2D();
      for (const ring of g.rings) {
        for (let i = 0; i < ring.length; i += 2) {
          const [wx, wy] = toWorld(ring[i], ring[i + 1]);
          const [px, py] = proj(wx, wy, z);
          if (i === 0) path.moveTo(px, py);
          else path.lineTo(px, py);
        }
        path.closePath();
      }
      return path;
    };

    // Context regions: flat and faint.
    if (P.context.length) {
      ctx.fillStyle = P.contextColor;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 0.7;
      for (const g of P.context) {
        const path = ringPath(g, 0);
        ctx.fill(path, 'evenodd');
        ctx.stroke(path);
      }
    }

    // Back to front.
    const order = P.regions.map((r) => {
      const [wx, wy] = toWorld(r.geo.label[0], r.geo.label[1]);
      return [r, proj(wx, wy, 0)[2]];
    }).sort((a, b) => b[1] - a[1]);

    const view = [Math.sin(cam.rot), Math.cos(cam.rot)];
    const light = [-0.55, 0.83];
    s.tops = [];
    const labels = [];

    for (const [r] of order) {
      const selected = r.geo.code === P.selectedCode;
      const hh = (heights[r.geo.code] ?? 0) * scale + ((r.dimmed ? 0 : 2.5) + (selected ? 6 : 0)) / s.fitZoom;
      const top = r.dimmed ? P.contextColor : r.color;

      let walls = null;
      if (hh > 0.5 / s.fitZoom && cam.tilt > 0.05) {
        const lit = new Path2D(), dark = new Path2D();
        walls = new Path2D();
        for (const ring of r.geo.rings) {
          const ccw = signedArea(ring) > 0;
          for (let i = 0; i < ring.length; i += 2) {
            const j = (i + 2) % ring.length;
            const a = toWorld(ring[i], ring[i + 1]);
            const b = toWorld(ring[j], ring[j + 1]);
            let nx = b[1] - a[1], ny = a[0] - b[0];
            if (ccw) { nx = -nx; ny = -ny; }
            const len = Math.hypot(nx, ny);
            if (!len) continue;
            nx /= len; ny /= len;
            if (nx * view[0] + ny * view[1] <= 0) continue;
            const q = [proj(a[0], a[1], 0), proj(b[0], b[1], 0), proj(b[0], b[1], -hh), proj(a[0], a[1], -hh)];
            for (const target of [nx * light[0] + ny * light[1] > 0.2 ? lit : dark, walls]) {
              target.moveTo(q[0][0], q[0][1]);
              target.lineTo(q[1][0], q[1][1]);
              target.lineTo(q[2][0], q[2][1]);
              target.lineTo(q[3][0], q[3][1]);
              target.closePath();
            }
          }
        }
        ctx.fillStyle = shade(top, -0.3);
        ctx.fill(dark);
        ctx.fillStyle = shade(top, -0.14);
        ctx.fill(lit);
      }

      const topPath = ringPath(r.geo, -hh);
      ctx.fillStyle = r.geo.code === s.hover && !r.dimmed ? shade(top, 0.07) : top;
      ctx.fill(topPath, 'evenodd');
      ctx.lineJoin = 'round';
      ctx.strokeStyle = selected ? '#D4A84B' : r.dimmed ? 'rgba(255,255,255,0.35)' : P.edgeColor;
      ctx.lineWidth = selected ? 2.4 : 0.8;
      ctx.stroke(topPath);
      if (!r.dimmed) s.tops.push([r.geo, topPath, walls]);

      if (r.label) {
        const [lx, ly] = toWorld(r.geo.label[0], r.geo.label[1]);
        const p = proj(lx, ly, -hh);
        labels.push([p[0], p[1], r.label, selected]);
      }
    }

    // Labels with collision avoidance; selected first.
    labels.sort((a, b) => (b[3] ? 1 : 0) - (a[3] ? 1 : 0));
    const placed = [];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const [x, y, text, sel] of labels) {
      ctx.font = `${sel ? 700 : 600} ${sel ? 13.5 : 11.5}px ${P.font}`;
      const tw = ctx.measureText(text).width + 6;
      const th = sel ? 18 : 15;
      const rect = [x - tw / 2, y - 10 - th / 2, tw, th];
      if (placed.some((o) => rect[0] < o[0] + o[2] && rect[0] + rect[2] > o[0] && rect[1] < o[1] + o[3] && rect[1] + rect[3] > o[1])) continue;
      placed.push(rect);
      ctx.strokeStyle = P.labelHalo;
      ctx.lineWidth = 3.5;
      ctx.strokeText(text, x, y - 10);
      ctx.fillStyle = P.labelColor;
      ctx.fillText(text, x, y - 10);
    }
    return animating;
  };

  const loop = (now) => {
    s.raf = 0;
    if (draw(now)) s.raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!s.raf) s.raf = requestAnimationFrame(loop);
  };

  const hitTest = (x, y) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return null;
    const { dpr } = s.size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = s.tops.length - 1; i >= 0; i--) {
      const [geo, top, walls] = s.tops[i];
      if (ctx.isPointInPath(top, x * dpr, y * dpr, 'evenodd') || (walls && ctx.isPointInPath(walls, x * dpr, y * dpr))) return geo;
    }
    return null;
  };

  /* ── data changes ───────────────────────────────────────── */

  const lastFitKey = useRef(undefined);
  useEffect(() => {
    const refit = lastFitKey.current !== fitKey;
    lastFitKey.current = fitKey;
    const now = performance.now();
    const current = refit ? {} : currentHeights(now);
    s.hTo = targets();
    s.hFrom = Object.fromEntries(Object.keys(s.hTo).map((k) => [k, refit ? 0 : current[k] ?? 0]));
    const changed = refit || Object.keys(s.hTo).some((k) => Math.abs((current[k] ?? 0) - s.hTo[k]) > 1e-6);
    if (changed) s.hT0 = now;
    if (refit) s.needsFit = true;
    if (s.needsFit && s.size.w > 0) {
      s.needsFit = false;
      if (s.first) {
        s.first = false;
        s.cam = fitCamera(DEFAULT_TILT);
        emitCamera();
      } else {
        animateTo({ ...fitCamera(s.cam.tilt) }, 900);
      }
    }
    kick();
  });

  /* ── size ───────────────────────────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      s.size = { w: width, h: height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      if (s.first && s.props.regions.length) {
        s.first = false;
        s.needsFit = false;
        s.cam = fitCamera(DEFAULT_TILT);
        emitCamera();
      } else if (s.props.regions.length) {
        const z = s.cam.zoom / s.fitZoom;
        const fit = fitCamera(s.cam.tilt);
        s.cam = { ...s.cam, zoom: fit.zoom * z };
      }
      kick();
    });
    ro.observe(canvas);
    document.fonts?.ready.then(kick);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── gestures ───────────────────────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    const pointers = new Map();
    let start = null; // {cam, pts, moved, button}
    let hoverCode = null;

    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    const panBy = (dx, dy) => {
      const cam = s.cam;
      const ddy = dy / Math.max(0.35, Math.cos(cam.tilt));
      const c = Math.cos(-cam.rot), sn = Math.sin(-cam.rot);
      const wx = (dx * c - ddy * sn) / cam.zoom, wy = (dx * sn + ddy * c) / cam.zoom;
      s.cam = { ...cam, fx: cam.fx - wx, fy: cam.fy - wy };
    };

    const setHover = (geo, x, y) => {
      const code = geo?.code ?? null;
      if (code !== hoverCode) {
        hoverCode = code;
        s.hover = code;
        canvas.style.cursor = geo ? 'pointer' : 'grab';
        kick();
      }
      s.props.onHover?.(geo, x, y);
    };

    const down = (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      s.camTo = null;
      start = { cam: { ...s.cam }, pts: [...pointers.values()].map((p) => [...p]), moved: false, button: e.button, shift: e.shiftKey, last: local(e) };
      if (e.pointerType === 'mouse') canvas.style.cursor = 'grabbing';
    };

    const move = (e) => {
      const p = local(e);
      if (!pointers.has(e.pointerId)) {
        if (e.pointerType === 'mouse') setHover(hitTest(p[0], p[1]), p[0], p[1]);
        return;
      }
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, p);
      if (!start) return;
      if (Math.hypot(p[0] - start.pts[0][0], p[1] - start.pts[0][1]) > 4) start.moved = true;
      if (!start.moved) return;
      s.props.onHover?.(null);

      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const [a0, b0] = start.pts.length >= 2 ? start.pts : [a, b];
        const d0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1;
        const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ang0 = Math.atan2(b0[1] - a0[1], b0[0] - a0[0]);
        const ang1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
        s.cam = { ...s.cam, zoom: clampZoom(start.cam.zoom * (d1 / d0)), rot: start.cam.rot + (ang1 - ang0) };
        panBy((p[0] - prev[0]) / 2, (p[1] - prev[1]) / 2);
      } else if (start.button === 2 || start.shift) {
        s.cam = { ...s.cam, rot: s.cam.rot + (p[0] - prev[0]) * 0.008, tilt: Math.min(1.15, Math.max(0, s.cam.tilt + (p[1] - prev[1]) * 0.004)) };
      } else {
        panBy(p[0] - prev[0], p[1] - prev[1]);
      }
      emitCamera();
      kick();
    };

    const up = (e) => {
      const wasTap = start && !start.moved && pointers.size === 1;
      pointers.delete(e.pointerId);
      if (pointers.size >= 1 && start) {
        start = { ...start, cam: { ...s.cam }, pts: [...pointers.values()].map((q) => [...q]) };
        return;
      }
      if (e.pointerType === 'mouse') canvas.style.cursor = 'grab';
      if (wasTap && start.button === 0) {
        const [x, y] = local(e);
        const geo = hitTest(x, y);
        if (!geo) s.props.onSelect?.(null);
        else if (geo.code === s.props.selectedCode && s.props.onDrill) s.props.onDrill(geo);
        else s.props.onSelect?.(geo);
      }
      start = null;
    };

    const wheel = (e) => {
      e.preventDefault();
      const k = Math.exp(-e.deltaY * 0.0015);
      const [x, y] = local(e);
      const pad = s.props.padding;
      const cx = pad.left + (s.size.w - pad.left - pad.right) / 2;
      const cy = pad.top + (s.size.h - pad.top - pad.bottom) / 2;
      const before = s.cam.zoom;
      const after = clampZoom(before * k);
      s.camTo = null;
      // keep the point under the cursor in place
      s.cam = { ...s.cam, zoom: after };
      const f = after / before - 1;
      panBy(-(x - cx) * f, -(y - cy) * f);
      emitCamera();
      kick();
    };

    const leave = () => {
      hoverCode = null;
      s.hover = null;
      s.props.onHover?.(null);
      kick();
    };
    const menu = (e) => e.preventDefault();

    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('contextmenu', menu);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', menu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="block h-full w-full touch-none select-none" aria-label="แผนที่การระบาด 3 มิติ" role="img" />;
}
