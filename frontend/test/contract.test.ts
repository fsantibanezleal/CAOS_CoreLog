// CONTRACT 2 (frontend side), the baked case-results.json must conform to the TS mirror and carry the invariants the
// App relies on. Run with: node --import tsx --test test/contract.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { CaseResultsFile } from '../src/lib/contract.types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const data: CaseResultsFile = JSON.parse(
  readFileSync(resolve(HERE, '../../data/derived/case-results.json'), 'utf-8'),
);

test('case-results.json has the expected schema + all 8 cases', () => {
  assert.equal(data.schema, 'corelog.case-results/v1');
  assert.equal(data.nCases, 8);
  for (const id of ['S-PORPH', 'S-SED', 'S-VOLC', 'Q-CLEAN', 'Q-SHADOW', 'Q-WET', 'C-UNIFORM', 'C-SHARP']) {
    assert.ok(data.cases[id], `missing case ${id}`);
  }
});

test('the UNIFORM oracle is a single lithology, baseline near-perfect', () => {
  const c = data.cases['C-UNIFORM'];
  assert.ok(c.baseline.pixelAccuracy > 0.85);
  assert.ok(c.truth.every((s) => s.litho === 'limestone'));
});

test('the SHARP oracle truth has exactly two segments', () => {
  const c = data.cases['C-SHARP'];
  assert.equal(c.truth.length, 2);
  assert.notEqual(c.truth[0].litho, c.truth[1].litho);
});

test('image-quality robustness: clean ≥ shadow ≥ wet (baseline degrades with quality)', () => {
  const a = (id: string) => data.cases[id].baseline.pixelAccuracy;
  assert.ok(a('Q-CLEAN') >= a('Q-SHADOW'), 'clean ≥ shadow');
  assert.ok(a('Q-CLEAN') >= a('Q-WET'), 'clean ≥ wet');
});

test('every strip-log band maps to a known lithology + monotone depth', () => {
  for (const [id, c] of Object.entries(data.cases)) {
    const ids = new Set(c.lithoLegend.map((l) => l.id));
    for (const band of c.stripLog) {
      assert.ok(ids.has(band.litho), `${id}: unknown lithology ${band.litho}`);
      assert.ok(band.depthTo >= band.depthFrom, `${id}: inverted band depth`);
    }
  }
});
