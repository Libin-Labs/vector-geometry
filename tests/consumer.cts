import geometry = require('@lp-labs/vector-geometry');

const start: geometry.Point = { x: 0, y: 0 };
const end: geometry.Point = { x: 2, y: 3 };
const line: geometry.Line = { start, end };
const rect: geometry.Rect = geometry.lineBounds(line);
console.log(geometry.lineLength(line), rect);
