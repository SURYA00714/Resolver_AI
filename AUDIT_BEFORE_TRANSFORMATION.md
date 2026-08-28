# AUDIT BEFORE TRANSFORMATION — RESOLVERAI FORENSIC SYSTEM AUDIT

This document records the original state of the codebase prior to the production transformation.

---

## 1. Executive Verdict
ResolverAI is a **HYBRID** system. It possesses a genuinely robust, production-grade distributed systems backend (transactional outbox, PostgreSQL immutability, HMAC webhook verification, Redis idempotency) coupled with a completely **SIMULATED** AI layer. The "Agents" are currently deterministic Python functions masquerading as AI. The UI feels like a simulation because it heavily emphasizes synthetic fault injection (Chaos Lab) and "Demo Payments" rather than acting as a passive observer of a real merchant checkout flow. Architecturally, it is an excellent foundation for a Payment Integrity platform, but it is currently positioned more as an interactive technical demo than a ready-to-deploy SaaS.

## 2. Repository Inventory
- **app.py**: FastAPI application entry point. Registers routes and CORS. (Real, Production-Ready base).
- **api/webhook_receiver.py**: Handles Razorpay webhooks. Implements secure HMAC-SHA256 verification and outbox enqueuing. (Real, High Security, Production-Ready).
- **worker.py**: Background worker polling `outbox_events` using `FOR UPDATE SKIP LOCKED`. (Real, Production-Ready).
- **core/resolver.py**: The central orchestration pipeline linking the state machine, agents, policy engine, and finops. (Real execution, but relies on simulated AI).
- **core/state_machine.py**: 15-state deterministic state machine. (Real).
- **core/policy_engine.py**: The 5-rule safety gate. (Real, strictly enforced).
- **agents/detective.py**: "AI" agent. (SIMULATED - uses hardcoded deterministic rules, LLM is just a stub returning `None`).
- **agents/negotiator.py**: Evidence gatherer. (Hybrid - can hit real Razorpay API or local Chaos simulator).
- **agents/finops_executor.py**: Financial mutator. (Hybrid - executes real Razorpay capture/refunds or synthetic ones).
- **chaos_lab/simulator.py**: Local synthetic payment rail. (SIMULATION ONLY).
- **frontend/src/app/page.js**: Next.js dashboard. (Real data, but includes simulation triggers like "New Demo Payment").
- **schema.sql**: PostgreSQL schema with immutability triggers. (Real, High Quality).

## 3. Scorecard (Before Transformation)
- **Real-world usefulness**: 9/10
- **Real Razorpay integration**: 8/10
- **Reliability/Safety**: 10/10
- **Security**: 7/10
- **AI implementation**: 0/10
- **TOTAL**: **6.8/10** (Pulled down by lack of real AI and demo buttons)

---
*Created during forensic audit step on 2026-08-28.*
