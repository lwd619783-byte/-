import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const symbolPath = path.join(root, "src", "utils", "symbol.ts");
const stocksPath = path.join(root, "src", "data", "stocks.ts");
const privateCompaniesPath = path.join(root, "src", "data", "privateCompanies.ts");
const realDir = path.join(root, "src", "data", "real");
const universePath = path.join(realDir, "stock-universe.generated.json");
const manifestPath = path.join(realDir, "data-manifest.generated.json");

function nowIso() {
  const date = new Date();
  const offsetMs = 8 * 60 * 60 * 1000;
  return new Date(date.getTime() + offsetMs).toISOString().replace("Z", "+08:00");
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function uniq(values) {
  return [...new Set(values)];
}

function parseStockIds(source) {
  return uniq([...source.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]));
}

function parsePrivateCompanyIds(source) {
  return uniq([...source.matchAll(/(?:^|\n)  \{\r?\n    id:\s*"([^"]+)"/g)].map((match) => match[1]));
}

function marketCounts(items, predicate = () => true) {
  return items.reduce(
    (acc, item) => {
      if (predicate(item)) {
        acc[item.market] = (acc[item.market] ?? 0) + 1;
      }
      return acc;
    },
    { "A股": 0, "港股": 0, "美股": 0, "未上市": 0 },
  );
}

function providerSymbolFor(item) {
  return item.market === "A股" ? item.standardSymbol : item.standardSymbol;
}

function validateAExchange(code, exchange) {
  if (/^(60|68)/.test(code) && exchange !== "SH") return `A股代码 ${code} 通常应为 SH`;
  if (/^(00|30)/.test(code) && exchange !== "SZ") return `A股代码 ${code} 通常应为 SZ`;
  return null;
}

const symbolSource = read(symbolPath);
const stocksSource = read(stocksPath);
const privateSource = fs.existsSync(privateCompaniesPath) ? read(privateCompaniesPath) : "";
const listedStockIds = parseStockIds(stocksSource);
const privateCompanyIds = parsePrivateCompanyIds(privateSource);
const warnings = [];

const items = [];
for (const match of symbolSource.matchAll(/mapA\("([^"]+)",\s*"([^"]+)",\s*"(\d{6})",\s*"(SH|SZ)"\)/g)) {
  const [, id, name, code, exchange] = match;
  const standardSymbol = `${code}.${exchange}`;
  const warning = validateAExchange(code, exchange);
  if (warning) warnings.push(`${id}: ${warning}`);
  items.push({
    id,
    name,
    code,
    market: "A股",
    exchange,
    standardSymbol,
    providerSymbol: providerSymbolFor({ market: "A股", standardSymbol }),
    dataProvider: "aStockData",
    dataStatus: "supported",
    shouldFetchQuote: true,
    shouldFetchFinancials: true,
    shouldValidate: true,
  });
}

for (const match of symbolSource.matchAll(/mapHK\("([^"]+)",\s*"([^"]+)",\s*"(\d+)"\)/g)) {
  const [, id, name, rawCode] = match;
  const code = rawCode.padStart(4, "0");
  const standardSymbol = `${code}.HK`;
  items.push({
    id,
    name,
    code,
    market: "港股",
    exchange: "HK",
    standardSymbol,
    providerSymbol: standardSymbol,
    dataProvider: "yfinance",
    dataStatus: "supported",
    shouldFetchQuote: true,
    shouldFetchFinancials: false,
    shouldValidate: true,
  });
}

const symbolIds = items.map((item) => item.id);
for (const id of listedStockIds.filter((id) => !symbolIds.includes(id))) {
  if (!privateCompanyIds.includes(id)) warnings.push(`${id}: exists in stocks.ts but is missing from symbolMap`);
}
for (const id of symbolIds.filter((id) => !listedStockIds.includes(id))) {
  warnings.push(`${id}: exists in symbolMap but is missing from stocks.ts`);
}
for (const id of privateCompanyIds.filter((id) => symbolIds.includes(id))) {
  warnings.push(`${id}: private company should not be included in listed stock universe`);
}

const generatedAt = nowIso();
const markets = marketCounts(items);
const supported = marketCounts(items, (item) => item.dataStatus === "supported");
const unsupported = marketCounts(items, (item) => item.dataStatus !== "supported");

const payload = {
  generatedAt,
  total: items.length,
  markets,
  supported,
  unsupported,
  privateCompanies: {
    total: privateCompanyIds.length,
    ids: privateCompanyIds,
    includedInListedUniverse: 0,
  },
  warnings,
  items,
};

fs.mkdirSync(realDir, { recursive: true });
fs.writeFileSync(universePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

let manifest = {};
if (fs.existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(read(manifestPath));
  } catch {
    manifest = {};
  }
}
manifest.generatedAt = generatedAt;
manifest.updatedAt = manifest.updatedAt ?? generatedAt;
manifest.universe = {
  total: payload.total,
  markets,
  supported,
  unsupported,
  privateCompanies: payload.privateCompanies.total,
  source: "src/data/real/stock-universe.generated.json",
};
manifest.universeWarnings = warnings;
manifest.sourceSummary = uniq([...(manifest.sourceSummary ?? []), "Generated stock universe"]);
manifest.errors = manifest.errors ?? [];
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`stock universe written: ${path.relative(root, universePath)}`);
console.log(`total=${payload.total} A=${markets["A股"]} HK=${markets["港股"]} private=${payload.privateCompanies.total} warnings=${warnings.length}`);
