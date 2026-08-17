#!/usr/bin/env python3
"""
Normaliza export do Apify Instagram Profile Scraper.

Uso:
  python3 scripts/normalize-instagram-profiles.py \\
    --input ~/Downloads/lote1.json \\
    --output ~/Downloads/lote1-normalizado.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
WA_URL_RE = re.compile(
    r"(?:https?://)?(?:wa\.me/|api\.whatsapp\.com/send/?\?[^\"'\s]*|chat\.whatsapp\.com/[A-Za-z0-9]+)",
    re.I,
)
PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?55[\s.\-]*)?(?:\(?\d{2}\)?[\s.\-]*)?(?:9[\s.\-]*)?\d{4}[\s.\-]?\d{4}(?!\d)"
)
LINKTREE_HOSTS = {"linktr.ee", "linktree.com", "lnk.bio"}


def load_items(path: Path) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in ("items", "data", "results"):
            if isinstance(raw.get(key), list):
                return raw[key]
    raise ValueError(f"JSON inesperado em {path}")


def uniq(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        key = value.strip()
        if not key:
            continue
        low = key.lower()
        if low in seen:
            continue
        seen.add(low)
        out.append(key)
    return out


def collect_urls(item: dict) -> list[str]:
    urls: list[str] = []
    for key in ("externalUrl", "url"):
        value = item.get(key)
        if isinstance(value, str) and value.startswith("http"):
            # profile url is not a bio link; skip later
            urls.append(value)
    for entry in item.get("externalUrls") or []:
        if isinstance(entry, dict) and entry.get("url"):
            urls.append(str(entry["url"]))
        elif isinstance(entry, str):
            urls.append(entry)
    # URLs written inside biography
    bio = item.get("biography") or ""
    urls.extend(re.findall(r"https?://[^\s)>\]]+", bio))
    urls.extend(re.findall(r"(?:^|\s)((?:wa\.me|linktr\.ee)/[^\s)>\]]+)", bio, flags=re.I))
    cleaned: list[str] = []
    for url in urls:
        url = url.strip().rstrip(".,);]")
        if url.startswith("wa.me/") or url.startswith("linktr.ee/"):
            url = "https://" + url
        cleaned.append(url)
    return uniq(cleaned)


def host_of(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""


def normalize_phone_digits(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    if digits.startswith("55") and len(digits) in (12, 13):
        return digits
    if len(digits) in (10, 11):
        return "55" + digits
    return digits


def format_phone_br(digits: str) -> str:
    if digits.startswith("55") and len(digits) == 13:
        return f"+55 {digits[2:4]} {digits[4:9]}-{digits[9:]}"
    if digits.startswith("55") and len(digits) == 12:
        return f"+55 {digits[2:4]} {digits[4:8]}-{digits[8:]}"
    if digits:
        return f"+{digits}"
    return ""


def extract_whatsapp(bio: str, urls: list[str]) -> tuple[list[str], list[str], list[str]]:
    links: list[str] = []
    phones: list[str] = []
    groups: list[str] = []

    for url in urls:
        low = url.lower()
        if "chat.whatsapp.com" in low:
            groups.append(url)
            continue
        if "wa.me" in low or "api.whatsapp.com" in low or "whatsapp.com/send" in low:
            links.append(url)
            parsed = urlparse(url if "://" in url else "https://" + url)
            if "wa.me" in parsed.netloc:
                phone = normalize_phone_digits(unquote(parsed.path.lstrip("/").split("?")[0]))
                if phone:
                    phones.append(phone)
            qs = parse_qs(parsed.query)
            if "phone" in qs:
                phone = normalize_phone_digits(qs["phone"][0])
                if phone:
                    phones.append(phone)

    for match in WA_URL_RE.findall(bio or ""):
        links.append(match if match.startswith("http") else "https://" + match)

    # phones written in bio, only if WhatsApp is mentioned or there is already a WA link
    bio_l = (bio or "").lower()
    mention_wa = "whatsapp" in bio_l or "whats" in bio_l or "zap" in bio_l or bool(links)
    if mention_wa:
        for match in PHONE_RE.findall(bio or ""):
            phone = normalize_phone_digits(match)
            if 12 <= len(phone) <= 13:
                phones.append(phone)

    return uniq(links), uniq(phones), uniq(groups)


def extract_emails(bio: str, urls: list[str]) -> list[str]:
    found = EMAIL_RE.findall(bio or "")
    for url in urls:
        found.extend(EMAIL_RE.findall(url))
        # mailto:
        if url.lower().startswith("mailto:"):
            found.append(url.split(":", 1)[1])
    # drop obvious false positives from domains
    clean = []
    for email in found:
        low = email.lower()
        if low.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
            continue
        if "instagram.com" in low:
            continue
        clean.append(email)
    return uniq(clean)


def extract_linktree(urls: list[str], bio: str) -> list[str]:
    found = []
    for url in urls:
        host = host_of(url)
        if host in LINKTREE_HOSTS or "linktr.ee" in url.lower():
            found.append(url if url.startswith("http") else "https://" + url)
    for match in re.findall(r"(?:https?://)?linktr\.ee/[A-Za-z0-9._~\-/%]+", bio or "", flags=re.I):
        found.append(match if match.startswith("http") else "https://" + match)
    return uniq(found)


def classify_other_links(urls: list[str], linktree: list[str], whatsapp_links: list[str]) -> list[str]:
    skip = {u.lower() for u in linktree + whatsapp_links}
    out = []
    for url in urls:
        low = url.lower()
        if low in skip:
            continue
        host = host_of(url)
        if host in {"instagram.com", "l.instagram.com"}:
            continue
        if "chat.whatsapp.com" in low or "wa.me" in low or "api.whatsapp.com" in low:
            continue
        if host in LINKTREE_HOSTS:
            continue
        out.append(url)
    return uniq(out)


def status_of(item: dict) -> str:
    err = item.get("error") or item.get("errorDescription") or item.get("errorMessage")
    if err:
        return str(err)
    if not item.get("username"):
        return "sem_username"
    if item.get("private") is True:
        return "privado"
    return "ok"


def join_field(values: list[str]) -> str:
    return " | ".join(values)


def normalize_item(item: dict) -> dict:
    bio = item.get("biography") or ""
    urls = collect_urls(item)
    # remove the profile page itself from "bio links"
    profile_url = (item.get("url") or "").rstrip("/").lower()
    urls = [u for u in urls if u.rstrip("/").lower() != profile_url]

    emails = extract_emails(bio, urls)
    wa_links, wa_phones, wa_groups = extract_whatsapp(bio, urls)
    linktree = extract_linktree(urls, bio)
    other_links = classify_other_links(urls, linktree, wa_links + wa_groups)

    external_url = item.get("externalUrl") or ""
    if not external_url and item.get("externalUrls"):
        first = item["externalUrls"][0]
        if isinstance(first, dict):
            external_url = first.get("url") or ""
        elif isinstance(first, str):
            external_url = first

    return {
        "username": item.get("username") or "",
        "full_name": item.get("fullName") or "",
        "profile_url": item.get("url") or "",
        "input_url": item.get("inputUrl") or "",
        "status": status_of(item),
        "biography": bio.replace("\r\n", "\n").replace("\r", "\n"),
        "email": join_field(emails),
        "tem_email": "sim" if emails else "nao",
        "whatsapp": join_field([format_phone_br(p) for p in wa_phones]),
        "whatsapp_e164": join_field([f"+{p}" for p in wa_phones]),
        "whatsapp_links": join_field(wa_links),
        "whatsapp_grupos": join_field(wa_groups),
        "tem_whatsapp": "sim" if (wa_phones or wa_links) else "nao",
        "linktree": join_field(linktree),
        "tem_linktree": "sim" if linktree else "nao",
        "external_url": external_url,
        "outros_links": join_field(other_links),
        "followers_count": item.get("followersCount", ""),
        "follows_count": item.get("followsCount", ""),
        "posts_count": item.get("postsCount", ""),
        "igtv_video_count": item.get("igtvVideoCount", ""),
        "highlight_reel_count": item.get("highlightReelCount", ""),
        "verified": item.get("verified", ""),
        "private": item.get("private", ""),
        "is_business_account": item.get("isBusinessAccount", ""),
        "business_category": item.get("businessCategoryName") or "",
        "joined_recently": item.get("joinedRecently", ""),
        "instagram_id": item.get("id") or "",
        "fbid": item.get("fbid") or "",
        "profile_pic_url": item.get("profilePicUrlHD") or item.get("profilePicUrl") or "",
    }


COLUMNS = [
    "username",
    "full_name",
    "status",
    "biography",
    "email",
    "tem_email",
    "whatsapp",
    "whatsapp_e164",
    "whatsapp_links",
    "whatsapp_grupos",
    "tem_whatsapp",
    "linktree",
    "tem_linktree",
    "external_url",
    "outros_links",
    "followers_count",
    "follows_count",
    "posts_count",
    "igtv_video_count",
    "highlight_reel_count",
    "verified",
    "private",
    "is_business_account",
    "business_category",
    "joined_recently",
    "profile_url",
    "input_url",
    "instagram_id",
    "fbid",
    "profile_pic_url",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Normaliza perfis Instagram do Apify")
    parser.add_argument("--input", "-i", required=True, help="JSON do Apify (lista de perfis)")
    parser.add_argument("--output", "-o", required=True, help="CSV de saída")
    args = parser.parse_args()

    items = load_items(Path(args.input))
    rows = [normalize_item(item) for item in items]

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    total = len(rows)
    ok = sum(1 for r in rows if r["status"] == "ok")
    email = sum(1 for r in rows if r["tem_email"] == "sim")
    wa = sum(1 for r in rows if r["tem_whatsapp"] == "sim")
    lt = sum(1 for r in rows if r["tem_linktree"] == "sim")
    print(f"gravado: {out}")
    print(f"total={total} ok={ok} email={email} whatsapp={wa} linktree={lt}")


if __name__ == "__main__":
    main()
