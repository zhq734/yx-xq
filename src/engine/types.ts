export type Side = 'red' | 'black'

export type PieceType = 'king' | 'advisor' | 'bishop' | 'knight' | 'rook' | 'cannon' | 'pawn'

export interface Position {
  x: number
  y: number
}

export interface Piece {
  id: string
  type: PieceType
  side: Side
}

export type Square = Piece | null
export type Board = Square[][]

export interface Move {
  from: Position
  to: Position
}

export interface MoveRecord extends Move {
  piece: Piece
  captured: Piece | null
  notation: string
}

export interface GameSnapshot {
  board: Board
  turn: Side
  history: MoveRecord[]
  lastMove: Move | null
}

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate'

export interface GameResult {
  status: GameStatus
  winner: Side | null
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'master'

export interface DifficultyOption {
  id: Difficulty
  label: string
  description: string
  depth: number
}

export const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { id: 'easy', label: '入门', description: '会犯错，适合熟悉规则', depth: 2 },
  { id: 'medium', label: '进阶', description: '三层搜索，攻守均衡', depth: 3 },
  { id: 'hard', label: '高手', description: '四层搜索，善于捕捉机会', depth: 4 },
  { id: 'master', label: '大师', description: '五层搜索，计算更深远', depth: 5 },
]
