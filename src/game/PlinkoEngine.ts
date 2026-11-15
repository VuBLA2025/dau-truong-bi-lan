import Matter from 'matter-js';
import { BallData, BallType, BucketConfig } from '../types/game';
import { sound } from './sound';

const { Engine, Bodies, Composite, Body, Events, Vector } = Matter;

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1480;

interface Peg {
  body: Matter.Body;
  hitTimer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
}

export class PlinkoEngine {
  public engine: Matter.Engine;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private pegs: Peg[] = [];
  private gears: { body: Matter.Body; radius: number; angle: number; speed: number; x: number; y: number }[] = [];
  private gate: Matter.Body | null = null;
  public isGateOpen = false;

  private balls: Map<number, { body: Matter.Body; data: BallData }> = new Map();
  private avatarCache: Map<string, HTMLCanvasElement> = new Map();
  private particles: Particle[] = [];

  // Buckets config at bottom (CANVAS_HEIGHT = 1480)
  public buckets: BucketConfig[] = [
    { id: 'b1', label: 'x1', multiplier: 1, color: '#00d2ff', glow: 'rgba(0,210,255,0.7)', x: 108, y: 1390, width: 180, height: 160 },
    { id: 'b2', label: 'x2', multiplier: 2, color: '#00f59b', glow: 'rgba(0,245,155,0.7)', x: 324, y: 1390, width: 180, height: 160 },
    { id: 'b3', label: 'x5', multiplier: 5, color: '#ffbe0b', glow: 'rgba(255,190,11,0.7)', x: 540, y: 1390, width: 180, height: 160 },
    { id: 'b4', label: 'x10', multiplier: 10, color: '#ff0055', glow: 'rgba(255,0,85,0.7)', x: 756, y: 1390, width: 180, height: 160 },
    { id: 'b5', label: 'x100 BOSS', multiplier: 100, color: '#9b5de5', glow: 'rgba(155,93,229,0.85)', x: 972, y: 1390, width: 180, height: 160 },
  ];

  // Callback khi có bi rơi vào rổ
  public onScore: ((player: BallData, bucket: BucketConfig) => void) | null = null;

  // Earthquake effect
  private earthquakeTimeRemaining = 0;
  private earthquakeUser = '';

  // Interval xả mưa bi vàng của BOSS (để hủy khi reset ván)
  private bossInterval: ReturnType<typeof setInterval> | null = null;

  private animFrameId: number | null = null;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.ctx = canvas.getContext('2d')!;

    this.engine = Engine.create({
      gravity: { x: 0, y: 1.15, scale: 0.001 },
      enableSleeping: false,
    });

    this.setupWorld();
    this.setupCollisionHandlers();
    this.startLoop();
  }

  private setupWorld() {
    const world = this.engine.world;

    // 1. Tường biên 2 bên & Đáy (Walls & Floor)
    const wallLeft = Bodies.rectangle(12, CANVAS_HEIGHT / 2, 24, CANVAS_HEIGHT, {
      isStatic: true,
      restitution: 0.8,
    });
    const wallRight = Bodies.rectangle(CANVAS_WIDTH - 12, CANVAS_HEIGHT / 2, 24, CANVAS_HEIGHT, {
      isStatic: true,
      restitution: 0.8,
    });
    const floor = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 6, CANVAS_WIDTH, 20, {
      isStatic: true,
      restitution: 0.2,
    });

    // 2. Khay gom bi ở đỉnh (Holding Funnel at Top: Y: 70 -> 240)
    const topFunnelLeft = Bodies.rectangle(230, 160, 460, 24, {
      isStatic: true,
      angle: 0.38,
      restitution: 0.5,
    });
    const topFunnelRight = Bodies.rectangle(CANVAS_WIDTH - 230, 160, 460, 24, {
      isStatic: true,
      angle: -0.38,
      restitution: 0.5,
    });

    // Cổng chắn khay bi (Gate) ở Y = 250, X = 540
    this.gate = Bodies.rectangle(CANVAS_WIDTH / 2, 252, 360, 24, {
      isStatic: true,
      restitution: 0.6,
      label: 'gate',
    });

    // 3. Đường ray dẫn dốc 2 bên sườn (Side Launchers / Slopes)
    const sideSlopeL1 = Bodies.rectangle(120, 460, 260, 24, { isStatic: true, angle: 0.55, restitution: 0.9 });
    const sideSlopeR1 = Bodies.rectangle(CANVAS_WIDTH - 120, 460, 260, 24, { isStatic: true, angle: -0.55, restitution: 0.9 });

    const sideSlopeL2 = Bodies.rectangle(90, 980, 200, 24, { isStatic: true, angle: 0.7, restitution: 0.9 });
    const sideSlopeR2 = Bodies.rectangle(CANVAS_WIDTH - 90, 980, 200, 24, { isStatic: true, angle: -0.7, restitution: 0.9 });

    // 4. Lưới chốt đinh (Plinko Pegs)
    this.pegs = [];
    const rows = 12;
    const startY = 350;
    const rowSpacing = 72;
    const pegRadius = 9;

    for (let row = 0; row < rows; row++) {
      const pegsInRow = row % 2 === 0 ? 9 : 10;
      const spacingX = 86;
      const offsetX = (CANVAS_WIDTH - (pegsInRow - 1) * spacingX) / 2;
      const y = startY + row * rowSpacing;

      for (let col = 0; col < pegsInRow; col++) {
        const x = offsetX + col * spacingX;

        // Tránh đặt đinh quá sát bánh răng
        if ((x < 220 || x > CANVAS_WIDTH - 220) && y > 640 && y < 820) continue;

        const body = Bodies.circle(x, y, pegRadius, {
          isStatic: true,
          restitution: 0.75,
          friction: 0.05,
          label: 'peg',
        });
        Composite.add(world, body);
        this.pegs.push({ body, hitTimer: 0 });
      }
    }

    // 5. 2 Bánh răng xoay (Rotating Gears) 2 bên
    const gearRadius = 75;
    const leftGearBody = Bodies.circle(130, 720, gearRadius, { isStatic: true, label: 'gear' });
    const rightGearBody = Bodies.circle(CANVAS_WIDTH - 130, 720, gearRadius, { isStatic: true, label: 'gear' });

    this.gears = [
      { body: leftGearBody, radius: gearRadius, angle: 0, speed: 0.035, x: 130, y: 720 },
      { body: rightGearBody, radius: gearRadius, angle: 0, speed: -0.035, x: CANVAS_WIDTH - 130, y: 720 },
    ];
    Composite.add(world, [leftGearBody, rightGearBody]);

    // 6. Thanh chắn chia các thùng điểm (Bucket Dividers) ở đáy
    const dividers: Matter.Body[] = [];
    const bucketWidth = 1080 / 5; // 216px mỗi thùng
    for (let i = 0; i <= 5; i++) {
      const x = i * bucketWidth;
      const divider = Bodies.rectangle(x, CANVAS_HEIGHT - 100, 16, 200, {
        isStatic: true,
        restitution: 0.3,
        label: 'divider',
      });
      dividers.push(divider);
    }

    // 7. Cảm biến lọt rổ (Bucket Sensors)
    this.buckets.forEach((b, idx) => {
      b.x = idx * bucketWidth + bucketWidth / 2;
      b.width = bucketWidth - 16;
      b.y = CANVAS_HEIGHT - 100;

      const sensor = Bodies.rectangle(b.x, CANVAS_HEIGHT - 40, b.width, 50, {
        isStatic: true,
        isSensor: true,
        label: `bucket_${b.id}`,
      });
      Composite.add(world, sensor);
    });

    Composite.add(world, [
      wallLeft,
      wallRight,
      floor,
      topFunnelLeft,
      topFunnelRight,
      this.gate,
      sideSlopeL1,
      sideSlopeR1,
      sideSlopeL2,
      sideSlopeR2,
      ...dividers,
    ]);
  }

  private setupCollisionHandlers() {
    Events.on(this.engine, 'collisionStart', (evt) => {
      for (const pair of evt.pairs) {
        const { bodyA, bodyB } = pair;

        // 1. Kiểm tra va chạm với Chốt (Peg)
        const checkPeg = (b: Matter.Body) => {
          if (b.label === 'peg') {
            const peg = this.pegs.find((p) => p.body === b);
            if (peg) {
              peg.hitTimer = 1.0;
              sound.playPegHit(Math.random() * 200 - 100);
            }
          }
        };
        checkPeg(bodyA);
        checkPeg(bodyB);

        // 2. Va chạm giữa Bi Lửa và các bi khác -> Kích nổ đẩy bi xung quanh
        const checkFireBall = (fireBody: Matter.Body, targetBody: Matter.Body) => {
          const ballA = this.balls.get(fireBody.id);
          if (ballA?.data.type === 'fire') {
            const forceMag = 0.055;
            const delta = Vector.sub(targetBody.position, fireBody.position);
            const normal = Vector.normalise(delta);
            Body.applyForce(targetBody, targetBody.position, Vector.mult(normal, forceMag));
            this.spawnExplosionParticles(fireBody.position.x, fireBody.position.y, '#ff4500', 12);
          }
        };
        checkFireBall(bodyA, bodyB);
        checkFireBall(bodyB, bodyA);

        // 3. Kiểm tra bi lọt vào Thùng điểm (Bucket Sensor)
        const checkBucket = (sensorBody: Matter.Body, ballBody: Matter.Body) => {
          if (sensorBody.label?.startsWith('bucket_') && this.balls.has(ballBody.id)) {
            const bucketId = sensorBody.label.replace('bucket_', '');
            const bucket = this.buckets.find((b) => b.id === bucketId);
            const ballItem = this.balls.get(ballBody.id);

            if (bucket && ballItem) {
              sound.playScore(bucket.multiplier);
              this.spawnExplosionParticles(ballBody.position.x, bucket.y - 20, bucket.color, 24);

              if (this.onScore) {
                this.onScore(ballItem.data, bucket);
              }

              Composite.remove(this.engine.world, ballBody);
              this.balls.delete(ballBody.id);
            }
          }
        };

        checkBucket(bodyA, bodyB);
        checkBucket(bodyB, bodyA);
      }
    });
  }

  // Điều khiển cổng khay gom bi
  public openGate() {
    if (!this.isGateOpen && this.gate) {
      Composite.remove(this.engine.world, this.gate);
      this.isGateOpen = true;
      sound.playStartHorn();
    }
  }

  public closeGate() {
    if (this.isGateOpen && this.gate) {
      Composite.add(this.engine.world, this.gate);
      this.isGateOpen = false;
    }
  }

  public getBallCount() {
    return this.balls.size;
  }

  // Thả bi mới
  public dropBall(
    player: {
      username: string;
      nickname: string;
      avatar?: string;
      type?: BallType;
      radius?: number;
      color?: string;
      glowColor?: string;
    },
    bypassGate = false
  ) {
    const ballType: BallType = player.type || 'normal';
    let radius = player.radius || 22;
    let mass = 1.0;
    let restitution = 0.65;
    let color = player.color || '#00f5ff';
    let glowColor = player.glowColor || 'rgba(0, 245, 255, 0.7)';

    if (ballType === 'fire') {
      radius = player.radius || 26;
      mass = 2.5;
      restitution = 0.8;
      color = '#ff3300';
      glowColor = 'rgba(255, 68, 0, 0.9)';
    } else if (ballType === 'iron') {
      radius = player.radius || 28;
      mass = 8.5;
      restitution = 0.35;
      color = '#e2e8f0';
      glowColor = 'rgba(226, 232, 240, 0.8)';
    } else if (ballType === 'boss') {
      radius = 32;
      mass = 4.0;
      restitution = 0.85;
      color = '#ffd700';
      glowColor = 'rgba(255, 215, 0, 0.95)';
    }

    let spawnX = CANVAS_WIDTH / 2 + (Math.random() * 260 - 130);
    let spawnY = 80 + Math.random() * 50;

    if (this.isGateOpen || bypassGate) {
      spawnY = 280 + Math.random() * 40;
      spawnX = CANVAS_WIDTH / 2 + (Math.random() * 320 - 160);
    }

    const ballBody = Bodies.circle(spawnX, spawnY, radius, {
      restitution,
      friction: 0.04,
      density: 0.001 * mass,
      label: 'ball',
    });

    Body.setVelocity(ballBody, { x: (Math.random() - 0.5) * 3, y: 1 + Math.random() * 2 });

    const ballData: BallData = {
      id: `ball_${Date.now()}_${Math.random()}`,
      username: player.username,
      nickname: player.nickname,
      avatar: player.avatar || '',
      type: ballType,
      radius,
      color,
      glowColor,
      createdAt: Date.now(),
    };

    if (player.avatar && !this.avatarCache.has(player.avatar)) {
      this.preloadAvatar(player.avatar, player.nickname, color);
    }

    Composite.add(this.engine.world, ballBody);
    this.balls.set(ballBody.id, { body: ballBody, data: ballData });
  }

  public triggerEarthquake(username: string) {
    this.earthquakeTimeRemaining = 3500;
    this.earthquakeUser = username;
    sound.playEarthquake();
  }

  // Xóa toàn bộ bi khỏi bàn (dùng khi sang ván mới): bi đã lọt rổ thì
  // engine tự xóa rồi, còn bi đang lăn / kẹt trên bàn / nằm trong khay
  // phải xóa tay, nếu không bi cũ nằm lại sang ván mới.
  public clearBalls() {
    if (this.bossInterval) {
      clearInterval(this.bossInterval);
      this.bossInterval = null;
    }
    for (const { body } of this.balls.values()) {
      Composite.remove(this.engine.world, body);
    }
    this.balls.clear();
  }

  public triggerBoss(username: string, avatar: string) {
    const center = { x: CANVAS_WIDTH / 2, y: 600 };
    for (const { body } of this.balls.values()) {
      const dir = Vector.sub(center, body.position);
      Body.applyForce(body, body.position, Vector.mult(Vector.normalise(dir), 0.04));
    }

    let count = 0;
    this.bossInterval = setInterval(() => {
      this.dropBall(
        {
          username,
          nickname: username,
          avatar,
          type: 'boss',
          radius: 28,
          color: '#ffd700',
          glowColor: 'rgba(255, 215, 0, 0.95)',
        },
        true
      );
      count++;
      if (count >= 20 && this.bossInterval) {
        clearInterval(this.bossInterval);
        this.bossInterval = null;
      }
    }, 100);
  }

  private preloadAvatar(url: string, nickname: string, borderColor: string) {
    const offscreen = document.createElement('canvas');
    offscreen.width = 64;
    offscreen.height = 64;
    const octx = offscreen.getContext('2d')!;

    const proxyUrl = url.startsWith('http') ? `/api/avatar-proxy?url=${encodeURIComponent(url)}` : url;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const drawFallback = () => {
      octx.clearRect(0, 0, 64, 64);
      octx.save();
      octx.beginPath();
      octx.arc(32, 32, 28, 0, Math.PI * 2);
      octx.fillStyle = '#1e1b4b';
      octx.fill();
      octx.lineWidth = 3;
      octx.strokeStyle = borderColor;
      octx.stroke();

      octx.font = 'bold 24px sans-serif';
      octx.fillStyle = '#ffffff';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText((nickname || 'U').charAt(0).toUpperCase(), 32, 32);
      octx.restore();
      this.avatarCache.set(url, offscreen);
    };

    img.onload = () => {
      try {
        octx.clearRect(0, 0, 64, 64);
        octx.save();
        octx.beginPath();
        octx.arc(32, 32, 28, 0, Math.PI * 2);
        octx.clip();
        octx.drawImage(img, 4, 4, 56, 56);
        octx.restore();

        octx.beginPath();
        octx.arc(32, 32, 28, 0, Math.PI * 2);
        octx.lineWidth = 3;
        octx.strokeStyle = borderColor;
        octx.stroke();

        this.avatarCache.set(url, offscreen);
      } catch {
        drawFallback();
      }
    };

    img.onerror = () => drawFallback();
    img.src = proxyUrl;
  }

  private spawnExplosionParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color,
        size: 3 + Math.random() * 4,
        alpha: 1,
        life: 0.8 + Math.random() * 0.4,
      });
    }
  }

  private startLoop() {
    const loop = (timestamp: number) => {
      if (!this.lastTime) this.lastTime = timestamp;
      const delta = Math.min((timestamp - this.lastTime) / 1000, 0.05);
      this.lastTime = timestamp;

      this.update(delta, timestamp);
      this.render();

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private update(delta: number, timestamp: number) {
    if (this.earthquakeTimeRemaining > 0) {
      this.earthquakeTimeRemaining -= delta * 1000;
      this.engine.gravity.x = Math.sin(timestamp / 70) * 1.6;
      if (Math.random() < 0.3) {
        this.spawnExplosionParticles(Math.random() * CANVAS_WIDTH, CANVAS_HEIGHT - 100, '#ff9900', 3);
      }
    } else {
      this.engine.gravity.x = 0;
    }

    for (const gear of this.gears) {
      gear.angle += gear.speed;
      Body.setAngle(gear.body, gear.angle);
    }

    for (const peg of this.pegs) {
      if (peg.hitTimer > 0) {
        peg.hitTimer = Math.max(0, peg.hitTimer - delta * 3.5);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.alpha -= delta / p.life;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (const { body, data } of this.balls.values()) {
      if (data.type === 'fire' && Math.random() < 0.6) {
        this.particles.push({
          x: body.position.x + (Math.random() * 8 - 4),
          y: body.position.y + (Math.random() * 8 - 4),
          vx: (Math.random() - 0.5) * 1.5,
          vy: -1 - Math.random() * 2,
          color: Math.random() < 0.5 ? '#ff4500' : '#ffbe0b',
          size: 3 + Math.random() * 3,
          alpha: 0.8,
          life: 0.35,
        });
      }
    }

    Engine.update(this.engine, delta * 1000);
  }

  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Nền Cyberpunk
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, '#0a0a23');
    bgGrad.addColorStop(0.5, '#050515');
    bgGrad.addColorStop(1, '#02020a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Viền bàn chơi
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;
    ctx.strokeRect(10, 10, CANVAS_WIDTH - 20, CANVAS_HEIGHT - 20);
    ctx.restore();

    // 2. Khay gom bi ở đỉnh & Cổng chắn
    ctx.save();
    ctx.strokeStyle = '#9b5de5';
    ctx.lineWidth = 8;
    ctx.shadowColor = '#9b5de5';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(30, 70);
    ctx.lineTo(380, 245);
    ctx.moveTo(CANVAS_WIDTH - 30, 70);
    ctx.lineTo(CANVAS_WIDTH - 380, 245);
    ctx.stroke();

    if (!this.isGateOpen && this.gate) {
      // Cổng laser đỏ khi đang đóng
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 12;
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(375, 252);
      ctx.lineTo(CANVAS_WIDTH - 375, 252);
      ctx.stroke();

      ctx.font = 'bold 20px "Orbitron", sans-serif';
      ctx.fillStyle = '#ff0055';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ CỔNG ĐUA: ĐANG ĐÓNG (GOM BI) ⚡', CANVAS_WIDTH / 2, 235);
    } else {
      // Cổng mở - laser xanh
      ctx.font = 'bold 20px "Orbitron", sans-serif';
      ctx.fillStyle = '#00f59b';
      ctx.shadowColor = '#00f59b';
      ctx.shadowBlur = 15;
      ctx.textAlign = 'center';
      ctx.fillText('🔥 CỔNG ĐUA: ĐANG MỞ - XẢ BI! 🔥', CANVAS_WIDTH / 2, 240);
    }
    ctx.restore();

    // 3. Bánh răng xoay
    for (const gear of this.gears) {
      ctx.save();
      ctx.translate(gear.x, gear.y);
      ctx.rotate(gear.angle);

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;

      const teeth = 8;
      ctx.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a1 = (i / teeth) * Math.PI * 2;
        const a2 = ((i + 0.5) / teeth) * Math.PI * 2;
        const rOuter = gear.radius + 12;
        const rInner = gear.radius - 8;

        ctx.lineTo(Math.cos(a1) * rOuter, Math.sin(a1) * rOuter);
        ctx.lineTo(Math.cos(a2) * rInner, Math.sin(a2) * rInner);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#9b5de5';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Chốt đinh (Pegs)
    for (const { body, hitTimer } of this.pegs) {
      ctx.save();
      const x = body.position.x;
      const y = body.position.y;

      if (hitTimer > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 25 * hitTimer;
        ctx.beginPath();
        ctx.arc(x, y, 12 + 4 * hitTimer, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. Thùng điểm đáy
    this.buckets.forEach((b) => {
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 18;

      const left = b.x - b.width / 2;
      const top = b.y - 80;
      ctx.strokeRect(left, top, b.width, 160);

      const bucketGrad = ctx.createLinearGradient(0, top, 0, top + 160);
      bucketGrad.addColorStop(0, 'rgba(0,0,0,0.2)');
      bucketGrad.addColorStop(1, b.glow);
      ctx.fillStyle = bucketGrad;
      ctx.fillRect(left, top, b.width, 160);

      // Tự thu nhỏ chữ nhãn rổ cho vừa chiều rộng rổ (nhãn "x100 BOSS"
      // dài hơn các rổ khác, cỡ 36px sẽ tràn ra ngoài mép phải của bàn).
      let fontSize = 36;
      ctx.font = `bold ${fontSize}px "Orbitron", sans-serif`;
      const maxLabelWidth = b.width - 12;
      while (fontSize > 20 && ctx.measureText(b.label).width > maxLabelWidth) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px "Orbitron", sans-serif`;
      }
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 16;
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x, b.y + 20);

      ctx.restore();
    });

    // 6. Vẽ các Viên Bi (Balls)
    for (const { body, data } of this.balls.values()) {
      ctx.save();
      const x = body.position.x;
      const y = body.position.y;
      const r = data.radius;

      ctx.shadowColor = data.glowColor;
      ctx.shadowBlur = data.type === 'boss' ? 30 : data.type === 'fire' ? 24 : 14;

      const cachedAvatar = data.avatar ? this.avatarCache.get(data.avatar) : null;
      if (cachedAvatar) {
        ctx.drawImage(cachedAvatar, x - r, y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = data.color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(data.nickname.charAt(0).toUpperCase(), x, y);
      }

      ctx.font = 'bold 14px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.fillText(data.nickname.slice(0, 9), x, y + r + 14);

      ctx.restore();
    }

    // 7. Hạt hiệu ứng
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 8. Banner Động Đất
    if (this.earthquakeTimeRemaining > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
      ctx.fillRect(0, 520, CANVAS_WIDTH, 140);

      ctx.font = '900 64px "Orbitron", sans-serif';
      ctx.fillStyle = '#ff0033';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 35;
      ctx.textAlign = 'center';
      ctx.fillText('⚡ ĐỘNG ĐẤT! ⚡', CANVAS_WIDTH / 2, 590);

      ctx.font = 'bold 28px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 15;
      ctx.fillText(`@${this.earthquakeUser} VỪA TẠO RA ĐỘNG ĐẤT!`, CANVAS_WIDTH / 2, 635);
      ctx.restore();
    }
  }

  public destroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}
