# 🎮 Đấu Trường Bi Lăn (Plinko / Marble Race TikTok LIVE)

Game tương tác trực tiếp theo thời gian thực cho TikTok LIVE, thiết kế tối ưu tỉ lệ dọc **9:16 (1080x1920)** cho TikTok Live Studio & OBS.

---

## 🌟 Tính Năng Chính

1. **Bố Cục 3 Tầng Chuẩn Mockup (9:16):**
   * **Top 15% (Khu vực Vinh danh):** Bục Podium vinh danh Top 1 Quán Quân (vương miện vàng), Top 2 Bạc, Top 3 & Top Đại Gia tặng quà nhiều nhất. Đồng hồ đếm ngược giai đoạn ván chơi.
   * **Middle 70% (Khu vực Plinko):** Bàn Plinko neon Cyberpunk với lưới đinh chốt nảy, 2 bánh răng quay liên tục, tấm đệm nảy, khay gom bi đóng/mở tự động, 5 thùng điểm đáy (`x1`, `x2`, `x5`, `x10`, `x100 BOSS`).
   * **Bottom 15% (Khu vực CTA):** Marquee Ticker chạy chữ neon Cyberpunk kêu gọi viewer tương tác & tặng quà.

2. **Cơ Chế Tương Tác & Kiếm Tiền (Monetization Loop):**
   * **Gõ phím "1", "Thả", "Go":** Thả 1 viên bi thường mang Avatar tròn & Nickname của người xem (cooldown 25s chống spam).
   * **Hoa Hồng (1 xu):** Nhân 3 viên bi thả liên tiếp vào đường đua.
   * **Quà Vừa (10–50 xu):** Thả **Bi Lửa** (tạo sóng xung kích nổ khi va chạm) hoặc **Bi Sắt** (siêu nặng, đè bẹp và hất tung các bi khác).
   * **Mũ / Kính Râm (99 xu):** Kích hoạt **ĐỘNG ĐẤT (Earthquake)** trong 3.5 giây: rung lắc bàn chơi và đảo chiều trọng lực liên tục.
   * **Sư Tử / Quà VIP (>= 1.000 xu):** Kích hoạt **BOSS TRÙM**: Hút toàn bộ bi về tâm và phun ra một cơn mưa 25 quả bi vàng x100 điểm.

3. **Vòng Lặp Ván Chơi (Game Loop):**
   * **Gom bi (45s):** Cổng chắn đóng, bi dồn ở khay đỉnh.
   * **Đua bi (120s):** Cổng mở, hàng trăm viên bi túa xuống lưới chướng ngại vật.
   * **Tổng kết (15s):** Bắn pháo hoa ăn mừng, MC xướng tên quán quân ván chơi, chuẩn bị ván mới.

4. **MC Bình Luận Tự Động (Edge TTS):**
   * Giọng đọc truyền cảm tiếng Việt (`vi-VN-NamMinhNeural` / `vi-VN-HoaiMyNeural`), tự động bình luận tình huống kịch tính, cảm ơn người tặng quà.

5. **Tránh Lỗi CORS Avatar:**
   * Server tích hợp sẵn endpoint proxy in-memory cache `/api/avatar-proxy` giúp Canvas vẽ avatar TikTok tròn mượt mà 60 FPS mà không bị `tainted canvas`.

---

## 🚀 Hướng Dẫn Chạy Cục Bộ (Local)

### 1. Cài đặt và khởi chạy:
```bash
npm install
npm run dev
```

Server sẽ khởi chạy tại:
* 🎛️ **Bảng điều khiển (Dashboard):** [http://localhost:3006](http://localhost:3006)
* 📺 **Màn hình Live Stage (TikTok Studio / OBS):** [http://localhost:3006?stage=1](http://localhost:3006?stage=1)

---

## 🎥 Thiết Lập Trên TikTok LIVE Studio

1. Mở trình duyệt vào link [http://localhost:3006?stage=1](http://localhost:3006?stage=1).
2. Mở **TikTok LIVE Studio**:
   * Thêm nguồn **Capture Window (Cửa sổ ứng dụng)** -> Chọn cửa sổ trình duyệt đang mở `?stage=1`.
   * Thêm nguồn **Audio Output Capture** (để live thu được tiếng game và tiếng MC đọc).
3. Tại trang **Dashboard** [http://localhost:3006](http://localhost:3006):
   * Nhập username TikTok của bạn -> Bấm **Kết nối Live**.
   * Hệ thống sẽ tự động bắt comment và quà để thả bi!

---

## 🛠️ Deploy Docker / Dokploy

```bash
docker compose up -d --build
```
Port mặc định: `3006`.
