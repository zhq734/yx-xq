import { DIFFICULTY_OPTIONS } from '../engine/types'
import { getPieceName } from '../engine/engine'
import type { GameResult, MoveRecord, Side } from '../engine/types'
import type { GameMode, GameSettings } from '../hooks/useChessGame'

interface GamePanelProps {
  turn: Side
  history: MoveRecord[]
  gameResult: GameResult
  thinking: boolean
  settings: GameSettings
  onChangeMode: (mode: GameMode) => void
  onChangePlayerSide: (side: Side) => void
  onChangeDifficulty: (difficulty: GameSettings['difficulty']) => void
  onToggleCoordinates: () => void
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
 * 根据棋局状态生成醒目提示文本。
 *
 * @param result 棋局状态。
 * @param turn 当前行棋方。
 * @param thinking 是否正在思考。
 * @returns 状态提示。
 */
function statusText(result: GameResult, turn: Side, thinking: boolean): string {
  if (result.status === 'checkmate') return `${sideName(result.winner!)}胜 · 绝杀`
  if (result.status === 'stalemate') return `${sideName(result.winner!)}胜 · 困毙`
  if (result.status === 'check') return `${sideName(turn)}被将军`
  if (thinking) return 'AI 正在推演'
  return `${sideName(turn)}行棋`
}

/**
 * 渲染对局信息、模式设置、棋谱和状态卡。
 *
 * @param props 对局数据与设置回调。
 * @returns 桌面侧栏及移动端信息区域。
 */
export function GamePanel({
  turn,
  history,
  gameResult,
  thinking,
  settings,
  onChangeMode,
  onChangePlayerSide,
  onChangeDifficulty,
  onToggleCoordinates,
}: GamePanelProps) {
  const status = statusText(gameResult, turn, thinking)
  const finished = gameResult.status === 'checkmate' || gameResult.status === 'stalemate'
  const rows: Array<MoveRecord | undefined> = []
  for (let index = 0; index < history.length; index += 2) {
    rows.push(history[index])
    rows.push(history[index + 1])
  }

  return (
    <aside className="game-panel">
      <section className={`turn-card${finished ? ' is-finished' : ''}`} aria-live="polite">
        <div className="turn-orb-wrap">
          <span className={`turn-orb turn-orb--${gameResult.winner ?? turn}`} />
          {thinking && <span className="thinking-ring" />}
        </div>
        <div>
          <span className="eyebrow">{finished ? '对局结束' : '当前局面'}</span>
          <strong className="turn-title">{status}</strong>
          <p className="turn-subtitle">
            {finished ? '可悔棋复盘，或开启新对局' : `第 ${Math.floor(history.length / 2) + 1} 回合 · 共 ${history.length} 步`}
          </p>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <span className="section-index">01</span>
          <div>
            <h2>对局模式</h2>
            <p>选择与朋友对弈或挑战 AI</p>
          </div>
        </div>
        <div className="segmented-control" role="group" aria-label="对局模式">
          <button type="button" className={settings.mode === 'pvp' ? 'is-active' : ''} onClick={() => onChangeMode('pvp')}>
            人人对战
          </button>
          <button type="button" className={settings.mode === 'pvc' ? 'is-active' : ''} onClick={() => onChangeMode('pvc')}>
            人机对战
          </button>
        </div>
      </section>

      {settings.mode === 'pvc' && (
        <section className="panel-section ai-settings">
          <div className="section-heading compact">
            <span className="section-index">02</span>
            <div>
              <h2>AI 对局</h2>
              <p>难度越高，计算越深远</p>
            </div>
          </div>

          <div className="field-group">
            <span className="field-label">我的执子</span>
            <div className="side-picker">
              <button type="button" className={settings.playerSide === 'red' ? 'is-active red' : ''} onClick={() => onChangePlayerSide('red')}>
                <span className="mini-piece mini-piece--red">帅</span>
                执红先行
              </button>
              <button type="button" className={settings.playerSide === 'black' ? 'is-active black' : ''} onClick={() => onChangePlayerSide('black')}>
                <span className="mini-piece mini-piece--black">将</span>
                执黑后行
              </button>
            </div>
          </div>

          <div className="field-group">
            <span className="field-label">AI 难度</span>
            <div className="difficulty-grid">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={settings.difficulty === option.id ? 'is-active' : ''}
                  title={option.description}
                  onClick={() => onChangeDifficulty(option.id)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.depth} 层</small>
                </button>
              ))}
            </div>
            <p className="field-hint">{DIFFICULTY_OPTIONS.find((option) => option.id === settings.difficulty)?.description}</p>
          </div>
        </section>
      )}

      <section className="panel-section move-log-section">
        <div className="section-heading compact">
          <span className="section-index">{settings.mode === 'pvc' ? '03' : '02'}</span>
          <div>
            <h2>棋谱记录</h2>
            <p>中文记谱 · 自动保存</p>
          </div>
        </div>
        <div className="move-log" role="log" aria-label="棋谱记录">
          {rows.length === 0 ? (
            <div className="empty-log">
              <span>弈</span>
              <p>落子后，棋谱会出现在这里</p>
            </div>
          ) : (
            <ol>
              {rows.map((record, index) => (
                <li key={`${record?.piece.id ?? 'empty'}-${index}`} className={index === history.length - 1 ? 'is-current' : ''}>
                  <span className="move-number">{Math.floor(index / 2) + 1}{index % 2 === 0 ? '.' : '…'}</span>
                  {record ? (
                    <>
                      <span className={`move-side move-side--${record.piece.side}`}>{sideName(record.piece.side)}</span>
                      <strong>{record.notation}</strong>
                      {record.captured && <span className="capture-label">吃{getPieceName(record.captured)}</span>}
                    </>
                  ) : (
                    <span className="pending-move">等待黑方</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="panel-section preferences-section">
        <label className="switch-row">
          <span>
            <strong>显示坐标</strong>
            <small>棋盘两侧显示路数</small>
          </span>
          <input type="checkbox" checked={settings.coordinatesEnabled} onChange={onToggleCoordinates} />
          <span className="switch" aria-hidden="true" />
        </label>
      </section>
    </aside>
  )
}
