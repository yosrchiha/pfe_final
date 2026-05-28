"""Service isolé pour générer et proposer des pipelines GitLab CI/CD.

Ce module ne modifie ni l'analyse LLM ni la génération de tests existante.
Il agit uniquement sur le fichier `.gitlab-ci.yml` d'une branche dédiée.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import yaml
from gitlab.exceptions import GitlabGetError

from app.services.gitlab_client import get_gitlab_project


PIPELINE_FILE_PATH = ".gitlab-ci.yml"


class PipelineServiceError(Exception):
    """Erreur métier claire à renvoyer par la route API."""


class ExistingPipelineError(PipelineServiceError):
    """Le dépôt contient déjà un pipeline qui ne doit pas être écrasé sans accord."""


def _repository_paths(project: Any, branch: str) -> list[str]:
    """Retourne les chemins versionnés sans télécharger tout le code."""
    try:
        tree = project.repository_tree(ref=branch.strip(), recursive=True, get_all=True)
    except Exception as exc:
        raise PipelineServiceError(
            f"Impossible de lire l'arborescence de la branche '{branch}' : {exc}"
        ) from exc

    return [item["path"] for item in tree if item.get("type") == "blob" and item.get("path")]


def detect_languages(project: Any, branch: str) -> list[str]:
    """Détecte les piles exécutables supportées par la V1 du générateur."""
    paths = [path.lower() for path in _repository_paths(project, branch)]
    basenames = {path.rsplit("/", 1)[-1] for path in paths}
    languages: list[str] = []

    has_python = (
        "requirements.txt" in basenames
        or "pyproject.toml" in basenames
        or any(path.endswith(".py") for path in paths)
    )
    has_node = (
        "package.json" in basenames
        or any(path.endswith((".js", ".jsx", ".ts", ".tsx")) for path in paths)
    )

    if has_python:
        languages.append("python")
    if has_node:
        languages.append("node")

    if not languages:
        raise PipelineServiceError(
            "Aucune pile supportée détectée. La première version prend en charge Python et Node.js/TypeScript."
        )
    return languages


def get_existing_pipeline(project: Any, branch: str) -> tuple[bool, str | None]:
    """Vérifie si le dépôt possède déjà un fichier GitLab CI sur la branche cible."""
    try:
        pipeline_file = project.files.get(PIPELINE_FILE_PATH, ref=branch.strip())
        content = pipeline_file.decode().decode("utf-8", errors="replace")
        return True, content
    except GitlabGetError as exc:
        if getattr(exc, "response_code", None) == 404:
            return False, None
        raise PipelineServiceError(f"Impossible de vérifier le pipeline existant : {exc}") from exc
    except Exception as exc:
        raise PipelineServiceError(f"Impossible de vérifier le pipeline existant : {exc}") from exc


def _base_pipeline() -> dict[str, Any]:
    return {
        "workflow": {
            "rules": [
                {"if": '$CI_PIPELINE_SOURCE == "merge_request_event"'},
                {"if": '$CI_PIPELINE_SOURCE == "push"'},
                {"if": '$CI_PIPELINE_SOURCE == "web"'},
            ]
        },
        "stages": [],
    }


def _append_stage(pipeline: dict[str, Any], stage: str) -> None:
    if stage not in pipeline["stages"]:
        pipeline["stages"].append(stage)


def generate_pipeline_yaml(
    languages: list[str],
    *,
    tests_enabled: bool,
    coverage_enabled: bool,
    security_enabled: bool,
    quality_enabled: bool,
    coverage_threshold: int,
) -> str:
    """Génère un `.gitlab-ci.yml` lisible et valide syntaxiquement."""
    pipeline = _base_pipeline()

    if tests_enabled:
        _append_stage(pipeline, "test")
    if security_enabled:
        _append_stage(pipeline, "security")
    if quality_enabled:
        _append_stage(pipeline, "quality")

    if "python" in languages:
        if tests_enabled:
            test_script = [
                "python -m pip install --upgrade pip",
                "if [ -f requirements.txt ]; then pip install -r requirements.txt; fi",
                "pip install pytest pytest-cov",
            ]
            if coverage_enabled:
                test_script.append(
                    f"pytest --cov=. --cov-report=term --cov-fail-under={coverage_threshold}"
                )
            else:
                test_script.append("pytest")
            pipeline["python_unit_tests"] = {
                "stage": "test",
                "image": "python:3.12",
                "script": test_script,
            }
        if security_enabled:
            pipeline["python_security_scan"] = {
                "stage": "security",
                "image": "python:3.12",
                "script": [
                    "pip install bandit",
                    "bandit -r . -x .venv,venv,node_modules,.git",
                ],
            }
        if quality_enabled:
            pipeline["python_quality_check"] = {
                "stage": "quality",
                "image": "python:3.12",
                "script": [
                    "pip install flake8",
                    "flake8 . --exclude=.venv,venv,node_modules,.git --max-line-length=120",
                ],
            }

    if "node" in languages:
        if tests_enabled:
            node_test_command = "npm test -- --coverage" if coverage_enabled else "npm test"
            pipeline["node_unit_tests"] = {
                "stage": "test",
                "image": "node:20",
                "script": [
                    "if [ -f package-lock.json ]; then npm ci; else npm install; fi",
                    node_test_command,
                ],
            }
        if security_enabled:
            pipeline["node_security_scan"] = {
                "stage": "security",
                "image": "node:20",
                "script": [
                    "if [ -f package-lock.json ]; then npm ci; else npm install; fi",
                    "npm audit --audit-level=high",
                ],
            }
        if quality_enabled:
            pipeline["node_quality_check"] = {
                "stage": "quality",
                "image": "node:20",
                "script": [
                    "if [ -f package-lock.json ]; then npm ci; else npm install; fi",
                    "npm run lint --if-present",
                ],
            }

    header = (
        "# Pipeline de controles executables genere par AuditPlatform.\n"
        "# L'audit LLM detaille reste orchestre par la plateforme.\n\n"
    )
    return header + yaml.safe_dump(pipeline, sort_keys=False, allow_unicode=True)


def build_preview(
    token: str,
    project_url: str,
    target_branch: str,
    *,
    tests_enabled: bool,
    coverage_enabled: bool,
    security_enabled: bool,
    quality_enabled: bool,
    coverage_threshold: int,
) -> dict[str, Any]:
    """Construit une proposition de pipeline sans modifier GitLab."""
    project = get_gitlab_project(token, project_url)
    languages = detect_languages(project, target_branch)
    has_existing, existing_content = get_existing_pipeline(project, target_branch)
    yaml_content = generate_pipeline_yaml(
        languages,
        tests_enabled=tests_enabled,
        coverage_enabled=coverage_enabled,
        security_enabled=security_enabled,
        quality_enabled=quality_enabled,
        coverage_threshold=coverage_threshold,
    )
    warning = None
    if has_existing:
        warning = (
            "Ce dépôt possède déjà un fichier .gitlab-ci.yml. "
            "Aucun remplacement ne sera effectué sans confirmation explicite."
        )
    return {
        "project_name": getattr(project, "name", project_url),
        "target_branch": target_branch,
        "languages": languages,
        "has_existing_pipeline": has_existing,
        "existing_pipeline_content": existing_content,
        "yaml_content": yaml_content,
        "warning": warning,
    }


def _branch_slug(project_name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9-]+", "-", project_name.lower()).strip("-")
    return slug[:40] or "project"


def publish_pipeline_merge_request(
    token: str,
    project_url: str,
    target_branch: str,
    *,
    tests_enabled: bool,
    coverage_enabled: bool,
    security_enabled: bool,
    quality_enabled: bool,
    coverage_threshold: int,
    replace_existing_pipeline: bool,
) -> dict[str, Any]:
    """Publie le YAML sur une branche isolée puis ouvre une Merge Request."""
    project = get_gitlab_project(token, project_url)
    languages = detect_languages(project, target_branch)
    has_existing, _ = get_existing_pipeline(project, target_branch)
    if has_existing and not replace_existing_pipeline:
        raise ExistingPipelineError(
            "Un pipeline existe déjà. Cochez la confirmation de remplacement pour créer une proposition en Merge Request."
        )

    yaml_content = generate_pipeline_yaml(
        languages,
        tests_enabled=tests_enabled,
        coverage_enabled=coverage_enabled,
        security_enabled=security_enabled,
        quality_enabled=quality_enabled,
        coverage_threshold=coverage_threshold,
    )
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    source_branch = f"ai/ci-pipeline/{_branch_slug(getattr(project, 'name', 'project'))}-{timestamp}"

    try:
        project.branches.create({"branch": source_branch, "ref": target_branch.strip()})
    except Exception as exc:
        raise PipelineServiceError(f"Impossible de créer la branche CI/CD : {exc}") from exc

    try:
        if has_existing:
            file_obj = project.files.get(PIPELINE_FILE_PATH, ref=source_branch)
            file_obj.content = yaml_content
            file_obj.save(
                branch=source_branch,
                commit_message="ci: proposer une nouvelle configuration GitLab CI/CD",
            )
        else:
            project.files.create(
                {
                    "file_path": PIPELINE_FILE_PATH,
                    "branch": source_branch,
                    "content": yaml_content,
                    "commit_message": "ci: ajouter le pipeline qualite genere par AuditPlatform",
                }
            )
    except Exception as exc:
        try:
            project.branches.delete(source_branch)
        except Exception:
            pass
        raise PipelineServiceError(f"Impossible de publier .gitlab-ci.yml : {exc}") from exc

    description = """## Pipeline CI/CD proposé par AuditPlatform

Cette Merge Request ajoute une configuration GitLab CI/CD générée depuis la plateforme.

### Contrôles proposés
- Exécution des tests unitaires sélectionnés
- Vérification de sécurité sélectionnée
- Vérification de qualité sélectionnée
- Contrôle de couverture si activé

### Sécurité du changement
- La branche principale n'a pas été modifiée directement.
- Une validation humaine est requise avant fusion.
- L'audit LLM détaillé continue d'être exécuté par AuditPlatform.
"""
    try:
        mr = project.mergerequests.create(
            {
                "source_branch": source_branch,
                "target_branch": target_branch.strip(),
                "title": "ci: ajouter le pipeline qualité généré par AuditPlatform",
                "description": description,
                "remove_source_branch": True,
            }
        )
    except Exception as exc:
        raise PipelineServiceError(
            f"Le fichier a été publié dans '{source_branch}', mais la Merge Request n'a pas pu être créée : {exc}"
        ) from exc

    return {
        "project_name": getattr(project, "name", project_url),
        "target_branch": target_branch,
        "source_branch": source_branch,
        "languages": languages,
        "file_path": PIPELINE_FILE_PATH,
        "replaced_existing_pipeline": has_existing,
        "merge_request_iid": mr.iid,
        "merge_request_url": mr.web_url,
        "merge_request_status": mr.state,
    }


def get_latest_pipeline_status(token: str, project_url: str, ref: str) -> dict[str, Any]:
    """Récupère le dernier pipeline et ses jobs pour une branche publiée."""
    project = get_gitlab_project(token, project_url)
    try:
        pipelines = project.pipelines.list(ref=ref.strip(), order_by="id", sort="desc", per_page=1)
    except Exception as exc:
        raise PipelineServiceError(f"Impossible de récupérer les pipelines : {exc}") from exc

    if not pipelines:
        return {
            "ref": ref,
            "found": False,
            "jobs": [],
            "message": "Aucun pipeline trouvé pour cette branche. GitLab peut nécessiter quelques instants après la création de la MR.",
        }

    try:
        pipeline = project.pipelines.get(pipelines[0].id)
        jobs = pipeline.jobs.list(get_all=True)
    except Exception as exc:
        raise PipelineServiceError(f"Impossible de lire le détail du pipeline : {exc}") from exc

    return {
        "ref": ref,
        "found": True,
        "pipeline_id": pipeline.id,
        "status": getattr(pipeline, "status", None),
        "source": getattr(pipeline, "source", None),
        "web_url": getattr(pipeline, "web_url", None),
        "coverage": getattr(pipeline, "coverage", None),
        "jobs": [
            {
                "id": job.id,
                "name": job.name,
                "stage": job.stage,
                "status": job.status,
                "web_url": getattr(job, "web_url", None),
            }
            for job in jobs
        ],
    }

def _serialise_datetime(value: Any) -> str | None:
    """Convertit une date python-gitlab en chaîne ISO utilisable par le frontend."""
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _serialise_job(job: Any) -> dict[str, Any]:
    """Normalise un job GitLab pour l'affichage de suivi."""
    return {
        "id": job.id,
        "name": getattr(job, "name", "Job"),
        "stage": getattr(job, "stage", "unknown"),
        "status": getattr(job, "status", "unknown"),
        "web_url": getattr(job, "web_url", None),
        "duration": getattr(job, "duration", None),
        "started_at": _serialise_datetime(getattr(job, "started_at", None)),
        "finished_at": _serialise_datetime(getattr(job, "finished_at", None)),
        "allow_failure": getattr(job, "allow_failure", None),
    }


def _pipeline_with_jobs(project: Any, pipeline_id: int) -> dict[str, Any]:
    """Récupère un pipeline GitLab complet et ses jobs réels."""
    try:
        pipeline = project.pipelines.get(pipeline_id)
        jobs = pipeline.jobs.list(get_all=True)
    except Exception as exc:
        raise PipelineServiceError(f"Impossible de lire le pipeline #{pipeline_id} : {exc}") from exc

    return {
        "id": pipeline.id,
        "status": getattr(pipeline, "status", None),
        "ref": getattr(pipeline, "ref", None),
        "source": getattr(pipeline, "source", None),
        "created_at": _serialise_datetime(getattr(pipeline, "created_at", None)),
        "updated_at": _serialise_datetime(getattr(pipeline, "updated_at", None)),
        "duration": getattr(pipeline, "duration", None),
        "coverage": getattr(pipeline, "coverage", None),
        "web_url": getattr(pipeline, "web_url", None),
        "jobs": [_serialise_job(job) for job in jobs],
    }


def get_pipeline_history(token: str, project_url: str, per_page: int = 5) -> dict[str, Any]:
    """Retourne les derniers pipelines GitLab du dépôt avec leurs jobs réels."""
    project = get_gitlab_project(token, project_url)
    try:
        pipelines = project.pipelines.list(order_by="id", sort="desc", per_page=per_page)
    except Exception as exc:
        raise PipelineServiceError(f"Impossible de récupérer l'historique des pipelines : {exc}") from exc

    return {
        "project_name": getattr(project, "name", project_url),
        "pipelines": [_pipeline_with_jobs(project, pipeline.id) for pipeline in pipelines],
    }


def get_pipeline_details(token: str, project_url: str, pipeline_id: int) -> dict[str, Any]:
    """Retourne le détail d'un pipeline GitLab précis et de ses jobs."""
    project = get_gitlab_project(token, project_url)
    return _pipeline_with_jobs(project, pipeline_id)

