"""Unit tests for password hashing and JWT (no DB needed)."""

import uuid

from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("secret123")
    assert hashed != "secret123"
    assert verify_password("secret123", hashed)
    assert not verify_password("wrong-password", hashed)


def test_jwt_roundtrip():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    assert decode_access_token(token) == str(user_id)


def test_jwt_rejects_garbage():
    assert decode_access_token("not-a-real-token") is None
