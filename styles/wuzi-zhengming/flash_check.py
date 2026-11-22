"""闪烁检测（光敏性癫痫安全）：python3 flash_check.py <成片.mp4>
把画面缩到 64 × 114、分成 4 × 4 块，逐帧算每块的线性亮度（0–1）。
一次"明暗跳变" = 某一块在 3 帧（0.1 s）内亮度变化 ≥ 0.1，且较暗的一端 < 0.8（WCAG 2.3.1 的一般闪光判据）；
"闪光" = 1 s 内一亮一暗成对的跳变。WCAG 上限：任意 1 s 内不超过 3 次闪光。这一风格要求 0 次。"""
import subprocess, sys
import numpy as np

src = sys.argv[1]; W, H, FPS = 64, 114, 30
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={W}:{H},format=gray', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float64) / 255
lin = np.where(fr <= .04045, fr / 12.92, ((fr + .055) / 1.055) ** 2.4)                     # sRGB → 线性亮度
bh, bw = H // 4, W // 4
blk = lin[:, :bh * 4, :bw * 4].reshape(len(lin), 4, bh, 4, bw).mean(axis=(2, 4)).reshape(len(lin), 16)
jumps = []                                                                                   # (帧号, 块号, 方向)
for b in range(16):
    L = blk[:, b]; last = -99
    for i in range(3, len(L)):
        d = L[i] - L[i - 3]
        if abs(d) >= .1 and min(L[i], L[i - 3]) < .8 and i - last > 3: jumps.append((i, b, np.sign(d))); last = i
flashes = []
for b in range(16):
    js = [j for j in jumps if j[1] == b]
    for (i1, _, s1), (i2, _, s2) in zip(js, js[1:]):
        if s1 != s2 and i2 - i1 <= FPS: flashes.append(i2)
per_sec = max([sum(1 for f in flashes if t <= f < t + FPS) for t in range(0, len(lin), 5)] or [0])
print(f'帧数 {len(lin)}，平均亮度 {lin.mean():.4f}')
print(f'大面积明暗跳变 {len(jumps)} 次：', [round(i / FPS, 2) for i, _, _ in jumps][:20])
print(f'1 s 内一亮一暗成对（= 闪光）{len(flashes)} 次')
print('任意 1 s 内最多闪光次数：', per_sec, '（WCAG 上限 3）')
sys.exit(1 if per_sec > 3 else 0)
