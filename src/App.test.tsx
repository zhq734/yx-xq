import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useChessGame } from './hooks/useChessGame'

vi.mock('./hooks/useChessGame', () => ({
  useChessGame: vi.fn(),
}))

const mockedUseChessGame = vi.mocked(useChessGame)

/**
 * 构造一份可用于渲染的最小棋局状态。
 *
 * @param overrides 需要覆盖的字段。
 * @returns 棋局状态对象。
 */
function makeGameState(overrides: Record<string, unknown> = {}) {
  return {
    board: Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null)),
    turn: 'red',
    history: [],
    lastMove: null,
    selected: null,
    legalMoves: [],
    hintMove: null,
    thinking: false,
    gameResult: { status: 'playing', winner: null },
    isFinished: false,
    isAiTurn: false,
    settings: { mode: 'pvp', playerSide: 'red', difficulty: 'medium', flipped: false, coordinatesEnabled: true },
    canUndo: false,
    selectPosition: vi.fn(),
    undo: vi.fn(),
    requestHint: vi.fn(),
    newGame: vi.fn(),
    updateSettings: vi.fn(),
    toggleFlip: vi.fn(),
    ...overrides,
  }
}

describe('App 终局提示接线', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('对局结束时自动弹出终局弹窗', () => {
    const move = {
      from: { x: 1, y: 7 },
      to: { x: 4, y: 7 },
      piece: { id: 'red-cannon-1-7', type: 'cannon', side: 'red' },
      captured: null,
      notation: '炮二平五',
    }
    mockedUseChessGame.mockReturnValue(
      makeGameState({
        isFinished: true,
        history: Array.from({ length: 6 }, (_, index) => ({ ...move, notation: `第${index + 1}步` })),
        gameResult: { status: 'checkmate', winner: 'red' },
      }) as unknown as ReturnType<typeof useChessGame>,
    )

    render(<App />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('红方胜')).toBeInTheDocument()
  })

  it('对局进行中不显示终局弹窗', () => {
    mockedUseChessGame.mockReturnValue(makeGameState() as unknown as ReturnType<typeof useChessGame>)

    render(<App />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
