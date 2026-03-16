"""
FutureAssist AI - Render.com startup script.
Reads PORT from environment and starts uvicorn.
"""
import os
import uvicorn

port = int(os.environ.get("PORT", 10000))

print(f"Starting FutureAssist AI on port {port}...")

uvicorn.run(
    "api.main:app",
    host="0.0.0.0",
    port=port,
    log_level="info",
)
