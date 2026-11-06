# @lp-labs/vector-geometry

Bounded utilities for two-dimensional lines, polylines, and quadratic and cubic Bezier curves. The
package computes lengths and bounds, evaluates curve points, flattens curves to a requested
flatness tolerance, and checks segment intersections.

## Install

```sh
npm install @lp-labs/vector-geometry
```

```js
import { cubicBounds, flattenCubic, lineLength } from '@lp-labs/vector-geometry';

const curve = {
  start: { x: 0, y: 0 },
  control1: { x: 0, y: 12 },
  control2: { x: 12, y: 12 },
  end: { x: 12, y: 0 },
};
console.log(cubicBounds(curve));
console.log(flattenCubic(curve, { tolerance: 0.25 }).length);
console.log(lineLength({ start: curve.start, end: curve.end }));
```

## API and types

- `distance(first, second)` and `lineLength(line)` measure Euclidean distance.
- `polylineLength(polyline)` sums consecutive line segments; fewer than two points have length zero.
- `lineBounds(line)`, `polylineBounds(polyline)`, `quadraticBounds(curve)`, and `cubicBounds(curve)`
  return axis-aligned bounds; an empty polyline has no bounds (`undefined`).
- `pointOnQuadratic(curve, t)` and `pointOnCubic(curve, t)` evaluate a curve for `0 <= t <= 1`.
- `flattenQuadratic(curve, options?)` and `flattenCubic(curve, options?)` return endpoints and
  intermediate points approximating the curve within the requested control-to-chord tolerance.
  `FlattenOptions` accepts a positive `tolerance` (default `0.5`) and `maxDepth` (default `12`,
  maximum `20`).
- `segmentsIntersect(first, second, tolerance?)` checks closed line segments, including endpoint
  contact and collinear overlap; tolerance defaults to `1e-9`.
- Exported types: `Point`, `Rect`, `Line`, `Polyline`, `QuadraticBezier`, `CubicBezier`, and
  `FlattenOptions`.

Inputs must be finite and coordinates are limited to ±1e12. Polylines are limited to 100,000
points. Flattening throws `RangeError` if the depth limit is reached before the tolerance; lower
the requested tolerance pressure or increase `maxDepth` within the limit. Invalid shape inputs
throw `TypeError`; out-of-range numbers and options throw `RangeError`.

This is deliberately not a polygon-boolean or general path-topology library. It does not claim
robust polygon union, clipping, offsetting, arbitrary path intersection, arc support, or exact
predicates for ill-conditioned floating-point geometry. Bezier bounds use floating-point roots.

## Module formats and customization

The package provides ESM, CommonJS (`require('@lp-labs/vector-geometry')`), and TypeScript
declarations. Import only the operations your application needs; build larger path or polygon
algorithms on top of the explicit primitives here. There are no runtime or peer dependencies;
TypeScript and Prettier are development-only.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
