import React, { useEffect, useRef, useCallback, useState } from 'react';
import { GameScore, TurnQuality, TrackSegment, CarState, FloatingText, SkidMark, CarVisualConfig, SpeedLine, Coin, CoinParticle } from '../types';
import { GAME_CONSTANTS, COLORS, DEFAULT_CAR_VISUAL, FEVER_CAR_VISUAL, CAR_DIMS } from '../constants';
import { lerp, normalizeAngle, distance, closestPointOnLine } from '../utils/math';
import { drawEnhancedCar } from '../utils/rendering';
import { lightenColor, darkenColor } from '../utils/colors';

interface GameEngineProps {
  onGameOver: (score: GameScore) => void;
  onScoreUpdate: (score: GameScore) => void;
  isReviving: boolean;
  carVisual?: CarVisualConfig;
}

// Helper: Calculate distance from point to segment geometry
const getDistanceFromSegment = (seg: TrackSegment, pX: number, pY: number) => {
    if (seg.type === 'STRAIGHT') {
        const p = closestPointOnLine(seg.startX, seg.startY, seg.endX, seg.endY, pX, pY);
        return distance(pX, pY, p.x, p.y);
    } else {
        // Use actual radius from segment's curvature (radius = 1/curvature)
        const radius = 1 / seg.curvature;
        const dir = seg.type === 'TURN_LEFT' ? -1 : 1;
        const perpAngle = seg.startAngle + (Math.PI / 2 * dir);
        const cx = seg.startX + Math.cos(perpAngle) * radius;
        const cy = seg.startY + Math.sin(perpAngle) * radius;

        // Calculate the angle from arc center to the point
        const pointAngle = Math.atan2(pY - cy, pX - cx);

        // Calculate arc start and end angles using segment's actual turn angle
        const actualTurnAngle = Math.abs(normalizeAngle(seg.endAngle - seg.startAngle));
        const arcStartAngle = perpAngle + Math.PI; // Start of arc
        const arcEndAngle = arcStartAngle + (actualTurnAngle * dir); // End of arc (dynamic turn angle)

        // Normalize angles to check if point is within arc range
        const normalizeToRange = (angle: number, reference: number) => {
            let a = angle;
            while (a < reference - Math.PI) a += Math.PI * 2;
            while (a > reference + Math.PI) a -= Math.PI * 2;
            return a;
        };

        const normPointAngle = normalizeToRange(pointAngle, arcStartAngle);
        const normEndAngle = normalizeToRange(arcEndAngle, arcStartAngle);

        // Check if point angle is within the arc range
        const isWithinArc = dir === -1
            ? (normPointAngle >= normEndAngle && normPointAngle <= arcStartAngle)
            : (normPointAngle >= arcStartAngle && normPointAngle <= normEndAngle);

        if (isWithinArc) {
            // Point is within arc range - return perpendicular distance to arc
            const distToCenter = distance(pX, pY, cx, cy);
            return Math.abs(distToCenter - radius);
        } else {
            // Point is outside arc range - return distance to nearest endpoint
            const distToStart = distance(pX, pY, seg.startX, seg.startY);
            const distToEnd = distance(pX, pY, seg.endX, seg.endY);
            return Math.min(distToStart, distToEnd);
        }
    }
};

// --- Static Helpers for Initialization ---
// Move generation logic outside/static so we can use it for initial ref state
const createInitialSegment = (): TrackSegment => ({
    id: 0, type: 'STRAIGHT', length: GAME_CONSTANTS.SEGMENT_LENGTH_STRAIGHT * 2, curvature: 0,
    startAngle: -Math.PI / 2, endAngle: -Math.PI / 2,
    startX: 0, startY: 200, endX: 0, endY: 200 - GAME_CONSTANTS.SEGMENT_LENGTH_STRAIGHT * 2,
    width: GAME_CONSTANTS.TRACK_WIDTH_START
});

// Calculate dynamic turn radius based on current score
const calculateDynamicRadius = (score: number): number => {
    const { SEGMENT_RADIUS_MIN, SEGMENT_RADIUS_MAX, TIGHT_TURN_START_SCORE, TIGHT_TURN_FULL_SCORE } = GAME_CONSTANTS;

    // Before tight turns start, use wider radius only
    if (score < TIGHT_TURN_START_SCORE) {
        return SEGMENT_RADIUS_MAX;
    }

    // Calculate progression (0 to 1) for tight turn probability based on score
    const progression = Math.min(1, (score - TIGHT_TURN_START_SCORE) / (TIGHT_TURN_FULL_SCORE - TIGHT_TURN_START_SCORE));

    // Random factor with bias towards tighter turns as score increases
    // Low score: mostly wide turns, High score: mix of tight and wide
    const tightTurnChance = progression * 0.6; // Max 60% chance for tight turns

    if (Math.random() < tightTurnChance) {
        // Tight turn: radius between MIN and midpoint
        const midRadius = (SEGMENT_RADIUS_MIN + SEGMENT_RADIUS_MAX) / 2;
        return SEGMENT_RADIUS_MIN + Math.random() * (midRadius - SEGMENT_RADIUS_MIN);
    } else {
        // Normal/wide turn: radius between midpoint and MAX
        const midRadius = (SEGMENT_RADIUS_MIN + SEGMENT_RADIUS_MAX) / 2;
        return midRadius + Math.random() * (SEGMENT_RADIUS_MAX - midRadius);
    }
};

// Calculate dynamic turn angle based on current score
// Returns angle in radians
const calculateDynamicTurnAngle = (score: number): number => {
    const {
        TURN_ANGLE_TIER1_MIN, TURN_ANGLE_TIER1_MAX,
        TURN_ANGLE_TIER2_MIN, TURN_ANGLE_TIER2_MAX,
        TURN_ANGLE_TIER3_MIN, TURN_ANGLE_TIER3_MAX,
        TURN_ANGLE_TIER2_SCORE, TURN_ANGLE_TIER3_SCORE
    } = GAME_CONSTANTS;

    const toRadians = (deg: number) => deg * Math.PI / 180;

    let minAngle: number;
    let maxAngle: number;

    if (score < TURN_ANGLE_TIER2_SCORE) {
        // Tier 1: 0~1000 - comfortable range (75-90 degrees)
        minAngle = TURN_ANGLE_TIER1_MIN;
        maxAngle = TURN_ANGLE_TIER1_MAX;
    } else if (score < TURN_ANGLE_TIER3_SCORE) {
        // Tier 2: 1000~5000 - more variety (60-105 degrees)
        minAngle = TURN_ANGLE_TIER2_MIN;
        maxAngle = TURN_ANGLE_TIER2_MAX;
    } else {
        // Tier 3: 5000+ - full range (60-120 degrees)
        minAngle = TURN_ANGLE_TIER3_MIN;
        maxAngle = TURN_ANGLE_TIER3_MAX;
    }

    // Weighted random: 70% normal (80-100), 20% mild (60-80), 10% sharp (100-120)
    const roll = Math.random();
    let angleDegrees: number;

    if (roll < 0.7) {
        // Normal range: bias towards 80-100 degrees
        const normalMin = Math.max(minAngle, 80);
        const normalMax = Math.min(maxAngle, 100);
        angleDegrees = normalMin + Math.random() * (normalMax - normalMin);
    } else if (roll < 0.9) {
        // Mild curve: 60-80 degrees (if available in tier)
        const mildMin = minAngle;
        const mildMax = Math.min(maxAngle, 80);
        angleDegrees = mildMin + Math.random() * (mildMax - mildMin);
    } else {
        // Sharp curve: 100-120 degrees (if available in tier)
        const sharpMin = Math.max(minAngle, 100);
        const sharpMax = maxAngle;
        angleDegrees = sharpMin + Math.random() * (sharpMax - sharpMin);
    }

    return toRadians(angleDegrees);
};

// Duplicated helper for use inside component (or we could extract it out, but for minimal diff keep local)
const createSegmentData = (prevSeg: TrackSegment, type: 'STRAIGHT' | 'TURN_LEFT' | 'TURN_RIGHT', calculatedWidth: number, score: number = 0): TrackSegment => {
    const id = prevSeg.id + 1;
    const startX = prevSeg.endX;
    const startY = prevSeg.endY;
    const startAngle = prevSeg.endAngle;

    if (type === 'STRAIGHT') {
      const len = GAME_CONSTANTS.SEGMENT_LENGTH_STRAIGHT;
      return {
        id, type, length: len, curvature: 0,
        startAngle, endAngle: startAngle,
        startX, startY,
        endX: startX + Math.cos(startAngle) * len,
        endY: startY + Math.sin(startAngle) * len,
        width: calculatedWidth
      };
    } else {
      // Use dynamic radius and angle based on current score
      const radius = calculateDynamicRadius(score);
      const turnAngle = calculateDynamicTurnAngle(score);
      const direction = type === 'TURN_LEFT' ? -1 : 1;
      const endAngle = normalizeAngle(startAngle + (turnAngle * direction));

      const perpAngle = startAngle + (Math.PI / 2 * direction);
      const cx = startX + Math.cos(perpAngle) * radius;
      const cy = startY + Math.sin(perpAngle) * radius;

      const ex = cx + Math.cos(endAngle - (Math.PI / 2 * direction)) * radius;
      const ey = cy + Math.sin(endAngle - (Math.PI / 2 * direction)) * radius;

      return {
        id, type, length: turnAngle * radius, curvature: 1/radius,
        startAngle, endAngle,
        startX, startY,
        endX: ex, endY: ey,
        width: calculatedWidth
      };
    }
};

export const GameEngine: React.FC<GameEngineProps> = ({ onGameOver, onScoreUpdate, isReviving, carVisual }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  // Canvas dimensions with resize support
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  // Game State Refs - Initialize SYNCHRONOUSLY to prevent race conditions
  const carRef = useRef<CarState>({
    x: 0, y: 0, heading: -Math.PI / 2, visualAngle: -Math.PI / 2, speed: GAME_CONSTANTS.BASE_SPEED, isDrifting: false, isCrashed: false
  });
  
  // Physics State for drifting
  const currentTurnRateRef = useRef<number>(0);
  
  const scoreRef = useRef<GameScore>({
    score: 0, highScore: 0, combo: 0, coins: 0, lastQuality: TurnQuality.NONE, fever: false, feverTimer: 0, feverGauge: 0
  });
  
  // Initialize Track immediately so it's never empty
  const trackRef = useRef<TrackSegment[]>([createInitialSegment()]);
  
  const cameraRef = useRef({
    x: 0, y: 0, zoom: 0.8,
    shakeX: 0, shakeY: 0,
    // Impact punch - now uses target + smooth lerp
    impactX: 0, impactY: 0,
    impactTargetX: 0, impactTargetY: 0,
    // Directional offset (smooth lerp)
    driftOffsetX: 0, driftOffsetY: 0
  });
  const effectsRef = useRef<FloatingText[]>([]);
  const skidMarksRef = useRef<SkidMark[]>([]); // New: Skid Marks
  const lastTirePosRef = useRef<{lx: number, ly: number, rx: number, ry: number} | null>(null); // For continuous lines
  const speedLinesRef = useRef<SpeedLine[]>([]); // Speed lines for atmosphere
  const wasDriftingRef = useRef<boolean>(false); // Track drift state changes for impact punch
  const coinsRef = useRef<Coin[]>([]); // Collectible coins on track
  const coinParticlesRef = useRef<CoinParticle[]>([]); // Coin collection particles
  const coinIdCounterRef = useRef<number>(0); // Unique ID generator for coins

  // Input: 0 = None, -1 = Left, 1 = Right
  const inputDirRef = useRef<number>(0);
  
  const gameTimeRef = useRef(0);
  const currentSegmentIndexRef = useRef(0);
  // Startup safety buffer - Increased to 60 frames (approx 1s) to ensure stability on restart
  const framesRef = useRef(0); 
  
  // Visual state for rendering (calculated in update, used in render)
  const currentDistRef = useRef(0);
  const currentWidthRef = useRef(GAME_CONSTANTS.TRACK_WIDTH_START);
  const currentRatioRef = useRef(0); // For warning opacity

  // --- Visual Effects Helper ---
  const spawnFloatingText = (text: string, color: string, x: number, y: number, scale: number = 1.0) => {
      effectsRef.current.push({
          id: Date.now() + Math.random(),
          text,
          x,
          y,
          color,
          life: 1.0,
          scale
      });
  };

  // --- Coin Generation ---
  const generateCoinsForSegment = (seg: TrackSegment): Coin[] => {
      const coins: Coin[] = [];

      if (seg.type === 'STRAIGHT') {
          // Place coins along the center line
          const numCoins = GAME_CONSTANTS.COINS_PER_STRAIGHT;
          for (let i = 0; i < numCoins; i++) {
              const t = (i + 1) / (numCoins + 1); // Evenly spaced
              coins.push({
                  id: coinIdCounterRef.current++,
                  x: seg.startX + (seg.endX - seg.startX) * t,
                  y: seg.startY + (seg.endY - seg.startY) * t,
                  collected: false,
                  collectTime: 0,
                  segmentId: seg.id
              });
          }
      } else {
          // For turns, place coins on the ideal drift line (outer edge)
          // This rewards players who drift on the correct line
          const numCoins = GAME_CONSTANTS.COINS_PER_TURN;
          const radius = 1 / seg.curvature;
          const dir = seg.type === 'TURN_LEFT' ? -1 : 1;
          const perpAngle = seg.startAngle + (Math.PI / 2 * dir);
          const cx = seg.startX + Math.cos(perpAngle) * radius;
          const cy = seg.startY + Math.sin(perpAngle) * radius;

          const startA = perpAngle + Math.PI;
          const actualTurnAngle = normalizeAngle(seg.endAngle - seg.startAngle);

          // Offset from center to outer edge (where ideal drift line is)
          const idealLineOffset = seg.width * 0.35; // 35% from center towards outer edge
          const coinRadius = radius + (dir * idealLineOffset);

          for (let i = 0; i < numCoins; i++) {
              const t = (i + 1) / (numCoins + 1);
              const angle = startA + actualTurnAngle * t;
              coins.push({
                  id: coinIdCounterRef.current++,
                  x: cx + Math.cos(angle) * coinRadius,
                  y: cy + Math.sin(angle) * coinRadius,
                  collected: false,
                  collectTime: 0,
                  segmentId: seg.id
              });
          }
      }

      return coins;
  };

  // Spawn coin collection particles
  const spawnCoinParticles = (x: number, y: number) => {
      const numParticles = 8;
      for (let i = 0; i < numParticles; i++) {
          const angle = (Math.PI * 2 * i) / numParticles + Math.random() * 0.5;
          const speed = 80 + Math.random() * 60;
          coinParticlesRef.current.push({
              x,
              y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.0,
              size: 3 + Math.random() * 3
          });
      }
  };

  // --- Track Generation Logic ---

  // Get sample points along a segment for collision checking
  const getSegmentSamplePoints = (seg: TrackSegment, numSamples: number = 5): {x: number, y: number}[] => {
      const points: {x: number, y: number}[] = [];

      if (seg.type === 'STRAIGHT') {
          for (let i = 0; i <= numSamples; i++) {
              const t = i / numSamples;
              points.push({
                  x: seg.startX + (seg.endX - seg.startX) * t,
                  y: seg.startY + (seg.endY - seg.startY) * t
              });
          }
      } else {
          // For turns, sample points along the arc using actual radius from curvature
          const radius = 1 / seg.curvature;
          const dir = seg.type === 'TURN_LEFT' ? -1 : 1;
          const perpAngle = seg.startAngle + (Math.PI / 2 * dir);
          const cx = seg.startX + Math.cos(perpAngle) * radius;
          const cy = seg.startY + Math.sin(perpAngle) * radius;

          const startA = perpAngle + Math.PI;
          // Use segment's actual turn angle instead of fixed 90 degrees
          const actualTurnAngle = normalizeAngle(seg.endAngle - seg.startAngle);

          for (let i = 0; i <= numSamples; i++) {
              const t = i / numSamples;
              const angle = startA + actualTurnAngle * t;
              points.push({
                  x: cx + Math.cos(angle) * radius,
                  y: cy + Math.sin(angle) * radius
              });
          }
      }

      return points;
  };

  // Check if a candidate segment is safe (doesn't intersect with existing track)
  const isSegmentSafe = (candidate: TrackSegment, history: TrackSegment[]): boolean => {
      // Check entire history except immediate previous segments
      const skipRecent = 4; // Skip last 4 segments (they're connected)
      // Safe distance must account for both track widths plus generous margin
      // to prevent visual overlap when tracks run parallel (use max radius for safety)
      const safeDistance = GAME_CONSTANTS.TRACK_WIDTH_START + GAME_CONSTANTS.SEGMENT_RADIUS_MAX; // 260 + 350 = 610px

      // Sample more points along the candidate segment for better precision
      const samplePoints = getSegmentSamplePoints(candidate, 12);

      // Check each sample point against all older segments
      for (const point of samplePoints) {
          for (let i = 0; i < history.length - skipRecent; i++) {
              const seg = history[i];
              const dist = getDistanceFromSegment(seg, point.x, point.y);
              if (dist < safeDistance) {
                  return false;
              }
          }
      }

      return true;
  };

  // Check last N turns to detect consecutive same-direction turns
  const getLastNTurns = (history: TrackSegment[], n: number): ('TURN_LEFT' | 'TURN_RIGHT')[] => {
      const turns: ('TURN_LEFT' | 'TURN_RIGHT')[] = [];
      for (let i = history.length - 1; i >= 0 && turns.length < n; i--) {
          const seg = history[i];
          if (seg.type === 'TURN_LEFT' || seg.type === 'TURN_RIGHT') {
              turns.unshift(seg.type);
          }
      }
      return turns;
  };

  const generateSegment = (prevSeg: TrackSegment | null): TrackSegment => {
    if (!prevSeg) {
       return createInitialSegment();
    }

    const calculatedWidth = Math.max(
        GAME_CONSTANTS.TRACK_WIDTH_END,
        GAME_CONSTANTS.TRACK_WIDTH_START - ((prevSeg.id + 1) * GAME_CONSTANTS.TRACK_NARROWING_RATE)
    );

    // Get current score for dynamic difficulty
    const currentScore = scoreRef.current.score;

    // Force first few segments to be STRAIGHT to avoid spawn overlaps
    if (prevSeg.id < 4) {
        return createSegmentData(prevSeg, 'STRAIGHT', calculatedWidth, currentScore);
    }

    // Simple anti-spiral rule: 2 consecutive same-direction turns → force opposite turn
    const lastTurns = getLastNTurns(trackRef.current, 2);
    let forcedTurn: 'TURN_LEFT' | 'TURN_RIGHT' | null = null;

    if (lastTurns.length >= 2 && lastTurns[0] === lastTurns[1]) {
        // 2 consecutive same-direction turns detected → force opposite
        forcedTurn = lastTurns[0] === 'TURN_LEFT' ? 'TURN_RIGHT' : 'TURN_LEFT';
    }

    // Build candidate list based on forced turn or random selection
    let candidates: ('STRAIGHT' | 'TURN_LEFT' | 'TURN_RIGHT')[];

    if (forcedTurn) {
        // Must include the forced opposite turn
        candidates = [forcedTurn, 'STRAIGHT'];
    } else if (prevSeg.type === 'STRAIGHT') {
        // After straight, prefer a turn for variety
        const randomTurn: 'TURN_LEFT' | 'TURN_RIGHT' = Math.random() > 0.5 ? 'TURN_LEFT' : 'TURN_RIGHT';
        const otherTurn = randomTurn === 'TURN_LEFT' ? 'TURN_RIGHT' : 'TURN_LEFT';
        candidates = [randomTurn, 'STRAIGHT', otherTurn];
    } else {
        // After turn, prefer straight
        const randomTurn: 'TURN_LEFT' | 'TURN_RIGHT' = Math.random() > 0.5 ? 'TURN_LEFT' : 'TURN_RIGHT';
        const otherTurn = randomTurn === 'TURN_LEFT' ? 'TURN_RIGHT' : 'TURN_LEFT';
        candidates = ['STRAIGHT', randomTurn, otherTurn];
    }

    // Try candidates in order, checking for collision safety
    for (const type of candidates) {
        const candidateSeg = createSegmentData(prevSeg, type, calculatedWidth, currentScore);
        if (isSegmentSafe(candidateSeg, trackRef.current)) {
            return candidateSeg;
        }
    }

    // Fallback: try all options in a different order
    const allOptions: ('STRAIGHT' | 'TURN_LEFT' | 'TURN_RIGHT')[] = ['STRAIGHT', 'TURN_LEFT', 'TURN_RIGHT'];
    for (const type of allOptions) {
        const candidateSeg = createSegmentData(prevSeg, type, calculatedWidth, currentScore);
        if (isSegmentSafe(candidateSeg, trackRef.current)) {
            return candidateSeg;
        }
    }

    // Final fallback: create a straight segment
    return createSegmentData(prevSeg, 'STRAIGHT', calculatedWidth, currentScore);
  };
  // --- End Track Generation Logic ---

  // NOTE: Initialization is now handled by initial useRef values and the fill buffer loop below.
  // This removes the need for useEffect initialization which can race against requestAnimationFrame.
  const fillInitialBuffer = useCallback(() => {
    // Only fill if needed (initial render)
    if (trackRef.current.length < 2) {
        for (let i = 0; i < 15; i++) {
            const newSeg = generateSegment(trackRef.current[trackRef.current.length - 1]);
            trackRef.current.push(newSeg);
            // Generate coins for this segment
            const newCoins = generateCoinsForSegment(newSeg);
            coinsRef.current.push(...newCoins);
        }
    }
  }, []);

  // Ensure buffer is filled on mount
  useEffect(() => {
    fillInitialBuffer();
  }, [fillInitialBuffer]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isReviving) {
      const safeIndex = Math.max(0, currentSegmentIndexRef.current - 1);
      const safeSeg = trackRef.current[safeIndex];

      if (safeSeg) {
        // Clear track segments ahead and generate straight safety zone
        trackRef.current = trackRef.current.slice(0, safeIndex + 1);

        // Generate forced straight segments for safety zone
        const currentWidth = safeSeg.width;
        let lastSeg = safeSeg;
        for (let i = 0; i < GAME_CONSTANTS.REVIVE_STRAIGHT_SEGMENTS; i++) {
          const straightSeg = createSegmentData(lastSeg, 'STRAIGHT', currentWidth, 0);
          trackRef.current.push(straightSeg);
          lastSeg = straightSeg;
        }

        // Position car at the start of the first new straight segment
        const firstStraight = trackRef.current[safeIndex + 1];

        carRef.current.isCrashed = false;
        carRef.current.isDrifting = false;
        carRef.current.x = firstStraight.startX;
        carRef.current.y = firstStraight.startY;
        carRef.current.heading = firstStraight.startAngle;
        carRef.current.visualAngle = firstStraight.startAngle;
        carRef.current.speed = GAME_CONSTANTS.BASE_SPEED;
        currentTurnRateRef.current = 0;
        inputDirRef.current = 0;
        effectsRef.current = [];
        skidMarksRef.current = []; // Clear skids on revive
        speedLinesRef.current = []; // Clear speed lines on revive
        lastTirePosRef.current = null;
        framesRef.current = 0; // Reset safe frames on revive
        currentSegmentIndexRef.current = safeIndex + 1; // Start from the new straight section

        // Clear old coins and generate new ones for the safety zone
        coinsRef.current = coinsRef.current.filter(c => c.segmentId <= safeIndex);
        coinParticlesRef.current = [];
        for (let i = safeIndex + 1; i < trackRef.current.length; i++) {
          const newCoins = generateCoinsForSegment(trackRef.current[i]);
          coinsRef.current.push(...newCoins);
        }
      }
    }
  }, [isReviving]);

  const handleInputStart = (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width } = canvas.getBoundingClientRect();
      if (clientX < width / 2) inputDirRef.current = -1;
      else inputDirRef.current = 1;
  };
  const handleInputEnd = () => { inputDirRef.current = 0; };

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    
    // IMPORTANT: Only prevent default on start events to avoid scrolling.
    // Do NOT prevent default on up/end events on window, as this blocks UI clicks (Restart button)
    // when the GameEngine is still mounted in the background.
    
    const onMouseDown = (e: MouseEvent) => { e.preventDefault(); handleInputStart(e.clientX); };
    const onMouseUp = (e: MouseEvent) => { handleInputEnd(); }; // Removed preventDefault
    
    const onTouchStart = (e: TouchEvent) => { 
        if (e.cancelable) e.preventDefault(); 
        if (e.touches.length > 0) handleInputStart(e.touches[0].clientX); 
    };
    const onTouchEnd = (e: TouchEvent) => { handleInputEnd(); }; // Removed preventDefault
    
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    
    // Use non-passive for touch start to allow preventDefault (scrolling block)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const animate = (time: number) => {
    if (previousTimeRef.current === undefined) previousTimeRef.current = time;
    const deltaTime = (time - previousTimeRef.current) / 1000; 
    previousTimeRef.current = time;
    const dt = Math.min(deltaTime, 0.1); 

    if (!carRef.current.isCrashed) {
      updatePhysics(dt);
      updateGameLogic(dt);
      updateEffects(dt);
    }
    render();
    requestRef.current = requestAnimationFrame(animate);
  };

  const updateEffects = (dt: number) => {
      const car = carRef.current;

      // Update Floating Text
      for (let i = effectsRef.current.length - 1; i >= 0; i--) {
          const fx = effectsRef.current[i];
          fx.life -= dt * 1.5; // Fade speed
          fx.y -= dt * 100; // Float up speed

          if (fx.life <= 0) {
              effectsRef.current.splice(i, 1);
          }
      }

      // Update Skid Marks
      for (let i = skidMarksRef.current.length - 1; i >= 0; i--) {
        const mark = skidMarksRef.current[i];
        mark.life -= dt * 1.5; // Skid fade speed
        if (mark.life <= 0) {
            skidMarksRef.current.splice(i, 1);
        }
      }

      // Update Speed Lines
      for (let i = speedLinesRef.current.length - 1; i >= 0; i--) {
        const line = speedLinesRef.current[i];
        line.opacity -= dt * 2.5; // Faster fade for speed lines
        if (line.opacity <= 0) {
            speedLinesRef.current.splice(i, 1);
        }
      }

      // Update Coin Particles
      for (let i = coinParticlesRef.current.length - 1; i >= 0; i--) {
        const particle = coinParticlesRef.current[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt * 3; // Fast fade
        if (particle.life <= 0) {
            coinParticlesRef.current.splice(i, 1);
        }
      }

      // Clean up collected coins after animation delay
      const currentTime = gameTimeRef.current;
      coinsRef.current = coinsRef.current.filter(
        c => !c.collected || (currentTime - c.collectTime) < 0.3
      );

      // Generate Speed Lines when moving fast - Enhanced for better speed feel
      const speedRatio = car.speed / GAME_CONSTANTS.MAX_SPEED;
      const maxLines = 50 + Math.floor(speedRatio * 30); // More lines at higher speed

      if (speedRatio > 0.3 && !car.isCrashed && speedLinesRef.current.length < maxLines) {
        // Higher spawn rate for more dramatic effect
        const spawnChance = (speedRatio - 0.3) * 1.2 * dt * 60;

        // Spawn multiple lines per frame at high speed
        const linesToSpawn = Math.floor(spawnChance) + (Math.random() < (spawnChance % 1) ? 1 : 0);

        for (let i = 0; i < linesToSpawn && speedLinesRef.current.length < maxLines; i++) {
          // Spawn in wider peripheral vision area (sides and behind)
          const sideAngle = (Math.random() - 0.5) * 2.0; // Wider spread
          const angle = car.heading + Math.PI + sideAngle;
          const dist = 100 + Math.random() * 350;

          speedLinesRef.current.push({
            x: car.x + Math.cos(angle) * dist + (Math.random() - 0.5) * 200,
            y: car.y + Math.sin(angle) * dist + (Math.random() - 0.5) * 200,
            length: 60 + speedRatio * 100, // Longer lines
            opacity: 0.3 + speedRatio * 0.5 // More visible
          });
        }
      }

      // === Camera Effects ===
      const cam = cameraRef.current;
      const isDrifting = car.isDrifting;
      const wasDrifting = wasDriftingRef.current;
      const driftDir = Math.sign(currentTurnRateRef.current); // -1 left, 1 right

      // 1. Impact Punch - triggers on drift state change (smooth version)
      if (isDrifting && !wasDrifting) {
        // Drift START: set target punch (opposite to drift direction)
        const punchStrength = 6;
        const punchAngle = car.heading + (Math.PI / 2) * (-driftDir);
        cam.impactTargetX = Math.cos(punchAngle) * punchStrength;
        cam.impactTargetY = Math.sin(punchAngle) * punchStrength;
      } else if (!isDrifting && wasDrifting) {
        // Drift END: smaller target punch
        const punchStrength = 3;
        cam.impactTargetX = (Math.random() - 0.5) * punchStrength;
        cam.impactTargetY = (Math.random() - 0.5) * punchStrength;
      }

      // Smoothly lerp current impact toward target (gentle attack)
      cam.impactX = lerp(cam.impactX, cam.impactTargetX, dt * 5);
      cam.impactY = lerp(cam.impactY, cam.impactTargetY, dt * 5);

      // Decay target back to zero (slow release)
      cam.impactTargetX = lerp(cam.impactTargetX, 0, dt * 2.5);
      cam.impactTargetY = lerp(cam.impactTargetY, 0, dt * 2.5);

      // 2. Directional Offset - smooth offset opposite to drift direction
      const driftIntensity = Math.abs(currentTurnRateRef.current) / GAME_CONSTANTS.MAX_TURN_STRENGTH;
      const targetOffsetAmount = isDrifting ? driftIntensity * 28 : 0; // Max 28px offset
      const offsetAngle = car.heading + (Math.PI / 2) * (-driftDir);

      const targetOffsetX = Math.cos(offsetAngle) * targetOffsetAmount;
      const targetOffsetY = Math.sin(offsetAngle) * targetOffsetAmount;

      // Smooth lerp to target offset
      cam.driftOffsetX = lerp(cam.driftOffsetX, targetOffsetX, dt * 4);
      cam.driftOffsetY = lerp(cam.driftOffsetY, targetOffsetY, dt * 4);

      // 3. Speed Shake - subtle continuous shake at high speed only
      const speedIntensity = Math.max(0, (speedRatio - 0.6) * 2.5); // Kicks in above 60% speed
      const speedShakeAmount = speedIntensity * 3; // Max 3 pixels (subtle)
      cam.shakeX = (Math.random() - 0.5) * 2 * speedShakeAmount;
      cam.shakeY = (Math.random() - 0.5) * 2 * speedShakeAmount;

      // Update drift state tracker
      wasDriftingRef.current = isDrifting;
  };

  const updatePhysics = (dt: number) => {
    const car = carRef.current;
    gameTimeRef.current += dt;
    const speedMultiplier = car.speed < GAME_CONSTANTS.MAX_SPEED ? 1 : 0;
    car.speed += GAME_CONSTANTS.SPEED_INCREASE_RATE * speedMultiplier * dt;
    const effectiveSpeed = car.speed * (scoreRef.current.fever ? 1.2 : 1.0); 

    const targetTurnRate = inputDirRef.current * GAME_CONSTANTS.MAX_TURN_STRENGTH;
    const isAttacking = inputDirRef.current !== 0; 
    let interpolationSpeed = isAttacking ? GAME_CONSTANTS.TURN_RATE_ATTACK : GAME_CONSTANTS.TURN_RATE_RELEASE;
    
    const diff = targetTurnRate - currentTurnRateRef.current;
    if (Math.abs(diff) > 0.01) {
        currentTurnRateRef.current += Math.sign(diff) * Math.min(Math.abs(diff), interpolationSpeed * dt);
    } else {
        currentTurnRateRef.current = targetTurnRate;
    }

    car.isDrifting = Math.abs(currentTurnRateRef.current) > 0.5;
    car.heading += currentTurnRateRef.current * dt;
    car.x += Math.cos(car.heading) * effectiveSpeed * dt;
    car.y += Math.sin(car.heading) * effectiveSpeed * dt;
    
    const slideOffset = (currentTurnRateRef.current / GAME_CONSTANTS.MAX_TURN_STRENGTH) * GAME_CONSTANTS.DRIFT_ANGLE_OFFSET;
    car.visualAngle = lerp(car.visualAngle, car.heading + slideOffset, dt * 8);

    // --- Skid Mark Generation ---
    if (car.isDrifting) {
        // Use CAR_DIMS for accurate tire positions
        const rearAxleX = -CAR_DIMS.wheelOffset.x;
        const tireY = CAR_DIMS.wheelOffset.y;

        const cosA = Math.cos(car.visualAngle);
        const sinA = Math.sin(car.visualAngle);

        // Calculate current tire positions in world space
        // Left Tire
        const lx = car.x + (rearAxleX * cosA - (-tireY) * sinA);
        const ly = car.y + (rearAxleX * sinA + (-tireY) * cosA);

        // Right Tire
        const rx = car.x + (rearAxleX * cosA - (tireY) * sinA);
        const ry = car.y + (rearAxleX * sinA + (tireY) * cosA);

        if (lastTirePosRef.current) {
            // Add segments from previous frame to current
            skidMarksRef.current.push({
                x1: lastTirePosRef.current.lx, y1: lastTirePosRef.current.ly,
                x2: lx, y2: ly,
                life: 1.0
            });
            skidMarksRef.current.push({
                x1: lastTirePosRef.current.rx, y1: lastTirePosRef.current.ry,
                x2: rx, y2: ry,
                life: 1.0
            });
        }

        lastTirePosRef.current = { lx, ly, rx, ry };
    } else {
        lastTirePosRef.current = null;
    }
  };

  const updateGameLogic = (dt: number) => {
    // If track is missing for some reason, abort frame
    if (trackRef.current.length === 0) return;

    const car = carRef.current;
    
    // --- CRITICAL FIX: Robust Segment Tracking & Collision Logic ---
    let isSafe = false;
    let minSafetyRatio = 100;
    let bestDistForVisuals = 0;
    
    // We only care about segments reasonably close to the current logical progress
    // This prevents the car from being "caught" by a ghost segment that loops back nearby
    const searchStart = Math.max(0, currentSegmentIndexRef.current - 10);
    const searchEnd = Math.min(trackRef.current.length, currentSegmentIndexRef.current + 10);
    
    let closestSegIndex = -1;
    let closestSegDist = Infinity;

    for (let i = searchStart; i < searchEnd; i++) {
        const seg = trackRef.current[i];
        const dist = getDistanceFromSegment(seg, car.x, car.y);
        
        const trackHalfWidth = seg.width / 2;
        const limit = trackHalfWidth + GAME_CONSTANTS.COLLISION_MARGIN;
        const safetyRatio = dist / limit;
        
        // LOGIC FIX: Only consider segments that are physically AND logically plausible
        // e.g. You can't be at segment 100 if you were at segment 5.
        // We allow a small lookahead (3 segments = ~900px) to handle fast movement/transitions
        const isRelevant = i >= currentSegmentIndexRef.current - 1 && i <= currentSegmentIndexRef.current + 3;

        if (isRelevant) {
            if (dist < closestSegDist) {
                closestSegDist = dist;
                closestSegIndex = i;
            }

            if (safetyRatio < minSafetyRatio) {
                minSafetyRatio = safetyRatio;
                bestDistForVisuals = dist;
                currentWidthRef.current = seg.width;
            }

            if (dist <= limit) {
                isSafe = true;
            }
        }
    }

    // --- 1. Progress & Scoring Update ---
    if (closestSegIndex > currentSegmentIndexRef.current) {
        for (let i = currentSegmentIndexRef.current; i < closestSegIndex; i++) {
             const finishedSeg = trackRef.current[i];
             
             // SCORING UPDATE
             let distToGeoCenter = 0;
             if (finishedSeg.type === 'STRAIGHT') {
                const p = closestPointOnLine(finishedSeg.startX, finishedSeg.startY, finishedSeg.endX, finishedSeg.endY, car.x, car.y);
                distToGeoCenter = distance(car.x, car.y, p.x, p.y);
             } else {
                // Use actual radius from segment's curvature
                const radius = 1 / finishedSeg.curvature;
                const dir = finishedSeg.type === 'TURN_LEFT' ? -1 : 1;
                const perpAngle = finishedSeg.startAngle + (Math.PI / 2 * dir);
                const cx = finishedSeg.startX + Math.cos(perpAngle) * radius;
                const cy = finishedSeg.startY + Math.sin(perpAngle) * radius;
                distToGeoCenter = Math.abs(distance(car.x, car.y, cx, cy) - radius);
            }
            
            const halfWidth = finishedSeg.width / 2;
            const edgeRatio = Math.min(1.0, distToGeoCenter / halfWidth);
            
            evaluateSegmentScore(finishedSeg, edgeRatio);
        }
        currentSegmentIndexRef.current = closestSegIndex;
    }

    currentDistRef.current = bestDistForVisuals;
    currentRatioRef.current = minSafetyRatio;

    // --- Startup Safety Buffer (CRITICAL for Restart) ---
    // Reduced from 60 (1s) to 10 (~0.16s). 
    // Since we fixed the start track to be straight, we don't need a long buffer.
    // This fixes the issue where players could crash early but stay alive.
    if (framesRef.current < 10) {
        framesRef.current++;
        isSafe = true;
    }

    // --- 2. Crash Processing ---
    // INSTANT DEATH: No grace period
    if (!isSafe) {
        car.isCrashed = true;
        onGameOver(scoreRef.current);
    }
    
    // 3. Track Gen - Ensure buffer ahead
    while (trackRef.current.length < currentSegmentIndexRef.current + GAME_CONSTANTS.TRACK_GENERATION_BUFFER) {
        const last = trackRef.current[trackRef.current.length - 1];
        const newSeg = generateSegment(last);
        trackRef.current.push(newSeg);
        // Generate coins for the new segment
        const newCoins = generateCoinsForSegment(newSeg);
        coinsRef.current.push(...newCoins);
    }

    // 4. Coin Collection - Check for coins near car
    const collectRadius = GAME_CONSTANTS.COIN_COLLECT_RADIUS;
    for (const coin of coinsRef.current) {
        if (!coin.collected) {
            const dist = distance(car.x, car.y, coin.x, coin.y);
            if (dist < collectRadius) {
                coin.collected = true;
                coin.collectTime = gameTimeRef.current;
                scoreRef.current.coins += GAME_CONSTANTS.COIN_VALUE;
                spawnCoinParticles(coin.x, coin.y);
            }
        }
    }

    // 5. Track Cleanup - Remove old segments behind camera
    // This prevents track overlap issues and keeps memory usage low
    const deleteThreshold = 3; // Keep only 3 segments behind
    if (currentSegmentIndexRef.current > deleteThreshold) {
        const deleteCount = currentSegmentIndexRef.current - deleteThreshold;
        const minSegId = trackRef.current[0]?.id || 0;
        trackRef.current.splice(0, deleteCount);
        currentSegmentIndexRef.current -= deleteCount;
        // Clean up coins from deleted segments
        const newMinSegId = trackRef.current[0]?.id || 0;
        coinsRef.current = coinsRef.current.filter(c => c.segmentId >= newMinSegId);
    }
    
    // 6. Fever Logic
    if (scoreRef.current.fever) {
        scoreRef.current.feverTimer -= dt;
        if (scoreRef.current.feverTimer <= 0) {
            scoreRef.current.fever = false;
            // Note: Combo is preserved after fever ends to reward skilled play
        }
    }
    
    onScoreUpdate({ ...scoreRef.current });
  };

  const evaluateSegmentScore = (seg: TrackSegment, edgeRatio: number) => {
      if (seg.type === 'STRAIGHT') {
          const straightFeverBonus = scoreRef.current.fever ? 2.0 : 1.0;
          scoreRef.current.score += Math.floor(10 * straightFeverBonus);
          return;
      }
      
      let quality = TurnQuality.GOOD;
      
      if (edgeRatio > GAME_CONSTANTS.PERFECT_EDGE_THRESHOLD) {
          quality = TurnQuality.PERFECT;
      } else {
          quality = TurnQuality.GOOD;
      }

      scoreRef.current.combo++;
      let multiplier = 1;
      if (scoreRef.current.combo >= 50) multiplier = 3;
      else if (scoreRef.current.combo >= 25) multiplier = 2.5;
      else if (scoreRef.current.combo >= 10) multiplier = 2;

      const baseScore = 100;
      const feverBonus = scoreRef.current.fever ? 2.0 : 1.0;
      const points = quality === TurnQuality.PERFECT
        ? Math.floor(baseScore * multiplier * feverBonus)
        : Math.floor(baseScore * feverBonus);

      scoreRef.current.score += points;
      // Note: Coins are now collected from the track, not auto-generated
      scoreRef.current.lastQuality = quality;

      if (quality === TurnQuality.PERFECT) {
          spawnFloatingText("PERFECT!", COLORS.PERFECT, carRef.current.x, carRef.current.y, 1.5);
          spawnFloatingText(`+${points}`, COLORS.TEXT_WHITE, carRef.current.x, carRef.current.y - 40, 1.0);

          // Add to fever gauge (Perfect = +20%)
          if (!scoreRef.current.fever) {
              scoreRef.current.feverGauge = Math.min(100, scoreRef.current.feverGauge + GAME_CONSTANTS.FEVER_GAUGE_PERFECT);
          }
      } else {
          spawnFloatingText("GOOD", COLORS.GOOD, carRef.current.x, carRef.current.y, 1.0);
          spawnFloatingText(`+${points}`, COLORS.TEXT_WHITE, carRef.current.x, carRef.current.y - 30, 0.8);

          // Add to fever gauge (Good = +5%)
          if (!scoreRef.current.fever) {
              scoreRef.current.feverGauge = Math.min(100, scoreRef.current.feverGauge + GAME_CONSTANTS.FEVER_GAUGE_GOOD);
          }
      }

      // Trigger fever when gauge reaches 100%
      if (scoreRef.current.feverGauge >= 100 && !scoreRef.current.fever) {
          scoreRef.current.fever = true;
          scoreRef.current.feverTimer = GAME_CONSTANTS.FEVER_DURATION;
          scoreRef.current.feverGauge = 0; // Reset gauge when fever starts
      }
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    const car = carRef.current;
    
    // Clear
    ctx.fillStyle = COLORS.TRACK_BG;
    ctx.fillRect(0, 0, width, height);
    
    // Camera Follow
    cameraRef.current.x = lerp(cameraRef.current.x, car.x, 0.1);
    cameraRef.current.y = lerp(cameraRef.current.y, car.y, 0.1);

    ctx.save();
    // Combine all camera effects: shake + impact punch + drift offset
    const { shakeX, shakeY, impactX, impactY, driftOffsetX, driftOffsetY } = cameraRef.current;
    const totalOffsetX = shakeX + impactX + driftOffsetX;
    const totalOffsetY = shakeY + impactY + driftOffsetY;
    ctx.translate(width / 2 + totalOffsetX, height * 0.8 + totalOffsetY);
    ctx.scale(cameraRef.current.zoom, cameraRef.current.zoom);
    ctx.rotate(-car.heading - Math.PI/2);
    ctx.translate(-cameraRef.current.x, -cameraRef.current.y);
    
    drawTrack(ctx);
    drawCoins(ctx); // Draw coins on track surface
    drawSpeedLines(ctx, car); // Speed lines in world space
    drawSkidMarks(ctx); // Render skids before car but after track
    drawCar(ctx, car);
    drawCoinParticles(ctx); // Coin collection particles above car
    drawEffects(ctx);

    ctx.restore();

    // Fever Mode Visual Effects (screen space)
    if (scoreRef.current.fever) {
      drawFeverOverlay(ctx, width, height);
    }

    // Visual Warning
    const ratio = currentRatioRef.current;
    const warningThreshold = 0.7; 

    if (ratio > warningThreshold && !car.isCrashed) {
        const severity = (ratio - warningThreshold) / (1.0 - warningThreshold);
        const alpha = Math.min(0.6, severity);
        
        ctx.save();
        const gradient = ctx.createRadialGradient(width/2, height/2, height*0.3, width/2, height/2, height*0.8);
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(220, 20, 60, ${alpha})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
    
    // Touch Zones
    if (inputDirRef.current !== 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        if (inputDirRef.current === -1) {
            ctx.fillRect(0, 0, width/2, height);
        } else {
            ctx.fillRect(width/2, 0, width/2, height);
        }
    }
  };

  const drawTrack = (ctx: CanvasRenderingContext2D) => {
      // Use 'butt' cap for distinct segments
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';

      const curr = currentSegmentIndexRef.current;
      const total = trackRef.current.length;

      // Active window: current segment and a few ahead for visibility
      const activeStart = Math.max(0, curr - 2);
      const activeEnd = Math.min(total, curr + 10);

      // Helper to render segments with specific alpha
      const renderSegments = (start: number, end: number, alpha: number) => {
          if (start >= end) return;
          ctx.globalAlpha = alpha;
          for (let i = start; i < end; i++) {
             const seg = trackRef.current[i];
             drawSegment(ctx, seg);
          }
      };

      // Pass 1: Render ALL inactive (background) tracks first with very low opacity
      // This ensures they are visually "below" the active track
      renderSegments(0, activeStart, 0.12);
      renderSegments(activeEnd, total, 0.12);

      // Pass 2: Render active (foreground) track on top with full opacity
      ctx.globalAlpha = 1.0;
      for (let i = activeStart; i < activeEnd; i++) {
          const seg = trackRef.current[i];
          drawSegment(ctx, seg);
      }

      ctx.globalAlpha = 1.0; // Reset
  };

  const drawSegment = (ctx: CanvasRenderingContext2D, seg: TrackSegment) => {
      const baseColor = (seg.id % 2 === 0) ? COLORS.TRACK_FG_EVEN : COLORS.TRACK_FG_ODD;

      // Create track surface gradient (center lighter, edges darker)
      let trackStyle: string | CanvasGradient = baseColor;
      if (seg.type === 'STRAIGHT') {
        const perpAngle = seg.startAngle + Math.PI / 2;
        const halfW = seg.width / 2;
        const gradient = ctx.createLinearGradient(
          seg.startX - Math.cos(perpAngle) * halfW,
          seg.startY - Math.sin(perpAngle) * halfW,
          seg.startX + Math.cos(perpAngle) * halfW,
          seg.startY + Math.sin(perpAngle) * halfW
        );
        const darkerEdge = darkenColor(baseColor, 0.08);
        const lighterCenter = lightenColor(baseColor, 0.06);
        gradient.addColorStop(0, darkerEdge);
        gradient.addColorStop(0.5, lighterCenter);
        gradient.addColorStop(1, darkerEdge);
        trackStyle = gradient;
      }

      // Draw main track surface
      ctx.beginPath();
      ctx.lineWidth = seg.width;
      ctx.strokeStyle = trackStyle;

      if (seg.type === 'STRAIGHT') {
          ctx.moveTo(seg.startX, seg.startY);
          ctx.lineTo(seg.endX, seg.endY);
      } else {
           const radius = 1 / seg.curvature;
           const dir = seg.type === 'TURN_LEFT' ? -1 : 1;
           const perpAngle = seg.startAngle + (Math.PI / 2 * dir);
           const cx = seg.startX + Math.cos(perpAngle) * radius;
           const cy = seg.startY + Math.sin(perpAngle) * radius;
           const startA = perpAngle + Math.PI;
           // Use segment's actual turn angle
           const actualTurnAngle = normalizeAngle(seg.endAngle - seg.startAngle);
           const endA = startA + actualTurnAngle;
           ctx.arc(cx, cy, radius, startA, endA, seg.type === 'TURN_LEFT');
      }
      ctx.stroke();

      // Draw center line
      ctx.strokeStyle = COLORS.TRACK_CENTER;
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 20]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw borders with depth effect
      const drawBorderWithDepth = (side: -1 | 1) => {
        const halfWidth = seg.width / 2;

        const drawBorderPath = (offset: number) => {
          ctx.beginPath();
          if (seg.type === 'STRAIGHT') {
            const angle = seg.startAngle;
            const perp = angle + (Math.PI / 2 * side);
            const ox = Math.cos(perp) * (halfWidth + offset);
            const oy = Math.sin(perp) * (halfWidth + offset);
            ctx.moveTo(seg.startX + ox, seg.startY + oy);
            ctx.lineTo(seg.endX + ox, seg.endY + oy);
          } else {
            const radius = 1 / seg.curvature;
            const dir = seg.type === 'TURN_LEFT' ? -1 : 1;
            const perpAngle = seg.startAngle + (Math.PI / 2 * dir);
            const cx = seg.startX + Math.cos(perpAngle) * radius;
            const cy = seg.startY + Math.sin(perpAngle) * radius;
            const drawRadius = radius - (side * dir * (halfWidth + offset));
            const startA = perpAngle + Math.PI;
            // Use segment's actual turn angle
            const actualTurnAngle = normalizeAngle(seg.endAngle - seg.startAngle);
            const endA = startA + actualTurnAngle;
            ctx.arc(cx, cy, drawRadius, startA, endA, seg.type === 'TURN_LEFT');
          }
        };

        // Layer 1: Outer shadow (dark)
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        drawBorderPath(side * 3);
        ctx.stroke();

        // Layer 2: Main border
        ctx.lineWidth = 6;
        ctx.strokeStyle = COLORS.TRACK_BORDER;
        drawBorderPath(0);
        ctx.stroke();

        // Layer 3: Inner highlight (bright)
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        drawBorderPath(side * -3);
        ctx.stroke();
      };

      drawBorderWithDepth(-1);
      drawBorderWithDepth(1);
  };

  const drawSkidMarks = (ctx: CanvasRenderingContext2D) => {
      if (skidMarksRef.current.length === 0) return;
      
      ctx.lineWidth = 4;
      
      // Batch drawing by opacity would be better for performance, but simple loop is fine for MVP
      skidMarksRef.current.forEach(mark => {
         ctx.beginPath();
         ctx.strokeStyle = `rgba(0, 0, 0, ${mark.life * 0.3})`; // Black skid marks
         ctx.moveTo(mark.x1, mark.y1);
         ctx.lineTo(mark.x2, mark.y2);
         ctx.stroke();
      });
  };

  const drawEffects = (ctx: CanvasRenderingContext2D) => {
      effectsRef.current.forEach(fx => {
          ctx.save();
          ctx.translate(fx.x, fx.y);
          ctx.rotate(carRef.current.heading + Math.PI/2);
          ctx.globalAlpha = fx.life;
          ctx.fillStyle = fx.color;
          ctx.font = `bold ${32 * fx.scale}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
          ctx.fillText(fx.text, 0, 0);
          ctx.restore();
      });
  };

  const drawSpeedLines = (ctx: CanvasRenderingContext2D, car: CarState) => {
      if (speedLinesRef.current.length === 0) return;

      ctx.save();
      ctx.lineCap = 'round';

      const isFever = scoreRef.current.fever;

      speedLinesRef.current.forEach(line => {
          // Gradient effect: thicker and brighter at the start, fading out
          const gradient = ctx.createLinearGradient(
            line.x, line.y,
            line.x + Math.cos(car.heading) * line.length,
            line.y + Math.sin(car.heading) * line.length
          );

          // Color varies based on fever mode
          const baseColor = isFever ? '236, 72, 153' : '255, 255, 255'; // Pink in fever, white otherwise

          gradient.addColorStop(0, `rgba(${baseColor}, ${line.opacity * 0.6})`);
          gradient.addColorStop(0.5, `rgba(${baseColor}, ${line.opacity * 0.3})`);
          gradient.addColorStop(1, `rgba(${baseColor}, 0)`);

          // Variable line width based on opacity (faster = thicker)
          ctx.lineWidth = 2 + line.opacity * 2;
          ctx.strokeStyle = gradient;

          ctx.beginPath();
          ctx.moveTo(line.x, line.y);
          ctx.lineTo(
            line.x + Math.cos(car.heading) * line.length,
            line.y + Math.sin(car.heading) * line.length
          );
          ctx.stroke();
      });

      ctx.restore();
  };

  const drawCoins = (ctx: CanvasRenderingContext2D) => {
      const currentTime = gameTimeRef.current;
      const coinRadius = GAME_CONSTANTS.COIN_RADIUS;

      coinsRef.current.forEach(coin => {
          ctx.save();
          ctx.translate(coin.x, coin.y);

          if (coin.collected) {
              // Collection animation: scale up and fade out
              const elapsed = currentTime - coin.collectTime;
              const scale = 1 + elapsed * 3;
              const alpha = Math.max(0, 1 - elapsed * 4);
              ctx.scale(scale, scale);
              ctx.globalAlpha = alpha;
          } else {
              // Gentle floating animation
              const floatOffset = Math.sin(currentTime * 3 + coin.id) * 2;
              ctx.translate(0, floatOffset);
          }

          // Coin gradient (gold to amber) - matching HUD style
          const gradient = ctx.createRadialGradient(
              -coinRadius * 0.3, -coinRadius * 0.3, 0,
              0, 0, coinRadius
          );
          gradient.addColorStop(0, '#fef3c7'); // Light gold highlight
          gradient.addColorStop(0.5, '#fcd34d'); // Gold
          gradient.addColorStop(1, '#f59e0b'); // Amber

          // Outer glow
          ctx.beginPath();
          ctx.arc(0, 0, coinRadius + 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(252, 211, 77, 0.3)';
          ctx.fill();

          // Main coin body
          ctx.beginPath();
          ctx.arc(0, 0, coinRadius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          // Inner ring (subtle depth)
          ctx.beginPath();
          ctx.arc(0, 0, coinRadius * 0.7, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Shine highlight
          ctx.beginPath();
          ctx.arc(-coinRadius * 0.3, -coinRadius * 0.3, coinRadius * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fill();

          ctx.restore();
      });
  };

  const drawCoinParticles = (ctx: CanvasRenderingContext2D) => {
      coinParticlesRef.current.forEach(particle => {
          ctx.save();
          ctx.globalAlpha = particle.life;

          // Gold sparkle gradient
          const gradient = ctx.createRadialGradient(
              particle.x, particle.y, 0,
              particle.x, particle.y, particle.size
          );
          gradient.addColorStop(0, '#fef3c7');
          gradient.addColorStop(0.5, '#fcd34d');
          gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');

          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          ctx.restore();
      });
  };

  const drawFeverOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      // Pulsing vignette with fever color
      const pulse = 0.5 + Math.sin(gameTimeRef.current * 8) * 0.2;

      ctx.save();
      const gradient = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.3,
        width / 2, height / 2, height * 0.9
      );
      gradient.addColorStop(0, 'rgba(236, 72, 153, 0)');
      gradient.addColorStop(1, `rgba(236, 72, 153, ${pulse * 0.12})`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Subtle scan lines effect (very subtle, only in fever)
      ctx.globalAlpha = 0.02;
      ctx.fillStyle = '#ffffff';
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1);
      }
      ctx.globalAlpha = 1.0;

      ctx.restore();
  };

  const drawCar = (ctx: CanvasRenderingContext2D, car: CarState) => {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.visualAngle);

      // Use provided car visual config or default based on fever state
      const isFever = scoreRef.current.fever;
      const visualConfig = carVisual || (isFever ? FEVER_CAR_VISUAL : DEFAULT_CAR_VISUAL);

      // Draw enhanced car with all details
      drawEnhancedCar(
        ctx,
        visualConfig,
        car.isDrifting,
        isFever,
        scoreRef.current.feverGauge,
        gameTimeRef.current
      );

      ctx.restore();
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      className="absolute inset-0 z-0 touch-none"
    />
  );
};