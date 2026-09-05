"""Deep inspection of MartUp app state."""
from playwright.sync_api import sync_playwright
from pathlib import Path

BASE = "https://martup-seven.vercel.app"
OUT = Path("/home/z/my-project/test-screenshots")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    pg = ctx.new_page()
    pg.goto(BASE + "/", wait_until="networkidle", timeout=45000)
    pg.wait_for_timeout(2000)

    # Collect network requests to see what API is called
    api_calls = []
    pg.on("request", lambda r: api_calls.append(r.url) if "/api/" in r.url else None)

    # Dismiss onboarding fully
    for _ in range(6):
        clicked = False
        for label in ["Skip", "Lewati", "Next", "Selanjutnya", "Mulai", "Get Started", "Masuk"]:
            try:
                loc = pg.get_by_role("button", name=label).first
                if loc.is_visible(timeout=400):
                    loc.click(timeout=1500)
                    pg.wait_for_timeout(500)
                    clicked = True
                    break
            except Exception:
                pass
        if not clicked:
            break

    pg.wait_for_timeout(3500)

    # Print all visible buttons + links + their text
    print("=== all buttons ===")
    btns = pg.locator("button").all()
    for b_ in btns[:30]:
        try:
            txt = b_.inner_text(timeout=500).replace("\n", " ")
            vis = b_.is_visible(timeout=200)
            print(f"  [{'V' if vis else ' '}] {txt[:80]!r}")
        except Exception:
            pass

    print("\n=== all anchors ===")
    for a_ in pg.locator("a").all()[:30]:
        try:
            href = a_.get_attribute("href")
            txt = a_.inner_text(timeout=500).replace("\n", " ")
            vis = a_.is_visible(timeout=200)
            print(f"  [{'V' if vis else ' '}] href={href!r} text={txt[:60]!r}")
        except Exception:
            pass

    print("\n=== all img ===")
    for i_ in pg.locator("img").all()[:30]:
        try:
            src = i_.get_attribute("src")
            vis = i_.is_visible(timeout=200)
            print(f"  [{'V' if vis else ' '}] src={(src or '')[:80]!r}")
        except Exception:
            pass

    print("\n=== body text (first 1500 chars) ===")
    t = pg.evaluate("document.body.innerText || ''")
    print(t[:1500])

    print("\n=== api calls observed ===")
    for u in api_calls:
        print(" ", u)

    pg.screenshot(path=str(OUT / "prod-desktop-debug.png"), full_page=True)
    Path("/tmp/prod-debug.html").write_text(pg.content())

    ctx.close()
    b.close()
