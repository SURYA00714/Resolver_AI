#!/bin/bash

# Start the background worker process
python3 worker.py &

# Start the FastAPI backend on the port provided by the cloud provider
python3 -m uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
