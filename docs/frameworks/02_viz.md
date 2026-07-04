# Framework, the visualisation stack

CoreLog uses one renderer per data type (per the CAOS interactive-visualisation rubric), all interactive and theme-
aware where appropriate.

| Renderer | Where | What it draws |
|---|---|---|
| **canvas** (`viz/TrayView.tsx`) | the App's Tray tab | the tray image (scaled via an offscreen canvas) + the live segmentation overlay: a per-segment lithology tint (alpha ∝ confidence), a solid prediction bar under each channel, boundary lines, an OOD hatch; hover reads channel · lithology · confidence · depth. |
| **SVG** (`viz/StripLog.tsx`) | the strip-log | a vertical depth column coloured by lithology (opacity ∝ confidence), OOD bands hatched, depth ticks; hover reads the band. |
| **HTML table** (`viz/ConfusionMatrix.tsx`) | per-case + aggregate | a normalised confusion matrix (truth × predicted), the diagonal shaded green (recall), off-diagonal red. |
| **`@fasl-work/caos-app-shell`** | the whole app | the shared header/nav/theme/language chrome + the doc-kit (Tabs, Callout, Equation/KaTeX, Figure, Cite). This is what makes every Faena app a visual sibling. |

The rock colours are **physical** (theme-independent) so the lithology palette reads the same in light and dark; the
chrome + the depth axis follow the theme tokens. Every panel **reacts to the case selector** + the live segmentation;
aggregate/cross-case views (the aggregate confusion matrix, accuracy-by-quality, CNN-vs-baseline) live in
**Benchmark/Experiments**, never in the App (per the design rule).
