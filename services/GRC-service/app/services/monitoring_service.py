from app.models.risk import Risk


def summarize_risk_posture(risks: list[Risk]) -> dict[str, int]:
    summary = {"open": 0, "closed": 0, "high": 0, "medium": 0, "low": 0}
    for item in risks:
        summary[item.status] = summary.get(item.status, 0) + 1
        summary[item.severity] = summary.get(item.severity, 0) + 1
    return summary
