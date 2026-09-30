import {
  canMovePseudo,
  cloneBoard,
  getAllLegalMoves,
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
const MAX_PLY = 24

// 位置表按红方视角编写，黑方读取镜像坐标；分值单位为厘兵，避免整数搜索丢失细节。
const RED_ROOK_TABLE = [
  14, 15, 16, 17, 18, 17, 16, 15, 14,
  15, 17, 18, 19, 20, 19, 18, 17, 15,
  14, 16, 17, 18, 19, 18, 17, 16, 14,
  13, 15, 16, 17, 18, 17, 16, 15, 13,
  12, 14, 15, 16, 17, 16, 15, 14, 12,
  11, 13, 14, 15, 16, 15, 14, 13, 11,
  10, 12, 13, 14, 15, 14, 13, 12, 10,
  9, 11, 12, 13, 14, 13, 12, 11, 9,
  8, 10, 11, 12, 13, 12, 11, 10, 8,
  8, 9, 10, 11, 12, 11, 10, 9, 8,
]

const RED_CANNON_TABLE = [
  6, 6, 8, 10, 12, 10, 8, 6, 6,
  6, 8, 10, 12, 14, 12, 10, 8, 6,
  5, 8, 10, 12, 14, 12, 10, 8, 5,
  5, 7, 9, 11, 13, 11, 9, 7, 5,
  4, 6, 8, 10, 12, 10, 8, 6, 4,
  4, 6, 8, 10, 11, 10, 8, 6, 4,
  3, 5, 7, 9, 10, 9, 7, 5, 3,
  3, 4, 6, 8, 9, 8, 6, 4, 3,
  2, 3, 5, 6, 7, 6, 5, 3, 2,
  2, 3, 4, 5, 6, 5, 4, 3, 2,
]

const RED_KNIGHT_TABLE = [
  2, 4, 6, 8, 10, 8, 6, 4, 2,
  4, 8, 12, 14, 16, 14, 12, 8, 4,
  6, 12, 16, 20, 22, 20, 16, 12, 6,
  8, 14, 20, 24, 26, 24, 20, 14, 8,
  10, 16, 22, 26, 28, 26, 22, 16, 10,
  10, 16, 22, 26, 28, 26, 22, 16, 10,
  8, 14, 20, 24, 26, 24, 20, 14, 8,
  6, 12, 16, 20, 22, 20, 16, 12, 6,
  4, 8, 12, 14, 16, 14, 12, 8, 4,
  2, 4, 6, 8, 10, 8, 6, 4, 2,
]

const RED_PAWN_TABLE = [
  40, 42, 44, 46, 48, 46, 44, 42, 40,
  36, 38, 40, 42, 44, 42, 40, 38, 36,
  30, 32, 34, 36, 38, 36, 34, 32, 30,
  24, 26, 28, 30, 32, 30, 28, 26, 24,
  18, 20, 22, 24, 26, 24, 22, 20, 18,
  4, 6, 8, 10, 12, 10, 8, 6, 4,
  6, 8, 10, 12, 14, 12, 10, 8, 6,
  4, 6, 8, 10, 12, 10, 8, 6, 4,
  2, 4, 6, 8, 10, 8, 6, 4, 2,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
]

const RED_KING_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 1, 2, 1, 0, 0, 0,
  0, 0, 0, 2, 3, 2, 0, 0, 0,
  0, 0, 0, 3, 4, 3, 0, 0, 0,
]

interface ScoredMove {
  move: Move
  score: number
}

interface OrderingContext {
  killers: Map<number, Move[]>
  history: Map<string, number>
}

interface SearchContext {
  nodes: number
  nodeLimit: number
  deadline: number
  stopped: boolean
  repetitions: Map<string, number>
}

interface SearchConfig {
  depth: number
  timeLimit: number
  nodeLimit: number
}

const SEARCH_CONFIG: Record<Difficulty, SearchConfig> = {
  easy: { depth: 2, timeLimit: 160, nodeLimit: 8_000 },
  medium: { depth: 3, timeLimit: 420, nodeLimit: 40_000 },
  hard: { depth: 4, timeLimit: 1_000, nodeLimit: 120_000 },
  master: { depth: 5, timeLimit: 1_800, nodeLimit: 260_000 },
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
 * 读取棋子位置表分值，黑方自动使用上下镜像坐标。
 *
 * @param table 红方视角的位置表。
 * @param position 棋子位置。
 * @param side 所属阵营。
 * @returns 位置表分值。
 */
function getTableValue(table: number[], position: Position, side: Side): number {
  const orientedY = side === 'red' ? position.y : 9 - position.y
  return table[orientedY * 9 + position.x] ?? 0
}

/**
 * 统计棋子的伪合法走法数量，用于衡量车、炮、马的机动性。
 *
 * @param board 当前棋盘。
 * @param position 棋子位置。
 * @returns 伪合法走法数量。
 */
function countPseudoMoves(board: Board, position: Position): number {
  let count = 0
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      if (canMovePseudo(board, position, { x, y })) count += 1
    }
  }
  return count
}

/**
 * 计算棋子的位置、机动性与阵形价值。
 *
 * @param board 当前棋盘。
 * @param type 棋子类型。
 * @param position 棋子位置。
 * @param side 所属阵营。
 * @returns 位置评分。
 */
function getPositionBonus(board: Board, type: PieceType, position: Position, side: Side): number {
  let bonus = 0

  switch (type) {
    case 'rook':
      bonus += getTableValue(RED_ROOK_TABLE, position, side)
      break
    case 'cannon':
      bonus += getTableValue(RED_CANNON_TABLE, position, side)
      break
    case 'knight':
      bonus += getTableValue(RED_KNIGHT_TABLE, position, side)
      break
    case 'pawn':
      bonus += getTableValue(RED_PAWN_TABLE, position, side)
      break
    case 'king':
      bonus += getTableValue(RED_KING_TABLE, position, side)
      break
    default:
      break
  }

  if (type === 'rook' || type === 'cannon' || type === 'knight') {
    const mobilityWeight = type === 'rook' ? 3 : type === 'cannon' ? 2 : 3
    bonus += Math.min(14, countPseudoMoves(board, position)) * mobilityWeight
  }

  if (type === 'rook') {
    let ownPawnsOnFile = 0
    for (let y = 0; y < 10; y += 1) {
      if (y === position.y) continue
      const piece = board[y][position.x]
      if (piece?.side === side && piece.type === 'pawn') ownPawnsOnFile += 1
    }
    if (ownPawnsOnFile === 0) bonus += 16
  }

  if (type === 'king') {
    let guards = 0
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const guard = board[position.y + dy]?.[position.x + dx]
        if (guard?.side === side && (guard.type === 'advisor' || guard.type === 'bishop')) guards += 1
      }
    }
    bonus += guards * 8
  }

  return bonus
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
      const value =
        getPieceValue(piece.type) + getPositionBonus(board, piece.type, { x, y }, piece.side)
      score += piece.side === perspective ? value : -value
    }
  }

  if (isInCheck(board, perspective)) score -= 60
  const opponent: Side = perspective === 'red' ? 'black' : 'red'
  if (isInCheck(board, opponent)) score += 60
  return score
}

/**
 * 判断两个走法是否完全相同。
 *
 * @param a 第一个走法。
 * @param b 第二个走法。
 * @returns 是否相同。
 */
function isSameMove(a: Move, b: Move): boolean {
  return (
    a.from.x === b.from.x &&
    a.from.y === b.from.y &&
    a.to.x === b.to.x &&
    a.to.y === b.to.y
  )
}

/**
 * 生成走法的历史启发键。
 *
 * @param move 走法。
 * @returns 历史启发键。
 */
function getMoveKey(move: Move): string {
  return `${move.from.x}${move.from.y}${move.to.x}${move.to.y}`
}

/**
 * 判断走法是否已被记录为当前层的 Killer Move。
 *
 * @param ordering 排序上下文。
 * @param ply 当前搜索层数。
 * @param move 待判断走法。
 * @returns 是否为 Killer Move。
 */
function isKillerMove(ordering: OrderingContext, ply: number, move: Move): boolean {
  return (ordering.killers.get(ply) ?? []).some((killer) => isSameMove(killer, move))
}

/**
 * 记录引发剪枝的 Killer Move，供同层后续节点优先搜索。
 *
 * @param ordering 排序上下文。
 * @param ply 当前搜索层数。
 * @param move 引发剪枝的走法。
 */
function recordKillerMove(ordering: OrderingContext, ply: number, move: Move): void {
  const killers = ordering.killers.get(ply) ?? []
  if (killers.some((killer) => isSameMove(killer, move))) return
  killers.unshift(move)
  ordering.killers.set(ply, killers.slice(0, 2))
}

/**
 * 计算吃子走法的 MVV-LVA 分值。
 *
 * @param board 当前棋盘。
 * @param move 待评分走法。
 * @returns 吃子优先级。
 */
function scoreCapture(board: Board, move: Move): number {
  const target = board[move.to.y][move.to.x]
  if (!target) return 0
  const moving = board[move.from.y][move.from.x]
  return getPieceValue(target.type) * 16 - getPieceValue(moving?.type ?? 'pawn')
}

/**
 * 计算走法的排序分值，综合吃子、Killer Move 与历史启发。
 *
 * @param board 当前棋盘。
 * @param move 待排序走法。
 * @param ordering 排序上下文。
 * @param ply 当前搜索层数。
 * @returns 排序优先级。
 */
function scoreMove(board: Board, move: Move, ordering: OrderingContext, ply: number): number {
  let score = scoreCapture(board, move)
  if (score > 0) return score
  if (isKillerMove(ordering, ply, move)) score += 5_000
  score += ordering.history.get(getMoveKey(move)) ?? 0
  return score
}

/**
 * 获取排序后的合法走法。
 *
 * @param board 当前棋盘。
 * @param side 行棋方。
 * @param ordering 排序上下文。
 * @param ply 当前搜索层数。
 * @returns 按战术价值从高到低排序的走法。
 */
function getOrderedMoves(
  board: Board,
  side: Side,
  ordering: OrderingContext,
  ply: number,
): Move[] {
  return getAllLegalMoves(board, side).sort(
    (a, b) => scoreMove(board, b, ordering, ply) - scoreMove(board, a, ordering, ply),
  )
}

/**
 * 创建空的历史启发与 Killer Move 容器。
 *
 * @returns 新的排序上下文。
 */
function createOrderingContext(): OrderingContext {
  return { killers: new Map(), history: new Map() }
}

/**
 * 判断搜索是否达到节点或时间上限。
 *
 * @param context 搜索上下文。
 * @returns 是否应停止搜索。
 */
function shouldStop(context: SearchContext): boolean {
  if (context.stopped) return true
  if (context.nodes >= context.nodeLimit) {
    context.stopped = true
    return true
  }
  if ((context.nodes & 1023) === 0 && performance.now() > context.deadline) {
    context.stopped = true
    return true
  }
  return false
}

/**
 * 统计当前搜索路径上某局面的出现次数，用于识别重复局面。
 *
 * @param board 当前棋盘。
 * @param side 当前行棋方。
 * @param context 搜索上下文。
 * @returns 该局面在路径上的出现次数。
 */
function getRepetitionCount(board: Board, side: Side, context: SearchContext): number {
  return context.repetitions.get(`${serializeBoard(board)}:${side}`) ?? 0
}

/**
 * 进入局面时记录一次出现次数。
 *
 * @param board 当前棋盘。
 * @param side 当前行棋方。
 * @param context 搜索上下文。
 * @returns 记录前的出现次数。
 */
function pushRepetition(board: Board, side: Side, context: SearchContext): number {
  const key = `${serializeBoard(board)}:${side}`
  const count = context.repetitions.get(key) ?? 0
  context.repetitions.set(key, count + 1)
  return count
}

/**
 * 离开局面时回退一次出现次数。
 *
 * @param board 当前棋盘。
 * @param side 当前行棋方。
 * @param context 搜索上下文。
 */
function popRepetition(board: Board, side: Side, context: SearchContext): void {
  const key = `${serializeBoard(board)}:${side}`
  const count = context.repetitions.get(key) ?? 0
  if (count <= 1) context.repetitions.delete(key)
  else context.repetitions.set(key, count - 1)
}

/**
 * 计算无合法走法局面的终局分值。
 *
 * @param board 当前棋盘。
 * @param side 无棋可走的一方。
 * @param perspective 评估视角。
 * @param ply 当前搜索层数。
 * @returns 绝杀或困毙分值。
 */
function getTerminalScore(board: Board, side: Side, perspective: Side, ply: number): number {
  // 中国象棋中困毙同样判负，不能把无棋可走误当成和棋。
  return side === perspective ? -MATE_SCORE + ply * 1_000 : MATE_SCORE - ply * 1_000
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
 * @param ply 当前搜索层数。
 * @param ordering 走法排序上下文。
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
  ply: number,
  ordering: OrderingContext,
): number {
  context.nodes += 1
  if (shouldStop(context)) return evaluateBoard(board, perspective)
  if (ply >= MAX_PLY) return evaluateBoard(board, perspective)
  if (depth <= 0) return quiescence(board, side, alpha, beta, perspective, context, ply, ordering)

  const repetitionCount = getRepetitionCount(board, side, context)
  if (repetitionCount >= 2) return 0

  const moves = getOrderedMoves(board, side, ordering, ply)
  if (moves.length === 0) return getTerminalScore(board, side, perspective, ply)

  const nextSide: Side = side === 'red' ? 'black' : 'red'
  if (side === perspective) {
    let best = -Infinity
    for (const move of moves) {
      const nextBoard = makeMove(board, move)
      pushRepetition(nextBoard, nextSide, context)
      const score = minimax(nextBoard, nextSide, depth - 1, alpha, beta, perspective, context, ply + 1, ordering)
      popRepetition(nextBoard, nextSide, context)
      best = Math.max(best, score)
      alpha = Math.max(alpha, score)
      if (beta <= alpha) {
        recordKillerMove(ordering, ply, move)
        ordering.history.set(getMoveKey(move), (ordering.history.get(getMoveKey(move)) ?? 0) + depth * depth)
        break
      }
    }
    return best
  }

  let best = Infinity
  for (const move of moves) {
    const nextBoard = makeMove(board, move)
    pushRepetition(nextBoard, nextSide, context)
    const score = minimax(nextBoard, nextSide, depth - 1, alpha, beta, perspective, context, ply + 1, ordering)
    popRepetition(nextBoard, nextSide, context)
    best = Math.min(best, score)
    beta = Math.min(beta, score)
    if (beta <= alpha) {
      recordKillerMove(ordering, ply, move)
      ordering.history.set(getMoveKey(move), (ordering.history.get(getMoveKey(move)) ?? 0) + depth * depth)
      break
    }
  }
  return best
}

/**
 * 在搜索叶子节点继续搜索吃子走法，缓解地平线效应导致的漏算。
 *
 * @param board 当前棋盘。
 * @param side 当前行棋方。
 * @param alpha Alpha 下界。
 * @param beta Beta 上界。
 * @param perspective 评估视角。
 * @param context 搜索上下文。
 * @param ply 当前搜索层数。
 * @param ordering 走法排序上下文。
 * @returns 静止搜索分值。
 */
function quiescence(
  board: Board,
  side: Side,
  alpha: number,
  beta: number,
  perspective: Side,
  context: SearchContext,
  ply: number,
  ordering: OrderingContext,
): number {
  context.nodes += 1
  if (shouldStop(context)) return evaluateBoard(board, perspective)
  if (ply >= MAX_PLY) return evaluateBoard(board, perspective)

  const legalMoves = getOrderedMoves(board, side, ordering, ply)
  if (legalMoves.length === 0) return getTerminalScore(board, side, perspective, ply)

  // 被将军时不能使用“静观其变”的 stand-pat，必须搜索全部解将着法。
  const inCheck = isInCheck(board, side)
  const standPat = inCheck ? 0 : evaluateBoard(board, perspective)
  if (!inCheck) {
    if (side === perspective) {
      if (standPat >= beta) return beta
      alpha = Math.max(alpha, standPat)
    } else {
      if (standPat <= alpha) return alpha
      beta = Math.min(beta, standPat)
    }
  }

  const candidates = inCheck ? legalMoves : legalMoves.filter((move) => board[move.to.y][move.to.x])
  if (candidates.length === 0) return standPat

  const nextSide: Side = side === 'red' ? 'black' : 'red'
  if (side === perspective) {
    let best = inCheck ? -Infinity : standPat
    for (const move of candidates) {
      const score = quiescence(
        makeMove(board, move),
        nextSide,
        alpha,
        beta,
        perspective,
        context,
        ply + 1,
        ordering,
      )
      best = Math.max(best, score)
      alpha = Math.max(alpha, score)
      if (beta <= alpha) break
    }
    return best
  }

  let best = inCheck ? Infinity : standPat
  for (const move of candidates) {
    const score = quiescence(
      makeMove(board, move),
      nextSide,
      alpha,
      beta,
      perspective,
      context,
      ply + 1,
      ordering,
    )
    best = Math.min(best, score)
    beta = Math.min(beta, score)
    if (beta <= alpha) break
  }
  return best
}

/**
 * 根据难度选择最终走法，低难度保留少量合理的随机性。
 *
 * @param scoredMoves 已评分走法。
 * @param difficulty 难度。
 * @returns 最终选中的走法；无合法走法时返回 null。
 */
function chooseWithDifficulty(scoredMoves: ScoredMove[], difficulty: Difficulty): Move | null {
  if (scoredMoves.length === 0) return null

  const sorted = [...scoredMoves].sort((a, b) => b.score - a.score)
  if (difficulty === 'easy') {
    const pool = sorted.slice(0, Math.min(6, sorted.length))
    return pool[Math.floor(Math.random() * pool.length)].move
  }
  if (difficulty === 'medium' && sorted.length > 1 && Math.random() < 0.12) {
    const pool = sorted.slice(0, Math.min(3, sorted.length))
    return pool[Math.floor(Math.random() * pool.length)].move
  }
  return sorted[0].move
}

/**
 * 为指定阵营计算一步棋，使用迭代加深并受节点数和时间限制保护。
 *
 * @param board 当前棋盘。
 * @param side AI 执子方。
 * @param difficulty AI 难度。
 * @returns 选中的走法；无棋可走时返回 null。
 */
export function findBestMove(board: Board, side: Side, difficulty: Difficulty): Move | null {
  const config = SEARCH_CONFIG[difficulty]
  const context: SearchContext = {
    nodes: 0,
    nodeLimit: config.nodeLimit,
    deadline: performance.now() + config.timeLimit,
    stopped: false,
    repetitions: new Map(),
  }
  const ordering = createOrderingContext()
  const rootMoves = getOrderedMoves(board, side, ordering, 0)
  if (rootMoves.length === 0) return null

  const opponent: Side = side === 'red' ? 'black' : 'red'
  let finalScores: ScoredMove[] = rootMoves.map((move) => ({ move, score: -Infinity }))

  for (let depth = 1; depth <= config.depth; depth += 1) {
    const iterationScores: ScoredMove[] = []
    let alpha = -Infinity

    for (const move of finalScores.map((entry) => entry.move)) {
      if (context.stopped) break

      const nextBoard = makeMove(board, move)
      pushRepetition(nextBoard, opponent, context)
      const opponentMoves = getAllLegalMoves(nextBoard, opponent)
      let score: number
      if (opponentMoves.length === 0) {
        // 中国象棋中困毙同样判负，因此无棋可走一律按胜局计分。
        score = MATE_SCORE
      } else if (getRepetitionCount(nextBoard, opponent, context) >= 3) {
        score = 0
      } else if (depth === 1) {
        score = quiescence(nextBoard, opponent, alpha, Infinity, side, context, 1, ordering)
      } else {
        score = minimax(nextBoard, opponent, depth - 1, alpha, Infinity, side, context, 1, ordering)
      }
      popRepetition(nextBoard, opponent, context)

      iterationScores.push({ move, score })
      alpha = Math.max(alpha, score)
    }

    if (iterationScores.length === finalScores.length) {
      finalScores = iterationScores.sort((a, b) => b.score - a.score)
    }
    if (context.stopped) break
  }

  if (finalScores.every((entry) => entry.score === -Infinity)) return rootMoves[0]
  return chooseWithDifficulty(finalScores, difficulty)
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
