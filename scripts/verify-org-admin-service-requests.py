#!/usr/bin/env python3
"""Smoke-test org-admin create-request flows for the three service frontends.

This script drives the live frontends with Playwright and verifies that a newly
submitted request appears in the org-admin dashboard for:
  - Challenge Service
  - AI Red Team Service
  - Bug Bounty Service

Expected local frontend ports:
  - http://127.0.0.1:3000
  - http://127.0.0.1:3001
  - http://127.0.0.1:3002
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import json
import time
from typing import Callable
from urllib import request

from playwright.sync_api import Page, sync_playwright


@dataclass(frozen=True)
class Case:
    name: str
    url: str
    api_base: str
    title: str
    fill_form: Callable[[Page, str], None]


def login_as_org_admin(page: Page) -> None:
    page.get_by_role("banner").get_by_role("button", name="Demo Login").click()
    page.get_by_role("button", name="org_admin").click()
    page.wait_for_timeout(800)
    page.get_by_role("button", name="Create Service Request").click()
    page.wait_for_timeout(300)


def fill_challenge(page: Page, title: str) -> None:
    form = page.locator("form").last
    form.get_by_label("Program Name").fill(title)
    form.get_by_label("Description").fill("This is a valid challenge request created by the smoke test.")
    form.get_by_label("Difficulty Level").select_option(label="Medium")
    form.get_by_role("button", name="Crypto", exact=True).click(force=True)
    form.get_by_label("Prize Pool (ETB)").fill("5000")
    form.get_by_label("Start Date").fill("2026-04-26")
    form.get_by_label("End Date").fill("2026-04-30")
    form.get_by_label("Flag Format").fill("flag{smoke_*}")
    form.get_by_label("Correct Flag").fill("flag{smoke_1}")


def fill_ai_redteam(page: Page, title: str) -> None:
    form = page.locator("form").last
    form.get_by_label("AI System Name").fill(title)
    form.get_by_label("Description / Purpose").fill("This is a valid AI red team request created by the smoke test.")
    form.get_by_label("AI System URL / Endpoint").fill("https://atlas.example.com")
    form.get_by_label("Model Type / Version").fill("Atlas v1")
    form.get_by_role("button", name="Jailbreak", exact=True).click(force=True)
    form.get_by_label("Testing Duration").fill("7 days")
    form.get_by_label("Budget / Reward").fill("12000")


def fill_bug_bounty(page: Page, title: str) -> None:
    form = page.locator("form").last
    form.get_by_label("Program Name").fill(title)
    form.get_by_label("Description").fill("This is a valid bug bounty request created by the smoke test.")
    form.get_by_label("Program Type").select_option(label="Public")
    form.get_by_role("button", name="API", exact=True).click(force=True)
    form.get_by_label("Target URLs / In-Scope Assets").fill("https://example.com")
    form.get_by_label("Out-of-Scope").fill("phishing")
    form.get_by_label("Bounty Table / Reward Range").fill("USD 100 - 500")
    form.get_by_label("PoC Target URL").fill("https://example.com")
    form.get_by_label("Default Test Payload").fill("' OR '1'='1")
    form.get_by_label("Rules of Engagement").fill("Keep testing within scope only.")
    form.get_by_label("Testing Start Date").fill("2026-04-26")
    form.get_by_label("Testing End Date").fill("2026-04-30")
    form.get_by_label("Budget").fill("USD 1000")


def api_json(url: str, payload: dict | None = None) -> dict:
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = request.Request(url, data=body, headers=headers)
    with request.urlopen(req, timeout=10) as response:
        return json.load(response)


def wait_for_program(api_base: str, username: str, title: str, timeout_seconds: float = 12.0) -> dict:
    deadline = time.time() + timeout_seconds
    last_titles: list[str] = []
    while time.time() < deadline:
        dashboard = api_json(f"{api_base}/api/dashboard/{username}")
        programs = dashboard.get("programs", [])
        pending = dashboard.get("pendingPrograms", [])
        for program in [*programs, *pending]:
            if program.get("title") == title:
                return program
        last_titles = [program.get("title", "") for program in [*programs, *pending]]
        time.sleep(0.5)
    raise RuntimeError(f"{title}: request not visible yet in {username} dashboard at {api_base}. Last seen titles: {last_titles}")


def wait_for_page_text(page: Page, text: str, timeout_seconds: float = 12.0) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if text in page.locator("body").inner_text():
            return
        page.wait_for_timeout(250)
    raise RuntimeError(f"UI never rendered expected text: {text}")


def approve_ai_program_and_verify_automation(case: Case, title: str) -> None:
    program = wait_for_program(case.api_base, "platform_admin", title)
    api_json(
        f"{case.api_base}/api/programs/{program['id']}/decision",
        {"username": "platform_admin", "action": "approve", "comment": "approved by smoke test"},
    )

    deadline = time.time() + 20
    last_status = None
    while time.time() < deadline:
        approved = wait_for_program(case.api_base, "org_admin", title, timeout_seconds=2)
        last_status = {
            "status": approved.get("status"),
            "automationStatus": approved.get("automationStatus"),
            "automationResults": len(approved.get("automationResults", [])),
        }
        if approved.get("status") == "approved" and approved.get("automationStatus") == "ready" and approved.get("automationResults"):
            return
        time.sleep(0.5)
    raise RuntimeError(f"{case.name}: approval automation never became ready for {title}. Last state: {last_status}")


def verify_case(page: Page, case: Case) -> None:
    errors: list[str] = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(case.url, wait_until="networkidle")
    login_as_org_admin(page)
    case.fill_form(page, case.title)
    page.locator("form").last.get_by_role("button", name="Submit Request").click(force=True)
    wait_for_program(case.api_base, "org_admin", case.title)
    wait_for_page_text(page, case.title)

    if case.name == "ai-redteam":
        approve_ai_program_and_verify_automation(case, case.title)
        page.reload(wait_until="networkidle")
        wait_for_page_text(page, case.title)

    body_text = page.locator("body").inner_text()
    if errors:
        raise RuntimeError(f"{case.name}: browser errors: {errors}")
    if not body_text.strip():
        raise RuntimeError(f"{case.name}: page went blank after request submission")
    if case.title not in body_text:
        raise RuntimeError(f"{case.name}: submitted request title not found in dashboard output")


def main() -> int:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    cases = [
        Case("challenge", "http://127.0.0.1:3000", "http://127.0.0.1:8003", f"Smoke Challenge {stamp}", fill_challenge),
        Case("ai-redteam", "http://127.0.0.1:3001", "http://127.0.0.1:8004", f"Smoke AI {stamp}", fill_ai_redteam),
        Case("bug-bounty", "http://127.0.0.1:3002", "http://127.0.0.1:8005", f"Smoke Bounty {stamp}", fill_bug_bounty),
    ]

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        try:
            for case in cases:
                page = browser.new_page()
                page.set_default_timeout(7000)
                try:
                    verify_case(page, case)
                    print(f"[ok] {case.name}: org-admin request creation succeeded")
                finally:
                    page.close()
        finally:
            browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
