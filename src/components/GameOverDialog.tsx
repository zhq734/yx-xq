import { RefreshIcon, UndoIcon } from './Icons'
import type { GameResult, Side } from '../engine/types'

interface GameOverDialogProps {
  result: GameResult
  historyLength: number
  onRestart: () => void
  onUndo: () => void
  onClose: () => void
}

/**
 * 返回阵营的中文名称。
 *
 * @param side 阵营。
 * @returns 中文名称。
 */
function sideName(side: Side): string {
  return side === 'red' ? '红方' : '黑方'
}

/**
 * 渲染对局结束弹窗，展示胜方、获胜方式与后续操作。
 *
 * @param props 终局数据与操作回调。
 * @returns 终局遮罩对话框。
 */
export function GameOverDialog({ result, historyLength, onRestart, onUndo, onClose }: GameOverDialogProps) {
  const winner = result.winner ? sideName(result.winner) : '和棋'
  const reason = result.status === 'stalemate' ? '困毙' : '绝杀'
  const winnerSide: Side = result.winner ?? 'red'

  return (
    <div className="game-over-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`game-over-dialog game-over-dialog--${winnerSide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-over-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="game-over-close" onClick={onClose} aria-label="关闭提示">×</button>
        <span className={`game-over-orb game-over-orb--${winnerSide}`} aria-hidden="true">{winnerSide === 'red' ? '帅' : '将'}</span>
        <span className="eyebrow">对局结束 · 共 {historyLength} 步</span>
        <h2 id="game-over-title" className="game-over-title">{winner}胜</h2>
        <p className="game-over-reason">{reason}</p>
        <div className="game-over-actions">
          <button type="button" className="primary" onClick={onRestart}>
            <RefreshIcon />
            <span>再来一局</span>
          </button>
          <button type="button" onClick={onUndo}>
            <UndoIcon />
            <span>复盘悔棋</span>
          </button>
        </div>
      </div>
    </div>
  )
}
