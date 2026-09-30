import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createInitialBoard } from '../engine/engine'
import { ChessBoard } from './ChessBoard'

/**
 * 渲染棋盘并返回指定逻辑坐标的点击按钮。
 *
 * @param x 棋盘横坐标。
 * @param y 棋盘纵坐标。
 * @param flipped 是否翻转棋盘。
 * @returns 对应的点击按钮元素。
 */
function getHitButton(x: number, y: number, flipped = false): HTMLElement {
  render(
    <ChessBoard
      board={createInitialBoard()}
      turn="red"
      selected={null}
      legalMoves={[]}
      lastMove={null}
      hintMove={null}
      flipped={flipped}
      coordinatesEnabled
      onSelect={() => undefined}
    />,
  )
  const buttons = screen.getAllByRole('gridcell')
  return buttons[y * 9 + x] as HTMLElement
}

/**
 * 把棋盘逻辑坐标换算成点击层应有的百分比定位。
 *
 * @param x 棋盘横坐标。
 * @param y 棋盘纵坐标。
 * @returns 期望的 left 与 top 百分比字符串。
 */
function expectedPosition(x: number, y: number) {
  return {
    left: `${((x * 100 + 50) / 900) * 100}%`,
    top: `${((y * 100 + 50) / 1040) * 100}%`,
  }
}

describe('棋盘点击层定位', () => {
  it('点击层中心与 SVG 交点百分比一致，不再出现整体偏移', () => {
    const button = getHitButton(0, 0)
    const expected = expectedPosition(0, 0)
    expect(button.style.left).toBe(expected.left)
    expect(button.style.top).toBe(expected.top)
  })

  it('棋盘右下角交点使用真实比例定位，而非均分网格', () => {
    const button = getHitButton(8, 9)
    const expected = expectedPosition(8, 9)
    expect(button.style.left).toBe(expected.left)
    expect(button.style.top).toBe(expected.top)
    // 均分网格会把右下角放在 100%，真实交点应是 (850/900) 与 (950/1040)。
    expect(button.style.left).toBe('94.44444444444444%')
    expect(button.style.top).toBe('91.34615384615384%')
  })

  it('翻转棋盘后点击层同步镜像到对侧交点', () => {
    const button = getHitButton(0, 0, true)
    const expected = expectedPosition(8, 9)
    expect(button.style.left).toBe(expected.left)
    expect(button.style.top).toBe(expected.top)
  })
})
