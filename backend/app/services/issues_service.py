# backend/app/services/issues_service.py

from sqlalchemy.orm import Session
from app.models.issue_gitlab import IssueGitLab
from app.services.gitlab_client import get_gitlab_project


def creer_issues_gitlab(
    token: str,
    project_name: str,
    vulnerabilites: list,
    analyse_id: int,
    depot_analyse_id: int,
    db: Session,
):
    """Crée les issues GitLab et les sauvegarde en base."""
    try:
        project = get_gitlab_project(token, project_name)
        created = 0

        for vuln in vulnerabilites:
            severite = vuln.get("severite", "MOYENNE")
            type_vuln = vuln.get("type", "Inconnu")
            fichier = vuln.get("fichier", "inconnu")
            ligne = vuln.get("ligne", 0)
            suggestion = vuln.get("suggestion", "")

            gitlab_issue = project.issues.create({
                "title": f"[{severite}] {type_vuln} — {fichier}",
                "description": f"""## Vulnérabilité détectée par l'IA

**Fichier :** `{fichier}`
**Ligne :** {ligne}
**Type :** {type_vuln}
**Sévérité :** {severite}

## Suggestion de correction

{suggestion}
""",
                "labels": ["IA", severite.lower()]
            })

            db.add(IssueGitLab(
                analyse_id=analyse_id,
                depot_analyse_id=depot_analyse_id,
                issue_id_gitlab=gitlab_issue.iid,
                issue_url=gitlab_issue.web_url,
                titre=gitlab_issue.title,
                description=gitlab_issue.description,
                severite=severite,
                type_vuln=type_vuln,
                fichier=fichier,
                ligne=ligne,
                statut=gitlab_issue.state,
                labels="IA," + severite.lower()
            ))
            created += 1

        db.commit()
        print(f"[ISSUES] ✅ {created} issue(s) créées et sauvegardées", flush=True)

    except Exception as e:
        print(f"[ISSUES] ❌ Erreur: {e}", flush=True)
        import traceback
        traceback.print_exc()
        db.rollback()
        raise  # ← on propage pour voir l'erreur dans Celery