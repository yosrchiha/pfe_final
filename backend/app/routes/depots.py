from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.models.depot import Depot
from app.schemas.depot import DepotCreate, DepotResponse, DepotUpdate
from app.config.database import SessionLocal
from app.routes.auth import get_current_user
from app.models.user import User
from app.services.llm_service import analyser_code
from app.services.gitlab_client import compare_branches, get_project_files, get_gitlab_project
from app.models.comparaison import Comparaison 
from app.models.analyse_diff import AnalyseDiff
from app.models.merge_request_diff import MergeRequestDiff

router = APIRouter(prefix="/depots", tags=["Depots"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── POST / ────────────────────────────────────────────────────────
@router.post("/", response_model=DepotResponse)
def create_depot(
    depot: DepotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_depot = Depot(
        nom=depot.nom,
        url_branche_principale=depot.url_branche_principale,
        url_branche_developpement=depot.url_branche_developpement,
        token_gitlab=depot.token_gitlab,
        proprietaire_id=current_user.id
    )
    db.add(db_depot)
    db.commit()
    db.refresh(db_depot)
    return db_depot


# ── GET / ─────────────────────────────────────────────────────────
@router.get("/", response_model=List[DepotResponse])
def list_depots(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Depot).offset(skip).limit(limit).all()


# ── GET /user/{user_id} ──────────────────────────────────────────
@router.get("/user/{user_id}", response_model=List[DepotResponse])
def get_user_depots(user_id: int, db: Session = Depends(get_db)):
    depots = db.query(Depot).filter(Depot.proprietaire_id == user_id).all()
    if not depots:
        raise HTTPException(status_code=404, detail="Aucun dépôt trouvé pour cet utilisateur")
    return depots


# ── GET /{depot_id} ───────────────────────────────────────────────
@router.get("/{depot_id}", response_model=DepotResponse)
def get_depot(depot_id: int, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")
    return depot


# ── PUT /{depot_id} ───────────────────────────────────────────────
@router.put("/{depot_id}", response_model=DepotResponse)
def update_depot(depot_id: int, depot_update: DepotUpdate, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")

    for field, value in depot_update.model_dump(exclude_unset=True).items():
        setattr(depot, field, value)

    db.commit()
    db.refresh(depot)
    return depot


# ── DELETE /{depot_id} ────────────────────────────────────────────
@router.delete("/{depot_id}")
def delete_depot(depot_id: int, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")
    db.delete(depot)
    db.commit()
    return {"detail": "Dépôt supprimé avec succès"}


# ── GET /{depot_id}/compare ───────────────────────────────────────
@router.get("/{depot_id}/compare")
def compare_depot(
    depot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Compare les deux branches du dépôt et stocke le résultat dans la table comparaisons.
    """
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")

    try:
        result = compare_branches(
            token=depot.token_gitlab,
            project_name=depot.nom,
            from_branch=depot.url_branche_principale,
            to_branch=depot.url_branche_developpement
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        nouvelle_comparaison = Comparaison(
            depot_id=depot.id,
            from_branch=depot.url_branche_principale,
            to_branch=depot.url_branche_developpement,
            commits_count=result.get("commits_count", 0),
            files_json=result.get("files", [])
        )
        db.add(nouvelle_comparaison)
        db.commit()
        print(f"[DEBUG] Comparaison stockée en base avec ID: {nouvelle_comparaison.id}")
    except Exception as e:
        print(f"[ERROR] Erreur stockage comparaison: {e}")
        db.rollback()

    return result


# ── GET /{depot_id}/files ─────────────────────────────────────────
@router.get("/{depot_id}/files")
def get_depot_files(
    depot_id: int,
    branch: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")

    target_branch = branch or depot.url_branche_principale

    try:
        fichiers = get_project_files(
            token=depot.token_gitlab,
            project_name=depot.nom,
            branch=target_branch,
            extensions=[".py", ".js", ".ts", ".java", ".go", ".rb", ".php", ".cpp", ".cs"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "depot_id": depot_id,
        "branch": target_branch,
        "total_files": len(fichiers),
        "files": fichiers
    }


# ── POST /{depot_id}/analyser-diff ────────────────────────────────
class AnalyserDiffRequest(BaseModel):
    owasp_enabled: bool = True


@router.post("/{depot_id}/analyser-diff")
def analyser_diff_depot(
    depot_id: int,
    data: AnalyserDiffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Compare les branches et analyse le diff avec l'IA.
    Si aucune vulnérabilité critique, crée automatiquement une MR.
    """
    from datetime import datetime
    
    # 1. Récupérer le dépôt
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")
    
    # 2. Comparer les branches
    print(f"[COMPARE] Comparaison des branches: {depot.url_branche_principale} → {depot.url_branche_developpement}")
    
    try:
        compare_result = compare_branches(
            token=depot.token_gitlab,
            project_name=depot.nom,
            from_branch=depot.url_branche_principale,
            to_branch=depot.url_branche_developpement
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur comparaison: {str(e)}")
    
    # 3. Créer la comparaison en base
    nouvelle_comparaison = Comparaison(
        depot_id=depot.id,
        from_branch=depot.url_branche_principale,
        to_branch=depot.url_branche_developpement,
        commits_count=compare_result.get("commits_count", 0),
        files_json=compare_result.get("files", [])
    )
    db.add(nouvelle_comparaison)
    db.flush()
    
    # 4. Créer l'analyse en base (statut en_cours)
    analyse = AnalyseDiff(
        comparaison_id=nouvelle_comparaison.id,
        statut="en_cours"
    )
    db.add(analyse)
    db.commit()
    
    # 5. Vérifier s'il y a des changements
    if not compare_result.get("files") or len(compare_result["files"]) == 0:
        analyse.statut = "termine"
        analyse.resultat_statut = "aucun_changement"
        analyse.completed_at = datetime.utcnow()
        db.commit()
        
        return {
            "analyse_id": analyse.id,
            "comparaison_id": nouvelle_comparaison.id,
            "statut": "aucun_changement",
            "message": "Aucune différence détectée entre les branches",
            "project": compare_result.get("project"),
            "from_branch": compare_result.get("from_branch"),
            "to_branch": compare_result.get("to_branch"),
            "commits_count": compare_result.get("commits_count", 0),
            "files": []
        }
    
    # 6. Analyser les fichiers avec l'IA
    print(f"[IA] Analyse du diff avec LLM...")
    
    fichiers_llm = []
    for f in compare_result["files"]:
        contenu = f.get("diff") or f.get("content") or ""
        if contenu.strip():
            fichiers_llm.append({
                "file_path": f.get("path", "inconnu"),
                "content": contenu
            })
    
    try:
        resultat_ia = analyser_code(fichiers_llm, data.owasp_enabled)
    except Exception as e:
        analyse.statut = "erreur"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Erreur analyse IA: {str(e)}")
    
    # 7. Identifier les vulnérabilités bloquantes
    BLOQUANTES = {"CRITIQUE", "HAUTE"}
    vulnerabilites = resultat_ia.get("vulnerabilites", [])
    vulns_bloquantes = [
        v for v in vulnerabilites
        if v.get("severite", "").upper() in BLOQUANTES
    ]
    
    # 8. Mettre à jour l'analyse avec les résultats
    analyse.score_qualite = resultat_ia.get("score_qualite", 0)
    analyse.score_securite = resultat_ia.get("score_securite", 0)
    analyse.score_performance = resultat_ia.get("score_performance", 0)
    analyse.vulnerabilites = vulnerabilites
    analyse.vulnerabilites_bloquantes = vulns_bloquantes
    analyse.recommandations = resultat_ia.get("recommandations", [])
    
    # 9. Décision du merge
    if len(vulns_bloquantes) == 0:
        print(f"[MERGE] Merge autorisé - création de la MR...")
        
        try:
            project = get_gitlab_project(depot.token_gitlab, depot.nom)
            mr = project.mergerequests.create({
                "source_branch": depot.url_branche_developpement,
                "target_branch": depot.url_branche_principale,
                "title": f"✅ Auto-merge IA : {depot.url_branche_developpement} → {depot.url_branche_principale}",
                "description": f"""
## Merge Request créée automatiquement par AuditPlatform

### Résultat de l'analyse IA du diff
| Critère | Score |
|---|---|
| Qualité | {resultat_ia.get('score_qualite', 0)}/100 |
| Sécurité | {resultat_ia.get('score_securite', 0)}/100 |
| Performance | {resultat_ia.get('score_performance', 0)}/100 |

### Conclusion
Aucune vulnérabilité **CRITIQUE** ou **HAUTE** détectée.

> Généré automatiquement par **AuditPlatform** · LLM Groq
                """,
                "labels": ["auto-merge", "IA", "securite-ok"]
            })
            
            analyse.resultat_statut = "merge_autorise"
            analyse.mr_created = 1
            analyse.mr_id = mr.iid
            analyse.mr_url = mr.web_url
            analyse.mr_title = mr.title
            
            # Stocker la MR en base
            merge_request_db = MergeRequestDiff(
                analyse_diff_id=analyse.id,
                depot_id=depot.id,
                mr_id_gitlab=mr.id,
                mr_iid_gitlab=mr.iid,
                mr_url=mr.web_url,
                title=mr.title,
                description=mr.description,
                source_branch=depot.url_branche_developpement,
                target_branch=depot.url_branche_principale,
                state=mr.state,
                type_mr="auto"
            )
            db.add(merge_request_db)
            
        except Exception as e:
            analyse.resultat_statut = "erreur_creation_mr"
            db.commit()
            raise HTTPException(status_code=500, detail=f"Erreur création MR: {str(e)}")
    
    else:
        print(f"[MERGE] Merge bloqué - {len(vulns_bloquantes)} vulnérabilité(s) critique(s)")
        analyse.resultat_statut = "merge_bloque"
        analyse.mr_created = 0
    
    analyse.statut = "termine"
    analyse.completed_at = datetime.utcnow()
    db.commit()
    
    return {
        "analyse_id": analyse.id,
        "comparaison_id": nouvelle_comparaison.id,
        "statut": analyse.resultat_statut,
        "message": "Analyse terminée",
        "project": compare_result.get("project"),
        "from_branch": compare_result.get("from_branch"),
        "to_branch": compare_result.get("to_branch"),
        "commits_count": compare_result.get("commits_count", 0),
        "files": compare_result.get("files", []),
        "score_qualite": analyse.score_qualite,
        "score_securite": analyse.score_securite,
        "score_performance": analyse.score_performance,
        "vulnerabilites": analyse.vulnerabilites,
        "vulnerabilites_bloquantes": analyse.vulnerabilites_bloquantes,
        "recommandations": analyse.recommandations,
        "mr": {
            "mr_id": analyse.mr_id,
            "mr_url": analyse.mr_url,
            "titre": analyse.mr_title
        } if analyse.mr_created else None
    }


# ── POST /{depot_id}/creer-mr-force ────────────────────────────────
class CreerMRForceRequest(BaseModel):
    analyse_id: int


@router.post("/{depot_id}/creer-mr-force")
def creer_mr_force(
    depot_id: int,
    data: CreerMRForceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crée une MR même si des vulnérabilités bloquantes ont été détectées.
    """
    from datetime import datetime
    
    # 1. Récupérer l'analyse
    analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == data.analyse_id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    # 2. Récupérer la comparaison
    comparaison = db.query(Comparaison).filter(Comparaison.id == analyse.comparaison_id).first()
    if not comparaison:
        raise HTTPException(status_code=404, detail="Comparaison non trouvée")
    
    # 3. Récupérer le dépôt
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")
    
    # 4. Créer ou récupérer la MR sur GitLab
    try:
        project = get_gitlab_project(depot.token_gitlab, depot.nom)
        
        # Vérifier si une MR existe déjà
        existing_mrs = project.mergerequests.list(
            source_branch=depot.url_branche_developpement,
            target_branch=depot.url_branche_principale,
            state='opened'
        )
        
        if existing_mrs:
            # Utiliser la MR existante
            mr = existing_mrs[0]
            print(f"[MERGE] MR existante trouvée: !{mr.iid}")
        else:
            # Créer une nouvelle MR
            mr = project.mergerequests.create({
                "source_branch": depot.url_branche_developpement,
                "target_branch": depot.url_branche_principale,
                "title": f"⚠️ Auto-merge IA (forcé) : {depot.url_branche_developpement} → {depot.url_branche_principale}",
                "description": f"""
## Merge Request créée automatiquement par AuditPlatform (FORCÉE)

### Résultat de l'analyse IA du diff
| Critère | Score |
|---|---|
| Qualité | {analyse.score_qualite}/100 |
| Sécurité | {analyse.score_securite}/100 |
| Performance | {analyse.score_performance}/100 |

### Vulnérabilités détectées (IGNORÉES)
{analyse.vulnerabilites_bloquantes}

### ⚠️ ATTENTION
Cette MR a été créée malgré la présence de vulnérabilités CRITIQUES ou HAUTES.
La fusion est déconseillée sans correction préalable.

> Généré automatiquement par **AuditPlatform** · LLM Groq
                """,
                "labels": ["auto-merge", "IA", "securite-ok", "force-merge"]
            })
        
        # 5. Mettre à jour l'analyse
        analyse.mr_created = 1
        analyse.mr_id = mr.iid
        analyse.mr_url = mr.web_url
        analyse.mr_title = mr.title
        analyse.resultat_statut = "merge_autorise_force"
        analyse.completed_at = datetime.utcnow()
        
        # 6. Vérifier si la MR existe déjà en base
        existing_mr_db = db.query(MergeRequestDiff).filter(
            MergeRequestDiff.analyse_diff_id == analyse.id
        ).first()
        
        if not existing_mr_db:
            # Stocker la MR en base
            merge_request_db = MergeRequestDiff(
                analyse_diff_id=analyse.id,
                depot_id=depot.id,
                mr_id_gitlab=mr.id,
                mr_iid_gitlab=mr.iid,
                mr_url=mr.web_url,
                title=mr.title,
                description=mr.description,
                source_branch=depot.url_branche_developpement,
                target_branch=depot.url_branche_principale,
                state=mr.state,
                type_mr="force"
            )
            db.add(merge_request_db)
        else:
            # Mettre à jour la MR existante
            existing_mr_db.state = mr.state
            existing_mr_db.mr_url = mr.web_url
            existing_mr_db.title = mr.title
            existing_mr_db.description = mr.description
        
        db.commit()
        
        return {
            "statut": "merge_autorise",
            "message": "MR récupérée ou créée",
            "mr": {
                "mr_id": mr.iid,
                "mr_url": mr.web_url,
                "titre": mr.title,
                "statut": mr.state
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur création MR: {str(e)}")