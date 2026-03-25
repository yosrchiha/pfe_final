# backend/app/services/test_service.py

import os
import math
from groq import Groq
from app.services.gitlab_client import get_gitlab_project

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ── Constantes ────────────────────────────────────────
CHARS_PAR_APPEL = 60_000   # chars de code par appel LLM
MAX_TOKENS_REP  = 4_000    # tokens max de la réponse


# ══════════════════════════════════════════════════════
# UTILITAIRE — Détecter le langage
# ══════════════════════════════════════════════════════
def _detecter_langage(fichiers: list) -> dict:
    """
    Détecte le langage dominant du projet
    et retourne le framework de test associé.
    """
    # Compte les occurrences de chaque extension
    compteur = {}
    for f in fichiers:
        if "." in f["path"]:
            ext = f["path"].split(".")[-1].lower()
            compteur[ext] = compteur.get(ext, 0) + 1

    print(f"[TESTS] Extensions détectées : {compteur}")

    # Priorité au langage le plus fréquent
    if compteur.get("java", 0) > 0:
        return {
            "langage"   : "java",
            "framework" : "JUnit 5 + Mockito",
            "fichier"   : "GeneratedTest.java",
            "import"    : "import org.junit.jupiter.api.Test;"
        }
    elif compteur.get("py", 0) > 0:
        return {
            "langage"   : "python",
            "framework" : "pytest",
            "fichier"   : "test_generated.py",
            "import"    : "import pytest"
        }
    elif compteur.get("ts", 0) > 0 or compteur.get("tsx", 0) > 0:
        return {
            "langage"   : "typescript",
            "framework" : "Jest",
            "fichier"   : "generated.spec.ts",
            "import"    : "import { describe, it, expect } from '@jest/globals';"
        }
    elif compteur.get("js", 0) > 0 or compteur.get("jsx", 0) > 0:
        return {
            "langage"   : "javascript",
            "framework" : "Jest",
            "fichier"   : "generated.test.js",
            "import"    : "const { describe, it, expect } = require('@jest/globals');"
        }
    elif compteur.get("php", 0) > 0:
        return {
            "langage"   : "php",
            "framework" : "PHPUnit",
            "fichier"   : "GeneratedTest.php",
            "import"    : "use PHPUnit\\Framework\\TestCase;"
        }
    elif compteur.get("go", 0) > 0:
        return {
            "langage"   : "go",
            "framework" : "testing",
            "fichier"   : "generated_test.go",
            "import"    : "import \"testing\""
        }
    elif compteur.get("cs", 0) > 0:
        return {
            "langage"   : "csharp",
            "framework" : "xUnit",
            "fichier"   : "GeneratedTest.cs",
            "import"    : "using Xunit;"
        }
    else:
        return {
            "langage"   : "python",
            "framework" : "pytest",
            "fichier"   : "test_generated.py",
            "import"    : "import pytest"
        }


# ══════════════════════════════════════════════════════
# UTILITAIRE — Découper en lots
# ══════════════════════════════════════════════════════
def _decouper_en_lots(fichiers: list, budget: int) -> list:
    """
    Découpe la liste de fichiers en lots
    chacun ne dépassant pas `budget` caractères.

    Returns:
        liste de listes de fichiers
    """
    lots       = []
    lot_actuel = []
    total      = 0

    # Trier par taille croissante pour équilibrer les lots
    fichiers_tries = sorted(fichiers, key=lambda f: f.get("size", 0))

    for f in fichiers_tries:
        taille = len(f.get("content", ""))
        if taille == 0:
            continue

        # Si le fichier seul dépasse le budget → on le tronque
        if taille > budget:
            f_tronque = {
                **f,
                "content": f["content"][:budget],
                "size"   : budget
            }
            lots.append([f_tronque])
            continue

        # Si l'ajout au lot actuel dépasse le budget → nouveau lot
        if total + taille > budget and lot_actuel:
            lots.append(lot_actuel)
            lot_actuel = []
            total      = 0

        lot_actuel.append(f)
        total += taille

    # Dernier lot
    if lot_actuel:
        lots.append(lot_actuel)

    return lots


# ══════════════════════════════════════════════════════
# UTILITAIRE — Un appel LLM pour un lot
# ══════════════════════════════════════════════════════
def _generer_tests_lot(
    lot            : list,
    lot_num        : int,
    total_lots     : int,
    info_langage   : dict,
    vulnerabilites : list,
    recommandations: list
) -> str:
    """
    Génère les tests pour un lot de fichiers via un seul appel LLM.
    """
    langage   = info_langage["langage"]
    framework = info_langage["framework"]

    # Prépare le code du lot
    code_text = ""
    for f in lot:
        code_text += (
            f"\n\n{'─'*60}\n"
            f"Fichier : {f['path']}\n"
            f"{'─'*60}\n"
            f"{f['content']}"
        )

    # Prépare les vulnérabilités
    vuln_text = ""
    for v in vulnerabilites:
        vuln_text += (
            f"\n  • [{v.get('severite','?')}] {v.get('type','?')} "
            f"dans {v.get('fichier','?')} "
            f"ligne {v.get('ligne','?')} "
            f"→ {v.get('suggestion','?')}"
        )

    # Prépare les recommandations
    reco_text = ""
    for r in recommandations:
        reco_text += f"\n  • {r.get('titre','?')} : {r.get('description','?')}"

    # Instruction spéciale selon lot
    if total_lots == 1:
        instruction_lot = "Génère les tests complets pour tout le code."
    elif lot_num == 1:
        instruction_lot = (
            f"Ceci est le lot {lot_num}/{total_lots}. "
            f"Génère les tests pour ces fichiers. "
            f"Commence par les imports et la classe de test principale."
        )
    elif lot_num == total_lots:
        instruction_lot = (
            f"Ceci est le dernier lot {lot_num}/{total_lots}. "
            f"Génère les tests pour ces fichiers. "
            f"Tu peux ajouter des méthodes à la classe existante."
        )
    else:
        instruction_lot = (
            f"Ceci est le lot {lot_num}/{total_lots}. "
            f"Génère les tests pour ces fichiers. "
            f"Continue la classe de test (pas besoin de réimporter)."
        )

    fichiers_noms = [f["path"] for f in lot]
    print(f"[TESTS] Lot {lot_num}/{total_lots} : {fichiers_noms}")

    prompt = f"""
Tu es un expert senior en tests unitaires {langage} avec {framework}.

{instruction_lot}

RÈGLES OBLIGATOIRES :
1. Utilise UNIQUEMENT {framework}
2. Couvre TOUTES les fonctions/méthodes de chaque fichier
3. Inclus : cas normaux + cas limites + cas d'erreur
4. Teste en PRIORITÉ les vulnérabilités listées ci-dessous
5. Retourne UNIQUEMENT le code — pas d'explication, pas de markdown
6. Utilise des mocks pour les dépendances externes (DB, API, etc.)
7. Chaque test doit avoir un nom descriptif en français ou anglais

VULNÉRABILITÉS DÉTECTÉES (à tester en priorité) :
{vuln_text if vuln_text else "  • Aucune — teste toutes les fonctions"}

RECOMMANDATIONS :
{reco_text if reco_text else "  • Aucune recommandation spécifique"}

CODE SOURCE ({len(lot)} fichier(s)) :
{code_text}

Génère le code de test {langage} maintenant :
"""

    response = client.chat.completions.create(
        model      = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        messages   = [{"role": "user", "content": prompt}],
        max_tokens = MAX_TOKENS_REP,
        temperature= 0.1
    )

    contenu = response.choices[0].message.content.strip()

    # Nettoyer les backticks markdown
    if contenu.startswith("```"):
        lines   = contenu.split("\n")
        lines   = [l for l in lines if not l.startswith("```")]
        contenu = "\n".join(lines)

    return contenu


# ══════════════════════════════════════════════════════
# 1. GÉNÉRER TOUS LES TESTS — plusieurs appels LLM
# ══════════════════════════════════════════════════════
def generer_tests_llm(
    fichiers       : list,
    vulnerabilites : list,
    recommandations: list
) -> dict:
    """
    Génère des tests unitaires pour TOUS les fichiers du projet.
    Utilise plusieurs appels LLM si nécessaire (un par lot).

    Args:
        fichiers        : tous les fichiers du projet
        vulnerabilites  : vulnérabilités détectées lors de l'analyse
        recommandations : recommandations de l'analyse

    Returns:
        dict {
            langage  : langage détecté,
            contenu  : code de test complet fusionné,
            fichier  : nom du fichier de test
        }
    """
    if not fichiers:
        raise Exception("Aucun fichier de code trouvé")

    print(f"[TESTS] Total fichiers à tester : {len(fichiers)}")

    # ── 1. Détecter le langage ────────────────────────
    info_langage = _detecter_langage(fichiers)
    langage      = info_langage["langage"]
    framework    = info_langage["framework"]
    nom_fichier  = info_langage["fichier"]

    print(f"[TESTS] Langage : {langage} | Framework : {framework}")

    # ── 2. Découper en lots ───────────────────────────
    lots = _decouper_en_lots(fichiers, CHARS_PAR_APPEL)
    print(f"[TESTS] Nombre de lots : {len(lots)}")

    # ── 3. Appel LLM par lot ──────────────────────────
    resultats = []
    for i, lot in enumerate(lots, start=1):
        print(f"[TESTS] Traitement lot {i}/{len(lots)}...")
        try:
            code_tests = _generer_tests_lot(
                lot             = lot,
                lot_num         = i,
                total_lots      = len(lots),
                info_langage    = info_langage,
                vulnerabilites  = vulnerabilites,
                recommandations = recommandations
            )
            resultats.append(code_tests)
            print(f"[TESTS] Lot {i} terminé : {len(code_tests)} chars générés")
        except Exception as e:
            print(f"[TESTS] Erreur lot {i} : {e}")
            # On continue avec les autres lots
            continue

    if not resultats:
        raise Exception("Impossible de générer les tests — tous les lots ont échoué")

    # ── 4. Fusionner les résultats ────────────────────
    contenu_final = _fusionner_resultats(resultats, info_langage)

    print(f"[TESTS] Tests générés : {len(contenu_final)} chars total")
    print(f"[TESTS] Fichier : {nom_fichier}")

    return {
        "langage"  : langage,
        "contenu"  : contenu_final,
        "fichier"  : nom_fichier
    }


# ══════════════════════════════════════════════════════
# UTILITAIRE — Fusionner les résultats de tous les lots
# ══════════════════════════════════════════════════════
def _fusionner_resultats(resultats: list, info_langage: dict) -> str:
    """
    Fusionne les tests de plusieurs lots en un seul fichier cohérent.
    """
    if len(resultats) == 1:
        return resultats[0]

    langage = info_langage["langage"]

    if langage == "java":
        # Fusionner les méthodes @Test dans une seule classe
        return _fusionner_java(resultats)

    elif langage == "python":
        # Fusionner les fonctions test_ dans un seul fichier
        return _fusionner_python(resultats)

    elif langage in ("typescript", "javascript"):
        # Fusionner les describe/it blocks
        return _fusionner_js(resultats)

    else:
        # Fusion simple par concaténation avec séparateur
        separateur = f"\n\n{'='*60}\n// Lot suivant\n{'='*60}\n\n"
        return separateur.join(resultats)


def _fusionner_java(resultats: list) -> str:
    """Fusionne plusieurs fichiers Java en une seule classe."""
    imports    = set()
    methodes   = []
    classe_nom = "GeneratedTest"

    for r in resultats:
        lignes = r.split("\n")
        for ligne in lignes:
            ligne_strip = ligne.strip()
            # Collecte les imports
            if ligne_strip.startswith("import "):
                imports.add(ligne_strip)
            # Collecte les méthodes @Test (et leurs annotations)
            elif (ligne_strip.startswith("@Test")
                  or ligne_strip.startswith("@ParameterizedTest")
                  or ligne_strip.startswith("public void test")
                  or ligne_strip.startswith("void test")):
                methodes.append(ligne)

    # Reconstruit le fichier proprement
    contenu  = "// Tests générés automatiquement par AuditPlatform\n\n"
    contenu += "\n".join(sorted(imports)) + "\n\n"
    contenu += f"@ExtendWith(MockitoExtension.class)\n"
    contenu += f"public class {classe_nom} {{\n\n"
    contenu += "    // ── Tests générés ──\n\n"

    # Extrait et ajoute les blocs de méthodes complets
    for r in resultats:
        lignes  = r.split("\n")
        in_test = False
        depth   = 0
        bloc    = []

        for ligne in lignes:
            if "@Test" in ligne or "@ParameterizedTest" in ligne:
                in_test = True
                bloc    = [ligne]
                depth   = 0
            elif in_test:
                bloc.append(ligne)
                depth += ligne.count("{") - ligne.count("}")
                if depth <= 0 and len(bloc) > 2:
                    methodes_text = "\n".join(bloc)
                    if methodes_text not in contenu:
                        contenu += "    " + "\n    ".join(bloc) + "\n\n"
                    in_test = False
                    bloc    = []

    contenu += "}\n"
    return contenu


def _fusionner_python(resultats: list) -> str:
    """Fusionne plusieurs fichiers Python en un seul."""
    imports  = set()
    fixtures = []
    tests    = []

    for r in resultats:
        lignes = r.split("\n")
        for i, ligne in enumerate(lignes):
            if ligne.startswith("import ") or ligne.startswith("from "):
                imports.add(ligne)
            elif ligne.startswith("@pytest.fixture"):
                # Collecte les fixtures
                bloc = [ligne]
                j    = i + 1
                while j < len(lignes) and (lignes[j].startswith(" ") or lignes[j] == ""):
                    bloc.append(lignes[j])
                    j += 1
                fixtures.append("\n".join(bloc))
            elif ligne.startswith("def test_"):
                # Collecte les fonctions test
                bloc = [ligne]
                j    = i + 1
                while j < len(lignes) and (lignes[j].startswith(" ") or lignes[j] == ""):
                    bloc.append(lignes[j])
                    j += 1
                test_text = "\n".join(bloc)
                if test_text not in tests:
                    tests.append(test_text)

    # Reconstruit
    contenu  = "# Tests générés automatiquement par AuditPlatform\n\n"
    contenu += "\n".join(sorted(imports)) + "\n\n"

    if fixtures:
        contenu += "\n\n".join(set(fixtures)) + "\n\n"

    contenu += "\n\n".join(tests) + "\n"
    return contenu


def _fusionner_js(resultats: list) -> str:
    """Fusionne plusieurs fichiers JS/TS en un seul."""
    imports  = set()
    describes = []

    for r in resultats:
        lignes = r.split("\n")
        for ligne in lignes:
            if (ligne.strip().startswith("import ")
                    or ligne.strip().startswith("const {")
                    or ligne.strip().startswith("require(")):
                imports.add(ligne.strip())
            elif ligne.strip().startswith("describe("):
                describes.append(r)
                break

    contenu  = "// Tests générés automatiquement par AuditPlatform\n\n"
    contenu += "\n".join(sorted(imports)) + "\n\n"
    contenu += "\n\n".join(describes) + "\n"
    return contenu


# ══════════════════════════════════════════════════════
# 2. CRÉER LA BRANCHE ET POUSSER LES TESTS
# ══════════════════════════════════════════════════════
def creer_branche_et_pousser(
    token        : str,
    project_url  : str,
    branche_base : str,
    nom_fichier  : str,
    contenu_tests: str
) -> dict:
    """
    Crée une branche ai/tests/YYYY-MM-DD-HHMM
    et pousse le fichier de tests dedans.

    Returns:
        dict { branche, fichier, project_url }
    """
    from datetime import datetime

    project     = get_gitlab_project(token, project_url)
    date_str    = datetime.now().strftime("%Y-%m-%d-%H%M")
    nom_branche = f"ai/tests/{date_str}"

    # ── Créer la branche ──────────────────────────────
    try:
        project.branches.create({
            "branch": nom_branche,
            "ref"   : branche_base.strip()
        })
        print(f"[TESTS] Branche créée : {nom_branche}")
    except Exception as e:
        print(f"[TESTS] Branche existante ou erreur : {e}")

    # ── Pousser le fichier ────────────────────────────
    try:
        existing         = project.files.get(nom_fichier, ref=nom_branche)
        existing.content = contenu_tests
        existing.save(
            branch         = nom_branche,
            commit_message = f"🤖 IA: Mise à jour des tests ({nom_fichier})"
        )
        print(f"[TESTS] Fichier mis à jour : {nom_fichier}")
    except Exception:
        try:
            project.files.create({
                "file_path"     : nom_fichier,
                "branch"        : nom_branche,
                "content"       : contenu_tests,
                "commit_message": f"🤖 IA: Ajout des tests générés ({nom_fichier})"
            })
            print(f"[TESTS] Fichier créé : {nom_fichier}")
        except Exception as e:
            raise Exception(f"Impossible de pousser le fichier : {str(e)}")

    return {
        "branche"    : nom_branche,
        "fichier"    : nom_fichier,
        "project_url": project_url
    }


# ══════════════════════════════════════════════════════
# 3. CRÉER LA MERGE REQUEST
# ══════════════════════════════════════════════════════
def creer_merge_request(
    token         : str,
    project_url   : str,
    branche_src   : str,
    branche_cible : str = "main"
) -> dict:
    """
    Crée une MR depuis ai/tests/... vers la branche principale.

    Returns:
        dict { mr_id, mr_url, titre, statut }
    """
    project = get_gitlab_project(token, project_url)

    try:
        mr = project.mergerequests.create({
            "source_branch"       : branche_src,
            "target_branch"       : branche_cible,
            "title"               : "🤖 IA: Tests unitaires générés automatiquement",
            "description"         : """
## Tests unitaires générés par l'Intelligence Artificielle

Cette MR a été créée automatiquement par la plateforme d'audit GitLab.

### Ce que contient cette MR
- ✅ Tests unitaires générés pour **tout le code** du projet
- ✅ Couverture des vulnérabilités détectées
- ✅ Validation des recommandations de l'analyse

### Actions requises
- [ ] Vérifier les tests générés
- [ ] Lancer les tests en local
- [ ] Corriger si nécessaire
- [ ] Approuver et merger

> Généré automatiquement par **AuditPlatform** · LLM Groq llama-3.3-70b
            """,
            "remove_source_branch": True,
            "labels"              : ["IA", "tests-automatiques"]
        })
        print(f"[TESTS] MR créée : !{mr.iid} → {mr.web_url}")
        return {
            "mr_id"  : mr.iid,
            "mr_url" : mr.web_url,
            "titre"  : mr.title,
            "statut" : mr.state
        }
    except Exception as e:
        raise Exception(f"Impossible de créer la MR : {str(e)}")