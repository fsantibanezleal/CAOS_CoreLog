"""Stage 1, preprocess (heavy lane): generate the synthetic core trays for the cases by running the SAME TypeScript
generator the browser uses (frontend/src/cv/tray.ts, via tsx). Delegates to the preserved science
`cllab/science/bake_cases.mjs`, invoked by `pipeline.retrain`. No Python re-port of the generator."""
