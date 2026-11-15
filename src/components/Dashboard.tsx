import React, { useState, useEffect } from 'react';
import { usePlinkoGame } from '../game/usePlinkoGame';
import {
  Flame,
  Radio,
  Tv,
  Users,
  Heart,
  Volume2,
  Play,
  RotateCcw,
  Zap,
  ShieldAlert,
  Unlock,
  Lock,
  ExternalLink,
} from 'lucide-react';

interface DashboardProps {
  game: ReturnType<typeof usePlinkoGame>;
}

export const Dashboard: React.FC<DashboardProps> = ({ game }) => {
  const [tiktokUser, setTiktokUser] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [customSpeech, setCustomSpeech] = useState('');
  const [testNickname, setTestNickname] = useState('TuanAnh');

  // Mật khẩu panel: server đặt PANEL_KEY (Dokploy) thì panel yêu cầu nhập
  // đúng mới cho điều khiển; server không đặt key (chạy local) thì tự mở.
  const [panelKey, setPanelKey] = useState(() => sessionStorage.getItem('bilan-panel-key') || '');
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [checkingKey, setCheckingKey] = useState(false);
  const [keyChecked, setKeyChecked] = useState(false);

  // Lúc mở panel: thử ping không cần key — nếu server cũng 200 tức là
  // server không đặt PANEL_KEY (chạy local) -> khỏi bắt nhập mật khẩu.
  useEffect(() => {
    if (panelKey) {
      setKeyChecked(true);
      return;
    }
    fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping' }),
    })
      .then((res) => {
        if (res.ok) setPanelKey('__open__');
      })
      .catch(() => {})
      .finally(() => setKeyChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mật khẩu sai (server trả 403) -> bắt nhập lại
  const handleForbidden = () => {
    sessionStorage.removeItem('bilan-panel-key');
    setPanelKey('');
    setKeyError('Sai mật khẩu panel, nhập lại nhé!');
  };

  // Đăng nhập panel: thử 1 lệnh ping vô hại để kiểm tra key đúng hay sai
  // (server bỏ qua action lạ, chỉ kiểm tra key rồi trả 200/403).
  const handleLogin = async () => {
    if (!keyInput.trim()) return;
    setCheckingKey(true);
    setKeyError('');
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-panel-key': keyInput.trim() },
        body: JSON.stringify({ action: 'ping' }),
      });
      if (!res.ok) {
        setKeyError('Sai mật khẩu panel, nhập lại nhé!');
        return;
      }
      sessionStorage.setItem('bilan-panel-key', keyInput.trim());
      setPanelKey(keyInput.trim());
      setKeyInput('');
    } catch (err: any) {
      setKeyError('Lỗi: ' + err.message);
    } finally {
      setCheckingKey(false);
    }
  };

  // ID người chơi test ỔN ĐỊNH theo tên (không random mỗi lần bấm):
  // điểm/quà của cùng một tên test gộp vào đúng 1 dòng trên BXH,
  // giống như 1 viewer TikTok thật chỉ có 1 uniqueId duy nhất.
  // Trước đây mỗi lần bấm sinh username random khác nhau nên cùng tên
  // "TuanAnh" hiện cùng lúc ở QUÁN QUÂN + TOP 2 + TOP ĐẠI GIA.
  const testUid = `test_${testNickname.trim().toLowerCase().replace(/\s+/g, '_') || 'tester'}`;

  const handleConnect = async () => {
    if (!tiktokUser.trim()) return alert('Vui lòng nhập TikTok username!');
    setConnecting(true);
    try {
      const res = await fetch('/api/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-panel-key': panelKey },
        body: JSON.stringify({ username: tiktokUser }),
      });
      if (res.status === 403) {
        handleForbidden();
        return;
      }
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Kết nối thất bại');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const res = await fetch('/api/tiktok/disconnect', {
      method: 'POST',
      headers: { 'x-panel-key': panelKey },
    });
    if (res.status === 403) handleForbidden();
  };

  // Gửi lệnh giả lập chat/gift qua server
  const emitTest = async (type: string, data: any) => {
    const res = await fetch('/api/test/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-panel-key': panelKey },
      body: JSON.stringify({ type, data }),
    });
    if (res.status === 403) handleForbidden();
  };

  // Gửi lệnh điều khiển ván chơi/cổng qua server tới Stage
  const sendControl = async (action: string, payload?: any) => {
    const res = await fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-panel-key': panelKey },
      body: JSON.stringify({ action, payload }),
    });
    if (res.status === 403) handleForbidden();
  };

  // Chưa nhập mật khẩu panel -> hiện màn hình khóa (không cho thấy dashboard)
  if (!panelKey) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-300 bg-clip-text text-transparent">
              ĐẤU TRƯỜNG BI LĂN
            </h1>
            <p className="text-sm text-slate-400">Bảng điều khiển — nhập mật khẩu panel để vào</p>
          </div>
          {!keyChecked ? (
            <p className="text-sm text-slate-400">Đang kiểm tra...</p>
          ) : (
            <>
              <input
                type="password"
                placeholder="Mật khẩu panel"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLogin();
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400"
              />
              {keyError && <p className="text-sm text-rose-400 font-semibold">{keyError}</p>}
              <button
                onClick={handleLogin}
                disabled={checkingKey}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-5 py-2.5 rounded-xl font-bold transition"
              >
                {checkingKey ? 'Đang kiểm tra...' : 'Vào bảng điều khiển'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/30 text-cyan-400">
              <Radio className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-300 bg-clip-text text-transparent">
                ĐẤU TRƯỜNG BI LĂN - TRANG QUẢN LÝ
              </h1>
              <p className="text-sm text-slate-400">Bảng điều khiển & Giả lập sự kiện cho TikTok LIVE Studio</p>
            </div>
          </div>

          <a
            href="/?stage=1"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-cyan-500/25 transition-all transform hover:scale-105"
          >
            <Tv className="w-5 h-5" />
            <span>Mở Màn Hình Live Stage (9:16)</span>
            <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
          </a>
        </div>

        {/* 1. Kết nối kênh TikTok Live */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg">
          <h2 className="text-lg font-bold flex items-center gap-2 text-cyan-400">
            <Radio className="w-5 h-5" />
            Kết Nối Kênh TikTok Live Thật
          </h2>

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nhập username TikTok (ví dụ: mychannel)"
              value={tiktokUser}
              onChange={(e) => setTiktokUser(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400"
            />
            {game.liveStats.isConnected ? (
              <button
                onClick={handleDisconnect}
                className="bg-red-600 hover:bg-red-500 px-5 py-2.5 rounded-xl font-bold transition"
              >
                Ngắt kết nối
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 rounded-xl font-bold transition"
              >
                {connecting ? 'Đang kết nối...' : 'Kết nối Live'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-6 pt-1 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  game.liveStats.isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
                }`}
              />
              <span className="font-semibold">
                {game.liveStats.isConnected ? `Đã kết nối (@${game.liveStats.username})` : 'Chưa kết nối'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>{game.liveStats.viewerCount} người xem</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Heart className="w-4 h-4 text-pink-400" />
              <span>{game.liveStats.totalLikes} tim</span>
            </div>
          </div>
        </div>

        {/* 2. Điều khiển Vòng Lặp & Cổng Đua */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2 text-amber-400">
              <RotateCcw className="w-5 h-5" />
              Điều Khiển Vòng Lặp & Cổng Đua (Đồng Bộ Stage)
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Giai đoạn:</span>
              <span className="font-black text-cyan-300 uppercase px-3 py-1 rounded-lg bg-slate-800 border border-slate-700">
                {game.phase} ({game.timeLeft}s)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={() => game.gotoPhase('GATHERING')}
              className="flex-1 min-w-[140px] bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 py-3 rounded-xl font-bold border border-amber-500/40 text-sm transition"
            >
              1. Khay Gom Bi (45s)
            </button>
            <button
              onClick={() => game.gotoPhase('RACING')}
              className="flex-1 min-w-[140px] bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-300 py-3 rounded-xl font-bold border border-emerald-500/50 text-sm flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition"
            >
              <Unlock className="w-4 h-4" />
              2. Mở Cổng Đua Ngay!
            </button>
            <button
              onClick={() => game.gotoPhase('SUMMARY')}
              className="flex-1 min-w-[140px] bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 py-3 rounded-xl font-bold border border-purple-500/40 text-sm transition"
            >
              3. Tổng Kết Ván
            </button>
            <button
              onClick={() => sendControl('openGate')}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold border border-slate-700 text-sm flex items-center gap-2 transition"
            >
              <Unlock className="w-4 h-4 text-emerald-400" />
              <span>Mở Cổng Khay</span>
            </button>
            <button
              onClick={() => sendControl('closeGate')}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold border border-slate-700 text-sm flex items-center gap-2 transition"
            >
              <Lock className="w-4 h-4 text-rose-400" />
              <span>Đóng Cổng Khay</span>
            </button>
          </div>
        </div>

        {/* 3. Bộ Nút Test Giả Lập Tương Tác */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold flex items-center gap-2 text-pink-400">
              <Zap className="w-5 h-5" />
              Bộ Nút Test Tương Tác (Bắn Event Lên Màn Hình Live)
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Tên người chơi test:</span>
              <input
                type="text"
                value={testNickname}
                onChange={(e) => setTestNickname(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-1.5 text-white w-32 focus:border-pink-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* 1. Comment 1 Thả vào khay */}
            <button
              onClick={() => {
                const uid = testUid;
                emitTest('chat', {
                  username: uid,
                  nickname: testNickname,
                  comment: '1',
                  avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
                });
              }}
              className="flex flex-col items-center justify-center p-4 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 rounded-xl transition text-center active:scale-95 shadow"
            >
              <span className="text-2xl mb-1">💬</span>
              <span className="text-xs font-bold text-cyan-300">Gõ &quot;1&quot; Thả Bi</span>
              <span className="text-[10px] text-slate-400">Bi thường vào khay</span>
            </button>

            {/* 2. Thả Bi Lăn Ngay (Bypass Cổng) */}
            <button
              onClick={() => {
                const uid = testUid;
                sendControl('dropBall', {
                  username: uid,
                  nickname: testNickname,
                  avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
                  type: 'normal',
                  bypassGate: true,
                });
              }}
              className="flex flex-col items-center justify-center p-4 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/50 rounded-xl transition text-center active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
            >
              <span className="text-2xl mb-1">⚡</span>
              <span className="text-xs font-bold text-emerald-300">Thả Bi Lăn Ngay!</span>
              <span className="text-[10px] text-slate-400">Bypass cổng lăn luôn</span>
            </button>

            {/* 3. Tặng Hoa hồng */}
            <button
              onClick={() => {
                const uid = testUid;
                emitTest('gift', {
                  username: uid,
                  nickname: testNickname,
                  giftName: 'Hoa hồng',
                  diamondCount: 1,
                  repeatCount: 1,
                  avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
                });
              }}
              className="flex flex-col items-center justify-center p-4 bg-pink-950/60 hover:bg-pink-900/60 border border-pink-500/40 rounded-xl transition text-center active:scale-95 shadow"
            >
              <span className="text-2xl mb-1">🌹</span>
              <span className="text-xs font-bold text-pink-300">Tặng Hoa Hồng</span>
              <span className="text-[10px] text-slate-400">+3 quả bi</span>
            </button>

            {/* 4. Thả Bi Lửa */}
            <button
              onClick={() => {
                const uid = testUid;
                sendControl('dropBall', {
                  username: uid,
                  nickname: testNickname,
                  avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
                  type: 'fire',
                  bypassGate: true,
                });
              }}
              className="flex flex-col items-center justify-center p-4 bg-orange-950/60 hover:bg-orange-900/60 border border-orange-500/40 rounded-xl transition text-center active:scale-95 shadow"
            >
              <Flame className="w-7 h-7 text-orange-400 mb-1" />
              <span className="text-xs font-bold text-orange-300">Thả Bi Lửa 🔥</span>
              <span className="text-[10px] text-slate-400">Nổ & Hất văng bi</span>
            </button>

            {/* 5. Thả Bi Sắt */}
            <button
              onClick={() => {
                const uid = testUid;
                sendControl('dropBall', {
                  username: uid,
                  nickname: testNickname,
                  avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
                  type: 'iron',
                  bypassGate: true,
                });
              }}
              className="flex flex-col items-center justify-center p-4 bg-slate-800 hover:bg-slate-700 border border-slate-500/40 rounded-xl transition text-center active:scale-95 shadow"
            >
              <ShieldAlert className="w-7 h-7 text-slate-300 mb-1" />
              <span className="text-xs font-bold text-slate-200">Thả Bi Sắt ⚙️</span>
              <span className="text-[10px] text-slate-400">Nặng 8.5 đè bẹp bi</span>
            </button>

            {/* 6. Động Đất */}
            <button
              onClick={() => {
                sendControl('earthquake', { user: testNickname });
              }}
              className="flex flex-col items-center justify-center p-4 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 rounded-xl transition text-center active:scale-95 shadow"
            >
              <span className="text-2xl mb-1">🧢</span>
              <span className="text-xs font-bold text-amber-300">Động Đất ⚡</span>
              <span className="text-[10px] text-slate-400">Rung lắc 3.5s</span>
            </button>

            {/* 7. Boss Trùm */}
            <button
              onClick={() => {
                const uid = testUid;
                sendControl('boss', {
                  user: testNickname,
                  avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
                });
              }}
              className="col-span-2 sm:col-span-3 flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-purple-900/70 via-indigo-900/70 to-purple-900/70 hover:from-purple-800/80 hover:to-indigo-800/80 border border-purple-500/50 rounded-xl transition text-center active:scale-95 shadow-[0_0_20px_rgba(168,85,247,0.35)]"
            >
              <span className="text-3xl">🦁</span>
              <div className="text-left">
                <p className="text-sm font-extrabold text-purple-200">Kích Hoạt BOSS TRÙM (Mưa 20 Bi Vàng x100)</p>
                <p className="text-[11px] text-purple-300/80">Hút toàn bộ bi về tâm và xả mưa bi vàng</p>
              </div>
            </button>
          </div>
        </div>

        {/* 4. MC Giọng đọc & TTS */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 shadow-lg">
          <h2 className="text-lg font-bold flex items-center gap-2 text-emerald-400">
            <Volume2 className="w-5 h-5" />
            Giọng Nói MC Bình Luận Viên (Edge TTS)
          </h2>

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nhập câu MC nói thử..."
              value={customSpeech}
              onChange={(e) => setCustomSpeech(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-400 text-sm"
            />
            <button
              onClick={() => {
                if (customSpeech) game.speak(customSpeech);
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-xl font-bold transition text-sm shadow"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Đọc Thử</span>
            </button>
          </div>

          {/* Trạng thái giọng đọc để kiểm chứng được (trước đây bấm Đọc Thử
              xong không có phản hồi gì trên trang, không biết đã đọc hay lỗi) */}
          {game.speechStatus.state !== 'idle' && (
            <p
              className={`text-xs font-semibold px-1 ${
                game.speechStatus.state === 'speaking' ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {game.speechStatus.state === 'speaking'
                ? `🔊 Đang đọc: "${game.speechStatus.text.slice(0, 80)}"`
                : `⚠️ Không phát được giọng đọc — kiểm tra mạng/Edge TTS rồi bấm lại. Câu lỗi: "${game.speechStatus.text.slice(0, 80)}"`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
