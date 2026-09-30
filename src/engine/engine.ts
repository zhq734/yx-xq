import type {
  Board,
  GameResult,
  Move,
  Piece,
  PieceType,
  Position,
  Side,
  Square,
} from './types'

export const BOARD_WIDTH = 9
export const BOARD_HEIGHT = 10

const PIECE_NAMES: Record<Side, Record<PieceType, string>> = {
  red: {
    king: '帅',
    advisor: '仕',
    bishop: '相',
    knight: '马',
    rook: '车',
    cannon: '炮',
    pawn: '兵',
  },
  black: {
    king: '将',
    advisor: '士',
    bishop: '象',
    knight: '马',
    rook: '车',
    cannon: '炮',
    pawn: '卒',
  },
}

const INITIAL_LAYOUT: Array<Array<PieceType | null>> = [
  ['rook', 'knight', 'bishop', 'advisor', 'king', 'advisor', 'bishop', 'knight', 'rook'],
  [null, null, null, null, null, null, null, null, null],
  [null, 'cannon', null, null, null, null, null, 'cannon', null],
  ['pawn', null, 'pawn', null, 'pawn', null, 'pawn', null, 'pawn'],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  ['pawn', null, 'pawn', null, 'pawn', null, 'pawn', null, 'pawn'],
  [null, 'cannon', null, null, null, null, null, 'cannon', null],
  [null, null, null, null, null, null, null, null, null],
  ['rook', 'knight', 'bishop', 'advisor', 'king', 'advisor', 'bishop', 'knight', 'rook'],
]

/**
 * 创建棋盘上的初始棋子布局。
 *
 * @returns 红方在下方、黑方在上方的标准中国象棋棋盘。
 */
export function createInitialBoard(): Board {
  return INITIAL_LAYOUT.map((row, y) =>
    row.map((type, x) => {
      if (!type) return null
      const side: Side = y <= 4 ? 'black' : 'red'
      return { id: `${side}-${type}-${x}-${y}`, type, side }
    }),
  )
}

/**
 * 深拷贝棋盘，避免搜索和回退过程修改原局面。
 *
 * @param board 待拷贝的棋盘。
 * @returns 与原棋盘内容一致的新棋盘。
 */
export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((square) => (square ? { ...square } : null)))
}

/**
 * 判断坐标是否位于棋盘范围内。
 *
 * @param position 待判断的坐标。
 * @returns 坐标是否有效。
 */
export function isInsideBoard(position: Position): boolean {
  return position.x >= 0 && position.x < BOARD_WIDTH && position.y >= 0 && position.y < BOARD_HEIGHT
}

/**
 * 读取棋盘指定位置的棋子。
 *
 * @param board 当前棋盘。
 * @param position 目标坐标。
 * @returns 该位置的棋子，越界时返回 null。
 */
export function getPiece(board: Board, position: Position): Square {
  if (!isInsideBoard(position)) return null
  return board[position.y][position.x]
}

/**
 * 判断某一方是否位于自己的九宫内。
 *
 * @param position 目标坐标。
 * @param side 所属阵营。
 * @returns 坐标是否在九宫范围内。
 */
export function isInsidePalace(position: Position, side: Side): boolean {
  const correctX = position.x >= 3 && position.x <= 5
  const correctY = side === 'red' ? position.y >= 7 && position.y <= 9 : position.y >= 0 && position.y <= 2
  return correctX && correctY
}

/**
 * 判断某个棋子是否已经越过楚河汉界。
 *
 * @param position 目标坐标。
 * @param side 所属阵营。
 * @returns 是否已过河。
 */
export function hasCrossedRiver(position: Position, side: Side): boolean {
  return side === 'red' ? position.y <= 4 : position.y >= 5
}

/**
 * 统计两个正交坐标之间的棋子数量，不包含起点和终点。
 *
 * @param board 当前棋盘。
 * @param from 起点。
 * @param to 终点。
 * @returns 中间棋子数量；坐标不在同一行或列时返回 -1。
 */
function countPiecesBetween(board: Board, from: Position, to: Position): number {
  if (from.x !== to.x && from.y !== to.y) return -1

  const stepX = Math.sign(to.x - from.x)
  const stepY = Math.sign(to.y - from.y)
  let count = 0
  let x = from.x + stepX
  let y = from.y + stepY

  while (x !== to.x || y !== to.y) {
    if (board[y][x]) count += 1
    x += stepX
    y += stepY
  }

  return count
}

/**
 * 判断棋子是否为直线行动棋子。
 *
 * @param type 棋子类型。
 * @returns 是否为车、炮或王。
 */
function isStraightMover(type: PieceType): boolean {
  return type === 'rook' || type === 'cannon' || type === 'king'
}

/**
 * 在不考虑己方被将军的情况下判断一步棋的形状是否合法。
 *
 * @param board 当前棋盘。
 * @param from 起点。
 * @param to 终点。
 * @returns 是否符合该棋子的基础走法。
 */
export function canMovePseudo(board: Board, from: Position, to: Position): boolean {
  if (!isInsideBoard(from) || !isInsideBoard(to) || (from.x === to.x && from.y === to.y)) return false

  const piece = getPiece(board, from)
  const target = getPiece(board, to)
  if (!piece || (target && target.side === piece.side)) return false

  const dx = to.x - from.x
  const dy = to.y - from.y
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  switch (piece.type) {
    case 'king':
      return absX + absY === 1 && isInsidePalace(to, piece.side)
    case 'advisor':
      return absX === 1 && absY === 1 && isInsidePalace(to, piece.side)
    case 'bishop': {
      if (absX !== 2 || absY !== 2) return false
      const crossedRiver = piece.side === 'red' ? to.y < 5 : to.y > 4
      if (crossedRiver) return false
      return !board[from.y + dy / 2][from.x + dx / 2]
    }
    case 'knight': {
      if (!((absX === 2 && absY === 1) || (absX === 1 && absY === 2))) return false
      const legX = absX === 2 ? from.x + dx / 2 : from.x
      const legY = absY === 2 ? from.y + dy / 2 : from.y
      return !board[legY][legX]
    }
    case 'rook':
      return (dx === 0 || dy === 0) && countPiecesBetween(board, from, to) === 0
    case 'cannon': {
      if (dx !== 0 && dy !== 0) return false
      const between = countPiecesBetween(board, from, to)
      return target ? between === 1 : between === 0
    }
    case 'pawn': {
      const forward = piece.side === 'red' ? -1 : 1
      if (dx === 0 && dy === forward) return true
      return hasCrossedRiver(from, piece.side) && absX === 1 && dy === 0
    }
    default:
      return false
  }
}

/**
 * 查找指定阵营的王。
 *
 * @param board 当前棋盘。
 * @param side 阵营。
 * @returns 王的位置，不存在时返回 null。
 */
export function findKing(board: Board, side: Side): Position | null {
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const piece = board[y][x]
      if (piece?.type === 'king' && piece.side === side) return { x, y }
    }
  }
  return null
}

/**
 * 判断两个王是否在同一列且中间没有棋子。
 *
 * @param board 当前棋盘。
 * @returns 是否形成将帅照面。
 */
function kingsFaceEachOther(board: Board): boolean {
  const redKing = findKing(board, 'red')
  const blackKing = findKing(board, 'black')
  if (!redKing || !blackKing || redKing.x !== blackKing.x) return false

  const minY = Math.min(redKing.y, blackKing.y) + 1
  const maxY = Math.max(redKing.y, blackKing.y)
  for (let y = minY; y < maxY; y += 1) {
    if (board[y][redKing.x]) return false
  }
  return true
}

/**
 * 判断指定阵营是否正在被将军。
 *
 * @param board 当前棋盘。
 * @param side 待判断的阵营。
 * @returns 是否处于被将军状态。
 */
export function isInCheck(board: Board, side: Side): boolean {
  const king = findKing(board, side)
  if (!king) return true
  if (kingsFaceEachOther(board)) return true

  const enemy: Side = side === 'red' ? 'black' : 'red'
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const piece = board[y][x]
      if (piece?.side === enemy && canMovePseudo(board, { x, y }, king)) return true
    }
  }
  return false
}

/**
 * 在棋盘副本上执行一步棋。
 *
 * @param board 原棋盘。
 * @param move 要执行的走法。
 * @returns 执行后的新棋盘。
 */
export function makeMove(board: Board, move: Move): Board {
  const next = cloneBoard(board)
  next[move.to.y][move.to.x] = next[move.from.y][move.from.x]
  next[move.from.y][move.from.x] = null
  return next
}

/**
 * 判断一步棋是否完整合法，包含己方不能送将的约束。
 *
 * @param board 当前棋盘。
 * @param move 待判断走法。
 * @returns 走法是否合法。
 */
export function isMoveLegal(board: Board, move: Move): boolean {
  const piece = getPiece(board, move.from)
  if (!piece || !canMovePseudo(board, move.from, move.to)) return false
  return !isInCheck(makeMove(board, move), piece.side)
}

/**
 * 获取指定位置棋子的全部合法走法。
 *
 * @param board 当前棋盘。
 * @param from 棋子位置。
 * @returns 该棋子当前可执行的所有合法走法。
 */
export function getLegalMovesFrom(board: Board, from: Position): Move[] {
  const piece = getPiece(board, from)
  if (!piece) return []

  const moves: Move[] = []
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const move = { from: { ...from }, to: { x, y } }
      if (isMoveLegal(board, move)) moves.push(move)
    }
  }
  return moves
}

/**
 * 获取指定阵营的全部合法走法。
 *
 * @param board 当前棋盘。
 * @param side 阵营。
 * @returns 该阵营当前的所有合法走法。
 */
export function getAllLegalMoves(board: Board, side: Side): Move[] {
  const moves: Move[] = []
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (board[y][x]?.side === side) moves.push(...getLegalMovesFrom(board, { x, y }))
    }
  }
  return moves
}

/**
 * 计算当前局面的比赛状态。
 *
 * @param board 当前棋盘。
 * @param turn 当前行棋方。
 * @returns 状态与胜方信息。
 */
export function getGameResult(board: Board, turn: Side): GameResult {
  const hasKing = Boolean(findKing(board, turn))
  const legalMoves = hasKing ? getAllLegalMoves(board, turn) : []
  const inCheck = hasKing && isInCheck(board, turn)
  const opponent: Side = turn === 'red' ? 'black' : 'red'

  if (!hasKing || legalMoves.length === 0) {
    return { status: inCheck || !hasKing ? 'checkmate' : 'stalemate', winner: opponent }
  }
  return { status: inCheck ? 'check' : 'playing', winner: null }
}

/**
 * 获取棋子的中文名称。
 *
 * @param piece 棋子。
 * @returns 对应的中文名称。
 */
export function getPieceName(piece: Piece): string {
  return PIECE_NAMES[piece.side][piece.type]
}

/**
 * 将坐标转换为棋盘上的文件编号。
 *
 * @param x 横坐标。
 * @param side 所属阵营。
 * @returns 红方从右向左、黑方从左向右的文件编号。
 */
function getFileNumber(x: number, side: Side): number {
  return side === 'red' ? x + 1 : 9 - x
}

/**
 * 将数字转换为中文棋谱数字。
 *
 * @param value 1 到 9 之间的数字。
 * @returns 中文数字。
 */
function toChineseNumber(value: number): string {
  return ['一', '二', '三', '四', '五', '六', '七', '八', '九'][value - 1] ?? String(value)
}

/**
 * 生成便于阅读的中文棋谱文本。
 *
 * @param board 行棋前的棋盘。
 * @param move 已执行的走法。
 * @returns 例如“炮二平五”的棋谱文本。
 */
export function getMoveNotation(board: Board, move: Move): string {
  const piece = getPiece(board, move.from)
  if (!piece) return '未知走法'

  const startFile = getFileNumber(move.from.x, piece.side)
  const endFile = getFileNumber(move.to.x, piece.side)
  const dy = move.to.y - move.from.y
  const forward = piece.side === 'red' ? dy < 0 : dy > 0
  const action = dy === 0 ? '平' : forward ? '进' : '退'
  const suffix = isStraightMover(piece.type)
    ? dy === 0
      ? toChineseNumber(endFile)
      : toChineseNumber(Math.abs(dy))
    : toChineseNumber(endFile)

  return `${getPieceName(piece)}${toChineseNumber(startFile)}${action}${suffix}`
}

/**
 * 从棋盘上复制出指定坐标的棋子，供历史记录保存。
 *
 * @param board 当前棋盘。
 * @param position 棋子坐标。
 * @returns 棋子副本或 null。
 */
export function pieceAt(board: Board, position: Position): Piece | null {
  const piece = getPiece(board, position)
  return piece ? { ...piece } : null
}

/**
 * 将棋盘转换为适合调试和持久化的紧凑字符串。
 *
 * @param board 当前棋盘。
 * @returns 90 个字符的棋盘字符串。
 */
export function serializeBoard(board: Board): string {
  const symbols: Record<Side, Record<PieceType, string>> = {
    red: { king: 'K', advisor: 'A', bishop: 'B', knight: 'N', rook: 'R', cannon: 'C', pawn: 'P' },
    black: { king: 'k', advisor: 'a', bishop: 'b', knight: 'n', rook: 'r', cannon: 'c', pawn: 'p' },
  }
  return board.flatMap((row) => row.map((piece) => (piece ? symbols[piece.side][piece.type] : '.'))).join('')
}

/**
 * 从紧凑字符串恢复棋盘，主要用于测试和本地存档。
 *
 * @param value 由 serializeBoard 生成的字符串。
 * @returns 恢复后的棋盘；输入不合法时返回初始棋盘。
 */
export function deserializeBoard(value: string): Board {
  if (value.length !== BOARD_WIDTH * BOARD_HEIGHT) return createInitialBoard()

  const symbolMap: Record<string, { type: PieceType; side: Side }> = {
    K: { type: 'king', side: 'red' },
    A: { type: 'advisor', side: 'red' },
    B: { type: 'bishop', side: 'red' },
    N: { type: 'knight', side: 'red' },
    R: { type: 'rook', side: 'red' },
    C: { type: 'cannon', side: 'red' },
    P: { type: 'pawn', side: 'red' },
    k: { type: 'king', side: 'black' },
    a: { type: 'advisor', side: 'black' },
    b: { type: 'bishop', side: 'black' },
    n: { type: 'knight', side: 'black' },
    r: { type: 'rook', side: 'black' },
    c: { type: 'cannon', side: 'black' },
    p: { type: 'pawn', side: 'black' },
  }

  const board: Board = Array.from({ length: BOARD_HEIGHT }, () => Array<Square>(BOARD_WIDTH).fill(null))
  for (let index = 0; index < value.length; index += 1) {
    const symbol = value[index]
    if (symbol === '.') continue
    const definition = symbolMap[symbol]
    if (!definition) return createInitialBoard()
    const x = index % BOARD_WIDTH
    const y = Math.floor(index / BOARD_WIDTH)
    board[y][x] = { id: `${definition.side}-${definition.type}-${x}-${y}`, ...definition }
  }
  return board
}
