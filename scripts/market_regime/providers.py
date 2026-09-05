from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .models import MetricObservationVintage, SourceStatus


class ProviderNotAdmittedError(RuntimeError):
    pass


class HistoricalMetricProvider(Protocol):
    provider_id: str
    metric_id: str
    status: SourceStatus

    def collect(self) -> list[MetricObservationVintage]:
        """只返回已通过 source contract 的 observation vintages。"""


@dataclass(frozen=True)
class Csi300HistoricalTtmPeProviderSlot:
    provider_id: str = "csi300-historical-ttm-pe"
    metric_id: str = "VAL_CSI300_TTM_PE"
    status: SourceStatus = SourceStatus.NO_GO
    evidence_summary: str = (
        "官方 factsheet 能证明滚动 PE 字段，但未证明 2005 至今可自动化、连续的官方历史序列。"
    )

    def collect(self) -> list[MetricObservationVintage]:
        raise ProviderNotAdmittedError(
            "CSI 300 历史 TTM PE Provider 为 NO_GO；不得以未批准第三方序列填充 strict PIT catalog"
        )
