// PRD Section 4.3 & 5.1
export const GAME_CONSTANTS = {
  // Physics & Tuning
  BASE_SPEED: 400, // Pixels per second
  MAX_SPEED: 850,
  SPEED_INCREASE_RATE: 0.5,
  
  // Drift Feel - Tuned for balanced inertia (Issue 3 fix)
  MAX_TURN_STRENGTH: 3.5, // Max radians per second
  TURN_RATE_ATTACK: 4.5, // Slightly more responsive entry
  TURN_RATE_RELEASE: 8.0, // Much faster recovery to straight (User request)
  DRIFT_ANGLE_OFFSET: 0.5, // Visual car rotation when drifting
  
  // Track Generation
  TRACK_WIDTH_START: 260, // Start very wide
  TRACK_WIDTH_END: 140,   // End narrow
  TRACK_NARROWING_RATE: 0.8, // Pixels smaller per segment
  TRACK_GENERATION_BUFFER: 50, // Increase buffer significantly to prevent visual pop-in (User Request)
  RENDER_WINDOW_SIZE: 16, // Segments ahead/behind to keep fully opaque
  
  SEGMENT_LENGTH_STRAIGHT: 300,
  SEGMENT_RADIUS_TURN: 300,
  
  // Scoring & Collision
  COLLISION_MARGIN: 0, // Strict: Crash exactly when car center (half body) crosses track edge.
  WARNING_MARGIN: 20, 
  PERFECT_EDGE_THRESHOLD: 0.5, // Relaxed from 0.65. Now easier to hit Perfect.
  
  CRASH_GRACE_TIME: 0.0, // Instant death, no mercy.
  
  // Combo
  FEVER_THRESHOLD: 8,
  FEVER_DURATION: 5, 
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