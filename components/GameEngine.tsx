import React, { useEffect, useRef, useCallback, useState } from 'react';
import { GameScore, TurnQuality, TrackSegment, CarState, FloatingText, SkidMark } from '../types';
import { GAME_CONSTANTS, COLORS } from '../constants';
import { lerp, normalizeAngle, distance, closestPointOnLine } from '../utils/math';

interface GameEngineProps {
  onGameOver: (score: GameScore) => void;
  onScoreUpdate: (score: GameScore) => void;
  isReviving: boolean; 
}

// Helper: Calculate distance from point to segment geometry
const getDistanceFromSegment = (seg: TrackSegment, pX: number, pY: number) => {
    if (seg.type === 'STRAIGHT') {
        const p = closestPointOnLine(seg.startX, seg.startY, seg.endX, seg.endY, pX, pY);
        return distance(pX, pY, p.x, p.y);
    } else {
        const radius = GAME_CONSTANTS.SEGMENT_RADIUS_TURN;
        const dir = seg.type === 'TURN_LEFT' ? -1 : 1;
        const perpAngle = seg.startAngle + (Math.PI / 2 * dir);
        const cx = seg.startX + Math.cos(perpAngle) * radius;
        const cy = seg.startY + Math.sin(perpAngle) * radius;
        
        const distToCenter = distance(pX, pY, cx, cy);
        return Math.abs(distToCenter - radius);
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

// Duplicated helper for use inside component (or we could extract it out, but for minimal diff keep local)
const createSegmentData = (prevSeg: TrackSegment, type: 'STRAIGHT' | 'TURN_LEFT' | 'TURN_RIGHT', calculatedWidth: number): TrackSegment => {
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
      const radius = GAME_CONSTANTS.SEGMENT_RADIUS_TURN;
      const turnAngle = Math.PI / 2; 
      const direction = type === 'TURN_LEFT' ? -1 : 1;
      const endAngle = normalizeAngle(startAngle + (turnAngle * direction));
      
      const perpAngle = startAngle + (Math.PI / 2 * direction);
      const cx = startX + Math.cos(perpAngle) * radius;
      const cy = startY + Math.sin(perpAngle) * radius;
      
      const ex = cx + Math.cos(endAngle - (Math.PI / 2 * direction)) * radius;
      const ey = cy + Math.sin(endAngle - (Math.PI / 2 * direction)) * radius;

      return {
        id, type, length: (Math.PI * radius) / 2, curvature: 1/radius,
        startAngle, endAngle,
        startX, startY,
        endX: ex, endY: ey,
        width: calculatedWidth
      };
    }
};

export const GameEngine: React.FC<GameEngineProps> = ({ onGameOver, onScoreUpdate, isReviving }) => {
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
    score: 0, highScore: 0, combo: 0, coins: 0, lastQuality: TurnQuality.NONE, fever: false, feverTimer: 0
  });
  
  // Initialize Track immediately so it's never empty
  const trackRef = useRef<TrackSegment[]>([createInitialSegment()]);
  
  const cameraRef = useRef({ x: 0, y: 0, zoom: 0.8 });
  const effectsRef = useRef<FloatingText[]>([]);
  const skidMarksRef = useRef<SkidMark[]>([]); // New: Skid Marks
  const lastTirePosRef = useRef<{lx: number, ly: number, rx: number, ry: number} | null>(null); // For continuous lines
  
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

  // --- Track Generation Logic ---
  const isPositionSafe = (x: number, y: number, history: TrackSegment[]): boolean => {
      const lookbackLimit = Math.max(0, history.length - 40); // Look back further
      const safeDistance = GAME_CONSTANTS.TRACK_WIDTH_START + 80; // Slightly larger margin

      // Check against older segments (skipping immediate 4 previous ones)
      for (let i = history.length - 4; i >= lookbackLimit; i--) {
          const seg = history[i];
          const dist = getDistanceFromSegment(seg, x, y);
          if (dist < safeDistance) {
              return false;
          }
      }
      return true;
  };

  // Prevent spirals by checking recent turn history
  const getRecentTurnBias = (history: TrackSegment[], limit: number = 6) => {
      let balance = 0; // Negative = Left heavy, Positive = Right heavy
      const start = Math.max(0, history.length - limit);
      for(let i=start; i<history.length; i++) {
          if (history[i].type === 'TURN_LEFT') balance--;
          if (history[i].type === 'TURN_RIGHT') balance++;
      }
      return balance;
  };

  const generateSegment = (prevSeg: TrackSegment | null): TrackSegment => {
    if (!prevSeg) {
       return createInitialSegment();
    }

    const calculatedWidth = Math.max(
        GAME_CONSTANTS.TRACK_WIDTH_END,
        GAME_CONSTANTS.TRACK_WIDTH_START - ((prevSeg.id + 1) * GAME_CONSTANTS.TRACK_NARROWING_RATE)
    );

    // FIX: Force first few segments to be STRAIGHT to avoid spawn overlaps
    if (prevSeg.id < 4) {
        return createSegmentData(prevSeg, 'STRAIGHT', calculatedWidth);
    }

    // candidates selection
    let candidates: ('STRAIGHT' | 'TURN_LEFT' | 'TURN_RIGHT')[] = [];
    
    // Bias logic: prevent spiraling
    const balance = getRecentTurnBias(trackRef.current, 6);
    
    // If balance is too negative (Too many Lefts), force Right or Straight
    // If balance is too positive (Too many Rights), force Left or Straight
    let preferredTurn: 'TURN_LEFT' | 'TURN_RIGHT' = Math.random() > 0.5 ? 'TURN_LEFT' : 'TURN_RIGHT';
    
    if (balance <= -2) preferredTurn = 'TURN_RIGHT';
    else if (balance >= 2) preferredTurn = 'TURN_LEFT';
    
    const otherTurn = preferredTurn === 'TURN_LEFT' ? 'TURN_RIGHT' : 'TURN_LEFT';

    if (prevSeg.type === 'STRAIGHT') {
        candidates = [preferredTurn, 'STRAIGHT', otherTurn];
    } else {
        candidates = ['STRAIGHT', preferredTurn, otherTurn];
    }

    // Try ALL candidates to find a safe path
    for (const type of candidates) {
        const candidateSeg = createSegmentData(prevSeg, type, calculatedWidth);
        if (isPositionSafe(candidateSeg.endX, candidateSeg.endY, trackRef.current)) {
            return candidateSeg;
        }
    }

    // Fallback: Force Straight even if unsafe (prevents track exhaustion)
    return createSegmentData(prevSeg, 'STRAIGHT', calculatedWidth); 
  };
  // --- End Track Generation Logic ---

  // NOTE: Initialization is now handled by initial useRef values and the fill buffer loop below.
  // This removes the need for useEffect initialization which can race against requestAnimationFrame.
  const fillInitialBuffer = useCallback(() => {
    // Only fill if needed (initial render)
    if (trackRef.current.length < 2) {
        for (let i = 0; i < 15; i++) {
            trackRef.current.push(generateSegment(trackRef.current[trackRef.current.length - 1]));
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
        carRef.current.isCrashed = false;
        carRef.current.isDrifting = false;
        carRef.current.x = safeSeg.startX;
        carRef.current.y = safeSeg.startY;
        carRef.current.heading = safeSeg.startAngle;
        carRef.current.visualAngle = safeSeg.startAngle;
        carRef.current.speed = GAME_CONSTANTS.BASE_SPEED; 
        currentTurnRateRef.current = 0;
        inputDirRef.current = 0;
        effectsRef.current = [];
        skidMarksRef.current = []; // Clear skids on revive
        lastTirePosRef.current = null;
        framesRef.current = 0; // Reset safe frames on revive
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
        // Car visual dimensions approx: 30 long (-15 to +15), 20 wide (-10 to +10)
        // Rear axle approx at x = -15
        const rearAxleX = -15;
        const tireY = 10;
        
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
                const radius = GAME_CONSTANTS.SEGMENT_RADIUS_TURN;
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
    
    // 3. Track Gen - Ensure Large buffer
    while (trackRef.current.length < currentSegmentIndexRef.current + GAME_CONSTANTS.TRACK_GENERATION_BUFFER) {
        const last = trackRef.current[trackRef.current.length - 1];
        trackRef.current.push(generateSegment(last));
    }
    
    // 4. Fever Logic
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
          scoreRef.current.score += 10;
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
      if (scoreRef.current.combo >= 15) multiplier = 4;
      else if (scoreRef.current.combo >= 10) multiplier = 3;
      else if (scoreRef.current.combo >= 5) multiplier = 2;

      const baseScore = 100;
      const points = quality === TurnQuality.PERFECT ? baseScore * multiplier : baseScore;

      scoreRef.current.score += points;
      scoreRef.current.coins += Math.floor(points / 20);
      scoreRef.current.lastQuality = quality;

      if (quality === TurnQuality.PERFECT) {
          spawnFloatingText("PERFECT!", COLORS.PERFECT, carRef.current.x, carRef.current.y, 1.5);
          spawnFloatingText(`+${points}`, COLORS.TEXT_WHITE, carRef.current.x, carRef.current.y - 40, 1.0);
          
          if (scoreRef.current.combo >= GAME_CONSTANTS.FEVER_THRESHOLD && !scoreRef.current.fever) {
              scoreRef.current.fever = true;
              scoreRef.current.feverTimer = GAME_CONSTANTS.FEVER_DURATION;
          }
      } else {
          spawnFloatingText("GOOD", COLORS.GOOD, carRef.current.x, carRef.current.y, 1.0);
          spawnFloatingText(`+${points}`, COLORS.TEXT_WHITE, carRef.current.x, carRef.current.y - 30, 0.8);
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
    ctx.translate(width / 2, height * 0.8); 
    ctx.scale(cameraRef.current.zoom, cameraRef.current.zoom);
    ctx.rotate(-car.heading - Math.PI/2);
    ctx.translate(-cameraRef.current.x, -cameraRef.current.y);
    
    drawTrack(ctx);
    drawSkidMarks(ctx); // Render skids before car but after track
    drawCar(ctx, car);
    drawEffects(ctx);
    
    ctx.restore();

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
      
      const windowSize = GAME_CONSTANTS.RENDER_WINDOW_SIZE; 
      const activeStart = Math.max(0, curr - windowSize);
      const activeEnd = Math.min(total, curr + windowSize);

      const renderPass = (start: number, end: number, isDimmed: boolean) => {
          if (start >= end) return;
          ctx.globalAlpha = isDimmed ? 0.3 : 1.0; 
          for(let i=start; i<end; i++) {
             const seg = trackRef.current[i];
             drawSegment(ctx, seg);
          }
          ctx.globalAlpha = 1.0; // Reset
      };

      // Pass 1: Background Past
      renderPass(0, activeStart, true);
      // Pass 2: Background Future
      renderPass(activeEnd, total, true);
      // Pass 3: Active Foreground
      renderPass(activeStart, activeEnd, false);
  };

  const drawSegment = (ctx: CanvasRenderingContext2D, seg: TrackSegment) => {
      ctx.beginPath();
      ctx.lineWidth = seg.width;
      ctx.strokeStyle = (seg.id % 2 === 0) ? COLORS.TRACK_FG_EVEN : COLORS.TRACK_FG_ODD;
      
      if (seg.type === 'STRAIGHT') {
          ctx.moveTo(seg.startX, seg.startY);
          ctx.lineTo(seg.endX, seg.endY);
      } else {
           const radius = GAME_CONSTANTS.SEGMENT_RADIUS_TURN;
           const dir = seg.type === 'TURN_LEFT' ? -1 : 1;
           const perpAngle = seg.startAngle + (Math.PI / 2 * dir);
           const cx = seg.startX + Math.cos(perpAngle) * radius;
           const cy = seg.startY + Math.sin(perpAngle) * radius;
           const startA = perpAngle + Math.PI; 
           const endA = startA + (Math.PI/2 * dir);
           ctx.arc(cx, cy, radius, startA, endA, seg.type === 'TURN_LEFT');
      }
      ctx.stroke();

      ctx.strokeStyle = COLORS.TRACK_CENTER;
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 20]);
      ctx.stroke();
      ctx.setLineDash([]);

      const drawBorder = (side: -1 | 1) => {
        const halfWidth = seg.width / 2;
        ctx.beginPath();
        ctx.lineWidth = 10;
        ctx.strokeStyle = COLORS.TRACK_BORDER;
        
        if (seg.type === 'STRAIGHT') {
            const angle = seg.startAngle;
            const perp = angle + (Math.PI / 2 * side); 
            const ox = Math.cos(perp) * halfWidth;
            const oy = Math.sin(perp) * halfWidth;
            
            ctx.moveTo(seg.startX + ox, seg.startY + oy);
            ctx.lineTo(seg.endX + ox, seg.endY + oy);
        } else {
            const radius = GAME_CONSTANTS.SEGMENT_RADIUS_TURN;
            const dir = seg.type === 'TURN_LEFT' ? -1 : 1;
            const perpAngle = seg.startAngle + (Math.PI / 2 * dir);
            const cx = seg.startX + Math.cos(perpAngle) * radius;
            const cy = seg.startY + Math.sin(perpAngle) * radius;
            const drawRadius = radius - (side * dir * halfWidth);
            const startA = perpAngle + Math.PI; 
            const endA = startA + (Math.PI/2 * dir);
            ctx.arc(cx, cy, drawRadius, startA, endA, seg.type === 'TURN_LEFT');
        }
        ctx.stroke();
      };
      drawBorder(-1);
      drawBorder(1);
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

  const drawCar = (ctx: CanvasRenderingContext2D, car: CarState) => {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.visualAngle);
      
      ctx.fillStyle = scoreRef.current.fever ? COLORS.CAR_FEVER : COLORS.CAR;
      
      ctx.beginPath();
      ctx.rect(-15, -10, 30, 20); 
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.fillRect(10, -8, 5, 4);
      ctx.fillRect(10, 4, 5, 4);
      
      if (car.isDrifting) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = scoreRef.current.fever ? '#f0f' : '#fff';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.arc(-20, 10, 5, 0, Math.PI * 2);
          ctx.arc(-20, -10, 5, 0, Math.PI * 2);
          ctx.fill();
      }
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