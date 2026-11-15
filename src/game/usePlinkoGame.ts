import { useState, useEffect, useRef, useCallback } from 'react';
import { BallData, BallType, BucketConfig, GamePhase, PlayerScore } from '../types/game';
import { PlinkoEngine } from './PlinkoEngine';
import confetti from 'canvas-confetti';

const GATHERING_TIME = 45;
const RACING_TIME = 120;
const SUMMARY_TIME = 15;

export function usePlinkoGame() {
  const [phase, setPhase] = useState<GamePhase>('GATHERING');
  const [timeLeft, setTimeLeft] = useState<number>(GATHERING_TIME);
  const [roundNumber, setRoundNumber] = useState<number>(1);

  // Điểm số & BXH
  const [scores, setScores] = useState<Map<string, PlayerScore>>(new Map());
  const [lastChampion, setLastChampion] = useState<PlayerScore | null>(null);

  // TikTok Live stats
  const [liveStats, setLiveStats] = useState({
    isConnected: false,
    isConnecting: false,
    username: '',
    viewerCount: 0,
    totalLikes: 0,
    error: '',
  });

  const engineRef = useRef<PlinkoEngine | null>(null);
  const cooldowns = useRef<Map<string, number>>(new Map());

  // MC Voice TTS queue
  const isSpeakingRef = useRef(false);
  const speechQueueRef = useRef<string[]>([]);

  const speak = useCallback((text: string) => {
    if (!text) return;
    speechQueueRef.current.push(text);
    processSpeechQueue();
  }, []);

  const processSpeechQueue = () => {
    if (isSpeakingRef.current || speechQueueRef.current.length === 0) return;
    const nextText = speechQueueRef.current.shift()!;
    isSpeakingRef.current = true;

    const audio = new Audio(`/api/tts?text=${encodeURIComponent(nextText)}&rate=1.25`);
    audio.onended = () => {
      isSpeakingRef.current = false;
      setTimeout(processSpeechQueue, 350);
    };
    audio.onerror = () => {
      isSpeakingRef.current = false;
      setTimeout(processSpeechQueue, 200);
    };
    audio.play().catch(() => {
      isSpeakingRef.current = false;
    });
  };

  // 1. Gắn Engine
  const attachEngine = useCallback((engine: PlinkoEngine) => {
    engineRef.current = engine;

    engine.onScore = (ball: BallData, bucket: BucketConfig) => {
      setScores((prev) => {
        const next = new Map(prev);
        const current = next.get(ball.username) || {
          username: ball.username,
          nickname: ball.nickname,
          avatar: ball.avatar,
          score: 0,
          ballsDropped: 0,
          ballsScored: 0,
          totalGifts: 0,
        };

        const earnedPoints = bucket.multiplier * (ball.type === 'boss' ? 5 : ball.type === 'fire' ? 3 : 1);
        next.set(ball.username, {
          ...current,
          score: current.score + earnedPoints,
          ballsScored: current.ballsScored + 1,
        });

        return next;
      });
    };
  }, []);

  // 2. Vòng lặp Game Loop
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev > 1) return prev - 1;

        if (phase === 'GATHERING') {
          setPhase('RACING');
          engineRef.current?.openGate();
          speak('Cổng đua đã mở! Toàn bộ bi túa xuống rồi anh em ơi!');
          return RACING_TIME;
        } else if (phase === 'RACING') {
          setPhase('SUMMARY');
          engineRef.current?.closeGate();
          speak('Hết giờ đua! Hãy cùng xem ai là nhà vô địch ván này!');
          try {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          } catch {}
          return SUMMARY_TIME;
        } else {
          setPhase('GATHERING');
          setRoundNumber((r) => r + 1);
          setScores((curScores) => {
            const sorted = Array.from(curScores.values()).sort((a, b) => b.score - a.score);
            if (sorted[0]) {
              setLastChampion(sorted[0]);
            }
            return new Map();
          });
          speak('Ván mới bắt đầu! Gõ phím 1 để thả avatar của bạn vào đường đua!');
          return GATHERING_TIME;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, speak]);

  // 3. Xử lý Thả bi
  const handleDropBall = useCallback(
    (
      username: string,
      nickname: string,
      avatar: string,
      type: BallType = 'normal',
      bypassGate = false,
      bypassCooldown = false
    ) => {
      const now = Date.now();
      if (type === 'normal' && !bypassCooldown) {
        const lastDrop = cooldowns.current.get(username) || 0;
        // Cooldown nhẹ 2s cho test mượt mà
        if (now - lastDrop < 2000) return;
        cooldowns.current.set(username, now);
      }

      setScores((prev) => {
        const next = new Map(prev);
        const current = next.get(username) || {
          username,
          nickname,
          avatar,
          score: 0,
          ballsDropped: 0,
          ballsScored: 0,
          totalGifts: 0,
        };
        next.set(username, { ...current, ballsDropped: current.ballsDropped + 1 });
        return next;
      });

      engineRef.current?.dropBall({ username, nickname, avatar, type }, bypassGate);
    },
    []
  );

  // 4. Lắng nghe SSE từ TikTok Live / Test API
  useEffect(() => {
    const es = new EventSource('/api/tiktok/events');

    es.addEventListener('status', (e) => {
      try {
        setLiveStats(JSON.parse(e.data));
      } catch {}
    });

    es.addEventListener('chat', (e) => {
      try {
        const data = JSON.parse(e.data);
        const comment = String(data.comment || data.content || data.text || data.message || '')
          .trim()
          .toLowerCase();
        const username = String(data.username || data.nickname || 'viewer_' + Math.floor(Math.random() * 1000));
        const nickname = String(data.nickname || data.username || 'Viewer');
        const avatar = String(data.avatar || '');

        if (
          comment === '1' ||
          comment.startsWith('1') ||
          comment.includes('1') ||
          comment.includes('thả') ||
          comment.includes('tha') ||
          comment.includes('go')
        ) {
          handleDropBall(username, nickname, avatar, 'normal', false, true);
        }
      } catch {}
    });

    es.addEventListener('gift', (e) => {
      try {
        const data = JSON.parse(e.data);
        const diamonds = Number(data.diamondCount || data.diamonds || 1) * Number(data.repeatCount || 1);
        const username = String(data.username || data.nickname || 'vip_' + Math.floor(Math.random() * 1000));
        const nickname = String(data.nickname || data.username || 'VIP');
        const avatar = String(data.avatar || '');

        setScores((prev) => {
          const next = new Map(prev);
          const current = next.get(username) || {
            username,
            nickname,
            avatar,
            score: 0,
            ballsDropped: 0,
            ballsScored: 0,
            totalGifts: 0,
          };
          next.set(username, { ...current, totalGifts: current.totalGifts + diamonds });
          return next;
        });

        if (diamonds <= 5) {
          for (let i = 0; i < 3; i++) {
            setTimeout(() => {
              handleDropBall(username, nickname, avatar, 'normal', false, true);
            }, i * 150);
          }
          speak(`Cảm ơn ${nickname} tặng hoa hồng! Nhân ba bi cho bạn!`);
        } else if (diamonds < 90) {
          const isFire = Math.random() < 0.5;
          handleDropBall(username, nickname, avatar, isFire ? 'fire' : 'iron', false, true);
          speak(`Cảm ơn ${nickname}! Đã kích hoạt ${isFire ? 'Bi Lửa' : 'Bi Sắt'} cực mạnh!`);
        } else if (diamonds < 1000) {
          engineRef.current?.triggerEarthquake(nickname);
          speak(`Ối dồi ôi! ${nickname} vừa tạo ra động đất rung chuyển cả bàn bi!`);
        } else {
          engineRef.current?.triggerBoss(nickname, avatar);
          speak(`Cực sốc! Đại gia ${nickname} xuất hiện với Boss Trùm và mưa bi vàng!`);
        }
      } catch {}
    });

    es.addEventListener('control', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.action === 'setPhase') {
          setPhase(data.payload);
          if (data.payload === 'RACING') engineRef.current?.openGate();
          if (data.payload === 'GATHERING') engineRef.current?.closeGate();
        } else if (data.action === 'openGate') {
          engineRef.current?.openGate();
        } else if (data.action === 'closeGate') {
          engineRef.current?.closeGate();
        } else if (data.action === 'dropBall') {
          const p = data.payload || {};
          handleDropBall(
            p.username || 'tester_' + Math.floor(Math.random() * 1000),
            p.nickname || 'Tester',
            p.avatar || '',
            p.type || 'normal',
            p.bypassGate ?? false,
            true
          );
        } else if (data.action === 'earthquake') {
          engineRef.current?.triggerEarthquake(data.payload?.user || 'Tester');
        } else if (data.action === 'boss') {
          engineRef.current?.triggerBoss(data.payload?.user || 'VIP', data.payload?.avatar || '');
        }
      } catch {}
    });

    return () => es.close();
  }, [handleDropBall, speak]);

  const topPlayers = Array.from(scores.values()).sort((a, b) => b.score - a.score);
  const topDonator = Array.from(scores.values()).sort((a, b) => b.totalGifts - a.totalGifts)[0];

  return {
    phase,
    timeLeft,
    roundNumber,
    scores,
    topPlayers,
    topDonator,
    lastChampion,
    liveStats,
    attachEngine,
    handleDropBall,
    setPhase,
    speak,
    toggleGate: () => {
      if (engineRef.current?.isGateOpen) {
        engineRef.current.closeGate();
      } else {
        engineRef.current?.openGate();
      }
    },
    isGateOpen: () => engineRef.current?.isGateOpen ?? false,
    triggerEarthquake: (user: string) => engineRef.current?.triggerEarthquake(user),
    triggerBoss: (user: string, avatar: string) => engineRef.current?.triggerBoss(user, avatar),
  };
}
