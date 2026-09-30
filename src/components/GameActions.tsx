import { BulbIcon, FlipIcon, RefreshIcon, UndoIcon } from './Icons'

interface GameActionsProps {
  canUndo: boolean
  thinking: boolean
  flipped: boolean
  onUndo: () => void
  onHint: () => void
  onFlip: () => void
  onRestart: () => void
}

/**
 * 渲染棋盘下方的对局操作按钮。
 *
 * @param props 操作可用状态和回调。
 * @returns 操作工具栏。
 */
export function GameActions({ canUndo, thinking, flipped, onUndo, onHint, onFlip, onRestart }: GameActionsProps) {
  return (
    <div className="game-actions" aria-label="对局操作">
      <button type="button" onClick={onUndo} disabled={!canUndo} title="悔棋">
        <UndoIcon />
        <span>悔棋</span>
      </button>
      <button type="button" onClick={onHint} disabled={thinking} title="提示一步">
        <BulbIcon />
        <span>提示</span>
      </button>
      <button type="button" onClick={onFlip} className={flipped ? 'is-active' : ''} title="翻转棋盘">
        <FlipIcon />
        <span>翻转</span>
      </button>
      <button type="button" onClick={onRestart} className="primary" title="重新开局">
        <RefreshIcon />
        <span>重开</span>
      </button>
    </div>
  )
}
