"""Dump rendered DOM + screenshot for analysis."""
from playwright.sync_api import sync_playwright
from pathlib import Path

BASE = "https://martup-seven.vercel.app"
OUT = Path("/home/z/my-project/test-screenshots")
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    pg = ctx.new_page()
    pg.goto(BASE + "/", wait_until="networkidle", timeout=45000)
    pg.wait_for_timeout(3500)  # Give SPA more time

    html = pg.content()
    Path("/tmp/prod-rendered.html").write_text(html)
    print("rendered html bytes:", len(html))

    # Tag counts
    for sel in ["header", "nav", "footer", "main", "section", "article", "a", "img",
                "button", "[data-testid]", "[data-product-id]",
                "a[href*='screen=']", "a[href*='product']"]:
        try:
            n = pg.locator(sel).count()
            print(f"  {sel}: {n}")
        except Exception as e:
            print(f"  {sel}: ERR {e}")

    # dump all links
    hrefs = pg.eval_on_selector_all("a", "els => els.map(e => e.getAttribute('href'))")
    print("\n--- first 30 link hrefs ---")
    for h in (hrefs or [])[:30]:
        print(" ", h)

    # screenshot
    pg.screenshot(path=str(OUT / "prod-desktop-home.png"), full_page=True)

    # Click any visible anchor that has screen= in href
    print("\n--- attempting to click first a[href*='screen='] ---")
    links = pg.locator("a[href*='screen=']")
    if links.count() > 0:
        first = links.nth(0)
        href = first.get_attribute("href")
        print("first link href:", href)
        first.click(timeout=4000)
        pg.wait_for_timeout(2000)
        print("url after click:", pg.url)
        pg.screenshot(path=str(OUT / "prod-desktop-spa-nav.png"), full_page=True)
    else:
        print("no links found")

    ctx.close()
    b.close()
