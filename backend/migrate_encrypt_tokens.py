"""
Script de migration : chiffrement des tokens GitLab existants en base.

À exécuter UNE SEULE FOIS après avoir :
  1. Ajouté TOKEN_ENCRYPTION_KEY dans le .env
  2. Déployé les nouveaux modèles

Usage :
    python migrate_encrypt_tokens.py
"""

import os
import sys

# S'assurer que le dossier backend est dans le path
sys.path.insert(0, os.path.dirname(__file__))

from app.config.database import SessionLocal
from app.core.crypto import encrypt_token
from sqlalchemy import text


def is_already_encrypted(value: str) -> bool:
    """
    Les tokens Fernet commencent toujours par 'gAAAAA' (base64 d'un header fixe).
    On évite de re-chiffrer ce qui l'est déjà.
    """
    if not value:
        return False
    return value.startswith("gAAAAA")


def migrate():
    print("🔐 Migration des tokens GitLab...")
    db = SessionLocal()
    try:
        # --- Table depots ---
        result = db.execute(text("SELECT id, token_gitlab FROM depots WHERE token_gitlab IS NOT NULL"))
        rows = result.fetchall()
        updated = 0
        for row in rows:
            token = row[1]
            if token and not is_already_encrypted(token):
                encrypted = encrypt_token(token)
                db.execute(
                    text("UPDATE depots SET token_gitlab = :enc WHERE id = :id"),
                    {"enc": encrypted, "id": row[0]}
                )
                updated += 1
        print(f"[depots] {updated}/{len(rows)} tokens chiffrés.")

        # --- Table depots_analyse ---
        result = db.execute(text("SELECT id, gitlab_token FROM depots_analyse WHERE gitlab_token IS NOT NULL"))
        rows = result.fetchall()
        updated = 0
        for row in rows:
            token = row[1]
            if token and not is_already_encrypted(token):
                encrypted = encrypt_token(token)
                db.execute(
                    text("UPDATE depots_analyse SET gitlab_token = :enc WHERE id = :id"),
                    {"enc": encrypted, "id": row[0]}
                )
                updated += 1
        print(f"[depots_analyse] {updated}/{len(rows)} tokens chiffrés.")

        # --- Table explorations ---
        result = db.execute(text("SELECT id, gitlab_token FROM explorations WHERE gitlab_token IS NOT NULL"))
        rows = result.fetchall()
        updated = 0
        for row in rows:
            token = row[1]
            if token and not is_already_encrypted(token):
                encrypted = encrypt_token(token)
                db.execute(
                    text("UPDATE explorations SET gitlab_token = :enc WHERE id = :id"),
                    {"enc": encrypted, "id": row[0]}
                )
                updated += 1
        print(f"[explorations] {updated}/{len(rows)} tokens chiffrés.")

        db.commit()
        print("\n✅ Migration terminée avec succès.")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Erreur lors de la migration : {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # Vérifier que la clé est définie
    if not os.getenv("TOKEN_ENCRYPTION_KEY"):
        print("⚠️  Attention: TOKEN_ENCRYPTION_KEY n'est pas définie dans .env")
        print("   Les tokens seront stockés en clair si la clé est absente.")
        response = input("   Continuer quand même ? (o/N): ")
        if response.lower() != 'o':
            print("Migration annulée.")
            sys.exit(0)
    
    migrate()