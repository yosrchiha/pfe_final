# backend/app/routes/explorer.py
# Remplace ENTIÈREMENT l'ancien fichier

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import gitlab
import json
import os
from sqlalchemy.sql import func
from app.config.database import get_db
from app.routes.auth import get_current_user
from app.models.user import User
from app.services.gitlab_client import get_project_files
# backend/app/routes/explorer.py (ajoutez ces routes)

from app.models.exploration import Exploration
from app.schemas.exploration import ExplorationCreate, ExplorationResponse, ExplorationListResponse
from app.models.correction import Correction
from app.schemas.correction import CorrectionCreate, CorrectionResponse, CorrectionHistoryResponse
import json
from app.models.mr_exploration import MrExploration
from app.schemas.mr_exploration import MrExplorationCreate, MrExplorationResponse, MrExplorationListResponse
router = APIRouter(prefix="/explorer", tags=["Explorer"])
# ════════════════════════════════════════════════════════════════════
# ROUTE — Sauvegarder une exploration
# POST /explorer/save
# ════════════════════════════════════════════════════════════════════

# Dans la route /explorer/save, remplacez :

@router.post("/save", response_model=ExplorationResponse)
def sauvegarder_exploration(
    body: ExplorationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sauvegarde une exploration dans la base de données.
    """
    existing = db.query(Exploration).filter(
        Exploration.user_id == current_user.id,
        Exploration.projet_chemin == body.projet_chemin,
        Exploration.branche == body.branche,
        Exploration.statut == "active"
    ).first()
    
    if existing:
        existing.total_fichiers = body.total_fichiers
        existing.gitlab_token = body.gitlab_token
        existing.extra_data = body.extra_data  # ← Remplacer metadata par extra_data
        existing.updated_at = func.now()
        db.commit()
        db.refresh(existing)
        return existing
    
    exploration = Exploration(
        user_id=current_user.id,
        projet_nom=body.projet_nom,
        projet_chemin=body.projet_chemin,
        branche=body.branche,
        gitlab_token=body.gitlab_token,
        total_fichiers=body.total_fichiers,
        extra_data=body.extra_data  # ← Remplacer metadata par extra_data
    )
    
    db.add(exploration)
    db.commit()
    db.refresh(exploration)
    
    return exploration


# ════════════════════════════════════════════════════════════════════
# ROUTE — Récupérer toutes les explorations d'un utilisateur
# GET /explorer/history
# ════════════════════════════════════════════════════════════════════

@router.get("/history", response_model=list[ExplorationListResponse])
def get_user_explorations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """
    Récupère l'historique des explorations de l'utilisateur.
    """
    explorations = db.query(Exploration).filter(
        Exploration.user_id == current_user.id,
        Exploration.statut == "active"
    ).order_by(
        Exploration.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return explorations


# ════════════════════════════════════════════════════════════════════
# ROUTE — Supprimer une exploration
# DELETE /explorer/history/{exploration_id}
# ════════════════════════════════════════════════════════════════════

@router.delete("/history/{exploration_id}", status_code=204)
def delete_exploration(
    exploration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Supprime une exploration (soft delete ou hard delete).
    """
    exploration = db.query(Exploration).filter(
        Exploration.id == exploration_id,
        Exploration.user_id == current_user.id
    ).first()
    
    if not exploration:
        raise HTTPException(status_code=404, detail="Exploration non trouvée")
    
    # Soft delete (marquer comme archivée)
    exploration.statut = "archived"
    db.commit()
    
    # Ou hard delete :
    # db.delete(exploration)
    # db.commit()




# ── Helper nettoyage nom projet ───────────────────────────
def _clean(project_name: str) -> str:
    n = project_name.strip()
    if "git@gitlab.com:" in n:
        n = n.split("git@gitlab.com:")[-1]
    elif "gitlab.com/" in n:
        n = n.split("gitlab.com/")[-1]
    return n.replace(".git", "").strip("/")
@router.post("/correction/save", response_model=CorrectionResponse)
def sauvegarder_correction(
    body: CorrectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sauvegarde une correction IA dans l'historique.
    """
    correction = Correction(
        user_id=current_user.id,
        projet_nom=body.projet_nom,
        fichier_path=body.fichier_path,
        branche=body.branche,
        vuln_type=body.vuln_type,
        vuln_severite=body.vuln_severite,
        vuln_ligne=body.vuln_ligne,
        vuln_suggestion=body.vuln_suggestion,
        contenu_original=body.contenu_original,
        contenu_corrige=body.contenu_corrige,
        statut="appliquee"
    )
    
    db.add(correction)
    db.commit()
    db.refresh(correction)
    
    return correction


# ════════════════════════════════════════════════════════════════════
# ROUTE — Historique des corrections d'un utilisateur
# GET /explorer/correction/history
# ════════════════════════════════════════════════════════════════════

@router.get("/correction/history", response_model=list[CorrectionHistoryResponse])
def get_correction_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    fichier_path: Optional[str] = None,
    limit: int = 50
):
    """
    Récupère l'historique des corrections IA de l'utilisateur.
    Optionnellement filtré par fichier.
    """
    query = db.query(Correction).filter(Correction.user_id == current_user.id)
    
    if fichier_path:
        query = query.filter(Correction.fichier_path == fichier_path)
    
    corrections = query.order_by(Correction.created_at.desc()).limit(limit).all()
    
    return corrections


# ════════════════════════════════════════════════════════════════════
# ROUTE — Marquer une correction comme poussée
# PATCH /explorer/correction/{correction_id}/pushed
# ════════════════════════════════════════════════════════════════════

@router.patch("/correction/{correction_id}/pushed")
def marquer_correction_poussee(
    correction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marque une correction comme ayant été poussée vers GitLab.
    """
    correction = db.query(Correction).filter(
        Correction.id == correction_id,
        Correction.user_id == current_user.id
    ).first()
    
    if not correction:
        raise HTTPException(status_code=404, detail="Correction non trouvée")
    
    correction.statut = "poussee"
    correction.pushed_at = func.now()
    db.commit()
    
    return {"message": "Correction marquée comme poussée"}


# ══════════════════════════════════════════════════════════
# SCHÉMAS
# ══════════════════════════════════════════════════════════

class ExploreRequest(BaseModel):
    nom:     str
    branche: str
    token:   str


class GitLabTokenRequest(BaseModel):
    token: str


class BranchesRequest(BaseModel):
    token:        str
    project_name: str


class CorrigerRequest(BaseModel):
    fichier_path:    str
    contenu_numerote: str   # code déjà numéroté "   1 | code"
    vuln_type:       str
    vuln_ligne:      int
    vuln_suggestion: str
    severite:        str


class FichierModifie(BaseModel):
    path:    str
    contenu: str


class PushRequest(BaseModel):
    token:       str
    projet:      str
    branche_src: str
    branche_dst: str
    mode:        str          # "existing" | "new"
    message:     str
    fichiers:    List[FichierModifie]


# ══════════════════════════════════════════════════════════
# ROUTE 1 — Récupérer les fichiers d'une branche
# POST /explorer/files
# ══════════════════════════════════════════════════════════
@router.post("/files")
def explore_branch(body: ExploreRequest):
    try:
        fichiers = get_project_files(
            token=body.token,
            project_name=body.nom,
            branch=body.branche,
            extensions=None
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "projet":   body.nom,
        "branche":  body.branche,
        "token":    body.token,   # ← IMPORTANT : retourné pour le push
        "total":    len(fichiers),
        "fichiers": fichiers
    }


# ══════════════════════════════════════════════════════════
# ROUTE 2 — Lister les projets GitLab
# POST /explorer/gitlab/projets
# ══════════════════════════════════════════════════════════
@router.post("/gitlab/projets")
def lister_projets_gitlab(request: GitLabTokenRequest):
    gl = gitlab.Gitlab("https://gitlab.com", private_token=request.token)
    try:
        gl.auth()
    except Exception:
        raise HTTPException(status_code=401, detail="Token GitLab invalide")
    projets = gl.projects.list(owned=True, membership=True, all=True)
    return [{"id": p.id, "nom": p.name, "chemin": p.path_with_namespace, "url": p.web_url} for p in projets]


# ══════════════════════════════════════════════════════════
# ROUTE 3 — Lister les branches
# POST /explorer/gitlab/branches
# ══════════════════════════════════════════════════════════
@router.post("/gitlab/branches")
def get_gitlab_branches(data: BranchesRequest):
    try:
        gl = gitlab.Gitlab("https://gitlab.com", private_token=data.token)
        project = gl.projects.get(_clean(data.project_name))
        branches = project.branches.list()
        return {
            "project": _clean(data.project_name),
            "branches": [{"name": b.name, "default": b.name == project.default_branch} for b in branches]
        }
    except gitlab.exceptions.GitlabAuthenticationError:
        raise HTTPException(status_code=401, detail="Token GitLab invalide")
    except gitlab.exceptions.GitlabGetError:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════
# ROUTE 4 — Correction IA d'une vulnérabilité
# POST /explorer/corriger
# ══════════════════════════════════════════════════════════
@router.post("/corriger")
def corriger_fichier(body: CorrigerRequest):
    """
    Envoie le fichier (numéroté) + la description de la vuln au LLM.
    Retourne { contenu_corrige, explication }.
    Fallback automatique : Groq → OpenRouter si rate limit 429.
    """
    from groq import Groq
    from openai import OpenAI

    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    openrouter_client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
    )
    openrouter_model = os.getenv("OPENROUTER_DIFF_MODEL", "llama-3.1-8b-instruct")

    prompt = f"""Tu es un expert en sécurité logicielle. Corrige UNIQUEMENT la vulnérabilité décrite.

VULNÉRABILITÉ :
- Fichier  : {body.fichier_path}
- Ligne    : {body.vuln_ligne}
- Type     : {body.vuln_type}
- Sévérité : {body.severite}
- Suggestion : {body.vuln_suggestion}

RÈGLES :
1. Modifie SEULEMENT la ligne problématique et ce qui est strictement nécessaire.
2. Garde exactement le même style (indentation, noms de variables, structure).
3. Retourne UNIQUEMENT un objet JSON valide, sans markdown, sans texte autour.

JSON attendu :
{{"contenu_corrige": "<fichier entier corrigé SANS numéros de ligne>", "explication": "<une phrase>"}}

Code (lignes numérotées pour référence) :
{body.contenu_numerote}
"""

    def _parse_json(raw: str):
        """Extrait le JSON de la réponse même si entouré de markdown."""
        if "```" in raw:
            for part in raw.split("```"):
                part = part.strip()

                if part.startswith("json"):
                    part = part[4:].strip()

                if part.startswith("{"):
                    try:
                        return json.loads(part)
                    except Exception:
                        continue

        try:
            return json.loads(raw)
        except Exception:
            pass

        s = raw.find("{")
        e = raw.rfind("}") + 1

        if s >= 0 and e > s:
            return json.loads(raw[s:e])

        return None

    # ── Tentative 1 : Groq ───────────────────────────────
    try:
        print(f"[CORRIGER] → Groq ({groq_model})...")

        response = groq_client.chat.completions.create(
            model=groq_model,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            max_tokens=4000,
            temperature=0.1,
        )

        raw = response.choices[0].message.content.strip()
        result = _parse_json(raw)

        if result:
            print("[CORRIGER] ✅ Groq OK")
            return result

        raise ValueError("JSON invalide retourné par Groq")

    except Exception as e:
        err_str = str(e)

        if (
            "429" in err_str
            or "rate_limit" in err_str.lower()
            or "rate limit" in err_str.lower()
        ):
            print(f"[CORRIGER] ⚠️ Groq rate limit — fallback OpenRouter ({openrouter_model})")
        else:
            print(f"[CORRIGER] ⚠️ Groq erreur ({err_str[:80]}) — fallback OpenRouter")

    # ── Tentative 2 : OpenRouter ─────────────────────────
    try:
        print(f"[CORRIGER] → OpenRouter ({openrouter_model})...")

        response = openrouter_client.chat.completions.create(
            model=openrouter_model,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            max_tokens=4000,
            temperature=0.1,
        )

        raw = response.choices[0].message.content.strip()
        result = _parse_json(raw)

        if result:
            print("[CORRIGER] ✅ OpenRouter OK")
            return result

        raise HTTPException(
            status_code=500,
            detail="Le LLM n'a pas retourné un JSON valide.",
        )

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur LLM (Groq + OpenRouter): {str(e)}",
        )

# ══════════════════════════════════════════════════════════
# ROUTE 5 — Push des fichiers modifiés vers GitLab
# POST /explorer/push
# ══════════════════════════════════════════════════════════
@router.post("/push")
def push_vers_gitlab(body: PushRequest):
    """
    Pousse les fichiers modifiés vers GitLab.
    mode="existing" : commit direct sur branche_dst
    mode="new"      : crée branche_dst depuis branche_src, puis commit
    """
    if not body.fichiers:
        raise HTTPException(status_code=400, detail="Aucun fichier à pousser.")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message de commit requis.")
    if not body.branche_dst.strip():
        raise HTTPException(status_code=400, detail="Branche cible requise.")

    # ── Connexion GitLab ──────────────────────────────────
    gl = gitlab.Gitlab("https://gitlab.com", private_token=body.token)
    try:
        gl.auth()
    except gitlab.exceptions.GitlabAuthenticationError:
        raise HTTPException(status_code=401, detail="Token GitLab invalide ou révoqué.")

    try:
        project = gl.projects.get(_clean(body.projet))
    except gitlab.exceptions.GitlabGetError:
        raise HTTPException(status_code=404, detail=f"Projet '{body.projet}' introuvable.")

    branche_cible = body.branche_dst.strip()

    # ── Créer la branche si mode "new" ────────────────────
    if body.mode == "new":
        try:
            project.branches.create({"branch": branche_cible, "ref": body.branche_src.strip()})
        except Exception as e:
            if "already exists" not in str(e).lower():
                raise HTTPException(status_code=500, detail=f"Impossible de créer la branche : {str(e)}")

    # ── Préparer les actions ──────────────────────────────
    actions = []
    for f in body.fichiers:
        if not f.path:
            continue
        # Vérifier si le fichier existe → update ou create
        try:
            project.files.get(f.path, ref=branche_cible)
            action = "update"
        except Exception:
            action = "create"

        actions.append({
            "action":    action,
            "file_path": f.path,
            "content":   f.contenu,
            "encoding":  "text",
        })

    if not actions:
        raise HTTPException(status_code=400, detail="Aucune action valide à pousser.")

    # ── Commit ────────────────────────────────────────────
    try:
        commit = project.commits.create({
            "branch":         branche_cible,
            "commit_message": body.message.strip(),
            "actions":        actions,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur GitLab commit : {str(e)}")

    # ── Créer la MR sur GitLab si mode "new" ─────────────
    mr_url  = None
    mr_id   = None
    mr_iid  = None

    if body.mode == "new":
        try:
            mr = project.mergerequests.create({
                "source_branch": branche_cible,
                "target_branch": body.branche_src.strip(),
                "title":         body.message.strip(),
                "description":   f"Corrections automatiques par IA — {len(actions)} fichier(s) modifié(s)",
                "labels":        "IA,auto-merge",
            })
            mr_url = mr.web_url
            mr_id  = mr.id
            mr_iid = mr.iid
            print(f"[MR] ✅ MR créée : {mr_url}")
        except Exception as e:
            print(f"[MR] ⚠️ Erreur création MR : {str(e)}")
            # On ne bloque pas le push si la MR échoue

    return {
        "message":   f"✓ {len(actions)} fichier(s) poussé(s) sur '{branche_cible}'",
        "commit_id": commit.id,
        "branche":   branche_cible,
        "fichiers":  len(actions),
        "url":       mr_url or f"{project.web_url}/-/commit/{commit.id}",
        "mr_url":    mr_url,
        "mr_id":     mr_id,
        "mr_iid":    mr_iid,
        "mode":      body.mode,
    }
@router.post("/mr/save", response_model=MrExplorationResponse)
def sauvegarder_mr_exploration(
    body: MrExplorationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sauvegarde une Merge Request créée depuis l'explorateur.
    """
    fichiers_json = json.dumps(body.fichiers_modifies) if body.fichiers_modifies else None
    
    mr = MrExploration(
        user_id=current_user.id,
        projet_nom=body.projet_nom,
        projet_chemin=body.projet_chemin,
        branche_source=body.branche_source,
        branche_cible=body.branche_cible,
        titre=body.titre,
        description=body.description,
        mr_id_gitlab=body.mr_id_gitlab,
        mr_iid_gitlab=body.mr_iid_gitlab,
        mr_url=body.mr_url,
        fichiers_modifies=fichiers_json,
        statut="opened"
    )
    
    db.add(mr)
    db.commit()
    db.refresh(mr)
    
    return mr


# ════════════════════════════════════════════════════════════════════
# ROUTE — Récupérer toutes les MRs d'un utilisateur
# GET /explorer/mr/history
# ════════════════════════════════════════════════════════════════════

@router.get("/mr/history", response_model=list[MrExplorationListResponse])
def get_user_mr_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    projet_chemin: Optional[str] = None,
    limit: int = 50
):
    """
    Récupère l'historique des MRs créées depuis l'explorateur.
    """
    query = db.query(MrExploration).filter(MrExploration.user_id == current_user.id)
    
    if projet_chemin:
        query = query.filter(MrExploration.projet_chemin == projet_chemin)
    
    mrs = query.order_by(MrExploration.created_at.desc()).limit(limit).all()
    
    return mrs


# ════════════════════════════════════════════════════════════════════
# ROUTE — Mettre à jour le statut d'une MR
# PATCH /explorer/mr/{mr_id}/status
# ════════════════════════════════════════════════════════════════════

@router.patch("/mr/{mr_id}/status")
def update_mr_status(
    mr_id: int,
    statut: str,  # opened, merged, closed
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Met à jour le statut d'une MR (merged, closed).
    """
    mr = db.query(MrExploration).filter(
        MrExploration.id == mr_id,
        MrExploration.user_id == current_user.id
    ).first()
    
    if not mr:
        raise HTTPException(status_code=404, detail="MR non trouvée")
    
    mr.statut = statut
    if statut == "merged":
        mr.merged_at = func.now()
    elif statut == "closed":
        mr.closed_at = func.now()
    
    db.commit()
    
    return {"message": f"Statut mis à jour : {statut}"}