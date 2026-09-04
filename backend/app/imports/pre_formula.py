from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

FORMULA_PATTERN = re.compile(r"^=\(\s*(?P<scores>[0-9]+(?:[.,][0-9]+)?(?:\s*\+\s*[0-9]+(?:[.,][0-9]+)?)+)\s*\)\s*/\s*(?P<denominator>\d+)\s*$")


class PreFormulaError(ValueError):
    pass


def parse_pre_formula(formula: str) -> tuple[list[Decimal], int]:
    match = FORMULA_PATTERN.match(formula.strip())
    if match is None:
        raise PreFormulaError("PRE formula must use the legacy =(score+score)/count pattern.")
    try:
        scores = [Decimal(value.strip().replace(",", ".")) for value in match.group("scores").split("+")]
    except InvalidOperation as error:
        raise PreFormulaError("PRE formula contains an invalid score.") from error
    denominator = int(match.group("denominator"))
    if denominator <= 0 or len(scores) != denominator:
        raise PreFormulaError("PRE formula operand count must match its denominator.")
    if any(score < 0 or score > 10 for score in scores):
        raise PreFormulaError("PRE formula scores must be between 0 and 10.")
    return scores, denominator
