# RESOLVERAI — AI REALITY REPORT

## 1. Provider Classification & Reality Matrix

| Agent | Module | Configured Mode | Actual Execution Mechanism | Real LLM active? |
| :--- | :--- | :--- | :--- | :--- |
| **Detective Agent** | `agents/detective.py` | `DETERMINISTIC` | Rule-based state tree | ❌ No (Fallback active) |
| **Evidence Agent** | `agents/evidence_agent.py` | `DETERMINISTIC` | JSON structure builder | ❌ No (Fallback active) |
| **Negotiator Agent**| `agents/negotiator.py` | `DETERMINISTIC` | Risk metric calculator | ❌ No (Fallback active) |
| **FinOps Executor** | `agents/finops_executor.py` | `DETERMINISTIC` | Policy enforcement engine | ❌ No (Fallback active) |

## 2. LLM Provider Infrastructure
- **File:** `agents/ai_providers.py`
- **Supported Providers:** Gemini (`google-generativeai`), Groq (`groq`), Deterministic (`DeterministicProvider`).
- **Active Provider:** `DeterministicProvider` (because `GEMINI_API_KEY` and `GROQ_API_KEY` are not set).

## 3. Executive Assessment
**No LLM reasoning is currently participating in runtime decisions.** The system operates on a deterministic, rule-based decision engine. This guarantees 100% predictable, safe outcomes without latency overhead or LLM hallucination risks during payment resolution.
