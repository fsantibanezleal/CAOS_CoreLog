// CONTRACT 2 mirror (frontend side). MUST stay in lock-step with the Python schemas in
// data-pipeline/cllab/core/{trace.py, manifest.py}. A drift here makes `tsc` fail -> the contract is enforced at
// BUILD time (the web cannot ship reading a shape the pipeline does not produce).

// ---------- per-case replay trace (corelog.trace/v1) ----------

export interface SegmentRec {
  channel: number;
  x0: number;
  x1: number;
  litho: string;
  conf: number;
  depthFrom: number;
  depthTo: number;
  ood: boolean;
}

export interface TraySpecRec {
  nChannels: number;
  chWidthPx: number;
  chHeightPx: number;
  depthFromM: number;
  depthToM: number;
  mmPerPx: number;
  seed: number;
  suite: string;
  quality: string;
}

export interface LithoLegendItem { id: string; en: string; es: string; rgb: [number, number, number]; }

export interface LearnedMetrics {
  status: 'trained' | 'pending-training';
  lithoCNN: { acc: number; acc_baseline: number; nEval: number; nTrain?: number; split?: string; classes: string[] } | null;
  ood: { auc: number; nEval: number } | null;
}

export interface CaseTrace {
  schema: string; // "corelog.trace/v1"
  case_id: string;
  name: string;
  category: string;
  real_or_synthetic: string;
  expected_band: string;
  spec: TraySpecRec;
  truth: SegmentRec[];
  baseline: { segments: SegmentRec[]; pixelAccuracy: number; confusion: number[][] };
  strip_log: Array<{ depthFrom: number; depthTo: number; litho: string; conf: number; ood: boolean }>;
  grade_legend: LithoLegendItem[];
  learned: LearnedMetrics;
}

// ---------- manifest (corelog.manifest/v2) + index ----------

export interface ArtifactRef { path: string; format: string; trace_schema: string; bytes: number; }

export interface GateVerdict {
  lane: string;
  client_side: boolean;
  runtimes: string[];
  trace_bytes: number;
  run_ms_budget: number;
  trace_bytes_budget: number;
  reasons: string[];
}

export interface SharedArtifacts {
  models: Array<{ id: string; file: string; opset: number; kind: string }>;
  learned_metrics: string;
  case_results: string;
}

export interface CaseManifest {
  schema: string; // "corelog.manifest/v2"
  case_id: string;
  name: string;
  category: string;
  real_or_synthetic: string;
  expected_band: string;
  validation_anchor: string;
  engine: { package: string; version: string; model: string };
  seed: number;
  shared: SharedArtifacts;
  artifact: ArtifactRef;
  lane: 'live' | 'precompute';
  gate: GateVerdict;
  flags: Array<Record<string, unknown>>;
  metrics: Record<string, number>;
  honesty: string;
}

export interface CaseIndexEntry { case_id: string; category: string; manifest_path: string; }

export interface CaseIndex {
  schema: string; // "corelog.index/v1"
  engine_version: string;
  n_cases: number;
  cases: CaseIndexEntry[];
}

// ---------- the baked case-results.json (corelog.case-results/v1) consumed by the bake + the App ----------

export interface CaseResult {
  name: string;
  category: string;
  suite: string;
  quality: string;
  seed: number;
  realOrSynthetic: string;
  expectedBand: string;
  validationAnchor: string;
  spec: TraySpecRec;
  truth: SegmentRec[];
  baseline: { segments: SegmentRec[]; pixelAccuracy: number; confusion: number[][] };
  stripLog: Array<{ depthFrom: number; depthTo: number; litho: string; conf: number; ood: boolean }>;
  lithoLegend: LithoLegendItem[];
}

export interface CaseResultsFile {
  schema: string; // "corelog.case-results/v1"
  nCases: number;
  cases: Record<string, CaseResult>;
}
