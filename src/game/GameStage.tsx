import React, { useEffect, useRef } from 'react';
import { usePlinkoGame } from './usePlinkoGame';
import { PlinkoEngine } from './PlinkoEngine';
import { Podium } from '../components/Podium';
import { MarqueeTicker } from '../components/MarqueeTicker';
import { Sparkles, Star } from 'lucide-react';

interface GameStageProps {
  game: ReturnType<typeof usePlinkoGame>;
}

export const GameStage: React.FC<GameStageProps> = ({ game }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PlinkoEngine | null>(null);

  // 1. Chỉ khởi tạo Engine VẬT LÝ MỘT LẦN DUY NHẤT khi Component Mount!
  // Tuyệt đối không để [game] trong dependency để tránh bị destroy mỗi giây!
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new PlinkoEngine(canvasRef.current);
    engineRef.current = engine;
    game.attachEngine(engine);

    if (game.phase === 'RACING') {
      engine.openGate();
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []); // Run ONLY once on mount!

  // 2. Đồng bộ trạng thái mở/đóng cổng khi Game Loop chuyển phase
  useEffect(() => {
    if (!engineRef.current) return;
    if (game.phase === 'RACING') {
      engineRef.current.openGate();
    } else {
      engineRef.current.closeGate();
    }
  }, [game.phase]);

  return (
    <div className="w-[1080px] h-[1920px] bg-slate-950 flex flex-col justify-between overflow-hidden relative select-none">
      {/* 1. TOP 15% (Khu vực Vinh danh) */}
      <Podium
        topPlayers={game.topPlayers}
        topDonator={game.topDonator}
        lastChampion={game.lastChampion}
        phase={game.phase}
        timeLeft={game.timeLeft}
        roundNumber={game.roundNumber}
      />

      {/* 2. MIDDLE 70% (Khu vực Gameplay Plinko) */}
      <div className="relative w-full h-[1480px] flex flex-col items-center justify-start overflow-hidden">
        {/* Header Neon Badge: "ĐẤU TRƯỜNG BI LĂN / PLINKO" */}
        <div className="absolute top-3 z-10 flex items-center gap-3 px-8 py-2 rounded-full border-2 border-cyan-400 bg-slate-950/90 shadow-[0_0_20px_rgba(0,240,255,0.8)]">
          <Star className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-spin" style={{ animationDuration: '6s' }} />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-black tracking-widest text-cyan-300 drop-shadow-[0_0_8px_rgba(0,240,255,1)]">
              ĐẤU TRƯỜNG BI LĂN
            </span>
            <span className="text-xs font-bold tracking-[0.3em] text-pink-400 uppercase">
              PLINKO RACING ARENA
            </span>
          </div>
          <Sparkles className="w-6 h-6 text-pink-400 fill-pink-400 animate-pulse" />
        </div>

        {/* Canvas Vật Lý Plinko Engine 1080x1480 */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={1480}
          className="w-full h-full block"
        />
      </div>

      {/* 3. BOTTOM 15% (Khu vực Kêu gọi - CTA Ticker) */}
      <MarqueeTicker />
    </div>
  );
};
