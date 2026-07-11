"""A-share financial provider V1."""

from .core import build_company_record, validate_dataset
from .provider import SinaFinancialProvider

__all__ = ["SinaFinancialProvider", "build_company_record", "validate_dataset"]
