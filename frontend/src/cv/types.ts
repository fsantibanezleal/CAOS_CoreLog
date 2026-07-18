// CoreLog Vision, shared types for the core-tray CV pipeline.
//
// A tray holds `nChannels` parallel core channels stacked vertically; each channel is a horizontal run of core
// covering a depth interval, made of segments of different lithologies along x. The generator renders the RGB image
// and the ground-truth segments, so the classifier + segmentation can be scored against truth (the oracle anchor).

export const LITHOLOGIES = ['granite', 'basalt', 'sandstone', 'limestone', 'schist', 'ore'] as const;
export type Lithology = (typeof LITHOLOGIES)[number];
export const N_LITHO = LITHOLOGIES.length;

/** A human + colour key for each lithology (the strip-log palette; theme-independent rock colours). */
export const LITHO_INFO: Record<Lithology, { en: string; es: string; rgb: [number, number, number] }> = {
  granite: { en: 'Granite', es: 'Granito', rgb: [210, 180, 185] },
  basalt: { en: 'Basalt', es: 'Basalto', rgb: [70, 72, 78] },
  sandstone: { en: 'Sandstone', es: 'Arenisca', rgb: [205, 170, 110] },
  limestone: { en: 'Limestone', es: 'Caliza', rgb: [225, 220, 200] },
  schist: { en: 'Schist', es: 'Esquisto', rgb: [120, 135, 110] },
  ore: { en: 'Ore (sulphide)', es: 'Mineral (sulfuro)', rgb: [95, 80, 60] },
};

export type Suite = 'porphyry' | 'sedimentary' | 'volcanic' | 'uniform' | 'sharp';
export type Quality = 'clean' | 'shadow' | 'wet';

export interface TraySpec {
  id: string;
  nChannels: number;
  chWidthPx: number; // pixels per channel (x = along-core)
  chHeightPx: number; // pixels per channel (y)
  depthFromM: number;
  depthToM: number;
  mmPerPx: number;
  seed: number;
  suite: Suite;
  quality: Quality;
}

/** Any decoded RGBA image (the shared shape the patch extractor needs). A synthetic Tray and a real DCID photo both
 * satisfy it, so the SAME sliding-window classifier runs on both. */
export interface RgbaImage {
  width: number;
  height: number;
  /** RGBA, row-major, length width*height*4 (alpha always 255). */
  rgba: Uint8ClampedArray;
}

/** A rendered tray: the RGB image + the ground-truth segments. */
export interface Tray extends RgbaImage {
  spec: TraySpec;
  /** ground-truth segments (one list per channel, concatenated; each carries its channel). */
  truth: Segment[];
}

export interface Segment {
  channel: number;
  /** along-core pixel span within the channel. */
  x0: number;
  x1: number;
  litho: Lithology;
  /** classifier confidence 0..1 (1 for ground truth). */
  conf: number;
  depthFrom: number;
  depthTo: number;
  /** true if flagged out-of-distribution / no-recovery (the OOD head). */
  ood?: boolean;
}

/** A classifier maps a patch (flat RGB, length 3*P*P in [0,1], row-major) to class logits/probs over LITHOLOGIES. */
export type PatchClassifier = (patchRGB: Float32Array) => Float32Array;

export const PATCH = 24; // patch size in px (square), the CNN input is [1,3,PATCH,PATCH]
