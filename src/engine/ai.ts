import {
  cloneBoard,
  getAllLegalMoves,
  getGameResult,
  isInCheck,
  makeMove,
  serializeBoard,
} from './engine'
import type { Board, Difficulty, Move, PieceType, Position, Side } from './types'

const PIECE_VALUES: Record<PieceType, number> = {
  king: 100_000,
  rook: 1_100,
  cannon: 560,
  knight: 480,
  bishop: 220,
  advisor: 220,
  pawn: 110,
}

const MATE_SCORE = 1_000_000
const SEARCH_LIMIT = 900

interface ScoredMove {
  move: Move
  score: number
}

interface SearchContext {
  nodes: number
  deadline: number
}

/**
 * 计算棋子的基础子力价值。
 *
 * @param type 棋子类型。
 * @returns 棋子的数值价值。
 */
function getPieceValue(type: PieceType): number {
  return PIECE_VALUES[type]
}

/**
 * 获取棋子相对棋盘中心的机动位置分。
 *
 * @param type 棋子类型。
 * @param position 棋子位置。
 * @param side 所属阵营。
 * @returns 位置评分。
 */
function getPositionBonus(type: PieceType, position: Position, side: Side): number {
  const centerDistance = Math.abs(position.x - 4)
  const progress = side === 'red' ? 9 - position.y : position.y

  switch (type) {
    case 'rook':
      return centerDistance === 0 ? 22 : 0
    case 'cannon':
      return centerDistance <= 1 ? 12 : 0
    case 'knight':
      return centerDistance <= 2 ? 18 : 0
    case 'pawn':
      return progress * 8 + (centerDistance <= 2 ? 8 : 0)
    case 'king':
      return position.y === (side === 'red' ? 9 : 0) ? 8 : 0
    default:
      return 0
  }
}

/**
 * 从指定阵营视角评估整个棋盘。
 *
 * @param board 当前棋盘。
 * @param perspective 评估视角。
 * @returns 正数表示该阵营占优。
 */
export function evaluateBoard(board: Board, perspective: Side): number {
  let score = 0

  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const piece = board[y][x]
      if (!piece) continue
      const value = getPieceValue(piece.type) + getPositionBonus(piece.type, { x, y }, piece.side)
      score += piece.side === perspective ? value : -value
    }
  }

  if (isInCheck(board, perspective)) score -= 55
  const opponent: Side = perspective === 'red' ? 'black' : 'red'
  if (isInCheck(board, opponent)) score += 55
  return score
}

/**
 * 根据走法是否吃子、是否将军进行排序，提高剪枝效率。
 *
 * @param board 当前棋盘。
 * @param move 待排序走法。
 * @returns 排序优先级。
 */
function scoreMove(board: Board, move: Move): number {
  const target = board[move.to.y][move.to.x]
  const moving = board[move.from.y][move.from.x]
  let score = target ? getPieceValue(target.type) * 10 - getPieceValue(moving?.type ?? 'pawn') : 0

  const next = makeMove(board, move)
  const enemy: Side = moving?.side === 'red' ? 'black' : 'red'
  if (isInCheck(next, enemy)) score += 90
  return score
}

/**
 * 获取排序后的合法走法。
 *
 * @param board 当前棋盘。
 * @param side 行棋方。
 * @returns 按战术价值从高到低排序的走法。
 */
function getOrderedMoves(board: Board, side: Side): Move[] {
  return getAllLegalMoves(board, side).sort((a, b) => scoreMove(board, b) - scoreMove(board, a))
}

/**
 * 使用 Alpha-Beta 剪枝搜索最佳分值。
 *
 * @param board 当前棋盘。
 * @param side 当前行棋方。
 * @param depth 剩余搜索深度。
 * @param alpha Alpha 下界。
 * @param beta Beta 上界。
 * @param perspective 评估视角。
 * @param context 节点数与时间控制上下文。
 * @returns 当前局面的搜索分值。
 */
function minimax(
  board: Board,
  side: Side,
  depth: number,
  alpha: number,
  beta: number,
  perspective: Side,
  context: SearchContext,
): number {
  context.nodes += 1
  const result = getGameResult(board, side)
  if (result.status === 'checkmate') {
    return result.winner === perspective ? MATE_SCORE + depth * 1000 : -MATE_SCORE - depth * 1000
  }
  if (result.status === 'stalemate') return 0
  if (depth === 0 || context.nodes >= SEARCH_LIMIT || performance.now() > context.deadline) {
    return evaluateBoard(board, perspective)
  }

  const moves = getOrderedMoves(board, side)
  if (side === perspective) {
    let best = -Infinity
    for (const move of moves) {
      const score = minimax(makeMove(board, move), side === 'red' ? 'black' : 'red', depth - 1, alpha, beta, perspective, context)
      best = Math.max(best, score)
      alpha = Math.max(alpha, score)
      if (beta <= alpha) break
    }
    return best
  }

  let best = Infinity
  for (const move of moves) {
    const score = minimax(makeMove(board, move), side === 'red' ? 'black' : 'red', depth - 1, alpha, beta, perspective, context)
    best = Math.min(best, score)
    beta = Math.min(beta, score)
    if (beta <= alpha) break
  }
  return best
}

/**
 * 根据难度随机扰动 AI 的选子判断。
 *
 * @param scoredMoves 已评分走法。
 * @param difficulty 难度。
 * @returns 最终选中的走法；无合法走法时返回 null。
 */
function chooseWithDifficulty(scoredMoves: ScoredMove[], difficulty: Difficulty): Move | null {
  if (scoredMoves.length === 0) return null

  const sorted = [...scoredMoves].sort((a, b) => b.score - a.score)
  if (difficulty === 'easy') {
    const pool = sorted.slice(0, Math.min(5, sorted.length))
    return pool[Math.floor(Math.random() * pool.length)].move
  }
  if (difficulty === 'medium' && sorted.length > 1 && Math.random() < 0.2) {
    const pool = sorted.slice(0, Math.min(3, sorted.length))
    return pool[Math.floor(Math.random() * pool.length)].move
  }
  return sorted[0].move
}

/**
 * 为指定阵营计算一步棋，内置节点数和时间限制以保证浏览器响应流畅。
 *
 * @param board 当前棋盘。
 * @param side AI 执子方。
 * @param difficulty AI 难度。
 * @returns 选中的走法；无棋可走时返回 null。
 */
export function findBestMove(board: Board, side: Side, difficulty: Difficulty): Move | null {
  const depths: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, master: 4 }
  const timeLimits: Record<Difficulty, number> = { easy: 120, medium: 350, hard: 750, master: 1400 }
  const context: SearchContext = {
    nodes: 0,
    deadline: performance.now() + timeLimits[difficulty],
  }

  const legalMoves = getOrderedMoves(board, side)
  if (legalMoves.length === 0) return null

  const scoredMoves: ScoredMove[] = legalMoves.map((move) => {
    const next = makeMove(board, move)
    const enemy: Side = side === 'red' ? 'black' : 'red'
    const result = getGameResult(next, enemy)
    if (result.status === 'checkmate') return { move, score: MATE_SCORE }

    return {
      move,
      score: minimax(next, enemy, depths[difficulty] - 1, -Infinity, Infinity, side, context),
    }
  })

  return chooseWithDifficulty(scoredMoves, difficulty)
}

/**
 * 获取当前局面的一个合法提示走法。
 *
 * @param board 当前棋盘。
 * @param side 行棋方。
 * @returns 推荐走法；无棋可走时返回 null。
 */
export function findHintMove(board: Board, side: Side): Move | null {
  return findBestMove(board, side, 'medium')
}

/**
 * 调试用途：导出 AI 对局面的静态评分。
 *
 * @param board 当前棋盘。
 * @param side 评估视角。
 * @returns 当前静态评分。
 */
export function getBoardScore(board: Board, side: Side): number {
  return evaluateBoard(cloneBoard(board), side)
}

/**
 * 调试用途：返回棋盘紧凑标识，便于分析重复局面。
 *
 * @param board 当前棋盘。
 * @returns 紧凑局面字符串。
 */
export function getBoardKey(board: Board): string {
  return serializeBoard(board)
}
