# backend/app/routes/tests.py
# + modification à appliquer dans analyses.py pour sauvegarder les tests

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.test_genere import TestGenere
from app.models.depot_analyse import DepotAnalyse
from app.schemas.test_genere import TestGenereResponse
router = APIRouter(prefix="/tests", tags=["Tests"])


# ════════════════════════════════════════════════════════
# GET /tests/
# Tous les tests du user connecté
# ════════════════════════════════════════════════════════
@router.get("/")
def get_tests_user(
    authorization: str     = Header(None),
    db           : Session = Depends(get_db)
):
    from app.routes.analyses import get_user_id_from_token
    user_id = get_user_id_from_token(authorization, db)

    # Récupère les dépôts du user
    depots_ids = [
        d.id for d in db.query(DepotAnalyse)
        .filter(DepotAnalyse.user_id == user_id).all()
    ]

    tests = db.query(TestGenere).filter(
        TestGenere.depot_analyse_id.in_(depots_ids)
    ).order_by(TestGenere.created_at.desc()).all()

    return [_format_test(t) for t in tests]


# ════════════════════════════════════════════════════════
# GET /tests/depot/{depot_analyse_id}
# Tests d'un dépôt spécifique
# ════════════════════════════════════════════════════════
@router.get("/depot/{depot_analyse_id}")
def get_tests_depot(depot_analyse_id: int, db: Session = Depends(get_db)):
    tests = db.query(TestGenere).filter(
        TestGenere.depot_analyse_id == depot_analyse_id
    ).order_by(TestGenere.created_at.desc()).all()

    return [_format_test(t) for t in tests]


# ════════════════════════════════════════════════════════
# GET /tests/analyse/{analyse_id}
# Tests d'une analyse spécifique
# ════════════════════════════════════════════════════════
@router.get("/analyse/{analyse_id}")
def get_tests_analyse(analyse_id: int, db: Session = Depends(get_db)):
    tests = db.query(TestGenere).filter(
        TestGenere.analyse_id == analyse_id
    ).order_by(TestGenere.created_at.desc()).all()

    return [_format_test(t) for t in tests]


# ════════════════════════════════════════════════════════
# GET /tests/{test_id}
# Détail complet d'un test (avec contenu)
# ════════════════════════════════════════════════════════
@router.get("/{test_id}")
def get_test(test_id: int, db: Session = Depends(get_db)):
    test = db.query(TestGenere).filter(TestGenere.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test introuvable")
    return _format_test(test, avec_contenu=True)


# ════════════════════════════════════════════════════════
# DELETE /tests/{test_id}
# ════════════════════════════════════════════════════════
@router.delete("/{test_id}")
def delete_test(test_id: int, db: Session = Depends(get_db)):
    test = db.query(TestGenere).filter(TestGenere.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test introuvable")
    db.delete(test)
    db.commit()
    return {"message": "Test supprimé"}


# ════════════════════════════════════════════════════════
# UTILITAIRE — Formater un test pour la réponse
# ════════════════════════════════════════════════════════
def _format_test(t: TestGenere, avec_contenu: bool = False) -> dict:
    d = {
        "id"              : t.id,
        "analyse_id"      : t.analyse_id,
        "depot_analyse_id": t.depot_analyse_id,
        "langage"         : t.langage,
        "framework"       : t.framework,
        "nom_fichier"     : t.nom_fichier,
        "nb_tests"        : t.nb_tests,
        "nb_lots"         : t.nb_lots,
        "statut"          : t.statut,
        "branche_cible"   : t.branche_cible,
        "created_at"      : str(t.created_at),
    }
    if avec_contenu:
        d["contenu"] = t.contenu
    return d


# ════════════════════════════════════════════════════════
# MODIFICATION À APPLIQUER DANS analyses.py
# Endpoint POST /analyses/generer-tests
# Ajouter la sauvegarde en base après génération
# ════════════════════════════════════════════════════════
#
# Remplace le return final dans generer_tests_endpoint par :
#
#   from app.models.test_genere import TestGenere
#
#   # Compter le nombre de tests dans le contenu
#   contenu = resultat_llm["contenu"]
#   nb_tests = contenu.count("@Test") or contenu.count("def test_") or contenu.count("it(") or 1
#
#   # Sauvegarder en base
#   test_db = TestGenere(
#       analyse_id       = data.analyse_id,
#       depot_analyse_id = analyse.depot_analyse_id,
#       langage          = resultat_llm["langage"],
#       framework        = _detecter_framework(resultat_llm["langage"]),
#       nom_fichier      = resultat_branche["fichier"],
#       contenu          = resultat_llm["contenu"],
#       nb_tests         = nb_tests,
#       nb_lots          = resultat_llm.get("nb_lots", 1),
#       statut           = "pousse" if resultat_mr else "genere",
#       branche_cible    = resultat_branche["branche"],
#   )
#   db.add(test_db)
#   db.commit()
#   db.refresh(test_db)
#
#   return {
#       "statut"   : "succes",
#       "test_id"  : test_db.id,        # ← ID en base
#       "langage"  : resultat_llm["langage"],
#       "branche"  : resultat_branche["branche"],
#       "fichier"  : resultat_branche["fichier"],
#       "mr"       : resultat_mr
#   }
#
# def _detecter_framework(langage: str) -> str:
#     mapping = {
#         "python"    : "pytest",
#         "java"      : "JUnit 5",
#         "typescript": "Jest",
#         "javascript": "Jest",
#         "php"       : "PHPUnit",
#         "go"        : "testing",
#         "csharp"    : "xUnit",
#     }
#     return mapping.get(langage, "pytest")