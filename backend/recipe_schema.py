"""
Normalize recipe JSON from OpenAI so each ingredient has a Kroger-friendly search string.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple, Union

RECIPE_SYSTEM_JSON_RULES = (
    "Return a single JSON object with keys: name (string), ingredients (array), instructions (array). "
    "Each ingredient must be an object with: "
    '"name" (display text with amount context if needed), '
    '"amount" (string, e.g. "2 cups"), '
    '"krogerSearchQuery" (string): 2–6 words, grocery-shelf language only — '
    "what a shopper would type at Kroger (e.g. 'whole milk', 'large eggs', 'unsalted butter'). "
    "No quantities or units in krogerSearchQuery. No markdown, no code fences, JSON only."
)


def fallback_kroger_query_from_display(name: str) -> str:
    if not name or not isinstance(name, str):
        return ""
    s = name.strip()
    s = re.sub(r"^[\d./\s\-]+", "", s)
    s = re.sub(
        r"^(cups?|tablespoons?|teaspoons?|tbsp\.?|tsp\.?|ounces?|oz\.?|pounds?|lbs?\.?|grams?|g|kilograms?|kg|milliliters?|ml|liters?|l|quarts?|qt|pints?|pt|sticks?)\s+",
        "",
        s,
        flags=re.I,
    )
    s = re.sub(r"^[\d./\s\-]+", "", s)
    s = re.sub(r"\s*\([^)]*\)\s*", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:120] if s else name.strip()[:120]


def normalize_ingredient(ing: Any) -> Dict[str, str]:
    if not isinstance(ing, dict):
        t = str(ing or "").strip()
        return {
            "name": t,
            "amount": "",
            "krogerSearchQuery": fallback_kroger_query_from_display(t),
        }
    name = str(ing.get("name") or "").strip()
    amount = str(ing.get("amount") or "").strip()
    ksq = str(ing.get("krogerSearchQuery") or "").strip()
    if not ksq:
        ksq = fallback_kroger_query_from_display(name)
    return {"name": name, "amount": amount, "krogerSearchQuery": ksq}


def normalize_recipe_dict(recipe: Any) -> Dict[str, Any]:
    if not isinstance(recipe, dict):
        return {"name": "Recipe", "ingredients": [], "instructions": []}
    name = str(recipe.get("name") or "Recipe").strip() or "Recipe"
    raw_ing = recipe.get("ingredients") or []
    if not isinstance(raw_ing, list):
        raw_ing = []
    ingredients: List[Dict[str, str]] = []
    for x in raw_ing:
        if x:
            ingredients.append(normalize_ingredient(x))
    instructions = recipe.get("instructions") or []
    if not isinstance(instructions, list):
        instructions = []
    instructions = [str(x).strip() for x in instructions if str(x).strip()]
    return {"name": name, "ingredients": ingredients, "instructions": instructions}


def parse_search_upc_item(raw: Union[str, Dict[str, Any], None]) -> Tuple[Optional[str], str]:
    """
    Map request item to (search_term, label_for_errors).
    Supports legacy string-only items and objects with krogerSearchQuery.
    """
    if raw is None:
        return None, ""
    if isinstance(raw, dict):
        q = (
            raw.get("krogerSearchQuery")
            or raw.get("kroger_search_query")
            or raw.get("q")
            or raw.get("name")
            or ""
        )
        q = str(q).strip()
        label = str(raw.get("name") or q).strip() or q
        if not q:
            return None, label
        return q, label
    s = str(raw).strip()
    if not s:
        return None, ""
    return s, s
