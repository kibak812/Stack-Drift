// PRD Section 4.3 & 5.1
export const GAME_CONSTANTS = {
  // Physics & Tuning
  BASE_SPEED: 400, // Pixels per second
  MAX_SPEED: 850,
  SPEED_INCREASE_RATE: 0.5,
  
  // Drift Feel - Tuned for balanced inertia (Issue 3 fix)
  MAX_TURN_STRENGTH: 3.5, // Max radians per second
  TURN_RATE_ATTACK: 3.8, // Smoother entry for buttery feel
  TURN_RATE_RELEASE: 7.0, // Slightly slower recovery for smoothness
  DRIFT_ANGLE_OFFSET: 0.5, // Visual car rotation when drifting
  
  // Track Generation
  TRACK_WIDTH_START: 260, // Start very wide
  TRACK_WIDTH_END: 140,   // End narrow
  TRACK_NARROWING_RATE: 0.8, // Pixels smaller per segment
  TRACK_GENERATION_BUFFER: 8, // Minimal buffer ahead
  RENDER_WINDOW_SIZE: 16, // Segments ahead/behind to keep fully opaque
  
  SEGMENT_LENGTH_STRAIGHT: 300,
  SEGMENT_RADIUS_TURN: 300, // Base radius (kept for compatibility)

  // Dynamic Curvature System (score-based)
  SEGMENT_RADIUS_MIN: 200,    // Tight turn (harder)
  SEGMENT_RADIUS_MAX: 350,    // Wide turn (easier)
  TIGHT_TURN_START_SCORE: 1000,   // Score when tight turns start appearing
  TIGHT_TURN_FULL_SCORE: 5000,    // Score when tight turn probability is at max

  // Dynamic Turn Angle System (score-based)
  // Angles in degrees for readability, converted to radians in code
  TURN_ANGLE_TIER1_MIN: 75,   // 0~1000: comfortable range
  TURN_ANGLE_TIER1_MAX: 90,
  TURN_ANGLE_TIER2_MIN: 60,   // 1000~5000: more variety
  TURN_ANGLE_TIER2_MAX: 105,
  TURN_ANGLE_TIER3_MIN: 60,   // 5000+: full range
  TURN_ANGLE_TIER3_MAX: 120,
  TURN_ANGLE_TIER2_SCORE: 1000,   // Score threshold for tier 2
  TURN_ANGLE_TIER3_SCORE: 5000,   // Score threshold for tier 3
  
  // Scoring & Collision
  COLLISION_MARGIN: 0, // Strict: Crash exactly when car center (half body) crosses track edge.
  WARNING_MARGIN: 20, 
  PERFECT_EDGE_THRESHOLD: 0.5, // Relaxed from 0.65. Now easier to hit Perfect.
  
  CRASH_GRACE_TIME: 0.0, // Instant death, no mercy.
  
  // Fever Gauge System
  FEVER_GAUGE_GOOD: 5,      // +5% per Good
  FEVER_GAUGE_PERFECT: 20,  // +20% per Perfect
  FEVER_DURATION: 5,

  // Revive System
  REVIVE_STRAIGHT_SEGMENTS: 5, // Number of straight segments after revive for safety
};

export const COLORS = {
  TRACK_BG: '#0f172a', // slate-900 (Darker for better contrast)
  TRACK_FG_EVEN: '#334155', // slate-700
  TRACK_FG_ODD: '#475569', // slate-600 (Lighter alternate)
  TRACK_BORDER: '#cbd5e1', // slate-300 (New distinct border color)
  TRACK_CENTER: 'rgba(255, 255, 255, 0.15)', // Subtle white dashed line
  CAR: '#f43f5e', // rose-500
  CAR_FEVER: '#e879f9', // fuchsia-400
  PERFECT: '#22d3ee', // cyan-400
  GOOD: '#facc15', // yellow-400
  MISS: '#94a3b8', // slate-400
  TEXT_WHITE: '#ffffff',
};

// Enhanced Car Dimensions
export const CAR_DIMS = {
  bodyLength: 32,
  bodyWidth: 18,
  cornerRadius: 6,
  wheelLength: 8,
  wheelWidth: 4,
  wheelOffset: { x: 10, y: 10 },
  cockpitLength: 10,
  cockpitWidth: 10,
  cockpitOffset: -2,
  headlightRadius: 3,
  headlightOffset: 13,
};

// Default Car Visual Config
export const DEFAULT_CAR_VISUAL = {
  bodyColor: '#f43f5e',      // rose-500
  bodySecondaryColor: '#be123c', // rose-700
  wheelColor: '#1e293b',     // slate-800
  cockpitColor: '#0f172a',   // slate-900
  headlightColor: '#ffffff',
  glowColor: '#ffffff',
};

// Fever Mode Car Visual Config
export const FEVER_CAR_VISUAL = {
  bodyColor: '#e879f9',      // fuchsia-400
  bodySecondaryColor: '#c026d3', // fuchsia-600
  wheelColor: '#1e293b',
  cockpitColor: '#0f172a',
  headlightColor: '#f0abfc', // fuchsia-300
  glowColor: '#f0f',
};