# backend/app/routes/issues.py

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.issue_gitlab import IssueGitLab
from app.models.depot_analyse import DepotAnalyse
from app.routes.analyses import get_user_id_from_token

router = APIRouter(prefix="/issues", tags=["Issues GitLab"])


# ════════════════════════════════════════════════════════
# UTILITAIRE — Format de réponse standard pour une issue
# ════════════════════════════════════════════════════════
def _format_issue(i: IssueGitLab) -> dict:
    return {
        "id"              : i.id,
        "analyse_id"      : i.analyse_id,
        "depot_analyse_id": i.depot_analyse_id,
        "issue_id_gitlab" : i.issue_id_gitlab,
        "issue_url"       : i.issue_url,
        "titre"           : i.titre,
        "description"     : i.description,
        "severite"        : i.severite,
        "type_vuln"       : i.type_vuln,
        "fichier"         : i.fichier,
        "ligne"           : i.ligne,
        "statut"          : i.statut,
        "labels"          : i.labels,
        "created_at"      : str(i.created_at),
        "updated_at"      : str(i.updated_at) if i.updated_at else None,
    }


# ════════════════════════════════════════════════════════
# GET /issues/ — Toutes les issues de l'utilisateur connecté
# ════════════════════════════════════════════════════════
@router.get("/")
def get_issues(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    depots = db.query(DepotAnalyse).filter(DepotAnalyse.user_id == user_id).all()
    depot_ids = [d.id for d in depots]
    if not depot_ids:
        return []
    issues = db.query(IssueGitLab).filter(
        IssueGitLab.depot_analyse_id.in_(depot_ids)
    ).order_by(IssueGitLab.created_at.desc()).all()
    return [_format_issue(i) for i in issues]


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
    depot = db.query(DepotAnalyse).filter(
        DepotAnalyse.id == issues[0].depot_analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    if not depot:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    return [_format_issue(i) for i in issues]


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
    depot = db.query(DepotAnalyse).filter(
        DepotAnalyse.id == depot_analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt introuvable")
    issues = db.query(IssueGitLab).filter(
        IssueGitLab.depot_analyse_id == depot_analyse_id
    ).order_by(IssueGitLab.created_at.desc()).all()
    return [_format_issue(i) for i in issues]


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
    depot = db.query(DepotAnalyse).filter(
        DepotAnalyse.id == issue.depot_analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    if not depot:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    return _format_issue(issue)


# ════════════════════════════════════════════════════════
# PUT /issues/{issue_id}/close — Fermer depuis l'app → GitLab
# ════════════════════════════════════════════════════════
@router.put("/{issue_id}/close")
def close_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    """Ferme l'issue dans GitLab ET met à jour la base."""
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
    if not depot.gitlab_token:
        raise HTTPException(status_code=400, detail="Token GitLab manquant pour ce dépôt")

    try:
        project      = get_gitlab_project(depot.gitlab_token, depot.project_url)
        gitlab_issue = project.issues.get(issue.issue_id_gitlab)

        if gitlab_issue.state != "closed":
            gitlab_issue.state_event = "close"
            gitlab_issue.save()

        issue.statut = "closed"
        db.commit()
        db.refresh(issue)
        print(f"[ISSUES] ✅ Issue #{issue.issue_id_gitlab} fermée sur GitLab et en base")
        return {**_format_issue(issue), "message": "Issue fermée sur GitLab"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur fermeture GitLab : {str(e)}")


# ════════════════════════════════════════════════════════
# PUT /issues/{issue_id}/reopen — Rouvrir depuis l'app → GitLab
# ════════════════════════════════════════════════════════
@router.put("/{issue_id}/reopen")
def reopen_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    """Rouvre l'issue dans GitLab ET met à jour la base."""
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
    if not depot.gitlab_token:
        raise HTTPException(status_code=400, detail="Token GitLab manquant pour ce dépôt")

    try:
        project      = get_gitlab_project(depot.gitlab_token, depot.project_url)
        gitlab_issue = project.issues.get(issue.issue_id_gitlab)

        if gitlab_issue.state != "opened":
            gitlab_issue.state_event = "reopen"
            gitlab_issue.save()

        issue.statut = "opened"
        db.commit()
        db.refresh(issue)
        print(f"[ISSUES] ✅ Issue #{issue.issue_id_gitlab} rouverte sur GitLab et en base")
        return {**_format_issue(issue), "message": "Issue rouverte sur GitLab"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur réouverture GitLab : {str(e)}")


# ════════════════════════════════════════════════════════
# PATCH /issues/{issue_id}/sync — Sync manuelle GitLab → App
# ════════════════════════════════════════════════════════
@router.patch("/{issue_id}/sync")
def sync_issue_status(
    issue_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    """Lit le statut réel depuis GitLab et met à jour la base."""
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
        project      = get_gitlab_project(depot.gitlab_token, depot.project_url)
        gitlab_issue = project.issues.get(issue.issue_id_gitlab)
        old_statut   = issue.statut
        issue.statut = gitlab_issue.state
        db.commit()
        db.refresh(issue)
        return {
            **_format_issue(issue),
            "synced"        : True,
            "statut_avant"  : old_statut,
            "statut_gitlab" : gitlab_issue.state,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur synchronisation: {str(e)}")


# ════════════════════════════════════════════════════════
# POST /issues/webhook — GitLab → App (temps réel automatique)
# ════════════════════════════════════════════════════════
@router.post("/webhook")
async def gitlab_issue_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Webhook GitLab — reçoit les événements d'issue en temps réel.
    Configurer dans GitLab : Settings → Webhooks → cocher 'Issues events'
    URL : https://votre-domaine/issues/webhook

    Gère les actions : open, close, reopen
    """
    payload = await request.json()

    if payload.get("object_kind") != "issue":
        return {"message": "Ignored — not an issue event"}

    issue_attrs  = payload.get("object_attributes", {})
    issue_iid    = issue_attrs.get("iid")
    gitlab_state = issue_attrs.get("state")   # "opened" | "closed"
    project_info = payload.get("project", {})
    project_url  = project_info.get("path_with_namespace", "")

    if not issue_iid:
        return {"message": "Ignored — no issue iid"}

    print(f"[WEBHOOK ISSUE] action={issue_attrs.get('action')} | iid={issue_iid} | state={gitlab_state} | projet={project_url}")

    # Trouver les issues correspondantes en base
    issues_db = db.query(IssueGitLab).filter(
        IssueGitLab.issue_id_gitlab == issue_iid
    ).all()

    if not issues_db:
        print(f"[WEBHOOK ISSUE] ⚠️ Issue iid={issue_iid} non trouvée en base")
        return {"message": "Issue not found in local DB"}

    updated = 0
    for issue in issues_db:
        # Vérifier le projet si possible
        if project_url:
            depot = db.query(DepotAnalyse).filter(
                DepotAnalyse.id == issue.depot_analyse_id
            ).first()
            if depot and depot.project_url:
                from app.services.gitlab_client import _clean_project_name
                if _clean_project_name(depot.project_url) != _clean_project_name(project_url):
                    continue  # Pas le bon projet → skip

        old_statut   = issue.statut
        issue.statut = gitlab_state
        updated += 1
        print(f"[WEBHOOK ISSUE] ✅ Issue id={issue.id} : {old_statut} → {gitlab_state}")

    if updated > 0:
        db.commit()

    return {
        "message"       : f"{updated} issue(s) mise(s) à jour",
        "iid"           : issue_iid,
        "nouveau_statut": gitlab_state,
    }
