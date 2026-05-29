# HarnessKit - Strategic Vision & Product Architecture

## 🎯 1. High-Level Product Vision
HarnessKit is a developer-native, open-source infrastructure platform built to run, govern, and protect autonomous AI agents. 

Our core positioning is **"The Vercel for Agents."** We explicitly reject the "No-Code / Drag-and-Drop" paradigm. We believe professional software engineers want to write raw code (TypeScript/Python) in their IDEs, but they urgently need a managed, standardized utility layer to handle the chaotic, state-heavy infrastructure required to run agents safely in production.

---

## 🛠️ 2. Short-Term Execution Plan (The Bootstrap Phase)

### Focus: Frictionless Developer Adoption
*   **The FOSS Core:** The initial engine must be 100% Free and Open-Source Software (MIT/Apache 2.0).
*   **Zero Infrastructure Dependencies:** Developers must be able to run HarnessKit locally with zero friction using an in-memory database or a local Docker instance.
*   **The Framework vs. Runtime Edge:** We are not competing with logic frameworks (LangChain, CrewAI). HarnessKit is a runtime. Developers write their agent logic in whatever framework they want, but wrap it in the HarnessKit SDK to gain **State Persistence**, **Context Window Compaction**, and **Inline Safety Airbags** automatically.

### Code Constraint for the Agent:
*   Keep the core engine completely decoupled from specific database vendors. 
*   Use strict interface abstractions (e.g., `IStateStore`) so that changing from a local memory array to an enterprise database is a one-line configuration change.

---

## 💰 3. Long-Term Strategy & Monetization Mechanics

Our monetization strategy uses an **Open-Core and Managed Cloud Runtime** model. The software logic remains completely free, but infrastructure operations, enterprise compliance, and transactional features cost money.

MONETIZATION CAPTURE MECHANICS┌──────────────────────────────────────────┐│ HARNESSKIT CLOUD (SaaS Tier)             │ -> Paid Layers│ • 1-Click Server & DB Provisioning       ││ • Token Arbitrage & Edge Caching         ││ • Governance, Audits, & Compliance Logs  │├──────────────────────────────────────────┤│ OPEN-SOURCE CORE ENGINE                  │ -> Free Tier│ • Local SDK (Typescript/Python)          ││ • Config-Driven Optimization Loops       │└──────────────────────────────────────────┘


### Future Paid Upgrades to Architectural Architecture:
1.  **HarnessKit Cloud (Convenience & Velocity):** Enterprises can deploy the open-source version on their own AWS clusters. However, we will sell a managed, 1-click cloud platform where we handle scaling, security patching, and global availability.
2.  **Token Arbitrage Layer:** Future versions of our hosted platform will intelligently cache repetitive system prompts and corporate context payloads at the network edge, allowing companies to save 30%+ on external OpenAI/Anthropic bills. 
3.  **The Governance & Audit Console:** We will offer a closed-source visual interface designed for enterprise compliance managers to track exactly which bot executed what action, providing immutable logs for legal teams.

---

## 🧠 4. Architectural Rules for the Coding Agent

When writing code for the open-source engine today, you must explicitly respect our long-term monetization path:

*   **Design for Multi-Tenancy:** Ensure that all session data and state keys include a `userId` or `tenantId` space. Even though the local MVP is single-user, the underlying database keys must be ready for multi-tenant cloud segregation.
*   **Clean Event Hooks:** Build clean asynchronous event hooks into the execution loop (e.g., `onStepStart`, `onStepComplete`, `onLimitBreached`). This ensures we can easily attach our premium cloud audit logging tools to the core open-source engine later without modifying your foundational code.
*   **Lightweight Telemetry Metrics:** Track basic usage telemetry variables internally (e.g., token usage totals, total loop iterations per session) so the system can instantly pass these metrics to billing gateways like Stripe in our future enterprise tier.