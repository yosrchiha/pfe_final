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
from app.services.llm_diff_service import analyser_diff

router = APIRouter(prefix="/depots", tags=["Depots"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Utilitaire : créer ou récupérer une MR existante ─────────────
def _get_or_create_mr(project, source_branch: str, target_branch: str, title: str, description: str, labels: list):
    existing = project.mergerequests.list(
        source_branch=source_branch,
        target_branch=target_branch,
        state='opened'
    )
    if existing:
        print(f"[MR] MR existante récupérée : !{existing[0].iid}")
        return existing[0]

    mr = project.mergerequests.create({
        "source_branch": source_branch,
        "target_branch": target_branch,
        "title": title,
        "description": description,
        "labels": labels
    })
    print(f"[MR] Nouvelle MR créée : !{mr.iid}")
    return mr


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


@router.get("/user/{user_id}", response_model=List[DepotResponse])
def get_user_depots(user_id: int, db: Session = Depends(get_db)):
    return db.query(Depot).filter(Depot.proprietaire_id == user_id).all()


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
    except Exception:
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


FICHIERS_A_IGNORER = []


@router.post("/{depot_id}/analyser-diff")
def analyser_diff_depot(
    depot_id: int,
    data: AnalyserDiffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime

    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")

    # 1. Comparer les branches
    try:
        compare_result = compare_branches(
            token=depot.token_gitlab,
            project_name=depot.nom,
            from_branch=depot.url_branche_principale,
            to_branch=depot.url_branche_developpement
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur comparaison: {str(e)}")

    # 2. Stocker la comparaison
    nouvelle_comparaison = Comparaison(
        depot_id=depot.id,
        from_branch=depot.url_branche_principale,
        to_branch=depot.url_branche_developpement,
        commits_count=compare_result.get("commits_count", 0),
        files_json=compare_result.get("files", [])
    )
    db.add(nouvelle_comparaison)
    db.flush()

    analyse = AnalyseDiff(comparaison_id=nouvelle_comparaison.id, statut="en_cours")
    db.add(analyse)
    db.commit()

    # 3. Aucun fichier modifié
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

    # 4. Filtrer les fichiers si liste non vide
    fichiers_a_analyser = []
    for f in compare_result["files"]:
        path = f.get("path", "")
        if FICHIERS_A_IGNORER and any(pattern in path for pattern in FICHIERS_A_IGNORER):
            print(f"[DIFF] Fichier ignoré : {path}")
            continue
        fichiers_a_analyser.append(f)

    # 5. Aucun fichier après filtrage
    if not fichiers_a_analyser:
        analyse.score_qualite = 100
        analyse.score_securite = 100
        analyse.score_performance = 100
        analyse.vulnerabilites = []
        analyse.vulnerabilites_bloquantes = []
        analyse.recommandations = []

        try:
            project = get_gitlab_project(depot.token_gitlab, depot.nom)
            mr = _get_or_create_mr(
                project=project,
                source_branch=depot.url_branche_developpement,
                target_branch=depot.url_branche_principale,
                title=f"✅ Auto-merge IA : {depot.url_branche_developpement} → {depot.url_branche_principale}",
                description="## Merge Request créée automatiquement\n\n> Généré par **AuditPlatform**",
                labels=["auto-merge", "IA", "securite-ok"]
            )
            analyse.resultat_statut = "merge_autorise"
            analyse.mr_created = 1
            analyse.mr_id = mr.iid
            analyse.mr_url = mr.web_url
            analyse.mr_title = mr.title

            existing_mr_db = db.query(MergeRequestDiff).filter(
                MergeRequestDiff.analyse_diff_id == analyse.id
            ).first()
            if not existing_mr_db:
                db.add(MergeRequestDiff(
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
                ))
        except Exception as e:
            analyse.resultat_statut = "erreur_creation_mr"
            analyse.statut = "termine"
            analyse.completed_at = datetime.utcnow()
            db.commit()
            raise HTTPException(status_code=500, detail=f"Erreur création MR: {str(e)}")

        analyse.statut = "termine"
        analyse.completed_at = datetime.utcnow()
        db.commit()

        return {
            "analyse_id": analyse.id,
            "comparaison_id": nouvelle_comparaison.id,
            "statut": "merge_autorise",
            "message": "Merge autorisé",
            "from_branch": compare_result.get("from_branch"),
            "to_branch": compare_result.get("to_branch"),
            "commits_count": compare_result.get("commits_count", 0),
            "files": compare_result.get("files", []),
            "score_qualite": 100,
            "score_securite": 100,
            "score_performance": 100,
            "vulnerabilites": [],
            "vulnerabilites_bloquantes": [],
            "recommandations": [],
            "mr": {"mr_id": analyse.mr_id, "mr_url": analyse.mr_url, "titre": analyse.mr_title}
        }

    # 6. Analyser avec LLM
    try:
        resultat_ia = analyser_diff(fichiers_a_analyser)
    except Exception as e:
        analyse.statut = "erreur"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Erreur analyse diff IA: {str(e)}")

    BLOQUANTES = {"CRITIQUE", "HAUTE"}
    vulnerabilites = resultat_ia.get("vulnerabilites", [])
    vulns_bloquantes = [v for v in vulnerabilites if v.get("severite", "").upper() in BLOQUANTES]

    analyse.score_qualite = resultat_ia.get("score_qualite", 0)
    analyse.score_securite = resultat_ia.get("score_securite", 0)
    analyse.score_performance = resultat_ia.get("score_performance", 0)
    analyse.vulnerabilites = vulnerabilites
    analyse.vulnerabilites_bloquantes = vulns_bloquantes
    analyse.recommandations = resultat_ia.get("recommandations", [])

    # 7. Décision merge
    if len(vulns_bloquantes) == 0:
        try:
            project = get_gitlab_project(depot.token_gitlab, depot.nom)
            mr = _get_or_create_mr(
                project=project,
                source_branch=depot.url_branche_developpement,
                target_branch=depot.url_branche_principale,
                title=f"✅ Auto-merge IA : {depot.url_branche_developpement} → {depot.url_branche_principale}",
                description=f"""## Merge Request créée automatiquement par AuditPlatform

### Résultat de l'analyse IA du diff
| Critère | Score |
|---|---|
| Qualité | {resultat_ia.get('score_qualite', 0)}/100 |
| Sécurité | {resultat_ia.get('score_securite', 0)}/100 |

### Conclusion
Aucune vulnérabilité **CRITIQUE** ou **HAUTE** détectée.

> Généré automatiquement par **AuditPlatform** · LLM Groq""",
                labels=["auto-merge", "IA", "securite-ok"]
            )
            analyse.resultat_statut = "merge_autorise"
            analyse.mr_created = 1
            analyse.mr_id = mr.iid
            analyse.mr_url = mr.web_url
            analyse.mr_title = mr.title

            existing_mr_db = db.query(MergeRequestDiff).filter(
                MergeRequestDiff.analyse_diff_id == analyse.id
            ).first()
            if not existing_mr_db:
                db.add(MergeRequestDiff(
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
                ))
        except Exception as e:
            analyse.resultat_statut = "erreur_creation_mr"
            db.commit()
            raise HTTPException(status_code=500, detail=f"Erreur création MR: {str(e)}")
    else:
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


# ── POST /{depot_id}/creer-mr-force ───────────────────────────────
class CreerMRForceRequest(BaseModel):
    analyse_id: int


@router.post("/{depot_id}/creer-mr-force")
def creer_mr_force(
    depot_id: int,
    data: CreerMRForceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime

    analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == data.analyse_id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")

    comparaison = db.query(Comparaison).filter(Comparaison.id == analyse.comparaison_id).first()
    if not comparaison:
        raise HTTPException(status_code=404, detail="Comparaison non trouvée")

    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")

    try:
        project = get_gitlab_project(depot.token_gitlab, depot.nom)
        mr = _get_or_create_mr(
            project=project,
            source_branch=depot.url_branche_developpement,
            target_branch=depot.url_branche_principale,
            title=f"⚠️ Auto-merge IA (forcé) : {depot.url_branche_developpement} → {depot.url_branche_principale}",
            description="""## Merge Request créée automatiquement par AuditPlatform (FORCÉE)

### ⚠️ ATTENTION
Cette MR a été créée malgré la présence de vulnérabilités CRITIQUES ou HAUTES.

> Généré automatiquement par **AuditPlatform** · LLM Groq""",
            labels=["auto-merge", "IA", "force-merge"]
        )

        analyse.mr_created = 1
        analyse.mr_id = mr.iid
        analyse.mr_url = mr.web_url
        analyse.mr_title = mr.title
        analyse.resultat_statut = "merge_autorise_force"
        analyse.completed_at = datetime.utcnow()

        existing_mr_db = db.query(MergeRequestDiff).filter(
            MergeRequestDiff.analyse_diff_id == analyse.id
        ).first()

        if not existing_mr_db:
            db.add(MergeRequestDiff(
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
            ))
        else:
            existing_mr_db.state = mr.state
            existing_mr_db.mr_url = mr.web_url
            existing_mr_db.title = mr.title

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


# ── POST /{depot_id}/corriger-vuln ────────────────────────────────
class CorrigerVulnRequest(BaseModel):
    vuln_type: str
    vuln_severite: str
    vuln_ligne: int
    vuln_suggestion: str
    fichier_path: str
    contenu_source: str = ""


# Remplacer uniquement la fonction corriger_vuln dans backend/app/routes/depots.py
# Ajouter cet import en haut du fichier avec les autres imports :
# from app.models.corre_diff import CorreDiff

@router.post("/{depot_id}/corriger-vuln")
def corriger_vuln(
    depot_id: int,
    data: CorrigerVulnRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import os
    import base64
    from datetime import datetime
    from groq import Groq
    from app.models.corre_diff import CorreDiff

    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")

    try:
        project = get_gitlab_project(depot.token_gitlab, depot.nom)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur connexion GitLab: {str(e)}")

    # ── 1. Lire le contenu original du fichier ────────────────────
    contenu_original = ""
    branche_source = depot.url_branche_developpement

    try:
        f = project.files.get(file_path=data.fichier_path, ref=depot.url_branche_developpement)
        contenu_original = base64.b64decode(f.content).decode("utf-8")
        branche_source = depot.url_branche_developpement
    except Exception:
        pass

    if not contenu_original:
        try:
            f = project.files.get(file_path=data.fichier_path, ref=depot.url_branche_principale)
            contenu_original = base64.b64decode(f.content).decode("utf-8")
            branche_source = depot.url_branche_principale
        except Exception:
            pass

    if not contenu_original and data.contenu_source:
        contenu_original = data.contenu_source
        branche_source = "frontend"

    if not contenu_original:
        raise HTTPException(
            status_code=400,
            detail=f"Impossible de lire '{data.fichier_path}' depuis GitLab"
        )

    # ── 2. Demander a l IA de corriger ────────────────────────────
    try:
        groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

        prompt = f"""Tu es un expert en sécurité logicielle. Corrige la vulnérabilité suivante dans le code.

Vulnérabilité détectée :
- Type : {data.vuln_type}
- Sévérité : {data.vuln_severite}
- Ligne : {data.vuln_ligne}
- Suggestion : {data.vuln_suggestion}

Fichier à corriger ({data.fichier_path}) :
```
{contenu_original[:6000]}
```

INSTRUCTIONS STRICTES :
1. Corrige UNIQUEMENT la vulnérabilité mentionnée.
2. Ne modifie rien d'autre dans le code.
3. Retourne UNIQUEMENT le code corrigé complet, sans explication, sans balises markdown.
4. Le code doit être fonctionnel et syntaxiquement correct."""

        response = groq_client.chat.completions.create(
            model=groq_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
            temperature=0.1
        )

        contenu_corrige = response.choices[0].message.content.strip()

        if contenu_corrige.startswith("```"):
            lines = contenu_corrige.split("\n")
            start = 1
            end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
            contenu_corrige = "\n".join(lines[start:end])

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA: {str(e)}")

    # ── 3. Creer une branche de correction ────────────────────────
    ts = datetime.utcnow().strftime("%Y-%m-%d-%H%M")
    vuln_slug = data.vuln_type.lower().replace(" ", "-").replace("/", "-")[:25]
    branche_correction = f"fix/{vuln_slug}-{ts}"

    try:
        project.branches.create({
            "branch": branche_correction,
            "ref": depot.url_branche_developpement
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur création branche: {str(e)}")

    # ── 4. Pousser le fichier corrige ─────────────────────────────
    try:
        fichier_existe = True
        try:
            project.files.get(file_path=data.fichier_path, ref=branche_correction)
        except Exception:
            fichier_existe = False

        action = "update" if fichier_existe else "create"

        project.commits.create({
            "branch": branche_correction,
            "commit_message": f"fix({data.vuln_type}): correction automatique IA — ligne {data.vuln_ligne}",
            "actions": [
                {
                    "action": action,
                    "file_path": data.fichier_path,
                    "content": contenu_corrige,
                    "encoding": "text"
                }
            ]
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur push fichier: {str(e)}")

    # ── 5. Creer une MR de correction vers la branche DEV ─────────
    try:
        mr = _get_or_create_mr(
            project=project,
            source_branch=branche_correction,
            target_branch=depot.url_branche_developpement,
            title=f"🔧 Fix IA : {data.vuln_type} dans {data.fichier_path}",
            description=f"""## Correction automatique par AuditPlatform

### Vulnérabilité corrigée
| Champ | Valeur |
|---|---|
| Type | {data.vuln_type} |
| Sévérité | {data.vuln_severite} |
| Fichier | `{data.fichier_path}` |
| Ligne | {data.vuln_ligne} |

### Correction appliquée
{data.vuln_suggestion}

> Corrigé automatiquement par **AuditPlatform** · LLM Groq""",
            labels=["fix-auto", "IA", "securite"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur création MR correction: {str(e)}")

    # ── 6. Recuperer l analyse diff liee au depot ─────────────────
    analyse_diff = db.query(AnalyseDiff).join(
        Comparaison, AnalyseDiff.comparaison_id == Comparaison.id
    ).filter(
        Comparaison.depot_id == depot_id
    ).order_by(AnalyseDiff.id.desc()).first()

    # ── 7. Sauvegarder la correction dans corre_diff ──────────────
    corre = CorreDiff(
        user_id=current_user.id,
        depot_id=depot.id,
        analyse_diff_id=analyse_diff.id if analyse_diff else None,
        comparaison_id=analyse_diff.comparaison_id if analyse_diff else None,
        fichier_path=data.fichier_path,
        branche_source=branche_source,
        branche_correction=branche_correction,
        vuln_type=data.vuln_type,
        vuln_severite=data.vuln_severite,
        vuln_ligne=data.vuln_ligne,
        vuln_suggestion=data.vuln_suggestion,
        contenu_original=contenu_original,
        contenu_corrige=contenu_corrige,
        modele_utilise=groq_model,
        mr_url=mr.web_url,
        mr_id_gitlab=mr.iid,
        mr_titre=mr.title,
        statut="mr_creee",
        pushed_at=datetime.utcnow()
    )
    db.add(corre)
    db.commit()

    return {
        "statut": "success",
        "message": "Correction poussée et Merge Request créée",
        "fichier_path": data.fichier_path,
        "branche_correction": branche_correction,
        "mr_url": mr.web_url,
        "mr_id": mr.iid,
        "mr_titre": mr.title,
        "vuln_type": data.vuln_type,
        "vuln_severite": data.vuln_severite,
        "corre_diff_id": corre.id
    }