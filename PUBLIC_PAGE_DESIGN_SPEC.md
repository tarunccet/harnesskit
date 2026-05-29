# HarnessKit Public Page Design Spec

## Goal

Create a developer-first landing page for HarnessKit: a self-hosted runtime layer that makes AI agents safer to run in production.

## Audience

Senior engineers, infra teams, and AI platform builders who already write agent code and need state persistence, context control, and hard safety limits without adopting a no-code workflow.

## Page structure

1. Hero
   - Headline: "The runtime safety layer for production AI agents."
   - Subheadline: "Add durable state, context compaction, and financial guardrails to any TypeScript agent loop."
   - Primary CTA: "View on GitHub"
   - Secondary CTA: "Read the docs"
2. Problem
   - Agents lose state, overrun context windows, and can loop into unexpected API costs.
   - Show three compact cards: "State loss", "Context bloat", "Runaway spend".
3. Product
   - Diagram: App code -> HarnessKit Runtime -> LLM API.
   - Emphasize that developers keep their own framework and wrap execution with HarnessKit.
4. Core capabilities
   - Durable execution state
   - Adaptive context compaction
   - Inline guardrails
   - Redis-backed production storage
5. Code preview
   - Show a short TypeScript snippet creating a `HarnessKitRuntime` session and calling `runLoop`.
6. Open-core trust
   - FOSS core, self-hosted by default, cloud-ready architecture later.
   - Mention clean hooks for audit logs, telemetry, and governance.
7. Final CTA
   - "Ship safer agents without rewriting your stack."

## Visual direction

- Style: modern infrastructure SaaS, closer to Vercel/Railway than a no-code builder.
- Palette: dark navy background, electric blue accents, white code cards, subtle green success states.
- Typography: bold technical headings, readable monospace snippets.
- Components: hero split layout, capability cards, architecture diagram, terminal/code panel, CTA band.
- Motion: subtle line animation from app code through HarnessKit to LLM API; avoid heavy effects.

## Copy tone

Direct, technical, and credible. Avoid hype words like "magical" or "autonomous workforce." Use concrete infrastructure language: runtime, state, guardrails, Redis, config, telemetry.
