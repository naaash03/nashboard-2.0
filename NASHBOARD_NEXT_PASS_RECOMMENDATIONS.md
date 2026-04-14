# NashBoard Next Pass Recommendations

Planning basis: repo root only, current on-disk state as of 2026-04-14.

## 1. Recommended next pass

### Pass 5A: NFL baseline parity + widget/library consolidation

Primary goal:
- Make NashBoard feel less skewed toward MLB by adding a small set of basic, trustworthy NFL widgets and cleaning up any confusing widget exposure/naming at the same time.

Why this should be next:
- MLB is already strong.
- NBA now has a credible baseline plus three experimental teaching widgets.
- NFL is the obvious weakest sport in product breadth.
- AI will not feel convincing until the app is more obviously multi-sport.

What this pass should include:
- Add 2-4 basic NFL widgets that are useful even in offseason windows.
- Prefer widgets that can be built mostly from current ESPN/shared provider capability.
- Consolidate any remaining confusing widget exposure, hidden-but-implemented widgets, or counterintuitive naming while the widget inventory is fresh.
- Keep the pass focused on product usefulness, not provider rewrites.

Best candidate widget types for this pass:
- NFL standings / division snapshot
- NFL team context / next-game card
- NFL recent form / team trajectory
- NFL matchup or schedule-context widget that remains honest during offseason windows

What should NOT be bundled into the same pass:
- AI widgets
- odds integration
- major BALLDONTLIE expansion
- account/public rollout work
- broad dashboard-shell redesign
- schema rewrites unrelated to the new NFL widgets

### Best tool mix
- ChatGPT: best for pass framing, widget-selection tradeoffs, and product-copy/spec decisions
- Claude plan mode / review: best for auditing current NFL capability, identifying duplicate/counterintuitive surfaces, and reviewing pass scope before code starts
- Codex implementation: best for the actual route/component/registry wiring and targeted validation

## 2. Backup pass option A

### Pass 5B: Live-data hardening for newly added APIs and widgets

Primary goal:
- Turn the newer NBA live-data work into something more trustworthy and less scaffold-dependent, and improve overall live-data diagnostics.

Why this is the first backup:
- The BALLDONTLIE pass is useful, but it is still partial.
- `nba_rest_schedule_spot` is close to product-real.
- `nba_team_matchup_profile` and `nba_player_role_form` still need richer live coverage and clearer health/diagnostic maturity.
- This pass would improve trust, but it does less for visible cross-sport parity than the recommended NFL pass.

What this pass should include:
- Improve BALLDONTLIE coverage where the current provider can support it cleanly
- Add BALLDONTLIE and MLB visibility into data-health reporting if worth the complexity
- Harden live-vs-demo truth labels
- Reduce scaffold dependence where a clean live path exists

What should NOT be bundled into the same pass:
- new AI widgets
- major NFL expansion
- The Odds API integration
- public rollout/auth-sharing work
- broad refactors of the hybrid shared provider layer

### Best tool mix
- ChatGPT: best for deciding which live enrichments are worth the cost/complexity
- Claude plan mode / review: best for verifying source limits, shaping an honest acceptance target, and reviewing fallback semantics
- Codex implementation: best for narrow provider/resolver/route work

## 3. Backup pass option B

### Pass 6A: First AI widget pass after parity baseline is acceptable

Primary goal:
- Add the first real AI-assisted widgets only after the app is strong enough without them.

Why this is the second backup:
- It is strategically important, but it should not be first.
- The app still benefits more from broader sport usefulness than from AI summarization.
- Cost discipline matters. AI should land on top of reliable upstream sports context, not replace it.

Good AI starting point:
- one or two optional, on-demand analysis widgets
- AI should explain or synthesize existing widget context rather than invent its own data layer
- AI should be user-triggered, not always-on

What should NOT be bundled into the same pass:
- a broad LLM-platform abstraction rewrite
- odds integration
- public/social features
- more than one provider path at once
- attempts to solve every sport with AI in the first pass

### Best tool mix
- ChatGPT: best for defining the AI product shape, prompt contract, and low-cost interaction model
- Claude plan mode / review: best for reviewing prompt scope, data contracts, and failure modes before coding
- Codex implementation: best for wiring the chosen AI route/widget once the contract is agreed

## 4. Why this order makes sense

Recommended order:
1. NFL baseline parity + widget/library consolidation
2. Live-data hardening for newer APIs/widgets
3. First AI widget pass

Reasoning:
- The app already has strong MLB depth and improving NBA credibility.
- NFL is the biggest visible parity gap.
- Cleaning up widget inventory and adding basic NFL breadth makes the product easier to understand before AI arrives.
- Once parity is better, hardening the newer live-data surfaces makes AI less likely to summarize shaky data.
- AI should come after the app is already obviously useful without it.

## 5. Extra roadmap notes

### Where live game support fits
- Live game support should continue as part of sport-specific passes, not as a giant platform pass.
- Improve the live experience where users already have widgets:
  - NFL slate
  - watchlist team/player context
  - NBA schedule/context widgets

### Where predictive / odds-aware widgets fit
- Odds-aware work should come after:
  - stronger NFL parity
  - better live-data trust
- The Odds API should not be added just to say the app has odds; it should power a small number of clear, useful widgets.

### Where account/public rollout fits
- Not yet.
- The app still needs more product convergence before public-facing expansion becomes the best use of time.
