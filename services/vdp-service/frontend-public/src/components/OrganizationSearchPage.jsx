import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function OrganizationSearchPage() {
  const [orgs, setOrgs] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get("/organizations")
      .then((res) => {
        if (mounted) setOrgs(res.data || []);
      })
      .catch(() => {
        if (mounted) setError("Failed to load organizations");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)
    );
  }, [orgs, query]);

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h1>Organizations</h1>
          <p className="muted">Discover verified disclosure programs and jump directly into each public intake portal.</p>
        </div>
        <div className="pill">{filtered.length} Program{filtered.length === 1 ? "" : "s"}</div>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by organization name or slug"
        className="input"
      />
      {error && <div className="error">{error}</div>}
      {loading ? (
        <div className="card-grid">
          <div className="card"><div className="card-title">Loading organizations...</div></div>
          <div className="card"><div className="card-title">Loading organizations...</div></div>
        </div>
      ) : null}
      <div className="card-grid">
        {filtered.map((o) => (
          <div key={o.id} className="card selectable">
            <div className="section-head-row">
              <div className="card-title">{o.name}</div>
              <span className="severity-chip low">Published</span>
            </div>
            <div className="card-sub">@{o.slug}</div>
            {o.description && <div className="muted">{o.description}</div>}
            <div className="card-meta">{o.id}</div>
            <div className="actions">
              <Link className="btn" to={`/security/${o.slug}`}>
                Open Disclosure Portal
              </Link>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 ? (
          <div className="card">
            <div className="card-title">No organizations match your search</div>
            <div className="muted">Try a shorter name, partial slug, or clear the search field to view all published programs.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
