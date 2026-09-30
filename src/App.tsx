import { useEffect, useState } from 'react'
import { ChessBoard } from './components/ChessBoard'
import { GameActions } from './components/GameActions'
import { GameOverDialog } from './components/GameOverDialog'
import { GamePanel } from './components/GamePanel'
import { Header } from './components/Header'
import { useChessGame } from './hooks/useChessGame'
import { useSound } from './hooks/useSound'

const THEME_KEY = 'yijing-xiangqi-theme'

/**
 * 读取初始主题，优先使用本地设置，其次跟随系统偏好。
 *
 * @returns 是否为暗色主题。
 */
function getInitialTheme(): boolean {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored) return stored === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/**
 * 应用主界面，组合棋局状态、棋盘、侧栏与响应式操作栏。
 *
 * @returns 中国象棋单页应用。
 */
export default function App() {
  const [darkMode, setDarkMode] = useState(getInitialTheme)
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('yijing-xiangqi-sound') !== 'off')
  const [resultDismissed, setResultDismissed] = useState(false)
  const playSound = useSound(soundEnabled)
  const chessGame = useChessGame(playSound)

  /**
   * 同步主题到根元素并保存用户偏好。
   */
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  /**
   * 持久化音效偏好。
   */
  useEffect(() => {
    localStorage.setItem('yijing-xiangqi-sound', soundEnabled ? 'on' : 'off')
  }, [soundEnabled])

  /**
   * 对局重新进入进行中状态后重置关闭状态，保证再次终局时弹窗仍会弹出。
   */
  useEffect(() => {
    if (!chessGame.isFinished) setResultDismissed(false)
  }, [chessGame.isFinished])

  /**
   * 支持按 Esc 关闭终局弹窗。
   */
  useEffect(() => {
    if (!chessGame.isFinished) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setResultDismissed(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chessGame.isFinished])

  /**
   * 注册离线缓存，让应用安装到桌面后仍可对弈。
   */
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
    void navigator.serviceWorker.register('./sw.js')
  }, [])

  const handleModeChange = (mode: ReturnType<typeof useChessGame>['settings']['mode']) => {
    if (mode !== chessGame.settings.mode) chessGame.newGame({ mode })
  }

  const handlePlayerSideChange = (playerSide: ReturnType<typeof useChessGame>['settings']['playerSide']) => {
    if (playerSide !== chessGame.settings.playerSide) chessGame.newGame({ playerSide })
  }

  return (
    <div className="app">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <Header
        darkMode={darkMode}
        soundEnabled={soundEnabled}
        onToggleTheme={() => setDarkMode((current) => !current)}
        onToggleSound={() => setSoundEnabled((current) => !current)}
      />

      <main className="game-layout">
        <section className="board-column">
          <div className="board-heading">
            <div>
              <span className="eyebrow">经典规则 · 完整校验</span>
              <h1>{chessGame.settings.mode === 'pvp' ? '双人对弈' : '人机对弈'}</h1>
            </div>
            <div className={`side-indicator side-indicator--${chessGame.turn}`}>
              <span className="side-dot" />
              <span>{chessGame.turn === 'red' ? '红方行棋' : '黑方行棋'}</span>
            </div>
          </div>

          <ChessBoard
            board={chessGame.board}
            turn={chessGame.turn}
            selected={chessGame.selected}
            legalMoves={chessGame.legalMoves}
            lastMove={chessGame.lastMove}
            hintMove={chessGame.hintMove}
            flipped={chessGame.settings.flipped}
            coordinatesEnabled={chessGame.settings.coordinatesEnabled}
            onSelect={chessGame.selectPosition}
          />

          <GameActions
            canUndo={chessGame.canUndo}
            thinking={chessGame.thinking}
            flipped={chessGame.settings.flipped}
            onUndo={chessGame.undo}
            onHint={chessGame.requestHint}
            onFlip={chessGame.toggleFlip}
            onRestart={() => chessGame.newGame()}
          />
        </section>

        <GamePanel
          turn={chessGame.turn}
          history={chessGame.history}
          gameResult={chessGame.gameResult}
          thinking={chessGame.thinking}
          settings={chessGame.settings}
          onChangeMode={handleModeChange}
          onChangePlayerSide={handlePlayerSideChange}
          onChangeDifficulty={(difficulty) => chessGame.updateSettings({ difficulty })}
          onToggleCoordinates={() => chessGame.updateSettings({ coordinatesEnabled: !chessGame.settings.coordinatesEnabled })}
        />
      </main>

      <footer className="app-footer">
        <p>弈境 · 以棋会友，落子无悔</p>
        <span>规则、AI 与棋局数据均在本机运行</span>
      </footer>

      {chessGame.isFinished && !resultDismissed && (
        <GameOverDialog
          result={chessGame.gameResult}
          historyLength={chessGame.history.length}
          onRestart={() => chessGame.newGame()}
          onUndo={() => chessGame.undo()}
          onClose={() => setResultDismissed(true)}
        />
      )}
    </div>
  )
}
