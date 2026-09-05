from __future__ import annotations

from datetime import date
from typing import Literal, Protocol

from .models import ExchangeMarketObservation


Exchange = Literal["SSE", "SZSE", "BSE"]
BSE_LAUNCH_DATE = date(2021, 11, 15)


class ExchangeMarketAdapter(Protocol):
    """交易所官方市场统计 adapter 合同；R1 不承诺全历史实现。"""

    exchange: Exchange
    source_definition_id: str

    def collect(self, trade_date: date) -> ExchangeMarketObservation | None:
        """返回已验证口径 observation；源未准入或无数据时返回 None，禁止补 0。"""


def market_scope_exchanges(on_date: date | str) -> tuple[Exchange, ...]:
    if isinstance(on_date, str):
        on_date = date.fromisoformat(on_date)
    return ("SSE", "SZSE", "BSE") if on_date >= BSE_LAUNCH_DATE else ("SSE", "SZSE")


def structurally_unavailable_exchange_observation(
    *,
    exchange: Exchange,
    trade_date: date | str,
    source_definition_id: str,
) -> ExchangeMarketObservation:
    if isinstance(trade_date, str):
        trade_date = date.fromisoformat(trade_date)
    if exchange != "BSE" or trade_date >= BSE_LAUNCH_DATE:
        raise ValueError("STRUCTURALLY_UNAVAILABLE helper 当前仅适用于北交所成立前")
    return {
        "observationId": f"{exchange.lower()}-{trade_date.isoformat()}-structurally-unavailable",
        "exchange": exchange,
        "tradeDate": trade_date.isoformat(),
        "totalMarketCap": None,
        "negotiableMarketCap": None,
        "turnoverValue": None,
        "currency": "CNY",
        "sourceDefinitionId": source_definition_id,
        "releaseAvailableAt": None,
        "qualityStatus": "STRUCTURALLY_UNAVAILABLE",
    }
