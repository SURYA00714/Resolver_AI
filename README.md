ResolverAI

AI-Powered Payment State Resolution & Integrity Platform for Razorpay

ResolverAI is a merchant-side payment control plane designed to
answer one critical question: "What actually happened to this
payment?" --- even when payment systems, webhooks, networks, and
clients disagree.

ResolverAI was built for the Razorpay AI Buildathon with a simple
philosophy:

AI should not be allowed to guess financial truth. AI should
investigate evidence, while deterministic systems protect money and
state.

🏆 The Idea in One Minute

Modern payment systems are extremely reliable under normal conditions.

The difficult cases happen after the payment has already started:

The customer pays, but the browser disconnects.

Razorpay completes a transaction, but the merchant does not
immediately receive the result.

A webhook arrives late.

The same webhook arrives twice.

A client retries the same verification request.

The payment appears PENDING, FAILED, or UNKNOWN from one
perspective while another system says something different.

An operator needs to understand why a payment is stuck without
manually reconstructing the entire timeline.

ResolverAI sits above the payment rail and turns these ambiguous
situations into an auditable resolution workflow.

                    RAZORPAY
                       │
          ┌────────────┴────────────┐
          │                         │
     Checkout / API             Webhooks
          │                         │
          └────────────┬────────────┘
                       ▼
                ┌───────────────┐
                │  ResolverAI   │
                │ Payment       │
                │ Control Plane │
                └───────┬───────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     State Engine    Evidence      AI Detective
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                  Policy Engine
                        │
                 ┌──────┴──────┐
                 ▼             ▼
             AUTOMATE       ESCALATE
                 │             │
                 ▼             ▼
             Resolution    Human Review

🎯 Problem We Chose

The hardest payment failure is not simply:

"Payment failed."

It is:

"The systems disagree about the payment state."

We call this the Asynchronous Post-Intent Disconnect.

A merchant may have:

Customer → Checkout → Payment Rail → Razorpay
                         │
                         └── network disconnect
                                  │
                                  ▼
                         Merchant doesn't know
                         the final outcome

This creates dangerous ambiguity.

A naive system may retry.

A naive system may mark the payment failed.

A naive AI system may make a guess.

ResolverAI takes a different approach:

First establish financial truth. Then establish state consistency.
Then decide what can safely be automated. AI comes after evidence, not
before it.

🧠 Our Core Design Philosophy

ResolverAI follows this priority order:

FINANCIAL CORRECTNESS
        ↓
STATE CONSISTENCY
        ↓
IDEMPOTENCY
        ↓
RECOVERABILITY
        ↓
AUDITABILITY
        ↓
AVAILABILITY
        ↓
LATENCY
        ↓
AI INTELLIGENCE

This ordering is intentional.

In a financial system, a highly intelligent system that makes an unsafe
decision is worse than a conservative deterministic system.

Our rule:

AI recommends. Policy decides. Deterministic state transitions
protect the system.

🏗️ Architecture

High-Level Components

                         ┌──────────────────────┐
                         │      Razorpay        │
                         │ API + Checkout +     │
                         │ Webhook Infrastructure│
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
             Order / Checkout                 Webhook Receiver
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                           ┌─────────────────┐
                           │ Payment Intent  │
                           │ Registry        │
                           └────────┬────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   ▼                ▼                ▼
             State Machine      Evidence       Audit Trail
                   │                │                │
                   └────────────────┼────────────────┘
                                    ▼
                              Outbox Pattern
                                    │
                                    ▼
                            Resolution Worker
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                   AI Detective          Policy Engine
                         │                     │
                         └──────────┬──────────┘
                                    ▼
                            Resolution Decision
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                Resolve          Retry           Human Review

🤖 AI: Where Intelligence Actually Matters

We deliberately did not make AI responsible for directly changing
payment state.

Instead, ResolverAI uses AI as an investigative layer.

AI Detective

The AI Detective receives evidence such as:

Payment state history

Razorpay identifiers

Webhook events

Verification results

Timing information

Failure metadata

Previous resolution attempts

Available system evidence

It then forms a hypothesis such as:

USER_DECLINED
BANK_SERVER_ERROR
NETWORK_TIMEOUT
WEBHOOK_DELAY
DUPLICATE_EVENT
STATE_MISMATCH
UNKNOWN

and produces a confidence-backed explanation.

Example:

Payment appears unsuccessful.

Hypothesis:
BANK_SERVER_ERROR

Confidence:
0.91

Evidence:
- Checkout failure reported
- Razorpay failure metadata present
- No successful capture evidence
- No conflicting capture event observed

Recommendation:
Do not retry automatically.
Allow bounded retry or escalate according to policy.

The important part is that the AI output is not trusted blindly.

🛡️ Policy Engine

The Policy Engine is the safety boundary between intelligence and
financial action.

It asks:

Is the evidence sufficient?
        │
        ├── YES → Is the action allowed?
        │              │
        │              ├── YES → Execute bounded action
        │              └── NO  → Human review
        │
        └── NO → Preserve state / investigate

This prevents an AI model from deciding:

"Looks like the payment probably failed, let's charge the customer
again."

Instead:

Uncertainty produces caution, not financial autonomy.

🔐 Security Architecture

Financial correctness requires security at every boundary.

1. Razorpay Webhook HMAC Verification

ResolverAI:

Reads the raw request body.

Computes HMAC-SHA256 using the configured webhook secret.

Compares signatures using constant-time comparison.

Rejects invalid signatures with 401 Unauthorized.

Performs no state mutation on invalid signatures.

Razorpay Webhook
      │
      ▼
Raw Request Body
      │
      ▼
HMAC-SHA256
      │
      ▼
compare_digest()
      │
   ┌──┴──┐
   │     │
 VALID  INVALID
   │     │
   ▼     ▼
Process 401

2. Server-Trusted Order Identity

Checkout verification does not blindly trust the order ID supplied by
the browser.

ResolverAI first resolves the payment intent from its own database and
retrieves the server-trusted Razorpay order ID.

Only then is the checkout signature verified.

This prevents the client from becoming the authority for payment
identity.

3. Invalid Signature State Preservation

An invalid signature must not accidentally mutate payment state.

ResolverAI guarantees:

Invalid signature
      ↓
401 Unauthorized
      ↓
NO state mutation
NO outbox task
NO fake authorization

4. Idempotency

Payment systems naturally produce retries and duplicate deliveries.

ResolverAI handles repeated verification and webhook delivery without
blindly creating duplicate work.

Example:

First verification
     ↓
AUTHORIZED
     ↓
Outbox task created

Same verification again
     ↓
Already authorized
     ↓
200 OK
idempotent = true
     ↓
No duplicate outbox task

🔄 Payment State Machine

ResolverAI uses explicit state transitions instead of arbitrary database
updates.

A simplified lifecycle:

CREATED
   │
   ▼
PENDING_RAIL
   │
   ├──────────────► FAILED
   │
   ▼
AUTHORIZED
   │
   ▼
CAPTURED
   │
   ▼
RECONCILED

Uncertain situations can be routed toward:

UNCERTAIN
   ↓
VERIFYING
   ↓
RECONCILED
      OR
MANUAL_REVIEW

The state machine makes invalid transitions visible and testable.

📦 Three Sources of Truth

ResolverAI was designed around three complementary forms of truth:

1. Payment Truth

What happened at the payment provider / payment rail?

2. State Truth

What does ResolverAI believe the payment state is, according to
deterministic transition rules?

3. Evidence Truth

What evidence proves why the state became what it is?

This distinction is important because:

A database row saying CAPTURED is not enough. We want to know why
it is CAPTURED.

🧾 Evidence & Auditability

Every important action should be reconstructable.

ResolverAI maintains evidence around:

Payment intent

Razorpay order ID

Razorpay payment ID

Webhook event

Signature verification

State transition

Resolution task

Audit event

Provenance

The UI explicitly distinguishes sources such as:

REAL RAZORPAY API
REAL RAZORPAY WEBHOOK
POLICY ENGINE
AI DETECTIVE
INTERNAL REPLAY
⚠ LOCAL SIMULATION

This prevents demo data and real provider data from being visually
confused.

🔁 Outbox Pattern

A critical design decision was separating state mutation from
asynchronous resolution work.

Instead of:

Webhook
  ↓
Change DB
  ↓
Hope worker receives it

ResolverAI records durable work:

Verified Event
     ↓
Database State Change
     ↓
Outbox Task
     ↓
Worker
     ↓
Resolution Engine

This makes asynchronous processing recoverable and auditable.

🌐 Real Razorpay Integration

ResolverAI is not a mocked payment screen.

The project integrates with Razorpay's actual TEST environment.

The demonstrated flow is:

ResolverAI
   │
   ├── POST /orders
   │
   ▼
Razorpay Order
   │
   ▼
Razorpay Checkout
   │
   ├── SUCCESS
   │      ↓
   │   Signature verification
   │      ↓
   │   AUTHORIZED
   │
   └── FAILURE
          ↓
       Failure evidence
          ↓
         FAILED

The project also exposes:

POST /webhook/razorpay

for signed Razorpay webhook ingestion.

🧪 Failure Handling

Scenario A --- Successful Payment

Create Order
     ↓
Razorpay Checkout
     ↓
Successful payment
     ↓
Checkout signature verification
     ↓
AUTHORIZED
     ↓
Webhook / capture evidence
     ↓
CAPTURED / RECONCILED

Scenario B --- Customer / Bank Failure

Checkout
   ↓
payment.failed
   ↓
Resolve Razorpay Order ID
   ↓
Match existing Payment Intent
   ↓
FAILED
   ↓
Audit + Evidence
   ↓
Outbox
   ↓
Policy Evaluation

Scenario C --- Invalid Webhook

Webhook
   ↓
Invalid HMAC
   ↓
401 Unauthorized
   ↓
No state mutation
No outbox task

Scenario D --- Duplicate Webhook

Webhook #1 → Process
Webhook #2 → Detect duplicate
             ↓
          Ignore safely

Scenario E --- Browser / Network Disconnect

Customer completes payment
        ↓
Browser loses connection
        ↓
Merchant UI has incomplete information
        ↓
Razorpay webhook remains authoritative evidence
        ↓
ResolverAI reconciles the intent

🖥️ Command Center

ResolverAI includes an operator-focused interface rather than only an
API.

Dashboard

Provides system-level visibility into payment and resolution activity.

Payments Registry

A searchable registry containing:

Payment Intent ID

Payment state

Razorpay order ID

Razorpay payment ID

Amount

Provenance

Last updated timestamp

Payment Detail / Investigation Center

Designed for forensic investigation of an individual payment.

Webhook History

Provides visibility into webhook ingestion and diagnostic information.

Audit Trail

Makes important system actions reconstructable.

Reconciliation Cases

Provides a workspace for ambiguous or exceptional payments.

Integration Health

Shows subsystem readiness and integration status.

Engineering / Chaos Lab

Allows controlled local simulations of failure conditions without
confusing them with real Razorpay events.

🧑‍💻 Technology Stack

Backend

Python

FastAPI

PostgreSQL

Redis

HMAC-SHA256

Background Worker

Outbox Pattern

Frontend

Next.js 14

React

JavaScript

CSS / custom design system

Recharts

Payment Integration

Razorpay Orders API

Razorpay Checkout

Razorpay Webhooks

Razorpay TEST environment

AI / Resolution

AI Detective

Policy Engine

Deterministic State Machine

Resolution Worker

📊 Verification & Engineering Results

ResolverAI was repeatedly validated during development.

Backend

Python Unit / Contract Tests
101 / 101 PASSED

Compilation

python3 -m compileall .
SUCCESS
0 syntax errors

Frontend

next build
SUCCESS

12 / 12 routes generated

Security Tests

Validated scenarios include:

✓ Invalid webhook signature rejected
✓ Invalid checkout signature rejected
✓ Invalid signature does not mutate payment state
✓ Duplicate verification is idempotent
✓ Duplicate webhook delivery is handled safely
✓ Server-trusted Razorpay order ID resolution
✓ CORS preflight handling

Live Integration Checks

Validated during the build:

✓ Render deployment reachable
✓ /health endpoint
✓ /openapi.json
✓ Razorpay order creation
✓ Razorpay Checkout initialization
✓ Bearer-authenticated order retrieval
✓ Razorpay webhook endpoint
✓ HMAC signature validation

🧪 Testing Philosophy

We did not stop at:

"The UI looks good."

The project was tested at multiple layers.

                 ┌─────────────────┐
                 │     UI Build     │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │ API Contracts    │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │ Unit Tests       │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │ Security Tests   │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │ Live Integration │
                 └─────────────────┘

The goal was to prove that the system behaves correctly when things go
wrong, not just when everything works.

🚀 Quick Start

Backend

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

Configure environment variables for the local deployment, including the
required database, Redis, authentication, and Razorpay TEST
credentials/secrets.

Start the API according to the project's deployment configuration.

Frontend

cd frontend
npm install
npm run dev

Production build:

npm run build

🔬 Useful Verification Commands

Run the complete Python test suite:

python3 -m unittest discover tests

Compile the backend:

python3 -m compileall .

Build the frontend:

cd frontend
npm run build

Inspect the API contract:

GET /openapi.json

Health check:

GET /health

Razorpay webhook:

POST /webhook/razorpay

🎬 Suggested Buildathon Demo

A strong demonstration can be completed in a few minutes.

1. Show the Architecture

Explain:

"ResolverAI is not replacing Razorpay. It is the merchant-side control
plane that resolves payment ambiguity above the payment rail."

2. Create a Real TEST Order

Use:

Create Order & Pay

Show that the order is created through the backend.

3. Complete a Razorpay TEST Payment

Show the Razorpay Checkout experience.

4. Show Verification

Demonstrate that the successful payment moves through:

CREATED
→ AUTHORIZED
→ CAPTURED / RECONCILED

5. Demonstrate Failure

Create another TEST order and trigger a payment failure.

Show:

payment.failed
→ matching Razorpay order
→ FAILED
→ evidence
→ audit
→ resolution workflow

6. Demonstrate Security

Send an invalid signature.

Show:

401 Unauthorized

and explain:

"The important part is not just rejecting the request. The payment
state remains untouched."

7. Demonstrate Idempotency

Repeat verification.

Show:

{
  "idempotent": true
}

Then explain:

"Retries don't become duplicate financial actions."

💡 Why This Is More Than a Payment Dashboard

A normal dashboard answers:

"What is the payment status?"

ResolverAI tries to answer:

"What is the payment status, what evidence proves it, why did it
reach that state, what should happen next, and is it safe to automate
that action?"

That is the difference between observability and resolution
intelligence.

🧠 Engineering Decisions We Are Proud Of

We chose deterministic state over AI guesses.

Because financial state must be predictable.

We made evidence first-class.

Because a payment decision without evidence is difficult to audit.

We designed for duplicate events.

Because distributed systems retry.

We designed for delayed information.

Because asynchronous payment systems cannot assume perfect ordering.

We separated intelligence from authority.

Because AI should investigate financial events, not silently become the
financial ledger.

We tested failure paths.

Because happy-path demos are easy.

The difficult engineering is proving what happens when the system
disagrees with itself.

⚠️ Scope & Honest Limitations

ResolverAI is a buildathon / prototype implementation, not a
production payment processor or a replacement for Razorpay's
infrastructure.

The project intentionally operates within the Razorpay TEST environment
for demonstration and validation.

Some advanced production concerns would require additional engineering
before handling real merchant funds at scale, including:

Production-grade secret and key management

High-availability deployment

Distributed worker coordination at scale

Formal disaster recovery

Comprehensive observability and alerting

Production-grade model governance

Extensive load and chaos testing

Formal security review / penetration testing

Merchant-specific policy configuration

Expanded reconciliation with downstream banking and settlement
systems

Being explicit about these boundaries is part of the design philosophy:

A trustworthy financial system should clearly distinguish what it
knows, what it infers, and what it has not yet verified.

🔮 What ResolverAI Could Become

The buildathon prototype can evolve into a broader Payment Resolution
Infrastructure Layer.

Potential future capabilities:

Multi-provider payment resolution
        ↓
Cross-rail reconciliation
        ↓
Real-time anomaly detection
        ↓
Merchant-specific policy learning
        ↓
Adaptive retry optimization
        ↓
Settlement intelligence
        ↓
Fleet-wide payment incident intelligence

The long-term vision is not simply:

"Use AI to process payments."

It is:

"Use AI to make payment infrastructure explainable, recoverable, and
safer under uncertainty."

🏁 Final Statement

ResolverAI started with a simple observation:

Payments are easy when everything works. The real engineering
challenge begins when systems disagree.

We built ResolverAI to attack that exact problem.

We combined:

Real Razorpay TEST integration

Secure webhook verification

Server-trusted payment identity

Deterministic state machines

Idempotent processing

Durable outbox processing

Evidence-driven reconciliation

AI-assisted investigation

Policy-based financial guardrails

Operator-focused observability

Security and failure-path testing

The result is not an AI that blindly makes payment decisions.

It is something we believe is more useful:

An AI-assisted payment resolution system that knows when to investigate, when to automate, and when to stop and ask a human.

ResolverAI --- Resolve the payment. Preserve the truth.

👥 Built for the Razorpay AI Buildathon

Project: ResolverAI
Category: AI + FinTech + Payment Infrastructure
Integration: Razorpay TEST APIs, Checkout & Webhooks
Focus: Payment State Resolution, Reconciliation, Security &
AI-Assisted Decision Support

📌 Project Structure

Resolver_AI/
├── api/
│   ├── orders_routes.py
│   ├── webhook_receiver.py
│   └── ...
├── core/
│   ├── state_machine.py
│   ├── resolver.py
│   └── ...
├── razorpay/
│   └── webhooks.py
├── tests/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── package.json
├── worker.py
├── app.py
└── README.md

⭐ The One-Line Pitch

ResolverAI is an AI-assisted payment control plane that reconciles
uncertain Razorpay payment states using verified evidence,
deterministic safety rules, idempotent processing, and explainable
resolution intelligence.
