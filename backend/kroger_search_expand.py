"""
When Kroger consumer search returns no UPC, ask OpenAI for shorter alternative queries.
UPCs always come from Kroger HTML — the model only suggests search text.
"""
from __future__ import annotations

import json
import os
from typing import List

import requests


def expand_kroger_search_terms(original_term: str, max_alternatives: int = 2) -> List[str]:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    original_term = (original_term or "").strip()
    if not key or not original_term:
        return []

    user = (
        f'Kroger website product search failed for: "{original_term}". '
        f"Suggest {max_alternatives} shorter alternative grocery search phrases "
        "(generic product words; no recipe prep like diced/minced; avoid brand names unless essential). "
        'Return JSON: {"alternatives": ["phrase1", "phrase2"]}'
    )
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You output only valid JSON with an 'alternatives' array of short strings.",
                    },
                    {"role": "user", "content": user},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            },
            timeout=25,
        )
        if r.status_code != 200:
            print(f"[search-upcs] expand_kroger_search_terms HTTP {r.status_code}")
            return []
        text = r.json()["choices"][0]["message"]["content"]
        data = json.loads(text)
        alts = data.get("alternatives") or []
        out: List[str] = []
        seen = {original_term.lower()}
        for a in alts:
            if not isinstance(a, str):
                continue
            t = a.strip()[:120]
            if not t or t.lower() in seen:
                continue
            seen.add(t.lower())
            out.append(t)
            if len(out) >= max_alternatives:
                break
        return out
    except Exception as e:
        print(f"[search-upcs] expand_kroger_search_terms: {e}")
        return []
