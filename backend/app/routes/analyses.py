# backend/app/routes/analyses.py

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from typing import List
from app.models.test_genere import TestGenere
from app.schemas.test_genere import TestGenereResponse
from app.schemas.merge_request import MergeRequestResponse
import traceback
# En haut de analyses.py, remplacer la définition de creer_issues_gitlab par :
from app.services.issues_service import creer_issues_gitlab
from pydantic import BaseModel as PydanticBaseModel
import os
from jose import jwt, JWTError
from app.config.settings import settings
from app.config.database import get_db
from app.models.analyse       import Analyse
from app.models.depot_analyse import DepotAnalyse
from app.models.user          import User
from app.routes.auth import get_current_user
from app.schemas.analyse      import LancerAnalyseRequest
from app.services.llm_service import analyser_code
from app.models.issue_gitlab import IssueGitLab
from app.models.merge_request import MergeRequest
from fastapi.responses import FileResponse
from app.services.pdf_service import generer_rapport_pdf
from app.models.recommandation import Recommandation
from app.services.gitlab_client import (
    get_project_files,
    get_gitlab_project
)
from app.models.export_rapport import ExportRapport
from app.schemas.export_rapport import ExportRapportCreate
from pydantic import BaseModel as PydanticBaseModel
from typing import Optional
from app.models.vulnerabilite import Vulnerabilite
from app.models.feedback import Feedback
from app.models.video_generee import VideoGeneree
from sqlalchemy import or_


router = APIRouter(prefix="/analyses", tags=["Analyses"])


# ════════════════════════════════════════════════════════
# UTILITAIRE — Extraire user_id depuis le JWT token
# ════════════════════════════════════════════════════════

class TokenRequest(PydanticBaseModel):
    token: str

class BranchesRequest(PydanticBaseModel):
    token: str
    project_path: str

@router.post("/projets")
def lister_projets(request: TokenRequest):
    try:
        import gitlab
        gl = gitlab.Gitlab("https://gitlab.com", private_token=request.token)
        gl.auth()
        projets = gl.projects.list(owned=True, membership=True, all=True)
        return [
            {"id": p.id, "nom": p.name, "chemin": p.path_with_namespace, "url": p.web_url}
            for p in projets
        ]
    except Exception:
        raise HTTPException(status_code=401, detail="Token GitLab invalide")

@router.post("/branches")
def lister_branches(data: BranchesRequest):
    try:
        project = get_gitlab_project(data.token, data.project_path)
        branches = project.branches.list()
        return [b.name for b in branches]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
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
    vulnerabilites : list,
    analyse_id     : int,
    depot_analyse_id: int,
    db             : Session
):
    """Crée les issues GitLab ET les sauvegarde en base"""
    try:
        project = get_gitlab_project(token, project_name)
        
        for vuln in vulnerabilites:
            # 1. Créer l'issue dans GitLab
            gitlab_issue = project.issues.create({
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
            
            # 2. Sauvegarder en base
            issue_db = IssueGitLab(
                analyse_id       = analyse_id,
                depot_analyse_id = depot_analyse_id,
                issue_id_gitlab  = gitlab_issue.iid,
                issue_url        = gitlab_issue.web_url,
                titre            = gitlab_issue.title,
                description      = gitlab_issue.description,
                severite         = vuln['severite'],
                type_vuln        = vuln['type'],
                fichier          = vuln['fichier'],
                ligne            = vuln['ligne'],
                statut           = gitlab_issue.state,
                labels           = "IA," + vuln["severite"].lower()
            )
            db.add(issue_db)
            
        db.commit()
        print(f"[ISSUES] {len(vulnerabilites)} issue(s) créées et sauvegardées")
        
    except Exception as e:
        print(f"Erreur création issues GitLab : {e}")
        db.rollback()
# ════════════════════════════════════════════════════════
# UTILITAIRE — Créer les vulnérabilités en base
# ════════════════════════════════════════════════════════
def creer_vulnerabilites_base(
    vulnerabilites: list,
    analyse_id: int,
    db: Session
):
    """Sauvegarde les vulnérabilités dans la table vulnerabilites"""
    from app.models.vulnerabilite import Vulnerabilite
    
    compteur = 0
    for vuln in vulnerabilites:
        try:
            vuln_db = Vulnerabilite(
                analyse_id=analyse_id,
                type=vuln.get("type", "Inconnu"),
                severite=vuln.get("severite", "MOYENNE"),
                description=vuln.get("description", ""),
                suggestion=vuln.get("suggestion", ""),
                fichier=vuln.get("fichier", "inconnu"),
                ligne=vuln.get("ligne", 0),
                colonne=vuln.get("colonne"),
                categorie_owasp=vuln.get("categorie_owasp"),
                cwe_id=vuln.get("cwe_id"),
                code_snippet=vuln.get("code_snippet"),
                impact=vuln.get("impact"),
                statut="detectee"
            )
            db.add(vuln_db)
            compteur += 1
        except Exception as e:
            print(f"[VULN] Erreur sauvegarde vulnérabilité: {e}")
    
    db.commit()
    print(f"[VULN] {compteur} vulnérabilité(s) sauvegardée(s) dans la table vulnerabilites")

# ════════════════════════════════════════════════════════
# REMPLACEMENT — fonction lancer_analyse dans analyses.py
#
# Ce qui était faux dans l'original :
#   - celery_task_id = None  (jamais remplacé par un vrai ID)
#   - apply_async() n'était JAMAIS appelé
#   - L'analyse se faisait directement dans la route (synchrone)
#   - depot_id=depot.id ajoutait une FK violation
#
# Ce qui est corrigé ici :
#   - Analyse créée avec statut="en_attente"
#   - run_analyse.apply_async() appelé correctement
#   - celery_task_id sauvegardé dans la base
#   - Retour immédiat avec analyse_id (le frontend suit le statut)
# ════════════════════════════════════════════════════════

@router.post("/lancer")
def lancer_analyse(
    data: LancerAnalyseRequest,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    analyse = None

    try:
        # ── 1. Récupérer user_id ─────────────────────────────────
        user_id = get_user_id_from_token(authorization, db)
        print(f"[ANALYSE] user_id = {user_id}", flush=True)

        # ── 2. Chercher ou créer le dépôt ────────────────────────
        depot = db.query(DepotAnalyse).filter(
            DepotAnalyse.user_id == user_id,
            DepotAnalyse.project_url == data.project_url
        ).first()

        if not depot:
            depot = DepotAnalyse(
                user_id=user_id,
                nom=data.nom_projet,
                gitlab_token=data.gitlab_token,
                project_url=data.project_url,
                branche=data.branche
            )
            db.add(depot)
            db.commit()
            db.refresh(depot)
            print(f"[ANALYSE] Nouveau dépôt créé id={depot.id}", flush=True)
        else:
            depot.gitlab_token = data.gitlab_token
            depot.branche = data.branche
            db.commit()
            db.refresh(depot)
            print(f"[ANALYSE] Dépôt existant id={depot.id}", flush=True)

        # ── 3. Créer l'analyse — PAS de depot_id (FK vers table depots) ──
        analyse = Analyse(
            depot_analyse_id=depot.id,   # ← correct : DepotAnalyse
            branche=data.branche,
            statut="en_attente",
            owasp_enabled=data.owasp_enabled,
            auto_tests=data.auto_tests,
            auto_mr=data.auto_mr,
            seuil_qualite=data.seuil_qualite,
            modele_llm="llama-3.3-70b-versatile",
            celery_task_id=None,
            etape_courante="soumise",
        )
        db.add(analyse)
        db.commit()
        db.refresh(analyse)
        print(f"[ANALYSE] Analyse créée id={analyse.id}", flush=True)

        # ── 4. Soumettre la tâche à Celery ───────────────────────
        from app.tasks.analyse_task import run_analyse

        print("[ANALYSE] Soumission Celery...", flush=True)

        task = run_analyse.apply_async(
            kwargs=dict(
                analyse_id=analyse.id,
                depot_id=depot.id,        # paramètre Celery uniquement, pas FK SQL
                gitlab_token=data.gitlab_token,
                project_url=data.project_url,
                branche=data.branche,
                owasp_enabled=data.owasp_enabled,
                auto_tests=data.auto_tests,
                auto_mr=data.auto_mr,
            )
        )

        analyse.celery_task_id = task.id
        analyse.statut = "en_file"
        analyse.etape_courante = "en_file"
        db.commit()
        db.refresh(analyse)

        print(f"[ANALYSE] Tâche Celery soumise : {task.id}", flush=True)

        # ── 5. Retour immédiat — le frontend suit avec /statut ───
        return {
            "depot_analyse_id": depot.id,
            "analyse_id": analyse.id,
            "celery_task_id": analyse.celery_task_id,
            "statut": analyse.statut,
            "etape_courante": analyse.etape_courante,
            "branche": analyse.branche,
            "message": "Analyse soumise. Suivez l'état avec GET /analyses/{analyse_id}/statut",
        }

    except Exception as e:
        db.rollback()
        traceback.print_exc()

        # Marquer l'analyse en erreur si elle a été créée
        if analyse is not None and getattr(analyse, "id", None):
            try:
                a = db.query(Analyse).filter(Analyse.id == analyse.id).first()
                if a:
                    a.statut = "erreur"
                    a.etape_courante = "erreur_soumission"
                    db.commit()
            except Exception:
                db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Erreur lancement analyse : {str(e)}"
        )
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
# ENDPOINT — Historique global des analyses du client connecté
# GET /analyses/historique/mes-analyses
# ════════════════════════════════════════════════════════
@router.get("/historique/mes-analyses")
def get_mes_analyses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retourne toutes les analyses de tous les dépôts appartenant
    au client connecté, enrichies avec les informations du dépôt.
    """
    lignes = (
        db.query(Analyse, DepotAnalyse)
        .join(DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id)
        .filter(DepotAnalyse.user_id == current_user.id)
        .order_by(Analyse.created_at.desc())
        .all()
    )

    resultats = []
    for analyse, depot in lignes:
        vulnerabilites = analyse.vulnerabilites if isinstance(analyse.vulnerabilites, list) else []
        recommandations = analyse.recommandations if isinstance(analyse.recommandations, list) else []

        severites = [
            str(v.get("severite", "")).upper()
            for v in vulnerabilites
            if isinstance(v, dict)
        ]

        resultats.append({
            "id": analyse.id,
            "depot_analyse_id": depot.id,
            "depot_nom": depot.nom,
            "project_url": depot.project_url,
            "branche": analyse.branche or depot.branche or "main",
            "score_qualite": analyse.score_qualite,
            "score_securite": analyse.score_securite,
            "score_performance": analyse.score_performance,
            "vulnerabilites": vulnerabilites,
            "recommandations": recommandations,
            "nb_vulnerabilites": len(vulnerabilites),
            "nb_critiques": severites.count("CRITIQUE"),
            "nb_hautes": severites.count("HAUTE"),
            "statut": analyse.statut,
            "modele_llm": analyse.modele_llm,
            "owasp_enabled": analyse.owasp_enabled,
            "auto_tests": analyse.auto_tests,
            "auto_mr": analyse.auto_mr,
            "created_at": str(analyse.created_at),
        })

    return resultats



# ════════════════════════════════════════════════════════
# ENDPOINT — Supprimer une analyse depuis « Mes analyses »
# DELETE /analyses/historique/mes-analyses/{analyse_id}
# ════════════════════════════════════════════════════════
@router.delete("/historique/mes-analyses/{analyse_id}", status_code=204)
def supprimer_mon_analyse(
    analyse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Supprime une seule analyse du client connecté et ses dépendances locales.
    Le dépôt est conservé et les objets déjà créés sur GitLab distant
    ne sont pas supprimés.
    """
    analyse = (
        db.query(Analyse)
        .join(DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id)
        .filter(
            Analyse.id == analyse_id,
            DepotAnalyse.user_id == current_user.id
        )
        .first()
    )

    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse introuvable ou accès non autorisé.")

    if analyse.statut == "en_cours":
        raise HTTPException(status_code=409, detail="Une analyse en cours ne peut pas être supprimée.")

    try:
        exports = db.query(ExportRapport).filter(ExportRapport.analyse_id == analyse_id).all()
        for export in exports:
            if export.chemin_fichier and os.path.isfile(export.chemin_fichier):
                try:
                    os.remove(export.chemin_fichier)
                except OSError:
                    pass

        tests = db.query(TestGenere).filter(TestGenere.analyse_id == analyse_id).all()
        test_ids = [test.id for test in tests]

        conditions_mr = [MergeRequest.analyse_id == analyse_id]
        if test_ids:
            conditions_mr.append(MergeRequest.test_id.in_(test_ids))

        db.query(MergeRequest).filter(or_(*conditions_mr)).delete(synchronize_session=False)
        db.query(IssueGitLab).filter(IssueGitLab.analyse_id == analyse_id).delete(synchronize_session=False)
        db.query(TestGenere).filter(TestGenere.analyse_id == analyse_id).delete(synchronize_session=False)
        db.query(Feedback).filter(Feedback.analyse_id == analyse_id).delete(synchronize_session=False)
        db.query(ExportRapport).filter(ExportRapport.analyse_id == analyse_id).delete(synchronize_session=False)
        db.query(Recommandation).filter(Recommandation.analyse_id == analyse_id).delete(synchronize_session=False)
        db.query(Vulnerabilite).filter(Vulnerabilite.analyse_id == analyse_id).delete(synchronize_session=False)

        db.delete(analyse)
        db.commit()
        return None

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la suppression de l'analyse : {str(e)}"
        )

@router.get("/{analyse_id}/statut")
def get_statut_analyse(
    analyse_id: int,
    db: Session = Depends(get_db)
):
    analyse = db.query(Analyse).filter(
        Analyse.id == analyse_id
    ).first()

    if not analyse:
        raise HTTPException(
            status_code=404,
            detail="Analyse introuvable"
        )

    return {
        "id": analyse.id,
        "depot_analyse_id": analyse.depot_analyse_id,
        "branche": analyse.branche,
        "statut": analyse.statut,
        "etape_courante": getattr(analyse, "etape_courante", None),
        "celery_task_id": getattr(analyse, "celery_task_id", None),
        "score_qualite": analyse.score_qualite,
        "score_securite": analyse.score_securite,
        "score_performance": analyse.score_performance,
        "vulnerabilites": analyse.vulnerabilites or [],
        "recommandations": analyse.recommandations or [],
        "owasp_enabled": analyse.owasp_enabled,
        "auto_tests": analyse.auto_tests,
        "auto_mr": analyse.auto_mr,
        "seuil_qualite": analyse.seuil_qualite,
        "modele_llm": analyse.modele_llm,
        "created_at": str(analyse.created_at)
    }
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
    6. Sauvegarde le test en base
    7. Sauvegarde la MR en base
    """

    from app.services.test_service import (
        generer_tests_llm,
        creer_branche_et_pousser,
        creer_merge_request
    )
    from app.core.crypto import decrypt_token

    # ── 1. Vérifier l'analyse ─────────────────────────────
    analyse = db.query(Analyse).filter(
        Analyse.id == data.analyse_id
    ).first()

    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse introuvable")

    if analyse.statut != "termine":
        raise HTTPException(
            status_code=400,
            detail="L'analyse doit être terminée avant de générer les tests"
        )

    # ── Décrypter le token depuis le dépôt ────────────────
    depot_obj = db.query(DepotAnalyse).filter(
        DepotAnalyse.id == analyse.depot_analyse_id
    ).first()

    # Le modèle déchiffre automatiquement via @property
    try:
        token_clair = depot_obj.gitlab_token
        print(f"[TESTS] Token récupéré : {token_clair[:8]}...", flush=True)
    except Exception as e:
        print(f"[TESTS] Erreur token: {e}")
        token_clair = data.gitlab_token

    if not token_clair:
        raise HTTPException(status_code=400, detail="Token GitLab introuvable")

    try:
        # ── 2. Récupérer les fichiers ─────────────────────
        print("[TESTS] Récupération des fichiers...")
        fichiers = get_project_files(
            token        = token_clair,
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

        # ── 3. Génération via LLM ─────────────────────────
        print("[TESTS] Génération via LLM...")
        resultat_llm = generer_tests_llm(
            fichiers        = fichiers,
            vulnerabilites  = analyse.vulnerabilites or [],
            recommandations = analyse.recommandations or []
        )

        if not resultat_llm or "contenu" not in resultat_llm:
            raise HTTPException(
                status_code = 500,
                detail      = "Erreur génération tests LLM"
            )

        # ── 4. Création branche + push ────────────────────
        print("[TESTS] Création branche et push...")
        resultat_branche = creer_branche_et_pousser(
            token         = token_clair,
            project_url   = data.project_url,
            branche_base  = data.branche,
            nom_fichier   = resultat_llm.get("fichier", "test_auto_generated.py"),
            contenu_tests = resultat_llm["contenu"]
        )

        # ── 5. Création MR (optionnel) ────────────────────
        resultat_mr = None
        if data.creer_mr:
            print("[TESTS] Création de la MR...")
            resultat_mr = creer_merge_request(
                token         = token_clair,
                project_url   = data.project_url,
                branche_src   = resultat_branche["branche"],
                branche_cible = data.branche
            )

        # ── 6. Calcul nombre de tests ─────────────────────
        contenu = resultat_llm["contenu"]
        nb_tests = (
            contenu.count("@Test") or
            contenu.count("def test_") or
            contenu.count("it(") or 1
        )

        # ── 7. Sauvegarde du test en base ─────────────────
        test_db = TestGenere(
            analyse_id       = data.analyse_id,
            depot_analyse_id = analyse.depot_analyse_id,
            langage          = resultat_llm.get("langage", "unknown"),
            framework        = resultat_llm.get("framework", ""),
            nom_fichier      = resultat_branche.get("fichier", "test_auto_generated.py"),
            contenu          = contenu,
            nb_tests         = nb_tests,
            nb_lots          = resultat_llm.get("nb_lots", 1),
            statut           = "pousse" if resultat_mr else "genere",
            branche_cible    = resultat_branche["branche"],
        )
        db.add(test_db)
        db.commit()
        db.refresh(test_db)

        # ── 8. Sauvegarde de la MR en base (si créée) ─────
        mr_db = None
        if resultat_mr:
            mr_db = MergeRequest(
                analyse_id       = data.analyse_id,
                test_id          = test_db.id,
                depot_analyse_id = analyse.depot_analyse_id,
                mr_id_gitlab     = resultat_mr["mr_id"],
                mr_url           = resultat_mr["mr_url"],
                titre            = resultat_mr["titre"],
                branche_source   = resultat_branche["branche"],
                branche_cible    = data.branche,
                statut           = resultat_mr["statut"],
                type_mr          = "tests",
                labels           = "IA,tests-automatiques"
            )
            db.add(mr_db)
            db.commit()
            db.refresh(mr_db)

        # ── 9. Retour API propre ──────────────────────────
        return {
            "message"    : "Tests générés avec succès",
            "test_id"    : test_db.id,
            "mr_id"      : mr_db.id if mr_db else None,
            "nb_tests"   : nb_tests,
            "fichier"    : test_db.nom_fichier,
            "branche"    : test_db.branche_cible,
            "langage"    : test_db.langage,
            "mr"         : resultat_mr,
            "analyse_id" : data.analyse_id
        }

    except HTTPException:
        raise

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code = 500,
            detail      = str(e)
        )
        # ════════════════════════════════════════════════════════
# ENDPOINT — Analyser le diff + merger si propre
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
            project = get_gitlab_project(token_clair, data.project_url)
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
    # backend/app/routes/analyses.py



# ════════════════════════════════════════════════════════
# ENDPOINT — Exporter le rapport en PDF
# GET /analyses/{analyse_id}/pdf
# ════════════════════════════════════════════════════════
# backend/app/routes/analyses.py

# backend/app/routes/analyses.py



# ════════════════════════════════════════════════════════
# ENDPOINT — Exporter le rapport en PDF
# GET /analyses/{analyse_id}/pdf
# ════════════════════════════════════════════════════════
# backend/app/routes/analyses.py

# backend/app/routes/analyses.py

@router.get("/{analyse_id}/pdf")
def exporter_pdf(
    analyse_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
    request: Request = None
):
    """
    Exporte le rapport d'analyse au format PDF.
    """
    from app.services.pdf_service import generer_rapport_pdf
    from fastapi.responses import FileResponse
    from app.models.export_rapport import ExportRapport

    # Récupérer l'utilisateur depuis le token (HEADER, pas URL)
    user_id = get_user_id_from_token(authorization, db)
    
    analyse = db.query(Analyse).filter(Analyse.id == analyse_id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse introuvable")
    
    depot = db.query(DepotAnalyse).filter(DepotAnalyse.id == analyse.depot_analyse_id).first()
    if not depot or depot.user_id != user_id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    analyse_dict = {
        "id": analyse.id,
        "branche": analyse.branche,
        "score_qualite": analyse.score_qualite,
        "score_securite": analyse.score_securite,
        "score_performance": analyse.score_performance,
        "vulnerabilites": analyse.vulnerabilites,
        "recommandations": analyse.recommandations,
        "owasp_enabled": analyse.owasp_enabled,
        "modele_llm": analyse.modele_llm,
        "created_at": str(analyse.created_at)
    }
    
    depot_dict = {
        "id": depot.id,
        "nom": depot.nom,
        "project_url": depot.project_url,
        "branche": depot.branche
    }
    
    try:
        pdf_path, taille = generer_rapport_pdf(analyse_dict, depot_dict)
        
        # Récupérer l'IP et User Agent avec des valeurs par défaut
        ip_address = None
        if request and request.client:
            ip_address = request.client.host
        
        # Alternative: récupérer depuis les headers proxy
        if not ip_address and request:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                ip_address = forwarded.split(",")[0].strip()
        
        user_agent = request.headers.get("user-agent") if request else None
        
        # Enregistrer l'export en base
        export = ExportRapport(
            analyse_id=analyse_id,
            user_id=user_id,
            format="pdf",
            chemin_fichier=pdf_path,
            taille=taille,
            ip_address=ip_address or "inconnu",
            user_agent=user_agent or "inconnu"
        )
        db.add(export)
        db.commit()
        
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=f"rapport_audit_{depot.nom}_{analyse.created_at.strftime('%Y%m%d')}.pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur génération PDF: {str(e)}")

class ModifierDepotRequest(PydanticBaseModel):
    nom         : Optional[str] = None
    project_url : Optional[str] = None
    branche     : Optional[str] = None
 
    model_config = {"from_attributes": True}
 
# IMPORTANT : appeler .model_rebuild() après la définition
# pour que Pydantic v2 finalise le schema avant que FastAPI
# ne l'utilise dans la résolution des dépendances.
ModifierDepotRequest.model_rebuild()
 
 
# ════════════════════════════════════════════════════════
# ENDPOINT — Modifier un dépôt
# PUT /analyses/depots/{depot_id}
# ════════════════════════════════════════════════════════
@router.put("/depots/{depot_id}")
def modifier_depot(
    depot_id      : int,
    data          : ModifierDepotRequest,   # ← plus d'alias, plus de Body()
    db            : Session = Depends(get_db),
    authorization : str     = Header(None)
):
    """
    Modifie le nom, l'URL ou la branche d'un dépôt analyse.
    Le frontend envoie : { "nom": "...", "project_url": "...", "branche": "..." }
    """
    user_id = get_user_id_from_token(authorization, db)
 
    depot = db.query(DepotAnalyse).filter(
        DepotAnalyse.id      == depot_id,
        DepotAnalyse.user_id == user_id
    ).first()
 
    if not depot:
        raise HTTPException(
            status_code=404,
            detail="Dépôt introuvable ou accès non autorisé"
        )
 
    if data.nom is not None and data.nom.strip():
        depot.nom = data.nom.strip()
 
    if data.project_url is not None and data.project_url.strip():
        depot.project_url = data.project_url.strip()
 
    if data.branche is not None and data.branche.strip():
        depot.branche = data.branche.strip()
 
    db.commit()
    db.refresh(depot)
 
    return {
        "id"          : depot.id,
        "nom"         : depot.nom,
        "project_url" : depot.project_url,
        "branche"     : depot.branche,
        "created_at"  : str(depot.created_at),
        "message"     : "Dépôt modifié avec succès"
    }
 
 
# ════════════════════════════════════════════════════════
# ENDPOINT — Supprimer un dépôt + toutes ses analyses
# DELETE /analyses/depots/{depot_id}
# ════════════════════════════════════════════════════════
@router.delete("/depots/{depot_id}", status_code=204)
def supprimer_depot(
    depot_id      : int,
    db            : Session = Depends(get_db),
    authorization : str     = Header(None)
):
    """
    Supprime un dépôt d'analyse globale et toutes ses données associées.

    La suppression est explicite car les anciennes bases déjà créées peuvent
    ne pas contenir les règles ON DELETE CASCADE ajoutées dans les modèles.
    """
    user_id = get_user_id_from_token(authorization, db)

    depot = db.query(DepotAnalyse).filter(
        DepotAnalyse.id == depot_id,
        DepotAnalyse.user_id == user_id
    ).first()

    if not depot:
        raise HTTPException(
            status_code=404,
            detail="Dépôt introuvable ou accès non autorisé"
        )

    try:
        analyses = db.query(Analyse).filter(Analyse.depot_analyse_id == depot_id).all()
        analyse_ids = [a.id for a in analyses]

        # Supprimer les fichiers physiques générés avant leurs enregistrements.
        if analyse_ids:
            exports = db.query(ExportRapport).filter(ExportRapport.analyse_id.in_(analyse_ids)).all()
            for export in exports:
                if export.chemin_fichier and os.path.isfile(export.chemin_fichier):
                    try:
                        os.remove(export.chemin_fichier)
                    except OSError:
                        pass

        # Les vidéos de rapport ne portent pas de FK analyse_id : elles sont
        # associées au dépôt par le propriétaire et le nom du projet.
        videos = db.query(VideoGeneree).filter(
            VideoGeneree.user_id == user_id,
            VideoGeneree.nom_projet == depot.nom
        ).all()
        for video in videos:
            if video.chemin_fichier and os.path.isfile(video.chemin_fichier):
                try:
                    os.remove(video.chemin_fichier)
                except OSError:
                    pass
            db.delete(video)

        if analyse_ids:
            # Dépendances liées à l'analyse.
            db.query(Feedback).filter(Feedback.analyse_id.in_(analyse_ids)).delete(synchronize_session=False)
            db.query(ExportRapport).filter(ExportRapport.analyse_id.in_(analyse_ids)).delete(synchronize_session=False)
            db.query(Recommandation).filter(Recommandation.analyse_id.in_(analyse_ids)).delete(synchronize_session=False)
            db.query(Vulnerabilite).filter(Vulnerabilite.analyse_id.in_(analyse_ids)).delete(synchronize_session=False)

            # Supprimer les MR avant les tests : merge_requests.test_id peut
            # référencer tests_generes et bloquer leur suppression.
            db.query(MergeRequest).filter(
                or_(
                    MergeRequest.depot_analyse_id == depot_id,
                    MergeRequest.analyse_id.in_(analyse_ids)
                )
            ).delete(synchronize_session=False)

            db.query(IssueGitLab).filter(
                or_(
                    IssueGitLab.depot_analyse_id == depot_id,
                    IssueGitLab.analyse_id.in_(analyse_ids)
                )
            ).delete(synchronize_session=False)

            db.query(TestGenere).filter(
                or_(
                    TestGenere.depot_analyse_id == depot_id,
                    TestGenere.analyse_id.in_(analyse_ids)
                )
            ).delete(synchronize_session=False)

            db.query(Analyse).filter(Analyse.id.in_(analyse_ids)).delete(synchronize_session=False)
        else:
            # Sécurise aussi le cas d'un dépôt sans analyse mais avec artefacts.
            db.query(MergeRequest).filter(MergeRequest.depot_analyse_id == depot_id).delete(synchronize_session=False)
            db.query(IssueGitLab).filter(IssueGitLab.depot_analyse_id == depot_id).delete(synchronize_session=False)
            db.query(TestGenere).filter(TestGenere.depot_analyse_id == depot_id).delete(synchronize_session=False)

        db.delete(depot)
        db.commit()
        return None

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la suppression complète du dépôt : {str(e)}"
        )
 