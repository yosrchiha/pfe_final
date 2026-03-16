# backend/app/services/llm_service.py

import os
import json
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def analyser_code(fichiers: list, owasp_enabled: bool) -> dict:

    # Préparer le code à analyser
    code_text = ""
    for f in fichiers:
        code_text += f"\n\n=== {f['file_path']} ===\n{f['content']}"

    # Ligne OWASP optionnelle
    owasp_ligne = ""
    if owasp_enabled:
        owasp_ligne = "Vérifie aussi les failles de sécurité OWASP Top 10."

    prompt = f"""
Tu es un expert en analyse de code.
Analyse ce code source et retourne UNIQUEMENT un JSON valide.
Aucun texte avant ou après le JSON.
{owasp_ligne}

Structure exacte du JSON :
{{
    "score_qualite": nombre entre 0 et 100,
    "score_securite": nombre entre 0 et 100,
    "score_performance": nombre entre 0 et 100,
    "vulnerabilites": [
        {{
            "fichier": "nom_du_fichier.py",
            "ligne": numero_de_ligne,
            "type": "type de vulnérabilité",
            "severite": "CRITIQUE ou HAUTE ou MOYENNE ou FAIBLE",
            "suggestion": "comment corriger ce problème"
        }}
    ],
    "recommandations": [
        {{
            "titre": "titre court",
            "description": "explication détaillée"
        }}
    ]
}}

Code à analyser :
{code_text[:8000]}
"""

    response = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
        temperature=0.1
    )

    contenu = response.choices[0].message.content

    # Nettoyer si le LLM ajoute des backticks
    contenu = contenu.strip()
    if contenu.startswith("```"):
        contenu = contenu.split("```")[1]
        if contenu.startswith("json"):
            contenu = contenu[4:]

    return json.loads(contenu.strip())