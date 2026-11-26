from app.models.evidence import Evidence


def evidence_health(evidence_items: list[Evidence]) -> dict[str, int]:
    return {
        "total": len(evidence_items),
    }
