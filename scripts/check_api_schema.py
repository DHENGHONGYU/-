"""Quick check of API schema for correct params"""
import requests
import json

BASE = "http://127.0.0.1:8000"
spec = requests.get(f"{BASE}/openapi.json", timeout=5).json()

for path, methods in spec.get("paths", {}).items():
    for method, details in methods.items():
        print(f"\n=== {method.upper()} {path} ===")
        # Request body schema
        if "requestBody" in details:
            content = details["requestBody"].get("content", {})
            for ct, schema in content.items():
                ref = schema.get("schema", {}).get("$ref", "")
                print(f"  Body ({ct}): {ref}")

        # Parameters
        params = details.get("parameters", [])
        if params:
            for p in params:
                print(f"  Param: {p.get('name')} ({p.get('in')}) - {p.get('schema', {}).get('type', '')}")

        # Get schema components
        if path == "/api/collect/basic":
            print("\n  Schema components:")
            for k, v in spec.get("components", {}).get("schemas", {}).items():
                print(f"    {k}: {json.dumps(v, ensure_ascii=False)[:200]}")