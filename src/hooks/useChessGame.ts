import { useCallback, useEffect, useMemo, useState } from 'react'
import { findBestMove, findHintMove } from '../engine/ai'
import {
  createInitialBoard,
  getAllLegalMoves,
  getGameResult,
  getLegalMovesFrom,
  getMoveNotation,
  makeMove,
  pieceAt,
} from '../engine/engine'
import type { Board, Difficulty, Move, MoveRecord, Position, Side } from '../engine/types'

export type GameMode = 'pvp' | 'pvc'

export interface GameSettings {
  mode: GameMode
  playerSide: Side
  difficulty: Difficulty
  flipped: boolean
  coordinatesEnabled: boolean
}

export interface StoredGame extends GameSettings {
  history: MoveRecord[]
}

export type SoundEvent = 'move' | 'capture' | 'check' | 'finish'

const STORAGE_KEY = 'yijing-xiangqi-game-v1'

const DEFAULT_SETTINGS: GameSettings = {
  mode: 'pvc',
  playerSide: 'red',
  difficulty: 'medium',
  flipped: false,
  coordinatesEnabled: true,
}

/**
 * 从浏览器本地存储读取上次棋局。
 *
 * @returns 合法存档；不存在或解析失败时返回 null。
 */
function loadStoredGame(): StoredGame | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredGame
    if (!Array.isArray(parsed.history)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 根据历史记录重放棋局，保证悔棋后的棋盘状态完全一致。
 *
 * @param history 需要重放的历史记录。
 * @returns 重放后的棋盘。
 */
function rebuildBoard(history: MoveRecord[]): Board {
  let board = createInitialBoard()
  for (const record of history) {
    const next = board.map((row) => row.map((square) => (square ? { ...square } : null)))
    next[record.from.y][record.from.x] = { ...record.piece }
    next[record.to.y][record.to.x] = record.captured ? { ...record.captured } : null
    board = next
  }
  return board
}

/**
 * 创建一局全新的初始状态。
 *
 * @returns 不含任何历史的初始棋盘。
 */
function freshBoard(): Board {
  return createInitialBoard()
}

/**
 * 管理完整棋局生命周期、AI 回合、存档和辅助操作。
 *
 * @param onSound 棋局事件触发的音效回调。
 * @returns 可供界面消费的棋局状态与操作函数。
 */
export function useChessGame(onSound?: (event: SoundEvent) => void) {
  const stored = useMemo(loadStoredGame, [])
  const initialSettings: GameSettings = stored
    ? {
        mode: stored.mode ?? DEFAULT_SETTINGS.mode,
        playerSide: stored.playerSide ?? DEFAULT_SETTINGS.playerSide,
        difficulty: stored.difficulty ?? DEFAULT_SETTINGS.difficulty,
        flipped: stored.flipped ?? DEFAULT_SETTINGS.flipped,
        coordinatesEnabled: stored.coordinatesEnabled ?? DEFAULT_SETTINGS.coordinatesEnabled,
      }
    : DEFAULT_SETTINGS

  const [settings, setSettings] = useState<GameSettings>(initialSettings)
  const [history, setHistory] = useState<MoveRecord[]>(stored?.history ?? [])
  const [selected, setSelected] = useState<Position | null>(null)
  const [hintMove, setHintMove] = useState<Move | null>(null)
  const [thinking, setThinking] = useState(false)

  const board = useMemo(() => rebuildBoard(history), [history])
  const turn: Side = history.length % 2 === 0 ? 'red' : 'black'
  const lastMove = history.at(-1) ? { from: history.at(-1)!.from, to: history.at(-1)!.to } : null
  const gameResult = useMemo(() => getGameResult(board, turn), [board, turn])
  const isFinished = gameResult.status === 'checkmate' || gameResult.status === 'stalemate'
  const isAiTurn = settings.mode === 'pvc' && settings.playerSide !== turn && !isFinished
  const legalMoves = useMemo(() => (selected ? getLegalMovesFrom(board, selected) : []), [board, selected])

  /**
   * 持久化当前棋局与设置。
   */
  useEffect(() => {
    const storedGame: StoredGame = { ...settings, history }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedGame))
  }, [history, settings])

  /**
   * 执行一步合法棋，并同步音效、提示与胜负状态。
   *
   * @param move 要执行的走法。
   * @param fromAi 是否由 AI 发起。
   */
  const executeMove = useCallback(
    (move: Move, fromAi = false) => {
      const piece = pieceAt(board, move.from)
      if (!piece) return
      const legal = getAllLegalMoves(board, piece.side).some(
        (candidate) =>
          candidate.from.x === move.from.x &&
          candidate.from.y === move.from.y &&
          candidate.to.x === move.to.x &&
          candidate.to.y === move.to.y,
      )
      if (!legal) return

      const captured = pieceAt(board, move.to)
      const record: MoveRecord = {
        from: { ...move.from },
        to: { ...move.to },
        piece,
        captured,
        notation: getMoveNotation(board, move),
      }
      const nextHistory = [...history, record]
      const nextBoard = makeMove(board, move)
      const nextTurn: Side = turn === 'red' ? 'black' : 'red'
      const nextResult = getGameResult(nextBoard, nextTurn)

      setHistory(nextHistory)
      setSelected(null)
      setHintMove(null)
      if (nextResult.status === 'checkmate' || nextResult.status === 'stalemate') {
        onSound?.('finish')
      } else if (nextResult.status === 'check') {
        onSound?.('check')
      } else {
        onSound?.(captured ? 'capture' : 'move')
      }
      if (fromAi) setThinking(false)
    },
    [board, history, onSound, turn],
  )

  /**
   * 处理棋盘点击，包括选择棋子、切换选择和落子。
   *
   * @param position 被点击的棋盘坐标。
   */
  const selectPosition = useCallback(
    (position: Position) => {
      if (isFinished || thinking || isAiTurn) return
      const piece = board[position.y][position.x]

      if (selected) {
        const move = { from: selected, to: position }
        const isLegal = legalMoves.some(
          (candidate) => candidate.to.x === position.x && candidate.to.y === position.y,
        )
        if (isLegal) {
          executeMove(move)
          return
        }
      }

      if (piece?.side === turn) {
        setSelected((current) =>
          current?.x === position.x && current.y === position.y ? null : position,
        )
      } else {
        setSelected(null)
      }
    },
    [board, executeMove, isAiTurn, isFinished, legalMoves, selected, thinking, turn],
  )

  /**
   * 撤销一步棋；人机模式会同时撤销玩家与 AI 的最近一步。
   */
  const undo = useCallback(() => {
    if (thinking || history.length === 0) return
    const steps = settings.mode === 'pvc' ? Math.min(2, history.length) : 1
    setHistory((current) => current.slice(0, Math.max(0, current.length - steps)))
    setSelected(null)
    setHintMove(null)
  }, [history.length, settings.mode, thinking])

  /**
   * 请求引擎给出当前行棋方的一步推荐走法。
   */
  const requestHint = useCallback(() => {
    if (isFinished || thinking || isAiTurn) return
    const move = findHintMove(board, turn)
    setHintMove(move)
  }, [board, isAiTurn, isFinished, thinking, turn])

  /**
   * 开启一局新棋，可同时覆盖模式与对局设置。
   *
   * @param nextSettings 新对局设置。
   */
  const newGame = useCallback((nextSettings: Partial<GameSettings> = {}) => {
    const merged = { ...settings, ...nextSettings }
    setSettings(merged)
    setHistory([])
    setSelected(null)
    setHintMove(null)
    setThinking(false)
  }, [settings])

  /**
   * 更新不改变当前棋局的偏好设置。
   *
   * @param nextSettings 需要合并的设置。
   */
  const updateSettings = useCallback((nextSettings: Partial<GameSettings>) => {
    setSettings((current) => ({ ...current, ...nextSettings }))
  }, [])

  /**
   * 切换棋盘方向。
   */
  const toggleFlip = useCallback(() => {
    setSettings((current) => ({ ...current, flipped: !current.flipped }))
  }, [])

  /**
   * AI 回合自动思考并落子，使用短延迟避免界面阻塞感。
   */
  useEffect(() => {
    if (!isAiTurn) return
    setThinking(true)
    const timer = window.setTimeout(() => {
      const move = findBestMove(board, turn, settings.difficulty)
      if (move) executeMove(move, true)
      else setThinking(false)
    }, 240)
    return () => window.clearTimeout(timer)
  }, [board, executeMove, isAiTurn, settings.difficulty, turn])

  return {
    board,
    turn,
    history,
    lastMove,
    selected,
    legalMoves,
    hintMove,
    thinking,
    gameResult,
    isFinished,
    isAiTurn,
    settings,
    canUndo: history.length > 0 && !thinking,
    selectPosition,
    undo,
    requestHint,
    newGame,
    updateSettings,
    toggleFlip,
  }
}
