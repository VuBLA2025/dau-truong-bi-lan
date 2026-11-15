import React from 'react';

export const MarqueeTicker: React.FC = () => {
  return (
    <div className="w-full h-[180px] bg-slate-950/95 flex flex-col justify-center px-4 py-3 border-t-2 border-cyan-400 shadow-[0_-10px_25px_rgba(0,240,255,0.25)] relative overflow-hidden">
      {/* Khung viền vi tính tương lai */}
      <div className="absolute inset-x-2 inset-y-2 border border-cyan-500/40 rounded-xl pointer-events-none" />

      {/* Marquee Ticker 1: Dòng kêu gọi chính */}
      <div className="relative flex overflow-x-hidden py-1">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-10 text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-pink-400 to-yellow-300 drop-shadow-[0_0_12px_rgba(0,240,255,0.7)]">
          <span className="flex items-center gap-3">
            <span className="text-3xl">💬</span> GÕ &quot;1&quot; ĐỂ THẢ BI!
          </span>
          <span className="text-cyan-400">❖</span>
          <span className="flex items-center gap-3 text-pink-400">
            <span className="text-3xl">🌹</span> TẶNG HOA HỒNG = +3 BI!
          </span>
          <span className="text-cyan-400">❖</span>
          <span className="flex items-center gap-3 text-amber-400">
            <span className="text-3xl">🧢</span> TẶNG MŨ = ĐỘNG ĐẤT!
          </span>
          <span className="text-cyan-400">❖</span>
          <span className="flex items-center gap-3 text-yellow-300">
            <span className="text-3xl">🦁</span> TẶNG SƯ TỬ = MƯA BI VÀNG BOSS!
          </span>
          <span className="text-cyan-400">❖</span>
        </div>

        <div className="absolute top-1 animate-marquee2 whitespace-nowrap flex items-center gap-10 text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-pink-400 to-yellow-300 drop-shadow-[0_0_12px_rgba(0,240,255,0.7)]">
          <span className="flex items-center gap-3">
            <span className="text-3xl">💬</span> GÕ &quot;1&quot; ĐỂ THẢ BI!
          </span>
          <span className="text-cyan-400">❖</span>
          <span className="flex items-center gap-3 text-pink-400">
            <span className="text-3xl">🌹</span> TẶNG HOA HỒNG = +3 BI!
          </span>
          <span className="text-cyan-400">❖</span>
          <span className="flex items-center gap-3 text-amber-400">
            <span className="text-3xl">🧢</span> TẶNG MŨ = ĐỘNG ĐẤT!
          </span>
          <span className="text-cyan-400">❖</span>
          <span className="flex items-center gap-3 text-yellow-300">
            <span className="text-3xl">🦁</span> TẶNG SƯ TỬ = MƯA BI VÀNG BOSS!
          </span>
          <span className="text-cyan-400">❖</span>
        </div>
      </div>

      {/* Dòng phụ: Hướng dẫn nhanh cho viewer mới */}
      <div className="w-full mt-2 flex items-center justify-around text-sm font-bold text-slate-300 bg-slate-900/90 py-1.5 px-4 rounded-lg border border-slate-700/80">
        <span className="text-cyan-300">⚡ Thả tim để tăng năng lượng phòng</span>
        <span className="text-purple-300">🔥 Quà 10-50 xu: Bi Lửa & Bi Sắt</span>
        <span className="text-amber-300">👑 Top 1 ván trước được phát sáng</span>
      </div>
    </div>
  );
};
