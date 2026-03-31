# backend/app/routes/issues.py

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from app.config.database import get_db
from app.models.issue_gitlab import IssueGitLab
from app.models.depot_analyse import DepotAnalyse
from app.models.user import User
from app.schemas.issue_gitlab import IssueGitLabResponse
from app.routes.analyses import get_user_id_from_token

router = APIRouter(prefix="/issues", tags=["Issues GitLab"])


# ════════════════════════════════════════════════════════
# GET /issues/ — Toutes les issues de l'utilisateur connecté
# ════════════════════════════════════════════════════════
@router.get("/")
def get_issues(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    """
    Récupère toutes les issues de l'utilisateur connecté.
    """
    # 1. Récupérer l'ID de l'utilisateur connecté
    user_id = get_user_id_from_token(authorization, db)
    print(f"[ISSUES] 🔍 Utilisateur connecté : user_id = {user_id}")
    
    # 2. Récupérer tous les dépôts de cet utilisateur
    depots = db.query(DepotAnalyse).filter(DepotAnalyse.user_id == user_id).all()
    depot_ids = [d.id for d in depots]
    print(f"[ISSUES] 📁 Dépôts trouvés pour user {user_id} : {depot_ids}")
    
    if not depot_ids:
        print(f"[ISSUES] ⚠️ Aucun dépôt trouvé pour l'utilisateur {user_id}")
        return []
    
    # 3. Récupérer les issues liées à ces dépôts
    issues = db.query(IssueGitLab).filter(
        IssueGitLab.depot_analyse_id.in_(depot_ids)
    ).order_by(
        IssueGitLab.created_at.desc()
    ).all()
    
    print(f"[ISSUES] ✅ {len(issues)} issue(s) trouvée(s)")
    
    # 4. Formater la réponse (sans schéma Pydantic pour l'instant)
    return [
        {
            "id": i.id,
            "analyse_id": i.analyse_id,
            "depot_analyse_id": i.depot_analyse_id,
            "issue_id_gitlab": i.issue_id_gitlab,
            "issue_url": i.issue_url,
            "titre": i.titre,
            "description": i.description,
            "severite": i.severite,
            "type_vuln": i.type_vuln,
            "fichier": i.fichier,
            "ligne": i.ligne,
            "statut": i.statut,
            "labels": i.labels,
            "created_at": str(i.created_at),
            "updated_at": str(i.updated_at) if i.updated_at else None,
        }
        for i in issues
    ]


# ════════════════════════════════════════════════════════
# GET /issues/depot/{depot_analyse_id} — Issues d'un dépôt
# ════════════════════════════════════════════════════════
@router.get("/depot/{depot_analyse_id}")
def get_issues_by_depot(
    depot_analyse_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    # Vérifier que le dépôt appartient à l'utilisateur
    depot = db.query(DepotAnalyse).filter(
        DepotAnalyse.id == depot_analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt introuvable")
    
    issues = db.query(IssueGitLab).filter(
        IssueGitLab.depot_analyse_id == depot_analyse_id
    ).order_by(IssueGitLab.created_at.desc()).all()
    
    return [
        {
            "id": i.id,
            "titre": i.titre,
            "severite": i.severite,
            "fichier": i.fichier,
            "ligne": i.ligne,
            "suggestion": i.description,
            "issue_url": i.issue_url,
            "statut": i.statut,
            "created_at": str(i.created_at),
        }
        for i in issues
    ]


# ════════════════════════════════════════════════════════
# GET /issues/analyse/{analyse_id} — Issues d'une analyse
# ════════════════════════════════════════════════════════
@router.get("/analyse/{analyse_id}")
def get_issues_by_analyse(
    analyse_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    issues = db.query(IssueGitLab).filter(
        IssueGitLab.analyse_id == analyse_id
    ).all()
    
    if not issues:
        return []
    
    # Vérifier que l'utilisateur a accès
    depot = db.query(DepotAnalyse).filter(
        DepotAnalyse.id == issues[0].depot_analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    
    if not depot:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    return [
        {
            "id": i.id,
            "titre": i.titre,
            "severite": i.severite,
            "fichier": i.fichier,
            "ligne": i.ligne,
            "suggestion": i.description,
            "issue_url": i.issue_url,
            "statut": i.statut,
            "created_at": str(i.created_at),
        }
        for i in issues
    ]


# ════════════════════════════════════════════════════════
# GET /issues/{issue_id} — Détail d'une issue
# ════════════════════════════════════════════════════════
@router.get("/{issue_id}")
def get_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    issue = db.query(IssueGitLab).filter(IssueGitLab.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue introuvable")
    
    # Vérifier que l'utilisateur a accès
    depot = db.query(DepotAnalyse).filter(
        DepotAnalyse.id == issue.depot_analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    
    if not depot:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    return {
        "id": issue.id,
        "analyse_id": issue.analyse_id,
        "depot_analyse_id": issue.depot_analyse_id,
        "issue_id_gitlab": issue.issue_id_gitlab,
        "issue_url": issue.issue_url,
        "titre": issue.titre,
        "description": issue.description,
        "severite": issue.severite,
        "type_vuln": issue.type_vuln,
        "fichier": issue.fichier,
        "ligne": issue.ligne,
        "statut": issue.statut,
        "labels": issue.labels,
        "created_at": str(issue.created_at),
        "updated_at": str(issue.updated_at) if issue.updated_at else None,
    }


# ════════════════════════════════════════════════════════
# PATCH /issues/{issue_id}/sync — Synchroniser avec GitLab
# ════════════════════════════════════════════════════════
@router.patch("/{issue_id}/sync")
def sync_issue_status(
    issue_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    from app.services.gitlab_client import get_gitlab_project
    
    user_id = get_user_id_from_token(authorization, db)
    
    issue = db.query(IssueGitLab).filter(IssueGitLab.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue introuvable")
    
    depot = db.query(DepotAnalyse).filter(
        DepotAnalyse.id == issue.depot_analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    
    if not depot:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    try:
        project = get_gitlab_project(depot.gitlab_token, depot.project_url)
        gitlab_issue = project.issues.get(issue.issue_id_gitlab)
        
        issue.statut = gitlab_issue.state
        db.commit()
        
        return {
            "issue_id": issue.id,
            "statut": issue.statut,
            "gitlab_state": gitlab_issue.state
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur synchronisation: {str(e)}")