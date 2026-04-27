# backend/app/routes/tts.py
# ─────────────────────────────────────────────────────────────────────────────
#  Route TTS  –  convertit le texte d'une vulnérabilité en fichier MP3
#  Utilise edge-tts (Microsoft Edge TTS) : 100% gratuit, aucune clé API
#  Installation : pip install edge-tts
# ─────────────────────────────────────────────────────────────────────────────

import edge_tts
import asyncio
import tempfile
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/tts", tags=["TTS"])


# ── Modèles de requête ────────────────────────────────────────────────────────

class TTSVulnerabilite(BaseModel):
    """Données d'une vulnérabilité à lire à voix haute."""
    type_vuln: str           # ex: "SQL_INJECTION"
    severite: str            # ex: "CRITIQUE"
    fichier: str             # ex: "backend/routes/auth.py"
    ligne: int               # ex: 42
    suggestion: str          # la correction suggérée
    langue: Optional[str] = "fr"   # "fr" | "en" | "ar"


class TTSTexteLibre(BaseModel):
    """Texte libre à convertir en audio."""
    texte: str
    langue: Optional[str] = "fr"


# ── Voix disponibles par langue ───────────────────────────────────────────────

VOIX = {
    "fr": "fr-FR-DeniseNeural",        # Français — féminin, clair, professionnel
    "fr_m": "fr-FR-HenriNeural",       # Français — masculin
    "en": "en-US-AriaNeural",          # Anglais — féminin
    "ar": "ar-DZ-AminaNeural",         # Arabe algérien — féminin
    "ar_eg": "ar-EG-SalmaNeural",      # Arabe égyptien — féminin
}


# ── Textes explicatifs OWASP par type de vulnérabilité ────────────────────────

EXPLICATIONS_OWASP = {
    "SQL_INJECTION": {
        "fr": (
            "Injection SQL détectée. "
            "Cette vulnérabilité permet à un attaquant d'insérer du code SQL malveillant "
            "dans une requête de base de données, ce qui peut lui donner accès à toutes vos données, "
            "voire lui permettre de les modifier ou de les supprimer. "
            "Pour éliminer cette erreur : utilisez des requêtes préparées avec des paramètres liés, "
            "et n'intégrez jamais directement les entrées utilisateur dans vos requêtes SQL."
        ),
        "en": (
            "SQL Injection detected. "
            "This vulnerability allows an attacker to insert malicious SQL code into a database query, "
            "potentially giving them access to all your data or allowing them to modify or delete it. "
            "To fix this: use prepared statements with bound parameters, "
            "and never directly include user input in your SQL queries."
        ),
    },
    "XSS": {
        "fr": (
            "Cross-Site Scripting détecté, ou X.S.S. "
            "Cette faille permet à un attaquant d'injecter du code JavaScript malveillant "
            "dans les pages consultées par d'autres utilisateurs. "
            "Cela peut permettre le vol de sessions, la redirection vers des sites malveillants, "
            "ou l'affichage de faux contenus. "
            "Pour corriger : échappez toutes les données affichées côté client, "
            "utilisez une politique de sécurité de contenu, et validez toutes les entrées utilisateur."
        ),
        "en": (
            "Cross-Site Scripting detected, or X.S.S. "
            "This flaw allows an attacker to inject malicious JavaScript into pages viewed by other users, "
            "enabling session theft, malicious redirections, or fake content. "
            "To fix: escape all client-side displayed data, use Content Security Policy, "
            "and validate all user inputs."
        ),
    },
    "BROKEN_AUTH": {
        "fr": (
            "Authentification défaillante détectée. "
            "Cette vulnérabilité expose les mécanismes d'authentification à des attaques, "
            "permettant à un attaquant de compromettre des mots de passe, clés ou jetons de session. "
            "Pour corriger : implémentez une authentification multi-facteurs, "
            "utilisez des sessions sécurisées avec des identifiants forts, "
            "et invalidez les tokens après déconnexion."
        ),
        "en": (
            "Broken authentication detected. "
            "This vulnerability exposes authentication mechanisms to attacks, "
            "allowing attackers to compromise passwords, keys, or session tokens. "
            "To fix: implement multi-factor authentication, use secure sessions, "
            "and invalidate tokens after logout."
        ),
    },
    "SENSITIVE_DATA": {
        "fr": (
            "Exposition de données sensibles détectée. "
            "Des données confidentielles comme des mots de passe, numéros de carte bancaire "
            "ou informations personnelles sont exposées sans protection suffisante. "
            "Pour corriger : chiffrez toutes les données sensibles au repos et en transit, "
            "utilisez des algorithmes de hachage forts comme bcrypt pour les mots de passe, "
            "et ne stockez jamais de données sensibles en clair."
        ),
        "en": (
            "Sensitive data exposure detected. "
            "Confidential data such as passwords or personal information is exposed without sufficient protection. "
            "To fix: encrypt all sensitive data at rest and in transit, "
            "use strong hashing algorithms like bcrypt for passwords, "
            "and never store sensitive data in plain text."
        ),
    },
    "BROKEN_ACCESS": {
        "fr": (
            "Contrôle d'accès défaillant détecté. "
            "Les utilisateurs peuvent accéder à des ressources ou effectuer des actions "
            "qui devraient être réservées à d'autres rôles. "
            "Pour corriger : vérifiez les autorisations à chaque requête, "
            "appliquez le principe du moindre privilège, "
            "et refusez l'accès par défaut."
        ),
        "en": (
            "Broken access control detected. "
            "Users can access resources or perform actions reserved for other roles. "
            "To fix: verify permissions on every request, apply least privilege principle, "
            "and deny access by default."
        ),
    },
    "SECURITY_MISCONFIGURATION": {
        "fr": (
            "Mauvaise configuration de sécurité détectée. "
            "Une configuration incorrecte expose votre application à des risques inutiles. "
            "Cela inclut des valeurs par défaut non modifiées, des fonctionnalités inutiles activées, "
            "ou des messages d'erreur trop détaillés. "
            "Pour corriger : auditez régulièrement vos configurations, "
            "désactivez les fonctionnalités non utilisées, "
            "et ne jamais déployer avec des configurations par défaut."
        ),
        "en": (
            "Security misconfiguration detected. "
            "Incorrect configuration exposes your application to unnecessary risks. "
            "To fix: regularly audit your configurations, disable unused features, "
            "and never deploy with default settings."
        ),
    },
    "INJECTION": {
        "fr": (
            "Injection détectée. "
            "Des données non fiables sont envoyées à un interpréteur sous forme de commande ou de requête. "
            "Cela peut permettre à un attaquant d'exécuter des commandes arbitraires sur votre système. "
            "Pour corriger : validez et échappez toutes les entrées utilisateur, "
            "utilisez des API sécurisées qui évitent l'utilisation directe d'un interpréteur, "
            "et appliquez une liste blanche de valeurs acceptables."
        ),
        "en": (
            "Injection detected. "
            "Untrusted data is sent to an interpreter as a command or query. "
            "To fix: validate and escape all user inputs, use safe APIs that avoid direct interpreter use, "
            "and apply an allowlist of acceptable values."
        ),
    },
    "INSECURE_DESERIALIZATION": {
        "fr": (
            "Désérialisation non sécurisée détectée. "
            "Des objets sérialisés provenant de sources non fiables peuvent être manipulés "
            "pour exécuter du code malveillant. "
            "Pour corriger : n'acceptez jamais des objets sérialisés de sources non fiables, "
            "utilisez des formats d'échange simples comme JSON, "
            "et validez les données après désérialisation."
        ),
        "en": (
            "Insecure deserialization detected. "
            "Serialized objects from untrusted sources can be manipulated to execute malicious code. "
            "To fix: never accept serialized objects from untrusted sources, "
            "use simple exchange formats like JSON, and validate data after deserialization."
        ),
    },
    "USING_COMPONENTS_WITH_KNOWN_VULNERABILITIES": {
        "fr": (
            "Composant avec vulnérabilité connue détecté. "
            "Votre application utilise une bibliothèque ou un composant "
            "pour lequel des failles de sécurité ont été publiées. "
            "Pour corriger : mettez à jour régulièrement toutes vos dépendances, "
            "abonnez-vous aux alertes de sécurité des bibliothèques que vous utilisez, "
            "et retirez les dépendances non nécessaires."
        ),
        "en": (
            "Component with known vulnerability detected. "
            "Your application uses a library with published security flaws. "
            "To fix: regularly update all dependencies, subscribe to security alerts, "
            "and remove unnecessary dependencies."
        ),
    },
    "CSRF": {
        "fr": (
            "Falsification de requête inter-sites détectée, ou C.S.R.F. "
            "Un attaquant peut forcer un utilisateur authentifié à exécuter des actions "
            "non désirées sur votre application. "
            "Pour corriger : utilisez des tokens C.S.R.F. dans tous vos formulaires, "
            "vérifiez l'origine des requêtes avec les en-têtes S.A.M.E.S.I.T.E., "
            "et exigez une réauthentification pour les actions sensibles."
        ),
        "en": (
            "Cross-Site Request Forgery detected, or C.S.R.F. "
            "An attacker can force an authenticated user to execute unwanted actions. "
            "To fix: use CSRF tokens in all forms, verify request origin with SameSite headers, "
            "and require re-authentication for sensitive actions."
        ),
    },
    "PATH_TRAVERSAL": {
        "fr": (
            "Traversée de chemin détectée. "
            "Un attaquant peut accéder à des fichiers en dehors du répertoire autorisé "
            "en manipulant les chemins de fichiers. "
            "Pour corriger : validez et normalisez tous les chemins de fichiers reçus, "
            "utilisez des chemins absolus, "
            "et vérifiez que le chemin résolu reste dans le répertoire autorisé."
        ),
        "en": (
            "Path traversal detected. "
            "An attacker can access files outside the allowed directory by manipulating file paths. "
            "To fix: validate and normalize all received file paths, use absolute paths, "
            "and verify the resolved path stays within the allowed directory."
        ),
    },
    "HARDCODED_SECRET": {
        "fr": (
            "Secret codé en dur détecté. "
            "Des informations sensibles comme des mots de passe, clés API ou tokens "
            "sont directement écrites dans le code source. "
            "Cela les expose à quiconque ayant accès au code. "
            "Pour corriger : utilisez des variables d'environnement ou un gestionnaire de secrets, "
            "retirez immédiatement les secrets du code, "
            "et invalidez tous les secrets exposés."
        ),
        "en": (
            "Hardcoded secret detected. "
            "Sensitive information like passwords or API keys are written directly in the source code. "
            "To fix: use environment variables or a secrets manager, "
            "immediately remove secrets from code, and invalidate all exposed secrets."
        ),
    },
}

# Explication générique si le type n'est pas reconnu
EXPLICATION_GENERIQUE = {
    "fr": (
        "Vulnérabilité de sécurité détectée. "
        "Cette faille peut exposer votre application à des risques de sécurité. "
        "Pour l'éliminer, consultez la suggestion affichée, "
        "corrigez le code indiqué, et relancez une analyse pour vérifier la correction."
    ),
    "en": (
        "Security vulnerability detected. "
        "This flaw may expose your application to security risks. "
        "To fix it, review the displayed suggestion, correct the indicated code, "
        "and run a new analysis to verify the fix."
    ),
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def construire_texte_vuln(data: TTSVulnerabilite) -> str:
    """Construit le texte complet à lire pour une vulnérabilité."""
    lang = data.langue if data.langue in ("fr", "en") else "fr"

    # Récupérer l'explication OWASP si disponible
    type_clean = data.type_vuln.upper().replace(" ", "_").replace("-", "_")
    explication = EXPLICATIONS_OWASP.get(type_clean, EXPLICATION_GENERIQUE).get(lang, "")

    if lang == "fr":
        texte = (
            f"Vulnérabilité de niveau {data.severite} détectée. "
            f"Fichier concerné : {data.fichier.split('/')[-1]}, à la ligne {data.ligne}. "
            f"{explication} "
            f"Suggestion spécifique : {data.suggestion}"
        )
    else:
        texte = (
            f"{data.severite} level vulnerability detected. "
            f"File: {data.fichier.split('/')[-1]}, at line {data.ligne}. "
            f"{explication} "
            f"Specific suggestion: {data.suggestion}"
        )

    return texte


async def synthétiser_audio(texte: str, voix: str) -> str:
    """Génère un fichier MP3 temporaire et retourne son chemin."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3", prefix="tts_vuln_")
    tmp.close()

    communicate = edge_tts.Communicate(text=texte, voice=voix)
    await communicate.save(tmp.name)

    return tmp.name


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/vulnerabilite",
    summary="Génère l'audio d'explication d'une vulnérabilité",
    description="Retourne un fichier MP3 qui explique la vulnérabilité et comment la corriger.",
    response_class=FileResponse,
)
async def tts_vulnerabilite(data: TTSVulnerabilite):
    """
    Reçoit les données d'une vulnérabilité et retourne un MP3
    qui explique l'erreur et comment l'éliminer.
    """
    try:
        lang = data.langue if data.langue in ("fr", "en") else "fr"
        voix = VOIX.get(lang, VOIX["fr"])
        texte = construire_texte_vuln(data)

        chemin_audio = await synthétiser_audio(texte, voix)

        return FileResponse(
            chemin_audio,
            media_type="audio/mpeg",
            filename=f"vuln_{data.type_vuln.lower()}_{data.ligne}.mp3",
            background=None,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur TTS : {str(e)}")


@router.post(
    "/texte",
    summary="Convertit un texte libre en audio",
    response_class=FileResponse,
)
async def tts_texte_libre(data: TTSTexteLibre):
    """Convertit n'importe quel texte en MP3."""
    try:
        lang = data.langue if data.langue in ("fr", "en", "ar") else "fr"
        voix = VOIX.get(lang, VOIX["fr"])
        chemin_audio = await synthétiser_audio(data.texte, voix)

        return FileResponse(
            chemin_audio,
            media_type="audio/mpeg",
            filename="audio.mp3",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur TTS : {str(e)}")


@router.get(
    "/voix",
    summary="Liste les voix disponibles",
)
async def lister_voix():
    """Retourne la liste des voix configurées."""
    return {
        "voix": [
            {"code": "fr", "nom": "Denise (Français)", "voix": VOIX["fr"]},
            {"code": "fr_m", "nom": "Henri (Français masculin)", "voix": VOIX["fr_m"]},
            {"code": "en", "nom": "Aria (English)", "voix": VOIX["en"]},
            {"code": "ar", "nom": "Amina (Arabe algérien)", "voix": VOIX["ar"]},
            {"code": "ar_eg", "nom": "Salma (Arabe égyptien)", "voix": VOIX["ar_eg"]},
        ]
    }
