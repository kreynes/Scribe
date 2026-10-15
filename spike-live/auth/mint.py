# Throwaway for kreynes/Scribe#24: a stand-in identity provider so a local loreserver
# can tell two users apart.
#
#   python mint.py keys <dir>              writes <dir>/key.pem and <dir>/jwks.json
#   python mint.py token <dir> <sub> [roles...]   prints an RS256 JWT for user <sub>
#
# Serve <dir> over HTTP (python -m http.server) so loreserver's
# [server.auth.jwk].endpoint can fetch jwks.json.
import json
import sys
import time
from pathlib import Path

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

ISSUER = "http://127.0.0.1:8765"
AUDIENCE = "lore-service"
KID = "scribe-test-key"


def keys(d: Path) -> None:
    d.mkdir(parents=True, exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    (d / "key.pem").write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    jwk = json.loads(RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update({"kid": KID, "alg": "RS256", "use": "sig"})
    (d / "jwks.json").write_text(json.dumps({"keys": [jwk]}))
    # loreserver fetches the discovery document at startup when [server.auth.oidc] is set.
    (d / ".well-known").mkdir(exist_ok=True)
    (d / ".well-known" / "openid-configuration").write_text(
        json.dumps({"issuer": ISSUER, "jwks_uri": f"{ISSUER}/jwks.json"})
    )


def token(d: Path, sub: str, roles: list[str]) -> str:
    key = (d / "key.pem").read_bytes()
    now = int(time.time())
    claims = {"iss": ISSUER, "aud": AUDIENCE, "sub": sub, "iat": now, "exp": now + 8 * 3600}
    if roles:
        claims["roles"] = roles
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": KID})


if __name__ == "__main__":
    cmd, d = sys.argv[1], Path(sys.argv[2])
    if cmd == "keys":
        keys(d)
    else:
        print(token(d, sys.argv[3], sys.argv[4:]))
