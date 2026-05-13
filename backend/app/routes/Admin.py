# backend/app/routes/Admin.py

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.models.login_event import LoginEvent
# backend/app/routes/Admin.py
from sqlalchemy.sql import text
# backend/app/routes/Admin.py
# Ajoutez ces imports (avec les bons noms de fichiers)
from app.models.recommandation import Recommandation  # ← fichier: recommandation.py
from app.models.export_rapport import ExportRapport   # ← fichier: export_rapport.py
# Le reste de vos imports...
# Le reste de vos imports existants...
from app.config.database import get_db
from app.models.user          import User
from app.models.depot         import Depot
from app.models.depot_analyse import DepotAnalyse
from app.models.merge_request import MergeRequest
from app.models.analyse       import Analyse
from app.routes.auth import get_current_user
from app.models.comparaison import Comparaison
from app.models.analyse_diff import AnalyseDiff
from pydantic import BaseModel, EmailStr
from app.core.security import hash_password   # ton helper existant

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
    # UNE SEULE requête avec jointure au lieu de N+1
    results = (
        db.query(User, func.count(Depot.id).label("depot_count"))
        .outerjoin(Depot, Depot.proprietaire_id == User.id)
        .group_by(User.id)
        .order_by(User.id)
        .all()
    )
    return [
        UserAdminOut(
            id=u.id, email=u.email,
            username=getattr(u, "username", None),
            role=u.role, is_active=u.is_active,
            created_at=getattr(u, "created_at", None),
            depot_count=count,
        )
        for u, count in results
    ]


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


# backend/app/routes/Admin.py

# Ajoutez cet import en haut du fichier (avec les autres imports)
from sqlalchemy.sql import text

# Ensuite, remplacez votre route DELETE par celle-ci :
@router.delete("/depots/{depot_id}", status_code=204)
def delete_depot_admin(depot_id: int, db: Session = Depends(get_db)):
    depot = db.query(DepotAnalyse).filter(DepotAnalyse.id == depot_id).first()
    
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt introuvable")
    
    try:
        # Récupérer les IDs des analyses
        analyse_ids = db.query(Analyse.id).filter(Analyse.depot_analyse_id == depot_id).all()
        analyse_ids = [str(a[0]) for a in analyse_ids]
        
        if analyse_ids:
            ids_str = ','.join(analyse_ids)
            
            # 🔑 La correction est ici : utiliser text() autour de chaque requête
            db.execute(text(f"DELETE FROM recommandations WHERE analyse_id IN ({ids_str})"))
            db.execute(text(f"DELETE FROM exports_rapport WHERE analyse_id IN ({ids_str})"))
            db.execute(text(f"DELETE FROM tests_generes WHERE analyse_id IN ({ids_str})"))
        
        # Supprimer les analyses
        db.execute(text(f"DELETE FROM analyses WHERE depot_analyse_id = {depot_id}"))
        
        # Supprimer les MergeRequests
        db.execute(text(f"DELETE FROM merge_requests WHERE depot_analyse_id = {depot_id}"))
        
        # Supprimer le dépôt
        db.delete(depot)
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        print(f"Erreur: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")
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

 
class CreateUserRequest(BaseModel):
    email: str
    username: str
    password: str
    role: str = "user"   # "user" ou "admin"
 
@router.post("/users/create")
def admin_create_user(
    data: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin : crée un compte utilisateur directement."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")
 
    # Vérifie que l'email n'existe pas déjà
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")
 
    # Vérifie que le username n'existe pas déjà
    existing_u = db.query(User).filter(User.username == data.username).first()
    if existing_u:
        raise HTTPException(status_code=400, detail="Ce username est déjà pris.")
 
    # Valide le rôle
    if data.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Rôle invalide : 'user' ou 'admin'.")
 
    new_user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
 
    return {
        "id":       new_user.id,
        "email":    new_user.email,
        "username": new_user.username,
        "role":     new_user.role,
        "message":  "Compte créé avec succès.",
    }
from pydantic import BaseModel
from typing import Optional
 
class UpdateDepotRequest(BaseModel):
    nom:         Optional[str] = None
    project_url: Optional[str] = None
    branche:     Optional[str] = None
 
 
@router.put("/depots/{depot_id}")
def admin_update_depot(
    depot_id: int,
    data: UpdateDepotRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin : modifie les informations d'un dépôt."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")
 
    # Cherche dans Depot (modèle GitLab principal)
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
 
    # Fallback : cherche dans DepotAnalyse si pas trouvé dans Depot
    if not depot:
        from app.models.depot_analyse import DepotAnalyse as DA
        da = db.query(DA).filter(DA.id == depot_id).first()
        if not da:
            raise HTTPException(status_code=404, detail="Dépôt introuvable")
        if data.nom:         da.nom         = data.nom.strip()
        if data.project_url: da.project_url = data.project_url.strip()
        if data.branche:     da.branche     = data.branche.strip()
        db.commit()
        db.refresh(da)
        return {
            "id":          da.id,
            "nom":         da.nom,
            "project_url": da.project_url,
            "branche":     da.branche,
            "message":     "Dépôt modifié avec succès.",
        }
 
    if data.nom:         depot.nom         = data.nom.strip()
    if data.project_url: depot.project_url = data.project_url.strip()
    if data.branche:     depot.branche     = data.branche.strip()
    db.commit()
    db.refresh(depot)
 
    return {
        "id":          depot.id,
        "nom":         depot.nom,
        "project_url": depot.project_url,
        "branche":     depot.branche,
        "message":     "Dépôt modifié avec succès.",
    }
 
 
# ── DELETE /admin/depots/{id} ── déjà présent dans Admin.py ───────
# Rien à ajouter, il est dans le code fourni.
# Vérification : il doit supprimer en cascade les analyses associées.
# Si ce n'est pas le cas, adapte comme suit :
 
# @router.delete("/depots/{depot_id}", status_code=204)
# def delete_depot_admin(depot_id: int, db: Session = Depends(get_db),
#                        current_user: User = Depends(get_current_user)):
#     if current_user.role != "admin":
#         raise HTTPException(status_code=403, detail="Admin requis")
#     d = db.query(Depot).filter(Depot.id == depot_id).first()
#     if not d:
#         # essayer DepotAnalyse
#         from app.models.depot_analyse import DepotAnalyse as DA
#         da = db.query(DA).filter(DA.id == depot_id).first()
#         if not da:
#             raise HTTPException(status_code=404, detail="Dépôt introuvable")
#         db.delete(da)
#         db.commit()
#         return
#     db.delete(d)
#     db.commit()
from pydantic import BaseModel, EmailStr
from typing import Optional
 
class UpdateUserBody(BaseModel):
    email:    Optional[EmailStr] = None
    username: Optional[str]      = None
 
 
@router.patch("/users/{user_id}/update")
def update_user_info(
    user_id: int,
    body: UpdateUserBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin : modifie email et/ou username d'un utilisateur.
    Vérifie l'unicité de l'email si changement.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
 
    # Récupérer l'utilisateur cible
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
 
    # ── Modifier l'email ──────────────────────────────────────
    if body.email and body.email != u.email:
        # Vérifier unicité
        existing = db.query(User).filter(User.email == body.email).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Cet email est déjà utilisé par un autre compte"
            )
        u.email = body.email
 
    # ── Modifier le username ──────────────────────────────────
    if body.username and body.username.strip():
        new_username = body.username.strip()
        # Vérifier unicité username (optionnel selon ton modèle)
        existing_u = db.query(User).filter(
            User.username == new_username,
            User.id != user_id
        ).first()
        if existing_u:
            raise HTTPException(
                status_code=400,
                detail="Ce username est déjà utilisé"
            )
        u.username = new_username
 
    db.commit()
    db.refresh(u)
 
    return {
        "id":       u.id,
        "email":    u.email,
        "username": u.username,
        "role":     u.role,
        "message":  "Utilisateur modifié avec succès",
    }
# ══════════════════════════════════════════════════════════════════
# À AJOUTER dans backend/app/routes/Admin.py
# — Collez ce bloc à la fin du fichier existant —
# ══════════════════════════════════════════════════════════════════

# ── Imports supplémentaires (ajoutez en haut du fichier Admin.py) ──
# from app.models.exploration   import Exploration
# from app.models.correction    import Correction
# from app.models.mr_exploration import MrExploration

# ══════════════════════════════════════════════════════════════════
# EXPLORATIONS — ADMIN CRUD
# ══════════════════════════════════════════════════════════════════

@router.get("/explorations")
def admin_get_all_explorations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne toutes les explorations (admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    from app.models.exploration import Exploration

    rows = (
        db.query(Exploration, User)
        .join(User, Exploration.user_id == User.id)
        .order_by(Exploration.created_at.desc())
        .all()
    )
    return [
        {
            "id":               e.id,
            "user_id":          e.user_id,
            "user_email":       u.email,
            "projet_nom":       e.projet_nom,
            "projet_chemin":    e.projet_chemin,
            "branche":          e.branche,
            "total_fichiers":   e.total_fichiers or 0,
            "statut":           e.statut or "active",
            "created_at":       str(e.created_at) if e.created_at else None,
            "updated_at":       str(e.updated_at) if e.updated_at else None,
        }
        for e, u in rows
    ]


@router.delete("/explorations/{exploration_id}", status_code=204)
def admin_delete_exploration(
    exploration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprime une exploration (admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    from app.models.exploration import Exploration

    e = db.query(Exploration).filter(Exploration.id == exploration_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Exploration introuvable")
    db.delete(e)
    db.commit()


@router.patch("/explorations/{exploration_id}/statut")
def admin_update_exploration_statut(
    exploration_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour le statut d'une exploration (admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    from app.models.exploration import Exploration

    e = db.query(Exploration).filter(Exploration.id == exploration_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Exploration introuvable")

    statut = body.get("statut")
    if statut not in ("active", "archived"):
        raise HTTPException(status_code=400, detail="Statut invalide : 'active' ou 'archived'")

    e.statut = statut
    db.commit()
    return {"id": e.id, "statut": e.statut, "message": "Statut mis à jour"}


# ══════════════════════════════════════════════════════════════════
# CORRECTIONS — ADMIN CRUD
# ══════════════════════════════════════════════════════════════════

@router.get("/corrections")
def admin_get_all_corrections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne toutes les corrections appliquées (admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    from app.models.correction import Correction

    rows = (
        db.query(Correction, User)
        .join(User, Correction.user_id == User.id)
        .order_by(Correction.created_at.desc())
        .all()
    )
    return [
        {
            "id":                c.id,
            "user_id":           c.user_id,
            "user_email":        u.email,
            "projet_nom":        c.projet_nom,
            "fichier_path":      c.fichier_path,
            "branche":           c.branche,
            "vuln_type":         c.vuln_type,
            "vuln_severite":     c.vuln_severite,
            "vuln_ligne":        c.vuln_ligne,
            "vuln_suggestion":   c.vuln_suggestion,
            "statut":            c.statut or "appliquee",
            "created_at":        str(c.created_at) if c.created_at else None,
            "pushed_at":         str(c.pushed_at) if c.pushed_at else None,
        }
        for c, u in rows
    ]


@router.delete("/corrections/{correction_id}", status_code=204)
def admin_delete_correction(
    correction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprime une correction (admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    from app.models.correction import Correction

    c = db.query(Correction).filter(Correction.id == correction_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Correction introuvable")
    db.delete(c)
    db.commit()


@router.patch("/corrections/{correction_id}/statut")
def admin_update_correction_statut(
    correction_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour le statut d'une correction (admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    from app.models.correction import Correction

    c = db.query(Correction).filter(Correction.id == correction_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Correction introuvable")

    statut = body.get("statut")
    if statut not in ("appliquee", "poussee", "annulee"):
        raise HTTPException(
            status_code=400,
            detail="Statut invalide : 'appliquee', 'poussee' ou 'annulee'"
        )

    c.statut = statut
    db.commit()
    return {"id": c.id, "statut": c.statut, "message": "Statut mis à jour"}


# ══════════════════════════════════════════════════════════════════
# MR EXPLORATIONS — ADMIN CRUD
# ══════════════════════════════════════════════════════════════════

@router.get("/mr-explorations")
def admin_get_all_mr_explorations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne toutes les MR créées via explorer (admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    from app.models.mr_exploration import MrExploration

    rows = (
        db.query(MrExploration, User)
        .join(User, MrExploration.user_id == User.id)
        .order_by(MrExploration.created_at.desc())
        .all()
    )
    return [
        {
            "id":               m.id,
            "user_id":          m.user_id,
            "user_email":       u.email,
            "projet_nom":       m.projet_nom,
            "projet_chemin":    m.projet_chemin,
            "branche_source":   m.branche_source,
            "branche_cible":    m.branche_cible,
            "titre":            m.titre,
            "description":      m.description,
            "mr_id_gitlab":     m.mr_id_gitlab,
            "mr_iid_gitlab":    m.mr_iid_gitlab,
            "mr_url":           m.mr_url,
            "statut":           m.statut or "opened",
            "created_at":       str(m.created_at) if m.created_at else None,
            "merged_at":        str(m.merged_at) if m.merged_at else None,
            "closed_at":        str(m.closed_at) if m.closed_at else None,
        }
        for m, u in rows
    ]


@router.delete("/mr-explorations/{mr_id}", status_code=204)
def admin_delete_mr_exploration(
    mr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprime un enregistrement MR exploration (admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    from app.models.mr_exploration import MrExploration

    m = db.query(MrExploration).filter(MrExploration.id == mr_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="MR Exploration introuvable")
    db.delete(m)
    db.commit()


@router.patch("/mr-explorations/{mr_id}/statut")
def admin_update_mr_exploration_statut(
    mr_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour le statut d'une MR exploration (admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin requis")

    from app.models.mr_exploration import MrExploration

    m = db.query(MrExploration).filter(MrExploration.id == mr_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="MR Exploration introuvable")

    statut = body.get("statut")
    if statut not in ("opened", "merged", "closed"):
        raise HTTPException(
            status_code=400,
            detail="Statut invalide : 'opened', 'merged' ou 'closed'"
        )

    m.statut = statut
    db.commit()
    return {"id": m.id, "statut": m.statut, "message": "Statut mis à jour"}
# ══════════════════════════════════════════════════════════════════
# TRACABILITÉ UTILISATEUR — Ajouter à la fin de Admin.py
# ══════════════════════════════════════════════════════════════════
#
# IMPORTS à ajouter en haut de Admin.py (s'ils ne sont pas déjà là) :
#
#   from app.models.video_generee import VideoGeneree
#   from app.models.export_rapport import ExportRapport
#   from app.models.depot_analyse import DepotAnalyse
#
# ══════════════════════════════════════════════════════════════════

from app.models.video_generee import VideoGeneree
from app.models.export_rapport import ExportRapport


# ── Schémas de sortie ─────────────────────────────────────────────

class LoginEventOut(BaseModel):
    id: int
    user_id: int
    date: datetime
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    statut: str  # "succes" | "echec" | "deconnexion"
    duree_minutes: Optional[int] = None
    model_config = {"from_attributes": True}


class AnalyseEventOut(BaseModel):
    id: int
    depot_nom: str
    branche: Optional[str] = None
    score_qualite: int = 0
    score_securite: int = 0
    score_performance: int = 0
    statut: str = "inconnu"
    created_at: Optional[datetime] = None
    nb_vulns: int = 0
    model_config = {"from_attributes": True}


class VideoEventOut(BaseModel):
    id: int
    type_video: str
    titre: str
    langue: str = "fr"
    nom_projet: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class RapportEventOut(BaseModel):
    id: int
    nom_projet: str
    created_at: Optional[datetime] = None
    nb_pages: Optional[int] = None
    model_config = {"from_attributes": True}


class ActivityStatsOut(BaseModel):
    total_analyses: int = 0
    total_videos: int = 0
    total_rapports: int = 0
    sessions_actives: int = 0
    derniere_activite: Optional[datetime] = None


# ── GET /admin/users/{user_id}/stats ─────────────────────────────

@router.get("/users/{user_id}/stats", response_model=ActivityStatsOut)
def get_user_activity_stats(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Statistiques globales d'activité d'un utilisateur (admin requis)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")

    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    # Analyses : cherche via DepotAnalyse (user_id) + Depot (proprietaire_id)
    analyses_via_da = (
        db.query(func.count(Analyse.id))
        .join(DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id)
        .filter(DepotAnalyse.user_id == user_id)
        .scalar() or 0
    )
    analyses_via_depot = (
        db.query(func.count(Analyse.id))
        .join(Depot, Analyse.depot_id == Depot.id)
        .filter(Depot.proprietaire_id == user_id)
        .scalar() or 0
    )
    total_analyses = analyses_via_da + analyses_via_depot

    # Vidéos
    total_videos = (
        db.query(func.count(VideoGeneree.id))
        .filter(VideoGeneree.user_id == user_id)
        .scalar() or 0
    )

    # Rapports PDF
    total_rapports = (
        db.query(func.count(ExportRapport.id))
        .filter(ExportRapport.user_id == user_id)
        .scalar() or 0
    )

    # Dernière activité : max(dernière analyse, dernière vidéo, dernière connexion)
    derniere_analyse = (
        db.query(func.max(Analyse.created_at))
        .join(DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id)
        .filter(DepotAnalyse.user_id == user_id)
        .scalar()
    )
    derniere_video = (
        db.query(func.max(VideoGeneree.created_at))
        .filter(VideoGeneree.user_id == user_id)
        .scalar()
    )
    derniere_export = (
        db.query(func.max(ExportRapport.created_at))
        .filter(ExportRapport.user_id == user_id)
        .scalar()
    )

    candidates = [d for d in [derniere_analyse, derniere_video, derniere_export] if d]
    derniere_activite = max(candidates) if candidates else None

    return ActivityStatsOut(
        total_analyses=total_analyses,
        total_videos=total_videos,
        total_rapports=total_rapports,
        sessions_actives=0,          # à connecter à un système de session si tu en as un
        derniere_activite=derniere_activite,
    )


# ── GET /admin/users/{user_id}/analyses ──────────────────────────

@router.get("/users/{user_id}/analyses")
def get_user_analyses(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toutes les analyses lancées par un utilisateur."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")

    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    result = []

    # Via DepotAnalyse
    rows_da = (
        db.query(Analyse, DepotAnalyse.nom)
        .join(DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id)
        .filter(DepotAnalyse.user_id == user_id)
        .order_by(Analyse.created_at.desc())
        .all()
    )
    for analyse, depot_nom in rows_da:
        vulns = analyse.vulnerabilites or []
        result.append({
            "id":               analyse.id,
            "depot_nom":        depot_nom or "Inconnu",
            "branche":          analyse.branche or "—",
            "score_qualite":    analyse.score_qualite or 0,
            "score_securite":   analyse.score_securite or 0,
            "score_performance": analyse.score_performance or 0,
            "statut":           analyse.statut or "inconnu",
            "created_at":       str(analyse.created_at) if analyse.created_at else None,
            "nb_vulns":         len(vulns) if isinstance(vulns, list) else 0,
        })

    # Via Depot (ancienne structure)
    rows_d = (
        db.query(Analyse, Depot.nom)
        .join(Depot, Analyse.depot_id == Depot.id)
        .filter(Depot.proprietaire_id == user_id)
        .order_by(Analyse.created_at.desc())
        .all()
    )
    for analyse, depot_nom in rows_d:
        vulns = analyse.vulnerabilites or []
        result.append({
            "id":               analyse.id,
            "depot_nom":        depot_nom or "Inconnu",
            "branche":          analyse.branche or "—",
            "score_qualite":    analyse.score_qualite or 0,
            "score_securite":   analyse.score_securite or 0,
            "score_performance": analyse.score_performance or 0,
            "statut":           analyse.statut or "inconnu",
            "created_at":       str(analyse.created_at) if analyse.created_at else None,
            "nb_vulns":         len(vulns) if isinstance(vulns, list) else 0,
        })

    # Trier par date décroissante
    result.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return result


# ── GET /admin/users/{user_id}/videos ────────────────────────────

@router.get("/users/{user_id}/videos")
def get_user_videos(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toutes les vidéos générées par un utilisateur."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")

    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    videos = (
        db.query(VideoGeneree)
        .filter(VideoGeneree.user_id == user_id)
        .order_by(VideoGeneree.created_at.desc())
        .all()
    )

    return [
        {
            "id":         v.id,
            "type_video": v.type_video,
            "titre":      v.titre,
            "langue":     v.langue or "fr",
            "nom_projet": v.nom_projet,
            "created_at": str(v.created_at) if v.created_at else None,
        }
        for v in videos
    ]


# ── GET /admin/users/{user_id}/rapports ──────────────────────────

@router.get("/users/{user_id}/rapports")
def get_user_rapports(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tous les rapports PDF téléchargés par un utilisateur."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")

    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    exports = (
        db.query(ExportRapport, Analyse)
        .join(Analyse, ExportRapport.analyse_id == Analyse.id)
        .filter(ExportRapport.user_id == user_id)
        .order_by(ExportRapport.created_at.desc())
        .all()
    )

    result = []
    for export, analyse in exports:
        # Récupérer le nom du projet
        nom_projet = "Inconnu"
        if analyse.depot_analyse_id:
            da = db.query(DepotAnalyse).filter(DepotAnalyse.id == analyse.depot_analyse_id).first()
            if da:
                nom_projet = da.nom
        elif analyse.depot_id:
            d = db.query(Depot).filter(Depot.id == analyse.depot_id).first()
            if d:
                nom_projet = d.nom

        # Estimation pages depuis la taille fichier (≈ 50KB/page)
        nb_pages = None
        if export.taille:
            nb_pages = max(1, round(export.taille / 51200))

        result.append({
            "id":         export.id,
            "nom_projet": nom_projet,
            "created_at": str(export.created_at) if export.created_at else None,
            "nb_pages":   nb_pages,
        })

    return result
@router.get("/users/{user_id}/logins")
def get_user_logins(
    user_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
):
    """Retourne l'historique complet des connexions/déconnexions d'un utilisateur."""
    require_admin(authorization, db)
 
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
 
    rows = (
        db.query(LoginEvent)
        .filter(LoginEvent.user_id == user_id)
        .order_by(LoginEvent.created_at.desc())
        .limit(limit)
        .all()
    )
 
    return [{
        "id":          r.id,
        "event_type":  r.event_type,
        "ip_address":  r.ip_address,
        "user_agent":  r.user_agent,
        "success":     r.success,
        "created_at":  r.created_at.isoformat() if r.created_at else None,
        "logout_at":   r.logout_at.isoformat()  if r.logout_at  else None,
    } for r in rows]
 
 
 
