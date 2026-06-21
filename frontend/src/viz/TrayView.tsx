import { useEffect, useRef, useState } from 'react';
import { channelTop } from '../cv/tray.ts';
import { LITHO_INFO, type Lithology, type Segment, type Tray } from '../cv/types.ts';

/** Renders the synthetic core-tray image + the live segmentation overlay: each predicted segment gets a translucent
 * lithology tint, a boundary line, and a solid prediction bar under its channel; low-confidence / OOD segments are
 * hatched. Hover reads the segment out (channel · lithology · confidence · depth). Pure canvas, theme-independent
 * (rock colours are physical), responsive. */
export function TrayView({ tray, segments, showOverlay = true, height = 260, lang = 'en' }: {
  tray: Tray; segments: Segment[]; showOverlay?: boolean; height?: number; lang?: 'en' | 'es';
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const dispW = wrap.clientWidth || 700;
    const scale = dispW / tray.width;
    const dispH = Math.round(tray.height * scale);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dispW * dpr;
    canvas.height = dispH * dpr;
    canvas.style.width = `${dispW}px`;
    canvas.style.height = `${dispH}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // draw the tray image (native → scaled) via an offscreen canvas
    const off = document.createElement('canvas');
    off.width = tray.width;
    off.height = tray.height;
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(tray.width, tray.height);
    img.data.set(tray.rgba);
    octx.putImageData(img, 0, 0);
    ctx.drawImage(off, 0, 0, dispW, dispH);

    if (showOverlay) {
      const barH = 7;
      for (const s of segments) {
        const yTop = channelTop(tray.spec, s.channel) * scale;
        const chH = tray.spec.chHeightPx * scale;
        const x0 = s.x0 * scale;
        const w = (s.x1 - s.x0) * scale;
        const [r, g, b] = LITHO_INFO[s.litho as Lithology].rgb;
        // translucent tint over the segment
        ctx.fillStyle = `rgba(${r},${g},${b},${0.16 + 0.18 * s.conf})`;
        ctx.fillRect(x0, yTop, w, chH);
        // solid prediction bar under the channel
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x0, yTop + chH - barH, w, barH);
        // boundary
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, yTop);
        ctx.lineTo(x0, yTop + chH);
        ctx.stroke();
        // OOD / low-confidence hatch
        if (s.ood) {
          ctx.strokeStyle = 'rgba(248,81,73,0.9)';
          ctx.lineWidth = 1.2;
          for (let hx = x0; hx < x0 + w; hx += 7) {
            ctx.beginPath();
            ctx.moveTo(hx, yTop);
            ctx.lineTo(hx + chH, yTop + chH);
            ctx.stroke();
          }
        }
      }
    }
  }, [tray, segments, showOverlay, height]);

  const onMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const scale = rect.width / tray.width;
    const ix = (e.clientX - rect.left) / scale;
    const iy = (e.clientY - rect.top) / scale;
    // which channel?
    let ch = -1;
    for (let c = 0; c < tray.spec.nChannels; c++) {
      const top = channelTop(tray.spec, c);
      if (iy >= top && iy < top + tray.spec.chHeightPx) { ch = c; break; }
    }
    if (ch < 0) { setHover(null); return; }
    const seg = segments.find((s) => s.channel === ch && ix >= s.x0 && ix < s.x1);
    if (!seg) { setHover(null); return; }
    const name = lang === 'es' ? LITHO_INFO[seg.litho as Lithology].es : LITHO_INFO[seg.litho as Lithology].en;
    setHover({
      x: e.clientX - rect.left, y: e.clientY - rect.top,
      text: `${name} · ${(seg.conf * 100).toFixed(0)}% · ${seg.depthFrom.toFixed(2)}–${seg.depthTo.toFixed(2)} m${seg.ood ? (lang === 'es' ? ' · incierto' : ' · uncertain') : ''}`,
    });
  };

  return (
    <div className="cl-tray" ref={wrapRef} style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 8, width: '100%' }} />
      {hover && (
        <div className="heatmap-readout" style={{ left: Math.min(hover.x + 10, 9999), top: hover.y + 10 }}>{hover.text}</div>
      )}
    </div>
  );
}
