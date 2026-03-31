# Gunicorn settings — loaded with: gunicorn -c gunicorn.conf.py app:app
# Render and other hosts often ignore Procfile --timeout; this file is harder to override.
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
# Kroger HTML search can take many minutes per cart (sequential terms × 120s).
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "900"))
graceful_timeout = int(os.environ.get("GUNICORN_GRACEFUL_TIMEOUT", "60"))
keepalive = 5
