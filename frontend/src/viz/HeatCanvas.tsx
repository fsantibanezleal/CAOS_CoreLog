import { useEffect, useRef, useState } from 'react';
import type { RgbaImage } from '../cv/types.ts';

/** Draw an RGBA image (a synthetic tray or a real core patch) and overlay a per-window scalar field as a translucent
 * heat grid (used for the OOD/novelty map and the per-window class-evidence map). Pure canvas, theme-independent, with
 * a hover readout. The values array is row-major (row*cols + col), matching the analysis cell order. */
export function HeatCanvas({ img, cols, rows, stride, patch, values, colormap, height = 300, format, ariaLabel }: {
  img: RgbaImage;
  cols: number; rows: number; stride: number; patch: number;
  values: number[];
  colormap: (t: number) => [number, number, number];
  height?: number;
  format?: (v: number, idx: number) => string;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const dispW = wrap.clientWidth || 480;
    const scale = dispW / img.width;
    const dispH = Math.min(height, Math.round(img.height * scale));
    const sc = dispH / img.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dispW * dpr;
    canvas.height = dispH * dpr;
    canvas.style.width = `${dispW}px`;
    canvas.style.height = `${dispH}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const off = document.createElement('canvas');
    off.width = img.width;
    off.height = img.height;
    const octx = off.getContext('2d')!;
    const id = octx.createImageData(img.width, img.height);
    id.data.set(img.rgba);
    octx.putImageData(id, 0, 0);
    ctx.drawImage(off, 0, 0, dispW, dispH);

    const half = patch / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = values[r * cols + c];
        const t = (v - lo) / span;
        const [rr, gg, bb] = colormap(t);
        const x0 = (c * stride + half - stride / 2) * sc;
        const y0 = (r * stride + half - stride / 2) * sc;
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${0.18 + 0.55 * t})`;
        ctx.fillRect(x0, y0, stride * sc + 1, stride * sc + 1);
      }
    }
  }, [img, cols, rows, stride, patch, values, colormap, height, lo, hi, span]);

  const onMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const sc = rect.height / img.height;
    const ix = (e.clientX - rect.left) / sc;
    const iy = (e.clientY - rect.top) / sc;
    const c = Math.min(cols - 1, Math.max(0, Math.round((ix - patch / 2) / stride)));
    const r = Math.min(rows - 1, Math.max(0, Math.round((iy - patch / 2) / stride)));
    const idx = r * cols + c;
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: format ? format(values[idx], idx) : values[idx].toFixed(3) });
  };

  return (
    <div className="cl-tray" ref={wrapRef} style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} aria-label={ariaLabel}>
      <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 8, width: '100%' }} />
      {hover && <div className="heatmap-readout" style={{ left: Math.min(hover.x + 10, 9999), top: hover.y + 10 }}>{hover.text}</div>}
    </div>
  );
}

/** warm novelty ramp: low = cool/transparent green, high = hot red (used for the OOD reconstruction-error map). */
export const oodColormap = (t: number): [number, number, number] =>
  t < 0.5 ? [63 + t * 2 * (240 - 63), 185 - t * 2 * (60), 80] : [240, 185 - (t - 0.5) * 2 * 120, 80 - (t - 0.5) * 2 * 40];

/** evidence ramp: low = blue, high = amber (used for the per-window class-evidence / saliency map). */
export const evidenceColormap = (t: number): [number, number, number] =>
  [60 + t * (245 - 60), 90 + t * (170 - 90), 200 - t * (200 - 40)];
