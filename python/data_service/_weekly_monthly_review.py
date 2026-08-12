"""热门板块周线+月线复盘分析脚本

用法:
  python python/data_service/_weekly_monthly_review.py
  python python/data_service/_weekly_monthly_review.py --output reports/weekly-review.md
"""
import sys
sys.path.insert(0, 'python/data_service')
from collect_endpoints import (
    fetch_tencent_kline, fetch_sector_rotation_scores,
    fetch_tencent_quote, fetch_individual_info
)
from datetime import datetime, timedelta
import statistics
import logging
import re
import argparse

# 日志配置：INFO 级别，输出到 stderr（不污染 stdout 报告），含时间戳+模块+耗时
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s | %(message)s',
    datefmt='%H:%M:%S',
    stream=sys.stderr
)
_logger = logging.getLogger("weekly-review")

# ========== 命令行参数解析 ==========
_parser = argparse.ArgumentParser(description='FinSightV9 热门板块周月复盘分析')
_parser.add_argument('--output', '-o', type=str, default=None,
                    help='输出 Markdown 报告到指定文件路径（默认输出到 stdout）')
_args = _parser.parse_args()

# ========== 输出函数：stdout 模式 / Markdown 文件模式 ==========
_output_buffer: list[str] = []

def _emit(text: str = "") -> None:
    """统一输出函数。默认输出到 stdout；指定 --output 时缓冲到列表，末尾写入 Markdown 文件。"""
    if _args.output:
        _output_buffer.append(text)
    else:
        print(text)

def _flush_output() -> None:
    """脚本末尾调用：若指定 --output，将缓冲内容转换为 Markdown 写入文件。"""
    if not _args.output:
        return
    # 简单 Markdown 转换：
    # 1. 由 "=" * N 构成的分隔线 → Markdown 水平分隔线 ---
    # 2. 首行报告标题 → Markdown H1
    # 3. "第N部分:" 行 → Markdown H2
    # 4. 其他保持原样
    md_lines: list[str] = []
    for i, line in enumerate(_output_buffer):
        # 去除行首行尾空白后判断是否为纯 = 分隔线
        stripped = line.strip()
        if stripped and set(stripped) == {'='} and len(stripped) >= 3:
            md_lines.append('\n---\n')
        elif stripped.startswith('FinSightV9 热门板块周级+月级复盘报告'):
            md_lines.append(f'# {stripped}')
        elif re.match(r'^第\d+部分[:：]', stripped):
            md_lines.append(f'## {stripped}')
        elif stripped.startswith('报告结束'):
            md_lines.append(f'> {stripped}')
        else:
            md_lines.append(line)
    import os
    os.makedirs(os.path.dirname(_args.output) or '.', exist_ok=True)
    with open(_args.output, 'w', encoding='utf-8') as f:
        f.write('\n'.join(md_lines))
    _logger.info("Markdown 报告已写入 %s (%d 行)", _args.output, len(md_lines))


def _fetch_sw_index_kline(symbol: str, period: str = "week", count: int = 12) -> list[dict] | None:
    """获取申万行业指数K线（使用 AKShare index_hist_sw）。

    申万指数代码形如 801055，腾讯K线API不支持，需走 AKShare。
    返回格式与 fetch_tencent_kline 对齐: [{date, open, close, high, low, volume}, ...]
    """
    _fetch_start = datetime.now()
    try:
        import akshare as ak
    except ImportError:
        _logger.error("akshare 未安装，申万指数K线获取失败 symbol=%s", symbol)
        return None
    clean = symbol.split(".")[0]
    ak_period = "week" if period == "weekly" else ("month" if period == "monthly" else "day")
    _logger.info("K线请求开始 symbol=%s period=%s count=%d", clean, ak_period, count)
    try:
        df = ak.index_hist_sw(symbol=clean, period=ak_period)
        if df is None or df.empty:
            _logger.warning("K线返回空 symbol=%s period=%s", clean, ak_period)
            return None
        # 列名映射: 日期→date, 开盘→open, 收盘→close, 最高→high, 最低→low, 成交量→volume
        col_map = {"日期": "date", "开盘": "open", "收盘": "close", "最高": "high", "最低": "low", "成交量": "volume"}
        df = df.rename(columns=col_map)
        for c in ["open", "close", "high", "low"]:
            if c in df.columns:
                df[c] = df[c].astype(float)
        if "volume" in df.columns:
            df["volume"] = df["volume"].astype(float)
        rows = df.tail(count).to_dict("records")
        _elapsed = (datetime.now() - _fetch_start).total_seconds()
        _logger.info("K线获取成功 symbol=%s period=%s rows=%d/%d 耗时=%.2fs",
                     clean, ak_period, len(rows), count, _elapsed)
        return rows
    except Exception as e:
        _elapsed = (datetime.now() - _fetch_start).total_seconds()
        _logger.warning("申万指数K线失败 %s(%s) 耗时=%.2fs: %s", symbol, ak_period, _elapsed, e)
        return None


# 申万二级板块 → 龙头股代码（按市值/成交额排序，TOP3）
# 说明：真实 AKShare 成分股接口受限，此处使用行业常识静态映射，
#      后续若接口可用可替换为动态查询。
_SECTOR_TO_LEADERS: dict[str, list[str]] = {
    # 有色金属
    "工业金属": ["601899", "600362", "000630"],   # 紫金矿业、江西铜业、铜陵有色
    "黄金": ["600547", "600489", "601069"],       # 山东黄金、中金黄金、西部黄金
    "小金属": ["300750", "600549", "603799"],     # 宁德时代、厦门钨业、华友钴业
    "能源金属": ["002466", "002460", "300073"],   # 天齐锂业、赣锋锂业、当升科技
    # 电子
    "半导体": ["688981", "603501", "002371"],     # 中芯国际、韦尔股份、北方华创
    "元件": ["000725", "002049", "603160"],       # 京东方A、紫光国微、汇顶科技
    "光学光电子": ["002415", "002241", "002456"], # 海康威视、歌尔股份、欧菲光
    "消费电子": ["002475", "002241", "300433"],   # 立讯精密、歌尔股份、蓝思科技
    "电子化学品": ["300782", "688012", "002409"], # 卓胜微、中微公司、雅克科技
    # 机械设备
    "通用设备": ["000338", "300124", "601100"],   # 潍柴动力、汇川技术、恒立液压
    "专用设备": ["600031", "000157", "002008"],   # 三一重工、中联重科、大族激光
    "工程机械": ["600031", "000157", "603298"],   # 三一重工、中联重科、杭叉集团
    "自动化设备": ["300124", "688169", "002747"], # 汇川技术、石头科技、埃斯顿
    "轨交设备": ["601766", "000001", "300011"],   # 中国中车、平安银行(占位)、鼎汉技术
    # 电力设备
    "光伏设备": ["601012", "600438", "300274"],   # 隆基绿能、通威股份、阳光电源
    "电网设备": ["600900", "600089", "300376"],   # 长江电力、特变电工、易事特
    "风电设备": ["300750", "600416", "002202"],   # 宁德时代、湘电股份、金风科技
    "电池": ["300750", "002594", "601012"],        # 宁德时代、比亚迪、隆基绿能
    # 医药生物
    "化学制药": ["600276", "000538", "600196"],   # 恒瑞医药、云南白药、复星医药
    "医疗器械": ["300760", "002223", "300015"],   # 迈瑞医疗、鱼跃医疗、爱尔眼科
    "生物制品": ["300142", "600196", "603259"],   # 沃森生物、复星医药、药明康德
    "中药": ["600518", "000538", "600085"],        # ST康美(占位)、云南白药、同仁堂
    "医疗服务": ["300015", "300760", "600763"],   # 爱尔眼科、迈瑞医疗、通策医疗
    # 基础化工
    "塑料": ["600309", "000301", "002648"],       # 万华化学、东方盛虹、卫星化学
    "化学纤维": ["600346", "002493", "601233"],   # 恒力石化、荣盛石化、桐昆股份
    "化学制品": ["600309", "002493", "601233"],   # 万华化学、荣盛石化、桐昆股份
    "农化制品": ["600096", "000792", "600426"],   # 云天化、盐湖股份、华鲁恒升
    # 国防军工
    "军工电子Ⅱ": ["002025", "600760", "600893"],  # 航天电器、中航沈飞、航发动力
    "航空装备": ["600760", "600893", "000768"],   # 中航沈飞、航发动力、中航西飞
    "船舶制造": ["600150", "601989", "600685"],   # 中国船舶、中国重工、中船防务
    # 环保
    "环境治理": ["300750", "600008", "601139"],   # 宁德时代(占位)、首创环保、深圳燃气
    "环保设备": ["000338", "300203", "002340"],   # 潍柴动力(占位)、聚光科技、格林美
    # 汽车
    "汽车零部件": ["002594", "600741", "002920"], # 比亚迪、华域汽车、德赛西威
    "乘用车": ["002594", "600104", "601238"],     # 比亚迪、上汽集团、广汽集团
    # 计算机
    "软件开发": ["600519", "601318", "002415"],    # 占位（真实行业龙头需单独更新）
    "IT服务": ["600845", "300383", "603019"],     # 宝信软件、光环新网、中科曙光
    # 通信
    "通信设备": ["002415", "600745", "000063"],   # 海康威视、闻泰科技、中兴通讯
    "通信服务": ["600941", "601728", "600050"],   # 中国移动、中国电信、中国联通
    # 传媒
    "影视院线": ["300251", "002739", "600977"],   # 光线传媒、万达电影、中国电影
    "游戏": ["002555", "603444", "002602"],       # 三七互娱、吉比特、世纪华通
    # 银行
    "银行": ["601398", "601288", "600036"],       # 工商银行、农业银行、招商银行
    # 非银金融
    "证券": ["601688", "600030", "000776"],       # 华泰证券、中信证券、广发证券
    "保险": ["601318", "601601", "601336"],       # 中国平安、中国太保、新华保险
    # 食品饮料
    "白酒": ["600519", "000858", "000568"],       # 贵州茅台、五粮液、泸州老窖
    "食品加工": ["000895", "600887", "002714"],   # 双汇发展、伊利股份、牧原股份
    # 家电
    "白色家电": ["000333", "600690", "000651"],   # 美的集团、海尔智家、格力电器
    "小家电": ["002705", "002242", "603486"],     # 新宝股份、九阳股份、科沃斯
    # 建筑建材
    "水泥": ["600585", "601390", "000895"],       # 海螺水泥、中国中铁(占位)
    "装修建材": ["601886", "300737", "002791"],   # 江河集团、科顺股份、坚朗五金
    # 煤炭
    "煤炭开采": ["601088", "601225", "600188"],   # 中国神华、陕西煤业、兖州煤业
    # 石油石化
    "炼化及贸易": ["601857", "600028", "600583"], # 中国石油、中国石化、海油工程
    # 钢铁
    "钢铁": ["600019", "000708", "600022"],       # 宝钢股份、中信特钢、山东钢铁
    # 房地产
    "房地产开发": ["600048", "001979", "000002"], # 保利发展、招商蛇口、万科A
    # 交通运输
    "航运港口": ["601919", "601872", "600018"],   # 中远海控、招商轮船、上港集团
    "物流": ["002352", "601006", "600270"],       # 顺丰控股、大秦铁路、外运发展
    # 公用事业
    "电力": ["600900", "601985", "600886"],       # 长江电力、中国核电、国投电力
    # 美容护理
    "美容护理": ["600662", "300957", "603983"],   # 上海家化(占位)、贝泰妮、丸美股份
    # 农林牧渔
    "养殖业": ["002714", "300498", "600598"],     # 牧原股份、温氏股份、北大荒
    "种植业": ["600598", "000998", "002041"],     # 北大荒、隆平高科、登海种业
}

# 申万二级板块 → 龙头股代码的反向映射：代码 → 股票名称
# 用于 fetch_individual_info 失败时的名称回退（避免显示代码而非中文名）
_CODE_TO_NAME: dict[str, str] = {
    # 有色金属
    "601899": "紫金矿业", "600362": "江西铜业", "000630": "铜陵有色",
    "600547": "山东黄金", "600489": "中金黄金", "601069": "西部黄金",
    "300750": "宁德时代", "600549": "厦门钨业", "603799": "华友钴业",
    "002466": "天齐锂业", "002460": "赣锋锂业", "300073": "当升科技",
    # 电子
    "688981": "中芯国际", "603501": "韦尔股份", "002371": "北方华创",
    "000725": "京东方A", "002049": "紫光国微", "603160": "汇顶科技",
    "002415": "海康威视", "002241": "歌尔股份", "002456": "欧菲光",
    "300433": "蓝思科技", "300782": "卓胜微", "688012": "中微公司", "002409": "雅克科技",
    # 机械设备
    "000338": "潍柴动力", "300124": "汇川技术", "601100": "恒立液压",
    "600031": "三一重工", "000157": "中联重科", "002008": "大族激光",
    "603298": "杭叉集团", "688169": "石头科技", "002747": "埃斯顿",
    "601766": "中国中车", "300011": "鼎汉技术",
    # 电力设备
    "601012": "隆基绿能", "600438": "通威股份", "300274": "阳光电源",
    "600900": "长江电力", "600089": "特变电工", "300376": "易事特",
    "600416": "湘电股份", "002202": "金风科技", "002594": "比亚迪",
    # 医药生物
    "600276": "恒瑞医药", "000538": "云南白药", "600196": "复星医药",
    "300760": "迈瑞医疗", "002223": "鱼跃医疗", "300015": "爱尔眼科",
    "300142": "沃森生物", "603259": "药明康德",
    "600518": "ST康美", "600085": "同仁堂", "600763": "通策医疗",
    # 基础化工
    "600309": "万华化学", "000301": "东方盛虹", "002648": "卫星化学",
    "600346": "恒力石化", "002493": "荣盛石化", "601233": "桐昆股份",
    "600096": "云天化", "000792": "盐湖股份", "600426": "华鲁恒升",
    # 国防军工
    "002025": "航天电器", "600760": "中航沈飞", "600893": "航发动力", "000768": "中航西飞",
    "600150": "中国船舶", "601989": "中国重工", "600685": "中船防务",
    # 环保
    "600008": "首创环保", "601139": "深圳燃气", "300203": "聚光科技", "002340": "格林美",
    # 汽车
    "600741": "华域汽车", "002920": "德赛西威", "600104": "上汽集团", "601238": "广汽集团",
    # 计算机
    "600845": "宝信软件", "300383": "光环新网", "603019": "中科曙光",
    # 通信
    "600745": "闻泰科技", "000063": "中兴通讯",
    "600941": "中国移动", "601728": "中国电信", "600050": "中国联通",
    # 传媒
    "300251": "光线传媒", "002739": "万达电影", "600977": "中国电影",
    "002555": "三七互娱", "603444": "吉比特", "002602": "世纪华通",
    # 银行
    "601398": "工商银行", "601288": "农业银行", "600036": "招商银行",
    # 非银金融
    "601688": "华泰证券", "600030": "中信证券", "000776": "广发证券",
    "601318": "中国平安", "601601": "中国太保", "601336": "新华保险",
    # 食品饮料
    "600519": "贵州茅台", "000858": "五粮液", "000568": "泸州老窖",
    "000895": "双汇发展", "600887": "伊利股份", "002714": "牧原股份",
    # 家电
    "000333": "美的集团", "600690": "海尔智家", "000651": "格力电器",
    "002705": "新宝股份", "002242": "九阳股份", "603486": "科沃斯",
    # 建筑建材
    "600585": "海螺水泥", "601390": "中国中铁",
    "601886": "江河集团", "300737": "科顺股份", "002791": "坚朗五金",
    # 煤炭
    "601088": "中国神华", "601225": "陕西煤业", "600188": "兖州煤业",
    # 石油石化
    "601857": "中国石油", "600028": "中国石化", "600583": "海油工程",
    # 钢铁
    "600019": "宝钢股份", "000708": "中信特钢", "600022": "山东钢铁",
    # 房地产
    "600048": "保利发展", "001979": "招商蛇口", "000002": "万科A",
    # 交通运输
    "601919": "中远海控", "601872": "招商轮船", "600018": "上港集团",
    "002352": "顺丰控股", "601006": "大秦铁路", "600270": "外运发展",
    # 公用事业
    "601985": "中国核电", "600886": "国投电力",
    # 美容护理
    "600662": "上海家化", "300957": "贝泰妮", "603983": "丸美股份",
    # 农林牧渔
    "300498": "温氏股份", "600598": "北大荒", "000998": "隆平高科", "002041": "登海种业",
    # 兜底
    "000001": "平安银行",
}


def _get_sector_leaders(sector_name: str, default_fallback: list[str]) -> list[str]:
    """根据板块名获取龙头股代码列表，缺失则回退默认"""
    # 先精确查找，再去除罗马数字归一化查找
    candidates = [sector_name, re.sub(r"[\sⅠⅡⅢⅣIV]+$", "", sector_name).strip()]
    for name in candidates:
        if name in _SECTOR_TO_LEADERS:
            return list(_SECTOR_TO_LEADERS[name])
    _logger.info("龙头映射缺失: %s，使用 fallback", sector_name)
    return default_fallback


# ========== 1. 获取当前TOP板块评分 ==========
_emit("=" * 80)
_emit("FinSightV9 热门板块周级+月级复盘报告")
_emit(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
_emit("=" * 80)

_scores_start = datetime.now()
_logger.info("板块评分请求开始 topN=30")
scores = fetch_sector_rotation_scores(topN=30)
_scores_elapsed = (datetime.now() - _scores_start).total_seconds()
_logger.info("板块评分获取成功 count=%d 耗时=%.2fs", len(scores), _scores_elapsed)
scores_sorted = sorted(scores, key=lambda x: x.total, reverse=True)
_logger.info("板块评分排序完成 TOP3=%s",
             [(s.sectorName, s.total) for s in scores_sorted[:3]])

# ========== 2. 获取每个板块的周线/月线K线 ==========
_emit("\n" + "=" * 80)
_emit("第1部分: TOP15板块 周级+月级K线复盘")
_emit("=" * 80)

sector_results = []
_skip_count = 0
for _idx, s in enumerate(scores_sorted[:15], 1):
    sec_code = s.sectorCode.replace('.SI', '')
    sec_name = s.sectorName
    level1 = s.swLevel1 or '-'
    _logger.info("[%d/15] 开始处理板块 %s(%s) 综合分=%.1f", _idx, sec_name, sec_code, s.total)

    # 周线 (取12周 = ~3个月) - 申万指数用 AKShare
    weekly = _fetch_sw_index_kline(sec_code, period='weekly', count=12)
    # 月线 (取6月 = ~半年) - 申万指数用 AKShare
    monthly = _fetch_sw_index_kline(sec_code, period='monthly', count=6)

    if not weekly or not monthly:
        _logger.warning("[%d/15] %s(%s) K线获取失败，跳过 weekly=%s monthly=%s",
                        _idx, sec_name, sec_code, bool(weekly), bool(monthly))
        _emit(f"\n【{sec_name}({sec_code})】K线获取跳过")
        _skip_count += 1
        continue

    _logger.info("[%d/15] %s K线就绪 weekly=%d monthly=%d，开始计算涨跌幅",
                 _idx, sec_name, len(weekly), len(monthly))

    # 计算周级别涨跌幅
    w_this = (weekly[-1]['close'] - weekly[-1]['open']) / weekly[-1]['open'] * 100 if weekly[-1]['open'] else 0
    w_1w = (weekly[-1]['close'] - weekly[-2]['close']) / weekly[-2]['close'] * 100 if len(weekly) >= 2 and weekly[-2]['close'] else 0
    w_4w = (weekly[-1]['close'] - weekly[-5]['close']) / weekly[-5]['close'] * 100 if len(weekly) >= 5 and weekly[-5]['close'] else 0
    w_12w = (weekly[-1]['close'] - weekly[0]['close']) / weekly[0]['close'] * 100 if weekly[0]['close'] else 0

    # 近5周涨跌序列（趋势判断）
    w_last5 = weekly[-5:] if len(weekly) >= 5 else weekly
    w_changes = []
    for i in range(1, len(w_last5)):
        chg = (w_last5[i]['close'] - w_last5[i-1]['close']) / w_last5[i-1]['close'] * 100 if w_last5[i-1]['close'] else 0
        w_changes.append(round(chg, 1))
    w_up_weeks = sum(1 for c in w_changes if c > 0)

    # 计算月级别涨跌幅
    m_this = (monthly[-1]['close'] - monthly[-1]['open']) / monthly[-1]['open'] * 100 if monthly[-1]['open'] else 0
    m_1m = (monthly[-1]['close'] - monthly[-2]['close']) / monthly[-2]['close'] * 100 if len(monthly) >= 2 and monthly[-2]['close'] else 0
    m_3m = (monthly[-1]['close'] - monthly[-4]['close']) / monthly[-4]['close'] * 100 if len(monthly) >= 4 and monthly[-4]['close'] else 0
    m_6m = (monthly[-1]['close'] - monthly[0]['close']) / monthly[0]['close'] * 100 if monthly[0]['close'] else 0

    # 近3月涨跌序列
    m_last3 = monthly[-3:] if len(monthly) >= 3 else monthly
    m_changes = []
    for i in range(1, len(m_last3)):
        chg = (m_last3[i]['close'] - m_last3[i-1]['close']) / m_last3[i-1]['close'] * 100 if m_last3[i-1]['close'] else 0
        m_changes.append(round(chg, 1))

    # 周线成交量趋势
    w_vols = [b['volume'] for b in weekly if b['volume']]
    w_vol_ratio = w_vols[-1] / statistics.mean(w_vols[-5:-1]) if len(w_vols) >= 5 and statistics.mean(w_vols[-5:-1]) else 1.0

    # 趋势标签
    if w_1w > 2 and w_4w > 5:
        w_trend = '强势上攻'
    elif w_1w > 0 and w_4w > 0:
        w_trend = '震荡上行'
    elif w_1w < -2 and w_4w < -5:
        w_trend = '快速回调'
    elif w_1w < 0 and w_4w < 0:
        w_trend = '震荡下行'
    else:
        w_trend = '震荡整理'

    if m_1m > 3 and m_3m > 10:
        m_trend = '月线主升浪'
    elif m_1m > 0 and m_3m > 0:
        m_trend = '月线向上'
    elif m_1m < -3 and m_3m < -10:
        m_trend = '月线主跌浪'
    elif m_1m < 0 and m_3m < 0:
        m_trend = '月线向下'
    else:
        m_trend = '月线盘整'

    _logger.info("[%d/15] %s 计算完成 w_1w=%+.1f%% w_4w=%+.1f%% m_1m=%+.1f%% w_trend=%s m_trend=%s",
                 _idx, sec_name, w_1w, w_4w, m_1m, w_trend, m_trend)

    result = {
        'name': sec_name, 'code': sec_code, 'level1': level1,
        'total': s.total, 'f1': s.f1Jingqi, 'f2': s.f2Zijin, 'f3': s.f3Guzhi, 'f4': s.f4Beta, 'f5': s.f5Nengliang,
        'w_this': round(w_this, 1), 'w_1w': round(w_1w, 1), 'w_4w': round(w_4w, 1), 'w_12w': round(w_12w, 1),
        'w_changes': w_changes, 'w_up_weeks': w_up_weeks, 'w_vol_ratio': round(w_vol_ratio, 1), 'w_trend': w_trend,
        'm_this': round(m_this, 1), 'm_1m': round(m_1m, 1), 'm_3m': round(m_3m, 1), 'm_6m': round(m_6m, 1),
        'm_changes': m_changes, 'm_trend': m_trend,
    }
    sector_results.append(result)

    # 打印
    _emit(f"\n{'='*50}")
    _emit(f"【{sec_name}】({sec_code}) [{level1}] 综合分={s.total:.1f}")
    _emit(f"  五因子: f1景气={s.f1Jingqi:.0f} f2资金={s.f2Zijin:.0f} f3估值={s.f3Guzhi:.0f} f4Beta={s.f4Beta:.0f} f5量能={s.f5Nengliang:.0f}")
    _emit(f"\n  📅 周级复盘:")
    _emit(f"    本周: {w_this:+.1f}% | 1周前: {w_1w:+.1f}% | 4周: {w_4w:+.1f}% | 12周: {w_12w:+.1f}%")
    _emit(f"    近5周周涨跌序列: {w_changes} 阳线数={w_up_weeks}/{len(w_changes)}")
    _emit(f"    周量比(相对前4周均量): {w_vol_ratio:.1f}x")
    _emit(f"    周线趋势: {w_trend}")
    _emit(f"\n  📅 月级复盘:")
    _emit(f"    本月: {m_this:+.1f}% | 1月前: {m_1m:+.1f}% | 3月: {m_3m:+.1f}% | 6月: {m_6m:+.1f}%")
    _emit(f"    近3月月涨跌序列: {m_changes}")
    _emit(f"    月线趋势: {m_trend}")

_logger.info("第1部分完成 sector_results=%d 跳过=%d", len(sector_results), _skip_count)

# ========== 3. 汇总排行 ==========
_emit("\n\n" + "=" * 80)
_emit("第2部分: 周/月维度涨幅排行榜")
_emit("=" * 80)

# 按4周涨幅排行
_emit("\n🏆 近4周涨幅 TOP10:")
_calc_start = datetime.now()
sorted_4w = sorted(sector_results, key=lambda x: x['w_4w'], reverse=True)
_logger.info("排行榜计算完成 [4周涨幅] 输入=%d 输出=%d 耗时=%.3fs",
             len(sector_results), len(sorted_4w[:10]),
             (datetime.now() - _calc_start).total_seconds())
for i, r in enumerate(sorted_4w[:10]):
    arrow = '↑' if r['w_4w'] > 0 else ('↓' if r['w_4w'] < 0 else '→')
    _emit(f"  {i+1:2d}. {r['name']:8s} 4周={r['w_4w']:+6.1f}% {arrow} 12周={r['w_12w']:+6.1f}% {r['w_trend']}")

# 按1月涨幅排行
_emit("\n🏆 近1月涨幅 TOP10:")
sorted_1m = sorted(sector_results, key=lambda x: x['m_1m'], reverse=True)
_logger.info("排行榜计算完成 [1月涨幅] 输出=%d TOP3=%s",
             len(sorted_1m[:10]),
             [(r['name'], r['m_1m']) for r in sorted_1m[:3]])
for i, r in enumerate(sorted_1m[:10]):
    arrow = '↑' if r['m_1m'] > 0 else ('↓' if r['m_1m'] < 0 else '→')
    _emit(f"  {i+1:2d}. {r['name']:8s} 1月={r['m_1m']:+6.1f}% {arrow} 3月={r['m_3m']:+6.1f}% 6月={r['m_6m']:+6.1f}% {r['m_trend']}")

# 按量比排行
_emit("\n🏆 周量比 TOP8 (放量板块):")
sorted_vol = sorted(sector_results, key=lambda x: x['w_vol_ratio'], reverse=True)
_logger.info("排行榜计算完成 [量比] 放量=%d 缩量=%d 平量=%d",
             sum(1 for r in sector_results if r['w_vol_ratio'] > 1.2),
             sum(1 for r in sector_results if r['w_vol_ratio'] < 0.8),
             sum(1 for r in sector_results if 0.8 <= r['w_vol_ratio'] <= 1.2))
for i, r in enumerate(sorted_vol[:8]):
    sign = '放量' if r['w_vol_ratio'] > 1.2 else ('缩量' if r['w_vol_ratio'] < 0.8 else '平量')
    _emit(f"  {i+1:2d}. {r['name']:8s} 量比={r['w_vol_ratio']:.1f}x {sign} 周涨跌={r['w_this']:+.1f}%")

_logger.info("第2部分完成 排行榜已生成 (4周TOP10/1月TOP10/量比TOP8)")

# ========== 4. 周/月共振分析 ==========
_emit("\n\n" + "=" * 80)
_emit("第3部分: 周月共振分析 + 机会风险提示")
_emit("=" * 80)

_emit("\n✅ 【周月共振看多】周线+月线同步向上:")
resonance_bull = [r for r in sector_results if ('上行' in r['w_trend'] or '上攻' in r['w_trend']) and ('向上' in r['m_trend'] or '主升' in r['m_trend'])]
_logger.info("共振分析计算 [看多] 命中=%d 候选池=%d", len(resonance_bull), len(sector_results))
if resonance_bull:
    for r in resonance_bull:
        _emit(f"  {r['name']:8s} 周={r['w_4w']:+5.1f}% 月={r['m_1m']:+5.1f}% f2资金={r['f2']:.0f}")
else:
    _emit("  (暂无)")

_emit("\n⚠️ 【周月共振看空】周线+月线同步向下:")
resonance_bear = [r for r in sector_results if ('下行' in r['w_trend'] or '回调' in r['w_trend']) and ('向下' in r['m_trend'] or '主跌' in r['m_trend'])]
_logger.info("共振分析计算 [看空] 命中=%d", len(resonance_bear))
if resonance_bear:
    for r in resonance_bear:
        _emit(f"  {r['name']:8s} 周={r['w_4w']:+5.1f}% 月={r['m_1m']:+5.1f}%")
else:
    _emit("  (暂无)")

_emit("\n💡 【周线反转机会】4周跌幅大+本周止跌反弹:")
reversal = [r for r in sector_results if r['w_4w'] < -5 and r['w_this'] > 1]
_logger.info("共振分析计算 [反转机会] 命中=%d 筛选条件=w_4w<-5 & w_this>1", len(reversal))
if reversal:
    for r in reversal:
        _emit(f"  {r['name']:8s} 4周跌{r['w_4w']:+.1f}% 本周反弹{r['w_this']:+.1f}% 量比={r['w_vol_ratio']:.1f}x")
else:
    _emit("  (暂无)")

_emit("\n🚨 【风险预警】周线主升+量比过高(>1.5x)可能过热:")
overheat = [r for r in sector_results if ('上攻' in r['w_trend'] or '上行' in r['w_trend']) and r['w_vol_ratio'] > 1.5 and r['w_up_weeks'] >= 4]
_logger.info("共振分析计算 [过热预警] 命中=%d 筛选条件=vol_ratio>1.5 & up_weeks>=4", len(overheat))
if overheat:
    for r in overheat:
        _emit(f"  {r['name']:8s} 连阳{r['w_up_weeks']}周 量比={r['w_vol_ratio']:.1f}x 4周涨{r['w_4w']:+.1f}%")
else:
    _emit("  (暂无)")

_logger.info("第3部分完成 共振分析 看多=%d 看空=%d 反转=%d 过热=%d",
             len(resonance_bull), len(resonance_bear), len(reversal), len(overheat))

# ========== 5. 申万一级行业周月汇总 ==========
_emit("\n\n" + "=" * 80)
_emit("第4部分: 申万一级行业周月汇总视图")
_emit("=" * 80)

level1_map = {}
for r in sector_results:
    l1 = r['level1']
    if l1 not in level1_map:
        level1_map[l1] = {'items': [], 'w_4w_sum': 0, 'm_1m_sum': 0}
    level1_map[l1]['items'].append(r)
    level1_map[l1]['w_4w_sum'] += r['w_4w']
    level1_map[l1]['m_1m_sum'] += r['m_1m']

level1_sorted = sorted(level1_map.items(), key=lambda x: len(x[1]['items']), reverse=True)
_logger.info("一级行业聚合完成 行业数=%d 详情=%s",
             len(level1_sorted),
             {l1: len(d['items']) for l1, d in level1_sorted})
_emit(f"\n{'一级行业':8s} {'板块数':>4s} {'4周均幅':>8s} {'1月均幅':>8s} {'代表板块':12s} {'周趋势':8s} {'月趋势':8s}")
_emit("-" * 80)
for l1, data in level1_sorted:
    n = len(data['items'])
    w_avg = data['w_4w_sum'] / n
    m_avg = data['m_1m_sum'] / n
    # 代表板块取4周涨幅最高
    top_item = sorted(data['items'], key=lambda x: x['w_4w'], reverse=True)[0]
    _emit(f"{l1:8s} {n:>4d} {w_avg:+7.1f}% {m_avg:+7.1f}% {top_item['name']:10s} {top_item['w_trend']:8s} {top_item['m_trend']:8s}")

_logger.info("第4部分完成 一级行业汇总 行业数=%d", len(level1_sorted))

# ========== 6. 龙头股周月复盘 ==========
_emit("\n\n" + "=" * 80)
_emit("第5部分: TOP3板块龙头股 周级+月级复盘")
_emit("=" * 80)

# 动态取 TOP3 板块并匹配真实龙头股
_fallback_codes = ['600519', '000858', '000001']  # 茅台/五粮液/平安兜底
sector_stocks: dict[str, list[str]] = {}
for i in range(min(3, len(scores_sorted))):
    sec_name = scores_sorted[i].sectorName
    sector_stocks[sec_name] = _get_sector_leaders(sec_name, _fallback_codes)
_logger.info("龙头股映射完成 sectors=%s",
             {k: v for k, v in sector_stocks.items()})

for sec_name, stock_codes in sector_stocks.items():
    if not stock_codes:
        continue
    _emit(f"\n【{sec_name}】板块龙头:")
    for code in stock_codes:
        _stock_start = datetime.now()
        try:
            info = fetch_individual_info(code)
            # 周线
            wk = fetch_tencent_kline(code, count=6, period='weekly', adjust='qfq')
            # 月线
            mk = fetch_tencent_kline(code, count=4, period='monthly', adjust='qfq')
            if not wk or not mk:
                _logger.warning("龙头股K线获取失败 code=%s weekly=%s monthly=%s",
                                code, bool(wk), bool(mk))
                continue
            wk_1w = (wk[-1]['close'] - wk[-2]['close']) / wk[-2]['close'] * 100 if len(wk) >= 2 and wk[-2]['close'] else 0
            wk_4w = (wk[-1]['close'] - wk[0]['close']) / wk[0]['close'] * 100 if wk[0]['close'] else 0
            mk_1m = (mk[-1]['close'] - mk[-2]['close']) / mk[-2]['close'] * 100 if len(mk) >= 2 and mk[-2]['close'] else 0
            mk_3m = (mk[-1]['close'] - mk[0]['close']) / mk[0]['close'] * 100 if mk[0]['close'] else 0
            # 名称回退链：fetch_individual_info → _CODE_TO_NAME 反向映射表 → 代码兜底
            name = (info and info.get('name')) or _CODE_TO_NAME.get(code) or code
            _elapsed = (datetime.now() - _stock_start).total_seconds()
            _logger.info("龙头股复盘完成 code=%s name=%s weekly=%d monthly=%d 耗时=%.2fs",
                         code, name, len(wk), len(mk), _elapsed)
            _emit(f"  {name:6s}({code}) 1周={wk_1w:+5.1f}% 4周={wk_4w:+5.1f}% | 1月={mk_1m:+5.1f}% 3月={mk_3m:+5.1f}%")
        except Exception as e:
            _elapsed = (datetime.now() - _stock_start).total_seconds()
            _logger.error("龙头股复盘异常 code=%s 耗时=%.2fs: %s", code, _elapsed, e, exc_info=True)
            _emit(f"  ({code}) 失败")

_emit("\n\n" + "=" * 80)
_emit("报告结束 - 周月复盘数据仅供参考，不构成投资建议")
_emit("=" * 80)

_logger.info("===== 报告生成完成 ===== 板块=%d 跳过=%d 共振(看多=%d/看空=%d/反转=%d/过热=%d) 一级行业=%d",
             len(sector_results), _skip_count,
             len(resonance_bull), len(resonance_bear), len(reversal), len(overheat),
             len(level1_sorted))

# 若指定 --output，将缓冲内容转换为 Markdown 写入文件
_flush_output()
