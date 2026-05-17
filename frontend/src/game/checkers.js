export const BOARD_SIZE = 8;
export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export const PLAYERS = {
  white: { name: "Azure", direction: -1, kingRow: 0, enemy: "black" },
  black: { name: "Amber", direction: 1, kingRow: 7, enemy: "white" },
};

export function createInitialBoard() {
  const board = createEmptyBoard();
  let blackId = 1;
  let whiteId = 1;

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (isDarkSquare(row, col)) {
        board[row][col] = { id: `black-${blackId}`, player: "black", king: false };
        blackId += 1;
      }
    }
  }

  for (let row = 5; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (isDarkSquare(row, col)) {
        board[row][col] = { id: `white-${whiteId}`, player: "white", king: false };
        whiteId += 1;
      }
    }
  }

  return board;
}

export function createBoardFromCoordinates(white = [], black = []) {
  const board = createEmptyBoard();
  white.forEach((coord, index) => {
    const square = coordToSquare(coord);
    board[square.row][square.col] = {
      id: `white-scenario-${index + 1}`,
      player: "white",
      king: false,
    };
  });
  black.forEach((coord, index) => {
    const square = coordToSquare(coord);
    board[square.row][square.col] = {
      id: `black-scenario-${index + 1}`,
      player: "black",
      king: false,
    };
  });
  return board;
}

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

export function getLegalMoves(board, player, options = {}) {
  const captures = [];
  const quietMoves = [];

  if (options.forcedFrom) {
    const piece = board[options.forcedFrom.row]?.[options.forcedFrom.col];
    if (!piece || piece.player !== player) {
      return [];
    }
    return getCapturesForPiece(board, options.forcedFrom.row, options.forcedFrom.col, piece, options);
  }

  forEachPiece(board, player, ({ row, col, piece }) => {
    captures.push(...getCapturesForPiece(board, row, col, piece, options));
    quietMoves.push(...getQuietMovesForPiece(board, row, col, piece, options));
  });

  if (captures.length > 0) {
    return captures;
  }

  if (options.passiveId === "open_roads") {
    quietMoves.push(...getOpenRoadsMoves(board, player));
  }

  return quietMoves;
}

export function getQuietMovesForPiece(board, row, col, piece, options = {}) {
  if (piece.king) {
    return getFlyingKingQuietMoves(board, row, col, options);
  }

  return getDirections(piece)
    .map(([rowDelta, colDelta]) => ({
      from: { row, col },
      to: { row: row + rowDelta, col: col + colDelta },
      captured: null,
    }))
    .filter((move) => isInsideBoard(move.to.row, move.to.col))
    .filter((move) => !board[move.to.row][move.to.col])
    .filter((move) => !isBlocked(move.to, options.blockedSquares, "quiet"));
}

export function getCapturesForPiece(board, row, col, piece, options = {}) {
  if (piece.king) {
    return getFlyingKingCaptures(board, row, col, piece, options);
  }

  return getCaptureDirections(piece, options)
    .map(({ rowDelta, colDelta, powerId }) => {
      const captured = { row: row + rowDelta, col: col + colDelta };
      const to = { row: row + rowDelta * 2, col: col + colDelta * 2 };
      return { from: { row, col }, to, captured, powerId };
    })
    .filter((move) => isInsideBoard(move.to.row, move.to.col))
    .filter((move) => {
      const target = board[move.captured.row]?.[move.captured.col];
      return target && target.player !== piece.player && !board[move.to.row][move.to.col] && !isProtected(move.captured, options.protectedSquares, target);
    })
    .filter((move) => !isBlocked(move.to, options.blockedSquares, "all"));
}

export function getFlyingKingQuietMoves(board, row, col, options = {}) {
  const moves = [];
  getAllDiagonalDirections().forEach(([rowDelta, colDelta]) => {
    let nextRow = row + rowDelta;
    let nextCol = col + colDelta;
    while (isInsideBoard(nextRow, nextCol)) {
      if (board[nextRow][nextCol]) {
        break;
      }
      const to = { row: nextRow, col: nextCol };
      if (!isBlocked(to, options.blockedSquares, "quiet")) {
        moves.push({ from: { row, col }, to, captured: null });
      }
      nextRow += rowDelta;
      nextCol += colDelta;
    }
  });
  return moves;
}

export function getFlyingKingCaptures(board, row, col, piece, options = {}) {
  const moves = [];
  getAllDiagonalDirections().forEach(([rowDelta, colDelta]) => {
    let nextRow = row + rowDelta;
    let nextCol = col + colDelta;
    let captured = null;
    while (isInsideBoard(nextRow, nextCol)) {
      const target = board[nextRow][nextCol];
      if (!captured) {
        if (!target) {
          nextRow += rowDelta;
          nextCol += colDelta;
          continue;
        }
        if (target.player === piece.player || isProtected({ row: nextRow, col: nextCol }, options.protectedSquares, target)) {
          break;
        }
        captured = { row: nextRow, col: nextCol };
        nextRow += rowDelta;
        nextCol += colDelta;
        continue;
      }
      if (target) {
        break;
      }
      const to = { row: nextRow, col: nextCol };
      if (!isBlocked(to, options.blockedSquares, "all")) {
        moves.push({ from: { row, col }, to, captured });
      }
      nextRow += rowDelta;
      nextCol += colDelta;
    }
  });
  return moves;
}

export function getOpenRoadsMoves(board, player = "white") {
  const moves = [];
  const backwardDirection = -PLAYERS[player].direction;
  forEachPiece(board, player, ({ row, col, piece }) => {
    if (piece.king) {
      return;
    }
    [
      [backwardDirection, -1],
      [backwardDirection, 1],
    ].forEach(([rowDelta, colDelta]) => {
      const to = { row: row + rowDelta, col: col + colDelta };
      if (isInsideBoard(to.row, to.col) && isDarkSquare(to.row, to.col) && !board[to.row][to.col]) {
        moves.push({ from: { row, col }, to, captured: null, passiveId: "open_roads" });
      }
    });
  });
  return moves;
}

export function getDashMoves(board, row, col, player = "white") {
  const piece = board[row]?.[col];
  if (!piece || piece.player !== player || piece.king) {
    return [];
  }

  return [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]
    .map(([rowDelta, colDelta]) => {
      const middle = { row: row + rowDelta, col: col + colDelta };
      const to = { row: row + rowDelta * 2, col: col + colDelta * 2 };
      return { from: { row, col }, to, middle, captured: null, powerId: "dash" };
    })
    .filter((move) => isInsideBoard(move.to.row, move.to.col))
    .filter((move) => !board[move.middle.row]?.[move.middle.col] && !board[move.to.row][move.to.col]);
}

export function getPhaseShiftMoves(board, row, col, player = "white") {
  const piece = board[row]?.[col];
  if (!piece || piece.player !== player || piece.king) {
    return [];
  }

  const moves = [];
  for (let targetRow = 0; targetRow < BOARD_SIZE; targetRow += 1) {
    for (let targetCol = 0; targetCol < BOARD_SIZE; targetCol += 1) {
      const rowDistance = Math.abs(targetRow - row);
      const colDistance = Math.abs(targetCol - col);
      if (!rowDistance && !colDistance) {
        continue;
      }
      if (Math.max(rowDistance, colDistance) > 3) {
        continue;
      }
      if (!isDarkSquare(targetRow, targetCol) || board[targetRow][targetCol]) {
        continue;
      }
      moves.push({
        from: { row, col },
        to: { row: targetRow, col: targetCol },
        captured: null,
        powerId: "phase_shift",
      });
    }
  }
  return moves;
}

export function getSunLanceMoves(board, row, col, player = "white", options = {}) {
  const piece = board[row]?.[col];
  if (!piece || piece.player !== player || piece.king) {
    return [];
  }

  return getFlyingKingCaptures(board, row, col, piece, options)
    .map((move) => ({ ...move, powerId: "sun_lance" }));
}

export function applyMove(board, move) {
  const next = cloneBoard(board);
  const piece = next[move.from.row][move.from.col];
  const promoted = !piece.king && move.to.row === PLAYERS[piece.player].kingRow;
  const capturedPiece = move.captured ? next[move.captured.row][move.captured.col] : null;

  next[move.from.row][move.from.col] = null;
  if (move.captured) {
    next[move.captured.row][move.captured.col] = null;
  }
  next[move.to.row][move.to.col] = { ...piece, king: piece.king || promoted };

  return { board: next, piece, capturedPiece, promoted };
}

export function chooseAiMove(board, level = "beginner", options = {}) {
  const moves = getLegalMoves(board, "black", options);
  if (moves.length === 0) {
    return null;
  }

  if (level === "beginner") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (level === "coach") {
    return moves
      .map((move) => ({ move, score: minimaxMove(board, move, "black", 3, options) + personalityScore(board, move, options.aiPersonality) }))
      .sort((a, b) => b.score - a.score)[0].move;
  }

  return moves
    .map((move) => ({ move, score: scoreMove(board, move, level, options) }))
    .sort((a, b) => b.score - a.score)[0].move;
}

export function countPieces(board) {
  const counts = { white: 0, black: 0 };
  board.flat().forEach((piece) => {
    if (piece) {
      counts[piece.player] += 1;
    }
  });
  return counts;
}

export function getWinner(board, playerToMove, options = {}) {
  const counts = countPieces(board);
  if (counts.white === 0) {
    return "black";
  }
  if (counts.black === 0) {
    return "white";
  }
  if (getLegalMoves(board, playerToMove, options).length === 0) {
    return PLAYERS[playerToMove].enemy;
  }
  return null;
}

export function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

export function squareName(square) {
  return `${FILES[square.col]}${BOARD_SIZE - square.row}`;
}

export function coordToSquare(coord) {
  return {
    col: FILES.indexOf(coord[0].toLowerCase()),
    row: BOARD_SIZE - Number(coord.slice(1)),
  };
}

export function isDarkSquare(row, col) {
  return (row + col) % 2 === 1;
}

export function isSameSquare(a, b) {
  return Boolean(a && b && a.row === b.row && a.col === b.col);
}

export function forEachPiece(board, player, callback) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece && (!player || piece.player === player)) {
        callback({ row, col, piece });
      }
    }
  }
}

function getDirections(piece) {
  if (piece.king) {
    return getAllDiagonalDirections();
  }
  return [
    [PLAYERS[piece.player].direction, -1],
    [PLAYERS[piece.player].direction, 1],
  ];
}

function getCaptureDirections(piece, options = {}) {
  return getAllDiagonalDirections().map(([rowDelta, colDelta]) => {
    const backward = !piece.king && rowDelta === -PLAYERS[piece.player].direction;
    return {
      rowDelta,
      colDelta,
      powerId: piece.id === options.allowBackwardCapturePieceId && backward ? "sun_lance" : undefined,
    };
  });
}

function getAllDiagonalDirections() {
  return [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
}

function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function isBlocked(square, blockedSquares = [], kind) {
  return blockedSquares.some((blocked) => {
    const sameSquare = blocked.row === square.row && blocked.col === square.col;
    return sameSquare && (blocked.kind === "all" || blocked.kind === kind);
  });
}

function isProtected(square, protectedSquares = [], piece = null) {
  return protectedSquares.some((protectedSquare) => {
    if (protectedSquare.pieceId && piece?.id) {
      return protectedSquare.pieceId === piece.id;
    }
    return protectedSquare.row === square.row && protectedSquare.col === square.col;
  });
}

function scoreMove(board, move, level, options = {}) {
  const { board: next, promoted } = applyMove(board, move);
  const counts = countPieces(next);
  const material = counts.black - counts.white;
  const capture = move.captured ? 6 : 0;
  const crown = promoted ? 3 : 0;
  const center = move.to.row >= 2 && move.to.row <= 5 && move.to.col >= 2 && move.to.col <= 5 ? 1 : 0;
  const replyCaptures = getLegalMoves(next, "white").filter((candidate) => candidate.captured).length;
  const risk = level === "coach" ? replyCaptures * 2 : replyCaptures;
  const chain = move.captured ? getLegalMoves(next, "black", { ...optionsForScore(level), forcedFrom: move.to }).length : 0;
  return material * 2 + capture + crown + center + chain * 3 - risk + personalityScore(board, move, options.aiPersonality) + Math.random() * 0.05;
}

function optionsForScore() {
  return {};
}

function personalityScore(board, move, personality) {
  const { board: next, promoted } = applyMove(board, move);
  const replyCaptures = getLegalMoves(next, "white").filter((candidate) => candidate.captured).length;
  const center = move.to.row >= 2 && move.to.row <= 5 && move.to.col >= 2 && move.to.col <= 5 ? 1 : 0;
  const edge = move.to.col === 0 || move.to.col === BOARD_SIZE - 1 ? 1 : 0;
  const advancement = move.to.row;
  if (personality === "nomads") {
    const escapeLanes = getLegalMoves(next, "black").filter((candidate) => !candidate.captured).length;
    return escapeLanes * 0.18 + edge * 0.6 - replyCaptures * 0.5;
  }
  if (personality === "iron_guard") {
    return center * 1.6 + (move.captured ? 1.2 : 0) - replyCaptures * 1.1;
  }
  if (personality === "sun_court") {
    return advancement * 0.35 + (promoted ? 4 : 0) + (move.captured ? 0.6 : 0);
  }
  if (personality === "void_order") {
    const whiteMobility = getLegalMoves(next, "white").length;
    return -whiteMobility * 0.22 + (replyCaptures === 0 ? 0.9 : -0.7) + (move.captured ? 0.8 : 0);
  }
  return 0;
}

function minimaxMove(board, move, player, depth, options) {
  const result = applyMove(board, move);
  const chainMoves = move.captured ? getLegalMoves(result.board, player, { ...options, forcedFrom: move.to }) : [];
  if (chainMoves.length > 0) {
    return Math.max(...chainMoves.map((candidate) => minimaxMove(result.board, candidate, player, depth, options))) + 2;
  }
  return minimax(result.board, PLAYERS[player].enemy, depth - 1, false, options);
}

function minimax(board, player, depth, maximizing, options) {
  const winner = getWinner(board, player, options);
  if (winner || depth <= 0) {
    return evaluateBoard(board, winner);
  }
  const moves = getLegalMoves(board, player, options);
  if (moves.length === 0) {
    return evaluateBoard(board, PLAYERS[player].enemy);
  }
  const scores = moves.map((move) => {
    const result = applyMove(board, move);
    const chainMoves = move.captured ? getLegalMoves(result.board, player, { ...options, forcedFrom: move.to }) : [];
    if (chainMoves.length > 0) {
      const chainScores = chainMoves.map((candidate) => {
        const chained = applyMove(result.board, candidate);
        return minimax(chained.board, player, depth - 1, maximizing, options);
      });
      return maximizing ? Math.max(...chainScores) : Math.min(...chainScores);
    }
    return minimax(result.board, PLAYERS[player].enemy, depth - 1, !maximizing, options);
  });
  return maximizing ? Math.max(...scores) : Math.min(...scores);
}

function evaluateBoard(board, winner) {
  if (winner === "black") {
    return 1000;
  }
  if (winner === "white") {
    return -1000;
  }
  let score = 0;
  forEachPiece(board, null, ({ row, col, piece }) => {
    const sign = piece.player === "black" ? 1 : -1;
    const advancement = piece.player === "black" ? row : BOARD_SIZE - 1 - row;
    const center = row >= 2 && row <= 5 && col >= 2 && col <= 5 ? 0.8 : 0;
    score += sign * (piece.king ? 5 : 3);
    score += sign * advancement * 0.18;
    score += sign * center;
  });
  score += getLegalMoves(board, "black").filter((move) => move.captured).length * 1.4;
  score -= getLegalMoves(board, "white").filter((move) => move.captured).length * 1.8;
  return score;
}
