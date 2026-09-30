import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameOverDialog } from './GameOverDialog'

describe('终局弹窗', () => {
  it('绝杀时显示胜方与绝杀文案', () => {
    render(<GameOverDialog result={{ status: 'checkmate', winner: 'red' }} historyLength={8} onRestart={vi.fn()} onUndo={vi.fn()} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('红方胜')).toBeInTheDocument()
    expect(screen.getByText(/绝杀/)).toBeInTheDocument()
  })

  it('困毙时显示困毙文案', () => {
    render(<GameOverDialog result={{ status: 'stalemate', winner: 'black' }} historyLength={12} onRestart={vi.fn()} onUndo={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('黑方胜')).toBeInTheDocument()
    expect(screen.getByText(/困毙/)).toBeInTheDocument()
  })

  it('点击再来一局会触发重开', async () => {
    const onRestart = vi.fn()
    render(<GameOverDialog result={{ status: 'checkmate', winner: 'red' }} historyLength={6} onRestart={onRestart} onUndo={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '再来一局' }))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('点击复盘悔棋会触发悔棋', async () => {
    const onUndo = vi.fn()
    render(<GameOverDialog result={{ status: 'checkmate', winner: 'red' }} historyLength={6} onRestart={vi.fn()} onUndo={onUndo} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '复盘悔棋' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('点击关闭按钮会触发关闭回调', async () => {
    const onClose = vi.fn()
    render(<GameOverDialog result={{ status: 'checkmate', winner: 'red' }} historyLength={6} onRestart={vi.fn()} onUndo={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '关闭提示' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
