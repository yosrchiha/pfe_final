# backend/app/services/test_service.py

import os
import math
from groq import Groq
from openai import OpenAI
from app.services.gitlab_client import get_gitlab_project

# ── Détection du fournisseur ─────────────────────────
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower()

if LLM_PROVIDER == "openrouter":
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        default_headers={
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AuditPlatform"
        }
    )
    DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct")
else:
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    DEFAULT_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ── Constantes ────────────────────────────────────────
CHARS_PAR_APPEL = 60_000
MAX_TOKENS_REP  = 6_000  # Augmenté pour tests plus complets


# ══════════════════════════════════════════════════════
# UTILITAIRE — Détecter le langage avec plus de détails
# ══════════════════════════════════════════════════════
def _detecter_langage(fichiers: list) -> dict:
    """Détecte le langage et retourne les infos de test adaptées."""
    compteur = {}
    for f in fichiers:
        if "." in f["path"]:
            ext = f["path"].split(".")[-1].lower()
            compteur[ext] = compteur.get(ext, 0) + 1

    print(f"[TESTS] Extensions détectées : {compteur}")

    # Mapping complet des langages avec frameworks, extensions et conventions
    langages = {
        "java": {
            "langage": "java",
            "framework": "JUnit 5 + Mockito",
            "fichier": "GeneratedTest.java",
            "structure": """@ExtendWith(MockitoExtension.class)
public class GeneratedTest {
    @Mock
    private Dependency dependency;
    
    @InjectMocks
    private ServiceUnderTest service;
    
    @BeforeEach
    void setUp() {
        // Initialisation
    }
    
    @Test
    void testMethodName_should_expectedBehavior_when_condition() {
        // Arrange
        // Act
        // Assert
    }
}""",
            "assertions": ["assertEquals", "assertTrue", "assertFalse", "assertThrows", "assertNotNull"],
            "annotations": ["@Test", "@BeforeEach", "@AfterEach", "@Mock", "@InjectMocks"]
        },
        "py": {
            "langage": "python",
            "framework": "pytest",
            "fichier": "test_generated.py",
            "structure": """import pytest
from unittest.mock import Mock, patch

class TestService:
    @pytest.fixture
    def mock_dependency(self):
        return Mock()
    
    def test_method_name_should_expected_behavior_when_condition(self, mock_dependency):
        # Arrange
        # Act
        # Assert
        pass""",
            "assertions": ["assert", "assert_equal", "assert_raises", "assert_in", "assert_is_not_none"],
            "decorators": ["@pytest.fixture", "@patch", "@pytest.mark.parametrize"]
        },
        "ts": {
            "langage": "typescript",
            "framework": "Jest",
            "fichier": "generated.spec.ts",
            "structure": """import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('ServiceName', () => {
    let service: ServiceName;
    let mockDependency: jest.Mocked<Dependency>;

    beforeEach(() => {
        mockDependency = { method: jest.fn() } as any;
        service = new ServiceName(mockDependency);
    });

    it('should return expected value when condition is met', () => {
        // Arrange
        // Act
        // Assert
        expect(result).toEqual(expected);
    });
});""",
            "assertions": ["expect", "toEqual", "toBe", "toContain", "toThrow", "toHaveBeenCalled"],
            "functions": ["describe", "it", "beforeEach", "afterEach"]
        },
        "js": {
            "langage": "javascript",
            "framework": "Jest",
            "fichier": "generated.test.js",
            "structure": """const { describe, it, expect, beforeEach } = require('@jest/globals');
const { ServiceName } = require('./service');

describe('ServiceName', () => {
    let service;
    
    beforeEach(() => {
        service = new ServiceName();
    });
    
    it('should do something', () => {
        expect(service.method()).toBeDefined();
    });
});""",
            "assertions": ["expect", "toEqual", "toBe", "toContain", "toThrow"],
            "functions": ["describe", "it", "beforeEach", "afterEach"]
        },
        "php": {
            "langage": "php",
            "framework": "PHPUnit",
            "fichier": "GeneratedTest.php",
            "structure": """<?php
use PHPUnit\\Framework\\TestCase;

class GeneratedTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
    }
    
    public function testMethodNameReturnsExpectedValue(): void
    {
        // Arrange
        // Act
        // Assert
        $this->assertEquals($expected, $actual);
    }
}""",
            "assertions": ["$this->assertEquals", "$this->assertTrue", "$this->assertFalse", "$this->assertNull"]
        },
        "go": {
            "langage": "go",
            "framework": "testing",
            "fichier": "generated_test.go",
            "structure": """package main

import "testing"

func TestFunctionName(t *testing.T) {
    // Arrange
    // Act
    // Assert
    if result != expected {
        t.Errorf("expected %v, got %v", expected, result)
    }
}""",
            "assertions": ["t.Error", "t.Errorf", "t.Fatal", "t.Fatalf"]
        }
    }

    # Priorité au langage le plus fréquent
    for ext, info in langages.items():
        if compteur.get(ext, 0) > 0:
            return info

    # Par défaut Python
    return langages["py"]


# ══════════════════════════════════════════════════════
# UTILITAIRE — Construire le prompt adapté
# ══════════════════════════════════════════════════════
def _construire_prompt_tests(
    lot: list,
    lot_num: int,
    total_lots: int,
    info_langage: dict,
    vulnerabilites: list,
    recommandations: list,
    code_text: str
) -> str:
    """Construit un prompt ultra-détaillé adapté au langage détecté."""
    
    langage = info_langage["langage"]
    framework = info_langage["framework"]
    fichier_test = info_langage["fichier"]
    structure_exemple = info_langage.get("structure", "")
    assertions = info_langage.get("assertions", [])
    
    # Instructions de lot
    if total_lots == 1:
        instruction_lot = "Génère une suite de tests COMPLÈTE pour TOUT le code fourni."
    elif lot_num == 1:
        instruction_lot = f"""
Ceci est le PREMIER lot ({lot_num}/{total_lots}).
Génère la structure de test complète avec :
- Tous les imports nécessaires
- La classe/les fonctions de test
- Les fixtures/mocks pour les dépendances
- Les premiers tests pour les fichiers de ce lot
"""
    elif lot_num == total_lots:
        instruction_lot = f"""
Ceci est le DERNIER lot ({lot_num}/{total_lots}).
Génère les tests restants pour compléter la suite.
- Continue la classe de test existante
- Ajoute les méthodes/fonctions manquantes
- Ne répète pas les imports déjà faits
"""
    else:
        instruction_lot = f"""
Ceci est le lot {lot_num}/{total_lots}.
Génère les tests pour ces fichiers.
- Continue dans la même classe de test
- Ajoute les nouvelles méthodes
- Utilise les fixtures/mocks déjà définis
"""

    # Préparer les fichiers pour le prompt
    fichiers_noms = [f["path"] for f in lot]
    fichiers_descr = "\n".join([f"  - {path}" for path in fichiers_noms])

    # Vulnérabilités formatées
    vuln_text = ""
    if vulnerabilites:
        vuln_text = "\n".join([
            f"  • [{v.get('severite','?')}] {v.get('type','?')}\n"
            f"    Fichier: {v.get('fichier','?')} ligne {v.get('ligne','?')}\n"
            f"    Correction: {v.get('suggestion','?')}"
            for v in vulnerabilites[:10]  # Limite pour éviter prompt trop long
        ])
    else:
        vuln_text = "  • Aucune vulnérabilité spécifique détectée — testez toutes les fonctions"

    # Recommandations formatées
    reco_text = ""
    if recommandations:
        reco_text = "\n".join([
            f"  • {r.get('titre','?')} : {r.get('description','?')}"
            for r in recommandations[:5]
        ])
    else:
        reco_text = "  • Aucune recommandation spécifique"

    prompt = f"""Tu es un expert senior en tests unitaires avec plus de 10 ans d'expérience en {langage} et {framework}.

═══════════════════════════════════════════════════════════════════════
CONTEXTE
═══════════════════════════════════════════════════════════════════════
- Langage : {langage}
- Framework de test : {framework}
- Fichier de test à générer : {fichier_test}
- Ce lot est le {lot_num} sur {total_lots} lots

═══════════════════════════════════════════════════════════════════════
RÈGLES DE GÉNÉRATION DE TESTS (OBLIGATOIRES)
═══════════════════════════════════════════════════════════════════════

1. STRUCTURE DU CODE DE TEST :
{instruction_lot}

Structure recommandée pour {langage} :
{structure_exemple}

2. COUVERTURE DES FONCTIONS :
   - ✅ Teste TOUTES les fonctions/méthodes publiques
   - ✅ Teste les cas NOMINAUX (comportement attendu)
   - ✅ Teste les cas LIMITES (valeurs aux frontières)
   - ✅ Teste les cas d'ERREUR (exceptions, retours d'erreur)
   - ✅ Teste les dépendances via MOCKS

3. NOMENCLATURE DES TESTS :
   {f'   - Utilise les annotations : {info_langage.get("annotations", [])}' if "annotations" in info_langage else ''}
   {f'   - Utilise les décorateurs : {info_langage.get("decorators", [])}' if "decorators" in info_langage else ''}
   {f'   - Utilise les fonctions : {info_langage.get("functions", [])}' if "functions" in info_langage else ''}
   - Chaque test doit avoir un nom explicite en anglais ou français
   - Format recommandé : test_[fonction]_[condition]_[resultat_attendu]

4. MOCKS ET ISOLATION :
   - Toute dépendance externe (API, base de données, fichiers) DOIT être mockée
   - Utilise les mocks pour isoler la logique métier
   - Vérifie les appels aux dépendances : combien de fois, avec quels paramètres

5. ASSERTIONS :
   - Utilise les assertions suivantes : {', '.join(assertions)}
   - Une assertion par test ou très peu (une seule responsabilité)
   - Les messages d'erreur doivent être informatifs

6. QUALITÉ DES TESTS :
   - Pas de code mort
   - Pas de logs dans les tests (sauf pour debug)
   - Les tests doivent être INDÉPENDANTS (ordre n'importe pas)
   - Chaque test doit pouvoir s'exécuter seul

7. GESTION DES DONNÉES DE TEST :
   - Utilise des fixtures pour les données réutilisables
   - Les données de test doivent être prévisibles et reproductibles
   - Évite les données aléatoires sauf si nécessaire

═══════════════════════════════════════════════════════════════════════
VULNÉRABILITÉS À TESTER EN PRIORITÉ
═══════════════════════════════════════════════════════════════════════
{vuln_text}

═══════════════════════════════════════════════════════════════════════
RECOMMANDATIONS À VALIDER
═══════════════════════════════════════════════════════════════════════
{reco_text}

═══════════════════════════════════════════════════════════════════════
FICHIERS À TESTER ({len(lot)} fichier(s) — lot {lot_num}/{total_lots})
═══════════════════════════════════════════════════════════════════════
{fichiers_descr}

═══════════════════════════════════════════════════════════════════════
CODE SOURCE COMPLET
═══════════════════════════════════════════════════════════════════════
{code_text}

═══════════════════════════════════════════════════════════════════════
INSTRUCTION FINALE
═══════════════════════════════════════════════════════════════════════
Génère UNIQUEMENT le code de test {langage} (fichier {fichier_test}).
Pas d'explications, pas de markdown, seulement le code prêt à être exécuté.
Le code doit être complet, compilable et exécutable immédiatement.
"""
    return prompt


# ══════════════════════════════════════════════════════
# UTILITAIRE — Découper en lots
# ══════════════════════════════════════════════════════
def _decouper_en_lots(fichiers: list, budget: int) -> list:
    """Découpe la liste de fichiers en lots ne dépassant pas budget caractères."""
    lots, lot_actuel, total = [], [], 0
    fichiers_tries = sorted(fichiers, key=lambda f: f.get("size", 0))

    for f in fichiers_tries:
        taille = len(f.get("content", ""))
        if taille == 0:
            continue
        if taille > budget:
            f_tronque = {**f, "content": f["content"][:budget], "size": budget}
            lots.append([f_tronque])
            continue
        if total + taille > budget and lot_actuel:
            lots.append(lot_actuel)
            lot_actuel, total = [], 0
        lot_actuel.append(f)
        total += taille

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
    """Génère les tests pour un lot avec le prompt ultra-détaillé."""
    
    langage = info_langage["langage"]
    
    # Prépare le code du lot
    code_text = ""
    for f in lot:
        code_text += (
            f"\n\n{'─'*70}\n"
            f"📄 Fichier : {f['path']}\n"
            f"{'─'*70}\n"
            f"{f['content']}"
        )

    # Construit le prompt adapté
    prompt = _construire_prompt_tests(
        lot=lot,
        lot_num=lot_num,
        total_lots=total_lots,
        info_langage=info_langage,
        vulnerabilites=vulnerabilites,
        recommandations=recommandations,
        code_text=code_text
    )

    fichiers_noms = [f["path"] for f in lot]
    print(f"[TESTS] Lot {lot_num}/{total_lots} : {len(lot)} fichier(s)")
    for name in fichiers_noms[:5]:  # Affiche max 5 noms
        print(f"[TESTS]   - {name}")
    if len(fichiers_noms) > 5:
        print(f"[TESTS]   ... et {len(fichiers_noms)-5} autre(s)")

    # Appel LLM
    response = client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=MAX_TOKENS_REP,
        temperature=0.1
    )

    contenu = response.choices[0].message.content.strip()

    # Nettoyer les backticks markdown
    if contenu.startswith("```"):
        lines = contenu.split("\n")
        lines = [l for l in lines if not l.startswith("```")]
        contenu = "\n".join(lines)

    return contenu


# ══════════════════════════════════════════════════════
# 1. GÉNÉRER TOUS LES TESTS
# ══════════════════════════════════════════════════════
def generer_tests_llm(
    fichiers       : list,
    vulnerabilites : list,
    recommandations: list
) -> dict:
    """Génère des tests unitaires pour TOUS les fichiers du projet."""
    if not fichiers:
        raise Exception("Aucun fichier de code trouvé")

    print(f"\n[TESTS] ════════════════════════════════════════")
    print(f"[TESTS] Génération de tests unitaires")
    print(f"[TESTS] ════════════════════════════════════════")
    print(f"[TESTS] Total fichiers : {len(fichiers)}")

    # Détecter le langage
    info_langage = _detecter_langage(fichiers)
    langage = info_langage["langage"]
    nom_fichier = info_langage["fichier"]

    print(f"[TESTS] Langage détecté : {langage}")
    print(f"[TESTS] Framework : {info_langage['framework']}")
    print(f"[TESTS] Fichier de sortie : {nom_fichier}")

    # Découper en lots
    lots = _decouper_en_lots(fichiers, CHARS_PAR_APPEL)
    print(f"[TESTS] Lots créés : {len(lots)}")

    # Appels LLM
    resultats = []
    for i, lot in enumerate(lots, start=1):
        print(f"\n[TESTS] ── Lot {i}/{len(lots)} ──")
        try:
            code_tests = _generer_tests_lot(
                lot=lot,
                lot_num=i,
                total_lots=len(lots),
                info_langage=info_langage,
                vulnerabilites=vulnerabilites,
                recommandations=recommandations
            )
            resultats.append(code_tests)
            print(f"[TESTS] Lot {i} terminé : {len(code_tests)} caractères")
        except Exception as e:
            print(f"[TESTS] ERREUR lot {i} : {e}")
            continue

    if not resultats:
        raise Exception("Impossible de générer les tests — tous les lots ont échoué")

    # Fusionner
    contenu_final = _fusionner_resultats(resultats, info_langage)

    print(f"\n[TESTS] ════════════════════════════════════════")
    print(f"[TESTS] Tests générés avec succès !")
    print(f"[TESTS] Taille totale : {len(contenu_final)} caractères")
    print(f"[TESTS] Fichier : {nom_fichier}")
    print(f"[TESTS] ════════════════════════════════════════\n")

    return {
        "langage": langage,
        "contenu": contenu_final,
        "fichier": nom_fichier
    }


# ══════════════════════════════════════════════════════
# UTILITAIRE — Fusionner les résultats
# ══════════════════════════════════════════════════════
def _fusionner_resultats(resultats: list, info_langage: dict) -> str:
    """Fusionne les tests de plusieurs lots."""
    if len(resultats) == 1:
        return resultats[0]

    langage = info_langage["langage"]

    if langage == "java":
        return _fusionner_java(resultats)
    elif langage == "python":
        return _fusionner_python(resultats)
    elif langage in ("typescript", "javascript"):
        return _fusionner_js(resultats)
    else:
        separateur = f"\n\n{'='*70}\n// LOT SUIVANT\n{'='*70}\n\n"
        return separateur.join(resultats)


def _fusionner_java(resultats: list) -> str:
    """Fusionne plusieurs fichiers Java en une seule classe."""
    imports = set()
    imports.add("import org.junit.jupiter.api.Test;")
    imports.add("import org.junit.jupiter.api.BeforeEach;")
    imports.add("import org.junit.jupiter.api.extension.ExtendWith;")
    imports.add("import org.mockito.Mock;")
    imports.add("import org.mockito.InjectMocks;")
    imports.add("import org.mockito.junit.jupiter.MockitoExtension;")
    imports.add("import static org.junit.jupiter.api.Assertions.*;")
    imports.add("import static org.mockito.Mockito.*;")
    
    methodes = []
    
    for r in resultats:
        lignes = r.split("\n")
        in_method = False
        current_method = []
        depth = 0
        
        for ligne in lignes:
            stripped = ligne.strip()
            if stripped.startswith("@Test") or stripped.startswith("@BeforeEach"):
                in_method = True
                current_method = [ligne]
                depth = 0
            elif in_method:
                current_method.append(ligne)
                depth += ligne.count("{") - ligne.count("}")
                if depth <= 0 and len(current_method) > 2:
                    methodes.append("\n".join(current_method))
                    in_method = False
    
    contenu = "// Tests générés automatiquement par AuditPlatform\n\n"
    contenu += "\n".join(sorted(imports)) + "\n\n"
    contenu += "@ExtendWith(MockitoExtension.class)\n"
    contenu += "public class GeneratedTest {\n\n"
    contenu += "    // ── Tests générés ──\n\n"
    contenu += "\n\n".join(["    " + m.replace("\n", "\n    ") for m in methodes]) + "\n"
    contenu += "}\n"
    return contenu


def _fusionner_python(resultats: list) -> str:
    """Fusionne plusieurs fichiers Python en un seul."""
    imports = set(["import pytest", "from unittest.mock import Mock, patch"])
    fixtures = []
    tests = []
    
    for r in resultats:
        lignes = r.split("\n")
        in_fixture = False
        in_test = False
        current = []
        
        for ligne in lignes:
            if ligne.startswith("import ") or ligne.startswith("from "):
                imports.add(ligne)
            elif ligne.startswith("@pytest.fixture"):
                in_fixture = True
                current = [ligne]
            elif in_fixture:
                current.append(ligne)
                if ligne.startswith("def "):
                    fixtures.append("\n".join(current))
                    in_fixture = False
            elif ligne.startswith("def test_") or ligne.startswith("async def test_"):
                in_test = True
                current = [ligne]
            elif in_test:
                current.append(ligne)
                if ligne == "" or ligne.startswith("def "):
                    tests.append("\n".join(current))
                    in_test = False
    
    contenu = "# Tests générés automatiquement par AuditPlatform\n\n"
    contenu += "\n".join(sorted(imports)) + "\n\n"
    if fixtures:
        contenu += "\n\n".join(fixtures) + "\n\n"
    contenu += "\n\n".join(tests)
    return contenu


def _fusionner_js(resultats: list) -> str:
    """Fusionne plusieurs fichiers JS/TS en un seul."""
    imports = set()
    describes = []
    
    for r in resultats:
        lignes = r.split("\n")
        for ligne in lignes:
            stripped = ligne.strip()
            if stripped.startswith("import ") or stripped.startswith("const {") or stripped.startswith("require("):
                imports.add(stripped)
            elif stripped.startswith("describe("):
                describes.append(r)
                break
    
    contenu = "// Tests générés automatiquement par AuditPlatform\n\n"
    if imports:
        contenu += "\n".join(sorted(imports)) + "\n\n"
    contenu += "\n\n".join(describes)
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
    """Crée une branche ai/tests/... et pousse le fichier de tests."""
    from datetime import datetime

    project = get_gitlab_project(token, project_url)
    date_str = datetime.now().strftime("%Y-%m-%d-%H%M")
    nom_branche = f"ai/tests/{date_str}"

    try:
        project.branches.create({"branch": nom_branche, "ref": branche_base.strip()})
        print(f"[TESTS] Branche créée : {nom_branche}")
    except Exception as e:
        print(f"[TESTS] Branche existante : {e}")

    try:
        existing = project.files.get(nom_fichier, ref=nom_branche)
        existing.content = contenu_tests
        existing.save(branch=nom_branche, commit_message=f"🤖 IA: Mise à jour des tests ({nom_fichier})")
        print(f"[TESTS] Fichier mis à jour : {nom_fichier}")
    except Exception:
        try:
            project.files.create({
                "file_path": nom_fichier,
                "branch": nom_branche,
                "content": contenu_tests,
                "commit_message": f"🤖 IA: Ajout des tests générés ({nom_fichier})"
            })
            print(f"[TESTS] Fichier créé : {nom_fichier}")
        except Exception as e:
            raise Exception(f"Impossible de pousser le fichier : {str(e)}")

    return {"branche": nom_branche, "fichier": nom_fichier, "project_url": project_url}


# ══════════════════════════════════════════════════════
# 3. CRÉER LA MERGE REQUEST
# ══════════════════════════════════════════════════════
def creer_merge_request(
    token         : str,
    project_url   : str,
    branche_src   : str,
    branche_cible : str = "main"
) -> dict:
    """Crée une MR depuis ai/tests/... vers la branche principale."""
    project = get_gitlab_project(token, project_url)

    try:
        mr = project.mergerequests.create({
            "source_branch": branche_src,
            "target_branch": branche_cible,
            "title": "🤖 IA: Tests unitaires générés automatiquement",
            "description": """
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

> Généré automatiquement par **AuditPlatform** · LLM
            """,
            "remove_source_branch": True,
            "labels": ["IA", "tests-automatiques"]
        })
        print(f"[TESTS] MR créée : !{mr.iid} → {mr.web_url}")
        return {
            "mr_id": mr.iid,
            "mr_url": mr.web_url,
            "titre": mr.title,
            "statut": mr.state
        }
    except Exception as e:
        raise Exception(f"Impossible de créer la MR : {str(e)}")