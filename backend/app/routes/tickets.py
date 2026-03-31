from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.config.database import get_db
from app.models.user import User
from app.models.ticket import Ticket, TicketMessage, TicketCategory, TicketStatus
from app.routes.analyses import get_user_id_from_token

router = APIRouter(prefix="/tickets", tags=["Tickets"])

# ============================================
# SCHEMAS
# ============================================
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

class TicketMessageOut(BaseModel):
    id: int
    message: str
    is_admin: bool
    created_at: datetime
    user_name: str

# ============================================
# HELPERS
# ============================================
def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token manquant")
    
    user_id = get_user_id_from_token(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return user

def check_admin(user: User):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")

# ============================================
# ENDPOINTS
# ============================================
@router.get("/", response_model=List[TicketOut])
def get_my_tickets(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupère tous mes tickets"""
    tickets = db.query(Ticket).filter(Ticket.user_id == user.id).order_by(desc(Ticket.created_at)).all()
    return [
        TicketOut(
            id=t.id,
            subject=t.subject,
            category=t.category.value,
            status=t.status.value,
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in tickets
    ]

@router.post("/", response_model=TicketOut)
def create_ticket(
    ticket_data: TicketCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Crée un nouveau ticket"""
    # Valider la catégorie
    try:
        category = TicketCategory(ticket_data.category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Catégorie invalide. Utilisez: support, bug, feature, question")
    
    # Créer le ticket
    new_ticket = Ticket(
        user_id=user.id,
        subject=ticket_data.subject,
        category=category,
        status=TicketStatus.OPEN
    )
    db.add(new_ticket)
    db.flush()
    
    # Créer le premier message
    new_message = TicketMessage(
        ticket_id=new_ticket.id,
        user_id=user.id,
        message=ticket_data.message,
        is_admin=0
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_ticket)
    
    return TicketOut(
        id=new_ticket.id,
        subject=new_ticket.subject,
        category=new_ticket.category.value,
        status=new_ticket.status.value,
        created_at=new_ticket.created_at,
        updated_at=new_ticket.updated_at
    )

@router.get("/{ticket_id}/messages", response_model=List[TicketMessageOut])
def get_ticket_messages(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupère tous les messages d'un ticket"""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    # Vérifier l'accès
    if ticket.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    messages = db.query(TicketMessage).filter(TicketMessage.ticket_id == ticket_id).order_by(TicketMessage.created_at).all()
    
    result = []
    for m in messages:
        msg_user = db.query(User).filter(User.id == m.user_id).first()
        user_name = msg_user.username if msg_user else "Utilisateur"
        if m.is_admin:
            user_name = "Support"
        
        result.append(TicketMessageOut(
            id=m.id,
            message=m.message,
            is_admin=bool(m.is_admin),
            created_at=m.created_at,
            user_name=user_name
        ))
    return result

@router.post("/{ticket_id}/reply")
def reply_to_ticket(
    ticket_id: int,
    reply: TicketReply,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ajoute une réponse au ticket"""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    # Vérifier l'accès
    if ticket.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Vérifier que le ticket n'est pas fermé
    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Ce ticket est fermé")
    
    # Créer le message
    new_message = TicketMessage(
        ticket_id=ticket.id,
        user_id=user.id,
        message=reply.message,
        is_admin=1 if user.role == "admin" else 0
    )
    db.add(new_message)
    
    # Mettre à jour le statut
    if ticket.status == TicketStatus.OPEN and user.role == "admin":
        ticket.status = TicketStatus.IN_PROGRESS
    
    ticket.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Réponse ajoutée", "ticket_id": ticket_id}

# ============================================
# ENDPOINTS ADMIN
# ============================================
@router.get("/admin/all", response_model=List[TicketOut])
def get_all_tickets(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin : Récupère tous les tickets"""
    check_admin(user)
    
    tickets = db.query(Ticket).order_by(desc(Ticket.created_at)).all()
    return [
        TicketOut(
            id=t.id,
            subject=t.subject,
            category=t.category.value,
            status=t.status.value,
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in tickets
    ]

@router.patch("/admin/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    status: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin : Change le statut d'un ticket"""
    check_admin(user)
    
    try:
        new_status = TicketStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Statut invalide. Utilisez: open, in_progress, resolved, closed")
    
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    ticket.status = new_status
    ticket.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": f"Statut mis à jour : {status}"}