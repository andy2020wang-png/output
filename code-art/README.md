# 程序与艺术 · Tweetable Mathematical Art

竖屏短视频，纯音效、无音乐。上半屏是一个细边框，框里的图自上而下一遍算出来；下半屏是红、绿、蓝三路：每路左边是该通道的小图，右边是算出它的函数，三个函数同时打出。
画面由 numpy + Pillow 逐帧计算，声音由 numpy + scipy 合成，没有使用任何图片、视频或音频素材。

| 文件 | 内容 |
|---|---|
| `out/程序与艺术_Tweetable_Mathematical_Art.mp4` | 成片（Git LFS）：1080×1920，60 fps，30.0 秒，H.264 CRF 15 + AAC 256k，−18 LUFS |
| `out/程序与艺术_Tweetable_Mathematical_Art_封面.png` | 封面（1080×1920）：片尾画面，即得票第一的作品与它的三个函数 |
| `out/程序与艺术_Tweetable_Mathematical_Art_音轨.wav` | 无损音轨（Git LFS，48 kHz / 16 bit 立体声） |
| `code-art/pieces/*.cpp` | 六幅作品的完整程序，也是视频里显示的代码的唯一来源 |
| `code-art/` 其余文件 | 时间轴、画面、音效与一键构建脚本 |

## 选题与作品

选题是 Code Golf Stack Exchange 上 2014 年 8 月的挑战
[Tweetable Mathematical Art](https://codegolf.stackexchange.com/questions/35569/tweetable-mathematical-art)（发起人 A Frayed Knot）：
写三个函数，分别给出 1024×1024 图像中像素 `(i,j)` 的红、绿、蓝分量，每个函数体不超过 140 个字符（一条推文的长度）。按得票数决胜负。

片中是 2026-11-15 时得票最高的六个回答，从第 6 名排到第 1 名，每幅约 4.8 秒：

| 名次 | 票数 | 作品 | 作者 | 许可 | 三个函数的字符数 |
|---|---|---|---|---|---|
| 6 | 110 | [Julia sets](https://codegolf.stackexchange.com/a/35674) | teh internets is made of catz | CC BY-SA 3.0 | 139 / 112 / 112 |
| 5 | 120 | [Mandelbrot 3 x 133 chars](https://codegolf.stackexchange.com/a/35739) | Manuel Kasten | CC BY-SA 4.0 | 132 / 132 / 132 |
| 4 | 122 | [Mandelbrot](https://codegolf.stackexchange.com/a/35601) | Martin Ender | CC BY-SA 3.0 | 134 / 134 / 123 |
| 3 | 162 | [Some swirly pointy things](https://codegolf.stackexchange.com/a/35689) | cjfaure | CC BY-SA 3.0 | 99 / 98 / 99 |
| 2 | 190 | [Random painter](https://codegolf.stackexchange.com/a/35626) | Martin Ender | CC BY-SA 3.0 | 131 / 110 / 109 |
| 1 | 207 | [Table cloths](https://codegolf.stackexchange.com/a/35641) | trichoplax | CC BY-SA 4.0 | 121 / 129 / 131 |

- 三个函数体与原帖逐字一致，没有改动。字符数不含换行与缩进，只计入 `#define` 所必需的那个换行。
- 函数体以外的部分（`pieces/tweet.h` 和每个文件里的声明、`TWEET_MAIN`）是本仓库写的外壳，行为与挑战给出的 C++ 模板相同：同样的宏、同样的逐行顺序、每个像素依次调用红绿蓝三个函数、同样的取值掩码。
- 这些作品按 CC BY-SA 授权。发布本片时需要署名作者、给出出处，并以相同的许可方式分享。片中分隔栏写有每幅作品的名字与作者；出处与许可协议不放在画面里，写在文末的发布文案中，发布时请一并贴出。

### 还原核对

每幅图都与作者在回答里贴出的原图比较过：

| 作品 | 与作者原图的比较 |
|---|---|
| Julia sets、Mandelbrot 3 x 133 chars | 全部像素完全一致 |
| Table cloths | 99.99% 的像素完全一致 |
| Some swirly pointy things | 99.97% 的像素完全一致 |
| Mandelbrot（Martin Ender） | 99.7% 的像素完全一致 |
| Random painter | 画面由 `rand()` 决定，与作者原图风格相同、内容不同 |

不一致的少数像素都在色块或条纹的边界上，来自不同编译器与处理器的浮点舍入。

还原时有两处需要说明：

- **`abs`**：Some swirly pointy things 里有 `abs(sin(...))`。现在的 g++ 在只包含 `<cmath>` 时会把它解析成整数版的 `abs`，结果恒为 0，图完全不同。`tweet.h` 里加了一行 `using std::abs;`，让它取浮点版，这样才与作者的原图一致。
- **10 位输出的读法**：挑战的 10 位模板把每个分量按主机字节序写成两个字节，而 PPM 规定高字节在前。Some swirly pointy things 的函数只返回 0 到 6，按 PPM 的读法 1、2、3 变成 256、512、768（满值 1023），这幅图的色块就是这样来的；Julia sets 则要按函数返回的数值本身读取。每个作品文件头的 `@read` 记录了它的读法（`u8`、`le16`、`be16`）。

## 画面

1080×1920，60 fps。图像以 1024×1024 原始分辨率逐像素显示，外面是一圈细边框。
版式按 TikTok / 抖音的界面遮挡留出安全区：顶部 150 px、底部 320 px、右侧 140 px（从画面中部往下）之内不放代码。

- 没有标题画面。第一帧就是完成的图（得票第一的作品），0.4 秒后自下而上擦除，然后从第 6 名开始。片尾停在同一幅图上，首尾相接可以循环。
- 每幅作品：三个函数同时打出，图像自上而下一遍算完（3 秒），打字与扫描同时开始、同时结束。扫描线上的标签显示正在计算的行，如 `j = 512`。算完后边框亮一下，停留 1.5 秒，然后擦除，进入下一幅。
- 分隔栏：左边三个圆点（红、绿、蓝，计算时闪动，完成后点亮），接着是这幅画的名字，右侧是作者。
- 下半屏三路：每路左边是该通道单独贡献的小图（按通道着色，与上方大图同步扫出），右边是对应的函数体，三个光标同时前进。上方的大图就是三路叠加的结果。函数体按宽度折行，折行处尽量落在语句或运算符上；不显示函数签名。
- 扫描顺序与程序写像素的顺序一致（`j` 从 0 到 1023）。刚算出的行会短暂过曝再回落，扫描线的亮度跟随该行的像素值。

## 声音

只有音效，没有旋律与节拍，全部由 `sfx.py` 合成：

- 敲键：低沉的键盘声，每次按键一声，音高、力度与左右位置略有随机。
- 扫描：像往杯子里注水。大量小气泡的声音（气泡半径决定音高），随扫描向下气泡变小、音高升高；下面垫一层很轻的气流声；图像中很亮的行会带出细碎的高频闪光声，所以声音跟着画面的内容变化。红、绿、蓝三个通道各占一个音区，同时注入。
- 完成：一幅图算完时有一声轻的"啵"、一下低音和一阵渐弱的闪光声；全片最后一幅完成时另有一声很轻的玻璃声。
- 擦除：一声下行的气流声。

母带：先滤除 55 Hz 以下，再用前瞻限幅器把峰值压在 −1.7 dBFS 以下，整体响度 −18 LUFS（按 ITU-R BS.1770 计量）。
画面和声音都读取同一份时间轴（`timeline.py`），所以每一次按键、每一次扫描的起止都与画面对齐。

## 重新出片

```bash
bash code-art/build.sh
```

约 3 分钟（4 核 CPU）。需要 g++、Python 3（numpy、scipy、Pillow）、ffmpeg，以及 JetBrains Mono 字体（Debian / Ubuntu：`fonts-jetbrains-mono`；找不到时退回 DejaVu Sans Mono）。标题用仓库 `fonts/` 目录中的 Noto Sans SC。

| 文件 | 作用 |
|---|---|
| `pieces/N_名称.cpp` | 一幅作品。文件头的 `@rank`、`@votes`、`@title`、`@author`、`@url`、`@license`、`@read` 决定片中的顺序、署名与图像读法 |
| `pieces/tweet.h` | 各作品共用的外壳（宏与 `main`） |
| `piece.py` | 解析三个函数、统计字符数（超过 140 即报错）、编译运行得到图像 |
| `timeline.py` | 时间轴：每幅作品的打字节奏、一遍扫描、停留与擦除；节奏参数在文件开头 |
| `render.py` | 逐帧画面，经管道送入 ffmpeg；`--stills 0,4.5 --out 目录` 可只出静帧 |
| `sfx.py` | 音效合成与母带 |
| `build.sh` | 以上各步加合成 |

增减作品：在 `pieces/` 下增删文件即可，片中按 `@rank` 从大到小播放，最后一幅同时是开场画面。

## 发布文案

- 标题：程序与艺术｜三个函数，每个不超过 140 个字符，能算出什么
- 正文：Tweetable Mathematical Art 挑战里得票最高的六幅，从第 6 名到第 1 名。红、绿、蓝各一个函数，三路一起算出一幅图。
- 话题：#程序与艺术 #数学之美 #分形 #编程 #创意编程 #解压
- 出处与协议（画面里只有作品名与作者，这一段请随视频一并发布）：

  ```
  作品出自 Code Golf Stack Exchange 的 Tweetable Mathematical Art 挑战
  （codegolf.stackexchange.com/q/35569），按 CC BY-SA 协议使用，本视频以相同协议分享。
  1. Julia sets — teh internets is made of catz — codegolf.stackexchange.com/a/35674 — CC BY-SA 3.0
  2. Mandelbrot 3 x 133 chars — Manuel Kasten — codegolf.stackexchange.com/a/35739 — CC BY-SA 4.0
  3. Mandelbrot — Martin Ender — codegolf.stackexchange.com/a/35601 — CC BY-SA 3.0
  4. Some swirly pointy things — cjfaure — codegolf.stackexchange.com/a/35689 — CC BY-SA 3.0
  5. Random painter — Martin Ender — codegolf.stackexchange.com/a/35626 — CC BY-SA 3.0
  6. Table cloths — trichoplax — codegolf.stackexchange.com/a/35641 — CC BY-SA 4.0
  ```

- 英文版：The six top-voted entries of "Tweetable Mathematical Art": three functions, 140 characters each, one picture. Art by teh internets is made of catz, Manuel Kasten, Martin Ender, cjfaure and trichoplax (codegolf.stackexchange.com/q/35569, CC BY-SA). #codeart #mathart #fractal #creativecoding #generativeart #satisfying
