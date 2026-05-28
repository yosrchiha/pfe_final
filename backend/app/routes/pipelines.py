"""Routes dédiées à la configuration CI/CD des dépôts analysés."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.depot_analyse import DepotAnalyse
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.pipeline import (
    PipelineDepotResponse,
    PipelinePreviewRequest,
    PipelinePreviewResponse,
    PipelinePublishRequest,
    PipelinePublishResponse,
    PipelineStatusResponse,
    PipelineHistoryItemResponse,
    PipelineHistoryResponse,
)
from app.services.pipeline_service import (
    ExistingPipelineError,
    PipelineServiceError,
    build_preview,
    get_latest_pipeline_status,
    get_pipeline_details,
    get_pipeline_history,
    publish_pipeline_merge_request,
)

router = APIRouter(prefix="/pipelines", tags=["Pipelines CI/CD"])


def _get_owned_depot(depot_id: int, user_id: int, db: Session) -> DepotAnalyse:
    depot = (
        db.query(DepotAnalyse)
        .filter(DepotAnalyse.id == depot_id, DepotAnalyse.user_id == user_id)
        .first()
    )
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt analysé introuvable")
    if not depot.gitlab_token:
        raise HTTPException(status_code=400, detail="Token GitLab indisponible pour ce dépôt")
    return depot


@router.get("/depots", response_model=list[PipelineDepotResponse])
def list_pipeline_depots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste uniquement les dépôts analysés appartenant à l'utilisateur connecté."""
    depots = (
        db.query(DepotAnalyse)
        .filter(DepotAnalyse.user_id == current_user.id)
        .order_by(DepotAnalyse.created_at.desc())
        .all()
    )
    return [
        PipelineDepotResponse(
            id=depot.id,
            nom=depot.nom,
            project_url=depot.project_url,
            branche=depot.branche or "main",
        )
        for depot in depots
    ]


@router.post("/preview", response_model=PipelinePreviewResponse)
def preview_pipeline(
    request: PipelinePreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Génère une proposition YAML sans écrire dans GitLab."""
    depot = _get_owned_depot(request.depot_analyse_id, current_user.id, db)
    target_branch = (request.target_branch or depot.branche or "main").strip()
    try:
        result = build_preview(
            depot.gitlab_token,
            depot.project_url,
            target_branch,
            tests_enabled=request.tests_enabled,
            coverage_enabled=request.coverage_enabled,
            security_enabled=request.security_enabled,
            quality_enabled=request.quality_enabled,
            coverage_threshold=request.coverage_threshold,
        )
        return PipelinePreviewResponse(depot_analyse_id=depot.id, **result)
    except PipelineServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erreur GitLab : {exc}") from exc


@router.post("/publish", response_model=PipelinePublishResponse)
def publish_pipeline(
    request: PipelinePublishRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Publie le pipeline dans une branche dédiée et ouvre une MR GitLab."""
    depot = _get_owned_depot(request.depot_analyse_id, current_user.id, db)
    target_branch = (request.target_branch or depot.branche or "main").strip()
    try:
        result = publish_pipeline_merge_request(
            depot.gitlab_token,
            depot.project_url,
            target_branch,
            tests_enabled=request.tests_enabled,
            coverage_enabled=request.coverage_enabled,
            security_enabled=request.security_enabled,
            quality_enabled=request.quality_enabled,
            coverage_threshold=request.coverage_threshold,
            replace_existing_pipeline=request.replace_existing_pipeline,
        )
        return PipelinePublishResponse(depot_analyse_id=depot.id, **result)
    except ExistingPipelineError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PipelineServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erreur GitLab : {exc}") from exc


@router.get("/status/{depot_analyse_id}", response_model=PipelineStatusResponse)
def pipeline_status(
    depot_analyse_id: int,
    ref: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne le dernier état GitLab CI/CD d'une branche créée par l'utilisateur."""
    depot = _get_owned_depot(depot_analyse_id, current_user.id, db)
    try:
        result = get_latest_pipeline_status(depot.gitlab_token, depot.project_url, ref)
        return PipelineStatusResponse(depot_analyse_id=depot.id, **result)
    except PipelineServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erreur GitLab : {exc}") from exc

@router.get("/history/{depot_analyse_id}", response_model=PipelineHistoryResponse)
def pipeline_history(
    depot_analyse_id: int,
    limit: int = Query(default=5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste les dernières exécutions GitLab CI/CD et leurs jobs pour le dépôt choisi."""
    depot = _get_owned_depot(depot_analyse_id, current_user.id, db)
    try:
        result = get_pipeline_history(depot.gitlab_token, depot.project_url, limit)
        return PipelineHistoryResponse(depot_analyse_id=depot.id, **result)
    except PipelineServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erreur GitLab : {exc}") from exc


@router.get("/history/{depot_analyse_id}/{pipeline_id}", response_model=PipelineHistoryItemResponse)
def pipeline_details(
    depot_analyse_id: int,
    pipeline_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne les jobs réels d'une exécution GitLab CI/CD précise."""
    depot = _get_owned_depot(depot_analyse_id, current_user.id, db)
    try:
        result = get_pipeline_details(depot.gitlab_token, depot.project_url, pipeline_id)
        return PipelineHistoryItemResponse(**result)
    except PipelineServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erreur GitLab : {exc}") from exc

