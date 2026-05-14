import asyncio
import logging
from typing import List, Optional
import aiohttp
from app.services.threat_service import create_threat
from app.models.threat import Threat
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
import json
from datetime import datetime, timezone
import os

logger = logging.getLogger("app.services.scraper")


NVD_API_KEY = os.getenv("NVD_API_KEY")
# enable debug mode to bypass dedupe and emit extra logs during development
SCRAPER_DEBUG = True
logger.info(f"NVD KEY LOADED: {bool(NVD_API_KEY)} | SCRAPER_DEBUG={SCRAPER_DEBUG}")
# Data sources (real)
# NVD JSON feeds (recent CVE) - example: last modified feed; NVD provides JSON files per year and modified
NVD_RECENT = "https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20"
# MITRE CVE RSS (if available) - use NVD primarily
MITRE_CVE_RSS = "https://cve.mitre.org/data/downloads/allitems.csv"  # note: MITRE provides CSV/HTML; may need parsing
# The Hacker News security feed
HACKER_NEWS_RSS = "https://thehackernews.com/feeds/posts/default"
# SecurityWeek feed
SECURITYWEEK_RSS = "https://www.securityweek.com/feed"

FEEDS = [NVD_RECENT, HACKER_NEWS_RSS, SECURITYWEEK_RSS]

# severity mapping helper
def map_severity(cvss_severity: Optional[str] = None, score: Optional[float] = None) -> str:
    if cvss_severity:
        s = cvss_severity.capitalize()
        if s in ("Critical", "High", "Medium", "Low"):
            return s
    if score is not None:
        try:
            sc = float(score)
            if sc >= 9.0:
                return 'Critical'
            if sc >= 7.0:
                return 'High'
            if sc >= 4.0:
                return 'Medium'
            return 'Low'
        except Exception:
            pass
    return 'Medium'

# tagging
KEY_TAGS = ['ransomware','phishing','exploit','xss','rce','sql','cve','malware','vulnerability','zero-day']

def extract_tags(text: str) -> List[str]:
    t = text.lower() if text else ''
    tags = []
    for k in KEY_TAGS:
        if k in t:
            tags.append(k)
    return tags

async def fetch_json(session: aiohttp.ClientSession, url: str) -> dict:
    headers = { 'User-Agent': 'Athena-Sentinel-Scraper/1.0 (+https://example.local)' }
    try:
        async with session.get(url, timeout=30, headers=headers) as resp:
            if resp.status != 200:
                logger.warning('Non-200 from %s: %s', url, resp.status)
                return {}
            return await resp.json()
    except Exception as e:
        logger.exception('Failed JSON fetch %s: %s', url, e)
        return {}

async def fetch_text(session: aiohttp.ClientSession, url: str) -> str:
    headers = { 'User-Agent': 'Athena-Sentinel-Scraper/1.0 (+https://example.local)' }
    try:
        async with session.get(url, timeout=30, headers=headers) as resp:
            if resp.status != 200:
                logger.warning('Non-200 from %s: %s', url, resp.status)
                return ''
            return await resp.text()
    except Exception as e:
        logger.exception('Failed text fetch %s: %s', url, e)
        return ''

async def process_nvd(session: aiohttp.ClientSession, db, counters: dict | None = None) -> List[dict]:
    created = []
    if counters is None:
        counters = { 'inserted': 0, 'updated': 0 }

    headers = {
        "apiKey": NVD_API_KEY,
        "User-Agent": "Athena-Sentinel-Scraper/1.0"
    }

    logger.info(f"NVD KEY PRESENT: {bool(NVD_API_KEY)}")
    try:
        async with session.get(NVD_RECENT, headers=headers, timeout=30) as resp:
            # debug log status and body for troubleshooting (403, rate-limited, malformed responses)
            if resp.status != 200:
                logger.warning(f"NVD STATUS: {resp.status}")
                try:
                    body = await resp.text()
                    logger.warning(f"NVD BODY: {body}")
                except Exception:
                    logger.exception("Failed to read NVD response body")
                return []

            try:
                data = await resp.json()
            except Exception:
                # if JSON parsing fails, log the raw text for debugging
                body = await resp.text()
                logger.warning("NVD JSON parse failed, body: %s", body)
                return []
    except Exception as e:
        logger.exception("NVD request failed: %s", e)
        return []

    # v2 API returns 'vulnerabilities' top-level list
    cves = data.get('vulnerabilities', [])

    for item in cves:
        try:
            cve = item.get('cve', {})
            cve_id = cve.get('id')
            descriptions = cve.get('descriptions', []) or []
            desc = descriptions[0].get('value', '') if descriptions else ''

            if not cve_id or not desc:
                continue

            # skip junk/demo
            if 'demo' in desc.lower():
                continue

            impact = item.get('impact', {})
            baseMetricV3 = impact.get('baseMetricV3')

            score = None
            severity = None

            if baseMetricV3:
                cvssv3 = baseMetricV3.get('cvssV3', {})
                score = cvssv3.get('baseScore')
                severity = cvssv3.get('baseSeverity')

            severity = map_severity(severity, score)

            tags = extract_tags(desc + " " + cve_id)

            url = f"https://nvd.nist.gov/vuln/detail/{cve_id}"

            # dedupe
            q = await db.execute(select(Threat).where(Threat.external_id == cve_id))
            existing = q.scalars().first()

            if existing:
                if SCRAPER_DEBUG:
                    logger.debug('SCRAPER_DEBUG: skipping dedupe for existing CVE %s', cve_id)
                    # in debug mode we allow inserts to verify ingestion, so do not continue
                else:
                    # attempt a lightweight update if fields changed
                    changed = False
                    if existing.title != cve_id:
                        existing.title = cve_id
                        changed = True
                    # limit description size
                    new_desc = desc[:2000]
                    if existing.description != new_desc:
                        existing.description = new_desc
                        changed = True
                    if existing.severity != severity:
                        existing.severity = severity
                        changed = True
                    if existing.source != 'NVD':
                        existing.source = 'NVD'
                        changed = True
                    if existing.url != url:
                        existing.url = url
                        changed = True
                    if existing.tags != tags:
                        existing.tags = tags
                        changed = True
                    if changed:
                        try:
                            await db.commit()
                            counters['updated'] = counters.get('updated', 0) + 1
                            logger.info('Updated existing CVE %s', cve_id)
                        except Exception as e:
                            logger.exception('Failed to update existing CVE %s: %s', cve_id, e)
                            try:
                                await db.rollback()
                            except Exception:
                                pass
                continue

            t = await create_threat(
                db,
                title=cve_id,
                description=desc[:2000],
                type_="CVE",
                severity=severity,
                source="NVD",
                tags=tags,
                external_id=cve_id,
                source_url=url
            )

            created.append({
                "id": t.id,
                "external_id": cve_id
            })
            counters['inserted'] = counters.get('inserted', 0) + 1

        except Exception as e:
            logger.exception("Error processing CVE item: %s", e)
            try:
                await db.rollback()
            except Exception:
                pass

    return created
async def process_rss(session: aiohttp.ClientSession, db, url: str, counters: dict | None = None) -> List[dict]:
    created = []
    if counters is None:
        counters = { 'inserted': 0, 'updated': 0 }
    text = await fetch_text(session, url)
    # simple entry parse using feedparser
    try:
        import feedparser
        parsed = feedparser.parse(text)
        entries = parsed.get('entries', [])
        for e in entries[:20]:
            title = e.get('title')
            summary = e.get('summary') or e.get('description') or ''
            link = e.get('link')
            # skip demo-like entries
            if title and 'demo' in title.lower():
                continue
            if summary and 'demo' in summary.lower():
                continue
            tags = extract_tags(title + ' ' + summary)
            # dedupe by URL
            if link:
                q = await db.execute(select(Threat).where(Threat.url == link))
                existing = q.scalars().first()
                if existing:
                    # update if content changed
                    changed = False
                    if existing.title != (title or '')[:250]:
                        existing.title = (title or '')[:250]
                        changed = True
                    new_desc = (summary or '')[:2000]
                    if existing.description != new_desc:
                        existing.description = new_desc
                        changed = True
                    if existing.tags != tags:
                        existing.tags = tags
                        changed = True
                    if changed:
                        try:
                            await db.commit()
                            counters['updated'] = counters.get('updated', 0) + 1
                            logger.info('Updated existing feed item %s', link)
                        except Exception as e:
                            logger.exception('Failed to update existing feed item %s: %s', link, e)
                            try:
                                await db.rollback()
                            except Exception:
                                pass
                    continue
            severity = 'Medium'
            type_ = 'News'
            t = await create_threat(db, title=(title or '')[:250], description=(summary or '')[:2000], type_=type_, severity=severity, source=url, tags=tags, source_url=link)
            created.append({'id': t.id, 'url': link})
            counters['inserted'] = counters.get('inserted', 0) + 1
    except Exception as e:
        logger.exception('RSS processing failed for %s: %s', url, e)
        try:
            await db.rollback()
        except Exception:
            pass
    return created

async def scrape_once() -> List[dict]:
    created = []
    counters = { 'inserted': 0, 'updated': 0 }
    logger.info('SCRAPER CYCLE START')
    async with AsyncSessionLocal() as db:
        async with aiohttp.ClientSession() as session:
            # process NVD
            try:
                n = await process_nvd(session, db, counters=counters)
                created.extend(n)
            except Exception as e:
                logger.exception('NVD processing failed: %s', e)
            # process RSS feeds
            for url in [HACKER_NEWS_RSS, SECURITYWEEK_RSS]:
                try:
                    r = await process_rss(session, db, url, counters=counters)
                    created.extend(r)
                except Exception as e:
                    logger.exception('RSS feed failed %s: %s', url, e)
            # polite sleep to respect rate limits
            await asyncio.sleep(1)
    if created:
        logger.info('Scraper created %d new items', len(created))
    # log inserted/updated summary
    logger.info("SCRAPER CYCLE COMPLETE: inserted=%s updated=%s", counters.get('inserted', 0), counters.get('updated', 0))
    return created

async def scraper_loop(interval: int = 60):
    logger.info('Starting scraper loop (interval=%s)', interval)
    try:
        while True:
            try:
                await scrape_once()
            except Exception as e:
                logger.exception('Scrape iteration failed: %s', e)
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info('Scraper loop cancelled')
        raise
