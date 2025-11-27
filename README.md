# Schema Evolution Impact Analyzer  
[![Live Demo](https://img.shields.io/badge/Live%20Demo-000?style=for-the-badge)](https://rtfenter.github.io/Schema-Evolution-Impact-Analyzer/)

### An interactive dependency map that visualizes how a schema v2 impacts downstream services — highlighting where breaking changes occur and which teams need to coordinate.

This project is part of my **Systems of Trust Series**, exploring how distributed systems maintain coherence, truth, and alignment across services, schemas, and teams.

The goal of this analyzer is to make **schema evolution impact** legible — not just what changes in v2, but **who those changes break** across the dependency graph of producers, consumers, pipelines, warehouses, and APIs.

---

## Purpose

Schemas don’t break systems on their own.  
They break **relationships** — the implicit dependencies between producers and consumers.

When a new version ships:

- fields are removed or repurposed  
- enums expand or tighten  
- types are corrected  
- invariants change  
- event shapes evolve  

Each downstream consumer interprets these changes differently, often silently.  
The failure is rarely at the producer — it’s at the edge where assumptions diverge.

This analyzer exposes:

- which consumers rely on the changed fields  
- how they use those fields  
- what breaks when v2 arrives  
- and where coordination is required before release  

It turns schema evolution from a guessing game into a clear, visual impact map.

---

## Features (MVP)

This prototype includes:

- **Schema Change Summary Viewer (Diff)** – shows what changed between v1 and v2 (added, removed, repurposed fields)  
- **Consumer Dependency Map** – interactive graph of all downstream services and how they consume affected fields  
- **Field Usage Matrix** – for each service, display whether a field is read, required, transformed, validated, or ignored  
- **Breaking Change Detector** – flags type changes, removed fields, enum tightening, and invariant shifts  
- **Risk Summary Badge** – rough Low / Medium / High based on downstream dependency severity  
- **Upgrade Coordination View** – list of teams that must align before v2 is safe to ship  
- **Lightweight client-side experience** – static HTML + JS, no backend required  

This tool is intentionally minimal and aimed at conceptual clarity — not replacing a full schema registry or data catalog.

---

## Demo Screenshot
<img width="2804" height="2184" alt="Screenshot 2025-11-24 at 08-47-36 Schema Evolution Impact Analyzer" src="https://github.com/user-attachments/assets/25ca3f40-67f5-4248-90b5-9cbadca42625" />

---

## Evolution Impact Flow Diagram

```
    Schema v1 (canonical)
           |
    [Diff Engine]
           |
    Schema v2 (proposed)
           |
           v
    Impact Analyzer
           |
           v
    Downstream Services
    - Service A: validates removed field
    - Service B: relies on enum values tightened in v2
    - Service C: transforms field type changed in v2
           |
           v
    Pipelines / Warehouses / APIs
    (breakage propagates through joins,
     transformations, and reporting)
```

The analyzer maps **what changed** → **who it breaks** → **what needs coordination**.

---

## Why Schema Evolution Impact Matters

Even well-managed schemas drift over time:

- old fields become overloaded with new meaning  
- new fields are added with unclear purpose  
- enums expand inconsistently across services  
- “optional” fields are required by downstream logic  
- version adoption happens at different speeds  

When v2 arrives, the impact is rarely obvious:

- warehouses drop rows because a required field is gone  
- pipelines mis-parse types, producing silent nulls  
- dashboards break due to tightened enums  
- APIs return different shapes than the SDK expects  
- contract tests pass, but invariants are violated  

The core problem isn’t the schema — it’s the **invisible dependency graph**.

This analyzer surfaces those dependencies before v2 lands in production.

---

## How This Maps to Real Systems

Each component corresponds to a real architectural constraint:

### Schema Diff (Structural Change)
Shows exactly what changed:

- added fields  
- removed fields  
- renamed or repurposed fields  
- type changes  
- enum expansions / tightenings  

These diffs form the foundation of breakage detection.

### Field Usage Matrix (Behavioral Consumption)
Each downstream service is analyzed for:

- reads (non-breaking if field still exists)  
- required reads (breaking if field removed)  
- validations (breaking if type or invariant changes)  
- transformations (breaking if semantic meaning shifts)  
- joins (breaking if required join keys change)  

This is where silent breakage becomes visible.

### Dependency Map (Topological Impact)
A visual graph showing:

- upstream → midstream → downstream services  
- pipelines and warehouses that fan-out usage  
- external APIs and integrations affected indirectly  

The map highlights how one change propagates through the system.

### Upgrade Coordination
Breakage often depends on **people**, not code:

- teams operating on different release cadences  
- consumers unaware of producer changes  
- pipelines owned by different groups  
- analytics teams running legacy logic  

The analyzer identifies where coordination is required.

---

## Part of the Systems of Trust Series

Main repo:  
https://github.com/rtfenter/Systems-of-Trust-Series

---

## Status

MVP is implemented and active.  
This prototype will focus on **structural and behavioral change detection**, providing a clear impact graph for v1 → v2 changes without becoming a full enterprise schema registry.

---
## Local Use

Everything runs client-side.

To run locally (once the prototype is implemented):

1. Clone the repo  
2. Open `index.html` in your browser  

That’s it — static HTML + JS, no backend required.
