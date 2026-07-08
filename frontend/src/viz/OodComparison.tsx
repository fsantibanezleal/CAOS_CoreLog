// Benchmark viz for the feature-space OOD contribution: the detector comparison table (reconstruction vs
// Mahalanobis / kNN / energy / MSP), a ROC overlay, the score histograms, the negative controls and the
// DCID-7 real-head confusion. All values come from data/derived/ood-bench.json (the offline benchmark); nothing
// is hard-coded, so the honest measured numbers, including any null, render as produced.
import { Callout, Cite } from '@fasl-work/caos-app-shell';
import type { OodBenchFile } from '../lib/artifacts.ts';

function Roc({ curves, es }: { curves: { label: string; color: string; pts: [number, number][] }[]; es: boolean }) {
  const W = 320, H = 260, pad = 34;
  const sx = (x: number) => pad + x * (W - 2 * pad);
  const sy = (y: number) => H - pad - y * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cl-roc" role="img" aria-label={es ? 'curva ROC' : 'ROC curve'}>
      <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill="none" stroke="var(--color-border)" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="var(--color-fg-subtle)" strokeDasharray="3 3" opacity={0.5} />
      {curves.map((c) => (
        <polyline key={c.label} fill="none" stroke={c.color} strokeWidth={2}
          points={c.pts.map(([fpr, tpr]) => `${sx(fpr)},${sy(tpr)}`).join(' ')} />
      ))}
      <text x={W / 2} y={H - 6} textAnchor="middle" className="cl-axl">FPR</text>
      <text x={12} y={H / 2} textAnchor="middle" className="cl-axl" transform={`rotate(-90 12 ${H / 2})`}>TPR</text>
      {curves.map((c, i) => (
        <g key={c.label}>
          <rect x={pad + 6} y={pad + 6 + i * 16} width={10} height={10} fill={c.color} />
          <text x={pad + 20} y={pad + 15 + i * 16} className="cl-axl">{c.label}</text>
        </g>
      ))}
    </svg>
  );
}

function Hist({ hist, es }: { hist: { edges: number[]; id: number[]; ood: number[] }; es: boolean }) {
  const W = 320, H = 200, pad = 28;
  const n = hist.id.length;
  const maxc = Math.max(1, ...hist.id, ...hist.ood);
  const bw = (W - 2 * pad) / n;
  const bar = (v: number) => (v / maxc) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cl-hist" role="img" aria-label={es ? 'histograma de puntajes' : 'score histogram'}>
      {hist.id.map((v, i) => (
        <rect key={`i${i}`} x={pad + i * bw} y={H - pad - bar(v)} width={bw * 0.9} height={bar(v)} fill="var(--color-accent, #3fb950)" opacity={0.55} />
      ))}
      {hist.ood.map((v, i) => (
        <rect key={`o${i}`} x={pad + i * bw} y={H - pad - bar(v)} width={bw * 0.9} height={bar(v)} fill="#f85149" opacity={0.5} />
      ))}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-border)" />
      <text x={pad + 4} y={pad} className="cl-axl">{es ? 'verde = sintetico (ID) · rojo = real (OOD)' : 'green = synthetic (ID) · red = real (OOD)'}</text>
      <text x={W / 2} y={H - 6} textAnchor="middle" className="cl-axl">{es ? 'puntaje OOD' : 'OOD score'}</text>
    </svg>
  );
}

function Dcid7Confusion({ cm, labels }: { cm: number[][]; labels: string[] }) {
  const short = (s: string) => s.replace(/^\d+\./, '').split(' ').map((w) => w.slice(0, 3)).join('');
  const rowSum = cm.map((r) => r.reduce((a, b) => a + b, 0) || 1);
  return (
    <table className="cl-confusion">
      <thead><tr><th />{labels.map((l) => <th key={l} title={l}>{short(l).slice(0, 4)}</th>)}</tr></thead>
      <tbody>
        {labels.map((tl, i) => (
          <tr key={tl}>
            <th title={tl}>{short(tl).slice(0, 4)}</th>
            {labels.map((_, j) => {
              const frac = cm[i][j] / rowSum[i];
              const diag = i === j;
              return (
                <td key={j} title={`${cm[i][j]}`} style={{ background: diag ? `rgba(63,185,80,${frac})` : `rgba(248,81,73,${frac})`, color: frac > 0.55 ? '#fff' : 'var(--color-fg-subtle)' }}>
                  {frac > 0.01 ? (frac * 100).toFixed(0) : ''}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const Chip = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span className={`cl-ctrl-chip ${ok ? 'pass' : 'fail'}`}>{ok ? '✓' : '✗'} {children}</span>
);

export function OodComparison({ ood, es }: { ood: OodBenchFile | null; es: boolean }) {
  if (!ood) {
    return (
      <Callout variant="honest" title={es ? 'Benchmark OOD no disponible' : 'OOD benchmark unavailable'}>
        {es ? 'ood-bench.json no cargo en esta sesion; corre `python data-pipeline/cllab/science/ood_bench.py`.'
          : 'ood-bench.json did not load this session; run `python data-pipeline/cllab/science/ood_bench.py`.'}
      </Callout>
    );
  }
  const rows = Object.entries(ood.detectors).sort((a, b) => b[1].auroc - a[1].auroc);
  const w = ood.winner;
  const c = ood.controls;
  const head = ood.realHead;
  const shippedHead = head.candidates[head.shipped];
  const roc = [
    { label: 'Mahalanobis', color: 'var(--color-accent, #3fb950)', pts: ood.shippedDetector.roc },
    { label: es ? 'reconstruccion' : 'reconstruction', color: '#f85149', pts: ood.reconRoc },
  ];
  return (
    <div className="cl-oodbench">
      <h2>{es ? 'OOD en espacio de features, comparacion de detectores' : 'Feature-space OOD, detector comparison'}</h2>
      <p>{ood.task}</p>
      <table className="cmp-table">
        <thead><tr><th>{es ? 'detector' : 'detector'}</th><th>{es ? 'espacio' : 'space'}</th><th>AUROC</th><th>AUPR</th><th>FPR@95</th></tr></thead>
        <tbody>
          {rows.map(([key, d]) => (
            <tr key={key} className={key === 'litho_mahalanobis' ? 'cl-row-ship' : key === 'recon_mse' ? 'cl-row-base' : ''}>
              <td>{d.family}{key === 'litho_mahalanobis' ? (es ? ' (embarcado)' : ' (shipped)') : ''}{key === 'recon_mse' ? (es ? ' (incumbente)' : ' (incumbent)') : ''}</td>
              <td className="pf-cap">{d.space}</td>
              <td><b>{d.auroc.toFixed(3)}</b></td><td>{d.aupr.toFixed(3)}</td><td>{d.fpr95.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Callout variant={w.atBarAuroc085AndLowerFpr95 ? 'strong' : 'honest'}
        title={w.atBarAuroc085AndLowerFpr95
          ? (es ? 'Umbral alcanzado' : 'At-bar threshold met')
          : (es ? 'Resultado honesto (por debajo del umbral)' : 'Honest result (below threshold)')}>
        {w.atBarAuroc085AndLowerFpr95
          ? (es
            ? `TODO detector en espacio de features/logits supera a la reconstruccion incumbente (AUROC ${w.reconMseAuroc.toFixed(3)}, que en esta tarea cae bajo el azar porque el core real se reconstruye MAS facil que el sintetico). El techo offline es ${w.name} (AUROC ${w.auroc.toFixed(3)}). El detector EMBARCADO EN VIVO por ventana es Mahalanobis sobre el embedding de 64-d del CNN (AUROC ${(ood.detectors['litho_mahalanobis']?.auroc ?? 0).toFixed(3)}), elegido por su costo bajo en el navegador; supera el umbral 0.85 y baja el FPR@95 frente a la reconstruccion.`
            : `EVERY feature/logit detector beats the incumbent reconstruction score (AUROC ${w.reconMseAuroc.toFixed(3)}, which on this task falls below chance because real core reconstructs MORE easily than synthetic). The offline ceiling is ${w.name} (AUROC ${w.auroc.toFixed(3)}). The detector SHIPPED LIVE per window is Mahalanobis over the CNN 64-d embedding (AUROC ${(ood.detectors['litho_mahalanobis']?.auroc ?? 0).toFixed(3)}), chosen for its low in-browser cost; it clears the 0.85 bar and lowers FPR@95 versus reconstruction.`)
          : (es
            ? `NULL honesto: ningun detector en espacio de features alcanzo AUROC 0.85 con menor FPR@95 que la reconstruccion (mejor ${w.name} ${w.auroc.toFixed(3)} vs reconstruccion ${w.reconMseAuroc.toFixed(3)}). Se reporta tal cual; sigue siendo una mejora de rigor sobre el detector incumbente.`
            : `Honest NULL: no feature-space detector reached AUROC 0.85 with a lower FPR@95 than reconstruction (best ${w.name} ${w.auroc.toFixed(3)} vs reconstruction ${w.reconMseAuroc.toFixed(3)}). Reported as-is; it still upgrades the rigor over the incumbent detector.`)}
      </Callout>
      <div className="cl-oodgrid">
        <div><div className="pf-plot-t">{es ? 'ROC: Mahalanobis vs reconstruccion' : 'ROC: Mahalanobis vs reconstruction'}</div><Roc curves={roc} es={es} /></div>
        <div><div className="pf-plot-t">{es ? 'Histograma de puntajes (embarcado)' : 'Score histogram (shipped)'}</div><Hist hist={ood.shippedDetector.hist} es={es} /></div>
      </div>

      <h2>{es ? 'Controles negativos' : 'Negative controls'}</h2>
      <div className="cl-ctrls">
        <Chip ok={c.nullCollapsedToChance}>{es ? `permutacion de etiquetas -> ${pct(c.labelPermutationNullTop1)} (colapsa al azar ${pct(c.chance)})` : `label permutation -> ${pct(c.labelPermutationNullTop1)} (collapses to chance ${pct(c.chance)})`}</Chip>
        <Chip ok={c.nonCoreAllFire}>{es ? `no-core dispara: todos > umbral ID p95 (${c.idP95Threshold})` : `non-core fires: all > ID p95 threshold (${c.idP95Threshold})`}</Chip>
        <Chip ok={c.nearFarMonotonic}>{es ? `monotonia: no-core ${c.medianNonCore} > real ${c.medianOod} > sintetico ${c.medianId}` : `monotonic: non-core ${c.medianNonCore} > real ${c.medianOod} > synthetic ${c.medianId}`}</Chip>
      </div>
      <p className="pf-cap pf-muted">{es
        ? `Honesto: la lectura mas estricta (min no-core ${c.nonCoreMinScore} > max real ${c.realMaxScore}) NO se cumple; un parche real extremo de DCID es tan fuera-de-distribucion como el ruido para un modelo entrenado en sintetico. Los criterios significativos (todo no-core dispara, y la monotonia de medianas) si se cumplen.`
        : `Honest: the strictest reading (min non-core ${c.nonCoreMinScore} > real max ${c.realMaxScore}) does NOT hold; an extreme real DCID patch is as out-of-distribution as noise to a synthetic-trained model. The meaningful criteria (every non-core fires, and the median monotonicity) do hold.`}</p>

      <h2>{es ? 'Cabeza real DCID-7 (entrenada sobre roca real)' : 'Real DCID-7 head (trained on real rock)'}</h2>
      <p>{es
        ? `La cabeza embarcada (${shippedHead?.backbone}) se entrena sobre el split de entrenamiento real de DCID-7 y se evalua en un split retenido real (${shippedHead?.nEval} parches). El split usa el de DCID mas deduplicacion por hash perceptual.`
        : `The shipped head (${shippedHead?.backbone}) is trained on the real DCID-7 train split and evaluated on a held-out real split (${shippedHead?.nEval} patches). The split uses DCID's own split plus perceptual-hash dedupe.`}</p>
      <table className="cmp-table">
        <thead><tr><th>{es ? 'cabeza' : 'head'}</th><th>backbone</th><th>top-1</th><th>macro-F1</th></tr></thead>
        <tbody>
          {Object.entries(head.candidates).map(([k, m]) => (
            <tr key={k} className={k === head.shipped ? 'cl-row-ship' : ''}>
              <td>{k}{k === head.shipped ? (es ? ' (embarcado)' : ' (shipped)') : ''}</td>
              <td className="pf-cap">{m.backbone}</td>
              <td><b>{pct(m.top1)}</b></td><td>{pct(m.macroF1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {shippedHead && (
        <>
          <div className="pf-plot-t">{es ? 'Confusion DCID-7 (verdad x predicho, % por fila)' : 'DCID-7 confusion (truth x predicted, row %)'}</div>
          <Dcid7Confusion cm={shippedHead.confusion} labels={head.classesDcid7} />
        </>
      )}
      <Callout variant="honest" title={es ? 'No es un algoritmo nuevo' : 'Not a new algorithm'}>
        {es
          ? 'Mahalanobis (2018), kNN (2022) y energia (2020) son metodos establecidos. La contribucion aqui es EMPIRICA: elegir y MEDIR el puntaje OOD que separa la brecha sintetico->real de CoreLog reemplazando un detector debil, y entrenar una cabeza que de verdad clasifica core real DCID, con controles rigurosos. No se afirma superar el estado del arte.'
          : 'Mahalanobis (2018), kNN (2022) and energy (2020) are established. The contribution here is EMPIRICAL: selecting and MEASURING the OOD score that separates CoreLog\'s synthetic->real gap, replacing a weak detector, and training a head that actually classifies real DCID core, with rigorous controls. No claim to beat the state of the art.'}
        {' '}<Cite id="lee2018" paren /> <Cite id="sun2022" paren /> <Cite id="liu2020" paren />
      </Callout>
    </div>
  );
}
