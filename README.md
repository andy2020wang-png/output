# 人类如何记录信息 · 100% 代码生成的知识视频

为抖音 #Vibe知识大赏 制作。科技树系列第 1 集：结绳 → 泥板 → 莎草纸 → 龟甲 → 竹简 → 造纸 → 印刷术 → 打孔卡 → 磁带 → 软盘 → 硬盘 → 云。
画面由浏览器中的 Canvas 与 WebGL 着色器逐帧计算，声音由 numpy 合成，没有使用任何图片、视频或音频素材。

| 文件 | 内容 |
|---|---|
| `out/人类如何记录信息_成片.mp4` | 成片原片（Git LFS，388 MB，1920×1080，30 fps，5 分 12 秒，H.264 CRF 16 + AAC 256k，−14 LUFS，未经二次压缩） |
| `out/audio/mix.wav` | 无损母带音轨（Git LFS，48 kHz / 16 bit 立体声） |
| `out/封面_横版A_16x9.png`、`out/封面_横版B_16x9.png` | 两份横版封面（1920×1080） |
| `out/封面_竖版_3x4.png` | 竖版封面（1080×1440） |
| `out/频谱彩蛋_证据.png` | 成片音轨的频谱截图，结尾 5:00 前后写着“我在这里” |
| `docs/01_参考视频逆向分析.md` | 参考片《光先到》的结构、风格卡、切换方式、声音与复刻方法（参考片截图不随公开仓库分发） |
| `docs/02_活动与爆款研究.md` | 活动性质、代表账号、爆款规律与同质化问题 |
| `docs/03_本片方案_风格卡与脚本.md` | 初版方案（24 阶段版，已被十二章版取代，保留作记录） |
| `docs/04_harness实现方法.md` | 用 Claude Code 实现的完整流程与引擎结构 |
| `docs/05_事实核查.md`、`docs/07_事实核查_十二章.md` | 史实与数据的逐条核查记录 |
| `docs/06_字幕稿.md` | 定稿字幕与篇章转场表 |
| `docs/08_制作分镜_briefs.md` | 每个场景的制作说明 |
| `docs/09_发布文案.md` | 标题、正文、话题、置顶评论、发布设置 |
| `engine/`、`render/`、`audio/`、`script/` | 全部源代码 |

## 下载成片

- 网页：打开 `out/人类如何记录信息_成片.mp4`，点击 “Download raw file”。
- 命令行：`git lfs install && git clone https://github.com/andy2020wang-png/output`（或在已有克隆中运行 `git lfs pull`）。
- 校验：`sha256sum out/人类如何记录信息_成片.mp4` 应为 `40c5f14dcef49fc5a14c848125ac678335fc16028cfc17b5bb6c57be3312657f`。

## 重新出片

`bash build.sh`（约 1 小时，4 核 CPU，无需显卡；需要 Node.js + Playwright Chromium、Python 3 + numpy / scipy / Pillow、ffmpeg）。字体已随仓库提供，见 `fonts/README.md`。
