import { useState, useEffect, useRef, useCallback } from 'react';
import { BallData, BallType, BucketConfig, GamePhase, PlayerScore } from '../types/game';
import { PlinkoEngine } from './PlinkoEngine';
import confetti from 'canvas-confetti';

const GATHERING_TIME = 45;
const RACING_TIME = 120;
const SUMMARY_TIME = 15;

const PHASE_DURATIONS: Record<GamePhase, number> = {
  GATHERING: GATHERING_TIME,
  RACING: RACING_TIME,
  SUMMARY: SUMMARY_TIME,
};

// Panel (dashboard) là "leader": chạy vòng lặp tự động + broadcast đồng bộ.
// Stage (tab ?stage=1) là "follower": chỉ đếm ngược, đổi phase theo lệnh
// từ panel qua SSE. Nếu quá 15s không nhận được sync/control nào thì stage
// tự chạy vòng lặp dự phòng để stage vẫn chơi được khi mở một mình
// (ví dụ chỉ mở stage trên OBS mà quên mở panel).
const SYNC_EVERY_TICKS = 5;
const STAGE_ALONE_TIMEOUT_MS = 15000;

export function usePlinkoGame() {
  const isStage = typeof window !== 'undefined' && window.location.search.includes('stage=1');
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

  // Mirror state vào ref để dùng trong interval / SSE handler (tránh stale closure)
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const roundRef = useRef(roundNumber);
  roundRef.current = roundNumber;
  // Lần cuối stage nhận được lệnh/sync từ panel (để biết panel còn sống không)
  const lastSyncAtRef = useRef(Date.now());
  const syncTickRef = useRef(0);

  // MC Voice TTS queue + trạng thái để panel hiển thị (kiểm chứng được)
  const isSpeakingRef = useRef(false);
  const speechQueueRef = useRef<string[]>([]);
  const [speechStatus, setSpeechStatus] = useState<{ state: 'idle' | 'speaking' | 'error'; text: string }>({
    state: 'idle',
    text: '',
  });

  const speak = useCallback((text: string) => {
    if (!text) return;
    speechQueueRef.current.push(text);
    processSpeechQueue();
  }, []);

  const processSpeechQueue = () => {
    if (isSpeakingRef.current || speechQueueRef.current.length === 0) return;
    const nextText = speechQueueRef.current.shift()!;
    isSpeakingRef.current = true;
    setSpeechStatus({ state: 'speaking', text: nextText });

    const audio = new Audio(`/api/tts?text=${encodeURIComponent(nextText)}&rate=1.25`);
    audio.onended = () => {
      isSpeakingRef.current = false;
      setSpeechStatus({ state: 'idle', text: '' });
      setTimeout(processSpeechQueue, 350);
    };
    audio.onerror = () => {
      isSpeakingRef.current = false;
      setSpeechStatus({ state: 'error', text: nextText });
      setTimeout(processSpeechQueue, 200);
    };
    audio.play().catch(() => {
      isSpeakingRef.current = false;
      setSpeechStatus({ state: 'error', text: nextText });
    });
  };

  // Gửi lệnh xuống server để broadcast qua SSE cho mọi tab (panel + stage).
  // Khi server đặt PANEL_KEY thì kèm luôn key (panel lưu trong
  // sessionStorage lúc đăng nhập); server không đặt key thì header trống
  // cũng qua. Đọc trực tiếp từ sessionStorage mỗi lần gọi để không bị
  // stale closure (key chỉ có sau khi user đăng nhập).
  const postControl = useCallback((action: string, payload?: any) => {
    let key = '';
    try {
      key = sessionStorage.getItem('bilan-panel-key') || '';
    } catch {}
    fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-panel-key': key },
      body: JSON.stringify({ action, payload }),
    }).catch(() => {});
  }, []);

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

  // Kết thúc ván: chốt quán quân, xóa điểm, xóa toàn bộ bi khỏi bàn
  // (bi chưa kịp lọt rổ / còn kẹt trên bàn cũng bị xóa, tránh bi cũ
  // nằm lại sang ván mới).
  const startNewRound = useCallback(() => {
    const sorted = Array.from(scoresRef.current.values()).sort((a, b) => b.score - a.score);
    if (sorted[0]) {
      setLastChampion(sorted[0]);
    }
    setScores(new Map());
    setRoundNumber((r) => r + 1);
    engineRef.current?.clearBalls();
  }, []);

  // Chuyển phase: đổi phase + reset đồng hồ về đủ thời lượng của phase mới,
  // chạy hiệu ứng (cổng, giọng MC, pháo giấy, reset ván).
  // broadcast=true (chỉ panel làm) thì gửi lệnh xuống server để stage đi theo.
  // Nếu đã ở đúng phase đó rồi thì không làm gì (tránh chạy hiệu ứng 2 lần
  // khi nhận lại echo SSE của chính mình).
  const applyPhaseChange = useCallback(
    (next: GamePhase, opts?: { broadcast?: boolean }) => {
      const prev = phaseRef.current;
      if (prev === next) {
        // Đã ở đúng phase rồi (bấm lại nút của phase hiện tại, hoặc nhận
        // echo SSE của chính mình): không chạy hiệu ứng nữa, nhưng nếu là
        // lệnh từ panel thì vẫn gửi sync để stage nào vừa mở bắt kịp ngay
        // (sync mang giờ còn lại hiện tại của panel, không reset giờ).
        if (opts?.broadcast) {
          postControl('sync', { phase: next, timeLeft: timeLeftRef.current, roundNumber: roundRef.current });
        }
        return;
      }
      setPhase(next);
      setTimeLeft(PHASE_DURATIONS[next]);
      // Cập nhật ref ngay lập tức (không chờ render) để interval/sync
      // đọc được giá trị mới — nếu không, tick interval đọc ref cũ
      // sẽ ghi đè timeLeft vừa reset (lỗi từng thấy: SUMMARY mà đồng hồ 90s).
      phaseRef.current = next;
      timeLeftRef.current = PHASE_DURATIONS[next];

      if (next === 'RACING') {
        engineRef.current?.openGate();
        speak('Cổng đua đã mở! Toàn bộ bi túa xuống rồi anh em ơi!');
      } else if (next === 'SUMMARY') {
        engineRef.current?.closeGate();
        speak('Hết giờ đua! Hãy cùng xem ai là nhà vô địch ván này!');
        try {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        } catch {}
      } else {
        // GATHERING = ván mới
        engineRef.current?.closeGate();
        startNewRound();
        speak('Ván mới bắt đầu! Gõ phím 1 để thả avatar của bạn vào đường đua!');
      }

      if (opts?.broadcast) {
        postControl('setPhase', next);
      }
    },
    [postControl, speak, startNewRound]
  );

  // Nút panel bấm: đổi phase ngay tại chỗ + broadcast cho stage đi theo
  const gotoPhase = useCallback(
    (p: GamePhase) => {
      applyPhaseChange(p, { broadcast: true });
    },
    [applyPhaseChange]
  );

  // 2. Vòng lặp Game Loop — PANEL là leader, STAGE chỉ đếm ngược theo sau
  useEffect(() => {
    // Panel gửi sync ngay khi mở để stage vừa mở theo kịp phase hiện tại
    if (!isStage) {
      postControl('sync', {
        phase: phaseRef.current,
        timeLeft: timeLeftRef.current,
        roundNumber: roundRef.current,
      });
    }

    const timer = setInterval(() => {
      // Đếm ngược bằng functional updater: luôn tính trên state mới nhất,
      // không bao giờ ghi đè một timeLeft vừa được set mới từ SSE
      // (tránh race interval-vs-SSE từng làm SUMMARY hiện 90s).
      setTimeLeft((prev) => Math.max(0, prev - 1));

      if (isStage) {
        // Stage hết giờ mà panel im lặng quá 15s (panel chưa mở hoặc mất
        // SSE) -> tự chạy vòng lặp dự phòng để stage vẫn chơi được một mình.
        if (timeLeftRef.current <= 0 && Date.now() - lastSyncAtRef.current > STAGE_ALONE_TIMEOUT_MS) {
          const cur = phaseRef.current;
          const next: GamePhase = cur === 'GATHERING' ? 'RACING' : cur === 'RACING' ? 'SUMMARY' : 'GATHERING';
          applyPhaseChange(next, { broadcast: false });
        }
        return;
      }

      // Panel: broadcast sync định kỳ (5s) để stage luôn khớp phase/giờ/ván,
      // kể cả khi stage mở muộn.
      syncTickRef.current += 1;
      if (syncTickRef.current % SYNC_EVERY_TICKS === 0) {
        postControl('sync', {
          phase: phaseRef.current,
          timeLeft: timeLeftRef.current,
          roundNumber: roundRef.current,
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isStage, applyPhaseChange, postControl]);

  // Panel: đếm ngược về 0 -> tự chuyển phase + broadcast cho stage đi theo
  useEffect(() => {
    if (isStage || timeLeft > 0) return;
    const cur = phaseRef.current;
    const next: GamePhase = cur === 'GATHERING' ? 'RACING' : cur === 'RACING' ? 'SUMMARY' : 'GATHERING';
    applyPhaseChange(next, { broadcast: true });
  }, [isStage, timeLeft, applyPhaseChange]);

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
        // Mọi lệnh control đều chứng tỏ panel còn sống (cho fallback của stage)
        lastSyncAtRef.current = Date.now();

        if (data.action === 'setPhase') {
          const p = data.payload as GamePhase;
          if (p === 'GATHERING' || p === 'RACING' || p === 'SUMMARY') {
            // Đổi phase + reset đồng hồ về đủ thời lượng của phase mới
            applyPhaseChange(p, { broadcast: false });
          }
        } else if (data.action === 'sync') {
          // Đồng bộ định kỳ từ panel: phase + giờ còn lại + số ván
          const p = data.payload || {};
          if (p.phase === 'GATHERING' || p.phase === 'RACING' || p.phase === 'SUMMARY') {
            const syncPhase = p.phase as GamePhase;
            if (syncPhase !== phaseRef.current) {
              applyPhaseChange(syncPhase, { broadcast: false });
            }
            if (typeof p.timeLeft === 'number') {
              setTimeLeft(Math.max(0, Math.min(PHASE_DURATIONS[syncPhase], p.timeLeft)));
            }
            if (typeof p.roundNumber === 'number') {
              setRoundNumber(p.roundNumber);
            }
          }
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
  }, [handleDropBall, speak, applyPhaseChange]);

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
    speechStatus,
    attachEngine,
    handleDropBall,
    setPhase,
    gotoPhase,
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
