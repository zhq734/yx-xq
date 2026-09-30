import { getPieceName } from '../engine/engine'
import type { Board, Move, Position, Side } from '../engine/types'

interface ChessBoardProps {
  board: Board
  turn: Side
  selected: Position | null
  legalMoves: Move[]
  lastMove: Move | null
  hintMove: Move | null
  flipped: boolean
  coordinatesEnabled: boolean
  onSelect: (position: Position) => void
}

const FILES = ['九', '八', '七', '六', '五', '四', '三', '二', '一']
const BLACK_FILES = ['１', '２', '３', '４', '５', '６', '７', '８', '９']
const MARKER_POINTS: Position[] = [
  { x: 1, y: 2 },
  { x: 7, y: 2 },
  { x: 1, y: 7 },
  { x: 7, y: 7 },
  { x: 0, y: 3 },
  { x: 2, y: 3 },
  { x: 4, y: 3 },
  { x: 6, y: 3 },
  { x: 8, y: 3 },
  { x: 0, y: 6 },
  { x: 2, y: 6 },
  { x: 4, y: 6 },
  { x: 6, y: 6 },
  { x: 8, y: 6 },
]

/**
 * 将棋盘逻辑坐标转换为考虑翻转后的视觉坐标。
 *
 * @param position 逻辑坐标。
 * @param flipped 是否翻转棋盘。
 * @returns 视觉坐标。
 */
function toDisplayPosition(position: Position, flipped: boolean): Position {
  return flipped ? { x: 8 - position.x, y: 9 - position.y } : position
}

/**
 * 判断两个坐标是否相同。
 *
 * @param first 第一个坐标。
 * @param second 第二个坐标。
 * @returns 是否相同。
 */
function samePosition(first: Position | null, second: Position | null): boolean {
  return Boolean(first && second && first.x === second.x && first.y === second.y)
}

/**
 * 绘制棋盘交点上的传统定位角标。
 */
function BoardMarker({ position }: { position: Position }) {
  const x = position.x * 100 + 50
  const y = position.y * 100 + 50
  const gap = 8
  const length = 12
  const corners = [
    { dx: -1, dy: -1, showX: position.x > 0, showY: position.y > 0 },
    { dx: 1, dy: -1, showX: position.x < 8, showY: position.y > 0 },
    { dx: -1, dy: 1, showX: position.x > 0, showY: position.y < 9 },
    { dx: 1, dy: 1, showX: position.x < 8, showY: position.y < 9 },
  ]

  return (
    <g className="board-marker">
      {corners.map((corner, index) =>
        corner.showX && corner.showY ? (
          <path
            key={index}
            d={`M ${x + corner.dx * gap} ${y + corner.dy * (gap + length)} L ${x + corner.dx * gap} ${y + corner.dy * gap} L ${x + corner.dx * (gap + length)} ${y + corner.dy * gap}`}
          />
        ) : null,
      )}
    </g>
  )
}

/**
 * 渲染中国象棋棋盘、棋子、落点提示和无障碍点击层。
 *
 * @param props 棋盘状态与交互回调。
 * @returns 响应式 SVG 棋盘。
 */
export function ChessBoard({
  board,
  turn,
  selected,
  legalMoves,
  lastMove,
  hintMove,
  flipped,
  coordinatesEnabled,
  onSelect,
}: ChessBoardProps) {
  const legalTargets = new Set(legalMoves.map((move) => `${move.to.x},${move.to.y}`))
  const hintTargets = new Set<string>()
  if (hintMove) {
    hintTargets.add(`${hintMove.from.x},${hintMove.from.y}`)
    hintTargets.add(`${hintMove.to.x},${hintMove.to.y}`)
  }

  /**
   * 把棋盘逻辑坐标换算成点击层百分比坐标。
   *
   * 点击层与 SVG 共用 900 × 1040 的坐标系，交点位于 50 + n × 100，
   * 因此必须使用交点真实比例定位，不能用均分网格，否则边缘会明显偏移。
   *
   * @param position 棋盘逻辑坐标。
   * @returns 以棋盘左上角为原点的百分比定位。
   */
  const toHitStyle = (position: Position) => {
    const display = toDisplayPosition(position, flipped)
    return {
      left: `${((display.x * 100 + 50) / 900) * 100}%`,
      top: `${((display.y * 100 + 50) / 1040) * 100}%`,
    }
  }

  return (
    <div className="board-shell" aria-label="中国象棋棋盘">
      <svg className="chess-board" viewBox="0 0 900 1040" role="img" aria-label="中国象棋棋盘">
        <defs>
          <linearGradient id="boardSurface" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--board-surface-start)" />
            <stop offset="0.52" stopColor="var(--board-surface-mid)" />
            <stop offset="1" stopColor="var(--board-surface-end)" />
          </linearGradient>
          <radialGradient id="redPiece" cx="35%" cy="25%" r="78%">
            <stop offset="0" stopColor="var(--piece-red-highlight)" />
            <stop offset="0.7" stopColor="var(--piece-red)" />
            <stop offset="1" stopColor="var(--piece-red-shadow)" />
          </radialGradient>
          <radialGradient id="blackPiece" cx="35%" cy="25%" r="78%">
            <stop offset="0" stopColor="var(--piece-black-highlight)" />
            <stop offset="0.7" stopColor="var(--piece-black)" />
            <stop offset="1" stopColor="var(--piece-black-shadow)" />
          </radialGradient>
          <filter id="pieceShadow" x="-35%" y="-35%" width="170%" height="170%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000" floodOpacity=".32" />
          </filter>
          <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect className="board-frame" x="10" y="10" width="880" height="1020" rx="28" fill="url(#boardSurface)" />
        <rect className="board-inner-frame" x="36" y="36" width="828" height="968" rx="18" />

        <g className="board-lines" aria-hidden="true">
          {Array.from({ length: 10 }, (_, y) => (
            <line key={`h-${y}`} x1="50" y1={50 + y * 100} x2="850" y2={50 + y * 100} />
          ))}
          <line x1="50" y1="50" x2="50" y2="950" />
          <line x1="850" y1="50" x2="850" y2="950" />
          {[1, 2, 3, 4, 5, 6, 7].map((x) => (
            <g key={`v-${x}`}>
              <line x1={50 + x * 100} y1="50" x2={50 + x * 100} y2="450" />
              <line x1={50 + x * 100} y1="550" x2={50 + x * 100} y2="950" />
            </g>
          ))}
          <path d="M350 50 550 250M550 50 350 250" />
          <path d="M350 750 550 950M550 750 350 950" />
          {MARKER_POINTS.map((position) => (
            <BoardMarker key={`${position.x}-${position.y}`} position={position} />
          ))}
          <text className="river-text" x="450" y="510" textAnchor="middle">楚 河</text>
          <text className="river-text" x="450" y="580" textAnchor="middle">汉 界</text>
        </g>

        {coordinatesEnabled && (
          <g className="coordinates" aria-hidden="true">
            {(flipped ? [...BLACK_FILES].reverse() : BLACK_FILES).map((label, x) => (
              <text key={`top-${x}`} x={50 + x * 100} y="28" textAnchor="middle">{label}</text>
            ))}
            {(flipped ? FILES : [...FILES].reverse()).map((label, x) => (
              <text key={`bottom-${x}`} x={50 + x * 100} y="1028" textAnchor="middle">{label}</text>
            ))}
          </g>
        )}

        <g className="board-pieces" aria-hidden="true">
          {board.flatMap((row, y) =>
            row.map((piece, x) => {
              if (!piece) return null
              const display = toDisplayPosition({ x, y }, flipped)
              const isSelected = samePosition(selected, { x, y })
              return (
                <g
                  key={piece.id}
                  className={`chess-piece chess-piece--${piece.side}${isSelected ? ' is-selected' : ''}`}
                  transform={`translate(${display.x * 100 + 50} ${display.y * 100 + 50})`}
                  filter="url(#pieceShadow)"
                >
                  {isSelected && <circle className="piece-selection" r="49" />}
                  <circle className="piece-edge" r="44" fill={piece.side === 'red' ? 'url(#redPiece)' : 'url(#blackPiece)'} />
                  <circle className="piece-inset" r="35" />
                  <text className="piece-text" y="1" textAnchor="middle" dominantBaseline="middle">{getPieceName(piece)}</text>
                </g>
              )
            }),
          )}
        </g>

        <g className="move-hints" aria-hidden="true">
          {legalMoves.map((move) => {
            const display = toDisplayPosition(move.to, flipped)
            const occupied = Boolean(board[move.to.y][move.to.x])
            return occupied ? (
              <circle
                key={`capture-${move.to.x}-${move.to.y}`}
                className="capture-hint"
                cx={display.x * 100 + 50}
                cy={display.y * 100 + 50}
                r="47"
              />
            ) : (
              <circle
                key={`move-${move.to.x}-${move.to.y}`}
                className="move-dot"
                cx={display.x * 100 + 50}
                cy={display.y * 100 + 50}
                r="10"
              />
            )
          })}
          {lastMove && (
            <g className="last-move-indicator">
              {[lastMove.from, lastMove.to].map((position, index) => {
                const display = toDisplayPosition(position, flipped)
                return <rect key={index} x={display.x * 100 + 9} y={display.y * 100 + 9} width="82" height="82" rx="20" />
              })}
            </g>
          )}
          {hintMove && (
            <g className="hint-indicator" filter="url(#softGlow)">
              {[hintMove.from, hintMove.to].map((position, index) => {
                const display = toDisplayPosition(position, flipped)
                return <circle key={index} cx={display.x * 100 + 50} cy={display.y * 100 + 50} r="46" />
              })}
            </g>
          )}
        </g>
      </svg>

      <div className="board-hit-grid" role="grid" aria-label="可点击棋盘交点">
        {Array.from({ length: 10 }, (_, y) =>
          Array.from({ length: 9 }, (_, x) => {
            const piece = board[y][x]
            const label = piece ? `${piece.side === 'red' ? '红方' : '黑方'}${getPieceName(piece)}` : '空位'
            const isLegal = legalTargets.has(`${x},${y}`)
            const isHint = hintTargets.has(`${x},${y}`)
            return (
              <button
                key={`${x}-${y}`}
                type="button"
                style={toHitStyle({ x, y })}
                className={`board-hit${isLegal ? ' is-legal' : ''}${isHint ? ' is-hint' : ''}`}
                aria-label={`${String.fromCharCode(65 + x)}${y + 1} ${label}${isLegal ? '，可落子' : ''}`}
                role="gridcell"
                onClick={() => onSelect({ x, y })}
                disabled={turn !== (piece?.side ?? turn) && !isLegal}
              />
            )
          }),
        )}
      </div>
    </div>
  )
}
