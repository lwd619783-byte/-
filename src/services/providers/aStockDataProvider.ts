import manifestJson from "../../data/real/data-manifest.generated.json";
import announcementSummariesJson from "../../data/real/a-share-announcement-summaries.generated.json";
import aShareFinancialSummariesJson from "../../data/real/a-share-financial-summaries.generated.json";
import priceHistoryJson from "../../data/real/priceHistory.generated.json";
import profilesJson from "../../data/real/stocks.generated.json";
import quotesJson from "../../data/real/quotes.generated.json";
import researchJson from "../../data/real/research.generated.json";
import sectorMembershipJson from "../../data/real/sectorMembership.generated.json";
import signalsJson from "../../data/real/signals.generated.json";
import type { GeneratedRealDataBundle } from "../../types";

export function getAStockData(): GeneratedRealDataBundle {
  return {
    manifest: manifestJson,
    profiles: profilesJson.items,
    quotes: quotesJson.items,
    aShareFinancialSummaries: aShareFinancialSummariesJson.items,
    priceHistory: priceHistoryJson.items,
    research: researchJson.items,
    aShareAnnouncementSummaries: announcementSummariesJson.items,
    signals: signalsJson.items,
    sectorMembership: sectorMembershipJson.items,
  } as GeneratedRealDataBundle;
}
