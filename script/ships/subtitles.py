"""科技树 02 · 造船 — every on-screen word (draft, under review).
Grid: 96 BPM, one 八拍 = 8 beats = 5 s. Each ship is exactly one shot of two 八拍 (10 s):
title moment on beats 1-4, one subtitle card from beat 5, transition on the last beat into the next downbeat.
'/' marks the line break. Width rule: CJK and full-width punctuation = 1, ASCII = 0.5, max 18 per line."""

BPM = 96
BAR8 = 8 * 60 / BPM          # one 八拍 = 5.0 s

HOOK = {
    'series': '科技树 02 · 造船',
    'question': '船和车轮，/哪一项发明得更早？',                       # 八拍 1
    'options': ['A 船', 'B 车轮'],
    'reveal': '答案是船：已知最早的独木舟/约有一万年历史，比车轮早四千多年。',  # 八拍 2
    'title': '人类如何造船',                                             # 八拍 3, the music's first drop
    'subtitle': '从独木舟到核动力航母的科技树',
}

CHAPTERS = [
    dict(id='canoe', n=1, title='独木舟', era='约 8000 年前 · 浙江萧山跨湖桥',
         card='跨湖桥独木舟由一整根松木制成，/船身留有先用火烧、再挖凿的痕迹。'),
    dict(id='nile', n=2, title='古埃及帆船', era='约公元前 3000 年起 · 尼罗河',
         card='尼罗河向北流，风多从北方吹来；/象形文字中，扬帆的船意为“南行”。'),
    dict(id='trireme', n=3, title='希腊桨帆战船', era='公元前 5 世纪 · 雅典',
         card='约一百七十名桨手分三层划桨，/船首的青铜撞角用于撞击敌船。'),
    dict(id='longship', n=4, title='维京长船', era='约公元 800—1050 年 · 斯堪的纳维亚',
         card='长船吃水不足一米，/既能远渡北海，也能沿河直抵巴黎。'),
    dict(id='fuchuan', n=5, title='中国福船', era='宋代至明代 · 福建沿海',
         card='隔板把船体分成多个密封的舱室；/一舱破损进水，船仍能保持浮力。'),
    dict(id='caravel', n=6, title='卡拉维尔帆船', era='15 世纪 · 葡萄牙',
         card='三角帆让它能够逆风斜行；/哥伦布船队的三艘船中，两艘是它。'),
    dict(id='lineship', n=7, title='风帆战列舰', era='17—19 世纪 · 欧洲',
         card='舰队排成一列纵队，以舷炮齐射；/“战列舰”这个名称由此而来。'),
    dict(id='steam', n=8, title='蒸汽船', era='19 世纪 · 英国 · 美国',
         card='蒸汽机让船第一次不必依靠风与人力；/1838 年，蒸汽船开始定期横渡大西洋。'),
    dict(id='ironclad', n=9, title='铁甲舰', era='1859—1862 年 · 法国 · 英国 · 美国',
         card='1862 年，两艘铁甲舰首次交战，/激战数小时，谁也没能击穿对方装甲。'),
    dict(id='dreadnought', n=10, title='无畏舰', era='1906 年 · 英国',
         card='“无畏”号统一装备十门 12 英寸主炮；/此前的战列舰从此被称为“前无畏舰”。'),
    dict(id='carrier', n=11, title='航空母舰', era='1918 年起 · 英国 · 日本 · 美国',
         card='珊瑚海海战中，双方舰队从未相互目视，/攻击全部由舰载机完成。'),
    dict(id='nuclear', n=12, title='核动力航母', era='1961 年起 · 美国',
         card='满载排水量约十万吨，舰员约五千人；/核反应堆一次装料，可运行二十多年。'),
]

OUTRO = ['从树干到钢铁，从桨与帆到核能；/材料与动力的每次突破，都改变了船。',     # 八拍 1
         '你乘坐过的最大的船，/是哪一种？']                                    # 八拍 2
END_CARD = ['人类如何造船', '科技树 02 · 造船', '本片画面与声音均由代码生成']     # 八拍 3


def width(s):
    return sum(.5 if ord(c) < 0x2000 and c not in '“”' else 1 for c in s)


def all_cards():
    return [HOOK['question'], HOOK['reveal']] + [c['card'] for c in CHAPTERS] + OUTRO


if __name__ == '__main__':
    bad = 0
    for card in all_cards():
        for p in card.split('/'):
            if width(p) > 18:
                print('TOO WIDE', width(p), p); bad += 1
    n8 = 3 + 2 * len(CHAPTERS) + 3
    print('cards', len(all_cards()), 'problems', bad, f'| {n8} 八拍 = {n8 * BAR8:.0f} s')
