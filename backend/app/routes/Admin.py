# backend/app/routes/Admin.py

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.config.database import get_db

from app.models.user          import User
from app.models.depot         import Depot
from app.models.depot_analyse import DepotAnalyse
from app.models.merge_request import MergeRequest
from app.models.analyse       import Analyse
from app.routes.auth import get_current_user
from app.models.comparaison import Comparaison
from app.models.analyse_diff import AnalyseDiff

# ── Import du modèle AnalyseDiff ──────────────────────────────────
# Adapte le chemin selon ton app (le modèle de comparaison de branches)
try:
    from app.models.analyse_diff import AnalyseDiff
    HAS_ANALYSE_DIFF = True
except ImportError:
    HAS_ANALYSE_DIFF = False

from app.routes.analyses import get_user_id_from_token

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Schemas ───────────────────────────────────────────────────────
class UserAdminOut(BaseModel):
    id:          int
    email:       str
    username:    Optional[str] = None
    role:        str
    is_active:   bool
    created_at:  Optional[datetime] = None
    depot_count: int = 0
    model_config = {"from_attributes": True}

class DepotAdminOut(BaseModel):
    id:                        int
    nom:                       str
    url_branche_principale:    Optional[str] = None
    url_branche_developpement: Optional[str] = None
    proprietaire_id:           int
    owner_email:               Optional[str] = None
    created_at:                Optional[datetime] = None
    model_config = {"from_attributes": True}

class UpdateRoleBody(BaseModel):
    role: str

class UpdateActiveBody(BaseModel):
    is_active: bool


# ── Helper auth admin ─────────────────────────────────────────────
def require_admin(authorization: str, db: Session):
    user_id = get_user_id_from_token(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user


# ══════════════════════════════════════════════════════════════════
# STATS GLOBALES
# ══════════════════════════════════════════════════════════════════
@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_users  = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    total_depots = db.query(func.count(Depot.id)).scalar()
    admin_count  = db.query(func.count(User.id)).filter(User.role == "admin").scalar()

    # Stats analyses
    total_analyses = db.query(func.count(Analyse.id)).scalar()
    analyses_ok    = db.query(func.count(Analyse.id)).filter(Analyse.statut == "termine").scalar()

    # Stats MR
    total_mr = db.query(func.count(MergeRequest.id)).scalar()

    # Stats AnalyseDiff
    total_diffs = 0
    if HAS_ANALYSE_DIFF:
        try:
            total_diffs = db.query(func.count(AnalyseDiff.id)).scalar()
        except Exception:
            total_diffs = 0

    return {
        "total_users":     total_users,
        "active_users":    active_users,
        "total_depots":    total_depots,
        "admin_count":     admin_count,
        "total_analyses":  total_analyses,
        "analyses_ok":     analyses_ok,
        "total_mr":        total_mr,
        "total_diffs":     total_diffs,
    }


# ══════════════════════════════════════════════════════════════════
# GESTION DES UTILISATEURS
# ══════════════════════════════════════════════════════════════════
@router.get("/users", response_model=List[UserAdminOut])
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id).all()
    result = []
    for u in users:
        depot_count = db.query(func.count(Depot.id)).filter(
            Depot.proprietaire_id == u.id
        ).scalar()
        result.append(UserAdminOut(
            id=u.id, email=u.email,
            username=getattr(u, "username", None),
            role=u.role, is_active=u.is_active,
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
        raise HTTPException(status_code=400, detail="Rôle invalide")
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


# ══════════════════════════════════════════════════════════════════
# GESTION DES DÉPÔTS
# ══════════════════════════════════════════════════════════════════
@router.get("/depots", response_model=List[DepotAdminOut])
def get_all_depots(db: Session = Depends(get_db)):
    depots = db.query(Depot).order_by(Depot.id).all()
    result = []
    for d in depots:
        owner = db.query(User).filter(User.id == d.proprietaire_id).first()
        result.append(DepotAdminOut(
            id=d.id, nom=d.nom,
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


# ══════════════════════════════════════════════════════════════════
# MERGE REQUESTS — TOUTES (admin)
# ══════════════════════════════════════════════════════════════════
@router.get("/merge-requests")
def get_all_merge_requests(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    require_admin(authorization, db)

    mrs = db.query(MergeRequest).order_by(MergeRequest.created_at.desc()).all()
    result = []
    for mr in mrs:
        depot = db.query(DepotAnalyse).filter(
            DepotAnalyse.id == mr.depot_analyse_id
        ).first()
        user_depot = db.query(User).filter(
            User.id == depot.user_id
        ).first() if depot else None

        result.append({
            "id":               mr.id,
            "analyse_id":       mr.analyse_id,
            "test_id":          mr.test_id,
            "depot_analyse_id": mr.depot_analyse_id,
            "mr_id_gitlab":     mr.mr_id_gitlab,
            "mr_url":           mr.mr_url,
            "titre":            mr.titre,
            "description":      mr.description,
            "branche_source":   mr.branche_source,
            "branche_cible":    mr.branche_cible,
            "statut":           mr.statut,
            "type_mr":          mr.type_mr,
            "labels":           mr.labels,
            "created_at":       str(mr.created_at) if mr.created_at else None,
            "updated_at":       str(mr.updated_at) if mr.updated_at else None,
            "projet_nom":       depot.nom if depot else None,
            "user_email":       user_depot.email if user_depot else None,
            "user_id":          user_depot.id if user_depot else None,
        })
    return result


# backend/app/routes/Admin.py

# ... (gardez tout le début jusqu'à la ligne 200 environ) ...

# ══════════════════════════════════════════════════════════════════
# ANALYSES DIFF — TOUTES (admin) - VERSION CORRECTE
# ══════════════════════════════════════════════════════════════════
@router.get("/analyses-diff")
def get_all_analyses_diff(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    """Récupère toutes les analyses de diff entre branches (admin uniquement)."""
    require_admin(authorization, db)

    # Requête directe avec jointures (version corrigée)
    results = db.query(
        AnalyseDiff.id,
        AnalyseDiff.comparaison_id,
        AnalyseDiff.score_qualite,
        AnalyseDiff.score_securite,
        AnalyseDiff.score_performance,
        AnalyseDiff.vulnerabilites,
        AnalyseDiff.recommandations,
        AnalyseDiff.resultat_statut,
        AnalyseDiff.created_at,
        Comparaison.from_branch,
        Comparaison.to_branch,
        Depot.id.label("depot_id"),
        Depot.nom.label("projet_nom"),
        User.id.label("user_id"),
        User.email.label("user_email")
    ).join(
        Comparaison, AnalyseDiff.comparaison_id == Comparaison.id
    ).join(
        Depot, Comparaison.depot_id == Depot.id
    ).join(
        User, Depot.proprietaire_id == User.id
    ).order_by(
        AnalyseDiff.created_at.desc()
    ).all()

    result = []
    for row in results:
        result.append({
            "id": row.id,
            "projet_nom": row.projet_nom or "Inconnu",
            "user_email": row.user_email or "Inconnu",
            "from_branch": row.from_branch or "—",
            "to_branch": row.to_branch or "—",
            "score_qualite": row.score_qualite or 0,
            "score_securite": row.score_securite or 0,
            "score_performance": row.score_performance or 0,
            "vulnerabilites": row.vulnerabilites or [],
            "recommandations": row.recommandations or [],
            "resultat_statut": row.resultat_statut or "inconnu",
            "created_at": str(row.created_at) if row.created_at else None,
        })
    
    return result


# ══════════════════════════════════════════════════════════════════
# ANALYSES — TOUTES (admin) — vue globale rapide
# ══════════════════════════════════════════════════════════════════
@router.get("/analyses")
def get_all_analyses(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    require_admin(authorization, db)

    analyses = db.query(Analyse).order_by(Analyse.created_at.desc()).all()
    result = []
    for a in analyses:
        # Chercher le dépôt et l'utilisateur
        depot_nom  = "Inconnu"
        user_email = "Inconnu"

        if a.depot_analyse_id:
            da = db.query(DepotAnalyse).filter(
                DepotAnalyse.id == a.depot_analyse_id
            ).first()
            if da:
                depot_nom = da.nom
                u = db.query(User).filter(User.id == da.user_id).first()
                if u:
                    user_email = u.email

        elif a.depot_id:
            d = db.query(Depot).filter(Depot.id == a.depot_id).first()
            if d:
                depot_nom = d.nom
                u = db.query(User).filter(User.id == d.proprietaire_id).first()
                if u:
                    user_email = u.email

        vulns = a.vulnerabilites or []
        nb_vulns = len(vulns) if isinstance(vulns, list) else 0

        result.append({
            "id": a.id,
            "depot_nom": depot_nom,
            "user_email": user_email,
            "branche": a.branche,
            "score_qualite": a.score_qualite or 0,
            "score_securite": a.score_securite or 0,
            "score_performance": a.score_performance or 0,
            "statut": a.statut,
            "created_at": str(a.created_at) if a.created_at else None,
            "nb_vulns": nb_vulns,
        })
    return result
@router.get("/comparaisons/all")
def get_all_diffs_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),   # même pattern que comparaisons.py
):
    # Vérification admin — même logique que dans comparaisons.py
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
 
    # Jointure directe : AnalyseDiff → Comparaison → Depot → User
    results = (
        db.query(AnalyseDiff, Comparaison, Depot, User)
        .join(Comparaison, AnalyseDiff.comparaison_id == Comparaison.id)
        .join(Depot,       Comparaison.depot_id       == Depot.id)
        .join(User,        Depot.proprietaire_id       == User.id)
        .order_by(AnalyseDiff.created_at.desc())
        .all()
    )
 
    return [
        {
            "id":              a.id,
            "projet_nom":      d.nom,
            "user_email":      u.email,
            "from_branch":     c.from_branch,
            "to_branch":       c.to_branch,
            "score_qualite":   a.score_qualite  or 0,
            "score_securite":  a.score_securite or 0,
            "resultat_statut": a.resultat_statut or "",
            "created_at":      str(a.created_at) if a.created_at else "",
        }
        for a, c, d, u in results
    ]
