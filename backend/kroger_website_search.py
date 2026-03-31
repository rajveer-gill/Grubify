"""
Resolve Kroger UPCs via www.kroger.com search HTML.

api.kroger.com/v1/products is blocked from cloud IPs (Akamai); the consumer site
is a separate origin and is typically fetchable from Render for server-side use.
"""
from __future__ import annotations

import json
import re
from typing import Any, Optional, Tuple

import requests

KROGER_BROWSER_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
    "Referer": "https://www.kroger.com/",
}


def _find_upc_in_obj(obj: Any, depth: int = 0) -> Optional[str]:
    if depth > 40:
        return None
    if isinstance(obj, dict):
        for k, v in obj.items():
            lk = str(k).lower()
            if lk in ("upc", "productupc", "product_upc") and isinstance(v, str):
                if v.isdigit() and 12 <= len(v) <= 14:
                    return v
            r = _find_upc_in_obj(v, depth + 1)
            if r:
                return r
    elif isinstance(obj, list):
        for item in obj:
            r = _find_upc_in_obj(item, depth + 1)
            if r:
                return r
    return None


def extract_first_upc_from_kroger_search_html(html: str) -> Optional[str]:
    if not html:
        return None

    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.+?)</script>',
        html,
        re.DOTALL,
    )
    if m:
        try:
            data = json.loads(m.group(1))
            upc = _find_upc_in_obj(data)
            if upc:
                return upc
        except (json.JSONDecodeError, ValueError):
            pass

    for pattern in (
        r'"upc"\s*:\s*"(\d{12,14})"',
        r'"upc"\s*:\s*(\d{12,14})\b',
        r'"productUpc"\s*:\s*"(\d{12,14})"',
    ):
        m2 = re.search(pattern, html)
        if m2:
            return m2.group(1)

    return None


def search_upc_via_kroger_website(term: str, timeout: int = 30) -> Tuple[Optional[str], int, str]:
    """
    GET Kroger consumer search page; parse first UPC from embedded JSON/HTML.

    Returns (upc_or_none, http_status, detail_tag).
    detail_tag is 'ok', 'no_upc_in_page', or 'request_error:...'
    """
    term = (term or "").strip()
    if not term:
        return None, 0, "empty_term"

    url = "https://www.kroger.com/search"
    # Separate connect vs read: Kroger often accepts the TCP connection but is slow to
    # send the full HTML (especially from cloud IPs or under parallel load).
    connect_s = min(20, max(5, timeout // 3))
    timeout_tuple = (connect_s, timeout)
    try:
        r = requests.get(
            url,
            params={"query": term},
            headers=KROGER_BROWSER_HEADERS,
            timeout=timeout_tuple,
        )
    except requests.RequestException as e:
        return None, 0, f"request_error:{str(e)[:120]}"

    print(f"[search-upcs] Kroger.com web search '{term}': HTTP {r.status_code}")

    if r.status_code != 200:
        return None, r.status_code, "non_200"

    upc = extract_first_upc_from_kroger_search_html(r.text)
    if not upc:
        return None, r.status_code, "no_upc_in_page"

    return upc, r.status_code, "ok"
