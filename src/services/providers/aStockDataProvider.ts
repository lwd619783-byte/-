import manifestJson from "../../data/real/data-manifest.generated.json";
import announcementsJson from "../../data/real/announcements.generated.json";
import financialsJson from "../../data/real/financials.generated.json";
import aShareFinancialsJson from "../../data/real/a-share-financials.generated.json";
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
    financials: financialsJson.items,
    aShareFinancials: aShareFinancialsJson.items,
    priceHistory: priceHistoryJson.items,
    research: researchJson.items,
    announcements: announcementsJson.items,
    signals: signalsJson.items,
    sectorMembership: sectorMembershipJson.items,
  } as GeneratedRealDataBundle;
}
