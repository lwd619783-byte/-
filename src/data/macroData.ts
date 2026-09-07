import type { MacroIndicator } from "../types";
import generatedMacro from "./real/macro.generated.json";

type GeneratedMacroData = {
  updatedAt?: string;
  sourceSummary?: string[];
  errors?: string[];
  indicators?: MacroIndicator[];
};

const realMacro = generatedMacro as GeneratedMacroData;
const hasRealMacro = Boolean(realMacro.indicators?.length);

export const dataUpdatedAt = hasRealMacro ? realMacro.updatedAt ?? "" : "";
export const dataSourceNote = hasRealMacro
  ? `宏观数据：AKShare 本地生成 JSON；覆盖 ${realMacro.sourceSummary?.length ?? 0} 个宏观接口；错误 ${realMacro.errors?.length ?? 0} 个。`
  : "宏观数据暂缺，模型尚未接入。";

export const macroIndicators: MacroIndicator[] = hasRealMacro ? realMacro.indicators ?? [] : [];
