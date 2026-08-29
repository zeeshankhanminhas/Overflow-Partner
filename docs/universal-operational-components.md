# Universal Operational Components

Mission Control V2 introduced a reusable operating layer. This document defines how it is used across the workspace without forcing every screen into the same layout.

## Universal components

- `OperatingState` — current state, owner, reason and next action.
- `NextActionRail` — focused action context for record-level work.
- `SignalStrip` — compact operating signals and management summaries.
- `WorkQueue` — action-oriented queues where rows represent work that can move.
- `WaitingOnPanel` — ownership split between internal, Delivery Partner and client.

## Adoption rules

1. Object/detail pages consume `OperatingState` and `NextActionRail` through `RecordWorkspace`.
2. Register pages keep tables when comparison density matters; their summary layer uses the universal signal treatment through `ProductMetrics` compatibility.
3. Action queues such as Opportunities, Approvals and Issues use `WorkQueue` directly.
4. Documents remain a register because revision comparison is the primary job; universal signals apply above the register.
5. The components do not create new workflow state, duplicate approvals, or replace source-record actions.
6. Admin and configuration pages are not forced into an operational queue pattern unless they represent actionable work.
