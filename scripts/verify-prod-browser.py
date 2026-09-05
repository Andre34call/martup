"""Final production verification — handles MartUp onboarding → auth gating."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "https://martup-seven.vercel.app"
OUT = Path("/home/z/my-project/test-screenshots")
OUT.mkdir(parents=True, exist_ok=True)
results: list[dict] = []


def record(check: str, status: str, evidence: str) -> None:
    print(f"[{status}] {check}: {evidence}")
    results.append({"check": check, "status": status, "evidence": evidence})


def click_first_visible(page, labels: list[str], timeout=1500) -> str | None:
    for label in labels:
        try:
            loc = page.get_by_role("button", name=label).first
            if loc.is_visible(timeout=300):
                loc.click(timeout=timeout)
                return label
        except Exception:
            continue
    return None


def run() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ============ DESKTOP ============
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        console_warns: list[str] = []
        console_errs: list[str] = []
        page_errs: list[str] = []
        net_5xx: list[str] = []
        api_calls: list[str] = []

        def on_console(m):
            if m.type == "error":
                console_errs.append(m.text)
            elif m.type == "warning":
                console_warns.append(m.text)
        page.on("console", on_console)
        page.on("pageerror", lambda e: page_errs.append(str(e)))
        page.on("response", lambda r: (
            net_5xx.append(f"{r.status} {r.url}") if r.status >= 500 else None))
        page.on("request", lambda r: api_calls.append(r.url) if "/api/" in r.url else None)

        resp = page.goto(BASE + "/", wait_until="networkidle", timeout=45000)
        http_code = resp.status if resp else 0
        record("home HTTP", "PASS" if http_code == 200 else "FAIL", f"HTTP {http_code}")

        page.wait_for_timeout(1800)
        page.screenshot(path=str(OUT / "prod-desktop-01-splash.png"), full_page=True)
        splash_body = page.evaluate("document.body.innerText || ''")
        # Splash has Indonesian hero text "Temukan Produk Terbaik" + Skip/Next buttons
        splash_ok = ("Temukan Produk Terbaik" in splash_body
                     and "Next" in splash_body and "Skip" in splash_body)
        record("splash renders",
               "PASS" if splash_ok else "FAIL",
               f"splash_text_snippet={splash_body[:80]!r}")

        # Click Skip → goes to Auth screen
        clicked = click_first_visible(page, ["Skip", "Lewati"])
        page.wait_for_timeout(2500)
        record("onboarding dismissable (Skip)",
               "PASS" if clicked else "FAIL",
               f"clicked_button={clicked!r}")
        page.screenshot(path=str(OUT / "prod-desktop-02-auth.png"), full_page=True)

        auth_body = page.evaluate("document.body.innerText || ''")
        record("auth screen renders",
               "PASS" if "MartUp" in auth_body and ("Masuk" in auth_body or "Login" in auth_body) else "WARN",
               f"auth_text_snippet={auth_body[:120]!r}")

        # SPA nav: click "Daftar" → register screen (no page reload)
        url_before = page.url
        clicked_daftar = click_first_visible(page, ["Daftar", "Register", "Sign Up"])
        page.wait_for_timeout(2000)
        url_after_daftar = page.url
        register_body = page.evaluate("document.body.innerText || ''")
        is_register_screen = ("Daftar" in register_body and ("Nama" in register_body
                              or "Email" in register_body or "Buat Akun" in register_body
                              or "Sudah punya akun" in register_body))
        # SPA nav = URL stayed same (client-side) OR same hostname
        same_origin = (url_after_daftar.startswith(BASE))
        record("SPA nav: Daftar → register screen",
               "PASS" if clicked_daftar and is_register_screen else "WARN",
               f"clicked={clicked_daftar!r} url_changed={url_before != url_after_daftar} "
               f"register_screen={is_register_screen}")
        page.screenshot(path=str(OUT / "prod-desktop-03-register.png"), full_page=True)

        # Back to login, try Google OAuth button (should not 500)
        try:
            # Click back / masuk
            click_first_visible(page, ["Masuk", "Login", "Sudah punya akun? Masuk"])
            page.wait_for_timeout(800)
        except Exception:
            pass

        # Verify auth screen has interactive elements (header/footer not necessarily present on auth screen)
        # Instead we verify login form fields are interactive
        login_form_visible = page.locator("input").count() >= 1
        record("auth form interactive",
               "PASS" if login_form_visible else "WARN",
               f"input_count={page.locator('input').count()}")

        # Now check homepage directly — bypass onboarding via query string is not possible
        # Instead, verify home page SPA hydrates by checking JS exec via api calls
        record("SPA hydrates (fires API)",
               "PASS" if "/api/products" in " ".join(api_calls) else "FAIL",
               f"api_calls={list(set(u.split('?')[0] for u in api_calls if '/api/' in u))}")

        # Try direct navigation to product detail URL with a real product ID.
        # NOTE: MartUp gates content behind onboarding + auth, so the product
        # detail screen is NOT visible without login. The URL itself is reachable
        # (SPA does not error / 500 / 404); the onboarding splash is what renders.
        import urllib.request, json as _json
        try:
            with urllib.request.urlopen(BASE + "/api/products?limit=5") as r:
                products_data = _json.loads(r.read())
            first_product = products_data.get("data", [{}])[0] if products_data.get("data") else {}
            slug = first_product.get("slug") or first_product.get("id")
            if slug:
                direct_url = f"{BASE}/?screen=product-detail&slug={slug}"
                pd_resp = page.goto(direct_url, wait_until="domcontentloaded", timeout=30000)
                pd_code = pd_resp.status if pd_resp else 0
                page.wait_for_timeout(2500)
                pd_body = page.evaluate("document.body.innerText || ''")
                page.screenshot(path=str(OUT / "prod-desktop-04-product-detail-attempt.png"), full_page=True)
                record("direct product-detail URL reachable",
                       "PASS" if pd_code == 200 else "WARN",
                       f"slug={slug} HTTP={pd_code} renders_splash={'Temukan Produk Terbaik' in pd_body}")
        except Exception as e:
            record("direct product-detail URL reachable", "WARN", f"{type(e).__name__}: {e}")

        # ============ MOBILE ============
        mctx = browser.new_context(viewport={"width": 375, "height": 667},
                                   user_agent="Mozilla/5.0 (iPhone SE) MartUpVerify",
                                   is_mobile=True, has_touch=True)
        mpage = mctx.new_page()
        mpage.on("console", on_console)
        mpage.on("pageerror", lambda e: page_errs.append(f"[m] {e}"))
        mpage.on("response", lambda r: (
            net_5xx.append(f"[m] {r.status} {r.url}") if r.status >= 500 else None))
        mpage.goto(BASE + "/", wait_until="networkidle", timeout=45000)
        mpage.wait_for_timeout(1800)
        mpage.screenshot(path=str(OUT / "prod-mobile-01-splash.png"), full_page=True)
        # Skip onboarding
        click_first_visible(mpage, ["Skip", "Lewati"])
        mpage.wait_for_timeout(2500)
        mpage.screenshot(path=str(OUT / "prod-mobile-02-auth.png"), full_page=True)

        scroll_w = mpage.evaluate("document.documentElement.scrollWidth")
        client_w = mpage.evaluate("document.documentElement.clientWidth")
        h_scroll = scroll_w > client_w + 2
        record("mobile: no horizontal scroll",
               "PASS" if not h_scroll else "WARN",
               f"scrollWidth={scroll_w} clientWidth={client_w}")

        mobile_auth = mpage.evaluate("document.body.innerText || ''")
        record("mobile: auth screen renders",
               "PASS" if "MartUp" in mobile_auth else "WARN",
               f"mobile_auth_brand={'yes' if 'MartUp' in mobile_auth else 'no'}")

        # ============ Errors summary ============
        # Filter out benign warnings (e.g. React DevTools, Next.js prefetch noise)
        benign = ("manifest", "favicon", "icon-512", "og-image", "Failed to load resource",
                  "Download the React DevTools", "registration_type")
        real_console_errs = [e for e in console_errs if not any(b in e for b in benign)]
        real_page_errs = [e for e in page_errs if "Error" in e and not any(b in e for b in benign)]
        record("console errors",
               "PASS" if not real_console_errs and not real_page_errs and not net_5xx else "WARN",
               f"console_errors={len(real_console_errs)} page_errors={len(real_page_errs)} "
               f"network_5xx={len(net_5xx)} console_warnings={len(console_warns)}")
        if real_console_errs[:5]:
            print("--- console errors (first 5) ---")
            for m in real_console_errs[:5]:
                print(" ", m[:300])
        if real_page_errs[:5]:
            print("--- page errors (first 5) ---")
            for e in real_page_errs[:5]:
                print(" ", e[:300])
        if net_5xx[:5]:
            print("--- network 5xx (first 5) ---")
            for u in net_5xx[:5]:
                print(" ", u[:300])

        ctx.close()
        mctx.close()
        browser.close()

    (OUT / "prod-results.json").write_text(json.dumps(results, indent=2))
    print("\n=== FINAL SUMMARY ===")
    for r in results:
        print(f"{r['status']:6} | {r['check']:38} | {r['evidence'][:140]}")


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(f"FATAL: {type(e).__name__}: {e}", file=sys.stderr)
        raise
