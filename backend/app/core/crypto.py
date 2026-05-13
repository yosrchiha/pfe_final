"""
Utilitaire de chiffrement pour les tokens sensibles (ex: tokens GitLab).

Utilise Fernet (AES-128-CBC + HMAC-SHA256) de la librairie `cryptography`.
La clé doit être définie dans la variable d'environnement TOKEN_ENCRYPTION_KEY.

Générer une clé :
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import os
from cryptography.fernet import Fernet, InvalidToken

_KEY = os.getenv("TOKEN_ENCRYPTION_KEY")

if not _KEY:
    raise RuntimeError(
        "La variable d'environnement TOKEN_ENCRYPTION_KEY est manquante. "
        "Générez une clé avec : python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )

_fernet = Fernet(_KEY.encode())


def encrypt_token(plain_token: str) -> str:
    """Chiffre un token en clair et retourne la valeur chiffrée (str)."""
    return _fernet.encrypt(plain_token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    """Déchiffre un token chiffré. Lève ValueError si le token est invalide."""
    try:
        return _fernet.decrypt(encrypted_token.encode()).decode()
    except InvalidToken:
        raise ValueError("Token chiffré invalide ou clé de chiffrement incorrecte.")