import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from '../dist/esm/index.js';

const require = createRequire(import.meta.url);
const cjs = require('../dist/cjs/index.js');

test('ESM and CommonJS surfaces agree', () => {
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
});

test('line and polyline length and bounds handle empty and singleton inputs', () => {
  const line = { start: { x: 3, y: 4 }, end: { x: 0, y: 0 } };
  assert.equal(esm.lineLength(line), 5);
  assert.deepEqual(esm.lineBounds(line), { x: 0, y: 0, width: 3, height: 4 });
  assert.equal(esm.polylineLength({ points: [] }), 0);
  assert.equal(esm.polylineBounds({ points: [] }), undefined);
  assert.equal(esm.polylineLength({ points: [{ x: 2, y: -3 }] }), 0);
  assert.deepEqual(esm.polylineBounds({ points: [{ x: 2, y: -3 }] }), {
    x: 2,
    y: -3,
    width: 0,
    height: 0,
  });
});

test('Bezier bounds contain deterministic sampled curve points', () => {
  let seed = 41;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed / 2147483647) * 20 - 10;
  };
  for (let trial = 0; trial < 80; trial += 1) {
    const quadratic = {
      start: { x: random(), y: random() },
      control: { x: random(), y: random() },
      end: { x: random(), y: random() },
    };
    const cubic = {
      start: { x: random(), y: random() },
      control1: { x: random(), y: random() },
      control2: { x: random(), y: random() },
      end: { x: random(), y: random() },
    };
    for (const [curve, bounds, at] of [
      [quadratic, esm.quadraticBounds(quadratic), (t) => esm.pointOnQuadratic(quadratic, t)],
      [cubic, esm.cubicBounds(cubic), (t) => esm.pointOnCubic(cubic, t)],
    ]) {
      for (let sample = 0; sample <= 100; sample += 1) {
        const point = at(sample / 100);
        assert.ok(point.x >= bounds.x - 1e-8 && point.x <= bounds.x + bounds.width + 1e-8);
        assert.ok(point.y >= bounds.y - 1e-8 && point.y <= bounds.y + bounds.height + 1e-8);
      }
    }
  }
});

test('flattening preserves endpoints and stays within error tolerance on generated curves', () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 10;
  for (let trial = 0; trial < 30; trial += 1) {
    const curve = {
      start: { x: random(), y: random() },
      control1: { x: random(), y: random() },
      control2: { x: random(), y: random() },
      end: { x: random(), y: random() },
    };
    const tolerance = 0.3;
    const points = esm.flattenCubic(curve, { tolerance });
    assert.deepEqual(points[0], curve.start);
    assert.deepEqual(points.at(-1), curve.end);
    const distanceToSegment = (p, a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length2 = dx * dx + dy * dy;
      const t =
        length2 === 0
          ? 0
          : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    };
    for (let sample = 0; sample <= 500; sample += 1) {
      const p = esm.pointOnCubic(curve, sample / 500);
      const nearest = Math.min(
        ...points.slice(1).map((next, index) => distanceToSegment(p, points[index], next)),
      );
      assert.ok(nearest <= tolerance + 1e-6);
    }
  }
});

test('segment intersection handles crossings, touching, disjoint and collinear segments', () => {
  const line = (x1, y1, x2, y2) => ({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  });
  assert.equal(esm.segmentsIntersect(line(0, 0, 4, 4), line(0, 4, 4, 0)), true);
  assert.equal(esm.segmentsIntersect(line(0, 0, 1, 0), line(1, 0, 1, 3)), true);
  assert.equal(esm.segmentsIntersect(line(0, 0, 1, 0), line(2, 0, 3, 0)), false);
  assert.equal(esm.segmentsIntersect(line(0, 0, 3, 0), line(1, 0, 4, 0)), true);
  assert.throws(() => esm.segmentsIntersect(line(0, 0, 1, 1), line(0, 1, 1, 0), -1), RangeError);
});

test('point evaluation and flattening reject malformed inputs and bounded-work overflow', () => {
  const curve = {
    start: { x: 0, y: 0 },
    control: { x: 1, y: 2 },
    end: { x: 2, y: 0 },
  };
  assert.throws(() => esm.pointOnQuadratic(curve, 1.1), RangeError);
  assert.throws(() => esm.pointOnQuadratic({ ...curve, control: null }, 0.5), TypeError);
  assert.throws(
    () =>
      esm.pointOnCubic(
        { start: curve.start, control1: curve.control, control2: curve.control, end: curve.end },
        NaN,
      ),
    RangeError,
  );
  assert.throws(() => esm.distance({ x: Infinity, y: 0 }, { x: 0, y: 0 }), RangeError);
  assert.throws(() => esm.flattenQuadratic(curve, { tolerance: 0 }), RangeError);
  assert.throws(() => esm.flattenQuadratic(curve, { maxDepth: 21 }), RangeError);
  assert.throws(
    () =>
      esm.flattenQuadratic(
        {
          start: { x: 0, y: 0 },
          control: { x: 0, y: 1e12 },
          end: { x: 1, y: 0 },
        },
        { tolerance: 1e-10, maxDepth: 1 },
      ),
    RangeError,
  );
});
