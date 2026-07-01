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
  mapA("best", "贝斯特", "300580", "SZ"),
  mapA("wuzhou", "五洲新春", "603667", "SH"),
  mapA("leaderdrive", "绿的谐波", "688017", "SH"),
  mapA("moons", "鸣志电器", "603728", "SH"),
  mapA("topgroup", "拓普集团", "601689", "SH"),
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
