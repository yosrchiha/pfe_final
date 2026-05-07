import os
import json
import time
import base64
from typing import List, Dict, Any
import re
from openai import OpenAI

# ── Clients ─────────────────────────────────────────────────
# Client Groq
from groq import Groq
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Client OpenRouter (via OpenAI)
openrouter_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AuditPlatform"
    }
)
openrouter_model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct")

# ── Constantes ─────────────────────────────────────────────
CHARS_PAR_LOT = 60_000
MAX_TOKENS_REP = 6000


def _nettoyer_et_parser_json(contenu: str, dimension: str) -> dict:
    """
    Nettoie et parse le JSON retourné par le LLM.
    Gère : backticks markdown, JSON tronqué, texte parasite avant/après.
    """
    if not contenu or not contenu.strip():
        return {}

    # 1. Supprimer les blocs ```json ... ``` ou ``` ... ```
    contenu = re.sub(r"^```(?:json)?\s*", "", contenu.strip(), flags=re.IGNORECASE)
    contenu = re.sub(r"\s*```$", "", contenu.strip())
    contenu = contenu.strip()

    # 2. Tenter le parse direct
    try:
        return json.loads(contenu)
    except json.JSONDecodeError:
        pass

    # 3. Extraire le premier objet JSON { ... } ou tableau [ ... ]
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = contenu.find(start_char)
        if start == -1:
            continue
        # Chercher la fin balancée
        depth = 0
        in_string = False
        escape = False
        end = -1
        for idx in range(start, len(contenu)):
            ch = contenu[idx]
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
            if ch == start_char:
                depth += 1
            elif ch == end_char:
                depth -= 1
                if depth == 0:
                    end = idx
                    break
        if end != -1:
            fragment = contenu[start:end+1]
            try:
                result = json.loads(fragment)
                print(f"[LLM][{dimension}] ⚠️ JSON extrait partiellement (fragment valide récupéré)")
                return result
            except json.JSONDecodeError:
                pass

    # 4. JSON tronqué : tenter de fermer automatiquement
    for start_char, close_char in [('{', '}'), ('[', ']')]:
        start = contenu.find(start_char)
        if start == -1:
            continue
        fragment = contenu[start:]
        # Compter les ouvertures/fermetures pour savoir combien fermer
        depth = 0
        in_string = False
        escape = False
        for ch in fragment:
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
            if ch == start_char:
                depth += 1
            elif ch == close_char:
                depth -= 1
        # Essayer de fermer les accolades manquantes
        for closing in [close_char * depth, ']}' * depth, '}]' * depth]:
            try:
                result = json.loads(fragment + closing)
                print(f"[LLM][{dimension}] ⚠️ JSON tronqué réparé automatiquement")
                return result
            except json.JSONDecodeError:
                continue

    print(f"[LLM][{dimension}] ❌ JSON non récupérable après toutes les tentatives")
    return {}


def _appeler_llm(prompt_template: str, code_text: str, dimension: str) -> dict:
    """
    Appelle le LLM avec priorité Groq, fallback sur OpenRouter si rate limit.
    """
    prompt = prompt_template.replace("{code_text}", code_text)

    # ── 1. Essayer Groq d'abord ───────────────────────────────
    try:
        response = groq_client.chat.completions.create(
            model=groq_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=MAX_TOKENS_REP,
            temperature=0.1
        )
        contenu = response.choices[0].message.content.strip()
        print(f"[LLM][{dimension}] ✅ Groq OK")

    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "rate_limit" in error_msg.lower():
            print(f"[LLM][{dimension}] ⚠️ Rate limit Groq, bascule sur OpenRouter...")
            try:
                response = openrouter_client.chat.completions.create(
                    model=openrouter_model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=MAX_TOKENS_REP,
                    temperature=0.1
                )
                contenu = response.choices[0].message.content.strip()
                print(f"[LLM][{dimension}] ✅ OpenRouter OK (fallback)")
            except Exception as e2:
                print(f"[LLM][{dimension}] ❌ Erreur OpenRouter: {e2}")
                return {}
        else:
            print(f"[LLM][{dimension}] ❌ Erreur Groq: {e}")
            return {}

    return _nettoyer_et_parser_json(contenu, dimension)


# ══════════════════════════════════════════════════════════════════════
# PROMPTS SPÉCIALISÉS PAR DIMENSION (inchangés)
# ══════════════════════════════════════════════════════════════════════

PROMPT_QUALITE = """
Tu es un expert en génie logiciel spécialisé dans la qualité du code source.
Ta mission est d'auditer le code suivant selon les critères FORMELS ci-dessous.
Retourne UNIQUEMENT un JSON valide, sans texte avant ni après.

CRITÈRES D'ANALYSE DE QUALITÉ (OBLIGATOIRES)

A. COMPLEXITÉ CYCLOMATIQUE
   - Toute fonction/méthode dépassant 10 chemins d'exécution est signalée
   - Toute fonction dépassant 30 lignes est signalée
   - Toute imbrication de conditions > 3 niveaux est signalée
   - Toute boucle contenant une logique métier complexe est signalée

B. DUPLICATION DE CODE
   - Tout bloc de code identique ou quasi-identique (> 5 lignes) est signalé
   - Toute logique copiée-collée entre classes/fichiers est signalée
   - Toute constante répétée sans déclaration centralisée est signalée

C. LISIBILITÉ ET NOMMAGE
   - Toute variable nommée avec moins de 2 caractères significatifs (ex: x, tmp, d) est signalée
   - Toute fonction dont le nom ne reflète pas son comportement est signalée

D. MAINTENABILITÉ
   - Toute fonction qui fait plus d'une chose (violation SRP) est signalée
   - Tout couplage fort entre modules est signalé
   - Toute constante magique non nommée est signalée

RÈGLE ABSOLUE : Tu DOIS signaler au minimum 2 problèmes par fichier fourni.

RÈGLE SUR LES NUMÉROS DE LIGNE :
Le code fourni est numéroté ligne par ligne au format "   N | code".
Tu DOIS utiliser le numéro N visible à gauche du pipe "|" pour le champ "ligne".
Ne jamais inventer un numéro de ligne — lis le préfixe numérique dans le code fourni.
Si un problème concerne une ligne précise, indique son numéro réel. Si le problème est vraiment global (tout le fichier), utilise ligne = 1 (JAMAIS 0).

Structure JSON de retour :
{
    "score_qualite": <int entre 0 et 100>,
    "vulnerabilites": [
        {
            "fichier": "<chemin exact du fichier tel qu'indiqué après FICHIER :>",
            "ligne": <numéro entier lu dans le préfixe "N |" du code — minimum 1, jamais 0>,
            "type": "<catégorie exacte : Complexité | Duplication | Lisibilité | Maintenabilité | Docstring manquant | Commentaire absent | Nommage ambigu | Gestion erreurs | SOLID-S | SOLID-O>",
            "severite": "<HAUTE | MOYENNE | FAIBLE>",
            "suggestion": "<correction précise et concrète, en une phrase>"
        }
    ],
    "recommandations": [
        {
            "titre": "<titre court>",
            "description": "<explication avec exemple avant/après si possible>"
        }
    ]
}

Code source à auditer (chaque ligne est préfixée par son numéro) :
{code_text}
"""


PROMPT_SECURITE = """
Tu es un auditeur de sécurité applicative certifié, expert OWASP et pentesteur.
Ta mission est d'identifier TOUTES les vulnérabilités de sécurité dans le code suivant.
Retourne UNIQUEMENT un JSON valide, sans texte avant ni après.

CRITÈRES DE SÉCURITÉ — OWASP TOP 10 + EXTENSIONS

A01 — BROKEN ACCESS CONTROL
   - Endpoints accessibles sans authentification
   - Références directes à des objets (IDOR)
   - Élévation de privilèges possible
   - Configuration CORS trop permissive

A02 — CRYPTOGRAPHIC FAILURES
   - Mots de passe stockés en clair ou hashés avec MD5/SHA1
   - Données sensibles transmises sans TLS
   - Utilisation de clés de chiffrement codées en dur

A03 — INJECTION
   - Injection SQL : concaténation directe de variables dans les requêtes
   - Injection de commandes OS : subprocess/exec sans validation
   - XSS : rendu de données utilisateur sans échappement

A04 — INSECURE DESIGN
   - Absence de rate limiting sur les endpoints sensibles
   - Logique métier contournable par un utilisateur malveillant
   - Absence de validation côté serveur

A05 — SECURITY MISCONFIGURATION
   - Mode debug activé en production
   - Stack traces exposées dans les réponses d'erreur
   - En-têtes HTTP de sécurité absents

A06 — VULNERABLE COMPONENTS
   - Import de bibliothèques avec des versions vulnérables connues
   - Utilisation de fonctions dépréciées ou non sécurisées

A07 — IDENTIFICATION AND AUTHENTICATION FAILURES
   - Tokens JWT sans expiration ou avec algorithme "none"
   - Absence de protection contre le brute force
   - Réinitialisation de mot de passe non sécurisée

A08 — DATA INTEGRITY FAILURES
   - Désérialisation de données non vérifiées
   - Absence de validation des webhooks entrants

A09 — LOGGING AND MONITORING FAILURES
   - Absence de logs sur les opérations sensibles
   - Logs contenant des données sensibles

A10 — SSRF (SERVER-SIDE REQUEST FORGERY)
   - Appels HTTP vers des URLs contrôlées par l'utilisateur
   - Absence de liste blanche des domaines autorisés

SECRETS ET DONNÉES SENSIBLES
   - Clés API, tokens, mots de passe dans le code source
   - Variables d'environnement non utilisées correctement

RÈGLE ABSOLUE : Chaque vulnérabilité doit être précisément localisée (fichier + ligne).
Le code fourni est numéroté ligne par ligne au format "   N | code".
Tu DOIS utiliser le numéro N visible à gauche du pipe "|" pour le champ "ligne".
Ne jamais inventer un numéro de ligne. Si la localisation est impossible, mets ligne = 1.
Attribue CRITIQUE aux vulnérabilités exploitables directement, HAUTE aux risques élevés.

Structure JSON de retour :
{
    "score_securite": <int entre 0 et 100>,
    "vulnerabilites": [
        {
            "fichier": "<chemin exact du fichier tel qu'indiqué après FICHIER :>",
            "ligne": <numéro entier lu dans le préfixe "N |" du code — TOUJOURS > 0>,
            "type": "<référence OWASP ou type précis, ex: A03 — INJECTION>",
            "severite": "<CRITIQUE | HAUTE | MOYENNE | FAIBLE>",
            "suggestion": "<correction précise et concrète>"
        }
    ],
    "recommandations": [
        {
            "titre": "<titre court>",
            "description": "<explication détaillée avec exemple de correction>"
        }
    ]
}

Code source à auditer (chaque ligne est préfixée par son numéro) :
{code_text}
"""


PROMPT_PERFORMANCE = """
Tu es un expert en optimisation de performance logicielle et en profiling de code.
Ta mission est d'identifier TOUS les problèmes de performance dans le code suivant.
Retourne UNIQUEMENT un JSON valide, sans texte avant ni après.

CRITÈRES D'ANALYSE DE PERFORMANCE (OBLIGATOIRES)

A. ACCÈS BASE DE DONNÉES
   - Requêtes N+1 : chargement d'entités en boucle sans jointure
   - SELECT * : sélection de toutes les colonnes au lieu des colonnes nécessaires
   - Absence d'index sur les colonnes utilisées dans WHERE, JOIN, ORDER BY
   - Connexions non fermées après utilisation

B. ALGORITHMES ET STRUCTURES DE DONNÉES
   - Boucles imbriquées avec complexité O(n²) ou pire sans justification
   - Recherche linéaire O(n) dans une collection où un index/dictionnaire serait O(1)
   - Concaténation de chaînes en boucle (StringBuilder non utilisé)

C. GESTION DE LA MÉMOIRE ET DES RESSOURCES
   - Fichiers ouverts sans bloc try/finally ou gestionnaire de contexte
   - Connexions réseau non fermées après utilisation
   - Chargement de fichiers volumineux entiers en mémoire

D. APPELS RÉSEAU ET API EXTERNES
   - Appels API externes à l'intérieur de boucles
   - Absence de timeout sur les appels HTTP
   - Absence de mécanisme de cache pour des données rarement modifiées

RÈGLE ABSOLUE : Tu DOIS signaler au minimum 2 problèmes de performance par fichier.
Le code fourni est numéroté ligne par ligne au format "   N | code".
Tu DOIS utiliser le numéro N visible à gauche du pipe "|" pour le champ "ligne".

Structure JSON de retour :
{
    "score_performance": <int entre 0 et 100>,
    "vulnerabilites": [
        {
            "fichier": "<chemin exact du fichier tel qu'indiqué après FICHIER :>",
            "ligne": <numéro entier lu dans le préfixe "N |" du code>,
            "type": "<catégorie exacte : N+1 | SELECT* | Boucle O(n²) | Mémoire | Ressource | Timeout absent | Cache absent>",
            "severite": "<HAUTE | MOYENNE | FAIBLE>",
            "suggestion": "<correction précise avec estimation de gain>"
        }
    ],
    "recommandations": [
        {
            "titre": "<titre court>",
            "description": "<explication avec exemple de code optimisé>"
        }
    ]
}

Code source à auditer (chaque ligne est préfixée par son numéro) :
{code_text}
"""


PROMPT_DOCUMENTATION = """
Tu es un expert en documentation logicielle et en lisibilité du code.
Ta mission est d'évaluer la qualité de la documentation dans le code suivant.
Retourne UNIQUEMENT un JSON valide, sans texte avant ni après.

CRITÈRES D'ANALYSE DE DOCUMENTATION (OBLIGATOIRES)

A. DOCSTRINGS ET COMMENTAIRES DE FONCTIONS
   - Toute fonction/méthode publique sans docstring est signalée
   - Toute fonction complexe (> 15 lignes) sans commentaire explicatif est signalée
   - Tout paramètre de fonction non documenté est signalé

B. COMMENTAIRES EN LIGNE
   - Tout bloc de logique non triviale sans commentaire est signalé
   - Tout algorithme non évident sans explication est signalé
   - Tout TODO ou FIXME sans contexte ni ticket de suivi est signalé

C. DOCUMENTATION DES CLASSES ET MODULES
   - Toute classe sans description de son rôle et de ses responsabilités est signalée
   - Tout module sans en-tête décrivant son périmètre est signalé

D. NOMMAGE COMME DOCUMENTATION IMPLICITE
   - Toute variable booléenne dont le nom n'indique pas son état (ex: flag au lieu de is_active) est signalée
   - Toute fonction dont le nom ne reflète pas précisément son action est signalée

Le code fourni est numéroté ligne par ligne au format "   N | code".
Tu DOIS utiliser le numéro N visible à gauche du pipe "|" pour le champ "ligne".

Structure JSON de retour :
{
    "score_documentation": <int entre 0 et 100>,
    "vulnerabilites": [
        {
            "fichier": "<chemin exact du fichier tel qu'indiqué après FICHIER :>",
            "ligne": <numéro entier lu dans le préfixe "N |" du code — minimum 1, jamais 0>,
            "type": "<catégorie : Docstring manquant | Commentaire absent | Nommage ambigu>",
            "severite": "<MOYENNE | FAIBLE>",
            "suggestion": "<exemple de docstring ou commentaire à ajouter>"
        }
    ],
    "recommandations": [
        {
            "titre": "<titre court>",
            "description": "<exemple concret de documentation à ajouter>"
        }
    ]
}

Code source à auditer (chaque ligne est préfixée par son numéro) :
{code_text}
"""


PROMPT_BONNES_PRATIQUES = """
Tu es un architecte logiciel senior expert en Clean Code, SOLID et design patterns.
Ta mission est d'évaluer les bonnes pratiques de développement dans le code suivant.
Retourne UNIQUEMENT un JSON valide, sans texte avant ni après.

CRITÈRES — BONNES PRATIQUES (OBLIGATOIRES)

A. PRINCIPES SOLID
   S — Single Responsibility : toute classe/fonction qui fait plusieurs choses est signalée
   O — Open/Closed : toute classe nécessitant modification pour extension est signalée
   L — Liskov Substitution : toute violation de contrat dans l'héritage est signalée
   I — Interface Segregation : toute interface trop large forçant des implémentations vides est signalée
   D — Dependency Inversion : toute dépendance directe à des implémentations concrètes est signalée

B. GESTION DES ERREURS
   - Blocs catch vides ou qui avalent silencieusement les exceptions sont signalés
   - Exceptions génériques (Exception, Error) utilisées à la place d'exceptions spécifiques
   - Absence de gestion des cas d'erreur dans les appels externes

C. TESTABILITÉ
   - Fonctions avec des effets de bord cachés difficiles à mocker
   - Dépendances non injectées (new dans les fonctions) rendant les tests impossibles
   - Absence de séparation entre logique métier et infrastructure

D. GESTION DES TRANSACTIONS ET COHÉRENCE
   - Opérations sur la base de données sans transaction explicite
   - Rollback non implémenté en cas d'erreur partielle
   - État incohérent possible si une opération en chaîne échoue à mi-parcours

Le code fourni est numéroté ligne par ligne au format "   N | code".
Tu DOIS utiliser le numéro N visible à gauche du pipe "|" pour le champ "ligne".

Structure JSON de retour :
{
    "score_bonnes_pratiques": <int entre 0 et 100>,
    "vulnerabilites": [
        {
            "fichier": "<chemin exact du fichier tel qu'indiqué après FICHIER :>",
            "ligne": <numéro entier lu dans le préfixe "N |" du code>,
            "type": "<catégorie : SOLID-S | SOLID-O | SOLID-L | SOLID-I | SOLID-D | Gestion erreurs | Testabilité | Transaction>",
            "severite": "<HAUTE | MOYENNE | FAIBLE>",
            "suggestion": "<correction précise et concrète>"
        }
    ],
    "recommandations": [
        {
            "titre": "<titre court>",
            "description": "<explication avec exemple de refactoring>"
        }
    ]
}

Code source à auditer (chaque ligne est préfixée par son numéro) :
{code_text}
"""


# ══════════════════════════════════════════════════════════════════════
# UTILITAIRE — Découper en lots
# ══════════════════════════════════════════════════════════════════════
def _decouper_en_lots(fichiers: list, budget: int) -> list:
    lots, lot_actuel, total = [], [], 0

    for f in fichiers:
        contenu = f.get("content", "")
        taille = len(contenu)
        if taille == 0:
            continue
        if taille > budget:
            f_t = dict(f)
            f_t["content"] = contenu[:budget]
            lots.append([f_t])
            continue
        if total + taille > budget and lot_actuel:
            lots.append(lot_actuel)
            lot_actuel, total = [], 0
        lot_actuel.append(f)
        total += taille

    if lot_actuel:
        lots.append(lot_actuel)

    return lots


# ══════════════════════════════════════════════════════════════════════
# UTILITAIRE — Préparer le texte de code d'un lot
# ══════════════════════════════════════════════════════════════════════
def _preparer_code(lot: list) -> str:
    """
    Prépare le texte de code avec numéros de ligne explicites.
    Chaque ligne est préfixée par son numéro pour que le LLM
    puisse retourner des références de ligne précises et vérifiables.
    """
    code_text = ""
    for f in lot:
        path = f.get("file_path") or f.get("path", "inconnu")
        contenu = f.get("content", "")
        lignes = contenu.splitlines()
        # Préfixer chaque ligne avec son numéro (aligné sur 4 chiffres)
        contenu_numerote = "\n".join(
            f"{i+1:4d} | {ligne}"
            for i, ligne in enumerate(lignes)
        )
        code_text += (
            f"\n\n{'═'*60}\n"
            f"FICHIER : {path}\n"
            f"TOTAL LIGNES : {len(lignes)}\n"
            f"{'═'*60}\n"
            f"{contenu_numerote}"
        )
    return code_text


# ══════════════════════════════════════════════════════════════════════
# UTILITAIRE — Appel LLM avec un prompt spécialisé (avec fallback)
# ══════════════════════════════════════════════════════════════════════
def _nettoyer_et_parser_json(contenu: str, dimension: str) -> dict:
    """
    Nettoie et parse le JSON retourné par le LLM.
    Gère : backticks markdown, JSON tronqué, texte parasite avant/après.
    """
    if not contenu or not contenu.strip():
        return {}

    # 1. Supprimer les blocs ```json ... ``` ou ``` ... ```
    contenu = re.sub(r"^```(?:json)?\s*", "", contenu.strip(), flags=re.IGNORECASE)
    contenu = re.sub(r"\s*```$", "", contenu.strip())
    contenu = contenu.strip()

    # 2. Tenter le parse direct
    try:
        return json.loads(contenu)
    except json.JSONDecodeError:
        pass

    # 3. Extraire le premier objet JSON { ... } ou tableau [ ... ]
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = contenu.find(start_char)
        if start == -1:
            continue
        # Chercher la fin balancée
        depth = 0
        in_string = False
        escape = False
        end = -1
        for idx in range(start, len(contenu)):
            ch = contenu[idx]
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
            if ch == start_char:
                depth += 1
            elif ch == end_char:
                depth -= 1
                if depth == 0:
                    end = idx
                    break
        if end != -1:
            fragment = contenu[start:end+1]
            try:
                result = json.loads(fragment)
                print(f"[LLM][{dimension}] ⚠️ JSON extrait partiellement (fragment valide récupéré)")
                return result
            except json.JSONDecodeError:
                pass

    # 4. JSON tronqué : tenter de fermer automatiquement
    for start_char, close_char in [('{', '}'), ('[', ']')]:
        start = contenu.find(start_char)
        if start == -1:
            continue
        fragment = contenu[start:]
        # Compter les ouvertures/fermetures pour savoir combien fermer
        depth = 0
        in_string = False
        escape = False
        for ch in fragment:
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
            if ch == start_char:
                depth += 1
            elif ch == close_char:
                depth -= 1
        # Essayer de fermer les accolades manquantes
        for closing in [close_char * depth, ']}' * depth, '}]' * depth]:
            try:
                result = json.loads(fragment + closing)
                print(f"[LLM][{dimension}] ⚠️ JSON tronqué réparé automatiquement")
                return result
            except json.JSONDecodeError:
                continue

    print(f"[LLM][{dimension}] ❌ JSON non récupérable après toutes les tentatives")
    return {}


def _appeler_llm(prompt_template: str, code_text: str, dimension: str) -> dict:
    """
    Appelle le LLM avec priorité Groq, fallback sur OpenRouter si rate limit.
    """
    prompt = prompt_template.replace("{code_text}", code_text)

    # ── 1. Essayer Groq d'abord ───────────────────────────────
    try:
        response = groq_client.chat.completions.create(
            model=groq_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=MAX_TOKENS_REP,
            temperature=0.1
        )
        contenu = response.choices[0].message.content.strip()
        print(f"[LLM][{dimension}] ✅ Groq OK")

    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "rate_limit" in error_msg.lower():
            print(f"[LLM][{dimension}] ⚠️ Rate limit Groq, bascule sur OpenRouter...")
            try:
                response = openrouter_client.chat.completions.create(
                    model=openrouter_model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=MAX_TOKENS_REP,
                    temperature=0.1
                )
                contenu = response.choices[0].message.content.strip()
                print(f"[LLM][{dimension}] ✅ OpenRouter OK (fallback)")
            except Exception as e2:
                print(f"[LLM][{dimension}] ❌ Erreur OpenRouter: {e2}")
                return {}
        else:
            print(f"[LLM][{dimension}] ❌ Erreur Groq: {e}")
            return {}

    return _nettoyer_et_parser_json(contenu, dimension)


# ══════════════════════════════════════════════════════════════════════
# UTILITAIRE — Analyser un seul lot avec les 5 prompts
# ══════════════════════════════════════════════════════════════════════
def _analyser_lot(lot: list, lot_num: int, total_lots: int, owasp_enabled: bool) -> dict:
    """Pour un lot de fichiers, lance les 5 analyses spécialisées"""
    noms = [f.get("file_path") or f.get("path", "?") for f in lot]
    code_text = _preparer_code(lot)

    print(f"\n[LLM] ── Lot {lot_num}/{total_lots} : {len(lot)} fichier(s) ──")
    print(f"[LLM] Fichiers : {noms}")

    resultats = {}

    # 1. Analyse QUALITÉ
    print(f"[LLM] → Analyse qualité...")
    resultats["qualite"] = _appeler_llm(PROMPT_QUALITE, code_text, "QUALITÉ")

    # 2. Analyse SÉCURITÉ (uniquement si activée)
    if owasp_enabled:
        print(f"[LLM] → Analyse sécurité OWASP...")
        resultats["securite"] = _appeler_llm(PROMPT_SECURITE, code_text, "SÉCURITÉ")
    else:
        resultats["securite"] = {}

    # 3. Analyse PERFORMANCE
    print(f"[LLM] → Analyse performance...")
    resultats["performance"] = _appeler_llm(PROMPT_PERFORMANCE, code_text, "PERFORMANCE")

    # 4. Analyse DOCUMENTATION
    print(f"[LLM] → Analyse documentation...")
    resultats["documentation"] = _appeler_llm(PROMPT_DOCUMENTATION, code_text, "DOCUMENTATION")

    # 5. Analyse BONNES PRATIQUES
    print(f"[LLM] → Analyse bonnes pratiques...")
    resultats["bonnes_pratiques"] = _appeler_llm(PROMPT_BONNES_PRATIQUES, code_text, "PRATIQUES")

    return _fusionner_tous(resultats)


# ══════════════════════════════════════════════════════════════════════
# UTILITAIRE — Fusionner tous les résultats des 5 dimensions
# ══════════════════════════════════════════════════════════════════════
def _fusionner_tous(resultats_par_dimension: dict) -> dict:
    """Fusionne les résultats des 5 dimensions en un rapport unique."""
    scores_qualite = []
    scores_securite = []
    scores_performance = []
    scores_doc = []
    scores_pratiques = []

    vulns_vues = set()
    vulnerabilites = []
    titres_vus = set()
    recommandations = []

    r_qualite = resultats_par_dimension.get("qualite", {})
    r_securite = resultats_par_dimension.get("securite", {})
    r_performance = resultats_par_dimension.get("performance", {})
    r_doc = resultats_par_dimension.get("documentation", {})
    r_pratiques = resultats_par_dimension.get("bonnes_pratiques", {})

    if r_qualite.get("score_qualite") is not None:
        scores_qualite.append(r_qualite["score_qualite"])
    if r_securite.get("score_securite") is not None:
        scores_securite.append(r_securite["score_securite"])
    if r_performance.get("score_performance") is not None:
        scores_performance.append(r_performance["score_performance"])
    if r_doc.get("score_documentation") is not None:
        scores_doc.append(r_doc["score_documentation"])
    if r_pratiques.get("score_bonnes_pratiques") is not None:
        scores_pratiques.append(r_pratiques["score_bonnes_pratiques"])

    tous_scores = scores_qualite + scores_securite + scores_performance + scores_doc + scores_pratiques
    score_qualite_global = round(sum(tous_scores) / len(tous_scores)) if tous_scores else 0

    score_securite = round(sum(scores_securite) / len(scores_securite)) if scores_securite else 0
    score_performance = round(sum(scores_performance) / len(scores_performance)) if scores_performance else 0

    # Union des vulnérabilités
    for dim_key in ["qualite", "securite", "performance", "documentation", "bonnes_pratiques"]:
        res = resultats_par_dimension.get(dim_key, {})
        for v in res.get("vulnerabilites", []):
            # ✅ Corriger les numéros de ligne invalides (0 ou négatifs) → 1
            # Le LLM utilise parfois 0 pour les problèmes "globaux", mais
            # l'interface ne sait pas afficher correctement "ligne 0".
            if not isinstance(v.get("ligne"), int) or v.get("ligne", 0) <= 0:
                v["ligne"] = 1
            cle = (v.get("fichier", ""), v.get("type", ""), v.get("ligne", 1))
            if cle not in vulns_vues:
                vulns_vues.add(cle)
                v["dimension"] = dim_key
                vulnerabilites.append(v)

    # Union des recommandations
    for dim_key in ["qualite", "securite", "performance", "documentation", "bonnes_pratiques"]:
        res = resultats_par_dimension.get(dim_key, {})
        for rec in res.get("recommandations", []):
            titre = rec.get("titre", "").strip().lower()
            if titre not in titres_vus:
                titres_vus.add(titre)
                recommandations.append(rec)

    ordre = {"CRITIQUE": 0, "HAUTE": 1, "MOYENNE": 2, "FAIBLE": 3}
    vulnerabilites.sort(key=lambda v: ordre.get(v.get("severite", "FAIBLE"), 4))

    print(f"[LLM] Fusion finale : {len(vulnerabilites)} vulnérabilités totales")
    print(f"[LLM] Scores → qualité={score_qualite_global} sécurité={score_securite} performance={score_performance}")

    return {
        "score_qualite": score_qualite_global,
        "score_securite": score_securite,
        "score_performance": score_performance,
        "vulnerabilites": vulnerabilites,
        "recommandations": recommandations,
        "scores_details": {
            "qualite": scores_qualite[0] if scores_qualite else 0,
            "securite": scores_securite[0] if scores_securite else 0,
            "performance": scores_performance[0] if scores_performance else 0,
            "documentation": scores_doc[0] if scores_doc else 0,
            "bonnes_pratiques": scores_pratiques[0] if scores_pratiques else 0,
        }
    }


# ══════════════════════════════════════════════════════════════════════
# UTILITAIRE — Fusionner les résultats de plusieurs lots
# ══════════════════════════════════════════════════════════════════════
def _fusionner_lots(resultats_lots: list) -> dict:
    """Fusionne les rapports de plusieurs lots en un rapport unique final."""
    if not resultats_lots:
        return {
            "score_qualite": 0,
            "score_securite": 0,
            "score_performance": 0,
            "vulnerabilites": [],
            "recommandations": []
        }

    if len(resultats_lots) == 1:
        return resultats_lots[0]

    score_qualite = round(sum(r.get("score_qualite", 0) for r in resultats_lots) / len(resultats_lots))
    score_securite = round(sum(r.get("score_securite", 0) for r in resultats_lots) / len(resultats_lots))
    score_performance = round(sum(r.get("score_performance", 0) for r in resultats_lots) / len(resultats_lots))

    vulns_vues, vulnerabilites = set(), []
    titres_vus, recommandations = set(), []

    for r in resultats_lots:
        for v in r.get("vulnerabilites", []):
            cle = (v.get("fichier", ""), v.get("type", ""), v.get("ligne", 0))
            if cle not in vulns_vues:
                vulns_vues.add(cle)
                vulnerabilites.append(v)

        for rec in r.get("recommandations", []):
            titre = rec.get("titre", "").strip().lower()
            if titre not in titres_vus:
                titres_vus.add(titre)
                recommandations.append(rec)

    ordre = {"CRITIQUE": 0, "HAUTE": 1, "MOYENNE": 2, "FAIBLE": 3}
    vulnerabilites.sort(key=lambda v: ordre.get(v.get("severite", "FAIBLE"), 4))

    return {
        "score_qualite": score_qualite,
        "score_securite": score_securite,
        "score_performance": score_performance,
        "vulnerabilites": vulnerabilites,
        "recommandations": recommandations
    }


# ══════════════════════════════════════════════════════════════════════
# FONCTION PRINCIPALE — Pipeline complet d'analyse
# ══════════════════════════════════════════════════════════════════════
def analyser_code(fichiers: list, owasp_enabled: bool) -> dict:
    """
    Pipeline de revue de code intelligente en 5 dimensions.
    Priorité Groq, fallback sur OpenRouter en cas de rate limit.
    """
    if not fichiers:
        raise Exception("Aucun fichier à analyser")

    print(f"\n[LLM] ════════════════════════════════════════")
    print(f"[LLM] Début du pipeline — {len(fichiers)} fichier(s)")
    print(f"[LLM] OWASP activé : {owasp_enabled}")
    print(f"[LLM] Fournisseur principal : Groq ({groq_model})")
    print(f"[LLM] Fallback : OpenRouter ({openrouter_model})")
    print(f"[LLM] ════════════════════════════════════════")

    lots = _decouper_en_lots(fichiers, CHARS_PAR_LOT)
    print(f"[LLM] {len(lots)} lot(s) de code créé(s)")

    resultats_lots = []
    for i, lot in enumerate(lots, start=1):
        try:
            res = _analyser_lot(lot, i, len(lots), owasp_enabled)
            resultats_lots.append(res)
        except Exception as e:
            print(f"[LLM] Erreur lot {i} : {e}")
            continue

    if not resultats_lots:
        raise Exception("L'analyse a échoué sur tous les lots")

    rapport_final = _fusionner_lots(resultats_lots)

    print(f"\n[LLM] ════════════════════════════════════════")
    print(f"[LLM] Pipeline terminé")
    print(f"[LLM] Score qualité     : {rapport_final['score_qualite']}")
    print(f"[LLM] Score sécurité    : {rapport_final['score_securite']}")
    print(f"[LLM] Score performance : {rapport_final['score_performance']}")
    print(f"[LLM] Vulnérabilités    : {len(rapport_final['vulnerabilites'])}")
    print(f"[LLM] ════════════════════════════════════════\n")

    return rapport_final