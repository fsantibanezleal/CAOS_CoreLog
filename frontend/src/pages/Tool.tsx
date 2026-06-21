import { useEffect, useMemo, useState } from 'react';
import { Tabs, useShellLang } from '@fasl-work/caos-app-shell';
import { CASES, caseSpec, type CoreCase } from '../cv/cases.ts';
import { classifyTray, makeBaselineClassifier, makeTray, scoreVsTruth } from '../cv/index.ts';
import { LITHO_INFO, LITHOLOGIES, type Lithology, type Segment } from '../cv/types.ts';
import { classifyTrayCNN } from '../lib/cnn.ts';
import { loadLearned, loadManifest, type LearnedFile } from '../lib/artifacts.ts';
import type { CaseManifest } from '../lib/contract.types.ts';
import { TrayView } from '../viz/TrayView.tsx';
import { StripLog } from '../viz/StripLog.tsx';
import { ConfusionMatrix } from '../viz/ConfusionMatrix.tsx';

const CATS = [
  'lithology suite (the drilled sequence)',
  'image quality (lighting / wetness)',
  'oracle control (closed-form check)',
];

export default function Tool() {
  const lang = useShellLang();
  const es = lang === 'es';
  const [caseId, setCaseId] = useState('S-PORPH');
  const [conf, setConf] = useState(0.45);
  const [useCnn, setUseCnn] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [manifest, setManifest] = useState<CaseManifest | null>(null);
  const [cnnSegs, setCnnSegs] = useState<Segment[] | null>(null);
  const [cnnPending, setCnnPending] = useState(true);
  const [learned, setLearned] = useState<LearnedFile | null>(null);

  const theCase = useMemo<CoreCase>(() => CASES.find((c) => c.id === caseId) ?? CASES[0], [caseId]);
  const clf = useMemo(() => makeBaselineClassifier(7), []);
  const tray = useMemo(() => makeTray(caseSpec(theCase)), [theCase]);
  const baseSegs = useMemo(() => classifyTray(tray, clf, { oodThresh: conf }), [tray, clf, conf]);

  useEffect(() => {
    let cancel = false;
    setCnnPending(true);
    classifyTrayCNN(tray, { oodThresh: conf }).then((s) => {
      if (cancel) return;
      setCnnSegs(s);
      setCnnPending(s === null);
    });
    return () => { cancel = true; };
  }, [tray, conf]);
  useEffect(() => { loadManifest(caseId).then(setManifest).catch(() => setManifest(null)); }, [caseId]);
  useEffect(() => { loadLearned().then(setLearned).catch(() => setLearned(null)); }, []);

  const cnnReady = useCnn && cnnSegs != null;
  const segs = cnnReady ? cnnSegs! : baseSegs;
  const score = useMemo(() => scoreVsTruth(tray, segs), [tray, segs]);
  const bands = segs.map((s) => ({ depthFrom: s.depthFrom, depthTo: s.depthTo, litho: s.litho, conf: s.conf, ood: !!s.ood }));
  const nOod = segs.filter((s) => s.ood).length;

  // per-class recall (diagonal / row sum)
  const recall = LITHOLOGIES.map((_, i) => {
    const row = score.confusion[i];
    const sum = row.reduce((a, b) => a + b, 0);
    return sum ? row[i] / sum : null;
  });

  const Kpi = ({ label, value }: { label: string; value: string }) => (
    <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>
  );

  const tabs = [
    {
      id: 'tray', label: es ? 'Bandeja' : 'Tray',
      content: (
        <div className="cl-split">
          <div className="cl-split-main">
            <div className="pf-plot-th">
              <div className="pf-plot-t">{es ? 'Bandeja + segmentación en vivo (pasa el cursor)' : 'Tray + live segmentation (hover)'}</div>
              <div className="pf-seg">
                <button className={`chip ${overlay ? 'on' : ''}`} onClick={() => setOverlay((v) => !v)}>{es ? 'overlay' : 'overlay'}</button>
              </div>
            </div>
            <TrayView tray={tray} segments={segs} showOverlay={overlay} lang={lang} />
            <div className="pf-kpis">
              <Kpi label={es ? 'precisión vs verdad' : 'accuracy vs truth'} value={`${(score.pixelAccuracy * 100).toFixed(1)}%`} />
              <Kpi label={es ? 'segmentos' : 'segments'} value={`${segs.length}`} />
              <Kpi label={es ? 'inciertos' : 'uncertain'} value={`${nOod}`} />
              <Kpi label={es ? 'clasificador' : 'classifier'} value={cnnReady ? 'CNN' : (es ? 'baseline' : 'baseline')} />
            </div>
          </div>
          <div className="cl-split-side">
            <div className="pf-plot-t">{es ? 'Strip-log' : 'Strip log'}</div>
            <StripLog bands={bands} depthFrom={tray.spec.depthFromM} depthTo={tray.spec.depthToM} lang={lang} />
          </div>
        </div>
      ),
    },
    {
      id: 'strip', label: es ? 'Strip-log' : 'Strip log',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? 'Log litológico apilado por profundidad (todos los canales)' : 'Depth-stitched lithology log (all channels)'}</div>
          <StripLog bands={bands} depthFrom={tray.spec.depthFromM} depthTo={tray.spec.depthToM} height={460} lang={lang} />
          <Legend es={es} />
        </div>
      ),
    },
    {
      id: 'confusion', label: es ? 'Confusión' : 'Confusion',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? 'Matriz de confusión de ESTE caso (verdad × predicho, % por fila)' : 'Confusion matrix for THIS case (truth × predicted, row %)'}</div>
          <ConfusionMatrix confusion={score.confusion} lang={lang} />
          <p className="pf-cap">{es ? 'La diagonal es el recall por litología; fuera de la diagonal son confusiones.' : 'The diagonal is per-lithology recall; off-diagonal cells are confusions.'}</p>
        </div>
      ),
    },
    {
      id: 'recall', label: es ? 'Recall' : 'Recall',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? 'Recall por litología (en este caso)' : 'Per-lithology recall (this case)'}</div>
          <div className="cl-recall">
            {LITHOLOGIES.map((l, i) => (
              <div key={l} className="cl-recall-row">
                <span className="cl-sw" style={{ background: `rgb(${LITHO_INFO[l].rgb.join(',')})` }} />
                <span className="cl-recall-lab">{es ? LITHO_INFO[l].es : LITHO_INFO[l].en}</span>
                <div className="cl-recall-bar"><i style={{ width: `${(recall[i] ?? 0) * 100}%` }} /></div>
                <span className="mono">{recall[i] == null ? '—' : `${(recall[i]! * 100).toFixed(0)}%`}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'channels', label: es ? 'Canales' : 'Channels',
      content: (
        <div className="pf-vizstack">
          {Array.from({ length: tray.spec.nChannels }, (_, ch) => (
            <div key={ch} className="cl-chan">
              <b>{es ? 'Canal' : 'Channel'} {ch + 1}</b>
              <div className="cl-chan-segs">
                {segs.filter((s) => s.channel === ch).map((s, k) => (
                  <span key={k} className="cl-seg-chip" style={{ borderColor: `rgb(${LITHO_INFO[s.litho as Lithology].rgb.join(',')})` }}>
                    {es ? LITHO_INFO[s.litho as Lithology].es : LITHO_INFO[s.litho as Lithology].en} · {(s.conf * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'legend', label: es ? 'Litologías' : 'Lithologies',
      content: <Legend es={es} full />,
    },
    {
      id: 'learned', label: es ? 'Modelos aprendidos' : 'Learned models',
      content: (
        <div className="pf-vizstack">
          {learned ? (
            <>
              <table className="cmp-table">
                <thead><tr><th>{es ? 'modelo' : 'model'}</th><th>{es ? 'métrica (held-out)' : 'metric (held-out)'}</th><th>{es ? 'aprendido' : 'learned'}</th><th>{es ? 'baseline clásico' : 'classical baseline'}</th></tr></thead>
                <tbody>
                  <tr><td>lithology-cnn</td><td>{es ? 'precisión' : 'accuracy'}</td><td><b>{(learned.lithoCNN.acc * 100).toFixed(1)}%</b></td><td>{(learned.lithoCNN.acc_baseline * 100).toFixed(1)}%</td></tr>
                  <tr><td>core-ood</td><td>AUC</td><td><b>{learned.ood.auc.toFixed(3)}</b></td><td>—</td></tr>
                </tbody>
              </table>
              <p className="pf-note">{cnnPending
                ? (es ? 'El ONNX del CNN aún no está cargado en esta sesión — la app usa el baseline en vivo. Activa el toggle "CNN" en los controles.' : 'The CNN ONNX is not loaded in this session yet — the app uses the baseline live. Flip the "CNN" toggle in the controls.')
                : (es ? 'CNN cargado — el toggle "CNN" segmenta en vivo (onnxruntime-web). El ground-truth del generador es la autoridad.' : 'CNN loaded — the "CNN" toggle segments live (onnxruntime-web). The generator ground truth is the authority.')}</p>
              <p className="pf-cap">{learned.honesty}</p>
            </>
          ) : (
            <div className="pf-pending">
              <strong>{es ? 'CNN de litología: pendiente de entrenamiento' : 'Lithology CNN: pending training'}</strong>
              <p>{es
                ? 'Corre `python -m cllab.pipeline all --retrain` para entrenar el CNN + el autoencoder OOD (torch → ONNX). La app usa el baseline clásico EN VIVO mientras tanto.'
                : 'Run `python -m cllab.pipeline all --retrain` to train the CNN + the OOD autoencoder (torch → ONNX). The app uses the classical baseline LIVE meanwhile.'}</p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'contract', label: es ? 'Contrato · gate' : 'Contract · gate',
      content: (
        <div className="pf-vizstack">
          {manifest ? (
            <>
              <div className="pf-kpis">
                <Kpi label="lane" value={manifest.lane} />
                <Kpi label="runtimes" value={manifest.gate.runtimes.join(', ')} />
                <Kpi label={es ? 'bytes traza' : 'trace bytes'} value={`${manifest.gate.trace_bytes}`} />
              </div>
              {manifest.flags.length > 0 && <p className="pf-note">⚑ {JSON.stringify(manifest.flags)}</p>}
              <p className="pf-note">{manifest.honesty}</p>
            </>
          ) : <p className="pf-note">{es ? 'cargando manifiesto…' : 'loading manifest…'}</p>}
        </div>
      ),
    },
    {
      id: 'byo', label: es ? 'Tu bandeja' : 'Bring your own',
      content: (
        <div className="pf-vizstack">
          <p className="pf-note">{es
            ? 'CoreLog está hecho para registrar TU bandeja, no sólo los casos sintéticos. CONTRATO 1 (data/examples/trays.csv) valida un descriptor de bandeja {tray_id, n_channels, px dims, depth_from/to, mm_per_px}: rechaza dimensiones no-positivas, intervalo de profundidad invertido y 0 canales; marca aspecto inusual y resolución gruesa.'
            : 'CoreLog is built to log YOUR tray, not just the synthetic cases. CONTRACT 1 (data/examples/trays.csv) validates a tray descriptor {tray_id, n_channels, px dims, depth_from/to, mm_per_px}: it rejects non-positive dimensions, an inverted depth interval and zero channels; it flags unusual aspect + coarse resolution.'}</p>
          <p className="pf-cap">{es ? 'El esquema completo está en docs/ y data/README.md.' : 'The full schema is in docs/ and data/README.md.'}</p>
        </div>
      ),
    },
    {
      id: 'raw', label: es ? 'Traza' : 'Trace',
      content: (
        <pre className="codeblock" style={{ maxHeight: 360 }}>{JSON.stringify({
          case: theCase.id, suite: theCase.suite, quality: theCase.quality,
          spec: tray.spec, accuracy: score.pixelAccuracy, nSegments: segs.length,
          segments: segs.slice(0, 6),
        }, null, 2)}</pre>
      ),
    },
  ];

  return (
    <div className="pf-layout">
      <aside className="pf-side">
        <div className="pf-card">
          <div className="pf-card-t">{es ? 'Caso' : 'Case'}</div>
          {CATS.map((cat) => (
            <div key={cat} className="pf-catgroup">
              <div className="pf-catlabel">{cat.split(' (')[0]}</div>
              <div className="pf-chips">
                {CASES.filter((c) => c.category === cat).map((c) => (
                  <button key={c.id} className={`chip ${caseId === c.id ? 'on' : ''}`} title={c.name} onClick={() => setCaseId(c.id)}>{c.id}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="pf-cap">{theCase.name}</div>
          <div className="pf-cap pf-muted">{theCase.expectedBand}</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-t">{es ? 'Controles (en vivo)' : 'Controls (live)'}</div>
          <label className="pf-ctl">{es ? 'umbral de confianza' : 'confidence threshold'}: {conf.toFixed(2)}
            <input className="range" type="range" min={0} max={0.9} step={0.05} value={conf} onChange={(e) => setConf(+e.target.value)} />
          </label>
          <div className="pf-catlabel">{es ? 'clasificador' : 'classifier'}</div>
          <div className="pf-chips">
            <button className={`chip ${!useCnn ? 'on' : ''}`} onClick={() => setUseCnn(false)}>{es ? 'baseline' : 'baseline'}</button>
            <button className={`chip ${useCnn ? 'on' : ''}`} onClick={() => setUseCnn(true)} title={cnnPending ? (es ? 'CNN pendiente' : 'CNN pending') : 'CNN'}>
              CNN{useCnn && cnnPending ? ' ⏳' : ''}
            </button>
          </div>
          {useCnn && cnnPending && <div className="pf-cap pf-muted">{es ? 'CNN pendiente — usando baseline' : 'CNN pending — using baseline'}</div>}
        </div>
      </aside>
      <main className="pf-main">
        <Tabs tabs={tabs} ariaLabel={es ? 'vistas de la bandeja' : 'tray views'} />
      </main>
    </div>
  );
}

function Legend({ es, full }: { es: boolean; full?: boolean }) {
  return (
    <div className="cl-legend">
      {LITHOLOGIES.map((l) => (
        <div key={l} className="cl-legend-row">
          <span className="cl-sw" style={{ background: `rgb(${LITHO_INFO[l].rgb.join(',')})` }} />
          <span>{es ? LITHO_INFO[l].es : LITHO_INFO[l].en}</span>
          {full && <span className="pf-cap pf-muted">{l}</span>}
        </div>
      ))}
    </div>
  );
}
