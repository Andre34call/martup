"""Just click Skip on the onboarding and see what screen we land on."""
from playwright.sync_api import sync_playwright

BASE = "https://martup-seven.vercel.app"
OUT = "/home/z/my-project/test-screenshots"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    pg = ctx.new_page()

    api_calls = []
    pg.on("request", lambda r: api_calls.append((r.method, r.url)) if "/api/" in r.url else None)

    pg.goto(BASE + "/", wait_until="networkidle", timeout=45000)
    pg.wait_for_timeout(2000)
    pg.screenshot(path=f"{OUT}/step-1-initial.png", full_page=True)
    print("=== STEP 1: initial body text ===")
    print(pg.evaluate("document.body.innerText || ''")[:400])

    # Just click Skip
    try:
        skip = pg.get_by_role("button", name="Skip").first
        skip.click(timeout=3000)
        pg.wait_for_timeout(2500)
    except Exception as e:
        print("Skip click failed:", e)

    pg.screenshot(path=f"{OUT}/step-2-after-skip.png", full_page=True)
    print("\n=== STEP 2: body text after Skip ===")
    print(pg.evaluate("document.body.innerText || ''")[:600])

    print("\n=== buttons after skip ===")
    for b_ in pg.locator("button").all()[:20]:
        try:
            t = b_.inner_text(timeout=300).replace("\n", " ")
            print(f"  btn: {t[:80]!r}")
        except Exception:
            pass

    print("\n=== anchors after skip ===")
    for a_ in pg.locator("a").all()[:20]:
        try:
            href = a_.get_attribute("href")
            t = a_.inner_text(timeout=300).replace("\n", " ")
            print(f"  a: href={href!r} text={t[:60]!r}")
        except Exception:
            pass

    print("\n=== imgs after skip ===")
    for i_ in pg.locator("img").all()[:20]:
        try:
            src = i_.get_attribute("src")
            print(f"  img: {(src or '')[:80]!r}")
        except Exception:
            pass

    print("\n=== api calls ===")
    for m, u in api_calls:
        print(f"  {m} {u}")

    ctx.close()
    b.close()
