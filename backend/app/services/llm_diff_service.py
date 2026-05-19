"""
llm_diff_service.py
-------------------
Service LLM dédié à l'analyse de DIFF entre branches GitLab.
Séparé de llm_service.py (analyse globale) car le contexte est différent :
  - Analyse uniquement ce qui est INTRODUIT par le diff
  - Un seul appel LLM (pas 5 dimensions)
  - Focus sécurité + régressions
"""

import os
import re
import json
from openai import OpenAI
from groq import Groq

# ── Clients ──────────────────────────────────────────────────────────
groq_client  = Groq(api_key=os.getenv("GROQ_API_KEY"))
groq_model   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ✅ CORRECTION : ligne remontée ici (était collée dans le corps de _nettoyer_json)
openrouter_model = os.getenv("OPENROUTER_DIFF_MODEL", "llama-3.1-8b-instruct")

openrouter_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AuditPlatform"
    }
)


MAX_TOKENS_DIFF = 4000
CHARS_MAX_DIFF  = 15_000


# ══════════════════════════════════════════════════════════════════════
# PROMPT
# ══════════════════════════════════════════════════════════════════════
PROMPT_DIFF = """Tu es un expert en sécurité logicielle spécialisé dans la revue de diff Git.
Analyse le diff ci-dessous et détecte les vulnérabilités ou régressions introduites par les changements.

RÈGLES :
- Analyse UNIQUEMENT les lignes ajoutées (préfixées par +)
- Les lignes sans préfixe sont du contexte, ne les signale pas
- Si le diff est propre, retourne vulnerabilites vide et scores élevés
- Retourne UNIQUEMENT le JSON ci-dessous, sans texte avant ni après, sans markdown

FORMAT DE RÉPONSE (JSON pur) :
{
    "score_securite": <entier 0-100>,
    "score_qualite": <entier 0-100>,
    "vulnerabilites": [
        {
            "fichier": "<nom du fichier>",
            "ligne": <numéro entier >= 1>,
            "type": "<type ex: Injection SQL | Secret exposé | XSS | IDOR>",
            "severite": "<CRITIQUE | HAUTE | MOYENNE | FAIBLE>",
            "suggestion": "<correction concrète>",
            "description": "<pourquoi c'est un problème>"
        }
    ],
    "recommandations": [
        {
            "titre": "<titre court>",
            "description": "<conseil>"
        }
    ]
}

DIFF À ANALYSER :
{diff_text}
"""


# ══════════════════════════════════════════════════════════════════════
# UTILITAIRES
# ══════════════════════════════════════════════════════════════════════

def _nettoyer_json(contenu: str, source: str) -> dict:
    """Parse le JSON retourné par le LLM avec plusieurs stratégies de récupération."""

    print(f"[DIFF-LLM][{source}] Réponse brute ({len(contenu)} chars) :")
    print(contenu[:500])
    print("---")

    if not contenu or not contenu.strip():
        print(f"[DIFF-LLM][{source}] ❌ Réponse vide")
        return {}

    # Nettoyer les blocs markdown
    texte = re.sub(r"^```(?:json)?\s*", "", contenu.strip(), flags=re.IGNORECASE)
    texte = re.sub(r"\s*```$", "", texte.strip())
    texte = texte.strip()

    # Tentative 1 : parse direct
    try:
        return json.loads(texte)
    except json.JSONDecodeError:
        pass

    # Tentative 2 : extraire le premier { ... } valide
    start = texte.find('{')
    if start != -1:
        depth, in_string, escape = 0, False, False
        for idx in range(start, len(texte)):
            ch = texte[idx]
            if escape:
                escape = False
                continue
            if ch == '\\' and in_string:
                escape = True
                continue
            if ch == '"' and not escape:
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    fragment = texte[start:idx + 1]
                    try:
                        result = json.loads(fragment)
                        print(f"[DIFF-LLM][{source}] ⚠️ JSON extrait par recherche")
                        return result
                    except json.JSONDecodeError:
                        break

    # Tentative 3 : JSON tronqué — essayer de fermer les accolades
    if start != -1:
        fragment = texte[start:]
        depth = fragment.count('{') - fragment.count('}')
        if depth > 0:
            for closing in ['}' * depth, ']}' + '}' * (depth - 1)]:
                try:
                    result = json.loads(fragment + closing)
                    print(f"[DIFF-LLM][{source}] ⚠️ JSON tronqué réparé")
                    return result
                except json.JSONDecodeError:
                    continue

    print(f"[DIFF-LLM][{source}] ❌ Impossible de parser le JSON")
    return {}


def _preparer_diff(fichiers: list) -> str:
    """
    Prépare le texte du diff pour le prompt.
    Garde le diff brut complet pour ne pas perdre de contexte.
    """
    diff_text = ""
    total_chars = 0

    for f in fichiers:
        path = f.get("path", "inconnu")

        # Prendre le diff en priorité, sinon le content
        diff = f.get("diff", "") or f.get("content", "")

        if not diff or not diff.strip():
            print(f"[DIFF-LLM] ⚠️ Fichier '{path}' : diff vide, ignoré")
            continue

        bloc = f"\n\n--- FICHIER : {path} ---\n{diff}"

        # Tronquer si trop long
        if total_chars + len(bloc) > CHARS_MAX_DIFF:
            restant = CHARS_MAX_DIFF - total_chars
            if restant < 300:
                print(f"[DIFF-LLM] Budget épuisé, arrêt à {len(diff_text)} chars")
                break
            bloc = bloc[:restant] + "\n... [tronqué]"

        diff_text += bloc
        total_chars += len(bloc)
        print(f"[DIFF-LLM] Fichier '{path}' ajouté ({len(diff)} chars)")

        if total_chars >= CHARS_MAX_DIFF:
            break

    print(f"[DIFF-LLM] Diff total préparé : {total_chars} chars")
    return diff_text


def _appeler_llm_diff(diff_text: str) -> dict:
    """Appelle Groq en priorité, fallback OpenRouter."""
    prompt = PROMPT_DIFF.replace("{diff_text}", diff_text)
    print(f"[DIFF-LLM] Prompt total : {len(prompt)} chars")

    messages_llm = [
        {
            "role": "system",
            "content": (
                "Tu es un expert en sécurité logicielle. "
                "Tu réponds TOUJOURS avec un objet JSON valide et rien d'autre. "
                "Pas de texte avant, pas de texte après, pas de markdown, pas d'explication. "
                "Juste le JSON brut."
            )
        },
        {"role": "user", "content": prompt}
    ]

    # Tentative 1 : Groq
    try:
        print(f"[DIFF-LLM] → Appel Groq ({groq_model})...")
        response = groq_client.chat.completions.create(
            model=groq_model,
            messages=messages_llm,
            max_tokens=MAX_TOKENS_DIFF,
            temperature=0.1
        )
        contenu = response.choices[0].message.content.strip()
        print("[DIFF-LLM] ✅ Groq a répondu")
        result = _nettoyer_json(contenu, "Groq")
        if result:
            return result
        print("[DIFF-LLM] ⚠️ Groq JSON invalide, bascule OpenRouter...")

    except Exception as e:
        msg = str(e)
        if "429" in msg or "rate_limit" in msg.lower():
            print(f"[DIFF-LLM] ⚠️ Rate limit Groq : {msg[:100]}")
        else:
            print(f"[DIFF-LLM] ❌ Erreur Groq : {msg[:200]}")

    # Tentative 2 : OpenRouter
    try:
        print(f"[DIFF-LLM] → Appel OpenRouter ({openrouter_model})...")
        response = openrouter_client.chat.completions.create(
            model=openrouter_model,
            messages=messages_llm,
            max_tokens=MAX_TOKENS_DIFF,
            temperature=0.1
        )
        contenu = response.choices[0].message.content.strip()
        print("[DIFF-LLM] ✅ OpenRouter a répondu")
        result = _nettoyer_json(contenu, "OpenRouter")
        if result:
            return result
        print("[DIFF-LLM] ❌ OpenRouter JSON invalide aussi")

    except Exception as e2:
        print(f"[DIFF-LLM] ❌ Erreur OpenRouter : {str(e2)[:200]}")

    return {}


# ══════════════════════════════════════════════════════════════════════
# FONCTION PRINCIPALE
# ══════════════════════════════════════════════════════════════════════

def analyser_diff(fichiers: list) -> dict:
    """
    Analyse le diff entre deux branches.

    Args:
        fichiers : liste de dicts { path, diff, content }
                   format retourné par compare_branches()

    Returns:
        {
            score_securite            : int,
            score_qualite             : int,
            vulnerabilites            : list,
            vulnerabilites_bloquantes : list,  # CRITIQUE + HAUTE
            recommandations           : list
        }
    """
    if not fichiers:
        raise Exception("Aucun fichier diff à analyser")

    print("\n[DIFF-LLM] ════════════════════════════════════════")
    print(f"[DIFF-LLM] {len(fichiers)} fichier(s) reçu(s)")
    print(f"[DIFF-LLM] Modèle : Groq ({groq_model}) → fallback OpenRouter")
    print("[DIFF-LLM] ════════════════════════════════════════")

    diff_text = _preparer_diff(fichiers)

    # Aucun diff exploitable → résultat propre sans erreur
    if not diff_text.strip():
        print("[DIFF-LLM] Aucun contenu diff → résultat propre par défaut")
        return {
            "score_securite": 100,
            "score_qualite": 100,
            "vulnerabilites": [],
            "vulnerabilites_bloquantes": [],
            "recommandations": []
        }

    resultat = _appeler_llm_diff(diff_text)

    # Fallback si le LLM ne répond pas correctement — ne bloque pas le merge
    if not resultat:
        print("[DIFF-LLM] ⚠️ Aucun résultat valide → fallback neutre")
        return {
            "score_securite": 75,
            "score_qualite": 75,
            "vulnerabilites": [],
            "vulnerabilites_bloquantes": [],
            "recommandations": [
                {
                    "titre": "Analyse indisponible",
                    "description": "Le service d'analyse IA n'a pas pu traiter ce diff. Consultez les logs backend."
                }
            ]
        }

    # Normaliser les numéros de ligne
    vulnerabilites = resultat.get("vulnerabilites", [])
    for v in vulnerabilites:
        if not isinstance(v.get("ligne"), int) or v.get("ligne", 0) <= 0:
            v["ligne"] = 1

    # Trier par sévérité
    ordre = {"CRITIQUE": 0, "HAUTE": 1, "MOYENNE": 2, "FAIBLE": 3}
    vulnerabilites.sort(key=lambda v: ordre.get(v.get("severite", "FAIBLE"), 4))

    # Extraire les bloquantes (CRITIQUE + HAUTE)
    BLOQUANTES = {"CRITIQUE", "HAUTE"}
    vulns_bloquantes = [
        v for v in vulnerabilites
        if v.get("severite", "").upper() in BLOQUANTES
    ]

    score_securite  = resultat.get("score_securite", 75)
    score_qualite   = resultat.get("score_qualite", 75)
    recommandations = resultat.get("recommandations", [])

    print(f"[DIFF-LLM] Score sécurité  : {score_securite}")
    print(f"[DIFF-LLM] Score qualité   : {score_qualite}")
    print(f"[DIFF-LLM] Vulnérabilités  : {len(vulnerabilites)} ({len(vulns_bloquantes)} bloquantes)")
    print("[DIFF-LLM] ════════════════════════════════════════\n")

    return {
        "score_securite": score_securite,
        "score_qualite": score_qualite,
        "vulnerabilites": vulnerabilites,
        "vulnerabilites_bloquantes": vulns_bloquantes,
        "recommandations": recommandations
    }