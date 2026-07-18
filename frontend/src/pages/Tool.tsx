import { useEffect, useMemo, useState } from 'react';
import { Callout, Tabs, useShellLang } from '@fasl-work/caos-app-shell';
import { CASES, caseSpec, type CoreCase } from '../cv/cases.ts';
import { classifyTray, lithoFeatureSamples, makeBaselineClassifier, makeTray, scoreVsTruth } from '../cv/index.ts';
import { LITHO_INFO, LITHOLOGIES, N_LITHO, type Lithology, type RgbaImage, type Segment } from '../cv/types.ts';
import { classifyTrayCNN } from '../lib/cnn.ts';
import {
  analyzeWindows, decodeImage, DCID7, loadRealIndex, makeControlImage, realImageUrl, runDcidHead,
  syntheticReferenceMse, type ControlKind, type PatchAnalysis, type RealDoc, type RealPatch,
} from '../lib/realpatch.ts';
import { realHeadAvailable } from '../lib/ort.ts';
import { loadOodDetector, type OodDetector } from '../lib/ood.ts';
import { loadOodBench } from '../lib/artifacts.ts';
import { fitPca, project } from '../lib/pca.ts';
import { TrayView } from '../viz/TrayView.tsx';
import { StripLog } from '../viz/StripLog.tsx';
import { ConfusionMatrix } from '../viz/ConfusionMatrix.tsx';
import { HeatCanvas, oodColormap, evidenceColormap } from '../viz/HeatCanvas.tsx';
import { LatentScatter, type ScatterPoint } from '../viz/LatentScatter.tsx';
import type { PatchClassifier } from '../cv/types.ts';
import { PanelBoundary } from '../viz/PanelBoundary.tsx';

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
  const [oodMode, setOodMode] = useState<'mahal' | 'recon'>('mahal');
  const [useDcidHead, setUseDcidHead] = useState(false);
  const [control, setControl] = useState<'none' | ControlKind>('none');
  const [headDim, setHeadDim] = useState(24);
  const [headAvail, setHeadAvail] = useState(false);
  const [dcidProbs, setDcidProbs] = useState<Float32Array | null>(null);

  const [det, setDet] = useState<OodDetector | null>(null);
  useEffect(() => {
    loadOodBench().then((b) => { if (b) setHeadDim(b.realHeadOnnxDim || 24); }).catch(() => {});
    realHeadAvailable().then(setHeadAvail).catch(() => setHeadAvail(false));
    loadOodDetector().then((d) => setDet(d?.shipped ?? null)).catch(() => setDet(null));
  }, []);

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
    if (source !== 'real') { setRealImg(null); return; }
    if (control !== 'none') { setRealImg(makeControlImage(control)); return; }
    if (!realPatch) { setRealImg(null); return; }
    let cancel = false; setRealImg(null);
    decodeImage(realImageUrl(realPatch.image)).then((im) => { if (!cancel) setRealImg(im); }).catch(() => {});
    return () => { cancel = true; };
  }, [source, realPatch, control]);

  // DCID-fine-tuned real head (one inference per selected real patch; only for genuine DCID patches)
  useEffect(() => {
    if (source !== 'real' || control !== 'none' || !realPatch || !useDcidHead || !headAvail) { setDcidProbs(null); return; }
    let cancel = false; setDcidProbs(null);
    runDcidHead(realImageUrl(realPatch.image), headDim).then((p) => { if (!cancel) setDcidProbs(p); }).catch(() => {});
    return () => { cancel = true; };
  }, [source, control, realPatch, useDcidHead, headAvail, headDim]);
  const dcidPred = dcidProbs ? Array.from(dcidProbs).reduce((b, v, i, a) => (v > a[b] ? i : b), 0) : -1;

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
    if (source !== 'real' || control !== 'none' || !realPatch || !analysis || !agg) return;
    const truth = LITHOLOGIES.indexOf(realPatch.litho_label as Lithology);
    if (truth < 0) return;
    const key = `${realPatch.id}:${useCnn && analysis.cnn.available ? 'cnn' : 'base'}`;
    setRealResults((prev) => (prev[key] && prev[key].pred === agg.pred ? prev : { ...prev, [key]: { truth, pred: agg.pred } }));
  }, [source, control, realPatch, analysis, agg, useCnn]);
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
      else { const li = c.cnnProbs ? c.cnnCls : c.baseCls; out.push({ x, y, litho: LITHOLOGIES[li], label: `${es ? 'ventana sintética' : 'synthetic window'}: ${LITHOLOGIES[li]}` }); }
    }
    return out;
  }, [analysis, pca, source, realPatch, es]);
  const latentPoints = [...synthPoints, ...overlayPoints];

  const oodValues = analysis && analysis.ood.available ? analysis.cells.map((c) => c.oodMse) : null;
  const mahalValues = analysis && analysis.mahal.available ? analysis.cells.map((c) => c.mahal) : null;
  const showMahal = oodMode === 'mahal' && mahalValues != null;
  const oodDisplayValues = showMahal ? mahalValues : oodValues;
  const meanMahal = analysis && analysis.mahal.available ? analysis.mahal.meanMahal : null;
  const mahalThresh = det ? (det.idQuantiles['0.95'] ?? det.idQuantiles['0.9'] ?? null) : null;
  const mahalFires = meanMahal != null && mahalThresh != null ? meanMahal > mahalThresh : null;
  const salValues = analysis ? analysis.cells.map((c) => (c.cnnProbs ? c.cnnProbs[predIdx] : c.baseProbs[predIdx])) : null;

  const Kpi = ({ label, value }: { label: string; value: string }) => (
    <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>
  );

  // ============================= TABS =============================
  const oodTab = {
    id: 'ood', label: es ? 'Mapa OOD' : 'OOD map',
    content: (
      <div className="pf-vizstack">
        <div className="pf-plot-th">
          <div className="pf-plot-t">{showMahal
            ? (es ? 'Novedad por ventana: distancia de Mahalanobis en el espacio de features (detector embarcado; mas caliente = mas fuera de distribución)' : 'Per-window novelty: Mahalanobis distance in feature space (shipped detector; hotter = more out-of-distribution)')
            : (es ? 'Novedad por ventana: error de reconstrucción del autoencoder OOD incumbente (mas caliente = mas fuera de distribución)' : 'Per-window novelty: reconstruction error of the incumbent OOD autoencoder (hotter = more out-of-distribution)')}</div>
          <div className="pf-seg">
            <button className={`chip ${oodMode === 'mahal' ? 'on' : ''}`} disabled={mahalValues == null} onClick={() => setOodMode('mahal')} title="feature-space Mahalanobis">Mahalanobis</button>
            <button className={`chip ${oodMode === 'recon' ? 'on' : ''}`} onClick={() => setOodMode('recon')} title="reconstruction MSE">{es ? 'reconstrucción' : 'reconstruction'}</button>
          </div>
        </div>
        {aPending && <p className="pf-note">{es ? 'analizando ventanas (onnxruntime-web)...' : 'analysing windows (onnxruntime-web)...'}</p>}
        {analysis && oodDisplayValues && (
          <>
            <HeatCanvas img={analysis.work} cols={analysis.cols} rows={analysis.rows} stride={analysis.stride} patch={analysis.patch}
              values={oodDisplayValues} colormap={oodColormap}
              format={(v) => (showMahal ? `M ${v.toFixed(1)}` : `MSE ${v.toFixed(4)}`)} ariaLabel={es ? 'mapa OOD' : 'OOD map'} />
            {showMahal ? (
              <>
                <div className="pf-kpis">
                  <Kpi label={es ? 'Mahalanobis medio' : 'mean Mahalanobis'} value={meanMahal != null ? meanMahal.toFixed(1) : 'n/a'} />
                  <Kpi label={es ? 'umbral ID (p95)' : 'ID threshold (p95)'} value={mahalThresh != null ? mahalThresh.toFixed(1) : 'n/a'} />
                  <Kpi label={es ? 'veredicto' : 'verdict'} value={mahalFires == null ? 'n/a' : (mahalFires ? (es ? 'DISPARA' : 'FIRES') : (es ? 'en distr.' : 'in-distr.'))} />
                </div>
                <p className="pf-note">{es
                  ? 'Detector embarcado: Gaussiana por clase (Mahalanobis, Lee et al. 2018) ajustada sobre el core sintético. Un parche real o no-core cae lejos de todo centroide sintético, así que su distancia es grande. Es el reemplazo principal del debil MSE de reconstrucción; compara ambos con el toggle de arriba y ve la tabla completa en Benchmark.'
                  : 'Shipped detector: a class-conditional Gaussian (Mahalanobis, Lee et al. 2018) fit on synthetic core. A real or non-core patch lands far from every synthetic centroid, so its distance is large. This is the principled replacement for the weak reconstruction MSE; compare both with the toggle above and see the full table on Benchmark.'}</p>
              </>
            ) : (
              <>
                <div className="pf-kpis">
                  <Kpi label={es ? 'MSE medio' : 'mean MSE'} value={realMeanMse != null ? realMeanMse.toFixed(4) : 'n/a'} />
                  <Kpi label={es ? 'ref. sintética' : 'synthetic ref.'} value={refMse != null ? refMse.toFixed(4) : 'n/a'} />
                  <Kpi label={es ? 'razon novedad' : 'novelty ratio'} value={oodRatio != null ? `${oodRatio.toFixed(2)}x` : 'n/a'} />
                </div>
                {source === 'real' && oodRatio != null && (
                  <p className="pf-note">{
                    oodRatio >= 1.3
                      ? (es ? `El OOD por reconstrucción dispara (~${oodRatio.toFixed(1)}x el core sintético). Aun así, el detector en espacio de features (Mahalanobis) es mas confiable; ve el toggle.` : `The reconstruction OOD fires (~${oodRatio.toFixed(1)}x synthetic core). Even so, the feature-space detector (Mahalanobis) is more reliable; see the toggle.`)
                      : (es ? `Honesto: la señal OOD por reconstrucción es debil aquí (~${oodRatio.toFixed(2)}x, AUC 0.729, dominada por el contraste frame-vs-core). Por eso el detector embarcado es Mahalanobis en el espacio de features, no la reconstrucción.` : `Honest: the reconstruction-MSE OOD signal is weak here (~${oodRatio.toFixed(2)}x, AUC 0.729, dominated by frame-vs-core contrast). This is exactly why the shipped detector is feature-space Mahalanobis, not reconstruction.`)
                  }</p>
                )}
              </>
            )}
          </>
        )}
        {analysis && !oodDisplayValues && <p className="pf-note">{es ? 'Los modelos OOD no cargaron en esta sesion (lithology-cnn.onnx / core-ood.onnx).' : 'The OOD models did not load this session (lithology-cnn.onnx / core-ood.onnx).'}</p>}
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
        <div className="pf-plot-t">{es ? 'Proyeccion PCA de las features color/textura: nubes sintéticas por litologia + ventanas de la imagen actual' : 'PCA projection of the colour/texture features: synthetic per-lithology clouds + windows of the current image'}</div>
        <LatentScatter points={latentPoints} lang={lang} />
        <p className="pf-cap">{source === 'real'
          ? (es ? 'Los rombos son ventanas del parche real. Cuando caen lejos de toda nube sintética, esa distancia ES la brecha de dominio (out-of-distribution).' : 'The diamonds are windows of the real patch. When they land away from every synthetic cloud, that distance IS the domain gap (out-of-distribution).')
          : (es ? 'Los rombos son ventanas de la bandeja sintética actual, deberian caer sobre sus nubes de litologia.' : 'The diamonds are windows of the current synthetic tray; they should land on their lithology clouds.')}</p>
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
              <div className="pf-plot-t">{es ? 'Bandeja + segmentación en vivo (pasa el cursor)' : 'Tray + live segmentation (hover)'}</div>
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
      content: control !== 'none' ? (
        <div className="cl-split">
          <div className="cl-split-main">
            <div className="pf-plot-t">{es ? 'Control no-core (debe disparar el OOD mas fuerte)' : 'Non-core control (must trip OOD hardest)'}</div>
            {analysis && oodDisplayValues ? (
              <HeatCanvas img={analysis.work} cols={analysis.cols} rows={analysis.rows} stride={analysis.stride} patch={analysis.patch}
                values={oodDisplayValues} colormap={oodColormap} format={(v) => (showMahal ? `M ${v.toFixed(1)}` : `MSE ${v.toFixed(4)}`)} ariaLabel="control OOD" />
            ) : <p className="pf-note">{es ? 'analizando...' : 'analysing...'}</p>}
            <div className="pf-kpis">
              <Kpi label={es ? 'entrada' : 'input'} value={control === 'noise' ? (es ? 'ruido' : 'noise') : (es ? 'gradiente' : 'gradient')} />
              <Kpi label={es ? 'Mahalanobis medio' : 'mean Mahalanobis'} value={meanMahal != null ? meanMahal.toFixed(1) : (aPending ? '...' : 'n/a')} />
              <Kpi label={es ? 'veredicto' : 'verdict'} value={mahalFires == null ? 'n/a' : (mahalFires ? (es ? 'DISPARA' : 'FIRES') : (es ? 'en distr.' : 'in-distr.'))} />
            </div>
          </div>
          <div className="cl-split-side">
            <div className="pf-plot-t">{es ? 'Control negativo' : 'Negative control'}</div>
            <p className="pf-cap pf-muted">{es
              ? 'Una imagen que no es core (ruido o un gradiente liso) debe marcarse como fuera de distribución MAS fuerte que cualquier parche real. Es el control honesto del detector OOD: uno que deja pasar el no-core no sirve. Ve el mapa OOD.'
              : 'A non-core image (noise or a smooth gradient) must be flagged as out-of-distribution HARDER than any real patch. It is the honest control for the OOD detector: one that lets non-core through is meaningless. See the OOD map.'}</p>
          </div>
        </div>
      ) : (
        <div className="cl-split">
          <div className="cl-split-main">
            <div className="pf-plot-t">{es ? 'Parche de core real (no una bandeja de campo)' : 'Single real core patch (not a field tray)'}</div>
            <img className="cl-realimg" src={realImageUrl(realPatch.image)} alt={`DCID ${realPatch.dcid_class}`} />
            <Provenance p={realPatch} />
            {useDcidHead && headAvail ? (
              <div className="pf-kpis">
                <Kpi label={es ? 'etiqueta DCID' : 'DCID label'} value={realPatch.dcid_class} />
                <Kpi label={es ? 'cabeza DCID-7' : 'DCID-7 head'} value={dcidPred >= 0 ? DCID7[dcidPred] : (aPending || dcidProbs === null ? '...' : 'n/a')} />
                <Kpi label={es ? 'correcto' : 'correct'} value={dcidPred >= 0 ? (DCID7[dcidPred] === realPatch.dcid_class ? (es ? 'si' : 'yes') : 'no') : 'n/a'} />
                <Kpi label={es ? 'confianza' : 'confidence'} value={dcidProbs && dcidPred >= 0 ? `${(dcidProbs[dcidPred] * 100).toFixed(0)}%` : 'n/a'} />
              </div>
            ) : (
              <div className="pf-kpis">
                <Kpi label={es ? 'etiqueta DCID' : 'DCID label'} value={realPatch.dcid_class} />
                <Kpi label={es ? 'verdad (mapeada)' : 'truth (mapped)'} value={es ? LITHO_INFO[realPatch.litho_label as Lithology].es : LITHO_INFO[realPatch.litho_label as Lithology].en} />
                <Kpi label={es ? 'prediccion' : 'prediction'} value={agg ? (es ? LITHO_INFO[LITHOLOGIES[agg.pred]].es : LITHO_INFO[LITHOLOGIES[agg.pred]].en) : (aPending ? '...' : 'n/a')} />
                <Kpi label={es ? 'confianza' : 'confidence'} value={agg ? `${(agg.conf * 100).toFixed(0)}%` : 'n/a'} />
              </div>
            )}
            <p className="pf-cap pf-muted">{realPatch.mapping_note}</p>
          </div>
          <div className="cl-split-side">
            <div className="pf-plot-t">{es ? 'Cabeza de clasificación' : 'Classification head'}</div>
            {useDcidHead && headAvail ? (
              <p className="pf-cap pf-muted">{es
                ? 'Cabeza DCID entrenada sobre core REAL (DCID-7). A diferencia del CNN sintético, esta prediccion NO es fuera de distribución: se entreno sobre roca real, y su exactitud retenida esta en Benchmark.'
                : 'DCID head trained on REAL core (DCID-7). Unlike the synthetic CNN, this prediction is NOT out-of-distribution: it was trained on real rock, and its held-out accuracy is on Benchmark.'}</p>
            ) : (
              <p className="pf-cap pf-muted">{es
                ? 'Cabeza sintética (CNN de CoreLog-6): entrenada con textura SINTETICA, así que sobre core real queda FUERA DE DISTRIBUCION y la prediccion es solo indicativa. Activa la cabeza DCID-7 para clasificar con un modelo entrenado sobre roca real.'
                : 'Synthetic head (CoreLog-6 CNN): trained on SYNTHETIC texture, so on real core it is OUT-OF-DISTRIBUTION and the prediction is indicative only. Switch on the DCID-7 head to classify with a model trained on real rock.'}</p>
            )}
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
          <p className="pf-cap pf-muted">{es ? 'Recuerda: como es fuera de distribución, esta matriz mide desalineacion de dominio, no la habilidad real del modelo.' : 'Remember: as this is out-of-distribution, this matrix measures domain mismatch, not the model\'s true skill.'}</p>
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
            ? (es ? 'Generador de bandejas sintético (perillas activas).' : 'Synthetic tray generator (knobs live).')
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
            <div className="pf-catlabel">{es ? 'control no-core' : 'non-core control'}</div>
            <div className="pf-chips">
              <button className={`chip ${control === 'none' ? 'on' : ''}`} onClick={() => setControl('none')}>{es ? 'off' : 'off'}</button>
              <button className={`chip ${control === 'noise' ? 'on' : ''}`} onClick={() => setControl('noise')}>{es ? 'ruido' : 'noise'}</button>
              <button className={`chip ${control === 'smooth' ? 'on' : ''}`} onClick={() => setControl('smooth')}>{es ? 'gradiente' : 'gradient'}</button>
            </div>
            <div className="pf-cap pf-muted">{es ? 'una imagen no-core debe disparar el OOD mas fuerte que cualquier parche real' : 'a non-core image must trip OOD harder than any real patch'}</div>
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
          {source === 'real' && headAvail && (
            <>
              <div className="pf-catlabel">{es ? 'cabeza de litologia' : 'lithology head'}</div>
              <div className="pf-chips">
                <button className={`chip ${!useDcidHead ? 'on' : ''}`} onClick={() => setUseDcidHead(false)} title={es ? 'CNN sintético (fuera de distribución sobre real)' : 'synthetic CNN (OOD on real)'}>{es ? 'sintética' : 'synthetic'}</button>
                <button className={`chip ${useDcidHead ? 'on' : ''}`} onClick={() => setUseDcidHead(true)} title={es ? 'entrenada sobre DCID-7 real' : 'trained on real DCID-7'}>DCID-7</button>
              </div>
              <div className="pf-cap pf-muted">{useDcidHead
                ? (es ? 'entrenada sobre roca real (en distribución)' : 'trained on real rock (in-distribution)')
                : (es ? 'entrenada sobre sintético (OOD sobre real)' : 'trained on synthetic (OOD on real)')}</div>
            </>
          )}
        </div>
      </aside>

      <main className="pf-main">
        {source === 'real' && (
          <Callout variant="honest" title={es ? 'Modelos sintéticos sobre datos reales (fuera de distribución)' : 'Synthetic-trained models on real data (out-of-distribution)'}>
            {es
              ? 'El CNN de litologia y el detector OOD se entrenaron con el generador de core SINTETICO de CoreLog, así que sobre fotos reales DCID quedan fuera de distribución: la clase predicha es solo indicativa. La brecha se ve en tres señales honestas: baja confianza del clasificador, la separacion en el espacio latente y el error de reconstrucción OOD (que reportamos con su valor medido, y decimos cuando es debil, no un simple "dispara siempre").'
              : 'The lithology CNN and the OOD detector were trained on CoreLog\'s SYNTHETIC core generator, so on real DCID photos they are out-of-distribution: the predicted class is indicative only. The gap shows in three honest signals: low classifier confidence, the latent-space separation, and the OOD reconstruction error (reported with its measured value, and we say when it is weak rather than a blanket "always fires").'}
          </Callout>
        )}
        <Tabs key={source} tabs={tabs.map((t) => ({ ...t, content: <PanelBoundary key={`${source}-${caseId}-${t.id}`} lang={es ? 'es' : 'en'}>{t.content}</PanelBoundary> }))} ariaLabel={es ? 'vistas' : 'views'} />
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
        ? 'Subir una imagen (jpg/png). Se decodifica en el navegador y corre la MISMA tuberia (ventanas + baseline + lithology-CNN + core-ood). Nada se sube a un servidor.'
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
      {img && <p className="pf-cap pf-muted">{es ? 'Prediccion indicativa: el modelo se entreno con textura sintética; tu imagen es fuera de distribución.' : 'Indicative prediction: the model was trained on synthetic texture; your image is out-of-distribution.'}</p>}
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
