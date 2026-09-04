from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

NUMBER = r"[0-9]+(?:[.,][0-9]+)?"
FORMULA_PATTERN = re.compile(rf"^=\(\s*(?P<scores>{NUMBER}(?:\s*\+\s*{NUMBER})+)\s*\)\s*/\s*(?P<denominator>\d+)(?P<suffix>(?:\s*[+-]\s*{NUMBER})*)\s*$")
SUFFIX_TERM_PATTERN = re.compile(rf"(?P<operator>[+-])\s*(?P<value>{NUMBER})")


class PreFormulaError(ValueError):
    pass


def parse_pre_formula(formula: str) -> tuple[list[Decimal], int, str]:
    match = FORMULA_PATTERN.match(formula.strip())
    if match is None:
        raise PreFormulaError("PRE formula must use the legacy =(score+score)/count pattern.")
    try:
        scores = [Decimal(value.strip().replace(",", ".")) for value in match.group("scores").split("+")]
    except InvalidOperation as error:
        raise PreFormulaError("PRE formula contains an invalid score.") from error
    denominator = int(match.group("denominator"))
    if any(score < 0 or score > 10 for score in scores):
        raise PreFormulaError("PRE formula scores must be between 0 and 10.")
    return scores, denominator, match.group("suffix").replace(" ", "")


def legacy_adjustment_value(suffix: str) -> Decimal:
    """Return the observed post-average adjustment without applying it to ratings."""
    try:
        return sum(
            (Decimal(term.group("value").replace(",", ".")) if term.group("operator") == "+" else -Decimal(term.group("value").replace(",", ".")))
            for term in SUFFIX_TERM_PATTERN.finditer(suffix)
        )
    except InvalidOperation as error:
        raise PreFormulaError("PRE formula contains an invalid legacy adjustment.") from error
