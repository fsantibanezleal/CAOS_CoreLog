import { useEffect, useMemo, useState } from 'react';
import { Callout, Tabs, useShellLang } from '@fasl-work/caos-app-shell';
import { CASES, caseSpec, type CoreCase } from '../cv/cases.ts';
import { classifyTray, lithoFeatureSamples, makeBaselineClassifier, makeTray, scoreVsTruth } from '../cv/index.ts';
import { LITHO_INFO, LITHOLOGIES, N_LITHO, type Lithology, type RgbaImage, type Segment } from '../cv/types.ts';
import { classifyTrayCNN } from '../lib/cnn.ts';
import {
  analyzeWindows, decodeImage, loadRealIndex, realImageUrl, syntheticReferenceMse,
  type PatchAnalysis, type RealDoc, type RealPatch,
} from '../lib/realpatch.ts';
import { fitPca, project } from '../lib/pca.ts';
import { TrayView } from '../viz/TrayView.tsx';
import { StripLog } from '../viz/StripLog.tsx';
import { ConfusionMatrix } from '../viz/ConfusionMatrix.tsx';
import { HeatCanvas, oodColormap, evidenceColormap } from '../viz/HeatCanvas.tsx';
import { LatentScatter, type ScatterPoint } from '../viz/LatentScatter.tsx';
import type { PatchClassifier } from '../cv/types.ts';

const CATS = [
  'lithology suite (the drilled sequence)',
  'image quality (lighting / wetness)',
  'oracle control (closed-form check)',
];

type Source = 'synthetic' | 'real';

function buildConfusion(items: Array<{ truth: number; pred: number }>): number[][] {
  const K = N_LITHO;
  const m = Array.from({ length: K }, () => new Array(K).fill(0));
  for (const it of items) if (it.truth >= 0 && it.pred >= 0) m[it.truth][it.pred] += 1;
  return m;
}

export default function Tool() {
  const lang = useShellLang();
  const es = lang === 'es';
  const [source, setSource] = useState<Source>('synthetic');
  const [caseId, setCaseId] = useState('S-PORPH');
  const [realId, setRealId] = useState('');
  const [conf, setConf] = useState(0.45);
  const [useCnn, setUseCnn] = useState(false);
  const [overlay, setOverlay] = useState(true);

  const clf = useMemo<PatchClassifier>(() => makeBaselineClassifier(7), []);

  // ---- synthetic lane ----
  const theCase = useMemo<CoreCase>(() => CASES.find((c) => c.id === caseId) ?? CASES[0], [caseId]);
  const tray = useMemo(() => makeTray(caseSpec(theCase)), [theCase]);
  const baseSegs = useMemo(() => classifyTray(tray, clf, { oodThresh: conf }), [tray, clf, conf]);
  const [cnnSegs, setCnnSegs] = useState<Segment[] | null>(null);
  const [cnnPending, setCnnPending] = useState(true);
  useEffect(() => {
    let cancel = false;
    setCnnPending(true);
    classifyTrayCNN(tray, { oodThresh: conf }).then((s) => { if (cancel) return; setCnnSegs(s); setCnnPending(s === null); });
    return () => { cancel = true; };
  }, [tray, conf]);
  const cnnReady = useCnn && cnnSegs != null;
  const segs = cnnReady ? cnnSegs! : baseSegs;
  const score = useMemo(() => scoreVsTruth(tray, segs), [tray, segs]);
  const bands = segs.map((s) => ({ depthFrom: s.depthFrom, depthTo: s.depthTo, litho: s.litho, conf: s.conf, ood: !!s.ood }));
  const nOod = segs.filter((s) => s.ood).length;
  const synthRecall = LITHOLOGIES.map((_, i) => { const row = score.confusion[i]; const sum = row.reduce((a, b) => a + b, 0); return sum ? row[i] / sum : null; });

  // ---- real lane ----
  const [realDoc, setRealDoc] = useState<RealDoc | null>(null);
  useEffect(() => { loadRealIndex().then(setRealDoc).catch(() => setRealDoc(null)); }, []);
  const realPatch = useMemo<RealPatch | null>(() => realDoc ? (realDoc.patches.find((p) => p.id === realId) ?? realDoc.patches[0]) : null, [realDoc, realId]);
  const [realImg, setRealImg] = useState<RgbaImage | null>(null);
  useEffect(() => {
    if (source !== 'real' || !realPatch) { setRealImg(null); return; }
    let cancel = false; setRealImg(null);
    decodeImage(realImageUrl(realPatch.image)).then((im) => { if (!cancel) setRealImg(im); }).catch(() => {});
    return () => { cancel = true; };
  }, [source, realPatch]);

  // ---- shared window analysis (drives OOD map / saliency / latent, for whichever image is active) ----
  const [analysis, setAnalysis] = useState<PatchAnalysis | null>(null);
  const [aPending, setAPending] = useState(true);
  useEffect(() => {
    let cancel = false; setAnalysis(null); setAPending(true);
    const img: RgbaImage | null = source === 'real' ? realImg : tray;
    if (!img) { setAPending(source === 'real'); return; }
    analyzeWindows(img, clf).then((a) => { if (cancel) return; setAnalysis(a); setAPending(false); }).catch(() => { if (!cancel) setAPending(false); });
    return () => { cancel = true; };
  }, [source, tray, realImg, clf]);

  const agg = analysis ? (useCnn && analysis.cnn.available ? analysis.cnn : analysis.base) : null;
  const predIdx = agg ? agg.pred : 0;

  // synthetic OOD reference (so "real is out-of-distribution" is measured, not asserted)
  const [refMse, setRefMse] = useState<number | null>(null);
  useEffect(() => { syntheticReferenceMse(clf).then(setRefMse).catch(() => setRefMse(null)); }, [clf]);
  const realMeanMse = analysis && analysis.ood.available ? analysis.ood.meanMse : null;
  const oodRatio = realMeanMse != null && refMse ? realMeanMse / refMse : null;

  // accumulate real classifications this session (dedup by patch + classifier) for the real confusion / recall
  const [realResults, setRealResults] = useState<Record<string, { truth: number; pred: number }>>({});
  useEffect(() => {
    if (source !== 'real' || !realPatch || !analysis || !agg) return;
    const truth = LITHOLOGIES.indexOf(realPatch.litho_label as Lithology);
    if (truth < 0) return;
    const key = `${realPatch.id}:${useCnn && analysis.cnn.available ? 'cnn' : 'base'}`;
    setRealResults((prev) => (prev[key] && prev[key].pred === agg.pred ? prev : { ...prev, [key]: { truth, pred: agg.pred } }));
  }, [source, realPatch, analysis, agg, useCnn]);
  const realItems = Object.values(realResults);
  const realConfusion = useMemo(() => buildConfusion(realItems), [realResults]);
  const realRecall = LITHOLOGIES.map((_, i) => { const row = realConfusion[i]; const sum = row.reduce((a, b) => a + b, 0); return sum ? row[i] / sum : null; });

  // ---- latent projection (synthetic clouds fitted once; current windows overlaid) ----
  const synthSamples = useMemo(() => lithoFeatureSamples(16), []);
  const pca = useMemo(() => fitPca(synthSamples.flatMap((s) => s.feats)), [synthSamples]);
  const synthPoints = useMemo<ScatterPoint[]>(() => synthSamples.flatMap((s) => s.feats.map((f) => {
    const [x, y] = project(f, pca); return { x, y, litho: s.litho, label: es ? LITHO_INFO[s.litho].es : LITHO_INFO[s.litho].en };
  })), [synthSamples, pca, es]);
  const overlayPoints = useMemo<ScatterPoint[]>(() => {
    if (!analysis) return [];
    const step = Math.max(1, Math.floor(analysis.cells.length / 48));
    const out: ScatterPoint[] = [];
    for (let i = 0; i < analysis.cells.length; i += step) {
      const c = analysis.cells[i]; const [x, y] = project(c.feat, pca);
      if (source === 'real') out.push({ x, y, real: true, label: `${es ? 'parche real' : 'real patch'}: ${realPatch?.dcid_class ?? ''}` });
      else { const li = c.cnnProbs ? c.cnnCls : c.baseCls; out.push({ x, y, litho: LITHOLOGIES[li], label: `${es ? 'ventana sintetica' : 'synthetic window'}: ${LITHOLOGIES[li]}` }); }
    }
    return out;
  }, [analysis, pca, source, realPatch, es]);
  const latentPoints = [...synthPoints, ...overlayPoints];

  const oodValues = analysis && analysis.ood.available ? analysis.cells.map((c) => c.oodMse) : null;
  const salValues = analysis ? analysis.cells.map((c) => (c.cnnProbs ? c.cnnProbs[predIdx] : c.baseProbs[predIdx])) : null;

  const Kpi = ({ label, value }: { label: string; value: string }) => (
    <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>
  );

  // ============================= TABS =============================
  const oodTab = {
    id: 'ood', label: es ? 'Mapa OOD' : 'OOD map',
    content: (
      <div className="pf-vizstack">
        <div className="pf-plot-t">{es ? 'Novedad por ventana: error de reconstruccion del autoencoder OOD (mas caliente = mas fuera de distribucion)' : 'Per-window novelty: reconstruction error of the OOD autoencoder (hotter = more out-of-distribution)'}</div>
        {aPending && <p className="pf-note">{es ? 'analizando ventanas (onnxruntime-web)...' : 'analysing windows (onnxruntime-web)...'}</p>}
        {analysis && oodValues && (
          <>
            <HeatCanvas img={analysis.work} cols={analysis.cols} rows={analysis.rows} stride={analysis.stride} patch={analysis.patch}
              values={oodValues} colormap={oodColormap} format={(v) => `MSE ${v.toFixed(4)}`} ariaLabel={es ? 'mapa OOD' : 'OOD map'} />
            <div className="pf-kpis">
              <Kpi label={es ? 'MSE medio' : 'mean MSE'} value={realMeanMse != null ? realMeanMse.toFixed(4) : 'n/a'} />
              <Kpi label={es ? 'ref. sintetica' : 'synthetic ref.'} value={refMse != null ? refMse.toFixed(4) : 'n/a'} />
              <Kpi label={es ? 'razon novedad' : 'novelty ratio'} value={oodRatio != null ? `${oodRatio.toFixed(2)}x` : 'n/a'} />
            </div>
            {source === 'real' && oodRatio != null && (
              <p className="pf-note">{
                oodRatio >= 1.3
                  ? (es ? `El OOD DISPARA: el error de reconstruccion sobre este parche real es ~${oodRatio.toFixed(1)}x el del core sintetico en distribucion. El AE nunca vio textura de roca real, asi que marcarla como novedosa es correcto.` : `OOD FIRES: reconstruction error on this real patch is ~${oodRatio.toFixed(1)}x that of in-distribution synthetic core. The AE never saw real rock texture, so flagging it as novel is correct.`)
                  : oodRatio >= 1.0
                    ? (es ? `Senal OOD presente pero debil: el error de reconstruccion (~${oodRatio.toFixed(2)}x) esta apenas sobre la referencia de core sintetico. La evidencia mas clara de fuera-de-distribucion aqui es la baja confianza del clasificador y la brecha en el espacio latente.` : `OOD signal present but weak: reconstruction error (~${oodRatio.toFixed(2)}x) is only just above the synthetic-core reference. The clearer out-of-distribution evidence here is the low classifier confidence and the latent-space gap.`)
                    : (es ? `Honesto: la senal OOD por reconstruccion NO marca este parche (se reconstruye tan facil como el core sintetico, ~${oodRatio.toFixed(2)}x). Este detector es debil (AUC 0.729) y esta dominado por el contraste frame-vs-core; la evidencia real de fuera-de-distribucion aqui es la baja confianza del clasificador y la brecha en el espacio latente.` : `Honest: the reconstruction-MSE OOD signal does NOT flag this patch (it reconstructs about as easily as synthetic core, ~${oodRatio.toFixed(2)}x). This detector is weak (AUC 0.729) and is dominated by frame-vs-core contrast; the real out-of-distribution evidence here is the low classifier confidence and the latent-space gap.`)
              }</p>
            )}
          </>
        )}
        {analysis && !oodValues && <p className="pf-note">{es ? 'El modelo OOD no cargo en esta sesion (core-ood.onnx).' : 'The OOD model did not load in this session (core-ood.onnx).'}</p>}
      </div>
    ),
  };

  const saliencyTab = {
    id: 'saliency', label: es ? 'Evidencia' : 'Class evidence',
    content: (
      <div className="pf-vizstack">
        <div className="pf-plot-t">{es
          ? `Evidencia por ventana para la clase predicha (${es ? LITHO_INFO[LITHOLOGIES[predIdx]].es : LITHOLOGIES[predIdx]}): probabilidad del clasificador en cada ventana deslizante (donde el CNN "ve" esa litologia).`
          : `Per-window evidence for the predicted class (${LITHO_INFO[LITHOLOGIES[predIdx]].en}): the classifier's probability at each sliding window (where the CNN "sees" that lithology).`}</div>
        {aPending && <p className="pf-note">{es ? 'analizando...' : 'analysing...'}</p>}
        {analysis && salValues && (
          <>
            <HeatCanvas img={analysis.work} cols={analysis.cols} rows={analysis.rows} stride={analysis.stride} patch={analysis.patch}
              values={salValues} colormap={evidenceColormap} format={(v) => `p=${v.toFixed(2)}`} ariaLabel={es ? 'mapa de evidencia' : 'evidence map'} />
            <p className="pf-cap">{es
              ? 'Saliencia por oclusion/ventana, no Grad-CAM: es la contribucion espacial real de cada ventana a la prediccion agregada (forward-only en el navegador, sin gradientes).'
              : 'Occlusion / window saliency, not Grad-CAM: it is each window\'s real spatial contribution to the aggregate prediction (forward-only in the browser, no gradients).'}</p>
          </>
        )}
      </div>
    ),
  };

  const latentTab = {
    id: 'latent', label: es ? 'Latente' : 'Latent',
    content: (
      <div className="pf-vizstack">
        <div className="pf-plot-t">{es ? 'Proyeccion PCA de las features color/textura: nubes sinteticas por litologia + ventanas de la imagen actual' : 'PCA projection of the colour/texture features: synthetic per-lithology clouds + windows of the current image'}</div>
        <LatentScatter points={latentPoints} lang={lang} />
        <p className="pf-cap">{source === 'real'
          ? (es ? 'Los rombos son ventanas del parche real. Cuando caen lejos de toda nube sintetica, esa distancia ES la brecha de dominio (out-of-distribution).' : 'The diamonds are windows of the real patch. When they land away from every synthetic cloud, that distance IS the domain gap (out-of-distribution).')
          : (es ? 'Los rombos son ventanas de la bandeja sintetica actual, deberian caer sobre sus nubes de litologia.' : 'The diamonds are windows of the current synthetic tray; they should land on their lithology clouds.')}</p>
      </div>
    ),
  };

  const legendTab = { id: 'legend', label: es ? 'Litologias' : 'Lithologies', content: <Legend es={es} full /> };

  // ---- synthetic tabs ----
  const syntheticTabs = [
    {
      id: 'tray', label: es ? 'Bandeja' : 'Tray',
      content: (
        <div className="cl-split">
          <div className="cl-split-main">
            <div className="pf-plot-th">
              <div className="pf-plot-t">{es ? 'Bandeja + segmentacion en vivo (pasa el cursor)' : 'Tray + live segmentation (hover)'}</div>
              <div className="pf-seg"><button className={`chip ${overlay ? 'on' : ''}`} onClick={() => setOverlay((v) => !v)}>overlay</button></div>
            </div>
            <TrayView tray={tray} segments={segs} showOverlay={overlay} lang={lang} />
            <div className="pf-kpis">
              <Kpi label={es ? 'precision vs verdad' : 'accuracy vs truth'} value={`${(score.pixelAccuracy * 100).toFixed(1)}%`} />
              <Kpi label={es ? 'segmentos' : 'segments'} value={`${segs.length}`} />
              <Kpi label={es ? 'inciertos' : 'uncertain'} value={`${nOod}`} />
              <Kpi label={es ? 'clasificador' : 'classifier'} value={cnnReady ? 'CNN' : 'baseline'} />
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
          <div className="pf-plot-t">{es ? 'Log litologico apilado por profundidad (todos los canales)' : 'Depth-stitched lithology log (all channels)'}</div>
          <StripLog bands={bands} depthFrom={tray.spec.depthFromM} depthTo={tray.spec.depthToM} height={460} lang={lang} />
          <Legend es={es} />
        </div>
      ),
    },
    {
      id: 'confusion', label: es ? 'Confusion' : 'Confusion',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? 'Matriz de confusion de ESTE caso (verdad x predicho, % por fila)' : 'Confusion matrix for THIS case (truth x predicted, row %)'}</div>
          <ConfusionMatrix confusion={score.confusion} lang={lang} />
          <p className="pf-cap">{es ? 'La diagonal es el recall por litologia; fuera de la diagonal son confusiones.' : 'The diagonal is per-lithology recall; off-diagonal cells are confusions.'}</p>
        </div>
      ),
    },
    { id: 'recall', label: 'Recall', content: <RecallBars recall={synthRecall} es={es} /> },
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
    oodTab, saliencyTab, latentTab, legendTab,
  ];

  // ---- real tabs ----
  const realTabs = realPatch && realDoc ? [
    {
      id: 'patch', label: es ? 'Parche' : 'Patch',
      content: (
        <div className="cl-split">
          <div className="cl-split-main">
            <div className="pf-plot-t">{es ? 'Parche de core real (no una bandeja de campo)' : 'Single real core patch (not a field tray)'}</div>
            <img className="cl-realimg" src={realImageUrl(realPatch.image)} alt={`DCID ${realPatch.dcid_class}`} />
            <Provenance p={realPatch} />
            <div className="pf-kpis">
              <Kpi label={es ? 'etiqueta DCID' : 'DCID label'} value={realPatch.dcid_class} />
              <Kpi label={es ? 'verdad (mapeada)' : 'truth (mapped)'} value={es ? LITHO_INFO[realPatch.litho_label as Lithology].es : LITHO_INFO[realPatch.litho_label as Lithology].en} />
              <Kpi label={es ? 'prediccion' : 'prediction'} value={agg ? (es ? LITHO_INFO[LITHOLOGIES[agg.pred]].es : LITHO_INFO[LITHOLOGIES[agg.pred]].en) : (aPending ? '...' : 'n/a')} />
              <Kpi label={es ? 'confianza' : 'confidence'} value={agg ? `${(agg.conf * 100).toFixed(0)}%` : 'n/a'} />
            </div>
            <p className="pf-cap pf-muted">{realPatch.mapping_note}</p>
          </div>
          <div className="cl-split-side">
            <div className="pf-plot-t">{es ? 'Clasificador' : 'Classifier'}</div>
            <p className="pf-cap">{agg && agg === analysis?.base && useCnn ? (es ? 'CNN no cargado, baseline en vivo' : 'CNN not loaded, baseline live') : (useCnn ? 'CNN (onnxruntime-web)' : 'baseline color/textura')}</p>
            <p className="pf-cap pf-muted">{es
              ? 'La prediccion es indicativa: el modelo se entreno con textura SINTETICA, este es un parche real (fuera de distribucion). Ver el mapa OOD.'
              : 'The prediction is indicative: the model was trained on SYNTHETIC texture, this is a real (out-of-distribution) patch. See the OOD map.'}</p>
          </div>
        </div>
      ),
    },
    oodTab, saliencyTab, latentTab,
    {
      id: 'confusion', label: es ? 'Confusion' : 'Confusion',
      content: (
        <div className="pf-vizstack">
          <div className="pf-plot-t">{es ? `Confusion sobre los parches reales que clasificaste esta sesion (${realItems.length})` : `Confusion over the real patches you classified this session (${realItems.length})`}</div>
          {realItems.length ? <ConfusionMatrix confusion={realConfusion} lang={lang} /> : <p className="pf-note">{es ? 'Selecciona parches reales para acumular la matriz (verdad = etiqueta DCID mapeada).' : 'Select real patches to accumulate the matrix (truth = mapped DCID label).'}</p>}
          <button className="chip" onClick={() => setRealResults({})}>{es ? 'reiniciar' : 'reset'}</button>
          <p className="pf-cap pf-muted">{es ? 'Recuerda: como es fuera de distribucion, esta matriz mide desalineacion de dominio, no la habilidad real del modelo.' : 'Remember: as this is out-of-distribution, this matrix measures domain mismatch, not the model\'s true skill.'}</p>
        </div>
      ),
    },
    { id: 'recall', label: 'Recall', content: <RecallBars recall={realRecall} es={es} empty={realItems.length === 0} /> },
    { id: 'upload', label: es ? 'Tu imagen' : 'Your image', content: <UploadPanel clf={clf} es={es} /> },
    legendTab,
  ] : [{ id: 'patch', label: es ? 'Parche' : 'Patch', content: <p className="pf-note">{es ? 'cargando muestras reales (DCID)...' : 'loading real samples (DCID)...'}</p> }];

  const tabs = source === 'synthetic' ? syntheticTabs : realTabs;

  return (
    <div className="page-body pf-layout">
      <aside className="pf-side">
        <div className="pf-card">
          <div className="pf-card-t">{es ? 'Fuente' : 'Source'}</div>
          <div className="pf-chips">
            <button className={`chip ${source === 'synthetic' ? 'on' : ''}`} onClick={() => setSource('synthetic')}>{es ? 'Sintetico' : 'Synthetic'}</button>
            <button className={`chip ${source === 'real' ? 'on' : ''}`} onClick={() => setSource('real')}>{es ? 'Muestra real' : 'Real sample'}</button>
          </div>
          <div className="pf-cap pf-muted">{source === 'synthetic'
            ? (es ? 'Generador de bandejas sintetico (perillas activas).' : 'Synthetic tray generator (knobs live).')
            : (es ? 'Foto de core real DCID (perillas del generador desactivadas).' : 'Real DCID core photo (generator knobs disabled).')}</div>
        </div>

        {source === 'synthetic' ? (
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
        ) : (
          <div className="pf-card">
            <div className="pf-card-t">{es ? 'Parche real (DCID-7)' : 'Real patch (DCID-7)'}</div>
            {realDoc ? Object.entries(groupByClass(realDoc.patches)).map(([cls, ps]) => (
              <div key={cls} className="pf-catgroup">
                <div className="pf-catlabel">{cls}</div>
                <div className="pf-chips">
                  {ps.map((p) => (
                    <button key={p.id} className={`chip ${realPatch?.id === p.id ? 'on' : ''}`} title={p.id} onClick={() => setRealId(p.id)}>{p.id.split('-').pop()}</button>
                  ))}
                </div>
              </div>
            )) : <p className="pf-cap">{es ? 'cargando...' : 'loading...'}</p>}
            {realPatch && <div className="pf-cap pf-muted">{es ? 'DCID · Li et al. 2025 · CC BY-NC 4.0' : 'DCID · Li et al. 2025 · CC BY-NC 4.0'}</div>}
          </div>
        )}

        <div className="pf-card">
          <div className="pf-card-t">{es ? 'Controles (en vivo)' : 'Controls (live)'}</div>
          <label className="pf-ctl">{es ? 'umbral de confianza' : 'confidence threshold'}: {conf.toFixed(2)}
            <input className="range" type="range" min={0} max={0.9} step={0.05} value={conf} onChange={(e) => setConf(+e.target.value)} />
          </label>
          <div className="pf-catlabel">{es ? 'clasificador' : 'classifier'}</div>
          <div className="pf-chips">
            <button className={`chip ${!useCnn ? 'on' : ''}`} onClick={() => setUseCnn(false)}>baseline</button>
            <button className={`chip ${useCnn ? 'on' : ''}`} onClick={() => setUseCnn(true)} title={cnnPending ? (es ? 'CNN pendiente' : 'CNN pending') : 'CNN'}>CNN{useCnn && source === 'synthetic' && cnnPending ? ' ...' : ''}</button>
          </div>
        </div>
      </aside>

      <main className="pf-main">
        {source === 'real' && (
          <Callout variant="honest" title={es ? 'Modelos sinteticos sobre datos reales (fuera de distribucion)' : 'Synthetic-trained models on real data (out-of-distribution)'}>
            {es
              ? 'El CNN de litologia y el detector OOD se entrenaron con el generador de core SINTETICO de CoreLog, asi que sobre fotos reales DCID quedan fuera de distribucion: la clase predicha es solo indicativa. La brecha se ve en tres senales honestas: baja confianza del clasificador, la separacion en el espacio latente y el error de reconstruccion OOD (que reportamos con su valor medido, y decimos cuando es debil, no un simple "dispara siempre").'
              : 'The lithology CNN and the OOD detector were trained on CoreLog\'s SYNTHETIC core generator, so on real DCID photos they are out-of-distribution: the predicted class is indicative only. The gap shows in three honest signals: low classifier confidence, the latent-space separation, and the OOD reconstruction error (reported with its measured value, and we say when it is weak rather than a blanket "always fires").'}
          </Callout>
        )}
        <Tabs tabs={tabs} ariaLabel={es ? 'vistas' : 'views'} />
      </main>
    </div>
  );
}

function groupByClass(patches: RealPatch[]): Record<string, RealPatch[]> {
  const out: Record<string, RealPatch[]> = {};
  for (const p of patches) (out[p.dcid_class] ??= []).push(p);
  return out;
}

function Provenance({ p }: { p: RealPatch }) {
  return (
    <div className="cl-prov">
      <span className="chip on">DCID</span>
      <span className="pf-cap">Li et al. 2025 · <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">DOI {p.doi}</a> · {p.license} · {p.provenance}</span>
    </div>
  );
}

function RecallBars({ recall, es, empty }: { recall: Array<number | null>; es: boolean; empty?: boolean }) {
  return (
    <div className="pf-vizstack">
      <div className="pf-plot-t">{es ? 'Recall por litologia' : 'Per-lithology recall'}</div>
      {empty ? <p className="pf-note">{es ? 'Aun sin parches clasificados.' : 'No patches classified yet.'}</p> : (
        <div className="cl-recall">
          {LITHOLOGIES.map((l, i) => (
            <div key={l} className="cl-recall-row">
              <span className="cl-sw" style={{ background: `rgb(${LITHO_INFO[l].rgb.join(',')})` }} />
              <span className="cl-recall-lab">{es ? LITHO_INFO[l].es : LITHO_INFO[l].en}</span>
              <div className="cl-recall-bar"><i style={{ width: `${(recall[i] ?? 0) * 100}%` }} /></div>
              <span className="mono">{recall[i] == null ? 'n/a' : `${(recall[i]! * 100).toFixed(0)}%`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadPanel({ clf, es }: { clf: PatchClassifier; es: boolean }) {
  const [img, setImg] = useState<RgbaImage | null>(null);
  const [a, setA] = useState<PatchAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setA(null);
    const objUrl = URL.createObjectURL(f);
    setUrl(objUrl);
    try { const im = await decodeImage(objUrl); setImg(im); const an = await analyzeWindows(im, clf); setA(an); } catch { /* ignore */ }
    setBusy(false);
  };
  const agg = a ? (a.cnn.available ? a.cnn : a.base) : null;

  return (
    <div className="pf-vizstack">
      <div className="pf-plot-t">{es ? 'Tu propia foto de core (misma tuberia real)' : 'Your own core photo (same real pipeline)'}</div>
      <p className="pf-cap">{es
        ? 'Sube una imagen (jpg/png). Se decodifica en el navegador y corre la MISMA tuberia (ventanas + baseline + lithology-CNN + core-ood). Nada se sube a un servidor.'
        : 'Upload an image (jpg/png). It is decoded in the browser and runs the SAME pipeline (windows + baseline + lithology-CNN + core-ood). Nothing is sent to a server.'}</p>
      <input type="file" accept="image/*" onChange={onFile} />
      {busy && <p className="pf-note">{es ? 'analizando...' : 'analysing...'}</p>}
      {url && <img className="cl-realimg" src={url} alt="uploaded core" />}
      {agg && (
        <div className="pf-kpis">
          <Kpi2 label={es ? 'prediccion' : 'prediction'} value={es ? LITHO_INFO[LITHOLOGIES[agg.pred]].es : LITHO_INFO[LITHOLOGIES[agg.pred]].en} />
          <Kpi2 label={es ? 'confianza' : 'confidence'} value={`${(agg.conf * 100).toFixed(0)}%`} />
          <Kpi2 label={es ? 'MSE OOD medio' : 'mean OOD MSE'} value={a && a.ood.available ? a.ood.meanMse.toFixed(4) : 'n/a'} />
        </div>
      )}
      {img && <p className="pf-cap pf-muted">{es ? 'Prediccion indicativa: el modelo se entreno con textura sintetica; tu imagen es fuera de distribucion.' : 'Indicative prediction: the model was trained on synthetic texture; your image is out-of-distribution.'}</p>}
    </div>
  );
}

function Kpi2({ label, value }: { label: string; value: string }) {
  return <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>;
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
