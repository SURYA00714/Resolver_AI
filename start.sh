#!/bin/bash

# Start the background worker process
python3 worker.py &

# Start the FastAPI backend on port 8000 (accessible internally by the dashboard)
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 &

# Start the Streamlit dashboard on the port provided by the cloud provider
python3 -m streamlit run ui/dashboard.py --server.port $PORT --server.address 0.0.0.0
