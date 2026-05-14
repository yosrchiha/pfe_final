# backend/app/tasks/analyse_task.py
# ════════════════════════════════════════════════════════
# Correction : run_analyse accepte maintenant auto_tests et auto_mr
# (paramètres envoyés par apply_async depuis analyses.py)
# Sans ça : TypeError: run_analyse() got an unexpected keyword argument 'auto_tests'
# ════════════════════════════════════════════════════════

from app.celery_app import celery
from app.config.database import SessionLocal
from app.models.analyse        import Analyse
from app.models.depot_analyse  import DepotAnalyse
from app.models.vulnerabilite  import Vulnerabilite
from app.models.recommandation import Recommandation
from app.services.llm_service   import analyser_code
from app.services.gitlab_client import get_project_files
import traceback


def _maj_etape(analyse, etape, db):
    try:
        analyse.etape_courante = etape
        db.commit()
    except Exception:
        pass


@celery.task(
    bind=True,
    name="app.tasks.analyse_task.run_analyse",
    max_retries=2,
    default_retry_delay=30,
)
def run_analyse(
    self,
    analyse_id:    int,
    depot_id:      int,
    gitlab_token:  str,
    project_url:   str,
    branche:       str,
    owasp_enabled: bool,
    auto_tests:    bool = False,
    auto_mr:       bool = False,
):
    db = SessionLocal()
    try:
        analyse = db.query(Analyse).filter(Analyse.id == analyse_id).first()
        depot   = db.query(DepotAnalyse).filter(DepotAnalyse.id == depot_id).first()

        if not analyse or not depot:
            return {"statut": "erreur", "detail": "analyse ou dépôt introuvable"}

        # ── 1. Récupération des fichiers ──────────────────────────
        analyse.statut = "en_cours"
        _maj_etape(analyse, "recuperation_fichiers", db)

        fichiers = get_project_files(
            token        = gitlab_token,
            project_name = project_url,
            branch       = branche,
            extensions   = [
                ".py", ".js", ".ts", ".tsx", ".jsx",
                ".java", ".php", ".go", ".rb", ".cpp", ".cs",
            ],
        )

        if not fichiers:
            analyse.statut = "erreur"
            analyse.etape_courante = "aucun_fichier"
            db.commit()
            return {"statut": "erreur", "detail": "Aucun fichier source trouvé"}

        # ── 2. Appel LLM ─────────────────────────────────────────
        _maj_etape(analyse, "analyse_llm", db)
        rapport = analyser_code(
            [{"file_path": f["path"], "content": f["content"]} for f in fichiers],
            owasp_enabled,
        )

        # ── 3. Sauvegarde ─────────────────────────────────────────
        _maj_etape(analyse, "sauvegarde", db)

        # Réinitialise la session pour éviter PendingRollbackError
        db.rollback()
        db.expunge_all()
        analyse = db.query(Analyse).filter(Analyse.id == analyse_id).first()
        analyse.score_qualite     = rapport.get("score_qualite", 0)
        analyse.score_securite    = rapport.get("score_securite", 0)
        analyse.score_performance = rapport.get("score_performance", 0)
        analyse.vulnerabilites    = rapport.get("vulnerabilites", [])
        analyse.recommandations   = rapport.get("recommandations", [])
        analyse.statut            = "termine"
        db.commit()
        db.refresh(analyse)

        for vuln in rapport.get("vulnerabilites", []):
            db.add(Vulnerabilite(
                analyse_id      = analyse.id,
                type            = vuln.get("type",            "Inconnu"),
                severite        = vuln.get("severite",        "MOYENNE"),
                description     = vuln.get("description",     ""),
                suggestion      = vuln.get("suggestion",      ""),
                fichier         = vuln.get("fichier",         "inconnu"),
                ligne           = vuln.get("ligne",           0),
                colonne         = vuln.get("colonne"),
                categorie_owasp = vuln.get("categorie_owasp"),
                cwe_id          = vuln.get("cwe_id"),
                code_snippet    = vuln.get("code_snippet"),
                impact          = vuln.get("impact"),
                statut          = "detectee",
            ))
        db.commit()

        for rec in rapport.get("recommandations", []):
            db.add(Recommandation(
                analyse_id  = analyse.id,
                titre       = rec.get("titre",       "Recommandation"),
                description = rec.get("description", ""),
                priorite    = rec.get("priorite",    "MOYENNE"),
                categorie   = rec.get("categorie",   "bonnes_pratiques"),
                fichier     = rec.get("fichier"),
                ligne       = rec.get("ligne"),
            ))
        db.commit()

        # ── 4. Issues GitLab ──────────────────────────────────────
        _maj_etape(analyse, "creation_issues", db)
        if rapport.get("vulnerabilites"):
            try:
                from app.routes.analyses import creer_issues_gitlab
                creer_issues_gitlab(
                    token            = gitlab_token,
                    project_name     = project_url,
                    vulnerabilites   = rapport["vulnerabilites"],
                    analyse_id       = analyse.id,
                    depot_analyse_id = depot.id,
                    db               = db,
                )
            except Exception:
                pass  # les issues GitLab ne bloquent pas l'analyse

        _maj_etape(analyse, "termine", db)
        return {
            "statut"            : "termine",
            "analyse_id"        : analyse.id,
            "score_qualite"     : analyse.score_qualite,
            "score_securite"    : analyse.score_securite,
            "score_performance" : analyse.score_performance,
        }

    except Exception as exc:
        traceback.print_exc()
        try:
            db.rollback()
            a = db.query(Analyse).filter(Analyse.id == analyse_id).first()
            if a:
                a.statut         = "erreur"
                a.etape_courante = "erreur"
                db.commit()
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()