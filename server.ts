/**
 * Đấu Trường Bi Lăn - TikTok LIVE Game Server
 *
 * - Kết nối phòng live TikTok (tiktok-live-connector)
 * - Đẩy sự kiện xuống trình duyệt qua SSE: /api/tiktok/events
 * - Lệnh điều khiển & Giả lập sự kiện: /api/test/emit, /api/control
 * - Proxy avatar tránh CORS: /api/avatar-proxy?url=...
 * - Giọng đọc MC tiếng Việt: /api/tts (Edge TTS / Google TTS)
 */
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3006;

const TTS_VOICE = process.env.TTS_VOICE || 'vi-VN-NamMinhNeural';
const TTS_PITCH = process.env.TTS_PITCH || '+4%';

// Mật khẩu panel (đặt PANEL_KEY trong Environment của Dokploy).
// Khi có PANEL_KEY, các lệnh điều khiển (kết nối TikTok, giả lập, điều
// khiển ván) yêu cầu header x-panel-key đúng — nếu không ai mở được link
// panel cũng điều khiển được game. Khi chưa đặt (chạy local) thì mở.
const PANEL_KEY = process.env.PANEL_KEY || '';
function requirePanelKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!PANEL_KEY) return next();
  if (req.headers['x-panel-key'] === PANEL_KEY) return next();
  return res.status(403).json({ success: false, error: 'Sai mật khẩu panel' });
}

app.use(express.json());

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ---------- SSE (Server-Sent Events) ----------
interface LiveStats {
  isConnected: boolean;
  isConnecting: boolean;
  username: string;
  roomId: string;
  viewerCount: number;
  totalLikes: number;
  error?: string;
}

const emptyStats = (): LiveStats => ({
  isConnected: false,
  isConnecting: false,
  username: '',
  roomId: '',
  viewerCount: 0,
  totalLikes: 0,
  error: '',
});

let liveStats = emptyStats();
let sseClients: express.Response[] = [];
let activeConn: InstanceType<typeof TikTokLiveConnection> | null = null;

function broadcast(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

app.get('/api/tiktok/status', (_req, res) => res.json(liveStats));

app.get('/api/tiktok/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.push(res);
  res.write(`event: status\ndata: ${JSON.stringify(liveStats)}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// Helper parsing TikTok payloads
const userOf = (d: any) => d?.uniqueId || d?.user?.uniqueId || d?.author?.uniqueId || 'viewer';
const nickOf = (d: any) => d?.nickname || d?.user?.nickname || d?.author?.nickname || userOf(d);
const avatarOf = (d: any) =>
  d?.profilePictureUrl ||
  d?.user?.profilePictureUrls?.[0] ||
  d?.user?.avatarThumb?.url_list?.[0] ||
  d?.user?.avatarMedium?.url_list?.[0] ||
  '';

// ---------- Connect / Disconnect TikTok ----------
app.post('/api/tiktok/connect', requirePanelKey, async (req, res) => {
  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, error: 'Chưa nhập TikTok username' });
  }

  const cleanUser = username.replace(/^@/, '').trim();
  if (activeConn) {
    try {
      activeConn.disconnect();
    } catch {}
    activeConn = null;
  }

  liveStats = { ...emptyStats(), isConnecting: true, username: cleanUser };
  broadcast('status', liveStats);

  const conn = new TikTokLiveConnection(cleanUser, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    clientParams: { clientType: 'web' },
  });

  conn.on(WebcastEvent.CONNECTED, (state: any) => {
    liveStats = {
      ...liveStats,
      isConnected: true,
      isConnecting: false,
      roomId: String(state?.roomId || ''),
      error: '',
    };
    broadcast('status', liveStats);
  });

  conn.on(WebcastEvent.DISCONNECTED, () => {
    liveStats = emptyStats();
    broadcast('status', liveStats);
  });

  conn.on(WebcastEvent.CHAT, (data: any) => {
    broadcast('chat', {
      username: userOf(data),
      nickname: nickOf(data),
      comment: data?.content || data?.comment || '',
      avatar: avatarOf(data),
      timestamp: Date.now(),
    });
  });

  const streakCounts = new Map<string, number>();
  conn.on(WebcastEvent.GIFT, (data: any) => {
    const username = userOf(data);
    const giftId = data?.giftId || 0;
    const key = `${username}_${giftId}`;
    const total = data?.repeatCount || 1;
    const delta = total - (streakCounts.get(key) || 0);
    const isStreakable = (data?.gift?.type ?? data?.giftDetails?.giftType ?? data?.giftType) === 1;
    if (isStreakable && !data?.repeatEnd) streakCounts.set(key, total);
    else streakCounts.delete(key);
    if (delta <= 0) return;

    broadcast('gift', {
      username,
      nickname: nickOf(data),
      giftName: data?.gift?.name || data?.giftDetails?.giftName || data?.giftName || 'Quà',
      giftId,
      diamondCount: data?.gift?.diamondCount || data?.diamondCount || data?.giftDetails?.diamondCount || 1,
      repeatCount: delta,
      avatar: avatarOf(data),
      timestamp: Date.now(),
    });
  });

  conn.on(WebcastEvent.MEMBER, (data: any) => {
    broadcast('member', {
      username: userOf(data),
      nickname: nickOf(data),
      avatar: avatarOf(data),
      timestamp: Date.now(),
    });
  });

  conn.on(WebcastEvent.LIKE, (data: any) => {
    if (typeof data?.totalLikeCount === 'number') liveStats.totalLikes = data.totalLikeCount;
    broadcast('like', {
      username: userOf(data),
      nickname: nickOf(data),
      likeCount: data?.likeCount || 1,
      totalLikes: liveStats.totalLikes,
    });
  });

  conn.on(WebcastEvent.ROOM_USER, (data: any) => {
    if (typeof data?.viewerCount === 'number') {
      liveStats.viewerCount = data.viewerCount;
      broadcast('roomUser', { viewerCount: data.viewerCount });
    }
  });

  conn.on(ControlEvent.ERROR, (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    liveStats.error = msg;
    broadcast('status', liveStats);
  });

  activeConn = conn;

  try {
    const live = await conn.fetchIsLive().catch(() => true);
    if (!live) throw new Error('TikTok báo tài khoản này chưa LIVE');
    const state = await Promise.race([
      conn.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Quá 30s không vào được phòng live')), 30000)),
    ]);
    return res.json({ success: true, roomId: state?.roomId });
  } catch (err: any) {
    const msg = err?.message || String(err);
    liveStats = { ...liveStats, isConnected: false, isConnecting: false, error: msg };
    broadcast('status', liveStats);
    return res.status(400).json({ success: false, error: msg });
  }
});

app.post('/api/tiktok/disconnect', requirePanelKey, (_req, res) => {
  try {
    activeConn?.disconnect();
  } catch {}
  activeConn = null;
  liveStats = emptyStats();
  broadcast('status', liveStats);
  res.json({ success: true });
});

// ---------- Avatar Proxy to avoid Canvas CORS Taint ----------
const avatarCache = new Map<string, { buffer: Buffer; mime: string }>();

app.get('/api/avatar-proxy', async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send('Missing url');

  const cached = avatarCache.get(url);
  if (cached) {
    res.setHeader('Content-Type', cached.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(cached.buffer);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mime = response.headers.get('content-type') || 'image/jpeg';

    if (avatarCache.size > 500) {
      const firstKey = avatarCache.keys().next().value;
      if (firstKey) avatarCache.delete(firstKey);
    }
    avatarCache.set(url, { buffer, mime });

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch {
    return res.status(404).send('Avatar fetch failed');
  }
});

// ---------- Giả lập sự kiện để test (Hỗ trợ cả payload lồng data lẫn payload phẳng) ----------
app.post('/api/test/emit', requirePanelKey, (req, res) => {
  const { type, data, ...rest } = req.body || {};
  const actualType = type || (rest.giftName ? 'gift' : 'chat');
  const event = {
    timestamp: Date.now(),
    avatar: '',
    username: 'tester_' + Math.floor(Math.random() * 1000),
    nickname: 'Tester',
    comment: '1',
    ...rest,
    ...(data || {}),
  };
  if (actualType === 'like') {
    liveStats.totalLikes += Number(event.likeCount) || 1;
    event.totalLikes = liveStats.totalLikes;
  }
  broadcast(actualType, event);
  res.json({ success: true, emitted: { type: actualType, event } });
});

// ---------- Lệnh điều khiển giữa Dashboard -> Stage qua SSE ----------
app.post('/api/control', requirePanelKey, (req, res) => {
  const { action, payload } = req.body || {};
  broadcast('control', { action, payload, timestamp: Date.now() });
  res.json({ success: true, action, payload });
});

// ---------- Voice MC (Edge TTS) ----------
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ttsCache = new Map<string, Buffer>();

async function edgeTts(text: string, rate: number, voiceName = TTS_VOICE): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(text), {
      rate: `${rate >= 1 ? '+' : ''}${Math.round((rate - 1) * 100)}%`,
      pitch: TTS_PITCH,
    });
    const chunks: Buffer[] = [];
    const read = (async () => {
      for await (const c of audioStream) chunks.push(c as Buffer);
    })();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Edge TTS timeout')), 10000));
    await Promise.race([read, timeout]);
    if (chunks.length === 0) throw new Error('Edge TTS empty audio');
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

app.get('/api/tts', async (req, res) => {
  const text = ((req.query.text as string) || '').trim().slice(0, 300);
  const rate = Math.min(2.0, Math.max(0.7, parseFloat(req.query.rate as string) || 1.2));
  const voice = req.query.v === 'f' ? 'vi-VN-HoaiMyNeural' : 'vi-VN-NamMinhNeural';

  if (!text) return res.status(400).send('Missing text');

  const cacheKey = `${voice}_${rate.toFixed(2)}_${text}`;
  const cached = ttsCache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.send(cached);
  }

  try {
    const audio = await edgeTts(text, rate, voice);
    if (ttsCache.size > 200) {
      const first = ttsCache.keys().next().value;
      if (first) ttsCache.delete(first);
    }
    ttsCache.set(cacheKey, audio);
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.send(audio);
  } catch (err: any) {
    return res.status(500).send('TTS Failed: ' + err.message);
  }
});

// ---------- Khởi động Express & Vite ----------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎮 [ĐẤU TRƯỜNG BI LĂN] Sẵn sàng tại: http://localhost:${PORT}`);
    console.log(`📺 Màn hình Live Stage (TikTok Studio): http://localhost:${PORT}?stage=1`);
    console.log(`🎛️ Bảng Điều Khiển (Dashboard): http://localhost:${PORT}\n`);
  });
}

start();
