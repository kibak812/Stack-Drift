# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stack-Drift is a mobile-first endless drifting game built with React, TypeScript, and Canvas. Players control a car that auto-accelerates through procedurally generated tracks, earning points by drifting through turns.

## Commands

```bash
npm install    # Install dependencies
npm run dev    # Start development server (Vite)
npm run build  # Production build
npm run deploy # Deploy to GitHub Pages (runs build first)
```

## Architecture

### App State Flow
`App.tsx` manages three states via `AppState` enum:
- **MENU** - Main menu (GameEngine unmounted)
- **PLAYING** - Active gameplay (GameEngine + GameHUD)
- **RESULT** - Game over screen with revive option (GameEngine stays mounted as background)

### Core Components

**GameEngine.tsx** (~1000 lines) - The heart of the game:
- Canvas-based rendering with camera following car
- Procedural track generation with anti-collision detection
- Physics system: car movement, drift mechanics, collision detection
- Scoring: combo system, Perfect/Good ratings, Fever mode
- Key refs: `carRef`, `trackRef`, `scoreRef`, `currentSegmentIndexRef`

**GameHUD.tsx** - In-game overlay showing score, combo, fever status

**ResultScreen.tsx** - Game over UI with one-time revive option

### Key Game Systems

**Track Generation** (`generateSegment`, `createSegmentData`):
- Segments are STRAIGHT, TURN_LEFT, or TURN_RIGHT
- Dynamic difficulty: turn radius decreases with score
- Anti-spiral logic prevents consecutive same-direction turns
- Collision detection ensures new segments don't overlap old track

**Revive System**:
- On revive, clears track ahead and generates straight safety zone
- Controlled by `REVIVE_STRAIGHT_SEGMENTS` constant

**Fever Mode**:
- Gauge fills with Perfect/Good turns
- At 100%, activates 2x score multiplier for limited time

### Configuration

**constants.ts** - All tunable game parameters:
- Physics: `BASE_SPEED`, `MAX_TURN_STRENGTH`, drift feel
- Track: widths, segment lengths, turn radii
- Scoring: combo multipliers, fever thresholds

**types.ts** - TypeScript interfaces for game state

### Utils

**utils/math.ts** - Geometry helpers: `lerp`, `normalizeAngle`, `distance`, `closestPointOnLine`
