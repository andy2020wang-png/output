"""Episode 2 (科技树 02 · 计算): approved on-screen text lives here. '/' = line break; width rule: CJK = 1, ASCII = 0.5, max 18."""
HOOK = {
    'series': '科技树 02 · 计算',
    'question': '最早的“计算机”，/是用什么做成的？',
    'options': ['A 齿轮', 'B 电子管', 'C 晶体管', 'D 人'],
    'reveal': '答案是 D：人。/computer 一词最早指从事计算的人。',
    'title': '人类如何计算',
    'subtitle': '从齿轮到人工智能的科技树',
}
CHAPTERS = [
    dict(id='diff', n=1, title='差分机', era='1822 年起 · 伦敦',
         cards=['19 世纪的数学用表全靠人工计算，/印刷出来的表格常有错误。',
                '巴贝奇设计了差分机，/只用加法和齿轮，就能逐行算出数表。',
                '它在巴贝奇生前没有建成；/1991 年，科学博物馆按图纸造出一台。']),
    dict(id='analytic', n=2, title='分析机', era='1837 年起 · 伦敦',
         cards=['巴贝奇又构想了分析机：/打孔卡输入指令，存储器与运算器分开。',
                '1843 年，洛夫莱斯为它写下一套算法，/常被视为最早的计算机程序。']),
    dict(id='turing', n=3, title='图灵机', era='1936 年 · 英国',
         cards=['1936 年，图灵设想了一台抽象的机器：/一条纸带、一个读写头、一张规则表。',
                '他证明，一台“通用”的这种机器，/可以模拟任何其他同类机器的工作。']),
    dict(id='eniac', n=4, title='电子管', era='1946 年 · ENIAC',
         cards=['ENIAC 有约一万七千个电子管，/重约二十七吨，占满一个大房间。',
                '它每秒可做五千次加法；/为它编写程序的，最早是六位女性。']),
    dict(id='chip', n=5, title='芯片', era='1947—1971 年 · 晶体管与微处理器',
         cards=['1947 年，贝尔实验室发明了晶体管，/它比电子管更小、更省电，也更可靠。',
                '1971 年的英特尔 4004 芯片上，/集成了约两千三百个晶体管。',
                '它是首款商用微处理器；/此后，芯片上的晶体管约每两年翻一番。']),
    dict(id='pocket', n=6, title='个人计算机', era='1970 年代起 · 从桌面到口袋',
         cards=['1970 年代末，个人计算机走进家庭；/21 世纪，智能手机把它放进了口袋。',
                '今天一部智能手机的算力，/远超阿波罗登月飞船上的导航计算机。']),
    dict(id='ai', n=7, title='人工智能', era='2012 年起',
         cards=['2012 年起，深度学习让计算机/在识别图像和语音上取得突破。',
                '2020 年代，大语言模型能读能写，/也能编写程序。',
                '这条视频的每一帧画面、每一个声音，/都由 AI 编写的程序计算生成。']),
]
OUTRO = ['巴贝奇造机器，是为了消除计算错误；/今天，机器开始替人编写计算的规则。',
         '从前，计算机是人；/如今，人开始和计算机一起写代码。',
         '你今天做过的计算，/有多少是交给机器完成的？']
END_CARD = ['人类如何计算', '科技树 02 · 计算', '下一集：人类如何通信', '本片画面与声音均由代码生成']
MOTIF = '同一道题贯穿全片：计算平方数 1、4、9、16、25……（差分法：平方数的二阶差分恒为 2），每个时代的机器各算一遍。'


def width(s):
    return sum(.5 if ord(c) < 0x2000 and c not in '“”' else 1 for c in s)


if __name__ == '__main__':
    import sys
    bad = 0
    for card in [HOOK['question'], HOOK['reveal']] + [c for ch in CHAPTERS for c in ch['cards']] + OUTRO:
        for p in card.split('/'):
            if width(p) > 18:
                print('TOO WIDE', width(p), p); bad += 1
    print('cards', sum(len(c['cards']) for c in CHAPTERS) + len(OUTRO), 'problems', bad)
