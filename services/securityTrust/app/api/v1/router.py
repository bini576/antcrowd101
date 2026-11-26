from fastapi import APIRouter
from app.api.v1.routes import (
    organizations, overview, resources, compliance,
    subprocessors, faq, updates, badges, access_requests, subscriptions, trust_center, grc
)

router = APIRouter()

router.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
router.include_router(overview.router, prefix="/overview", tags=["Overview"])
router.include_router(resources.router, prefix="/resources", tags=["Resources"])
router.include_router(compliance.router, prefix="/compliance", tags=["Compliance"])
router.include_router(subprocessors.router, prefix="/subprocessors", tags=["Subprocessors"])
router.include_router(faq.router, prefix="/faq", tags=["FAQ"])
router.include_router(updates.router, prefix="/updates", tags=["Updates"])
router.include_router(badges.router, prefix="/badges", tags=["Badges"])
router.include_router(access_requests.router, prefix="/access-requests", tags=["AccessRequests"])
router.include_router(subscriptions.router, prefix="/subscriptions", tags=["Subscriptions"])
router.include_router(trust_center.router, tags=["TrustCenter"])
router.include_router(grc.router, prefix="/grc", tags=["GRC"])
