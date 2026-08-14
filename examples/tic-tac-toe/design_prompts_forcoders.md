# Tic Tac Toe — Design Brief (Design Studio mockup)

## Purpose
A polished, self-contained Tic Tac Toe game screen showcasing the Sal7one Dark
visual language. Built as an interactive demo mockup: fully playable in the
browser, with all state local to the preview session.

## Audience
Anyone evaluating the Design Studio output — the game should feel like a
production-quality screen, not a wireframe.

## Layout (top to bottom, centered column, max-width 460px)
1. Masthead — logo tile (overlapping X stroke + O ring) beside the title
   "Tic Tac Toe" and subtitle "First to three in a row wins".
2. Mode segmented control — "2 Players" | "vs CPU" pill toggle.
3. Scoreboard — three stat cards: X wins (violet), Draws (muted), O wins
   (blue). The card of the player whose turn it is gets a matching glow ring.
   In vs CPU mode the labels read "You (X)" and "CPU (O)".
4. Board — 3x3 grid of rounded tiles on the panel2 surface. Empty tiles show
   a hover glow tinted to the current player's color. X is drawn with two
   violet strokes, O as a blue ring; both animate with a stroke-draw effect.
5. Status bar — pulsing dot + text ("X's turn", "Your turn",
   "CPU is thinking…", "X wins the round!", "It's a draw."). Winner text is
   tinted to the winner's color.
6. Actions — primary "New Round" (accent fill) and ghost "Reset Score".
7. Footer — one-line honesty note: demo mockup, scores are local.

## Visual direction
- Token set: Sal7one Dark — bg #0b0e14, panel #141a26, panel2 #1a2233,
  border #24304a, text #e6ebf5, muted #8894ab, accent #a78bfa,
  info #60a5fa, warn #fbbf24, ok #4ade80, err #f87171.
- X = accent violet, O = info blue. Both get soft drop-shadow glows.
- Dark radial background glows (violet top, blue bottom) behind the page.
- Radius 12–14px, 12px grid gaps, tabular numerals in scores.
- Winning three-in-a-row: cells glow in the winner's color, all other cells
  dim, and a glowing stroke draws across the winning line.
- A short confetti burst fires from the board center on a win (suppressed
  under prefers-reduced-motion).

## Interactions & states
- Empty board — honest starting state, all tiles clickable, X goes first.
- Playing — hover/focus feedback on every playable tile; marks animate in.
- CPU turn — board briefly locks ("CPU is thinking…") then the CPU plays a
  win > block > center > corner > edge heuristic. The CPU is a deterministic
  demo heuristic, not a real model — do not label it as AI intelligence.
- Won — score increments, winning line draws, winner status, confetti.
- Draw — all tiles dim, amber "It's a draw." status.
- New Round — clears the board, keeps scores, round counter increments.
- Reset Score — zeros the scoreboard and restarts at round 1.
- Mode switch — resets the whole session state (scores included).

## Honest data rules
- No live endpoints, no network calls, no localStorage; nothing fabricated.
- Scores and round numbers reflect only moves actually played this session.

## Accessibility
- Every tile is a real button with an aria-label (row, column, state).
- Status region has role="status" + aria-live="polite".
- Visible focus rings, keyboard-playable, prefers-reduced-motion respected.

## Files
- html/index.html — static structure
- css/style.css — tokens (Sal7one Dark), layout, states, animations
- js/app.js — game logic, CPU heuristic, win-line geometry, confetti
