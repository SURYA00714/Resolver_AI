# FILE: ui/dashboard.py
"""ResolverAI — Operator Mission Control Dashboard (§41)."""
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


# --- DB Helpers ---
def run_query(query: str, *args):
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


def api_post(path: str):
    try:
        r = httpx.post(f"{API_URL}{path}", timeout=10)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


# --- Page Config ---
st.set_page_config(page_title="ResolverAI — Mission Control", layout="wide", page_icon="🚀")

# --- Global CSS ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

    .main { background: linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%); }

    .metric-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        padding: 20px 24px;
        margin: 8px 0;
        backdrop-filter: blur(20px);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .metric-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(79, 172, 254, 0.15);
    }
    .metric-value {
        font-size: 2rem;
        font-weight: 700;
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    .metric-label {
        font-size: 0.85rem;
        color: rgba(255,255,255,0.5);
        text-transform: uppercase;
        letter-spacing: 1.2px;
        margin-top: 4px;
    }

    .agent-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 14px;
        padding: 18px 20px;
        margin: 8px 0;
    }
    .agent-name {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 8px;
    }
    .agent-detective { border-left: 4px solid #f093fb; }
    .agent-negotiator { border-left: 4px solid #4facfe; }
    .agent-finops { border-left: 4px solid #43e97b; }

    .policy-pass { color: #43e97b; font-weight: 600; }
    .policy-fail { color: #ff6b6b; font-weight: 600; }

    .chaos-btn {
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%) !important;
        border: none !important;
        border-radius: 10px !important;
        color: white !important;
        font-weight: 600 !important;
    }

    .timeline-event {
        border-left: 3px solid rgba(79, 172, 254, 0.4);
        padding: 8px 16px;
        margin: 4px 0;
        background: rgba(255,255,255,0.02);
        border-radius: 0 8px 8px 0;
    }

    .state-uncertain { color: #ffa502; font-weight: 700; }
    .state-captured { color: #2ed573; font-weight: 700; }
    .state-failed { color: #ff4757; font-weight: 700; }
    .state-review { color: #ff6348; font-weight: 700; }
    .state-reconciled { color: #1e90ff; font-weight: 700; }
    .state-compensating { color: #eccc68; font-weight: 700; }
    .state-duplicate { color: #ff7979; font-weight: 700; }

    div[data-testid="stHorizontalBlock"] > div { padding: 0 4px; }
</style>
""", unsafe_allow_html=True)


# === HEADER ===
st.markdown("""
<div style="text-align: center; padding: 10px 0 20px;">
    <h1 style="font-size: 2.4rem; font-weight: 700; margin: 0;
        background: linear-gradient(135deg, #4facfe, #00f2fe, #43e97b);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        🚀 ResolverAI — Mission Control
    </h1>
    <p style="color: rgba(255,255,255,0.5); font-size: 0.9rem; margin-top: 4px;">
        AI-Guided Payment State Resolution | Razorpay Buildathon
    </p>
</div>
""", unsafe_allow_html=True)


# === SECTION A: System Metrics ===
intent_counts = run_query("""
    SELECT current_state, COUNT(*) as cnt FROM payment_intents GROUP BY current_state
""")
total_intents = sum(r["cnt"] for r in intent_counts) if intent_counts else 0
state_map = {r["current_state"]: r["cnt"] for r in intent_counts} if intent_counts else {}

outbox_data = run_query("SELECT status, COUNT(*) as cnt FROM outbox_events GROUP BY status")
outbox_map = {r["status"]: r["cnt"] for r in outbox_data} if outbox_data else {}

evidence_count = run_query("SELECT COUNT(*) as cnt FROM immutable_evidence")
total_evidence = evidence_count[0]["cnt"] if evidence_count else 0

# Financial summary
fin_data = run_query("""
    SELECT
        COALESCE(SUM(CASE WHEN action IN ('CAPTURE', 'NO_ACTION') THEN amount ELSE 0 END), 0) as captured,
        COALESCE(SUM(CASE WHEN action = 'REFUND' THEN amount ELSE 0 END), 0) as refunded,
        COALESCE(SUM(CASE WHEN action = 'VOID' THEN amount ELSE 0 END), 0) as voided
    FROM immutable_evidence
""")
fin = fin_data[0] if fin_data else {"captured": 0, "refunded": 0, "voided": 0}

m1, m2, m3, m4, m5, m6 = st.columns(6)

with m1:
    st.markdown(f"""<div class="metric-card">
        <div class="metric-value">{total_intents}</div>
        <div class="metric-label">Total Intents</div>
    </div>""", unsafe_allow_html=True)
with m2:
    st.markdown(f"""<div class="metric-card">
        <div class="metric-value">{state_map.get('UNCERTAIN', 0)}</div>
        <div class="metric-label">⚠️ Uncertain</div>
    </div>""", unsafe_allow_html=True)
with m3:
    st.markdown(f"""<div class="metric-card">
        <div class="metric-value">{state_map.get('CAPTURED', 0)}</div>
        <div class="metric-label">✅ Captured</div>
    </div>""", unsafe_allow_html=True)
with m4:
    st.markdown(f"""<div class="metric-card">
        <div class="metric-value">{state_map.get('MANUAL_REVIEW', 0)}</div>
        <div class="metric-label">🔍 Review</div>
    </div>""", unsafe_allow_html=True)
with m5:
    st.markdown(f"""<div class="metric-card">
        <div class="metric-value">₹{fin.get('captured', 0):,.2f}</div>
        <div class="metric-label">💰 Captured</div>
    </div>""", unsafe_allow_html=True)
with m6:
    st.markdown(f"""<div class="metric-card">
        <div class="metric-value">{total_evidence}</div>
        <div class="metric-label">📜 Evidence</div>
    </div>""", unsafe_allow_html=True)


st.markdown("---")


# === SECTION B: Chaos Controls & Agent Squad ===
left_col, right_col = st.columns([1, 2])

with left_col:
    st.markdown("### ⚡ Chaos Engineering")
    st.caption("Inject fault scenarios to test the resolution pipeline")

    if st.button("🔥 Late Authorization", use_container_width=True, key="chaos_late"):
        result = api_post("/demo/chaos/late-auth")
        if "error" in result:
            st.error(f"❌ {result['error']}")
        else:
            st.success(f"✅ Injected! Intent: `{result.get('payment_intent_id', 'N/A')[:8]}...`")

    if st.button("🔄 Cross-Rail Duplicate", use_container_width=True, key="chaos_dup"):
        result = api_post("/demo/chaos/cross-rail")
        if "error" in result:
            st.error(f"❌ {result['error']}")
        else:
            st.success(f"✅ Injected! Intent: `{result.get('payment_intent_id', 'N/A')[:8]}...`")

    if st.button("📨 Out-of-Order Webhook", use_container_width=True, key="chaos_ooo"):
        result = api_post("/demo/chaos/out-of-order")
        if "error" in result:
            st.error(f"❌ {result['error']}")
        else:
            st.success(f"✅ Injected! Intent: `{result.get('payment_intent_id', 'N/A')[:8]}...`")

    if st.button("💳 Demo Payment", use_container_width=True, key="demo_pay"):
        result = api_post("/demo/payment")
        if "error" in result:
            st.error(f"❌ {result['error']}")
        else:
            st.success(f"✅ Created! Order: `{result.get('order_id', 'N/A')}`")

    st.markdown("---")
    st.markdown("### 🤖 AI Safety Mode")
    ai_mode = os.getenv("AI_MODE", "DETERMINISTIC")
    st.markdown(f"""<div class="metric-card" style="text-align: center;">
        <div class="metric-value" style="font-size: 1.2rem;">{'🟢' if ai_mode == 'DETERMINISTIC' else '🟡'} {ai_mode}</div>
        <div class="metric-label">AI Mode</div>
    </div>""", unsafe_allow_html=True)
    st.caption("DETERMINISTIC = Rule-based fallback (safe)")


with right_col:
    st.markdown("### 🤖 Agent Decision Squad")

    # Latest evidence for agent details
    latest = run_query("""
        SELECT agent_evidence, external_evidence, execution_result, decision, policy_reason,
               action, trace_id, created_at
        FROM immutable_evidence ORDER BY created_at DESC LIMIT 1
    """)

    agent_ev = {}
    ext_ev = {}
    exec_res = {}
    if latest:
        try:
            agent_ev = json.loads(latest[0].get("agent_evidence", "{}") or "{}")
        except (json.JSONDecodeError, TypeError):
            agent_ev = {}
        try:
            ext_ev = json.loads(latest[0].get("external_evidence", "{}") or "{}")
        except (json.JSONDecodeError, TypeError):
            ext_ev = {}
        try:
            exec_res = json.loads(latest[0].get("execution_result", "{}") or "{}")
        except (json.JSONDecodeError, TypeError):
            exec_res = {}

    a1, a2, a3 = st.columns(3)

    with a1:
        st.markdown(f"""<div class="agent-card agent-detective">
            <div class="agent-name">🔍 Detective</div>
            <div style="color: rgba(255,255,255,0.7); font-size: 0.85rem;">
                <b>Hypothesis:</b> {agent_ev.get('hypothesis', 'Awaiting...')}<br>
                <b>Confidence:</b> {agent_ev.get('confidence', '—')}<br>
                <b>Action:</b> {agent_ev.get('recommended_action', '—')}
            </div>
        </div>""", unsafe_allow_html=True)

    with a2:
        st.markdown(f"""<div class="agent-card agent-negotiator">
            <div class="agent-name">🤝 Negotiator</div>
            <div style="color: rgba(255,255,255,0.7); font-size: 0.85rem;">
                <b>Status:</b> {ext_ev.get('external_status', 'Awaiting...')}<br>
                <b>Rail:</b> {ext_ev.get('rail', '—')}<br>
                <b>TXN:</b> {str(ext_ev.get('external_transaction_id', '—'))[:12]}
            </div>
        </div>""", unsafe_allow_html=True)

    with a3:
        st.markdown(f"""<div class="agent-card agent-finops">
            <div class="agent-name">⚡ FinOps Executor</div>
            <div style="color: rgba(255,255,255,0.7); font-size: 0.85rem;">
                <b>Action:</b> {exec_res.get('action_taken', 'Awaiting...')}<br>
                <b>Status:</b> {exec_res.get('execution_status', '—')}<br>
                <b>Cmd:</b> {str(exec_res.get('command_id', '—'))[:12]}
            </div>
        </div>""", unsafe_allow_html=True)

    # === Policy Gate Visual ===
    st.markdown("### 🛡️ Policy Gate (5-Rule Check)")
    if latest:
        decision = latest[0].get("decision", "")
        reason = latest[0].get("policy_reason", "")
        is_approved = decision == "APPROVE"

        rules = [
            ("RULE 1 — STATE", "Intent in UNCERTAIN or DUPLICATE_SUSPECTED"),
            ("RULE 2 — VERIFIED EVIDENCE", "External status ≠ UNKNOWN"),
            ("RULE 3 — ECONOMIC IDENTITY", "Amount/Currency/Order match"),
            ("RULE 4 — DUPLICATE PROTECTION", "No existing capture"),
            ("RULE 5 — BOUNDED ACTION", "Action valid for state"),
        ]

        cols = st.columns(5)
        for i, (rule_name, rule_desc) in enumerate(rules):
            with cols[i]:
                if is_approved:
                    st.markdown(f"""<div style="text-align:center; padding: 8px;">
                        <span class="policy-pass">✓</span><br>
                        <span style="font-size:0.7rem; color: rgba(255,255,255,0.5);">{rule_name}</span>
                    </div>""", unsafe_allow_html=True)
                else:
                    # Show which rule failed
                    failed = reason.startswith(rule_name.split("—")[0].strip()) if reason else False
                    if f"RULE_{i+1}" in (reason or ""):
                        st.markdown(f"""<div style="text-align:center; padding: 8px;">
                            <span class="policy-fail">✗</span><br>
                            <span style="font-size:0.7rem; color: rgba(255,255,255,0.5);">{rule_name}</span>
                        </div>""", unsafe_allow_html=True)
                    else:
                        st.markdown(f"""<div style="text-align:center; padding: 8px;">
                            <span class="policy-pass">✓</span><br>
                            <span style="font-size:0.7rem; color: rgba(255,255,255,0.5);">{rule_name}</span>
                        </div>""", unsafe_allow_html=True)

        if is_approved:
            st.success(f"✅ APPROVED — {reason}")
        else:
            st.error(f"❌ REJECTED — {reason}")
    else:
        st.info("No policy decisions recorded yet.")


st.markdown("---")


# === SECTION C: Live Payment Intents ===
st.markdown("### 📦 Live Payment Intents")

def color_state(val):
    state_colors = {
        "UNCERTAIN": "background-color: rgba(255,165,0,0.25); font-weight: bold;",
        "CAPTURED": "background-color: rgba(46,213,115,0.25); font-weight: bold;",
        "MANUAL_REVIEW": "background-color: rgba(255,71,87,0.25); font-weight: bold;",
        "FAILED": "background-color: rgba(255,71,87,0.2); font-weight: bold;",
        "RECONCILED": "background-color: rgba(30,144,255,0.25); font-weight: bold;",
        "COMPENSATING": "background-color: rgba(236,204,104,0.25); font-weight: bold;",
        "DUPLICATE_SUSPECTED": "background-color: rgba(255,121,121,0.25); font-weight: bold;",
    }
    return state_colors.get(val, "")


intents_data = run_query("""
    SELECT payment_intent_id as "Intent ID",
           order_id as "Order",
           amount as "Amount",
           currency as "Currency",
           current_state as "State",
           active_rail as "Rail",
           resolution_status as "Resolution",
           updated_at as "Updated"
    FROM payment_intents ORDER BY updated_at DESC LIMIT 15
""")
intents_df = pd.DataFrame(intents_data)

if not intents_df.empty:
    styler = getattr(intents_df.style, "map", None) or getattr(intents_df.style, "applymap")
    styled = styler(color_state, subset=["State"])
    st.dataframe(styled, use_container_width=True, height=400)
else:
    st.info("No payment intents yet. Use the demo buttons above to create some!")


st.markdown("---")


# === SECTION D: Event Timeline ===
col_timeline, col_evidence = st.columns(2)

with col_timeline:
    st.markdown("### 📡 Event Timeline")
    events_data = run_query("""
        SELECT e.event_type, e.source, e.trace_id,
               e.received_at, p.order_id
        FROM payment_events e
        JOIN payment_intents p ON e.payment_intent_id = p.payment_intent_id
        ORDER BY e.received_at DESC LIMIT 10
    """)
    if events_data:
        for ev in events_data:
            st.markdown(f"""<div class="timeline-event">
                <span style="font-weight:600; color: #4facfe;">{ev.get('event_type', '')}</span>
                <span style="color: rgba(255,255,255,0.4); font-size: 0.8rem;"> | {ev.get('source', '')} | {ev.get('order_id', '')}</span><br>
                <span style="font-size: 0.75rem; color: rgba(255,255,255,0.3);">{ev.get('received_at', '')}</span>
            </div>""", unsafe_allow_html=True)
    else:
        st.info("No events recorded yet.")


# === SECTION E: Immutable Evidence ===
with col_evidence:
    st.markdown("### 📜 Financial-Action Evidence")
    evidence_data = run_query("""
        SELECT evidence_id as "ID",
               action as "Action",
               amount as "Amount",
               currency as "Cur",
               decision as "Decision",
               policy_reason as "Reason",
               trace_id as "Trace",
               created_at as "Time"
        FROM immutable_evidence ORDER BY created_at DESC LIMIT 10
    """)
    evidence_df = pd.DataFrame(evidence_data)
    if not evidence_df.empty:
        st.dataframe(evidence_df, use_container_width=True, height=350)
    else:
        st.info("No evidence recorded yet.")


st.markdown("---")


# === SECTION F: Financial Effects ===
st.markdown("### 💰 Financial Effects Summary")
f1, f2, f3, f4 = st.columns(4)

with f1:
    st.markdown(f"""<div class="metric-card">
        <div class="metric-value" style="color: #2ed573;">₹{Decimal(str(fin.get('captured', 0))):,.2f}</div>
        <div class="metric-label">Total Captured</div>
    </div>""", unsafe_allow_html=True)
with f2:
    st.markdown(f"""<div class="metric-card">
        <div class="metric-value" style="color: #ff6b6b;">₹{Decimal(str(fin.get('refunded', 0))):,.2f}</div>
        <div class="metric-label">Total Refunded</div>
    </div>""", unsafe_allow_html=True)
with f3:
    st.markdown(f"""<div class="metric-card">
        <div class="metric-value" style="color: #ffa502;">₹{Decimal(str(fin.get('voided', 0))):,.2f}</div>
        <div class="metric-label">Total Voided</div>
    </div>""", unsafe_allow_html=True)
with f4:
    net = Decimal(str(fin.get('captured', 0))) - Decimal(str(fin.get('refunded', 0)))
    st.markdown(f"""<div class="metric-card">
        <div class="metric-value">₹{net:,.2f}</div>
        <div class="metric-label">Net Effect</div>
    </div>""", unsafe_allow_html=True)


# === FOOTER ===
st.markdown("---")

outbox_summary = f"Pending: {outbox_map.get('PENDING', 0)} | Processing: {outbox_map.get('PROCESSING', 0)} | Done: {outbox_map.get('PROCESSED', 0)} | Failed: {outbox_map.get('FAILED', 0)}"

st.markdown(f"""
<div style="text-align: center; padding: 12px 0; color: rgba(255,255,255,0.3); font-size: 0.8rem;">
    🔒 System Guarantees: <code>decimal.Decimal</code> | Async | Immutable DB Triggers | 5-Rule Policy Gate | 3 AI Agents | Durable Outbox<br>
    📦 Outbox: {outbox_summary}
</div>
""", unsafe_allow_html=True)