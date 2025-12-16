/**
 * Canvas rendering utility functions
 */

import { CAR_DIMS } from '../constants';
import { CarVisualConfig } from '../types';
import { lightenColor, hexToRgbString } from './colors';

/**
 * Draw a rounded rectangle path
 */
export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draw a single wheel
 */
export function drawWheel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
): void {
  const { wheelLength, wheelWidth } = CAR_DIMS;
  ctx.fillStyle = color;
  ctx.beginPath();
  roundedRect(ctx, x - wheelLength / 2, y - wheelWidth / 2, wheelLength, wheelWidth, 1);
  ctx.fill();
}

/**
 * Create body gradient for car
 */
export function createBodyGradient(
  ctx: CanvasRenderingContext2D,
  config: CarVisualConfig
): CanvasGradient {
  const { bodyLength, bodyWidth } = CAR_DIMS;
  const gradient = ctx.createLinearGradient(
    -bodyLength / 2, 0,
    bodyLength / 2, 0
  );
  gradient.addColorStop(0, config.bodySecondaryColor);
  gradient.addColorStop(0.3, config.bodyColor);
  gradient.addColorStop(0.7, config.bodyColor);
  gradient.addColorStop(1, config.bodySecondaryColor);
  return gradient;
}

/**
 * Draw enhanced car with details
 */
export function drawEnhancedCar(
  ctx: CanvasRenderingContext2D,
  config: CarVisualConfig,
  isDrifting: boolean,
  isFever: boolean,
  feverGauge: number,
  gameTime: number
): void {
  const {
    bodyLength,
    bodyWidth,
    cornerRadius,
    wheelOffset,
    cockpitLength,
    cockpitWidth,
    cockpitOffset,
    headlightRadius,
    headlightOffset,
  } = CAR_DIMS;

  // 1. Draw wheels (below body layer)
  drawWheel(ctx, -wheelOffset.x, -wheelOffset.y, config.wheelColor); // Rear left
  drawWheel(ctx, -wheelOffset.x, wheelOffset.y, config.wheelColor);  // Rear right
  drawWheel(ctx, wheelOffset.x, -wheelOffset.y, config.wheelColor);  // Front left
  drawWheel(ctx, wheelOffset.x, wheelOffset.y, config.wheelColor);   // Front right

  // 2. Draw car body (rounded rectangle with gradient)
  ctx.beginPath();
  roundedRect(ctx, -bodyLength / 2, -bodyWidth / 2, bodyLength, bodyWidth, cornerRadius);
  ctx.fillStyle = createBodyGradient(ctx, config);
  ctx.fill();

  // Body highlight (subtle top edge)
  ctx.strokeStyle = lightenColor(config.bodyColor, 0.3);
  ctx.lineWidth = 1;
  ctx.stroke();

  // 3. Draw cockpit (darker rounded rectangle)
  ctx.beginPath();
  roundedRect(
    ctx,
    cockpitOffset - cockpitLength / 2,
    -cockpitWidth / 2,
    cockpitLength,
    cockpitWidth,
    3
  );
  ctx.fillStyle = config.cockpitColor;
  ctx.fill();

  // Cockpit reflection
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 4. Draw headlights
  const headlightY = 4;
  ctx.fillStyle = config.headlightColor;

  // Left headlight
  ctx.beginPath();
  ctx.arc(headlightOffset, -headlightY, headlightRadius, 0, Math.PI * 2);
  ctx.fill();

  // Right headlight
  ctx.beginPath();
  ctx.arc(headlightOffset, headlightY, headlightRadius, 0, Math.PI * 2);
  ctx.fill();

  // 5. Drift glow effects
  if (isDrifting) {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = isFever ? '#f0f' : config.glowColor;

    // Rear glow circles
    ctx.fillStyle = isFever
      ? 'rgba(240, 0, 255, 0.4)'
      : `rgba(${hexToRgbString(config.glowColor)}, 0.4)`;

    ctx.beginPath();
    ctx.arc(-wheelOffset.x - 5, -wheelOffset.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-wheelOffset.x - 5, wheelOffset.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 6. Fever gauge bar (on car's left side)
  drawFeverGauge(ctx, feverGauge, isFever, gameTime);
}

/**
 * Draw fever gauge on car
 */
function drawFeverGauge(
  ctx: CanvasRenderingContext2D,
  feverGauge: number,
  isFever: boolean,
  gameTime: number
): void {
  const gaugeHeight = 40;
  const gaugeWidth = 4;
  const gaugeX = -22; // More spacing from car body
  const gaugeY = -gaugeHeight / 2;

  // Background
  ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.beginPath();
  roundedRect(ctx, gaugeX - gaugeWidth / 2, gaugeY, gaugeWidth, gaugeHeight, 2);
  ctx.fill();

  if (isFever) {
    // Pulsing full bar in fever mode
    const pulse = 0.8 + Math.sin(gameTime * 10) * 0.2;
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ec4899';
    ctx.fillStyle = `rgba(236, 72, 153, ${pulse})`;
    ctx.beginPath();
    roundedRect(ctx, gaugeX - gaugeWidth / 2, gaugeY, gaugeWidth, gaugeHeight, 2);
    ctx.fill();
    ctx.restore();
  } else if (feverGauge > 0) {
    // Fill bar from left to right (top to bottom in local coords)
    const fillHeight = (feverGauge / 100) * gaugeHeight;
    const gradient = ctx.createLinearGradient(gaugeX, gaugeY, gaugeX, gaugeY + gaugeHeight);
    gradient.addColorStop(0, '#a855f7'); // purple-500
    gradient.addColorStop(1, '#ec4899'); // pink-500

    ctx.fillStyle = gradient;
    ctx.beginPath();
    roundedRect(
      ctx,
      gaugeX - gaugeWidth / 2,
      gaugeY,
      gaugeWidth,
      fillHeight,
      2
    );
    ctx.fill();

    // Glow effect when gauge is high
    if (feverGauge > 70) {
      ctx.save();
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ec4899';
      ctx.fill();
      ctx.restore();
    }
  }
}
