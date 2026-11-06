export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Line {
  start: Point;
  end: Point;
}

export interface Polyline {
  points: readonly Point[];
}

export interface QuadraticBezier {
  start: Point;
  control: Point;
  end: Point;
}

export interface CubicBezier {
  start: Point;
  control1: Point;
  control2: Point;
  end: Point;
}

export interface FlattenOptions {
  tolerance?: number;
  maxDepth?: number;
}

const COORDINATE_LIMIT = 1e12;
const MAX_POLYLINE_POINTS = 100_000;
const MAX_FLATTEN_DEPTH = 20;

function point(value: Point, label = 'Point'): Point {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} must be a point.`);
  finite(value.x, `${label} x`);
  finite(value.y, `${label} y`);
  return { x: value.x, y: value.y };
}

function finite(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > COORDINATE_LIMIT) {
    throw new RangeError(`${label} must be finite and within ±${COORDINATE_LIMIT}.`);
  }
}

function nonnegative(value: number, label: string): void {
  finite(value, label);
  if (value < 0) throw new RangeError(`${label} must be nonnegative.`);
}

function quadraticAt(curve: QuadraticBezier, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * curve.start.x + 2 * u * t * curve.control.x + t * t * curve.end.x,
    y: u * u * curve.start.y + 2 * u * t * curve.control.y + t * t * curve.end.y,
  };
}

function cubicAt(curve: CubicBezier, t: number): Point {
  const u = 1 - t;
  return {
    x:
      u ** 3 * curve.start.x +
      3 * u * u * t * curve.control1.x +
      3 * u * t * t * curve.control2.x +
      t ** 3 * curve.end.x,
    y:
      u ** 3 * curve.start.y +
      3 * u * u * t * curve.control1.y +
      3 * u * t * t * curve.control2.y +
      t ** 3 * curve.end.y,
  };
}

function includeQuadraticExtremum(
  values: number[],
  start: number,
  control: number,
  end: number,
): void {
  const denominator = start - 2 * control + end;
  if (denominator === 0) return;
  const t = (start - control) / denominator;
  if (t > 0 && t < 1) {
    const u = 1 - t;
    values.push(u * u * start + 2 * u * t * control + t * t * end);
  }
}

function cubicExtrema(start: number, first: number, second: number, end: number): number[] {
  const a = -start + 3 * first - 3 * second + end;
  const b = 2 * (start - 2 * first + second);
  const c = first - start;
  const roots: number[] = [];
  if (Math.abs(a) < Number.EPSILON) {
    if (b !== 0) roots.push(-c / b);
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      roots.push((-b - root) / (2 * a), (-b + root) / (2 * a));
    }
  }
  return roots.filter((t) => t > 0 && t < 1);
}

function cubicCoordinate(
  start: number,
  first: number,
  second: number,
  end: number,
  t: number,
): number {
  const u = 1 - t;
  return u ** 3 * start + 3 * u * u * t * first + 3 * u * t * t * second + t ** 3 * end;
}

function distanceToSegment(value: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(value.x - start.x, value.y - start.y);
  const projection = Math.max(
    0,
    Math.min(1, ((value.x - start.x) * dx + (value.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(value.x - (start.x + projection * dx), value.y - (start.y + projection * dy));
}

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function distance(first: Point, second: Point): number {
  const a = point(first, 'First point');
  const b = point(second, 'Second point');
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lineLength(line: Line): number {
  if (!line || typeof line !== 'object') throw new TypeError('A line is required.');
  return distance(line.start, line.end);
}

export function polylineLength(polyline: Polyline): number {
  if (!polyline || !Array.isArray(polyline.points))
    throw new TypeError('Polyline points are required.');
  if (polyline.points.length > MAX_POLYLINE_POINTS)
    throw new RangeError('Polyline point limit exceeded.');
  let total = 0;
  for (let index = 1; index < polyline.points.length; index += 1) {
    total += distance(polyline.points[index - 1]!, polyline.points[index]!);
    finite(total, 'Polyline length');
  }
  return total;
}

export function lineBounds(line: Line): Rect {
  if (!line || typeof line !== 'object') throw new TypeError('A line is required.');
  const start = point(line.start, 'Line start');
  const end = point(line.end, 'Line end');
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  };
}

export function polylineBounds(polyline: Polyline): Rect | undefined {
  if (!polyline || !Array.isArray(polyline.points))
    throw new TypeError('Polyline points are required.');
  if (polyline.points.length > MAX_POLYLINE_POINTS)
    throw new RangeError('Polyline point limit exceeded.');
  if (polyline.points.length === 0) return undefined;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const entry of polyline.points) {
    const value = point(entry);
    minX = Math.min(minX, value.x);
    minY = Math.min(minY, value.y);
    maxX = Math.max(maxX, value.x);
    maxY = Math.max(maxY, value.y);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function quadraticBounds(curve: QuadraticBezier): Rect {
  const start = point(curve.start, 'Curve start');
  const control = point(curve.control, 'Curve control');
  const end = point(curve.end, 'Curve end');
  const xs = [start.x, end.x];
  const ys = [start.y, end.y];
  includeQuadraticExtremum(xs, start.x, control.x, end.x);
  includeQuadraticExtremum(ys, start.y, control.y, end.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function cubicBounds(curve: CubicBezier): Rect {
  const start = point(curve.start, 'Curve start');
  const first = point(curve.control1, 'First control');
  const second = point(curve.control2, 'Second control');
  const end = point(curve.end, 'Curve end');
  const xs = [start.x, end.x];
  const ys = [start.y, end.y];
  for (const t of cubicExtrema(start.x, first.x, second.x, end.x)) {
    xs.push(cubicCoordinate(start.x, first.x, second.x, end.x, t));
  }
  for (const t of cubicExtrema(start.y, first.y, second.y, end.y)) {
    ys.push(cubicCoordinate(start.y, first.y, second.y, end.y, t));
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function flattenQuadratic(curve: QuadraticBezier, options: FlattenOptions = {}): Point[] {
  const normalized: QuadraticBezier = {
    start: point(curve.start, 'Curve start'),
    control: point(curve.control, 'Curve control'),
    end: point(curve.end, 'Curve end'),
  };
  const tolerance = options.tolerance ?? 0.5;
  const maxDepth = options.maxDepth ?? 12;
  finite(tolerance, 'Tolerance');
  if (tolerance <= 0) throw new RangeError('Tolerance must be positive.');
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > MAX_FLATTEN_DEPTH) {
    throw new RangeError(`maxDepth must be from 1 to ${MAX_FLATTEN_DEPTH}.`);
  }
  const output = [normalized.start];
  const visit = (start: Point, control: Point, end: Point, depth: number): void => {
    if (distanceToSegment(control, start, end) <= tolerance) {
      output.push(end);
      return;
    }
    if (depth >= maxDepth)
      throw new RangeError('Curve flattening depth limit reached before tolerance.');
    const left = midpoint(start, control);
    const right = midpoint(control, end);
    const center = midpoint(left, right);
    visit(start, left, center, depth + 1);
    visit(center, right, end, depth + 1);
  };
  visit(normalized.start, normalized.control, normalized.end, 0);
  return output;
}

export function flattenCubic(curve: CubicBezier, options: FlattenOptions = {}): Point[] {
  const normalized: CubicBezier = {
    start: point(curve.start, 'Curve start'),
    control1: point(curve.control1, 'First control'),
    control2: point(curve.control2, 'Second control'),
    end: point(curve.end, 'Curve end'),
  };
  const tolerance = options.tolerance ?? 0.5;
  const maxDepth = options.maxDepth ?? 12;
  finite(tolerance, 'Tolerance');
  if (tolerance <= 0) throw new RangeError('Tolerance must be positive.');
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > MAX_FLATTEN_DEPTH) {
    throw new RangeError(`maxDepth must be from 1 to ${MAX_FLATTEN_DEPTH}.`);
  }
  const output = [normalized.start];
  const visit = (start: Point, first: Point, second: Point, end: Point, depth: number): void => {
    if (
      Math.max(distanceToSegment(first, start, end), distanceToSegment(second, start, end)) <=
      tolerance
    ) {
      output.push(end);
      return;
    }
    if (depth >= maxDepth)
      throw new RangeError('Curve flattening depth limit reached before tolerance.');
    const a = midpoint(start, first);
    const b = midpoint(first, second);
    const c = midpoint(second, end);
    const d = midpoint(a, b);
    const e = midpoint(b, c);
    const center = midpoint(d, e);
    visit(start, a, d, center, depth + 1);
    visit(center, e, c, end, depth + 1);
  };
  visit(normalized.start, normalized.control1, normalized.control2, normalized.end, 0);
  return output;
}

export function pointOnQuadratic(curve: QuadraticBezier, t: number): Point {
  finite(t, 'Parameter');
  if (t < 0 || t > 1) throw new RangeError('Parameter must be between 0 and 1.');
  return quadraticAt(
    {
      start: point(curve.start, 'Curve start'),
      control: point(curve.control, 'Curve control'),
      end: point(curve.end, 'Curve end'),
    },
    t,
  );
}

export function pointOnCubic(curve: CubicBezier, t: number): Point {
  finite(t, 'Parameter');
  if (t < 0 || t > 1) throw new RangeError('Parameter must be between 0 and 1.');
  return cubicAt(
    {
      start: point(curve.start, 'Curve start'),
      control1: point(curve.control1, 'First control'),
      control2: point(curve.control2, 'Second control'),
      end: point(curve.end, 'Curve end'),
    },
    t,
  );
}

export function segmentsIntersect(first: Line, second: Line, tolerance = 1e-9): boolean {
  if (!first || !second) throw new TypeError('Two line segments are required.');
  nonnegative(tolerance, 'Tolerance');
  const a = point(first.start);
  const b = point(first.end);
  const c = point(second.start);
  const d = point(second.end);
  const cross = (p: Point, q: Point, r: Point): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (p: Point, q: Point, r: Point): boolean =>
    r.x >= Math.min(p.x, q.x) - tolerance &&
    r.x <= Math.max(p.x, q.x) + tolerance &&
    r.y >= Math.min(p.y, q.y) - tolerance &&
    r.y <= Math.max(p.y, q.y) + tolerance;
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  const abTolerance = tolerance * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  const cdTolerance = tolerance * Math.max(1, Math.hypot(d.x - c.x, d.y - c.y));
  if (
    ((abC > abTolerance && abD < -abTolerance) || (abC < -abTolerance && abD > abTolerance)) &&
    ((cdA > cdTolerance && cdB < -cdTolerance) || (cdA < -cdTolerance && cdB > cdTolerance))
  ) {
    return true;
  }
  return (
    (Math.abs(abC) <= abTolerance && onSegment(a, b, c)) ||
    (Math.abs(abD) <= abTolerance && onSegment(a, b, d)) ||
    (Math.abs(cdA) <= cdTolerance && onSegment(c, d, a)) ||
    (Math.abs(cdB) <= cdTolerance && onSegment(c, d, b))
  );
}
