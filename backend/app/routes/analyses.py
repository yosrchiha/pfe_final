# backend/app/routes/analyses.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import traceback

from app.config.database import get_db
from app.models.analyse import Analyse
from app.models.depot_analyse import DepotAnalyse
from app.schemas.analyse import LancerAnalyseRequest, AnalyseResponse
from app.services.llm_service import analyser_code

# ── Ton service GitLab existant ───────────────────────────
from app.services.gitlab_client import (
    get_project_files,
    get_gitlab_project
)

router = APIRouter(prefix="/analyses", tags=["Analyses"])


# ── Créer les issues dans GitLab ─────────────────────────
def creer_issues_gitlab(
    token          : str,
    project_name   : str,
    vulnerabilites : list
):
    try:
        project = get_gitlab_project(token, project_name)
        for vuln in vulnerabilites:
            project.issues.create({
                "title": (
                    f"[{vuln['severite']}] "
                    f"{vuln['type']} — "
                    f"{vuln['fichier']}"
                ),
                "description": f"""
## Vulnérabilité détectée par l'IA

**Fichier :** `{vuln['fichier']}`
**Ligne :** {vuln['ligne']}
**Type :** {vuln['type']}
**Sévérité :** {vuln['severite']}

## Suggestion de correction

{vuln['suggestion']}
                """,
                "labels": ["IA", vuln["severite"].lower()]
            })
    except Exception as e:
        # On ne bloque pas si les issues échouent
        print(f"Erreur création issues : {e}")


# ════════════════════════════════════════════════════════
# ENDPOINT 1 — Lancer une analyse
# POST /analyses/lancer
# ════════════════════════════════════════════════════════
@router.post("/lancer")
def lancer_analyse(
    data : LancerAnalyseRequest,
    db   : Session = Depends(get_db)
):
    # ── 1. Récupérer user_id ─────────────────────────────
    # Pour l'instant fixe — on corrigera avec JWT après
    user_id = 1

    # ── 2. Chercher si le dépôt existe déjà ─────────────
    depot = db.query(DepotAnalyse).filter(
        DepotAnalyse.user_id     == user_id,
        DepotAnalyse.project_url == data.project_url
    ).first()

    # ── 3. Sinon créer le dépôt ──────────────────────────
    if not depot:
        depot = DepotAnalyse(
            user_id      = user_id,
            nom          = data.nom_projet,
            gitlab_token = data.gitlab_token,
            project_url  = data.project_url,
            branche      = data.branche
        )
        db.add(depot)
        db.commit()
        db.refresh(depot)

    # ── 4. Créer l'analyse avec statut en_cours ──────────
    analyse = Analyse(
        depot_analyse_id = depot.id,
        branche          = data.branche,
        statut           = "en_cours",
        owasp_enabled    = data.owasp_enabled,
        auto_tests       = data.auto_tests,
        auto_mr          = data.auto_mr,
        seuil_qualite    = data.seuil_qualite,
        modele_llm       = "llama-3.3-70b-versatile"
    )
    db.add(analyse)
    db.commit()
    db.refresh(analyse)

    try:
        # ── 5. Récupérer les fichiers via ton service ────
        # On utilise ton gitlab_client existant
        fichiers = get_project_files(
            token        = data.gitlab_token,
            project_name = data.project_url,
            branch       = data.branche,
            extensions   = [
                ".py", ".js", ".ts", ".tsx", ".jsx",
                ".java", ".php", ".go", ".rb", ".cpp"
            ]
        )

        if not fichiers:
            analyse.statut = "erreur"
            db.commit()
            raise HTTPException(
                status_code = 400,
                detail      = "Aucun fichier de code trouvé dans ce projet"
            )

        # ── 6. Envoyer au LLM ────────────────────────────
        # Adapter le format pour llm_service
        # ton service retourne {path, content, size}
        # llm_service attend {file_path, content}
        fichiers_llm = [
            {
                "file_path" : f["path"],
                "content"   : f["content"]
            }
            for f in fichiers
        ]

        rapport = analyser_code(fichiers_llm, data.owasp_enabled)

        # ── 7. Sauvegarder le rapport ────────────────────
        analyse.score_qualite     = rapport["score_qualite"]
        analyse.score_securite    = rapport["score_securite"]
        analyse.score_performance = rapport["score_performance"]
        analyse.vulnerabilites    = rapport["vulnerabilites"]
        analyse.recommandations   = rapport["recommandations"]
        analyse.statut            = "termine"
        db.commit()
        db.refresh(analyse)

        # ── 8. Créer les issues GitLab ───────────────────
        if rapport.get("vulnerabilites"):
            creer_issues_gitlab(
                token          = data.gitlab_token,
                project_name   = data.project_url,
                vulnerabilites = rapport["vulnerabilites"]
            )

    except HTTPException:
        raise

    except Exception as e:
        analyse.statut = "erreur"
        db.commit()
        traceback.print_exc()
        raise HTTPException(
            status_code = 500,
            detail      = str(e)
        )

    return {
        "depot_analyse_id"  : depot.id,
        "analyse_id"        : analyse.id,
        "score_qualite"     : analyse.score_qualite,
        "score_securite"    : analyse.score_securite,
        "score_performance" : analyse.score_performance,
        "vulnerabilites"    : analyse.vulnerabilites,
        "recommandations"   : analyse.recommandations,
        "statut"            : analyse.statut,
        "branche"           : analyse.branche
    }


# ════════════════════════════════════════════════════════
# ENDPOINT 2 — Historique d'un dépôt
# GET /analyses/depot/{depot_analyse_id}
# ════════════════════════════════════════════════════════
@router.get("/depot/{depot_analyse_id}")
def get_analyses_depot(
    depot_analyse_id : int,
    db               : Session = Depends(get_db)
):
    analyses = db.query(Analyse).filter(
        Analyse.depot_analyse_id == depot_analyse_id
    ).order_by(
        Analyse.created_at.desc()
    ).all()

    return [
        {
            "id"                : a.id,
            "branche"           : a.branche,
            "score_qualite"     : a.score_qualite,
            "score_securite"    : a.score_securite,
            "score_performance" : a.score_performance,
            "statut"            : a.statut,
            "created_at"        : str(a.created_at)
        }
        for a in analyses
    ]


# ════════════════════════════════════════════════════════
# ENDPOINT 3 — Détail d'une analyse
# GET /analyses/{analyse_id}
# ════════════════════════════════════════════════════════
@router.get("/{analyse_id}")
def get_analyse(
    analyse_id : int,
    db         : Session = Depends(get_db)
):
    analyse = db.query(Analyse).filter(
        Analyse.id == analyse_id
    ).first()

    if not analyse:
        raise HTTPException(
            status_code = 404,
            detail      = "Analyse introuvable"
        )

    return {
        "id"                : analyse.id,
        "depot_analyse_id"  : analyse.depot_analyse_id,
        "branche"           : analyse.branche,
        "score_qualite"     : analyse.score_qualite,
        "score_securite"    : analyse.score_securite,
        "score_performance" : analyse.score_performance,
        "vulnerabilites"    : analyse.vulnerabilites,
        "recommandations"   : analyse.recommandations,
        "statut"            : analyse.statut,
        "created_at"        : str(analyse.created_at)
    }