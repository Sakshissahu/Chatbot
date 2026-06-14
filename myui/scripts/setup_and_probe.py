#!/usr/bin/env python3
"""
setup_and_probe.py - One-shot: mint a RAGFlow beta token, write it into the
backend's .env, and confirm the chat API contract end-to-end (both bots +
isolation).

Run from anywhere:  python myui/scripts/setup_and_probe.py
Never prints the full secret; writes it only to the gitignored
myui-backend/.env (the token lives backend-side now, never in the browser).
"""
import base64
import json
import os
import sys
from pathlib import Path

import requests
from Cryptodome.Cipher import PKCS1_v1_5 as Cipher_pkcs1_v1_5
from Cryptodome.PublicKey import RSA

HERE = Path(__file__).resolve().parent
MYUI = HERE.parent                      # ragflow/myui
RAGFLOW = MYUI.parent                   # ragflow
PUBLIC_PEM = RAGFLOW / "conf" / "public.pem"
BACKEND = RAGFLOW / "myui-backend"      # ragflow/myui-backend
ENV_PATH = BACKEND / ".env"
ENV_EXAMPLE = BACKEND / ".env.example"


def upsert_env(path: Path, updates: dict) -> None:
    """Update the given keys in a .env file, preserving every other line
    (e.g. the Postgres credentials). Creates the file from .env.example if
    it does not exist yet."""
    if not path.exists():
        if ENV_EXAMPLE.exists():
            path.write_text(ENV_EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8")
        else:
            path.write_text("", encoding="utf-8")
    lines = path.read_text(encoding="utf-8").splitlines()
    remaining = dict(updates)
    out = []
    for line in lines:
        key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else None
        if key in remaining:
            out.append(f"{key}={remaining.pop(key)}")
        else:
            out.append(line)
    for key, val in remaining.items():
        out.append(f"{key}={val}")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")

API = "http://localhost:80/api/v1"

# RAGFlow admin credentials, used only to mint a beta token. The password must
# NOT be hardcoded — this file is committed to git. Supply it via the
# environment (the email is not secret, so it keeps a sensible default):
#   PowerShell:  $env:RAGFLOW_ADMIN_PASSWORD="..."; python myui/scripts/setup_and_probe.py
#   bash:        RAGFLOW_ADMIN_PASSWORD=... python myui/scripts/setup_and_probe.py
EMAIL = os.environ.get("RAGFLOW_ADMIN_EMAIL", "admin@ibgroup.co.in")
PASSWORD = os.environ.get("RAGFLOW_ADMIN_PASSWORD", "")
if not PASSWORD:
    print(
        "FATAL: set RAGFLOW_ADMIN_PASSWORD (the RAGFlow admin password) before running.\n"
        '  PowerShell:  $env:RAGFLOW_ADMIN_PASSWORD="..."; python myui/scripts/setup_and_probe.py'
    )
    sys.exit(1)

FARMER_ID = "66824bb2675f11f1bb5ca9173f52da2e"      # IB-assist  -> farmer docs
EMPLOYEE_ID = "2150f758676111f1bb5ca9173f52da2e"    # Employee Assistant -> HR policy


def crypt(line: str) -> str:
    rsa_key = RSA.importKey(PUBLIC_PEM.read_text(), "Welcome")
    cipher = Cipher_pkcs1_v1_5.new(rsa_key)
    pw_b64 = base64.b64encode(line.encode()).decode()
    return base64.b64encode(cipher.encrypt(pw_b64.encode())).decode()


def login(s: requests.Session) -> dict:
    r = s.post(f"{API}/auth/login", json={"email": EMAIL, "password": crypt(PASSWORD)}, timeout=60)
    token = r.headers.get("Authorization") or (r.json().get("data") or {}).get("access_token")
    if not token:
        print("FATAL login:", json.dumps(r.json())[:300]); sys.exit(1)
    return {"Authorization": f"Bearer {token}"}


def get_or_create_beta(s: requests.Session, H: dict) -> str:
    # Reuse an existing token's beta if present, else mint one (avoids token sprawl).
    r = s.get(f"{API}/system/tokens", headers=H, timeout=60)
    data = r.json().get("data") or []
    for o in data:
        if o.get("beta"):
            return o["beta"]
    r = s.post(f"{API}/system/tokens", headers=H, timeout=60)
    return r.json()["data"]["beta"]


def sse_completion(beta: str, dialog_id: str, body: dict):
    """Yield parsed `data` objects from the SSE chat stream."""
    H = {"Authorization": f"Bearer {beta}", "Content-Type": "application/json"}
    with requests.post(f"{API}/chatbots/{dialog_id}/completions", headers=H,
                       json={**body, "stream": True}, stream=True, timeout=180) as r:
        for raw in r.iter_lines(decode_unicode=True):
            if not raw or not raw.startswith("data:"):
                continue
            payload = raw[len("data:"):].strip()
            try:
                obj = json.loads(payload)
            except Exception:
                continue
            yield obj.get("data")


def new_session(beta: str, dialog_id: str, variables: dict) -> str:
    for data in sse_completion(beta, dialog_id, {"question": "", **variables}):
        if isinstance(data, dict) and data.get("session_id"):
            return data["session_id"]
    raise RuntimeError("no session_id returned")


def ask(beta: str, dialog_id: str, session_id: str, question: str, variables: dict):
    answer, reference = "", {}
    for data in sse_completion(beta, dialog_id, {
            "question": question, "session_id": session_id, "quote": True, **variables}):
        if data is True:
            break
        if isinstance(data, dict):
            answer = data.get("answer", answer)
            if data.get("reference"):
                reference = data["reference"]
    return answer, reference


def main():
    s = requests.Session()
    H = login(s)
    beta = get_or_create_beta(s, H)
    print(f"beta token acquired: {beta[:4]}...{beta[-2:]} (len {len(beta)})")

    # --- upsert the token + bot ids into the backend's gitignored .env ---
    # (preserves Postgres creds and everything else already in the file)
    upsert_env(ENV_PATH, {
        "RAGFLOW_BETA_TOKEN": beta,
        "FARMER_BOT_ID": FARMER_ID,
        "EMPLOYEE_BOT_ID": EMPLOYEE_ID,
    })
    print(f"wrote token + bot ids into {ENV_PATH}")

    # --- contract test 1: farmer bot answers a farming question ---
    vars_f = {"user_name": "Asha", "role": "Farmer"}
    sid = new_session(beta, FARMER_ID, vars_f)
    print(f"\n[FARMER] session={sid[:8]}")
    ans, ref = ask(beta, FARMER_ID, sid,
                   "What biosecurity measures are recommended for poultry sheds?", vars_f)
    docs = [d.get("document_name") for d in (ref.get("doc_aggs") or [])]
    print("  answer:", (ans or "")[:280].replace("\n", " "))
    print("  has_citation_markers:", "[ID:" in (ans or ""))
    print("  doc_aggs:", docs[:6])
    print("  chunks:", len(ref.get("chunks") or []))

    # --- contract test 2: isolation - employee bot refuses a farming question ---
    vars_e = {"user_name": "Ravi", "role": "Employee"}
    sid2 = new_session(beta, EMPLOYEE_ID, vars_e)
    print(f"\n[EMPLOYEE] session={sid2[:8]}")
    ans2, ref2 = ask(beta, EMPLOYEE_ID, sid2,
                     "What biosecurity measures are recommended for poultry sheds?", vars_e)
    print("  answer:", (ans2 or "")[:280].replace("\n", " "))
    print("  refused:", "not found in the dataset" in (ans2 or "").lower())

    # --- contract test 3: employee bot answers an HR question ---
    ans3, ref3 = ask(beta, EMPLOYEE_ID, sid2,
                     "What is the leave or HR policy?", vars_e)
    docs3 = [d.get("document_name") for d in (ref3.get("doc_aggs") or [])]
    print("  HR answer:", (ans3 or "")[:280].replace("\n", " "))
    print("  HR doc_aggs:", docs3[:6])


if __name__ == "__main__":
    main()
