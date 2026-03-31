# backend/app/routes/Admin.py

from fastapi import APIRouter, Depends, HTTPException, Header  # ← ajouter Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.config.database import get_db

# ── Import des modèles existants ─────────────────────────────────────────────
from app.models.user          import User
from app.models.depot         import Depot
from app.models.depot_analyse import DepotAnalyse  # ← ajouter pour la MR
from app.models.merge_request import MergeRequest  # ← ajouter pour la MR

# ── Import de get_user_id_from_token (depuis analyses.py)
from app.routes.analyses import get_user_id_from_token  # ← ajouter

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Schemas ───────────────────────────────────────────────────────────────────
class UserAdminOut(BaseModel):
    id:         int
    email:      str
    username:   Optional[str] = None
    role:       str
    is_active:  bool
    created_at: Optional[datetime] = None
    depot_count: int = 0
    model_config = {"from_attributes": True}

class DepotAdminOut(BaseModel):
    id:                      int
    nom:                     str
    url_branche_principale:  Optional[str] = None
    url_branche_developpement: Optional[str] = None
    proprietaire_id:         int
    owner_email:             Optional[str] = None
    created_at:              Optional[datetime] = None
    model_config = {"from_attributes": True}

class UpdateRoleBody(BaseModel):
    role: str  # 'admin' ou 'user'

class UpdateActiveBody(BaseModel):
    is_active: bool


# ── Dépendance : vérifier que l'utilisateur est admin ─────────────────────────
# TODO: remplacer par ton vrai système d'auth JWT
def get_current_admin(db: Session = Depends(get_db)):
    # Exemple minimal — à remplacer par la vérification JWT réelle :
    # token = Depends(oauth2_scheme) → decoder → chercher user → vérifier role
    pass


# ── Stats globales ─────────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_users   = db.query(func.count(User.id)).scalar()
    active_users  = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    total_depots  = db.query(func.count(Depot.id)).scalar()
    admin_count   = db.query(func.count(User.id)).filter(User.role == "admin").scalar()

    return {
        "total_users":  total_users,
        "active_users": active_users,
        "total_depots": total_depots,
        "admin_count":  admin_count,
    }


# ── Gestion des utilisateurs ───────────────────────────────────────────────────
@router.get("/users", response_model=List[UserAdminOut])
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id).all()
    result = []
    for u in users:
        depot_count = db.query(func.count(Depot.id)).filter(
            Depot.proprietaire_id == u.id
        ).scalar()
        result.append(UserAdminOut(
            id=u.id,
            email=u.email,
            username=getattr(u, "username", None),
            role=u.role,
            is_active=u.is_active,
            created_at=getattr(u, "created_at", None),
            depot_count=depot_count,
        ))
    return result


@router.get("/users/{user_id}", response_model=UserAdminOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    depot_count = db.query(func.count(Depot.id)).filter(
        Depot.proprietaire_id == u.id
    ).scalar()
    return UserAdminOut(
        id=u.id, email=u.email,
        username=getattr(u, "username", None),
        role=u.role, is_active=u.is_active,
        created_at=getattr(u, "created_at", None),
        depot_count=depot_count,
    )


@router.patch("/users/{user_id}/role")
def update_user_role(user_id: int, body: UpdateRoleBody, db: Session = Depends(get_db)):
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Rôle invalide. Valeurs acceptées : admin, user")
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    u.role = body.role
    db.commit()
    return {"message": f"Rôle mis à jour : {body.role}", "user_id": user_id}


@router.patch("/users/{user_id}/active")
def toggle_user_active(user_id: int, body: UpdateActiveBody, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    u.is_active = body.is_active
    db.commit()
    return {"message": f"Compte {'activé' if body.is_active else 'désactivé'}", "user_id": user_id}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    db.delete(u)
    db.commit()


# ── Gestion des dépôts ────────────────────────────────────────────────────────
@router.get("/depots", response_model=List[DepotAdminOut])
def get_all_depots(db: Session = Depends(get_db)):
    depots = db.query(Depot).order_by(Depot.id).all()
    result = []
    for d in depots:
        owner = db.query(User).filter(User.id == d.proprietaire_id).first()
        result.append(DepotAdminOut(
            id=d.id,
            nom=d.nom,
            url_branche_principale=getattr(d, "url_branche_principale", None),
            url_branche_developpement=getattr(d, "url_branche_developpement", None),
            proprietaire_id=d.proprietaire_id,
            owner_email=owner.email if owner else None,
            created_at=getattr(d, "created_at", None),
        ))
    return result


@router.get("/users/{user_id}/depots", response_model=List[DepotAdminOut])
def get_depots_by_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    depots = db.query(Depot).filter(Depot.proprietaire_id == user_id).all()
    return [DepotAdminOut(
        id=d.id, nom=d.nom,
        url_branche_principale=getattr(d, "url_branche_principale", None),
        url_branche_developpement=getattr(d, "url_branche_developpement", None),
        proprietaire_id=d.proprietaire_id,
        owner_email=u.email,
        created_at=getattr(d, "created_at", None),
    ) for d in depots]


@router.delete("/depots/{depot_id}", status_code=204)
def delete_depot_admin(depot_id: int, db: Session = Depends(get_db)):
    d = db.query(Depot).filter(Depot.id == depot_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dépôt introuvable")
    db.delete(d)
    db.commit()
    # backend/app/routes/admin.py

# backend/app/routes/Admin.py

@router.get("/merge-requests/")
def get_all_merge_requests(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    """Récupère TOUTES les Merge Requests (admin uniquement)"""
    
    # Vérifier que l'utilisateur est admin
    user_id = get_user_id_from_token(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    # Récupérer toutes les MR
    mrs = db.query(MergeRequest).order_by(MergeRequest.created_at.desc()).all()
    
    # Enrichir avec les infos du dépôt et de l'utilisateur
    result = []
    for mr in mrs:
        depot = db.query(DepotAnalyse).filter(DepotAnalyse.id == mr.depot_analyse_id).first()
        user_depot = db.query(User).filter(User.id == depot.user_id).first() if depot else None
        
        result.append({
            "id": mr.id,
            "analyse_id": mr.analyse_id,
            "test_id": mr.test_id,
            "depot_analyse_id": mr.depot_analyse_id,
            "mr_id_gitlab": mr.mr_id_gitlab,
            "mr_url": mr.mr_url,
            "titre": mr.titre,
            "description": mr.description,
            "branche_source": mr.branche_source,
            "branche_cible": mr.branche_cible,
            "statut": mr.statut,
            "type_mr": mr.type_mr,
            "labels": mr.labels,
            "created_at": str(mr.created_at),
            "updated_at": str(mr.updated_at) if mr.updated_at else None,
            "projet_nom": depot.nom if depot else None,
            "user_email": user_depot.email if user_depot else None,
            "user_id": user_depot.id if user_depot else None,
        })
    
    return result