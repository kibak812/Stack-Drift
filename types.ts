export enum AppState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  RESULT = 'RESULT'
}

export enum TurnQuality {
  PERFECT = 'PERFECT',
  GOOD = 'GOOD',
  MISS = 'MISS',
  NONE = 'NONE'
}

export interface GameScore {
  score: number;
  highScore: number;
  combo: number;
  coins: number;
  lastQuality: TurnQuality;
  fever: boolean;
  feverTimer: number;
  feverGauge: number; // 0-100, fills up to trigger fever
}

export interface TrackSegment {
  id: number;
  type: 'STRAIGHT' | 'TURN_LEFT' | 'TURN_RIGHT';
  length: number; // Length in pixels/units
  curvature: number; // 0 for straight, higher for tighter turns
  startAngle: number;
  endAngle: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number; // Dynamic width
}

export interface CarState {
  x: number;
  y: number;
  heading: number; // Movement direction
  visualAngle: number; // Car body rotation (drift angle)
  speed: number;
  isDrifting: boolean;
  isCrashed: boolean;
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number; // 0 to 1
  scale: number;
}

export interface SkidMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number; // 0 to 1
}