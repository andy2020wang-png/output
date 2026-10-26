"""Single source of truth for every on-screen word. `python3 script/subtitles.py` checks line widths
and writes docs/06_字幕稿.md and script/subtitles.json (consumed by the scene files).
'/' inside a card marks the line break. Width rule: CJK and full-width punctuation = 1, ASCII = 0.5, max 18."""
import json, os, sys

HOOK = {
    'series': '科技树 01 · 记录',
    'question': '若要给一万年后的人留下“我在这里”，/应当把它写在哪里？',
    'options': ['A 压印在泥板上', 'B 写在纸上', 'C 存入硬盘', 'D 上传至云端'],
    'countdown': '3 · 2 · 1',
    'reveal': '人类的记录史揭示了一个反直觉的规律：/记录方式越先进，往往越难长久保存。',
    'option_life': ['已保存 5,000+ 年', '已保存 2,000+ 年', '预计 2～5 年', '？'],
    'title': '人类如何记录信息',
    'subtitle': '从结绳到云端的科技树',
}

CHAPTERS = [
    dict(id='knot', n=1, title='结绳', en='Knotted cords · Khipu',
         era='中国上古传说 · 安第斯地区 约公元 600 年起',
         cards=['《周易・系辞下》载：“上古结绳而治，/后世圣人易之以书契。”',
                '印加帝国以绳结按十进制记数，/绳结的位置分别表示个、十、百、千位。',
                '已知存世的安第斯结绳近一千四百件，/它们是否记录语言信息，至今仍无定论。',
                '绳索会腐烂，解读结绳的人也会逝去。/要让记录长久保存，载体必须更加坚固。'],
         meter=('已知最早的结绳实物 已保存', '1,000+', '年')),
    dict(id='clay', n=2, title='泥板', en='Cuneiform on clay',
         era='约公元前 3300 年 · 美索不达米亚 · 乌鲁克',
         cards=['最早的符号是用尖头芦苇刻画的图形，/后来改用斜削的芦苇压出楔形笔画。',
                '最早的泥板大多是行政账目，/记录粮食、牲畜等物资的收支。',
                '公元前 612 年，亚述都城尼尼微陷落。/据信大火反而烧硬了图书馆的部分泥板。',
                '这座亚述巴尼拔图书馆的泥板及残片，/如今有三万余件藏于大英博物馆。'],
         meter=('有字泥板 已保存', '5,000+', '年')),
    dict(id='papyrus', n=3, title='莎草纸', en='Papyrus · The Diary of Merer',
         era='约公元前 3000 年起 · 古埃及',
         cards=['埃及人把纸莎草的茎剖成薄条，/纵横叠压，捶打晒干，制成书写材料。',
                '莎草纸轻便，可制成长卷，/但不耐潮湿，存世者多出自干燥的埃及。',
                '《梅勒日志》是最早的有字莎草纸之一，/记录了为胡夫金字塔运送石灰石的经过。'],
         meter=('有字莎草纸 已保存', '4,500+', '年')),
    dict(id='oracle', n=4, title='龟甲', en='Oracle bones',
         era='约公元前 1250 年 · 商 · 殷墟',
         cards=['商代的占卜者灼烧龟甲与牛骨，/依据裂纹判断吉凶。',
                '刻在甲骨上的卜辞称为甲骨文，/是中国已知最早的成体系文字。',
                '“卜”字的字形，/描摹的正是龟甲上灼出的裂纹。',
                '迄今出土的刻辞甲骨超过十六万片，/单字约四千五百个，约三分之一已释读。'],
         meter=('刻辞甲骨 已保存', '3,200+', '年')),
    dict(id='bamboo', n=5, title='竹简', en='Bamboo slips',
         era='商代已有简册 · 现存实物始于战国早期',
         cards=['竹片削平、烘干后，以毛笔逐字书写，/再以编绳连缀成卷。',
                '“册”字的字形，/描摹的正是以编绳串联的一排竹简。',
                '西汉东方朔初到长安上书，/共用木质奏牍三千枚。',
                '两人合力方能举起，/汉武帝用了两个月才读完。'],
         notes={2: '见《史记・滑稽列传》褚少孙补记'},
         meter=('曾侯乙墓竹简 已保存', '2,400+', '年')),
    dict(id='paper', n=6, title='造纸', en='Paper',
         era='公元 105 年 · 东汉',
         cards=['《后汉书・蔡伦传》记载：/“缣贵而简重，并不便于人。”',
                '蔡伦以树皮、麻头、破布、渔网为原料，/改进造纸术，此后“天下咸称蔡侯纸”。',
                '出土的西汉古纸表明，蔡伦之前已有纸；/蔡伦的改进，使纸逐渐取代了简帛。',
                '造纸术逐步向西传播，/最迟于 12 世纪中叶传入欧洲。'],
         meter=('西汉古纸 已保存', '2,000+', '年')),
    dict(id='print', n=7, title='印刷术', en='Printing',
         era='868—1455 年 · 唐 · 北宋 · 美因茨',
         cards=['雕版印刷将整页文字反刻于木板，/经刷墨、覆纸、擦刷，即可印成一页。',
                '敦煌出土的《金刚经》印于 868 年，/是现存最早有明确纪年的印刷书籍。',
                '北宋庆历年间，毕昇以胶泥刻制活字，/排版印刷后拆下，活字可以重复使用。',
                '这项发明记载于沈括的《梦溪笔谈》，/但毕昇的泥活字没有实物传世。',
                '约 1455 年，古腾堡在美因茨/用金属活字印出了《圣经》。',
                '至 1500 年，欧洲印本迅速增加，/存世至今的仍有约三万种。'],
         meter=('《金刚经》已保存', '1,150+', '年')),
    dict(id='punch', n=8, title='打孔卡', en='Punched card',
         era='1890 年 · 美国人口普查',
         cards=['1804 年，雅卡尔提花机以串联的打孔卡/控制织物的花纹。',
                '1890 年，美国人口普查改用打孔卡，/由机器代替人工读取和统计。',
                '前一次普查的统计历时七年以上；/此次六个月完成计数，两年完成整理。',
                '制表机公司后来与其他公司合并，/新公司于 1924 年更名为 IBM。',
                '1921 年，华盛顿的一场火灾/让这次普查的原始表格大量受损。',
                '残存表格于 1930 年代经国会批准销毁，/普通人口调查表仅存六千余人的记录。'],
         meter=('普通人口调查表 仅存', '6,160+', '人的记录')),
    dict(id='tape', n=9, title='磁带', en='Magnetic tape',
         era='1951 年 · UNIVAC I',
         cards=['磁带以磁性涂层的磁化方向记录信息，/人眼无法直接读取，只能依靠机器。',
                '1951 年，UNIVAC I 计算机/配备了首款商用计算机磁带机。',
                '时至今日，部分大型云服务商/仍以磁带归档极少读取的冷数据。',
                '最新一代 LTO 磁带每盒可存储 40 TB，/厂商标称在适宜条件下可保存三十年。',
                '从这里开始，计数器显示的是预计寿命，/它们尚未经过时间的检验。'],
         meter=('数据寿命（厂商标称）', '30', '年')),
    dict(id='floppy', n=10, title='软盘', en='Floppy disk',
         era='1971 年起 · IBM 8 英寸软盘',
         cards=['大众熟悉的 3.5 英寸软盘，/容量只有 1.44 MB。',
                '它通常装不下今天手机拍摄的一张照片，/许多软件的“保存”图标却仍是软盘。',
                '如今，大多数计算机已不再配备软驱；/盘片即使完好，数据也难以读取。',
                '日本法规中最后一项软盘使用要求，/直至 2024 年 6 月才被废除。'],
         meter=('数据寿命（估计）', '5～15', '年')),
    dict(id='disk', n=11, title='硬盘', en='Hard disk drive',
         era='1956 年发明 · 1980 年缩小到 5.25 英寸',
         cards=['硬盘的问世，比软盘还早十五年：/1956 年，IBM 推出了第一台硬盘。',
                '它重约一吨，/却仅能存储约五百万个字符。',
                '首款 5.25 英寸硬盘的容量仅有 5 MB，/如今单块硬盘的容量已超过 40 TB。',
                '容量增长了数百万倍，/保存寿命却估计只有二至五年。'],
         meter=('数据寿命（估计）', '2～5', '年')),
    dict(id='cloud', n=12, title='云', en='The cloud',
         era='2006 年起 · 数据中心',
         cards=['2006 年，亚马逊推出 S3 云存储服务，/数据开始大规模存放于远程数据中心。',
                '云端的本质，仍是硬盘、闪存和磁带，/需要有人持续供电、维护并迁移数据。',
                '据报道，Myspace 在一次服务器迁移中/丢失了约五千万首用户上传的歌曲。',
                '皮尤研究中心发现：2013 年的网页，/十年后约有 38% 已无法访问。',
                '2015 年，互联网先驱温顿・瑟夫警告：/我们的时代可能成为“数字黑暗时代”。'],
         meter=('数据寿命', '？', '取决于是否有人持续维护')),
]

OUTRO = [
    '记录越来越快、越来越多，/却也越来越依赖机器与持续的维护。',
    '回到开头的问题：/最经得起时间检验的答案，是 A：泥板。',
    '而云端能保存多久，/取决于是否一直有人维护它。',
    '过去，记录往往比记录它的人活得更久；/如今，人可能比自己的记录活得更久。',
    '你手机中的照片，三十年后仍能打开吗？',
    '这段视频本身也是一份记录：/它的声音里写着“我在这里”四个字。',
]
END_CARD = ['人类如何记录信息', '科技树 01 · 记录', '下一集：人类如何计算', '本片画面与声音均由代码生成']


def width(s):
    return sum(.5 if ord(c) < 0x2000 and c not in '“”' else 1 for c in s)


def check():
    bad = []
    lines = [HOOK['question'], HOOK['reveal']] + [c for ch in CHAPTERS for c in ch['cards']] + OUTRO
    for card in lines:
        parts = card.split('/')
        if len(parts) > 2:
            bad.append((card, 'more than two lines'))
        for p in parts:
            if width(p) > 18:
                bad.append((p, width(p)))
    return bad


BPM = 96
BEAT = 60 / BPM
OPENER = 2.4          # chapter title moment before the first card
GAP = .25             # pause between cards


def card_dur(text):
    n = width(text.replace('/', ''))
    return max(3.0, min(4.5, 1.3 + .09 * n))


def timing(cards, lead=OPENER, tail=.6, quantum=2 * BEAT):
    """Card [start, end] times and a chapter duration snapped up to whole half-bars of the score."""
    t, segs = lead, []
    for c in cards:
        d = card_dur(c)
        segs.append([round(t, 3), round(t + d, 3)])
        t += d + GAP
    raw = segs[-1][1] + tail
    dur = quantum * -(-raw // quantum)
    # spread the rounding slack over the gaps so the last card does not hang
    slack = dur - raw
    k = len(segs)
    for i in range(k):
        shift = slack * (i / k) * .8
        segs[i] = [round(segs[i][0] + shift, 3), round(segs[i][1] + shift + slack * .8 / k * .5, 3)]
    return segs, round(dur, 3)


def export_engine(root):
    data = {'hook': HOOK, 'chapters': [], 'outro': {'cards': OUTRO, 'end': END_CARD}}
    for ch in CHAPTERS:
        segs, dur = timing(ch['cards'])
        d = dict(ch)
        d['cards'] = [c.replace('/', '\n') for c in ch['cards']]
        d['segs'], d['dur'] = segs, dur
        d['notes'] = {str(k): v for k, v in ch.get('notes', {}).items()}
        d['meter'] = {'label': ch['meter'][0], 'value': ch['meter'][1], 'unit': ch['meter'][2]}
        data['chapters'].append(d)
    data['hook']['question'] = HOOK['question'].replace('/', '\n')
    data['hook']['reveal'] = HOOK['reveal'].replace('/', '\n')
    data['outro']['cards'] = [c.replace('/', '\n') for c in OUTRO]
    os.makedirs(os.path.join(root, 'engine/data'), exist_ok=True)
    with open(os.path.join(root, 'engine/data/script.js'), 'w') as f:
        f.write('// Generated by script/subtitles.py — the approved on-screen text and timing. Do not edit by hand.\n')
        f.write('window.SCRIPT = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')
        f.write('window.CH = id => window.SCRIPT.chapters.find(c => c.id === id);\n')
    return data


def markdown():
    o = ['# 字幕稿（定稿）', '',
         '规范：书面语、完整句，不用口语和缩略句；每张字幕卡最多两行，每行不超过 18 字（汉字与全角标点计 1，数字与字母计 0.5）；`/` 表示换行。',
         '已按四个视角的审校意见修改：古代史实、近现代史实、中文编辑、抖音观众。', '',
         '## 开场', f"- 系列标签：{HOOK['series']}", f"- 问题：{HOOK['question'].replace('/', ' / ')}",
         f"- 选项：{'　'.join(HOOK['options'])}", f"- 倒数：{HOOK['countdown']}",
         f"- 揭晓：{HOOK['reveal'].replace('/', ' / ')}",
         '- 选项下方依次显示：' + '｜'.join(f"{o[0]} {l}" for o, l in zip(HOOK['options'], HOOK['option_life'])),
         f"- 片名：{HOOK['title']} / {HOOK['subtitle']}", '']
    cn = '一二三四五六七八九十'
    for ch in CHAPTERS:
        k = ch['n']
        num = cn[k - 1] if k <= 10 else '十' + cn[k - 11]
        o += [f"## 第{num}章 {ch['title']}", f"- 年代：{ch['era']}", f"- 标题：{ch['title']}　英文：{ch['en']}", '- 字幕：']
        for i, c in enumerate(ch['cards']):
            note = ch.get('notes', {}).get(i)
            o.append(f"  {i + 1}. {c.replace('/', ' / ')}" + (f"　〔屏幕小字：{note}〕" if note else ''))
        m = ch['meter']
        o += [f"- 计数器：{m[0]} {m[1]} {m[2]}", '']
    o += ['## 结尾'] + [f"{i + 1}. {c.replace('/', ' / ')}" for i, c in enumerate(OUTRO)]
    o += [f"{len(OUTRO) + 1}. 片尾卡：" + ' / '.join(END_CARD), '']
    return '\n'.join(o)


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    bad = check()
    for b in bad:
        print('TOO WIDE:', b)
    json.dump({'hook': HOOK, 'chapters': CHAPTERS, 'outro': OUTRO, 'end': END_CARD},
              open(os.path.join(root, 'script/subtitles.json'), 'w'), ensure_ascii=False, indent=1)
    md = os.path.join(root, 'docs/06_字幕稿.md')
    old = open(md).read()
    trans = old[old.index('## 篇章之间的转场'):] if '## 篇章之间的转场' in old else ''
    open(md, 'w').write(markdown() + '\n' + trans)
    data = export_engine(root)
    for c in data['chapters']:
        print(f"{c['id']:8s} dur={c['dur']:6.2f} cards={len(c['cards'])}")
    print('chapters total', round(sum(c['dur'] for c in data['chapters']), 1), 's')
    print('cards:', sum(len(c['cards']) for c in CHAPTERS) + len(OUTRO), 'problems:', len(bad))
    sys.exit(1 if bad else 0)
