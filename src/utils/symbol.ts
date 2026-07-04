export type DataProviderKey = "aStockData" | "akshare" | "baostock" | "yfinance" | "tushare";

export interface SymbolMapping {
  id: string;
  name: string;
  standardSymbol: string;
  market: "A股" | "港股" | "美股";
  providers: Partial<Record<DataProviderKey, string>>;
  aStockDataStatus: "supported" | "unsupported_market";
}

export const symbolMap: SymbolMapping[] = [
  mapA("sugon", "中科曙光", "603019", "SH"),
  mapA("fii", "工业富联", "601138", "SH"),
  mapHK("lenovo", "联想集团", "0992"),
  mapA("eoptolink", "新易盛", "300502", "SZ"),
  mapA("innolight", "中际旭创", "300308", "SZ"),
  mapA("wus", "沪电股份", "002463", "SZ"),
  mapA("victor-tech", "胜宏科技", "300476", "SZ"),
  mapA("shennan", "深南电路", "002916", "SZ"),
  mapHK("ubtech", "优必选", "9880"),
  mapA("siasun", "机器人", "300024", "SZ"),
  mapA("estun", "埃斯顿", "002747", "SZ"),
  mapA("efort", "埃夫特", "688165", "SH"),
  mapA("leaderdrive", "绿的谐波", "688017", "SH"),
  mapA("zhongda-lide", "中大力德", "002896", "SZ"),
  mapA("shuanghuan", "双环传动", "002472", "SZ"),
  mapA("siling", "斯菱股份", "301550", "SZ"),
  mapA("beite", "北特科技", "603009", "SH"),
  mapA("best", "贝斯特", "300580", "SZ"),
  mapA("wuzhou", "五洲新春", "603667", "SH"),
  mapA("jinwo", "金沃股份", "300984", "SZ"),
  mapA("sanhua", "三花智控", "002050", "SZ"),
  mapA("topgroup", "拓普集团", "601689", "SH"),
  mapA("hengli-hydraulic", "恒立液压", "601100", "SH"),
  mapA("inovance", "汇川技术", "300124", "SZ"),
  mapA("leisai", "雷赛智能", "002979", "SZ"),
  mapA("moons", "鸣志电器", "603728", "SH"),
  mapA("orbbec", "奥比中光", "688322", "SH"),
  mapA("hanwei", "汉威科技", "300007", "SZ"),
  mapA("hengshuai", "恒帅股份", "300969", "SZ"),
  mapA("fortior", "峰岹科技", "688279", "SH"),
  mapA("xinje", "信捷电气", "603416", "SH"),
  mapA("rongtai", "浙江荣泰", "603119", "SH"),
  mapA("luster", "凌云光", "688400", "SH"),
  mapHK("sunny-optical", "舜宇光学科技", "2382"),
  mapA("everwin", "长盈精密", "300115", "SZ"),
  mapA("xusheng", "旭升集团", "603305", "SH"),
  mapA("hengbo", "恒勃股份", "301225", "SZ"),
  mapA("xinquan", "新泉股份", "603179", "SH"),
  mapA("keboda", "科博达", "603786", "SH"),
  mapA("joyson", "均胜电子", "600699", "SH"),
  mapA("xingyu", "星宇股份", "601799", "SH"),
  mapA("riying", "日盈电子", "603286", "SH"),
  mapA("daimei", "岱美股份", "603730", "SH"),
  mapA("molding-tech", "模塑科技", "000700", "SZ"),
  mapA("wanxiang-qc", "万向钱潮", "000559", "SZ"),
  mapA("tieliu", "铁流股份", "603926", "SH"),
  mapA("zhaomin", "肇民科技", "301000", "SZ"),
  mapA("dongli", "宁波东力", "002164", "SZ"),
  mapA("kaidi", "凯迪股份", "605288", "SH"),
  mapA("henghui", "恒辉安防", "300952", "SZ"),
  mapA("wuxi", "药明康德", "603259", "SH"),
  mapA("pharmaron", "康龙化成", "300759", "SZ"),
  mapA("asymchem", "凯莱英", "002821", "SZ"),
  mapA("nano", "纳微科技", "688690", "SH"),
  mapA("hengrui", "恒瑞医药", "600276", "SH"),
  mapA("beigene", "百济神州", "688235", "SH"),
  mapA("cosco-energy", "中远海能", "600026", "SH"),
  mapA("cm-energy", "招商轮船", "601872", "SH"),
  mapA("cm-nanjing", "招商南油", "601975", "SH"),
];

export function getSymbolMapping(id: string) {
  return symbolMap.find((item) => item.id === id);
}

export function toProviderSymbol(id: string, provider: DataProviderKey) {
  return getSymbolMapping(id)?.providers[provider] ?? null;
}

function mapA(id: string, name: string, code: string, exchange: "SH" | "SZ"): SymbolMapping {
  const lower = exchange.toLowerCase();
  return {
    id,
    name,
    standardSymbol: `${code}.${exchange}`,
    market: "A股",
    providers: {
      akshare: code,
      aStockData: code,
      baostock: `${lower}.${code}`,
      tushare: `${code}.${exchange}`,
    },
    aStockDataStatus: "supported",
  };
}

function mapHK(id: string, name: string, code: string): SymbolMapping {
  const padded = code.padStart(4, "0");
  return {
    id,
    name,
    standardSymbol: `${padded}.HK`,
    market: "港股",
    providers: {
      yfinance: `${padded}.HK`,
    },
    aStockDataStatus: "unsupported_market",
  };
}
