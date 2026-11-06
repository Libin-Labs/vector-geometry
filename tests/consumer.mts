import {
  cubicBounds,
  distance,
  flattenCubic,
  flattenQuadratic,
  lineBounds,
  lineLength,
  pointOnCubic,
  pointOnQuadratic,
  polylineBounds,
  polylineLength,
  quadraticBounds,
  segmentsIntersect,
  type CubicBezier,
  type FlattenOptions,
  type Line,
  type Point,
  type Polyline,
  type QuadraticBezier,
  type Rect,
} from '@lp-labs/vector-geometry';

const a: Point = { x: 0, y: 0 };
const b: Point = { x: 1, y: 1 };
const line: Line = { start: a, end: b };
const polyline: Polyline = { points: [a, b] };
const quadratic: QuadraticBezier = { start: a, control: b, end: a };
const cubic: CubicBezier = { start: a, control1: b, control2: b, end: a };
const options: FlattenOptions = { tolerance: 0.1 };
const rect: Rect = lineBounds(line);
console.log(
  distance(a, b),
  lineLength(line),
  polylineLength(polyline),
  polylineBounds(polyline),
  quadraticBounds(quadratic),
  cubicBounds(cubic),
  pointOnQuadratic(quadratic, 0.5),
  pointOnCubic(cubic, 0.5),
  flattenQuadratic(quadratic, options),
  flattenCubic(cubic, options),
  segmentsIntersect(line, line),
  rect,
);
