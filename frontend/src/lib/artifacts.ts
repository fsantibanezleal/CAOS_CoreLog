// Load the committed Contract-2 artifacts (overlaid into public/ by copy-data.mjs). The App runs the CV engine live
// (src/cv) for full reactivity; these baked outputs are the replay fallback + the cross-case data Benchmark/
// Experiments summarise. Paths are relative to the Vite base.
import type { CaseIndex, CaseManifest, CaseResultsFile, CaseTrace } from './contract.types.ts';

const base = () => import.meta.env.BASE_URL || '/';

async function getJSON<T>(rel: string): Promise<T> {
  const r = await fetch(`${base()}${rel}`);
  if (!r.ok) throw new Error(`fetch ${rel} → ${r.status}`);
  return (await r.json()) as T;
}

export interface LearnedFile {
  schema: string;
  lithoCNN: { acc: number; acc_baseline: number; nEval: number; nTrain?: number; split?: string; classes: string[]; confusion?: number[][] };
  ood: { auc: number; nEval: number };
  honesty: string;
}

export interface DetectorMetrics {
  auroc: number; aupr: number; fpr95: number; nId: number; nOod: number;
  family: string; space: string;
}
export interface OodBenchFile {
  schema: string;
  task: string;
  detectors: Record<string, DetectorMetrics>;
  winner: { name: string; auroc: number; reconMseAuroc: number; atBarAuroc085AndLowerFpr95: boolean };
  shippedDetector: DetectorMetrics & { name: string; roc: [number, number][]; hist: { edges: number[]; id: number[]; ood: number[] } };
  reconRoc: [number, number][];
  controls: {
    labelPermutationNullTop1: number; chance: number; nullCollapsedToChance: boolean;
    nonCoreScoresHardest: boolean; nonCoreAllFire: boolean; nearFarMonotonic: boolean;
    idP95Threshold: number; nonCoreMinScore: number; realMaxScore: number;
    nonCoreStrictLithoSpace: boolean; nonCoreStrictWinnerSpace: boolean | null;
    medianId: number; medianOod: number; medianNonCore: number;
  };
  realHead: {
    shipped: string; classesDcid7: string[];
    candidates: Record<string, { top1: number; macroF1: number; confusion: number[][]; nTrain: number; nEval: number; backbone: string }>;
    dcid7ToCorelog: Record<string, string>;
    syntheticHeadNote: string;
  };
  data: { synthTrain: number; synthIdEval: number; dcidTrain: number; dcidTest: number; dedupeDropped: number; split: string };
  realHeadOnnxDim: number;
}

export const loadCaseResults = () => getJSON<CaseResultsFile>('case-results.json');
export const loadLearned = () => getJSON<LearnedFile>('cl-learned.json');
export const loadOodBench = () => getJSON<OodBenchFile>('data/ood-bench.json');
export const loadIndex = () => getJSON<CaseIndex>('data/manifests/index.json');
export const loadManifest = (caseId: string) => getJSON<CaseManifest>(`data/manifests/${caseId}.json`);
export const loadTrace = (caseId: string) => getJSON<CaseTrace>(`data/${caseId}/trace.json`);
