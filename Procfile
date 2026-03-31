# Render: use this when the service root is the repo root (not backend/).
# Loads Flask from backend/app.py with a long worker timeout for Kroger HTML search.
web: gunicorn --chdir backend app:app --bind 0.0.0.0:$PORT --timeout 300 --graceful-timeout 60
