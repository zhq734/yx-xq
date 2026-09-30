import { describe, expect, it } from 'vitest'
import { evaluateBoard, findBestMove, findHintMove } from './ai'
import { createInitialBoard, deserializeBoard, makeMove } from './engine'
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
})
