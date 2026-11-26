from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db

router = APIRouter()


@router.get("/trust-center/{org_slug}", response_model=schemas.TrustCenterOut)
def get_trust_center(org_slug: str, db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter_by(slug=org_slug).first()
    if not org:
        raise HTTPException(404, "Organization not found")

    overview = (
        db.query(models.TrustOverview)
        .filter_by(organization_id=org.id, published=True)
        .order_by(models.TrustOverview.updated_at.desc())
        .first()
    )
    resources = (
        db.query(models.TrustResource)
        .filter_by(organization_id=org.id, published=True)
        .all()
    )
    compliance = (
        db.query(models.TrustCompliance)
        .filter_by(organization_id=org.id, published=True)
        .all()
    )
    subprocessors = (
        db.query(models.TrustSubprocessor)
        .filter_by(organization_id=org.id, published=True)
        .all()
    )
    faq = (
        db.query(models.TrustFAQ)
        .filter_by(organization_id=org.id, published=True)
        .order_by(models.TrustFAQ.order_index)
        .all()
    )
    updates = (
        db.query(models.TrustUpdate)
        .filter_by(organization_id=org.id, published=True)
        .order_by(models.TrustUpdate.published_at.desc())
        .all()
    )
    badge = db.query(models.TrustBadge).filter_by(organization_id=org.id).first()

    statuses = (
        db.query(models.GRCControlStatus)
        .filter_by(organization_id=org.id)
        .all()
    )
    total = len(statuses)
    counts = {"pass": 0, "fail": 0, "partial": 0, "na": 0, "unknown": 0}
    for s in statuses:
        counts[s.status] = counts.get(s.status, 0) + 1

    framework_map = {}
    for s in statuses:
        fw = framework_map.get(s.framework_id)
        if not fw:
            framework = db.query(models.GRCFramework).filter_by(id=s.framework_id).first()
            if not framework:
                continue
            fw = {
                "framework_id": framework.id,
                "name": framework.name,
                "code": framework.code,
                "pass_count": 0,
                "fail_count": 0,
                "partial_count": 0,
                "na_count": 0,
                "unknown_count": 0,
            }
            framework_map[s.framework_id] = fw
        key = f"{s.status}_count"
        fw[key] = fw.get(key, 0) + 1

    return {
        "organization": org,
        "overview": overview,
        "resources": resources,
        "compliance": compliance,
        "subprocessors": subprocessors,
        "faq": faq,
        "updates": updates,
        "badge": badge,
        "grc_overview": {
            "organization_id": org.id,
            "total_controls": total,
            "pass_count": counts["pass"],
            "fail_count": counts["fail"],
            "partial_count": counts["partial"],
            "na_count": counts["na"],
            "unknown_count": counts["unknown"],
            "frameworks": list(framework_map.values()),
        },
    }


@router.get("/trust-center/{org_slug}/page", response_class=HTMLResponse)
def trust_center_page(org_slug: str):
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Trust Center</title>
  <style>
    :root {{
      --bg: #0b0f12;
      --card: #11171c;
      --ink: #e7eef5;
      --muted: #9db0c3;
      --accent: #36b37e;
      --accent-2: #5ec6ff;
      --border: #1c242b;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      color: var(--ink);
      font-family: "Space Grotesk", "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(54,179,126,0.18), transparent 60%),
        radial-gradient(900px 700px at 90% 0%, rgba(94,198,255,0.18), transparent 55%),
        var(--bg);
    }}
    header {{
      padding: 40px 24px 20px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(17,23,28,0.85), rgba(17,23,28,0.4));
      backdrop-filter: blur(6px);
    }}
    header h1 {{
      margin: 0 0 6px 0;
      font-size: 32px;
      letter-spacing: -0.5px;
    }}
    header p {{
      margin: 0;
      color: var(--muted);
      max-width: 720px;
    }}
    main {{
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      animation: fadeIn 420ms ease-out;
    }}
    section {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      min-height: 160px;
    }}
    section h2 {{
      margin: 0 0 10px 0;
      font-size: 18px;
    }}
    .pill {{
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(54,179,126,0.15);
      color: var(--accent);
      font-size: 12px;
      margin-left: 8px;
    }}
    .list {{
      display: grid;
      gap: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .list a {{
      color: var(--accent-2);
      text-decoration: none;
    }}
    .list a:hover {{
      text-decoration: underline;
    }}
    .muted {{ color: var(--muted); }}
    .split {{
      display: grid;
      gap: 10px;
    }}
    .tag {{
      border: 1px solid var(--border);
      padding: 6px 10px;
      border-radius: 10px;
      font-size: 12px;
      color: var(--muted);
    }}
    form {{
      display: grid;
      gap: 8px;
      margin-top: 8px;
    }}
    input, textarea {{
      background: #0e1419;
      border: 1px solid var(--border);
      color: var(--ink);
      padding: 8px 10px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 14px;
    }}
    button {{
      background: linear-gradient(120deg, var(--accent), #2f9b6b);
      border: none;
      color: #0b0f12;
      font-weight: 600;
      padding: 8px 12px;
      border-radius: 10px;
      cursor: pointer;
    }}
    button:hover {{ opacity: 0.9; }}
    footer {{
      padding: 24px;
      color: var(--muted);
      text-align: center;
      font-size: 13px;
    }}
    @keyframes fadeIn {{
      from {{ opacity: 0; transform: translateY(8px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}
  </style>
</head>
<body>
  <header>
    <h1 id="orgName">Trust Center</h1>
    <p id="orgSummary">Loading trust content...</p>
  </header>

  <main>
    <section>
      <h2>GRC Status</h2>
      <div id="grcSummary" class="split"></div>
      <div id="grcFrameworks" class="list" style="margin-top:8px;"></div>
    </section>

    <section>
      <h2>Compliance</h2>
      <div id="compliance" class="list"></div>
    </section>

    <section>
      <h2>Resources</h2>
      <div id="resources" class="list"></div>
    </section>

    <section>
      <h2>Subprocessors</h2>
      <div id="subprocessors" class="list"></div>
    </section>

    <section>
      <h2>FAQ</h2>
      <div id="faq" class="list"></div>
    </section>

    <section>
      <h2>Updates</h2>
      <div id="updates" class="list"></div>
    </section>

    <section>
      <h2>Badge</h2>
      <div id="badge" class="split"></div>
    </section>

    <section>
      <h2>Request Access</h2>
      <div class="muted">Ask for gated docs or reports.</div>
      <form id="accessForm">
        <input name="full_name" placeholder="Full name" required />
        <input name="email" placeholder="Work email" type="email" required />
        <input name="company_name" placeholder="Company" />
        <textarea name="reason" rows="3" placeholder="Reason for access"></textarea>
        <button type="submit">Submit</button>
        <div id="accessResult" class="muted"></div>
      </form>
    </section>

    <section>
      <h2>Subscribe</h2>
      <div class="muted">Get notified about trust updates.</div>
      <form id="subForm">
        <input name="email" placeholder="Email" type="email" required />
        <button type="submit">Subscribe</button>
        <div id="subResult" class="muted"></div>
      </form>
    </section>
  </main>

  <footer>Powered by your backend trust data</footer>

  <script>
    const slug = "{org_slug}";
    const apiBase = "/api/v1";
    const setText = (id, text) => {{
      const el = document.getElementById(id);
      if (el) el.textContent = text || "";
    }};
    const listEl = (id, items) => {{
      const el = document.getElementById(id);
      if (!el) return;
      if (!items || items.length === 0) {{
        el.innerHTML = '<div class="muted">No items published yet.</div>';
        return;
      }}
      el.innerHTML = items.join("");
    }};

    fetch(`${{apiBase}}/trust-center/${{slug}}`)
      .then(res => res.json())
      .then(data => {{
        setText("orgName", data.organization.name + " Trust Center");
        setText("orgSummary", data.overview?.summary || "No overview published yet.");

        listEl("compliance", data.compliance.map(c =>
          `<div>${{c.framework}} <span class="pill">${{c.status || "status"}}</span></div>`
        ));
        listEl("resources", data.resources.map(r => {{
          const link = r.url ? `<a href="${{r.url}}" target="_blank" rel="noreferrer">${{r.title}}</a>` : r.title;
          return `<div>${{link}}</div>`;
        }}));
        listEl("subprocessors", data.subprocessors.map(s =>
          `<div>${{s.name}} <span class="tag">${{s.location || "location"}}</span></div>`
        ));
        listEl("faq", data.faq.map(f =>
          `<div><strong>${{f.question}}</strong><div class="muted">${{f.answer}}</div></div>`
        ));
        listEl("updates", data.updates.map(u =>
          `<div><strong>${{u.title}}</strong><div class="muted">${{u.content}}</div></div>`
        ));

        const badgeEl = document.getElementById("badge");
        if (badgeEl) {{
          if (data.badge) {{
            badgeEl.innerHTML = `
              <div class="tag">Level: ${{data.badge.level || "issued"}}</div>
              <div class="muted">Issued at: ${{new Date(data.badge.issued_at).toLocaleDateString()}}</div>
            `;
          }} else {{
            badgeEl.innerHTML = '<div class="muted">No badge issued.</div>';
          }}
        }}

        const grcSummaryEl = document.getElementById("grcSummary");
        const grcFrameworksEl = document.getElementById("grcFrameworks");
        if (grcSummaryEl && data.grc_overview) {{
          const g = data.grc_overview;
          grcSummaryEl.innerHTML = `
            <div class="tag">Pass: ${{g.pass_count}}</div>
            <div class="tag">Fail: ${{g.fail_count}}</div>
            <div class="tag">Partial: ${{g.partial_count}}</div>
            <div class="tag">N/A: ${{g.na_count}}</div>
            <div class="tag">Unknown: ${{g.unknown_count}}</div>
          `;
          if (grcFrameworksEl) {{
            if (!g.frameworks || g.frameworks.length === 0) {{
              grcFrameworksEl.innerHTML = '<div class="muted">No framework status yet.</div>';
            }} else {{
              grcFrameworksEl.innerHTML = g.frameworks.map(f =>
                `<div><strong>${{f.name}}</strong> · Pass ${{f.pass_count}}, Fail ${{f.fail_count}}, Partial ${{f.partial_count}}, N/A ${{f.na_count}}, Unknown ${{f.unknown_count}}</div>`
              ).join("");
            }}
          }}
        }} else if (grcFrameworksEl) {{
          grcFrameworksEl.innerHTML = '<div class="muted">No GRC data yet.</div>';
        }}

        const accessForm = document.getElementById("accessForm");
        accessForm.addEventListener("submit", async (e) => {{
          e.preventDefault();
          const payload = Object.fromEntries(new FormData(accessForm));
          const res = await fetch(`${{apiBase}}/access-requests/organizations/${{data.organization.id}}/access-requests`, {{
            method: "POST",
            headers: {{ "Content-Type": "application/json" }},
            body: JSON.stringify(payload)
          }});
          setText("accessResult", res.ok ? "Request submitted." : "Failed to submit.");
          if (res.ok) accessForm.reset();
        }});

        const subForm = document.getElementById("subForm");
        subForm.addEventListener("submit", async (e) => {{
          e.preventDefault();
          const payload = Object.fromEntries(new FormData(subForm));
          const res = await fetch(`${{apiBase}}/subscriptions/organizations/${{data.organization.id}}/subscriptions`, {{
            method: "POST",
            headers: {{ "Content-Type": "application/json" }},
            body: JSON.stringify(payload)
          }});
          setText("subResult", res.ok ? "Subscribed." : "Failed to subscribe.");
          if (res.ok) subForm.reset();
        }});
      }})
      .catch(() => {{
        setText("orgSummary", "Unable to load trust data.");
      }});
  </script>
</body>
</html>"""
    return HTMLResponse(content=html)
