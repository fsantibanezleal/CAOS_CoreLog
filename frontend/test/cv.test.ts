// CV engine correctness, run with: node --import tsx --test test/cv.test.ts
//
// The science is pinned against the generator's own ground truth: the UNIFORM oracle (a single-lithology tray must
// classify as that lithology), the SHARP oracle (the run-merge must recover the known boundary), determinism, and
// baseline separability (the textures must be distinct enough that the classical classifier scores well, leaving
// headroom for the CNN).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyTray,
  LITHOLOGIES,
  makeBaselineClassifier,
  makeTray,
  scoreVsTruth,
  type TraySpec,
} from '../src/cv/index.ts';

const baseClf = makeBaselineClassifier(7);
const spec = (over: Partial<TraySpec>): TraySpec => ({
  id: 't', nChannels: 3, chWidthPx: 320, chHeightPx: 40, depthFromM: 100, depthToM: 130,
  mmPerPx: 1, seed: 42, suite: 'porphyry', quality: 'clean', ...over,
});

test('tray generation is deterministic for a fixed seed', () => {
  const a = makeTray(spec({ suite: 'sedimentary', seed: 11 }));
  const b = makeTray(spec({ suite: 'sedimentary', seed: 11 }));
  assert.deepEqual(Array.from(a.rgba.slice(0, 4000)), Array.from(b.rgba.slice(0, 4000)));
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
});

test('UNIFORM oracle: a single-lithology tray classifies as that lithology', () => {
  const tray = makeTray(spec({ suite: 'uniform', nChannels: 2 }));
  assert.ok(tray.truth.every((s) => s.litho === 'limestone'), 'the uniform suite is limestone');
  const pred = classifyTray(tray, baseClf, { stride: 8 });
  const score = scoreVsTruth(tray, pred);
  assert.ok(score.pixelAccuracy > 0.85, `uniform accuracy should be high (got ${score.pixelAccuracy.toFixed(2)})`);
});

test('SHARP oracle: the run-merge recovers the known boundary', () => {
  const tray = makeTray(spec({ suite: 'sharp', nChannels: 1, chWidthPx: 320 }));
  // ground truth: exactly two segments with a sharp cut
  const truth = tray.truth.filter((s) => s.channel === 0);
  assert.equal(truth.length, 2);
  const cut = truth[0].x1;
  const pred = classifyTray(tray, baseClf, { stride: 6 }).filter((s) => s.channel === 0);
  // a dominant boundary near `cut` must exist (within 20 px)
  const boundaries = pred.slice(1).map((s) => s.x0);
  const near = boundaries.some((b) => Math.abs(b - cut) < 20);
  assert.ok(near, `expected a segment boundary near ${cut}, got [${boundaries.join(',')}]`);
  // the two true lithologies are both predicted somewhere
  const lithos = new Set(pred.map((s) => s.litho));
  assert.ok(lithos.has('sandstone') && lithos.has('basalt'), `expected sandstone+basalt, got ${[...lithos].join(',')}`);
});

test('baseline separability: the classical classifier scores well on a mixed suite', () => {
  const tray = makeTray(spec({ suite: 'porphyry', nChannels: 4, seed: 3 }));
  const pred = classifyTray(tray, baseClf, { stride: 6 });
  const score = scoreVsTruth(tray, pred);
  assert.ok(score.pixelAccuracy > 0.6, `textures must be separable (baseline got ${score.pixelAccuracy.toFixed(2)})`);
  assert.equal(score.confusion.length, LITHOLOGIES.length);
});
