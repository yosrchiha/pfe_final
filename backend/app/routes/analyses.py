# backend/app/routes/analyses.py

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
import traceback
from pydantic import BaseModel as PydanticBaseModel
import os
from jose import jwt, JWTError
from app.config.settings import settings
from app.config.database import get_db
from app.models.analyse       import Analyse
from app.models.depot_analyse import DepotAnalyse
from app.models.user          import User
from app.schemas.analyse      import LancerAnalyseRequest
from app.services.llm_service import analyser_code
from app.services.gitlab_client import (
    get_project_files,
    get_gitlab_project
)

router = APIRouter(prefix="/analyses", tags=["Analyses"])


# ════════════════════════════════════════════════════════
# UTILITAIRE — Extraire user_id depuis le JWT token
# ════════════════════════════════════════════════════════


# Et dans get_user_id_from_token :
def get_user_id_from_token(
    authorization : str     = None,
    db            : Session = None
) -> int:
    if not authorization:
        return 1

    try:
        token = authorization.replace("Bearer ", "").strip()

        # Récupère la clé depuis .env
        secret_key = os.getenv("SECRET_KEY", "secret")

        # Essaie HS256 d'abord
        try:
            payload = jwt.decode(
                token,
                secret_key,
                algorithms=["HS256"]
            )
        except JWTError:
            # Si ça échoue essaie sans vérification
            # pour voir ce que contient le token
            import base64, json
            parts = token.split('.')
            padding = 4 - len(parts[1]) % 4
            decoded = base64.b64decode(parts[1] + "=" * padding)
            payload = json.loads(decoded)

        # Cas 1 — user_id direct
        user_id = payload.get("user_id")
        if user_id:
            print(f"[JWT] user_id = {user_id}")
            return int(user_id)

        # Cas 2 — sub = email
        sub = payload.get("sub")
        print(f"[JWT] sub = {sub}")

        if sub and db:
            from app.models.user import User
            user = db.query(User).filter(User.email == sub).first()
            if user:
                print(f"[JWT] user_id trouvé = {user.id}")
                return user.id

        return 1

    except Exception as e:
        print(f"[JWT] Erreur : {e}")
        return 1

# ════════════════════════════════════════════════════════
# UTILITAIRE — Créer les issues dans GitLab
# ════════════════════════════════════════════════════════
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
        print(f"Erreur création issues GitLab : {e}")


# ════════════════════════════════════════════════════════
# ENDPOINT 1 — Lancer une analyse
# POST /analyses/lancer
# ════════════════════════════════════════════════════════
@router.post("/lancer")
def lancer_analyse(
    data          : LancerAnalyseRequest,
    db            : Session = Depends(get_db),
    authorization : str     = Header(None)
):
    # ── 1. Récupérer user_id ─────────────────────────────
    user_id = get_user_id_from_token(authorization, db)
    print(f"[ANALYSE] user_id = {user_id}")  # ← debug

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
        print(f"[ANALYSE] Nouveau dépôt créé id={depot.id}")

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
        # ── 5. Récupérer les fichiers depuis GitLab ──────
        fichiers = get_project_files(
            token        = data.gitlab_token,
            project_name = data.project_url,
            branch       = data.branche,
            extensions   = [
                ".py", ".js", ".ts", ".tsx", ".jsx",
                ".java", ".php", ".go", ".rb", ".cpp", ".cs"
            ]
        )

        if not fichiers:
            analyse.statut = "erreur"
            db.commit()
            raise HTTPException(
                status_code = 400,
                detail      = "Aucun fichier de code trouvé dans ce projet"
            )

        # ── 6. Adapter format pour llm_service ───────────
        fichiers_llm = [
            {
                "file_path" : f["path"],
                "content"   : f["content"]
            }
            for f in fichiers
        ]

        # ── 7. Envoyer au LLM Groq ───────────────────────
        rapport = analyser_code(fichiers_llm, data.owasp_enabled)

        # ── 8. Sauvegarder le rapport ────────────────────
        analyse.score_qualite     = rapport["score_qualite"]
        analyse.score_securite    = rapport["score_securite"]
        analyse.score_performance = rapport["score_performance"]
        analyse.vulnerabilites    = rapport["vulnerabilites"]
        analyse.recommandations   = rapport["recommandations"]
        analyse.statut            = "termine"
        db.commit()
        db.refresh(analyse)

        # ── 9. Créer les issues dans GitLab ──────────────
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
# ENDPOINT 2 — Historique des analyses d'un dépôt
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
            "vulnerabilites"    : a.vulnerabilites,
            "recommandations"   : a.recommandations,
            "statut"            : a.statut,
            "created_at"        : str(a.created_at)
        }
        for a in analyses
    ]


# ════════════════════════════════════════════════════════
# ENDPOINT 3 — Tous les dépôts analysés d'un utilisateur
# GET /analyses/depots-user/{user_id}
# ════════════════════════════════════════════════════════
@router.get("/depots-user/{user_id}")
def get_depots_user(
    user_id : int,
    db      : Session = Depends(get_db)
):
    depots = db.query(DepotAnalyse).filter(
        DepotAnalyse.user_id == user_id
    ).order_by(
        DepotAnalyse.created_at.desc()
    ).all()

    return [
        {
            "id"          : d.id,
            "nom"         : d.nom,
            "project_url" : d.project_url,
            "branche"     : d.branche,
            "created_at"  : str(d.created_at)
        }
        for d in depots
    ]


# ════════════════════════════════════════════════════════
# ENDPOINT 4 — Détail d'une analyse
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
        "owasp_enabled"     : analyse.owasp_enabled,
        "auto_tests"        : analyse.auto_tests,
        "auto_mr"           : analyse.auto_mr,
        "seuil_qualite"     : analyse.seuil_qualite,
        "modele_llm"        : analyse.modele_llm,
        "created_at"        : str(analyse.created_at)
    }
    



class GenererTestsRequest(PydanticBaseModel):
    analyse_id   : int
    gitlab_token : str
    project_url  : str
    branche      : str  = "main"
    creer_mr     : bool = True


# ════════════════════════════════════════════════════════
# ENDPOINT — Générer les tests + créer MR
# POST /analyses/generer-tests
# ════════════════════════════════════════════════════════
@router.post("/generer-tests")
def generer_tests_endpoint(
    data : GenererTestsRequest,
    db   : Session = Depends(get_db)
):
    """
    1. Récupère les fichiers depuis GitLab
    2. Génère les tests via LLM
    3. Crée une branche ai/tests/...
    4. Pousse le fichier de tests
    5. Crée une MR si demandé
    """
    from app.services.test_service import (
        generer_tests_llm,
        creer_branche_et_pousser,
        creer_merge_request
    )

    # ── 1. Récupérer l'analyse en base ───────────────
    analyse = db.query(Analyse).filter(
        Analyse.id == data.analyse_id
    ).first()

    if not analyse:
        raise HTTPException(
            status_code = 404,
            detail      = "Analyse introuvable"
        )

    if analyse.statut != "termine":
        raise HTTPException(
            status_code = 400,
            detail      = "L'analyse doit être terminée avant de générer les tests"
        )

    try:
        # ── 2. Récupérer les fichiers ─────────────────
        print("[TESTS] Récupération des fichiers...")
        fichiers = get_project_files(
            token        = data.gitlab_token,
            project_name = data.project_url,
            branch       = data.branche,
            extensions   = [
                ".py", ".js", ".ts", ".tsx", ".jsx",
                ".java", ".php", ".go", ".rb"
            ]
        )

        if not fichiers:
            raise HTTPException(
                status_code = 400,
                detail      = "Aucun fichier trouvé pour générer les tests"
            )

        # ── 3. Générer les tests via LLM ──────────────
        print("[TESTS] Génération via LLM...")
        resultat_llm = generer_tests_llm(
            fichiers       = fichiers,
            vulnerabilites = analyse.vulnerabilites or [],
            recommandations= analyse.recommandations or []
        )

        # ── 4. Créer la branche et pousser ───────────
        print("[TESTS] Création branche et push...")
        resultat_branche = creer_branche_et_pousser(
            token         = data.gitlab_token,
            project_url   = data.project_url,
            branche_base  = data.branche,
            nom_fichier   = resultat_llm["fichier"],
            contenu_tests = resultat_llm["contenu"]
        )

        # ── 5. Créer la MR si demandé ─────────────────
        resultat_mr = None
        if data.creer_mr:
            print("[TESTS] Création de la MR...")
            resultat_mr = creer_merge_request(
                token         = data.gitlab_token,
                project_url   = data.project_url,
                branche_src   = resultat_branche["branche"],
                branche_cible = data.branche
            )

        return {
            "statut"  : "succes",
            "langage" : resultat_llm["langage"],
            "branche" : resultat_branche["branche"],
            "fichier" : resultat_branche["fichier"],
            "mr"      : resultat_mr
        }

    except HTTPException:
        raise

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code = 500,
            detail      = str(e)
        )
    # ENDPOINT 6 — Analyser le diff + merger si propre
# POST /analyses/analyser-diff
# ════════════════════════════════════════════════════════
class AnalyserDiffRequest(PydanticBaseModel):
    gitlab_token  : str
    project_url   : str
    from_branch   : str
    to_branch     : str
    fichiers      : list        # fichiers du diff {path, content/diff}
    owasp_enabled : bool = True
 
 
@router.post("/analyser-diff")
def analyser_diff(
    data          : AnalyserDiffRequest,
    db            : Session = Depends(get_db),
    authorization : str     = Header(None)
):
    """
    Analyse le diff entre deux branches via le LLM.
 
    Logique :
      - 0 vulnérabilité CRITIQUE ou HAUTE
        → crée la MR from_branch → to_branch sur GitLab automatiquement
      - Sinon
        → retourne les vulnérabilités bloquantes, pas de MR
    """
    # ── 1. Vérifier qu'il y a des fichiers ───────────────────
    if not data.fichiers:
        raise HTTPException(status_code=400, detail="Aucun fichier dans le diff à analyser")
 
    # ── 2. Préparer les fichiers pour le LLM ─────────────────
    fichiers_llm = []
    for f in data.fichiers:
        contenu = f.get("content") or f.get("diff") or ""
        if contenu.strip():
            fichiers_llm.append({
                "file_path": f.get("path", "inconnu"),
                "content"  : contenu
            })
 
    if not fichiers_llm:
        raise HTTPException(
            status_code = 400,
            detail      = "Les fichiers du diff ne contiennent pas de contenu analysable"
        )
 
    # ── 3. Analyser via LLM ───────────────────────────────────
    try:
        resultat_llm = analyser_code(fichiers_llm, data.owasp_enabled)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur LLM : {str(e)}")
 
    score_qualite     = resultat_llm.get("score_qualite",     0)
    score_securite    = resultat_llm.get("score_securite",    0)
    score_performance = resultat_llm.get("score_performance", 0)
    vulnerabilites    = resultat_llm.get("vulnerabilites",    [])
    recommandations   = resultat_llm.get("recommandations",   [])
 
    # ── 4. Identifier les vulnérabilités bloquantes ──────────
    BLOQUANTES = {"CRITIQUE", "HAUTE"}
    vulns_bloquantes = [
        v for v in vulnerabilites
        if v.get("severite", "").upper() in BLOQUANTES
    ]
 
    peut_merger = len(vulns_bloquantes) == 0
 
    # ── 5a. MERGE AUTORISÉ — créer la MR ─────────────────────
    if peut_merger:
        try:
            project = get_gitlab_project(data.gitlab_token, data.project_url)
            mr = project.mergerequests.create({
                "source_branch"       : data.from_branch,
                "target_branch"       : data.to_branch,
                "title"               : f"✅ Auto-merge IA : {data.from_branch} → {data.to_branch}",
                "description"         : f"""
## Merge Request créée automatiquement par AuditPlatform
 
### Résultat de l'analyse IA du diff
| Critère | Score |
|---|---|
| Qualité | {score_qualite}/100 |
| Sécurité | {score_securite}/100 |
| Performance | {score_performance}/100 |
 
### Conclusion
Aucune vulnérabilité **CRITIQUE** ou **HAUTE** détectée dans le diff.
La fusion de `{data.from_branch}` vers `{data.to_branch}` est autorisée.
 
> Généré automatiquement par **AuditPlatform** · LLM Groq
                """,
                "remove_source_branch": False,
                "labels"              : ["auto-merge", "IA", "securite-ok"]
            })
 
            return {
                "statut"                   : "merge_autorise",
                "score_qualite"            : score_qualite,
                "score_securite"           : score_securite,
                "score_performance"        : score_performance,
                "vulnerabilites"           : vulnerabilites,
                "vulnerabilites_bloquantes": [],
                "recommandations"          : recommandations,
                "mr": {
                    "mr_id" : mr.iid,
                    "mr_url": mr.web_url,
                    "titre" : mr.title,
                    "statut": mr.state
                }
            }
 
        except Exception as e:
            raise HTTPException(
                status_code = 500,
                detail      = f"Analyse OK mais impossible de créer la MR : {str(e)}"
            )
 
    # ── 5b. MERGE BLOQUÉ — retourner les vulnérabilités ──────
    return {
        "statut"                   : "merge_bloque",
        "score_qualite"            : score_qualite,
        "score_securite"           : score_securite,
        "score_performance"        : score_performance,
        "vulnerabilites"           : vulnerabilites,
        "vulnerabilites_bloquantes": vulns_bloquantes,
        "recommandations"          : recommandations,
        "mr"                       : None
    }
 