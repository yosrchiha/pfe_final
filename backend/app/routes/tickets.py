# app/routes/tickets.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from pydantic import BaseModel
from datetime import datetime

from app.config.database import get_db
from app.routes.auth import get_current_user   # ← IMPORTANT : utilise le bon get_current_user
from app.models.user import User
from app.models.ticket import Ticket, TicketMessage, TicketCategory, TicketStatus

router = APIRouter(prefix="/tickets", tags=["Tickets"])

# ── Schémas ────────────────────────────────────────────────────────
class TicketCreate(BaseModel):
    subject: str
    category: str
    message: str

class TicketReply(BaseModel):
    message: str

class TicketOut(BaseModel):
    id: int
    subject: str
    category: str
    status: str
    created_at: datetime
    updated_at: datetime
    user_email: str | None = None   # ← ajouté pour la vue admin

class TicketMessageOut(BaseModel):
    id: int
    message: str
    is_admin: bool
    created_at: datetime
    user_name: str

# ── GET mes tickets (user connecté) ───────────────────────────────
@router.get("/", response_model=List[TicketOut])
def get_my_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tickets = db.query(Ticket).filter(
        Ticket.user_id == current_user.id
    ).order_by(desc(Ticket.created_at)).all()

    return [
        TicketOut(
            id=t.id, subject=t.subject,
            category=t.category.value, status=t.status.value,
            created_at=t.created_at, updated_at=t.updated_at,
            user_email=current_user.email,
        )
        for t in tickets
    ]

# ── POST créer un ticket ───────────────────────────────────────────
@router.post("/", response_model=TicketOut)
def create_ticket(
    ticket_data: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        category = TicketCategory(ticket_data.category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Catégorie invalide")

    ticket = Ticket(
        user_id=current_user.id,
        subject=ticket_data.subject,
        category=category,
        status=TicketStatus.OPEN,
    )
    db.add(ticket)
    db.flush()

    # Premier message — is_admin=0 car c'est le client qui ouvre
    msg = TicketMessage(
        ticket_id=ticket.id,
        user_id=current_user.id,
        message=ticket_data.message,
        is_admin=0,   # ← toujours 0 à la création
    )
    db.add(msg)
    db.commit()
    db.refresh(ticket)

    return TicketOut(
        id=ticket.id, subject=ticket.subject,
        category=ticket.category.value, status=ticket.status.value,
        created_at=ticket.created_at, updated_at=ticket.updated_at,
        user_email=current_user.email,
    )

# ── GET messages d'un ticket ───────────────────────────────────────
@router.get("/{ticket_id}/messages", response_model=List[TicketMessageOut])
def get_ticket_messages(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")

    if ticket.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    messages = db.query(TicketMessage).filter(
        TicketMessage.ticket_id == ticket_id
    ).order_by(TicketMessage.created_at).all()

    result = []
    for m in messages:
        sender = db.query(User).filter(User.id == m.user_id).first()
        result.append(TicketMessageOut(
            id=m.id,
            message=m.message,
            is_admin=bool(m.is_admin),   # ← True seulement si admin a répondu
            created_at=m.created_at,
            user_name="Support" if m.is_admin else (sender.username if sender else "Utilisateur"),
        ))
    return result

# ── POST répondre à un ticket ──────────────────────────────────────
@router.post("/{ticket_id}/reply")
def reply_to_ticket(
    ticket_id: int,
    reply: TicketReply,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")

    if ticket.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Ce ticket est fermé")

    # ── is_admin dépend du rôle réel de l'utilisateur ──────────────
    is_admin_reply = 1 if current_user.role == "admin" else 0

    msg = TicketMessage(
        ticket_id=ticket.id,
        user_id=current_user.id,
        message=reply.message,
        is_admin=is_admin_reply,   # ← 1 si admin, 0 si user
    )
    db.add(msg)

    # Si l'admin répond → passe en "in_progress"
    if is_admin_reply and ticket.status == TicketStatus.OPEN:
        ticket.status = TicketStatus.IN_PROGRESS

    ticket.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Réponse envoyée", "is_admin": bool(is_admin_reply)}

# ── GET tickets non lus (pour notifications dashboard) ────────────
@router.get("/unread/count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retourne le nombre de tickets qui ont une réponse admin
    non vue par le client (statut in_progress ou resolved).
    Utilisé pour les notifications dashboard.
    """
    # Tickets de l'utilisateur avec au moins une réponse admin
    tickets = db.query(Ticket).filter(
        Ticket.user_id == current_user.id,
        Ticket.status.in_([TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED]),
    ).all()

    count = 0
    for t in tickets:
        has_admin_reply = db.query(TicketMessage).filter(
            TicketMessage.ticket_id == t.id,
            TicketMessage.is_admin == 1,
        ).first()
        if has_admin_reply:
            count += 1

    return {"unread": count, "tickets": [{"id": t.id, "subject": t.subject, "status": t.status.value} for t in tickets if db.query(TicketMessage).filter(TicketMessage.ticket_id == t.id, TicketMessage.is_admin == 1).first()]}

# ── ADMIN : tous les tickets ───────────────────────────────────────
@router.get("/admin/all", response_model=List[TicketOut])
def get_all_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    tickets = db.query(Ticket).order_by(desc(Ticket.created_at)).all()
    result = []
    for t in tickets:
        owner = db.query(User).filter(User.id == t.user_id).first()
        result.append(TicketOut(
            id=t.id, subject=t.subject,
            category=t.category.value, status=t.status.value,
            created_at=t.created_at, updated_at=t.updated_at,
            user_email=owner.email if owner else "—",
        ))
    return result

# ── ADMIN : changer statut ─────────────────────────────────────────
@router.patch("/admin/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    status: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    try:
        new_status = TicketStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Statut invalide")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")

    ticket.status = new_status
    ticket.updated_at = datetime.utcnow()
    db.commit()

    return {"message": f"Statut mis à jour : {status}"}