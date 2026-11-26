import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_roles
from app.models import (
    InvoiceStatus,
    PaymentVerificationStatus,
    RequestStatus,
    QuoteStatus,
    TrainingInvoice,
    TrainingPackage,
    TrainingQuote,
    TrainingRequest,
    User,
    UserRole,
)
from app.schemas import (
    TrainingInvoiceRead,
    TrainingInvoiceReceiptUpload,
    TrainingInvoiceStatusUpdate,
    TrainingInvoiceVerificationUpdate,
    TrainingPackageCreate,
    TrainingPackageRead,
    TrainingQuoteCreate,
    TrainingQuoteRead,
    TrainingQuoteStatusUpdate,
)

router = APIRouter(prefix="/commercial", tags=["commercial"])


@router.post("/packages", response_model=TrainingPackageRead)
def create_package(
    payload: TrainingPackageCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    # Upsert: update existing package of the same type rather than rejecting.
    existing = db.query(TrainingPackage).filter(TrainingPackage.package_type == payload.package_type).first()
    if existing:
        for field, value in payload.model_dump().items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing

    package = TrainingPackage(**payload.model_dump())
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


@router.get("/packages", response_model=list[TrainingPackageRead])
def list_packages(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.organization, UserRole.trainer)),
):
    return db.query(TrainingPackage).order_by(TrainingPackage.created_at.desc()).all()


@router.post("/quotes", response_model=TrainingQuoteRead)
def create_quote(
    payload: TrainingQuoteCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    request = db.query(TrainingRequest).filter(TrainingRequest.id == payload.request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Training request not found")
    if request.status != RequestStatus.approved:
        raise HTTPException(status_code=409, detail="Only approved training requests can be quoted")

    organization = db.query(TrainingRequest).filter(
        TrainingRequest.id == payload.request_id,
        TrainingRequest.organization_id.isnot(None),
    ).first()
    if not organization:
        raise HTTPException(status_code=400, detail="A quote requires a training request linked to an organization")

    package = db.query(TrainingPackage).filter(TrainingPackage.package_type == request.package_type).first()
    if not package:
        raise HTTPException(status_code=404, detail="Training package pricing is not configured")

    existing = db.query(TrainingQuote).filter(TrainingQuote.request_id == request.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Quote already exists for this request")

    total = package.base_price_etb + (package.per_participant_etb * request.number_of_participants)

    quote = TrainingQuote(
        request_id=request.id,
        package_type=request.package_type.value,
        number_of_participants=request.number_of_participants,
        base_price_etb=package.base_price_etb,
        per_participant_etb=package.per_participant_etb,
        total_price_etb=total,
        status=QuoteStatus.sent,
        notes=payload.notes,
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)
    return quote


@router.get("/quotes", response_model=list[TrainingQuoteRead])
def list_quotes(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.organization)),
):
    query = db.query(TrainingQuote)

    if current_user.role == UserRole.organization:
        query = query.join(TrainingRequest).filter(TrainingRequest.organization_id == current_user.organization_id)

    return query.order_by(TrainingQuote.created_at.desc()).all()


@router.patch("/quotes/{quote_id}/status", response_model=TrainingQuoteRead)
def update_quote_status(
    quote_id: uuid.UUID,
    payload: TrainingQuoteStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.organization)),
):
    quote = db.query(TrainingQuote).filter(TrainingQuote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    request = db.query(TrainingRequest).filter(TrainingRequest.id == quote.request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Training request not found")

    if current_user.role == UserRole.organization and current_user.organization_id != request.organization_id:
        raise HTTPException(status_code=403, detail="Cannot modify quote for another organization")

    if current_user.role == UserRole.organization and payload.status not in {QuoteStatus.approved, QuoteStatus.rejected}:
        raise HTTPException(status_code=403, detail="Organization can only approve or reject quote")

    quote.status = payload.status
    quote.approved_at = datetime.now(timezone.utc) if payload.status == QuoteStatus.approved else None

    if payload.status == QuoteStatus.approved:
        invoice = db.query(TrainingInvoice).filter(TrainingInvoice.quote_id == quote.id).first()
        if not invoice:
            invoice = TrainingInvoice(
                quote_id=quote.id,
                invoice_number=f"INV-{str(quote.id)[:8].upper()}",
                amount_etb=quote.total_price_etb,
                status=InvoiceStatus.unpaid,
            )
            db.add(invoice)

    db.commit()
    db.refresh(quote)
    return quote


@router.get("/invoices", response_model=list[TrainingInvoiceRead])
def list_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.organization)),
):
    query = db.query(TrainingInvoice)

    if current_user.role == UserRole.organization:
        query = query.join(TrainingQuote).join(TrainingRequest).filter(
            TrainingRequest.organization_id == current_user.organization_id
        )

    return query.order_by(TrainingInvoice.issued_at.desc()).all()


@router.patch("/invoices/{invoice_id}/status", response_model=TrainingInvoiceRead)
def update_invoice_status(
    invoice_id: uuid.UUID,
    payload: TrainingInvoiceStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    invoice = db.query(TrainingInvoice).filter(TrainingInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    quote = db.query(TrainingQuote).filter(TrainingQuote.id == invoice.quote_id).first()
    if not quote:
        raise HTTPException(status_code=400, detail="Cannot record payment: no quote found for this invoice")

    request = db.query(TrainingRequest).filter(TrainingRequest.id == quote.request_id).first()
    if not request:
        raise HTTPException(status_code=400, detail="Cannot record payment: no training request found for the invoice quote")

    invoice.status = payload.status
    invoice.paid_at = datetime.now(timezone.utc) if payload.status == InvoiceStatus.paid else None

    db.commit()
    db.refresh(invoice)
    return invoice


@router.patch("/invoices/{invoice_id}/receipt", response_model=TrainingInvoiceRead)
def upload_invoice_receipt(
    invoice_id: uuid.UUID,
    payload: TrainingInvoiceReceiptUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.organization)),
):
    invoice = db.query(TrainingInvoice).filter(TrainingInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    req = (
        db.query(TrainingRequest)
        .join(TrainingQuote, TrainingQuote.request_id == TrainingRequest.id)
        .filter(TrainingQuote.id == invoice.quote_id)
        .first()
    )
    if not req or req.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cannot upload receipt for another organization invoice")

    invoice.receipt_reference = payload.receipt_reference
    invoice.receipt_note = payload.receipt_note
    invoice.receipt_uploaded_at = datetime.now(timezone.utc)
    invoice.payment_verification_status = PaymentVerificationStatus.pending
    invoice.payment_verification_note = None
    invoice.payment_verified_at = None

    db.commit()
    db.refresh(invoice)
    return invoice


@router.patch("/invoices/{invoice_id}/verification", response_model=TrainingInvoiceRead)
def verify_invoice_payment(
    invoice_id: uuid.UUID,
    payload: TrainingInvoiceVerificationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    invoice = db.query(TrainingInvoice).filter(TrainingInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if payload.payment_verification_status not in {
        PaymentVerificationStatus.pending,
        PaymentVerificationStatus.verified,
        PaymentVerificationStatus.rejected,
    }:
        raise HTTPException(status_code=400, detail="Invalid verification status transition")

    invoice.payment_verification_status = payload.payment_verification_status
    invoice.payment_verification_note = payload.payment_verification_note
    
    if payload.payment_verification_status == PaymentVerificationStatus.verified:
        invoice.status = InvoiceStatus.paid
        invoice.paid_at = datetime.now(timezone.utc)
        invoice.payment_verified_at = invoice.paid_at
    else:
        if payload.payment_verification_status == PaymentVerificationStatus.rejected:
            invoice.status = InvoiceStatus.unpaid
        invoice.paid_at = None
        invoice.payment_verified_at = None

    db.commit()
    db.refresh(invoice)
    return invoice
