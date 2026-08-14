(() => {
  "use strict";

  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  const boardEl = document.getElementById("board");
  const winLineEl = document.getElementById("win-line");
  const winLineCore = document.getElementById("win-line-el");
  const statusEl = document.getElementById("status");
  const statusTextEl = document.getElementById("status-text");
  const statusHintEl = document.getElementById("status-hint");
  const roundNoteEl = document.getElementById("round-note");
  const scoreEls = {
    X: document.getElementById("score-x"),
    O: document.getElementById("score-o"),
    D: document.getElementById("score-draws"),
  };
  const scoreCards = {
    X: document.getElementById("score-card-x"),
    O: document.getElementById("score-card-o"),
  };
  const modeBtns = Array.from(document.querySelectorAll(".mode-btn"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    board: Array(9).fill(null),
    turn: "X",
    mode: "pvp",
    over: null,
    scores: { X: 0, O: 0, D: 0 },
    round: 1,
    cpuTimer: null,
  };

  const cells = [];

  /* ---------- build ---------- */
  function buildBoard() {
    for (let i = 0; i < 9; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.setAttribute("aria-label", cellAria(i, null));
      btn.addEventListener("click", () => onCellClick(i));
      boardEl.appendChild(btn);
      cells.push(btn);
    }
  }

  function cellAria(i, mark) {
    const row = Math.floor(i / 3) + 1;
    const col = (i % 3) + 1;
    return mark
      ? "Cell row " + row + ", column " + col + ", " + mark
      : "Cell row " + row + ", column " + col + ", empty";
  }

  function markSvg(mark) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (mark === "X") {
      svg.classList.add("mark-x");
      const l1 = document.createElementNS(NS, "line");
      l1.setAttribute("x1", "17"); l1.setAttribute("y1", "17");
      l1.setAttribute("x2", "47"); l1.setAttribute("y2", "47");
      l1.setAttribute("pathLength", "1");
      const l2 = document.createElementNS(NS, "line");
      l2.setAttribute("x1", "47"); l2.setAttribute("y1", "17");
      l2.setAttribute("x2", "17"); l2.setAttribute("y2", "47");
      l2.setAttribute("pathLength", "1");
      svg.append(l1, l2);
    } else {
      svg.classList.add("mark-o");
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", "32"); c.setAttribute("cy", "32"); c.setAttribute("r", "15");
      c.setAttribute("pathLength", "1");
      svg.append(c);
    }
    return svg;
  }

  /* ---------- game flow ---------- */
  function onCellClick(i) {
    if (state.over) return;
    if (state.mode === "cpu" && state.turn === "O") return;
    place(i);
  }

  function place(i) {
    if (state.board[i]) return;
    state.board[i] = state.turn;
    const cell = cells[i];
    cell.appendChild(markSvg(state.turn));
    cell.classList.add("is-filled");
    cell.setAttribute("aria-label", cellAria(i, state.turn));

    const result = evaluate();
    if (result) {
      finish(result);
    } else {
      state.turn = state.turn === "X" ? "O" : "X";
      updateStatus();
      if (state.mode === "cpu" && state.turn === "O") scheduleCpu();
    }
  }

  function evaluate() {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
        return { winner: state.board[a], line };
      }
    }
    if (state.board.every(Boolean)) return { winner: null, line: null };
    return null;
  }

  function finish(result) {
    state.over = result;
    clearCpuTimer();
    updateStatus();
    if (result.winner) {
      state.scores[result.winner]++;
      const winCls = result.winner === "X" ? "is-win-x" : "is-win-o";
      boardEl.classList.add("is-won");
      result.line.forEach((i) => cells[i].classList.add(winCls));
      drawWinLine(result.winner, result.line);
      setStatus(result.winner + " wins the round!", "is-won-" + result.winner.toLowerCase());
      if (!reduceMotion) burst(result.winner);
    } else {
      state.scores.D++;
      boardEl.classList.add("is-draw");
      setStatus("It's a draw.", "is-draw");
    }
    roundNoteEl.textContent = "Round " + state.round + " · Board complete";
    renderScores();
  }

  function newRound() {
    clearCpuTimer();
    state.board = Array(9).fill(null);
    state.turn = "X";
    state.over = null;
    state.round += 1;
    boardEl.classList.remove("is-won", "is-draw", "is-locked");
    cells.forEach((c, i) => {
      c.innerHTML = "";
      c.className = "cell";
      c.setAttribute("aria-label", cellAria(i, null));
    });
    resetWinLine();
    updateStatus();
    renderScores();
    roundNoteEl.textContent = "Round " + state.round + " · New board";
  }

  function resetScore() {
    state.scores = { X: 0, O: 0, D: 0 };
    state.round = 0;
    newRound();
  }

  function setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    modeBtns.forEach((b) => {
      const active = b.dataset.mode === mode;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    scoreCards.X.querySelector(".score-label").textContent = mode === "cpu" ? "You (X)" : "X wins";
    scoreCards.O.querySelector(".score-label").textContent = mode === "cpu" ? "CPU (O)" : "O wins";
    statusHintEl.textContent = mode === "cpu" ? "You are X" : "";
    state.scores = { X: 0, O: 0, D: 0 };
    state.round = 0;
    newRound();
  }

  /* ---------- cpu ---------- */
  function scheduleCpu() {
    clearCpuTimer();
    boardEl.classList.add("is-locked");
    state.cpuTimer = setTimeout(() => {
      state.cpuTimer = null;
      boardEl.classList.remove("is-locked");
      place(cpuMove());
    }, reduceMotion ? 150 : 450);
  }

  function cpuMove() {
    const b = state.board;
    const attack = findThreat("O");
    if (attack !== -1) return attack;
    const block = findThreat("X");
    if (block !== -1) return block;
    if (!b[4]) return 4;
    const corners = [0, 2, 6, 8].filter((i) => !b[i]);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    const edges = [1, 3, 5, 7].filter((i) => !b[i]);
    if (edges.length) return edges[Math.floor(Math.random() * edges.length)];
    return b.indexOf(null);
  }

  function findThreat(mark) {
    for (const line of WIN_LINES) {
      const vals = line.map((i) => state.board[i]);
      if (vals.filter((v) => v === mark).length === 2 && vals.includes(null)) {
        return line[vals.indexOf(null)];
      }
    }
    return -1;
  }

  function clearCpuTimer() {
    if (state.cpuTimer) {
      clearTimeout(state.cpuTimer);
      state.cpuTimer = null;
    }
  }

  /* ---------- rendering ---------- */
  function setStatus(text, cls) {
    statusTextEl.textContent = text;
    statusEl.className = "status" + (cls ? " " + cls : "");
  }

  function updateStatus() {
    const over = state.over;
    if (!over) {
      const text = state.mode === "cpu"
        ? (state.turn === "X" ? "Your turn" : "CPU is thinking…")
        : state.turn + "'s turn";
      setStatus(text, "is-" + state.turn.toLowerCase());
    }
    boardEl.classList.toggle("board--turn-x", !over && state.turn === "X");
    boardEl.classList.toggle("board--turn-o", !over && state.turn === "O");
    scoreCards.X.classList.toggle("is-turn", !over && state.turn === "X");
    scoreCards.O.classList.toggle("is-turn", !over && state.turn === "O");
  }

  function renderScores() {
    scoreEls.X.textContent = String(state.scores.X);
    scoreEls.O.textContent = String(state.scores.O);
    scoreEls.D.textContent = String(state.scores.D);
  }

  function cellCenter(i) {
    return { x: 65 + (i % 3) * 115, y: 65 + Math.floor(i / 3) * 115 };
  }

  function drawWinLine(winner, line) {
    const a = cellCenter(line[0]);
    const b = cellCenter(line[2]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const pad = 20;
    const ux = dx / len;
    const uy = dy / len;
    winLineCore.setAttribute("x1", String(a.x - ux * pad));
    winLineCore.setAttribute("y1", String(a.y - uy * pad));
    winLineCore.setAttribute("x2", String(b.x + ux * pad));
    winLineCore.setAttribute("y2", String(b.y + uy * pad));
    winLineEl.classList.add(winner === "X" ? "win-line--x" : "win-line--o");
    winLineEl.classList.remove("is-anim");
    void winLineCore.getBoundingClientRect();
    winLineEl.classList.add("is-anim");
  }

  function resetWinLine() {
    winLineEl.classList.remove("win-line--x", "win-line--o", "is-anim");
    winLineCore.setAttribute("x1", "0");
    winLineCore.setAttribute("y1", "0");
    winLineCore.setAttribute("x2", "0");
    winLineCore.setAttribute("y2", "0");
  }

  function burst(winner) {
    const color = winner === "X" ? "var(--accent)" : "var(--info)";
    const rect = boardEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 22; i++) {
      const s = document.createElement("span");
      s.className = "confetti";
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 170;
      s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      s.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      s.style.setProperty("--rot", Math.random() * 540 - 270 + "deg");
      s.style.left = cx + "px";
      s.style.top = cy + "px";
      s.style.background = color;
      if (Math.random() > 0.5) s.style.borderRadius = "50%";
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 950);
    }
  }

  /* ---------- init ---------- */
  buildBoard();
  modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.getElementById("btn-new-round").addEventListener("click", newRound);
  document.getElementById("btn-reset").addEventListener("click", resetScore);
  updateStatus();
  renderScores();
})();
