export const lerp = (start: number, end: number, t: number): number => {
  return start + (end - start) * Math.max(0, Math.min(1, t));
};

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

export const normalizeAngle = (angle: number) => {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
};

export const distance = (x1: number, y1: number, x2: number, y2: number) => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

// Calculate point on a line segment closest to a given point p
export const closestPointOnLine = (lx1: number, ly1: number, lx2: number, ly2: number, px: number, py: number) => {
  const dx = lx2 - lx1;
  const dy = ly2 - ly1;
  const t = ((px - lx1) * dx + (py - ly1) * dy) / (dx * dx + dy * dy);
  
  // Clamped t between 0 and 1 for segment, or unbounded for infinite line
  // We want the infinite line distance usually for drift calculation, but let's clamp for rendering safety
  const tClamped = Math.max(0, Math.min(1, t));
  return {
    x: lx1 + tClamped * dx,
    y: ly1 + tClamped * dy,
    t: tClamped
  };
};

export const getTurnPoint = (
  centerX: number,
  centerY: number,
  radius: number,
  angle: number
) => {
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius
  };
};