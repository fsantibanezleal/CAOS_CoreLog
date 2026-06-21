import { LITHO_INFO, LITHOLOGIES, type Lithology } from '../cv/types.ts';

/** A normalised confusion matrix (truth rows × predicted cols), cell shaded by row-fraction. The diagonal is the
 * per-class recall; off-diagonal cells are the confusions. */
export function ConfusionMatrix({ confusion, lang = 'en' }: { confusion: number[][]; lang?: 'en' | 'es' }) {
  const K = LITHOLOGIES.length;
  const rowSum = confusion.map((r) => r.reduce((a, b) => a + b, 0) || 1);
  const short = (l: Lithology) => (lang === 'es' ? LITHO_INFO[l].es : LITHO_INFO[l].en).slice(0, 4);
  return (
    <table className="cl-confusion">
      <thead>
        <tr>
          <th />
          {LITHOLOGIES.map((l) => <th key={l} title={LITHO_INFO[l].en}>{short(l)}</th>)}
        </tr>
      </thead>
      <tbody>
        {LITHOLOGIES.map((tl, i) => (
          <tr key={tl}>
            <th title={LITHO_INFO[tl].en}>{short(tl)}</th>
            {Array.from({ length: K }, (_, j) => {
              const frac = confusion[i][j] / rowSum[i];
              const diag = i === j;
              return (
                <td key={j} title={`${confusion[i][j]}`}
                    style={{ background: diag ? `rgba(63,185,80,${frac})` : `rgba(248,81,73,${frac})`,
                             color: frac > 0.55 ? '#fff' : 'var(--color-fg-subtle)' }}>
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
