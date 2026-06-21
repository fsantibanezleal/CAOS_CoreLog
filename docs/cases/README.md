# Cases + categories

Each case (`data-pipeline/cllab/cases/core_cases.py`, mirrored in `frontend/src/cv/cases.ts`) declares a **CATEGORY**,
its parameters, an **expected band** (what a domain reader should see), a **validation anchor** (a property the result
MUST satisfy — checked in `frontend/test/contract.test.ts`), and a real|synthetic flag. The **App shows ONE selected
case**; **Experiments/Benchmark show cross-case summaries** (never mixed into the App).

## The 8-case matrix

| id | category | tray | validation anchor |
|---|---|---|---|
| `S-PORPH` | lithology suite | porphyry (granite · schist · ore) | baseline pixel-accuracy > 0.6 (textures separable) |
| `S-SED` | lithology suite | sedimentary (sandstone · limestone) | segments map to monotone depth |
| `S-VOLC` | lithology suite | volcanic (basalt · schist) | schist recovered via its foliation (texture, not just colour) |
| `Q-CLEAN` | image quality | porphyry, even lighting | the reference accuracy band |
| `Q-SHADOW` | image quality | porphyry, shadow gradient | accuracy ≤ the clean case (a known robustness drop) |
| `Q-WET` | image quality | porphyry, wet core | accuracy ≤ the clean case |
| `C-UNIFORM` | oracle control | single lithology (limestone) | **closed-form**: pixel-accuracy > 0.85 on the one class |
| `C-SHARP` | oracle control | two lithologies, sharp cut | **closed-form**: a segment boundary within 20 px of the known cut |

The suites vary the **geology**; the quality cases reuse the porphyry geology and vary the **imaging** (so the
robustness comparison isolates one axis); the controls are the **exactness anchors** (their answer is computable by
hand, so any regression in the classifier/segmentation is caught immediately).
