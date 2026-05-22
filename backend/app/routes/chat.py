# backend/app/routes/chat.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.routes.auth import get_current_user
from app.models.user import User
from app.models.chat_message import ChatMessage
import os
from openai import OpenAI

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    question: str
    contexte: dict | None = None


class ChatResponse(BaseModel):
    reponse: str


def get_llm_client():
    provider = os.getenv("LLM_PROVIDER", "openrouter")

    if provider == "openrouter":
        return OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            default_headers={
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "AuditPlatform",
            },
        )

    from groq import Groq

    return Groq(api_key=os.getenv("GROQ_API_KEY"))


@router.post("/ask", response_model=ChatResponse)
def ask_chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contexte = request.contexte or {}

    system_prompt = """Tu es un assistant expert en sécurité et qualité du code.
Tu aides les développeurs à comprendre les analyses de code et les vulnérabilités détectées.

Règles :
- Réponds de manière claire et pédagogique
- Utilise le markdown pour structurer (code, listes)
- Propose des exemples concrets si pertinent
- Sois concis mais complet
- Reste dans le contexte de l'analyse GitLab

Si l'utilisateur pose une question hors sujet, redirige-le vers les fonctionnalités de la plateforme."""

    if contexte.get("projet"):
        system_prompt += f"""

Contexte de l'analyse :
- Projet : {contexte.get("projet")}
- Scores : Qualité {contexte.get("scores", {}).get("qualite", "?")} | Sécurité {contexte.get("scores", {}).get("securite", "?")} | Performance {contexte.get("scores", {}).get("performance", "?")}
"""

    if contexte.get("vulnerabilites"):
        system_prompt += "\nVulnérabilités détectées :\n"

        for v in contexte["vulnerabilites"][:5]:
            system_prompt += (
                f"- {v.get('type')} ({v.get('severite')}) "
                f"dans {v.get('fichier')} ligne {v.get('ligne')}\n"
            )

    try:
        client = get_llm_client()
        provider = os.getenv("LLM_PROVIDER", "openrouter")

        if provider == "openrouter":
            model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct")
        else:
            model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.question},
            ],
            max_tokens=800,
            temperature=0.7,
        )

        reponse_texte = response.choices[0].message.content

        # ── Sauvegarder l'échange dans chat_messages ──────────────
        vuln = contexte.get("vuln_selectionnee", {})

        message = ChatMessage(
            user_id=current_user.id,
            analyse_diff_id=contexte.get("analyse_diff_id"),
            analyse_fichier_id=contexte.get("analyse_fichier_id"),
            projet_nom=contexte.get("projet"),
            vuln_type=vuln.get("type"),
            vuln_severite=vuln.get("severite"),
            vuln_fichier=vuln.get("fichier"),
            vuln_ligne=vuln.get("ligne"),
            question=request.question,
            reponse=reponse_texte,
            modele_utilise=model,
            scores_contexte=contexte.get("scores"),
        )

        db.add(message)
        db.commit()

        return ChatResponse(reponse=reponse_texte)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur IA: {str(e)}")
