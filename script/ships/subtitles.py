"""科技树 02 · 造船 — every on-screen word (draft, under review).
Grid: 96 BPM, one 八拍 = 8 beats = 5 s. Each ship is exactly one shot of two 八拍 (10 s):
title moment on beats 1-4, one subtitle card from beat 5, transition on the last beat into the next downbeat.
'/' marks the line break. Width rule: CJK and full-width punctuation = 1, ASCII = 0.5, max 18 per line."""

BPM = 96
BAR8 = 8 * 60 / BPM          # one 八拍 = 5.0 s

HOOK = {
    'series': '科技树 02 · 造船',
    'question': '船和车轮，/哪一项发明得更早？',                         # 八拍 1, with the two options
    'options': ['A 船', 'B 车轮'],
    'reveal': '答案是船：人类约五万年前已能渡海，/车轮约五千五百年前才出现。',  # 八拍 2
    'title': '人类如何造船',                                               # 八拍 3, the music's first full tutti
    'subtitle': '从独木舟到核动力航母的科技树',
}

CHAPTERS = [
    dict(id='canoe', n=1, title='独木舟', era='约 8000 年前 · 浙江萧山跨湖桥',
         card='中国已知最早的独木舟由整根松木挖成；/内壁焦痕表明，先民曾用火辅助挖凿。'),
    dict(id='nile', n=2, title='古埃及帆船', era='约公元前 3200 年起 · 尼罗河',
         card='尼罗河向北流，风却多从北方吹来；/象形文字以扬帆的船表示“南行”。'),
    dict(id='trireme', n=3, title='希腊桨帆战船', era='公元前 5 世纪 · 雅典',
         card='桨手分三层排列，共约一百七十人；/高速冲刺时，以船首青铜撞角撞破敌船。'),
    dict(id='longship', n=4, title='维京长船', era='8—11 世纪 · 斯堪的纳维亚',
         card='吃水仅一米左右的长船，能横渡北海，/也能沿塞纳河上溯，直抵巴黎城下。'),
    dict(id='fuchuan', n=5, title='中国福船', era='宋代起 · 福建沿海',
         card='福船用隔舱板把船体分成多个水密舱；/一舱破损进水，船仍能浮于海面。'),
    dict(id='caravel', n=6, title='卡拉维尔帆船', era='15 世纪 · 葡萄牙',
         card='三角帆使它能够逆风斜行；/哥伦布首航的三艘船中，两艘是这种船。'),
    dict(id='lineship', n=7, title='风帆战列舰', era='17—19 世纪 · 欧洲',
         card='战舰首尾相接排成战列线，以舷炮齐射；/能列入战列线的军舰，称为“战列舰”。'),
    dict(id='steam', n=8, title='蒸汽船', era='1807 年起 · 美国 · 英国',
         card='不必再等顺风，蒸汽船按期横渡大西洋；/单程仅十余天，约为帆船用时的一半。'),
    dict(id='ironclad', n=9, title='铁甲舰', era='1859 年起 · 法国 · 英国 · 美国',
         card='1862 年，铁甲舰击毁两艘木质战舰；/次日两艘铁甲舰交火，装甲均未被击穿。'),
    dict(id='dreadnought', n=10, title='无畏舰', era='1906 年起 · 英国',
         card='“无畏”号的十门主炮均为 12 英寸；/旧式战列舰从此被称为“前无畏舰”。'),
    dict(id='carrier', n=11, title='航空母舰', era='1918 年起 · 英国 · 美国 · 日本',
         card='1942 年珊瑚海海战是首次航母交锋；/双方舰船从未目视对方，也未互相开炮。'),
    dict(id='nuclear', n=12, title='核动力航母', era='1961 年起 · 美国',
         card='尼米兹级航母满载排水量约十万吨，/可服役约五十年，只更换一次核燃料。'),
]

OUTRO = ['前七种船，历时近八千年；/后五种船，仅用一百五十余年。',          # 八拍 1
         '你乘坐过的最大的船，/是什么船？']                                # 八拍 2
END_CARD = ['人类如何造船', '科技树 02 · 造船', '本片画面与声音均由代码生成']   # 八拍 3

# number style: Gregorian years and exact values (12 英寸) in Arabic numerals; approximate figures with
# 约/余/逾/左右/近 and counts in Chinese numerals; era lines are labels and always use Arabic numerals.


def width(s):
    return sum(.5 if ord(c) < 0x2000 and c not in '“”' else 1 for c in s)


def all_cards():
    return [HOOK['question'], HOOK['reveal']] + [c['card'] for c in CHAPTERS] + OUTRO


def markdown():
    L = ['# 科技树 02 · 造船 — 字幕稿（待确认）', '',
         '规范：书面语、完整句；每个分镜两个八拍（10 秒），船名与年代约 2 秒，之后只有一张字幕卡（至多两行）；'
         '每行不超过 18 字（汉字与全角标点计 1，数字与字母计 0.5）；`/` 表示换行。', '',
         '数字写法：公历年份和精确数值（如 12 英寸）用阿拉伯数字；带“约、余、逾、左右、近”的概数和计数用汉字。', '',
         '## 开场（3 个八拍）',
         f'- 第 1 个八拍　问题：{HOOK["question"]}',
         f'- 选项：{"　".join(HOOK["options"])}',
         f'- 第 2 个八拍　揭晓：{HOOK["reveal"]}',
         f'- 第 3 个八拍　片名：{HOOK["title"]}　副标题：{HOOK["subtitle"]}　系列：{HOOK["series"]}', '']
    for c in CHAPTERS:
        L += [f'## {c["n"]:02d}　{c["title"]}', f'- 年代：{c["era"]}', f'- 字幕：{c["card"]}', '']
    L += ['## 结尾（2 个八拍）', f'- 第 1 个八拍：{OUTRO[0]}', f'- 第 2 个八拍：{OUTRO[1]}', '',
          '## 片尾（1 个八拍）', '- ' + '　/　'.join(END_CARD), '']
    return '\n'.join(L)


if __name__ == '__main__':
    bad = 0
    for card in all_cards():
        for p in card.split('/'):
            if width(p) > 18:
                print('TOO WIDE', width(p), p); bad += 1
    n8 = 3 + 2 * len(CHAPTERS) + 3
    print('cards', len(all_cards()), 'problems', bad, f'| {n8} 八拍 = {n8 * BAR8:.0f} s')
    import os
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', 'ships', '字幕稿.md'), 'w').write(markdown())
