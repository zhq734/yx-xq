import { ChessIcon, SoundIcon, ThemeIcon } from './Icons'

interface HeaderProps {
  darkMode: boolean
  soundEnabled: boolean
  onToggleTheme: () => void
  onToggleSound: () => void
}

/**
 * 渲染品牌头部和全局主题、音效开关。
 *
 * @param props 主题与声音状态。
 * @returns 页面顶部导航。
 */
export function Header({ darkMode, soundEnabled, onToggleTheme, onToggleSound }: HeaderProps) {
  return (
    <header className="app-header">
      <a className="brand" href="./" aria-label="弈境中国象棋首页">
        <span className="brand-mark"><ChessIcon /></span>
        <span>
          <strong>弈境</strong>
          <small>中国象棋</small>
        </span>
      </a>

      <div className="header-center" aria-hidden="true">
        <span />
        <p>楚河汉界 · 一子定乾坤</p>
        <span />
      </div>

      <div className="header-actions">
        <button type="button" className="icon-button" onClick={onToggleSound} aria-label={soundEnabled ? '关闭音效' : '开启音效'} title={soundEnabled ? '关闭音效' : '开启音效'}>
          <SoundIcon muted={!soundEnabled} />
        </button>
        <button type="button" className="icon-button" onClick={onToggleTheme} aria-label={darkMode ? '切换到亮色主题' : '切换到暗色主题'} title={darkMode ? '亮色主题' : '暗色主题'}>
          <ThemeIcon dark={darkMode} />
        </button>
      </div>
    </header>
  )
}
