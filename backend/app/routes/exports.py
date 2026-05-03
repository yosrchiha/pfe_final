# backend/app/routes/exports.py
import os
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.config.database import get_db
from app.models.export_rapport import ExportRapport
from app.models.analyse import Analyse
from app.models.depot_analyse import DepotAnalyse
from app.schemas.export_rapport import ExportRapportCreate, ExportRapportResponse
from app.routes.analyses import get_user_id_from_token

router = APIRouter(prefix="/exports", tags=["Exports"])


# ════════════════════════════════════════════════════════
# GET /exports/
# Tous les exports de l'utilisateur connecté
# ════════════════════════════════════════════════════════
@router.get("/", response_model=List[ExportRapportResponse])
def get_exports(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    exports = db.query(ExportRapport).filter(
        ExportRapport.user_id == user_id
    ).order_by(
        ExportRapport.created_at.desc()
    ).all()
    
    return exports


# ════════════════════════════════════════════════════════
# GET /exports/analyse/{analyse_id}
# Exports d'une analyse spécifique
# ════════════════════════════════════════════════════════
@router.get("/analyse/{analyse_id}", response_model=List[ExportRapportResponse])
def get_exports_by_analyse(
    analyse_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    # Vérifier que l'utilisateur a accès à l'analyse
    analyse = db.query(Analyse).join(
        DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id
    ).filter(
        Analyse.id == analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse introuvable")
    
    exports = db.query(ExportRapport).filter(
        ExportRapport.analyse_id == analyse_id
    ).order_by(
        ExportRapport.created_at.desc()
    ).all()
    
    return exports


# ════════════════════════════════════════════════════════
# POST /exports/ (enregistrer un export)
# ════════════════════════════════════════════════════════
@router.post("/", response_model=ExportRapportResponse)
def create_export(
    data: ExportRapportCreate,
    request: Request,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    # Vérifier que l'analyse existe et appartient à l'utilisateur
    analyse = db.query(Analyse).join(
        DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id
    ).filter(
        Analyse.id == data.analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse introuvable")
    
    export = ExportRapport(
        analyse_id=data.analyse_id,
        user_id=user_id,
        format=data.format,
        chemin_fichier=data.chemin_fichier,
        taille=data.taille,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    db.add(export)
    db.commit()
    db.refresh(export)
    
    return export


# ════════════════════════════════════════════════════════
# GET /exports/stats
# Statistiques des exports
# ════════════════════════════════════════════════════════
@router.get("/stats")
def get_export_stats(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    total = db.query(ExportRapport).filter(
        ExportRapport.user_id == user_id
    ).count()
    
    pdf_count = db.query(ExportRapport).filter(
        ExportRapport.user_id == user_id,
        ExportRapport.format == "pdf"
    ).count()
    
    # Exports par mois (derniers 6 mois)
    from sqlalchemy import func
    monthly = db.query(
        func.date_trunc('month', ExportRapport.created_at).label('mois'),
        func.count(ExportRapport.id).label('count')
    ).filter(
        ExportRapport.user_id == user_id
    ).group_by('mois').order_by('mois').limit(6).all()
    
    return {
        "total": total,
        "pdf": pdf_count,
        "docx": total - pdf_count,
        "monthly": [{"mois": str(m.mois)[:7], "count": m.count} for m in monthly]
    }


# ════════════════════════════════════════════════════════
# GET /exports/download/{export_id}
# Télécharger le fichier d'un export (PDF ou DOCX)
# ════════════════════════════════════════════════════════
@router.get("/download/{export_id}")
def download_export(
    export_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)

    export = db.query(ExportRapport).filter(
        ExportRapport.id == export_id,
        ExportRapport.user_id == user_id
    ).first()

    if not export:
        raise HTTPException(status_code=404, detail="Export introuvable")

    if not export.chemin_fichier:
        raise HTTPException(status_code=404, detail="Fichier non disponible")

    # Résoudre le chemin absolu (le fichier peut être relatif au répertoire backend)
    file_path = export.chemin_fichier
    if not os.path.isabs(file_path):
        # Chemin relatif → on cherche depuis le répertoire courant du backend
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        file_path = os.path.join(base_dir, export.chemin_fichier)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail=f"Fichier introuvable sur le serveur : {export.chemin_fichier}"
        )

    fmt = export.format.lower()
    if fmt == "pdf":
        media_type = "application/pdf"
        ext = "pdf"
    elif fmt in ("docx", "word"):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ext = "docx"
    else:
        media_type = "application/octet-stream"
        ext = fmt

    filename = f"rapport_analyse_{export.analyse_id}.{ext}"

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ════════════════════════════════════════════════════════
# DELETE /exports/{export_id}
# Supprimer un export (entrée BDD + fichier disque)
# ════════════════════════════════════════════════════════
@router.delete("/{export_id}")
def delete_export(
    export_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)

    export = db.query(ExportRapport).filter(
        ExportRapport.id == export_id,
        ExportRapport.user_id == user_id
    ).first()

    if not export:
        raise HTTPException(status_code=404, detail="Export introuvable")

    # Supprimer le fichier physique si disponible
    if export.chemin_fichier:
        file_path = export.chemin_fichier
        if not os.path.isabs(file_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            file_path = os.path.join(base_dir, export.chemin_fichier)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass  # Ne pas bloquer si suppression fichier échoue

    db.delete(export)
    db.commit()

    return {"message": "Export supprimé avec succès", "id": export_id}