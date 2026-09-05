"""Try direct screen with extended wait."""
from playwright.sync_api import sync_playwright
from pathlib import Path

BASE = "https://martup-seven.vercel.app"
OUT = Path("/home/z/my-project/test-screenshots")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    pg = ctx.new_page()
    api_calls = []
    pg.on("request", lambda r: api_calls.append((r.method, r.url)) if "/api/" in r.url else None)

    # Bypass onboarding by going directly to a screen with a query string
    pg.goto(f"{BASE}/?screen=home", wait_until="networkidle", timeout=45000)
    pg.wait_for_timeout(5000)  # Wait long for SPA to settle

    pg.screenshot(path=str(OUT / "prod-direct-home.png"), full_page=True)

    print("=== body text ===")
    print(pg.evaluate("document.body.innerText || ''")[:2000])
    print("\n=== buttons (count={}) ===".format(pg.locator("button").count()))
    for b_ in pg.locator("button").all()[:40]:
        try:
            t = b_.inner_text(timeout=200).replace("\n", " ")
            print(f"  btn: {t[:80]!r}")
        except Exception:
            pass

    print("\n=== anchors (count={}) ===".format(pg.locator("a").count()))
    for a_ in pg.locator("a").all()[:40]:
        try:
            href = a_.get_attribute("href")
            t = a_.inner_text(timeout=200).replace("\n", " ")
            print(f"  a: href={href!r} text={t[:60]!r}")
        except Exception:
            pass

    print("\n=== imgs (count={}) ===".format(pg.locator("img").count()))
    for i_ in pg.locator("img").all()[:20]:
        try:
            src = i_.get_attribute("src")
            print(f"  img: {(src or '')[:80]!r}")
        except Exception:
            pass

    print("\n=== header/footer counts ===")
    print("header:", pg.locator("header").count())
    print("footer:", pg.locator("footer").count())
    print("nav:", pg.locator("nav").count())

    print("\n=== api calls ===")
    for m, u in api_calls:
        print(f"  {m} {u}")

    ctx.close()
    b.close()
