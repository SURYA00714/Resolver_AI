# FILE: ui/dashboard.py
"""ResolverAI — Payment Operations Control Center Console (§23, 24, 25)."""
import asyncio
import json
import os
import sys
import time
import uuid
from decimal import Decimal

import asyncpg
import httpx
import pandas as pd
import streamlit as st

DB_URL = os.getenv("DATABASE_URL", "postgresql://resolver:resolver@localhost:5432/resolverai")
API_URL = os.getenv("API_URL", "http://localhost:8000")


def run_query(query: str, *args):
    """Execute asynchronous database query synchronously for Streamlit."""
    async def _fetch():
        conn = await asyncpg.connect(DB_URL)
        try:
            return [dict(r) for r in await conn.fetch(query, *args)]
        except Exception as e:
            print(f"Query error: {e}", file=sys.stderr)
            return []
        finally:
            await conn.close()
    return asyncio.run(_fetch())


def api_post(path: str, data: dict = None):
    try:
        r = httpx.post(f"{API_URL}{path}", json=data, timeout=10)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


st.set_page_config(page_title="ResolverAI — Payment Operations Console", layout="wide", page_icon="🛡️")

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    html, body, [class*="css"] { font-family: 'Inter', sans-serif; }
    .main { background: linear-gradient(135deg, #0a0e17 0%, #121824 50%, #1a2332 100%); }

    .metric-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 16px 20px;
        margin: 6px 0;
        backdrop-filter: blur(20px);
    }
    .metric-value {
        font-size: 1.8rem;
        font-weight: 700;
        background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    .metric-label {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.5);
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .mode-badge-real {
        background-color: #2ed573; color: black; font-weight: 700;
        padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;
    }
    .mode-badge-chaos {
        background-color: #ffa502; color: black; font-weight: 700;
        padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;
    }

    .timeline-step {
        border-left: 3px solid #00f2fe;
        padding: 10px 16px;
        margin: 6px 0;
        background: rgba(255,255,255,0.02);
        border-radius: 0 8px 8px 0;
    }
</style>
""", unsafe_allow_html=True)


# === HEADER ===
mode_setting = os.getenv("RAZORPAY_MODE", "TEST")
badge_class = "mode-badge-real" if mode_setting in ("TEST", "LIVE") else "mode-badge-chaos"

st.markdown(f"""
<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0 20px;">
    <div>
        <h1 style="font-size: 2.2rem; font-weight: 700; margin: 0;
            background: linear-gradient(135deg, #00f2fe, #4facfe, #43e97b);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            🛡️ ResolverAI — Payment Operations Control Center
        </h1>
        <p style="color: rgba(255,255,255,0.5); font-size: 0.9rem; margin-top: 4px;">
            Don't guess what happened to a payment. Verify it, resolve it, and prove it.
        </p>
    </div>
    <div>
        <span class="{badge_class}">MODE: {mode_setting}</span>
    </div>
</div>
""", unsafe_allow_html=True)


# === METRICS BAR ===
intents_count_data = run_query("SELECT current_state, COUNT(*) as cnt FROM payment_intents GROUP BY current_state")
state_counts = {r["current_state"]: r["cnt"] for r in intents_count_data} if intents_count_data else {}
total_intents = sum(state_counts.values())

evidence_total = run_query("SELECT COUNT(*) as cnt FROM immutable_evidence")
total_ev = evidence_total[0]["cnt"] if evidence_total else 0

cases_open = run_query("SELECT COUNT(*) as cnt FROM reconciliation_cases WHERE status = 'OPEN'")
open_cases = cases_open[0]["cnt"] if cases_open else 0

fin_summary = run_query("""
    SELECT
        COALESCE(SUM(CASE WHEN action IN ('CAPTURE', 'NO_ACTION') THEN amount ELSE 0 END), 0) as captured,
        COALESCE(SUM(CASE WHEN action = 'REFUND' THEN amount ELSE 0 END), 0) as refunded
    FROM immutable_evidence
""")
fin = fin_summary[0] if fin_summary else {"captured": 0, "refunded": 0}
net_rec = Decimal(str(fin.get("captured", 0))) - Decimal(str(fin.get("refunded", 0)))

m1, m2, m3, m4, m5 = st.columns(5)
with m1:
    st.markdown(f'<div class="metric-card"><div class="metric-value">{total_intents}</div><div class="metric-label">Total Payment Intents</div></div>', unsafe_allow_html=True)
with m2:
    st.markdown(f'<div class="metric-card"><div class="metric-value">{state_counts.get("UNCERTAIN", 0)}</div><div class="metric-label">⚠️ Uncertain Payments</div></div>', unsafe_allow_html=True)
with m3:
    st.markdown(f'<div class="metric-card"><div class="metric-value">{state_counts.get("CAPTURED", 0)}</div><div class="metric-label">✅ Captured</div></div>', unsafe_allow_html=True)
with m4:
    st.markdown(f'<div class="metric-card"><div class="metric-value" style="color: #ff6b6b;">{open_cases}</div><div class="metric-label">🚨 Manual Review Cases</div></div>', unsafe_allow_html=True)
with m5:
    st.markdown(f'<div class="metric-card"><div class="metric-value">₹{net_rec:,.2f}</div><div class="metric-label">💰 Net Recovered</div></div>', unsafe_allow_html=True)


st.markdown("---")

# === TABS ===
tab_real, tab_chaos, tab_cases = st.tabs([
    "💳 REAL RAZORPAY TEST MODE",
    "🧪 LOCAL CHAOS LAB (TEST ENVIRONMENT)",
    "🚨 RECONCILIATION CASES & MANUAL REVIEW",
])

# -------------------------------------------------------------
# TAB 1: REAL RAZORPAY TEST MODE
# -------------------------------------------------------------
with tab_real:
    st.markdown("### 📊 Active Payment Intents & Authoritative Lifecycle")
    
    intents = run_query("""
        SELECT payment_intent_id as "Intent ID",
               merchant_reference as "Merchant Ref",
               order_id as "Order ID",
               razorpay_order_id as "Razorpay Order",
               active_payment_id as "Razorpay Payment",
               amount as "Amount",
               currency as "Cur",
               current_state as "State",
               updated_at as "Last Updated"
        FROM payment_intents ORDER BY updated_at DESC LIMIT 20
    """)
    intents_df = pd.DataFrame(intents)
    
    if not intents_df.empty:
        st.dataframe(intents_df, use_container_width=True, height=280)
        
        st.markdown("### 🔍 Payment Timeline & Evidence Inspector")
        selected_intent = st.selectbox("Select Payment Intent ID to Inspect:", intents_df["Intent ID"].tolist())
        
        if selected_intent:
            intent_details = api_post(f"/payments/{selected_intent}/timeline")
            
            if "error" not in intent_details:
                c1, c2 = st.columns([1, 1])
                
                with c1:
                    st.markdown("#### 📡 Payment Events Chronology")
                    for ev in intent_details.get("events", []):
                        st.markdown(f"""<div class="timeline-step">
                            <b>{ev.get('event_type')}</b> | Source: {ev.get('source')}<br>
                            <span style="font-size: 0.8rem; color: rgba(255,255,255,0.5);">Event ID: {ev.get('external_event_id')} | Received: {ev.get('received_at')}</span>
                        </div>""", unsafe_allow_html=True)
                
                with c2:
                    st.markdown("#### 📜 Immutable Financial-Action Evidence")
                    for ev in intent_details.get("evidence", []):
                        st.markdown(f"""<div class="timeline-step" style="border-left-color: #43e97b;">
                            <b>Action: {ev.get('action')}</b> | Decision: <code>{ev.get('decision')}</code><br>
                            Reason: {ev.get('policy_reason')}<br>
                            <span style="font-size: 0.8rem; color: rgba(255,255,255,0.5);">Trace ID: {ev.get('trace_id')} | Time: {ev.get('created_at')}</span>
                        </div>""", unsafe_allow_html=True)
            else:
                st.error("Failed to load payment timeline details.")
    else:
        st.info("No real Razorpay payment intents ingested yet. Webhooks received via POST /webhook/razorpay will populate here.")


# -------------------------------------------------------------
# TAB 2: LOCAL CHAOS LAB
# -------------------------------------------------------------
with tab_chaos:
    st.warning("⚠️ LOCAL CHAOS TEST ENVIRONMENT — Synthetic Chaos Testing Laboratory for Edge Cases")
    
    col_c1, col_c2 = st.columns([1, 2])
    
    with col_c1:
        st.markdown("#### ⚡ Inject Failure Scenarios")
        
        if st.button("🔥 Inject Late Authorization", use_container_width=True):
            res = api_post("/demo/chaos/late-auth")
            if "error" in res:
                st.error(res["error"])
            else:
                st.success(f"Injected! Intent ID: `{res.get('payment_intent_id')}`")
                
        if st.button("🔄 Inject Duplicate Execution Attempt", use_container_width=True):
            res = api_post("/demo/chaos/cross-rail")
            if "error" in res:
                st.error(res["error"])
            else:
                st.success(f"Injected! Intent ID: `{res.get('payment_intent_id')}`")
                
        if st.button("📨 Inject Out-of-Order Webhook", use_container_width=True):
            res = api_post("/demo/chaos/out-of-order")
            if "error" in res:
                st.error(res["error"])
            else:
                st.success(f"Injected! Intent ID: `{res.get('payment_intent_id')}`")

    with col_c2:
        st.markdown("#### ⚙️ Chaos Engine State")
        st.info("Chaos scenarios run through the exact same Reconciliation Engine and 5-Rule Policy Gate used in production.")


# -------------------------------------------------------------
# TAB 3: RECONCILIATION CASES & MANUAL REVIEW
# -------------------------------------------------------------
with tab_cases:
    st.markdown("### 🚨 Unresolved Operational Incidents (Manual Review Required)")
    
    cases = run_query("SELECT * FROM reconciliation_cases ORDER BY opened_at DESC")
    cases_df = pd.DataFrame(cases)
    
    if not cases_df.empty:
        st.dataframe(cases_df, use_container_width=True)
        
        st.markdown("#### 🛠️ Operator Resolution Action")
        open_case_ids = [str(r["case_id"]) for r in cases if r["status"] == "OPEN"]
        if open_case_ids:
            selected_case = st.selectbox("Select Open Case ID to Resolve:", open_case_ids)
            op_id = st.text_input("Operator ID:", value="op_admin_01")
            op_notes = st.text_area("Resolution Rationale & Notes:", value="Verified payment capture manually with bank settlement file.")
            action_choice = st.selectbox("Resolution Action:", ["CAPTURE", "REFUND", "VOID", "CLOSE"])
            
            if st.button("Submit Operator Manual Resolution", use_container_width=True):
                res = api_post(f"/cases/{selected_case}/manual-resolve", data={
                    "operator_id": op_id,
                    "resolution_notes": op_notes,
                    "action": action_choice,
                })
                if "error" in res:
                    st.error(res["error"])
                else:
                    st.success("Case successfully resolved! Audit record created.")
        else:
            st.info("No open reconciliation cases requiring manual review.")
    else:
        st.info("No reconciliation cases recorded yet.")