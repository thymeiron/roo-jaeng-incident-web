#!/usr/bin/env python3
"""Generate one VAPID key pair and print env-ready values.

Run this in a trusted terminal. Store the private value in deployment secrets;
do not redirect the output into a tracked file.
"""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


private_key = ec.generate_private_key(ec.SECP256R1())
private_der = private_key.private_bytes(
    encoding=serialization.Encoding.DER,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption(),
)
public_raw = private_key.public_key().public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint,
)

print("VAPID public key (safe for browser/API):")
print(f"VAPID_PUBLIC_KEY={base64url(public_raw)}")
print()
print("VAPID private key (SECRET - never commit or expose through an API):")
print(f"VAPID_PRIVATE_KEY={base64.b64encode(private_der).decode('ascii')}")
