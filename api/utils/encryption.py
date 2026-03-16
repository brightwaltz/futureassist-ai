"""
AES-256-GCM encryption module for HEROIC data payloads.
Implements rotating salt + static key as specified.
"""
import base64
import json
import os
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class HeroicEncryptor:
    """Encrypts data payloads for secure HEROIC transmission."""

    def __init__(self, base_key: str):
        """
        Args:
            base_key: Base64-encoded 32-byte encryption key from environment.
        """
        self._key = base64.b64decode(base_key)
        if len(self._key) != 32:
            raise ValueError("Encryption key must be exactly 32 bytes (256 bits)")

    def encrypt(self, data: dict) -> Tuple[bytes, bytes]:
        """
        Encrypt a data dictionary using AES-256-GCM with a random nonce/salt.

        Returns:
            (encrypted_payload, salt) as bytes tuples.
        """
        plaintext = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")

        # Generate random 12-byte nonce (rotating salt)
        nonce = os.urandom(12)

        aesgcm = AESGCM(self._key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)

        # Prepend nonce to ciphertext for self-contained decryption
        encrypted_payload = nonce + ciphertext

        return encrypted_payload, nonce

    def decrypt(self, encrypted_payload: bytes) -> dict:
        """
        Decrypt an AES-256-GCM encrypted payload.
        Assumes nonce is prepended (first 12 bytes).
        """
        nonce = encrypted_payload[:12]
        ciphertext = encrypted_payload[12:]

        aesgcm = AESGCM(self._key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)

        return json.loads(plaintext.decode("utf-8"))


def get_encryptor(encryption_key: str) -> HeroicEncryptor:
    """Factory function for creating encryptor instances."""
    return HeroicEncryptor(encryption_key)
