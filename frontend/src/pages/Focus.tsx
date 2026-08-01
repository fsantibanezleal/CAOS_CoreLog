// ADR-0070 scenario focus view: one selected core tray, full page, nothing competing with the imagery.
//
// ADDITIVE. The App (Tool.tsx) keeps every tab and all its explanation; this route is a second way to look
// at the SAME tray through the SAME classifier. It renders OUTSIDE <AppShell> on purpose: the shell header
// and footer are exactly the chrome a focus view exists to escape.
//
// The stage is the TRAY WITH ITS LITHOLOGY OVERLAY, because logging is a visual act: the question a geologist
// actually asks of this product is "does that boundary sit where I would put it", and that can only be
// answered against the imagery at size, not against a confusion matrix.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { CASES, caseSpec, type CoreCase } from '../cv/cases.ts';
import { classifyTray, makeBaselineClassifier, makeTray } from '../cv/index.ts';
import { TrayView } from '../viz/TrayView.tsx';

/** What the confidence distribution MEANS, said on the stage.
 *
 *  These bands describe the CLASSIFIER's own reported confidence over the segments it produced. They are a
 *  statement about how sure the model is, not about whether it is right: a confidently wrong log looks
 *  exactly like a confidently right one from here, which is why the wording says "claims" rather than "is".
 *  The confusion matrix in the App is where correctness is measured. */
function confState(meanConf: number, lowFrac: number, es: boolean): { label: string; text: string } {
  if (lowFrac > 0.3) {
    return {
      label: es ? 'Log incierto' : 'Uncertain log',
      text: es
        ? `El clasificador marca baja confianza en ${(lowFrac * 100).toFixed(0)}% de los segmentos: en esta bandeja la respuesta automatica necesita revision del geologo antes de usarse.`
        : `The classifier flags low confidence on ${(lowFrac * 100).toFixed(0)}% of segments: on this tray the automatic log needs a geologist's review before it is used.`,
    };
  }
  if (meanConf > 0.85) {
    return {
      label: es ? 'Log confiado' : 'Confident log',
      text: es
        ? `Confianza media ${meanConf.toFixed(2)}. Es lo que el modelo AFIRMA, no una medida de acierto: un log seguro y equivocado se ve igual desde aqui. La matriz de confusion en la App es donde se mide el acierto.`
        : `Mean confidence ${meanConf.toFixed(2)}. That is what the model CLAIMS, not a measure of correctness: a confidently wrong log looks identical from here. The confusion matrix in the App is where correctness is measured.`,
    };
  }
  return {
    label: es ? 'Confianza mixta' : 'Mixed confidence',
    text: es
      ? `Confianza media ${meanConf.toFixed(2)}, con contactos donde el modelo duda. Los bordes entre litologias son donde la duda se concentra.`
      : `Mean confidence ${meanConf.toFixed(2)}, with contacts where the model hesitates. The boundaries between lithologies are where the doubt concentrates.`,
  };
}

export default function Focus() {
  const { caseId } = useParams();
  const es = useShellLang() === 'es';
  const theCase = useMemo<CoreCase>(() => CASES.find((c) => c.id === caseId) ?? CASES[0], [caseId]);

  const [conf, setConf] = useState(0.5);
  const [overlay, setOverlay] = useState(true);

  const tray = useMemo(() => makeTray(caseSpec(theCase)), [theCase]);
  const clf = useMemo(() => makeBaselineClassifier(), []);
  // The SAME classifier the App runs, at the SAME threshold control.
  const segs = useMemo(() => classifyTray(tray, clf, { oodThresh: conf }), [tray, clf, conf]);

  const meanConf = useMemo(
    () => (segs.length ? segs.reduce((s, x) => s + x.conf, 0) / segs.length : 0),
    [segs],
  );
  const lowFrac = useMemo(
    () => (segs.length ? segs.filter((x) => x.conf < conf).length / segs.length : 0),
    [segs, conf],
  );
  const nLitho = useMemo(() => new Set(segs.map((s) => s.litho)).size, [segs]);

  const st = confState(meanConf, lowFrac, es);

  const hud = [
    { v: `${segs.length}`, l: es ? 'segmentos' : 'segments', tone: 'accent' },
    { v: meanConf.toFixed(2), l: es ? 'confianza media' : 'mean confidence', tone: 'blue' },
    { v: `${(lowFrac * 100).toFixed(0)}%`, l: es ? 'baja confianza' : 'low confidence' },
    { v: `${nLitho}`, l: es ? 'litologias' : 'lithologies' },
    { v: `${theCase.nChannels}`, l: es ? 'canales' : 'channels' },
    { v: theCase.quality, l: es ? 'calidad' : 'quality' },
  ];

  return (
    <div className="clf">
      <div className="clf-stage">
        <TrayView tray={tray} segments={segs} showOverlay={overlay} height={0} lang={es ? 'es' : 'en'} />

        <div className="clf-badge">
          <div className="clf-badge-t">{st.label}</div>
          <div className="clf-badge-d">{st.text}</div>
        </div>

        <div className="clf-hud">
          {hud.map((h) => (
            <div className="clf-hud-item" key={h.l}>
              <div className={`clf-hud-v${h.tone ? ' ' + h.tone : ''}`}>{h.v}</div>
              <div className="clf-hud-l">{h.l}</div>
            </div>
          ))}
        </div>

        <Link className="clf-exit" to="/">{es ? 'Volver a la app' : 'Back to the app'}</Link>
      </div>

      <aside className="clf-rail">
        <div className="clf-title">{theCase.name ?? theCase.id}</div>
        <div className="clf-sub">{theCase.id} · {theCase.suite}</div>

        <div className="clf-seg">
          <button className={overlay ? 'on' : ''} onClick={() => setOverlay(true)}>{es ? 'Con log' : 'With log'}</button>
          <button className={!overlay ? 'on' : ''} onClick={() => setOverlay(false)}>{es ? 'Imagen sola' : 'Image only'}</button>
        </div>

        <label className="clf-ctl">
          <span className="clf-ctl-l">{es ? 'Umbral de confianza' : 'Confidence threshold'}<b>{conf.toFixed(2)}</b></span>
          <input type="range" min={0.1} max={0.95} step={0.05} value={conf} onChange={(e) => setConf(+e.target.value)} />
        </label>

        <div className="clf-note">
          {es
            ? 'Sube el umbral para ver donde el clasificador deja de comprometerse: los segmentos que caen bajo el umbral son los que un geologo debe revisar. Compara "Con log" e "Imagen sola" para juzgar si el contacto esta donde tu lo pondrias, que es la pregunta que esta herramienta debe responder. El acierto se mide en la matriz de confusion de la App, no aqui.'
            : 'Raise the threshold to see where the classifier stops committing: the segments that fall below it are the ones a geologist should review. Toggle "With log" against "Image only" to judge whether a contact sits where you would put it, which is the question this tool exists to answer. Correctness is measured in the App\\u2019s confusion matrix, not here.'}
        </div>

        <div className="clf-cases">
          {CASES.slice(0, 12).map((c) => (
            <Link key={c.id} to={`/focus/${c.id}`} className={c.id === theCase.id ? 'on' : ''}>{c.id}</Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
