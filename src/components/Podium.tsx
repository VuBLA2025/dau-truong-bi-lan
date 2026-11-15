import React from 'react';
import { PlayerScore } from '../types/game';
import { Crown, Sparkles, Trophy } from 'lucide-react';

interface PodiumProps {
  topPlayers: PlayerScore[];
  topDonator?: PlayerScore;
  lastChampion?: PlayerScore | null;
  phase: string;
  timeLeft: number;
  roundNumber: number;
}

export const Podium: React.FC<PodiumProps> = ({
  topPlayers,
  topDonator,
  lastChampion,
  phase,
  timeLeft,
  roundNumber,
}) => {
  const p1 = topPlayers[0] || lastChampion || { nickname: 'Chưa có', score: 0, avatar: '' };
  const p2 = topPlayers[1] || { nickname: 'Chưa có', score: 0, avatar: '' };
  const p3 = topDonator && topDonator.totalGifts > 0 ? topDonator : topPlayers[2] || { nickname: 'Chưa có', score: 0, avatar: '' };

  const phaseLabel =
    phase === 'GATHERING' ? 'GOM BI' : phase === 'RACING' ? 'ĐANG ĐUA' : 'TỔNG KẾT';
  const phaseColor =
    phase === 'GATHERING' ? 'text-amber-400 border-amber-400' : phase === 'RACING' ? 'text-emerald-400 border-emerald-400' : 'text-purple-400 border-purple-400';

  return (
    <div className="w-full h-[260px] bg-gradient-to-b from-slate-950/95 via-indigo-950/80 to-transparent flex flex-col items-center justify-between px-6 pt-3 pb-1 border-b border-cyan-500/30">
      {/* Tiêu đề & Đồng hồ đếm ngược */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-7 h-7 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
          <h1 className="text-2xl font-black tracking-wider uppercase bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-500 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(234,179,8,0.6)]">
            BẢNG XẾP HẠNG VÀ VINH DANH
          </h1>
        </div>

        {/* Phase Pill */}
        <div className={`flex items-center gap-3 px-4 py-1 rounded-full border-2 bg-slate-900/80 shadow-lg ${phaseColor}`}>
          <span className="font-extrabold text-lg tracking-widest">{phaseLabel}</span>
          <span className="text-2xl font-black font-mono">{timeLeft}s</span>
        </div>
      </div>

      {/* 3 Cột Bục Vinh Danh Podium */}
      <div className="w-full flex items-end justify-center gap-6 pb-2">
        {/* Hạng 2 (Bạc) */}
        <div className="flex flex-col items-center flex-1 max-w-[260px]">
          <div className="relative mb-2">
            <div className="w-16 h-16 rounded-full border-3 border-slate-300 bg-slate-800 flex items-center justify-center overflow-hidden shadow-[0_0_16px_rgba(203,213,225,0.7)]">
              {p2.avatar ? (
                <img src={p2.avatar} alt={p2.nickname} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-slate-300">{(p2.nickname || '2').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-400 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full shadow">
              TOP 2
            </span>
          </div>
          <div className="w-full bg-gradient-to-t from-slate-700/80 to-slate-500/60 rounded-t-xl py-2 px-3 text-center border-t border-l border-r border-slate-400 shadow-md">
            <p className="text-base font-bold text-white truncate">{p2.nickname}</p>
            <p className="text-xs font-semibold text-slate-200">{p2.score} điểm</p>
          </div>
        </div>

        {/* Hạng 1 (Vàng - Giữa) */}
        <div className="flex flex-col items-center flex-1 max-w-[280px]">
          <div className="relative mb-2">
            <Crown className="w-10 h-10 text-yellow-400 absolute -top-8 left-1/2 -translate-x-1/2 drop-shadow-[0_0_12px_rgba(250,204,21,1)] animate-bounce" />
            <div className="w-20 h-20 rounded-full border-4 border-yellow-400 bg-amber-950 flex items-center justify-center overflow-hidden shadow-[0_0_24px_rgba(250,204,21,0.9)]">
              {p1.avatar ? (
                <img src={p1.avatar} alt={p1.nickname} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-yellow-300">{(p1.nickname || '1').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-xs font-black px-2.5 py-0.5 rounded-full shadow-lg">
              QUÁN QUÂN
            </span>
          </div>
          <div className="w-full bg-gradient-to-t from-amber-600/90 to-yellow-500/80 rounded-t-xl py-3 px-3 text-center border-t-2 border-l-2 border-r-2 border-yellow-300 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
            <p className="text-lg font-black text-white truncate drop-shadow">{p1.nickname}</p>
            <p className="text-sm font-bold text-yellow-100">{p1.score} điểm</p>
          </div>
        </div>

        {/* Hạng 3 / Top Đại Gia (Đồng) */}
        <div className="flex flex-col items-center flex-1 max-w-[260px]">
          <div className="relative mb-2">
            <Sparkles className="w-6 h-6 text-amber-500 absolute -top-4 right-0" />
            <div className="w-16 h-16 rounded-full border-3 border-amber-600 bg-amber-950/80 flex items-center justify-center overflow-hidden shadow-[0_0_16px_rgba(217,119,6,0.7)]">
              {p3.avatar ? (
                <img src={p3.avatar} alt={p3.nickname} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-amber-400">{(p3.nickname || '3').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-xs font-black px-2 py-0.5 rounded-full shadow">
              {topDonator && topDonator.totalGifts > 0 ? 'TOP ĐẠI GIA' : 'TOP 3'}
            </span>
          </div>
          <div className="w-full bg-gradient-to-t from-amber-800/80 to-amber-600/60 rounded-t-xl py-2 px-3 text-center border-t border-l border-r border-amber-500 shadow-md">
            <p className="text-base font-bold text-white truncate">{p3.nickname}</p>
            <p className="text-xs font-semibold text-amber-200">
              {topDonator && topDonator.totalGifts > 0 ? `${p3.totalGifts} xu` : `${p3.score} điểm`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
