# 程序的艺术（上、下）

两条竖屏短视频，纯音效、无音乐。选题是 Tweetable Mathematical Art：三个函数，每个不超过 140 个字符，算出一幅 1024×1024 的图。
上半屏是一个细边框，图在框里自上而下一遍算出来；下半屏是红、绿、蓝三路，每路左边是该通道的小图，右边是算出它的函数，三个函数同时打出。
画面由 numpy + Pillow 逐帧计算，声音由 numpy + scipy 合成，没有使用任何图片、视频或音频素材。

| 文件 | 内容 |
|---|---|
| `out/程序的艺术_上.mp4`、`out/程序的艺术_下.mp4` | 成片（Git LFS）：1080×1920，60 fps，各 30.0 秒，H.264 CRF 15 + AAC 256k，−18 LUFS |
| `out/程序的艺术_上_封面.png`、`out/程序的艺术_下_封面.png` | 封面（1080×1920）：展墙上的画框，框里上用 2a、下用 2b，上方是"程序的艺术"和金色的"上"或"下"；另有 `_3x4` 版（1080×1440） |
| `out/程序的艺术_上_音轨.wav`、`out/程序的艺术_下_音轨.wav` | 无损音轨（Git LFS，48 kHz / 16 bit 立体声） |
| `code-art/films.txt` | 片单：每条视频用哪几幅、按什么顺序、封面用哪一幅 |
| `code-art/pieces/*.cpp` | 每幅作品的完整程序，也是视频里显示的代码的唯一来源 |
| `code-art/cache/` | Buddhabrot 的计算结果（算一次要几个小时，所以存下来） |
| `code-art/` 其余文件 | 时间轴、画面、音效与一键构建脚本 |

## 选题与片单

选题是 Code Golf Stack Exchange 上 2014 年 8 月的挑战
[Tweetable Mathematical Art](https://codegolf.stackexchange.com/questions/35569/tweetable-mathematical-art)（发起人 A Frayed Knot）：
写三个函数，分别给出 1024×1024 图像中像素 `(i,j)` 的红、绿、蓝分量，每个函数体不超过 140 个字符（一条推文的长度）。按得票数决胜负。

编号是该回答在 2026-11-16 的得票名次，字母表示同一回答里的第几幅图。

**上**（封面 2a）

| 编号 | 作品 | 作者 | 票数 | 许可 | 三个函数的字符数 |
|---|---|---|---|---|---|
| 1a | [Table cloths](https://codegolf.stackexchange.com/a/35641) | trichoplax | 207 | CC BY-SA 4.0 | 121 / 129 / 131 |
| 2a | [Random painter](https://codegolf.stackexchange.com/a/35626) | Martin Ender | 190 | CC BY-SA 3.0 | 131 / 110 / 109 |
| 9a | [Buddhabrot](https://codegolf.stackexchange.com/a/35897) | Martin Ender | 81 | CC BY-SA 3.0 | 135 / 138 / 139 |
| 12 | [Random Voronoi diagram](https://codegolf.stackexchange.com/a/35784) | teh internets is made of catz | 60 | CC BY-SA 3.0 | 126 / 131 / 131 |
| 4a | [Mandelbrot](https://codegolf.stackexchange.com/a/35601) | Martin Ender | 122 | CC BY-SA 3.0 | 134 / 134 / 123 |
| 17 | [Spiral (140 exactly)](https://codegolf.stackexchange.com/a/35954) | Steven Moreland | 50 | CC BY-SA 3.0 | 23 / 19 / 96 |

**下**（封面 2b）

| 编号 | 作品 | 作者 | 票数 | 许可 | 三个函数的字符数 |
|---|---|---|---|---|---|
| 2b | [Random painter](https://codegolf.stackexchange.com/a/35626)（各向同性的变体） | Martin Ender | 190 | CC BY-SA 3.0 | 140 / 119 / 118 |
| 3a | [Some swirly pointy things](https://codegolf.stackexchange.com/a/35689) | cjfaure | 162 | CC BY-SA 3.0 | 99 / 98 / 99 |
| 5a | [Mandelbrot 3 x 133 chars](https://codegolf.stackexchange.com/a/35739) | Manuel Kasten | 120 | CC BY-SA 4.0 | 132 / 132 / 132 |
| 8 | [Untitled](https://codegolf.stackexchange.com/a/35596)（原帖没有标题） | faubi | 103 | CC BY-SA 3.0 | 122 / 100 / 122 |
| 19b | [Action Painting](https://codegolf.stackexchange.com/a/36187)（第三幅图的配色） | trichoplax | 44 | CC BY-SA 4.0 | 138 / 139 / 140 |
| 14 | [Because unicorns](https://codegolf.stackexchange.com/a/35600) | Martin Ender | 54 | CC BY-SA 3.0 | 50 / 63 / 63 |

`pieces/` 里还有一幅没有编入视频的 6a（Julia sets，teh internets is made of catz）。

- 函数体与原帖逐字一致。字符数不含换行与缩进，只计入 `#define` 所必需的换行。有两幅是原帖里的变体，改动由作者在帖中给出：
  2b 用帖中"各向同性"的那一行替换原函数体（帖中写出了红色函数，绿、蓝两个函数照样改函数名）；
  19b 把 `E(21)` 换成第三幅图图注里的两个数（红 63、绿 49）。
- 函数体以外的部分（`pieces/tweet.h` 和每个文件里的声明、`TWEET_MAIN`）是本仓库写的外壳，行为与挑战给出的 C++ 模板相同：同样的宏、同样的逐行顺序、每个像素依次调用红绿蓝三个函数、同样的取值掩码。
- 片中的作品名不带"·"和句点：14 号原帖标题是"Because unicorns."，片中去掉了句点；8 号原帖没有标题，片中写作"Untitled"；12 号原帖标题是"Random Voronoi diagram generator anyone?"，片中取"Random Voronoi diagram"。
- 这些作品按 CC BY-SA 授权。发布时需要署名作者、给出出处，并以相同的许可方式分享。片中分隔栏写有每幅作品的名字与作者；出处与许可协议不放在画面里，写在文末的发布文案中，发布时请一并贴出。

### 还原核对

每幅图都与作者在回答里贴出的原图比较过：

| 作品 | 与作者原图的比较 |
|---|---|
| 5a Mandelbrot 3 x 133 chars、8 Untitled | 全部像素完全一致 |
| 1a Table cloths、14 Because unicorns | 99.99% 的像素完全一致 |
| 3a Some swirly pointy things | 99.97% 的像素完全一致 |
| 4a Mandelbrot | 99.7% 的像素完全一致 |
| 17 Spiral (140 exactly) | 作者贴出的是 JPEG；把本仓库的图按质量 75、4:2:0 存成 JPEG 后，与它完全一致 |
| 9a Buddhabrot | 结构一致、逐像素不同：与作者贴出的 512×512 局部原图（16 位 PNG）8×8 分块的相关系数 0.96，与全图（JPEG）0.98，平均亮度相同（185 与 184，满值 1023）。逐像素不同的原因见下文 |
| 2a、2b Random painter，19b Action Painting | 用了 `rand()`：与作者原图风格相同、内容不同（结果取决于 C 库） |
| 12 Random Voronoi diagram | 用了 `rand()` 和时钟：与作者原图风格相同、内容不同 |

不一致的少数像素都在色块或条纹的边界上，来自不同编译器与处理器的浮点舍入。

### 还原时的处理

这些是 2014 年的"代码高尔夫"，不少地方依赖当时编译器和看图软件的具体行为。函数体一个字符都没有改，下面这些处理都在外壳和构建方式里：

- **`abs`**（3a）：`abs(sin(...))` 在现在的 g++ 下只包含 `<cmath>` 时会被解析成整数版，结果恒为 0。`tweet.h` 里加了 `using std::abs;`。
- **10 位输出的读法**：挑战的 10 位模板把每个分量按主机字节序写成两个字节，而 PPM 规定高字节在前，不同作者用的看图软件处理方式不同。每个作品文件头的 `@read` 记录了与作者原图一致的读法：
  `u8`（8 位模板，字节即图像）；`le16`（按函数返回的数值，除以 1023；6a、9a、12）；`be16`（按 PPM 规定高字节在前，除以 1023，超出部分截到白；3a）；
  `im16`（同样高字节在前，但像 ImageMagick 那样乘 65535/1023 后只保留 16 位，取高字节，超出部分回绕；8）。
- **没有 `return` 的分支**（9a）：`GR` 和 `BL` 各有一条分支不写返回值。现在的编译器可能把这种分支当作"不会执行"而删掉里面的代码，所以这幅用 `clang++ -fno-strict-return` 编译（文件头的 `@cxx`）。
- **写到表格外面**（9a）：轨道的 y 接近 2 时，`GR` 会把计数写进表格之外的第 1024 行。按这里的编译结果，那 4 KB 有一部分落在未映射的内存上，实测从某些起点（例如 m=4040、n=4095）开始算，程序会崩溃。`tweet.h` 的 `TWEET_GUARD` 在程序开始时把紧跟静态数据的两页内存映射好；`piece.py` 用 `nm` 确认这张表确实排在静态数据的最后。
- **时钟**（12）：红色函数在每个像素都调用 `srand(time(0))`。只要整幅图在同一秒内算完，每个像素得到的是同一组 64 个点；一旦跨秒，红色通道从那一行起就换了一幅图。`tweet.h` 的 `TWEET_CLOCK` 让 `time()` 在整个运行期间返回同一个值，取的是原帖发布的时刻（2014-08-05 19:12:04 UTC）。

### Buddhabrot 的计算

9a 把全部计算放在第一次调用 `RD` 里：4095×4095 个起点，每个最多迭代 50 万次（作者说他当时跑了 6 到 7 小时）。在这里的机器上单线程估计要 4.7 小时。

`tools/9a_split.py` 用同样的三个函数、对同样的起点做同样的 `BL` 调用，只是把起点分给几个进程，最后把各自的计数表相加，写出原程序会输出的字节（每次计数都是整数加减，先后顺序不影响结果）。结果存进 `cache/`，`piece.py` 发现有存好的结果就直接用。
这个办法先在缩小的问题上验证过（1023×1023 个起点、1000 次迭代，按作者在帖中给的改法）：三个进程合并的结果与原程序单进程的输出逐字节相同。

完整规模用 3 个进程算了 1 小时 27 分钟，结果存在 `cache/9a_buddhabrot_6901e484c1.ppm.xz`。计数表里有一个负数（−2152），在图像最上一行的第 513 列。程序对没有逃逸的轨道先加一遍、再减一遍；最靠近 −2 的那个实轴起点，轨道会多次经过 x 接近 2 的地方，这时 `GR` 把第一遍的加法当成了读取，第二遍的减法却照做，而且写到了所在行之外、下一行的第一格。按原程序的做法把它换成 16 位整数再取低 10 位，显示为一个亮点。

与作者原图逐像素不同：每个起点最多迭代 50 万次，轨道是混沌的，浮点运算里极小的差别（例如 2014 年常见的 x87 80 位中间精度与现在的 SSE）在几十次迭代后就会把轨道带到别处。长轨道在图上留下的细节（亮的"气泡"和细线）因此出现在不同位置，而由大量轨道统计出来的整体形状、亮度分布都一致。

## 画面

1080×1920，60 fps。图像以 1024×1024 原始分辨率逐像素显示，外面是一圈细边框。
代码不进入右侧 140 px（TikTok / 抖音的按钮列）。下半屏的三路铺到接近底边：在 TikTok / 抖音里，最下面一路（蓝色通道）会被左下角的账号名和文案盖住一部分。

- 没有标题画面。第一帧是该条视频最后一幅作品的成图，0.4 秒后自下而上擦除，然后从第一幅开始。片尾停在同一幅图上，首尾相接可以循环。
- 每幅作品：三个函数同时打出，图像自上而下一遍算完（3 秒），打字与扫描同时开始、同时结束。扫描线上的标签显示正在计算的行，如 `j = 512`。算完后边框亮一下，停留 1.5 秒，然后擦除，进入下一幅。
- 分隔栏：左边三个圆点（红、绿、蓝，计算时闪动，完成后点亮），接着是这幅画的名字，右侧是作者。名字和作者放不下时两者一起缩小。
- 下半屏三路：每路左边是该通道单独贡献的小图（204×204，按通道着色，与上方大图同步扫出），右边是对应的函数体，三个光标同时前进。上方的大图就是三路叠加的结果。函数体按宽度折行，折行处尽量落在语句或运算符上；`#define` 另起一行；不显示函数签名。代码字号取能让三路放得下的最大值（29；行数多的作品会小一些：9a 为 27，19b 为 25）。
- 扫描顺序与程序写像素的顺序一致（`j` 从 0 到 1023）。刚算出的行会短暂过曝再回落，扫描线的亮度跟随该行的像素值。

## 封面

`cover.py` 单独画封面，不是从视频里截帧：深色展墙，上方一盏暖色射灯；墙上挂一个黑漆画框，内侧一道金边，里面是白色卡纸和斜切的卡纸开口；框里是片单指定的那一幅作品（744×744）。画框按光照着色（光从上方偏左来），下方和右侧在墙上投出阴影。
上方是"程序的艺术"（思源宋体 Heavy，米白色，加宽字距），后面是金色的"上"或"下"，与画框内侧的金边同色；字取自片名 `films.txt`。
标题和画框都放在中间 1080×1440 的范围里，这是抖音和 TikTok 主页网格显示的 3:4 区域，所以另存了一张 `_3x4` 版，可直接作为 3:4 封面上传。

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
bash code-art/build.sh        # 片单里的每一条
bash code-art/build.sh 下     # 只出一条（上、下，或 1、2）
```

每条约 3 分钟（4 核 CPU）。需要 g++、clang++、Python 3（numpy、scipy、Pillow）、ffmpeg，以及 JetBrains Mono 字体（Debian / Ubuntu：`fonts-jetbrains-mono`；找不到时退回 DejaVu Sans Mono）。分隔栏的文字用仓库 `fonts/` 目录中的 Noto Sans SC。

| 文件 | 作用 |
|---|---|
| `films.txt` | 片单：`片名 \| 作品编号（播放顺序） \| 封面用哪一幅` |
| `pieces/编号_名称.cpp` | 一幅作品。文件头的 `@rank`、`@votes`、`@title`、`@author`、`@url`、`@license` 是署名信息；`@read` 是图像读法；`@cxx` 是需要指定时的编译命令；`@slow` 表示要算几个小时、结果存进 `cache/` |
| `pieces/tweet.h` | 各作品共用的外壳（宏与 `main`） |
| `piece.py` | 解析三个函数、统计字符数（超过 140 即报错）、编译运行得到图像；读片单 |
| `timeline.py` | 时间轴：每幅作品的打字节奏、一遍扫描、停留与擦除；节奏参数在文件开头 |
| `render.py` | 逐帧画面，经管道送入 ffmpeg；`--stills 0,4.5 --out 目录` 可只出静帧 |
| `sfx.py` | 音效合成与母带 |
| `cover.py` | 封面 |
| `tools/9a_split.cpp`、`tools/9a_split.py` | 用多个进程算 Buddhabrot |
| `build.sh` | 以上各步加合成 |

换片单：改 `films.txt` 即可。加作品：在 `pieces/` 下新建文件，编号写在文件名最前面。

## 发布文案

标题里不用"·"和句点。署名一段请保留（CC BY-SA 要求署名、给出出处并以相同协议分享）；如果平台提示描述太长，把署名一段移到置顶评论。

### 程序的艺术 上

标题：

```
程序的艺术 上｜140个字符的代码能画出什么
```

正文：

```
红、绿、蓝各一个函数，每个不超过140个字符，正好一条推文那么长。代码一边打出来，画一边一行一行算出来。
六幅都来自2014年的编程挑战 Tweetable Mathematical Art。第3幅 Buddhabrot，原作者当年算了6到7个小时。
你最喜欢第几幅？
#程序的艺术 #编程 #数学之美 #分形 #创意编程 #解压
```

署名：

```
作品与作者
1 Table cloths／trichoplax
2 Random painter／Martin Ender
3 Buddhabrot／Martin Ender
4 Random Voronoi diagram／teh internets is made of catz
5 Mandelbrot／Martin Ender
6 Spiral (140 exactly)／Steven Moreland
出处 codegolf.stackexchange.com/q/35569
原作按 CC BY-SA 3.0 或 4.0 授权，画面由原作代码编译运行生成，本视频以相同协议分享
```

### 程序的艺术 下

标题：

```
程序的艺术 下｜140个字符的代码能画出什么
```

正文：

```
红、绿、蓝各一个函数，每个不超过140个字符，正好一条推文那么长。代码一边打出来，画一边一行一行算出来。
六幅都来自2014年的编程挑战 Tweetable Mathematical Art。第5幅在模仿波洛克的滴画。
你最喜欢第几幅？
#程序的艺术 #编程 #数学之美 #分形 #创意编程 #解压
```

署名：

```
作品与作者
1 Random painter／Martin Ender
2 Some swirly pointy things／cjfaure
3 Mandelbrot 3 x 133 chars／Manuel Kasten
4 Untitled／faubi
5 Action Painting／trichoplax
6 Because unicorns／Martin Ender
出处 codegolf.stackexchange.com/q/35569
原作按 CC BY-SA 3.0 或 4.0 授权，画面由原作代码编译运行生成（第1、5幅用的是作者在原帖中给出的变体），本视频以相同协议分享
```

### TikTok 英文版

TikTok 的描述上限一般按 2,200 字符算，放得下逐幅的链接。

```
The Art of Code, Part 1. Three functions, one each for red, green and blue, no more than 140 characters each, compute every pixel. All six come from the 2014 Tweetable Mathematical Art challenge. The Buddhabrot (#3) took its author 6 to 7 hours to render.
Art: Table cloths by trichoplax codegolf.stackexchange.com/a/35641 (CC BY-SA 4.0); Random painter by Martin Ender codegolf.stackexchange.com/a/35626; Buddhabrot by Martin Ender codegolf.stackexchange.com/a/35897; Random Voronoi diagram by teh internets is made of catz codegolf.stackexchange.com/a/35784; Mandelbrot by Martin Ender codegolf.stackexchange.com/a/35601; Spiral (140 exactly) by Steven Moreland codegolf.stackexchange.com/a/35954 (CC BY-SA 3.0 unless noted). Rendered from the original code; shared under the same licence.
#creativecoding #mathart #fractal #generativeart #programming #satisfying
```

```
The Art of Code, Part 2. Three functions, one each for red, green and blue, no more than 140 characters each, compute every pixel. All six come from the 2014 Tweetable Mathematical Art challenge. #5 is a nod to Jackson Pollock's drip paintings.
Art: Random painter by Martin Ender codegolf.stackexchange.com/a/35626; Some swirly pointy things by cjfaure codegolf.stackexchange.com/a/35689; Mandelbrot 3 x 133 chars by Manuel Kasten codegolf.stackexchange.com/a/35739 (CC BY-SA 4.0); Untitled by faubi codegolf.stackexchange.com/a/35596; Action Painting by trichoplax codegolf.stackexchange.com/a/36187 (CC BY-SA 4.0); Because unicorns by Martin Ender codegolf.stackexchange.com/a/35600 (CC BY-SA 3.0 unless noted). Rendered from the original code (#1 and #5 are variants their authors gave); shared under the same licence.
#creativecoding #mathart #fractal #generativeart #programming #satisfying
```
