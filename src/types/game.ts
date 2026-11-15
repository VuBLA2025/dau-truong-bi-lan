export type BallType = 'normal' | 'fire' | 'iron' | 'boss';

export interface BallData {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  type: BallType;
  radius: number;
  color: string;
  glowColor: string;
  createdAt: number;
}

export type GamePhase = 'GATHERING' | 'RACING' | 'SUMMARY';

export interface BucketConfig {
  id: string;
  label: string;
  multiplier: number;
  color: string;
  glow: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlayerScore {
  username: string;
  nickname: string;
  avatar: string;
  score: number;
  ballsDropped: number;
  ballsScored: number;
  totalGifts: number;
  isTopDonator?: boolean;
  isLastChampion?: boolean;
}

export interface EarthquakeEvent {
  active: boolean;
  user: string;
  durationMs: number;
  startTime: number;
}

export interface BossEvent {
  active: boolean;
  user: string;
  avatar: string;
  durationMs: number;
  startTime: number;
}
