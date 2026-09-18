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

export const roboticsPrivateCompanies: RoboticsPrivateCompany[] = [];
