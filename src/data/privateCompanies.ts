import type { EvidenceItem } from "../types";

type RoboticsPrivateCompany = {
  id: string;
  name: string;
  market: "未上市";
  industryId: string;
  segmentId: string;
  chainPosition: string;
  business: string;
  thesis: string;
  evidenceLevel: "高" | "中" | "低";
  verificationStatus: "已验证" | "部分验证" | "待验证";
  themeTags: string[];
  trackingMetrics: string[];
  risks: string[];
  evidenceItems?: EvidenceItem[];
};

export const roboticsPrivateCompanies: RoboticsPrivateCompany[] = [
  {
    id: "unitree",
    name: "宇树科技",
    market: "未上市",
    industryId: "robotics",
    segmentId: "robot-oem",
    chainPosition: "下游",
    business: "四足机器人、人形机器人、本体整机",
    thesis: "国内具身智能本体公司代表，IPO 进展和产品迭代是核心催化。",
    evidenceLevel: "高",
    verificationStatus: "已验证",
    themeTags: ["本体整机", "具身智能", "待上市"],
    trackingMetrics: ["IPO进展", "新品发布", "量产节奏", "商业化订单"],
    risks: ["未上市无法接入行情", "量产节奏不确定", "商业化兑现仍需跟踪"],
    evidenceItems: [
      {
        id: "unitree-official-products",
        claim: "宇树科技官网公开展示四足机器人与人形机器人产品线，可作为未上市机器人本体公司的产业链跟踪线索。",
        sourceType: "官网",
        sourceName: "宇树科技官网公开产品资料",
        confidence: "高",
        relatedSegmentId: "robot-oem",
        verificationStatus: "已验证",
        note: "仅作为未上市公司产业链线索展示，不进入上市股票 Universe，也不生成 quote、priceHistory 或 financials。",
      },
      {
        id: "unitree-ipo-tracking",
        claim: "宇树科技上市进展属于后续跟踪项，当前看板仅记录为未上市公司研究线索。",
        sourceType: "媒体报道",
        sourceName: "公开媒体与市场信息线索",
        confidence: "中",
        relatedSegmentId: "robot-oem",
        verificationStatus: "待验证",
        note: "IPO、注册或上市节奏需要以后续正式申报文件或交易所披露为准。",
      },
    ],
  },
];
