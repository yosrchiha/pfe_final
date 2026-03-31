# backend/app/routes/chat.py
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.config.database import get_db
import os
from openai import OpenAI

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    question: str
    contexte: dict | None = None


class ChatResponse(BaseModel):
    reponse: str


def get_llm_client():
    """Utilise OpenRouter ou Groq selon la configuration"""
    provider = os.getenv("LLM_PROVIDER", "openrouter")
    if provider == "openrouter":
        return OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            default_headers={
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "AuditPlatform"
            }
        )
    else:
        from groq import Groq
        return Groq(api_key=os.getenv("GROQ_API_KEY"))


@router.post("/ask", response_model=ChatResponse)
def ask_chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    """
    Répond aux questions de l'utilisateur sur l'analyse de code.
    """
    # Construire le prompt avec le contexte
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

    # Ajouter le contexte de l'analyse si disponible
    if contexte.get("projet"):
        system_prompt += f"""
        
Contexte de l'analyse :
- Projet : {contexte.get('projet')}
- Scores : Qualité {contexte.get('scores', {}).get('qualite', '?')} | Sécurité {contexte.get('scores', {}).get('securite', '?')} | Performance {contexte.get('scores', {}).get('performance', '?')}
"""
    
    if contexte.get("vulnerabilites"):
        system_prompt += "\nVulnérabilités détectées :\n"
        for v in contexte["vulnerabilites"][:5]:
            system_prompt += f"- {v.get('type')} ({v.get('severite')}) dans {v.get('fichier')} ligne {v.get('ligne')}\n"

    try:
        client = get_llm_client()
        model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct")

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.question}
            ],
            max_tokens=800,
            temperature=0.7
        )

        return ChatResponse(reponse=response.choices[0].message.content)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA: {str(e)}")