import { describe, expect, it } from 'vitest'
import {
  canMovePseudo,
  createInitialBoard,
  deserializeBoard,
  findKing,
  getAllLegalMoves,
  getGameResult,
  getLegalMovesFrom,
  getMoveNotation,
  isInCheck,
  isMoveLegal,
  makeMove,
  serializeBoard,
} from './engine'
import type { Board, PieceType, Side } from './types'

function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array(9).fill(null))
}

function place(board: Board, x: number, y: number, type: PieceType, side: Side) {
  board[y][x] = { id: `${side}-${type}-${x}-${y}`, type, side }
}

describe('中国象棋规则引擎', () => {
  it('创建标准开局并放置 32 枚棋子', () => {
    const board = createInitialBoard()
    expect(board.flat().filter(Boolean)).toHaveLength(32)
    expect(board[9][4]?.type).toBe('king')
    expect(board[9][4]?.side).toBe('red')
    expect(board[0][4]?.side).toBe('black')
  })

  it('支持将帅、仕相、马和兵的走法', () => {
    const board = emptyBoard()
    place(board, 4, 9, 'king', 'red')
    place(board, 4, 0, 'king', 'black')
    place(board, 3, 0, 'rook', 'black')
    place(board, 5, 8, 'advisor', 'red')
    place(board, 2, 9, 'bishop', 'red')
    place(board, 1, 9, 'knight', 'red')
    place(board, 4, 6, 'pawn', 'red')

    expect(canMovePseudo(board, { x: 4, y: 9 }, { x: 4, y: 8 })).toBe(true)
    expect(canMovePseudo(board, { x: 5, y: 8 }, { x: 4, y: 7 })).toBe(true)
    expect(canMovePseudo(board, { x: 2, y: 9 }, { x: 4, y: 7 })).toBe(true)
    expect(canMovePseudo(board, { x: 1, y: 9 }, { x: 2, y: 7 })).toBe(true)
    expect(canMovePseudo(board, { x: 4, y: 6 }, { x: 4, y: 5 })).toBe(true)
    expect(canMovePseudo(board, { x: 4, y: 6 }, { x: 5, y: 6 })).toBe(false)
  })

  it('禁止蹩马腿、塞象眼以及棋子穿越障碍', () => {
    const board = emptyBoard()
    place(board, 4, 9, 'king', 'red')
    place(board, 4, 0, 'king', 'black')
    place(board, 1, 9, 'knight', 'red')
    place(board, 1, 8, 'pawn', 'red')
    place(board, 2, 9, 'bishop', 'red')
    place(board, 3, 8, 'pawn', 'red')
    place(board, 0, 9, 'rook', 'red')
    place(board, 0, 5, 'pawn', 'red')

    expect(canMovePseudo(board, { x: 1, y: 9 }, { x: 2, y: 7 })).toBe(false)
    expect(canMovePseudo(board, { x: 2, y: 9 }, { x: 4, y: 7 })).toBe(false)
    expect(canMovePseudo(board, { x: 0, y: 9 }, { x: 0, y: 0 })).toBe(false)
  })

  it('炮移动时无阻挡，吃子时恰有一个炮架', () => {
    const board = emptyBoard()
    place(board, 4, 9, 'king', 'red')
    place(board, 4, 0, 'king', 'black')
    place(board, 1, 9, 'cannon', 'red')
    place(board, 1, 5, 'pawn', 'red')
    place(board, 1, 2, 'rook', 'black')

    expect(canMovePseudo(board, { x: 1, y: 9 }, { x: 1, y: 6 })).toBe(true)
    expect(canMovePseudo(board, { x: 1, y: 9 }, { x: 1, y: 2 })).toBe(true)
    expect(canMovePseudo(board, { x: 1, y: 9 }, { x: 1, y: 5 })).toBe(false)
    expect(canMovePseudo(board, { x: 1, y: 9 }, { x: 1, y: 4 })).toBe(false)
  })

  it('过河兵可以左右移动，但不能后退', () => {
    const board = emptyBoard()
    place(board, 4, 9, 'king', 'red')
    place(board, 4, 0, 'king', 'black')
    place(board, 3, 4, 'pawn', 'red')

    expect(canMovePseudo(board, { x: 3, y: 4 }, { x: 2, y: 4 })).toBe(true)
    expect(canMovePseudo(board, { x: 3, y: 4 }, { x: 4, y: 4 })).toBe(true)
    expect(canMovePseudo(board, { x: 3, y: 4 }, { x: 3, y: 5 })).toBe(false)
  })

  it('识别将帅照面并把照面视为被将军', () => {
    const board = emptyBoard()
    place(board, 4, 9, 'king', 'red')
    place(board, 4, 0, 'king', 'black')

    expect(isInCheck(board, 'red')).toBe(true)
    expect(isInCheck(board, 'black')).toBe(true)
  })

  it('合法走法不能让自己处于被将军状态', () => {
    const board = emptyBoard()
    place(board, 4, 9, 'king', 'red')
    place(board, 3, 0, 'king', 'black')
    place(board, 4, 0, 'rook', 'black')
    place(board, 4, 8, 'advisor', 'red')

    expect(isMoveLegal(board, { from: { x: 4, y: 8 }, to: { x: 3, y: 7 } })).toBe(false)
    expect(isMoveLegal(board, { from: { x: 4, y: 9 }, to: { x: 5, y: 9 } })).toBe(true)
  })

  it('区分将军、绝杀与困毙', () => {
    const checkBoard = emptyBoard()
    place(checkBoard, 4, 9, 'king', 'red')
    place(checkBoard, 4, 0, 'king', 'black')
    place(checkBoard, 0, 8, 'rook', 'black')
    expect(getGameResult(checkBoard, 'red').status).toBe('check')

    const mateBoard = emptyBoard()
    place(mateBoard, 4, 9, 'king', 'red')
    place(mateBoard, 3, 8, 'rook', 'black')
    place(mateBoard, 4, 8, 'rook', 'black')
    place(mateBoard, 5, 8, 'rook', 'black')
    place(mateBoard, 4, 0, 'king', 'black')
    expect(getGameResult(mateBoard, 'red')).toEqual({ status: 'checkmate', winner: 'black' })

    const stalemateBoard = emptyBoard()
    place(stalemateBoard, 4, 9, 'king', 'red')
    place(stalemateBoard, 3, 0, 'king', 'black')
    place(stalemateBoard, 3, 8, 'rook', 'black')
    place(stalemateBoard, 5, 8, 'rook', 'black')
    expect(getGameResult(stalemateBoard, 'red')).toEqual({ status: 'stalemate', winner: 'black' })
  })

  it('生成标准开局的合法走法，并支持序列化恢复', () => {
    const board = createInitialBoard()
    expect(getAllLegalMoves(board, 'red')).toHaveLength(44)
    expect(getLegalMovesFrom(board, { x: 1, y: 7 }).length).toBeGreaterThan(0)
    expect(findKing(board, 'red')).toEqual({ x: 4, y: 9 })

    const restored = deserializeBoard(serializeBoard(board))
    expect(serializeBoard(restored)).toBe(serializeBoard(board))
  })

  it('执行走法后原棋盘保持不变并生成中文棋谱', () => {
    const board = createInitialBoard()
    const move = { from: { x: 1, y: 7 }, to: { x: 4, y: 7 } }
    const notation = getMoveNotation(board, move)
    const next = makeMove(board, move)

    expect(board[7][1]?.type).toBe('cannon')
    expect(next[7][1]).toBeNull()
    expect(next[7][4]?.type).toBe('cannon')
    expect(notation).toBe('炮二平五')
  })
})
