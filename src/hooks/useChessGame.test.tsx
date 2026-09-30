import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChessGame } from './useChessGame'

describe('棋局状态 Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('支持人人模式连续走子、悔棋与重开', () => {
    const { result } = renderHook(() => useChessGame())
    act(() => result.current.newGame({ mode: 'pvp' }))

    act(() => result.current.selectPosition({ x: 1, y: 7 }))
    act(() => result.current.selectPosition({ x: 4, y: 7 }))
    expect(result.current.history).toHaveLength(1)
    expect(result.current.turn).toBe('black')
    expect(result.current.history[0].notation).toBe('炮二平五')

    act(() => result.current.undo())
    expect(result.current.history).toHaveLength(0)
    expect(result.current.turn).toBe('red')

    act(() => result.current.selectPosition({ x: 1, y: 7 }))
    act(() => result.current.selectPosition({ x: 4, y: 7 }))
    act(() => result.current.newGame())
    expect(result.current.history).toHaveLength(0)
    expect(result.current.settings.mode).toBe('pvp')
  })

  it('拒绝非法走法并保留当前选择', () => {
    const { result } = renderHook(() => useChessGame())
    act(() => result.current.newGame({ mode: 'pvp' }))
    act(() => result.current.selectPosition({ x: 1, y: 7 }))
    act(() => result.current.selectPosition({ x: 0, y: 8 }))
    expect(result.current.history).toHaveLength(0)
    expect(result.current.selected).toBeNull()
  })

  it('为当前方生成提示走法', () => {
    const { result } = renderHook(() => useChessGame())
    act(() => result.current.newGame({ mode: 'pvp' }))
    act(() => result.current.requestHint())
    expect(result.current.hintMove).not.toBeNull()
  })
})
