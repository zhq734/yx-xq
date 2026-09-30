import { describe, expect, it } from 'vitest'
import { evaluateBoard, findBestMove, findHintMove } from './ai'
import {
  createInitialBoard,
  deserializeBoard,
  getAllLegalMoves,
  getGameResult,
  isInCheck,
  makeMove,
} from './engine'
import type { Move, Side } from './types'

/**
 * 判断走法是否与给定坐标一致。
 *
 * @param move 引擎返回的走法。
 * @param fromX 起点横坐标。
 * @param fromY 起点纵坐标。
 * @param toX 终点横坐标。
 * @param toY 终点纵坐标。
 * @returns 是否完全一致。
 */
function isMove(move: Move | null, fromX: number, fromY: number, toX: number, toY: number): boolean {
  return Boolean(
    move &&
      move.from.x === fromX &&
      move.from.y === fromY &&
      move.to.x === toX &&
      move.to.y === toY,
  )
}

/**
 * 判断指定阵营是否存在一步绝杀。
 *
 * @param board 当前棋盘。
 * @param side 行棋方。
 * @returns 是否存在一步绝杀。
 */
function hasMateInOne(board: ReturnType<typeof deserializeBoard>, side: Side): boolean {
  const opponent: Side = side === 'red' ? 'black' : 'red'
  return getAllLegalMoves(board, side).some(
    (move) => getGameResult(makeMove(board, move), opponent).status === 'checkmate',
  )
}

/**
 * 判断指定阵营是否已经无棋可走。
 *
 * @param board 当前棋盘。
 * @param side 行棋方。
 * @returns 是否无合法走法。
 */
function hasNoLegalMove(board: ReturnType<typeof deserializeBoard>, side: Side): boolean {
  return getAllLegalMoves(board, side).length === 0
}

describe('象棋 AI', () => {
  it('在标准开局返回一步合法走法', () => {
    const board = createInitialBoard()
    const move = findBestMove(board, 'red', 'easy')
    expect(move).not.toBeNull()
    expect(board[move!.from.y][move!.from.x]?.side).toBe('red')
  })

  it('评估函数能识别吃车带来的巨大收益', () => {
    const board = deserializeBoard(
      ['...k.....', ...Array(7).fill('.........'), '....K....', '..R.r....'].join(''),
    )
    const before = evaluateBoard(board, 'red')
    const afterCapture = evaluateBoard(makeMove(board, { from: { x: 2, y: 9 }, to: { x: 4, y: 9 } }), 'red')
    expect(afterCapture - before).toBeGreaterThan(900)
  })

  it('无合法走法时返回 null，提示走法可由指定方执行', () => {
    const empty = deserializeBoard('.'.repeat(90))
    expect(findBestMove(empty, 'red', 'medium')).toBeNull()

    const board = createInitialBoard()
    const hint = findHintMove(board, 'red')
    expect(hint).not.toBeNull()
    expect(board[hint!.from.y][hint!.from.x]?.side).toBe('red')
    expect(board[hint!.to.y][hint!.to.x]?.side).not.toBe('red')
  })

  it('能够完成玩家走子后的 AI 应手', () => {
    const board = makeMove(createInitialBoard(), { from: { x: 1, y: 7 }, to: { x: 4, y: 7 } })
    const reply = findBestMove(board, 'black', 'medium')
    expect(reply).not.toBeNull()
    expect(board[reply!.from.y][reply!.from.x]?.side).toBe('black')
  })

  it('高手难度能找到一步绝杀', () => {
    // 黑将 (4,0)，红车 (0,3) 平到 (0,0) 照将；红马 (3,3) 控制 (4,1)，其余退路被车封锁。
    const board = deserializeBoard(
      [
        '....k....',
        '.........',
        '.........',
        'R..N.....',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '...K.....',
      ].join(''),
    )

    const move = findBestMove(board, 'red', 'hard')
    expect(move).not.toBeNull()
    const result = getGameResult(makeMove(board, move!), 'black')
    expect(result.status).toBe('checkmate')
    expect(result.winner).toBe('red')
  })

  it('会吃掉没有保护的棋子', () => {
    // 黑车 (0,1) 无子保护，红车 (0,4) 可直接吃掉，且不会造成黑方困毙。
    const board = deserializeBoard(
      [
        '....k....',
        'r........',
        '.........',
        '.........',
        'R........',
        '.........',
        '.........',
        '.........',
        '.........',
        '...K.....',
      ].join(''),
    )

    const move = findBestMove(board, 'red', 'hard')
    expect(isMove(move, 0, 4, 0, 1)).toBe(true)
  })

  it('不会用己方车去换对方有保护的兵', () => {
    // 黑兵 (4,2) 由黑车 (0,2) 保护，红车 (4,4) 吃兵会被反吃，属于严重亏子。
    const board = deserializeBoard(
      [
        '.....k...',
        '.........',
        'r...p....',
        '.........',
        '....R....',
        '.........',
        'P........',
        '.........',
        '.........',
        '....K....',
      ].join(''),
    )

    const move = findBestMove(board, 'red', 'hard')
    expect(move).not.toBeNull()
    expect(isMove(move, 4, 4, 4, 2)).toBe(false)
  })

  it('高手难度能找到两步绝杀', () => {
    // 红车 (0,1) 平到中间后，黑将无论左移还是右移，都会被红车沉底绝杀。
    const board = deserializeBoard(
      [
        '....k....',
        'R........',
        '.........',
        '....N....',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '....K....',
      ].join(''),
    )

    const move = findBestMove(board, 'red', 'hard')
    expect(move).not.toBeNull()

    const afterFirst = makeMove(board, move!)
    // 这一步本身不一定立即将军，但必须为红方制造出两步绝杀网。
    expect(getGameResult(afterFirst, 'black').status).not.toBe('checkmate')
    expect(hasMateInOne(afterFirst, 'red')).toBe(false)
    const blackReplies = getAllLegalMoves(afterFirst, 'black')
    expect(blackReplies.length).toBeGreaterThan(0)

    // 任意黑方应手后，红方都必须存在一步绝杀；同时不能提前把黑将吃掉。
    for (const reply of blackReplies) {
      const afterReply = makeMove(afterFirst, reply)
      expect(hasMateInOne(afterReply, 'red')).toBe(true)
      expect(hasNoLegalMove(afterReply, 'black')).toBe(false)
    }
  })

  it('评估函数会给占据开放线的车额外加分', () => {
    const base = ['....k....', ...Array(8).fill('.........'), '....K....'].join('')
    const openBoard = deserializeBoard(base)
    const blockedChars = base.split('')
    blockedChars[4 * 9 + 1] = 'P'
    const blockedBoard = deserializeBoard(blockedChars.join(''))

    const openRookChars = base.split('')
    openRookChars[4 * 9 + 1] = 'R'
    const openRook = deserializeBoard(openRookChars.join(''))

    const blockedRookChars = blockedChars.slice()
    blockedRookChars[4 * 9 + 1] = 'R'
    const blockedRook = deserializeBoard(blockedRookChars.join(''))

    const openGain = evaluateBoard(openRook, 'red') - evaluateBoard(openBoard, 'red')
    const blockedGain = evaluateBoard(blockedRook, 'red') - evaluateBoard(blockedBoard, 'red')
    expect(openGain).toBeGreaterThan(blockedGain)
  })
})
