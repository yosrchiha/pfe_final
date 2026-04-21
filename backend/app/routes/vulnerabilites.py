from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.config.database import get_db
from app.models.vulnerabilite import Vulnerabilite
from app.models.analyse import Analyse
from app.schemas.vulnerabilite import (
    VulnerabiliteCreate,
    VulnerabiliteUpdate,
    VulnerabiliteResponse,
    VulnerabiliteListResponse
)

router = APIRouter(prefix="/vulnerabilites", tags=["Vulnerabilites"])


# ════════════════════════════════════════════════════════
# CRÉER UNE VULNÉRABILITÉ (lors de l'analyse)
# ════════════════════════════════════════════════════════
@router.post("/", response_model=VulnerabiliteResponse)
def creer_vulnerabilite(
    analyse_id: int,
    vuln: VulnerabiliteCreate,
    db: Session = Depends(get_db)
):
    """Crée une nouvelle vulnérabilité pour une analyse."""
    
    # Vérifier que l'analyse existe
    analyse = db.query(Analyse).filter(Analyse.id == analyse_id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse introuvable")
    
    # Créer la vulnérabilité
    new_vuln = Vulnerabilite(
        analyse_id=analyse_id,
        type=vuln.type,
        severite=vuln.severite,
        description=vuln.description,
        suggestion=vuln.suggestion,
        fichier=vuln.fichier,
        ligne=vuln.ligne,
        colonne=vuln.colonne,
        categorie_owasp=vuln.categorie_owasp,
        cwe_id=vuln.cwe_id,
        code_snippet=vuln.code_snippet,
        impact=vuln.impact,
    )
    
    db.add(new_vuln)
    db.commit()
    db.refresh(new_vuln)
    
    return new_vuln


# ════════════════════════════════════════════════════════
# LISTER LES VULNÉRABILITÉS D'UNE ANALYSE
# ════════════════════════════════════════════════════════
@router.get("/analyse/{analyse_id}", response_model=List[VulnerabiliteResponse])
def lister_vulnerabilites_analyse(
    analyse_id: int,
    db: Session = Depends(get_db)
):
    """Récupère toutes les vulnérabilités d'une analyse."""
    
    # Vérifier que l'analyse existe
    analyse = db.query(Analyse).filter(Analyse.id == analyse_id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse introuvable")
    
    vulns = db.query(Vulnerabilite).filter(
        Vulnerabilite.analyse_id == analyse_id
    ).order_by(Vulnerabilite.severite.desc(), Vulnerabilite.ligne.asc()).all()
    
    return vulns


# ════════════════════════════════════════════════════════
# RÉCUPÉRER UNE VULNÉRABILITÉ SPÉCIFIQUE
# ════════════════════════════════════════════════════════
@router.get("/{vuln_id}", response_model=VulnerabiliteResponse)
def get_vulnerabilite(
    vuln_id: int,
    db: Session = Depends(get_db)
):
    """Récupère les détails d'une vulnérabilité."""
    
    vuln = db.query(Vulnerabilite).filter(Vulnerabilite.id == vuln_id).first()
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable")
    
    return vuln


# ════════════════════════════════════════════════════════
# METTRE À JOUR LE STATUT D'UNE VULNÉRABILITÉ
# ════════════════════════════════════════════════════════
@router.patch("/{vuln_id}", response_model=VulnerabiliteResponse)
def update_vulnerabilite(
    vuln_id: int,
    update: VulnerabiliteUpdate,
    db: Session = Depends(get_db)
):
    """Met à jour une vulnérabilité (statut, suggestion, etc.)."""
    
    vuln = db.query(Vulnerabilite).filter(Vulnerabilite.id == vuln_id).first()
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable")
    
    # Mettre à jour les champs fournis
    if update.statut is not None:
        vuln.statut = update.statut
    if update.suggestion is not None:
        vuln.suggestion = update.suggestion
    if update.description is not None:
        vuln.description = update.description
    
    db.commit()
    db.refresh(vuln)
    
    return vuln


# ════════════════════════════════════════════════════════
# SUPPRIMER UNE VULNÉRABILITÉ
# ════════════════════════════════════════════════════════
@router.delete("/{vuln_id}", status_code=204)
def delete_vulnerabilite(
    vuln_id: int,
    db: Session = Depends(get_db)
):
    """Supprime une vulnérabilité."""
    
    vuln = db.query(Vulnerabilite).filter(Vulnerabilite.id == vuln_id).first()
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable")
    
    db.delete(vuln)
    db.commit()


# ════════════════════════════════════════════════════════
# STATISTIQUES DES VULNÉRABILITÉS
# ════════════════════════════════════════════════════════
@router.get("/analyse/{analyse_id}/stats")
def get_stats_vulnerabilites(
    analyse_id: int,
    db: Session = Depends(get_db)
):
    """Récupère les statistiques des vulnérabilités d'une analyse."""
    
    # Vérifier que l'analyse existe
    analyse = db.query(Analyse).filter(Analyse.id == analyse_id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse introuvable")
    
    vulns = db.query(Vulnerabilite).filter(
        Vulnerabilite.analyse_id == analyse_id
    ).all()
    
    stats = {
        "total": len(vulns),
        "critiques": len([v for v in vulns if v.severite == "CRITIQUE"]),
        "hautes": len([v for v in vulns if v.severite == "HAUTE"]),
        "moyennes": len([v for v in vulns if v.severite == "MOYENNE"]),
        "faibles": len([v for v in vulns if v.severite == "FAIBLE"]),
        "detectees": len([v for v in vulns if v.statut == "detectee"]),
        "confirmees": len([v for v in vulns if v.statut == "confirmee"]),
        "corrigees": len([v for v in vulns if v.statut == "corrigee"]),
        "faux_positifs": len([v for v in vulns if v.statut == "faux_positif"]),
    }
    
    return stats