# Change impact: review the proxy-owner proposal before implementation

[中文](change-impact.md) · [Case index](README.en.md) · [Diagnosis and strategy](engineering-judgment.en.md)

## Current gate

A real Copilot call generated a complete impact proposal, its citations and
semantics were reviewed, and the isolated baseline passed **15/15**.
**Explicit operator approval is pending. No implementation call, approval
receipt, application change or 35-check impact-oracle result exists.**

[Proposal review](https://github.com/huangyingting/ai-native-sdlc-demo/issues/30)
is the durable English record. Creating that Issue does not approve the proposal.
The baseline [engineering application](../../demos/engineering-lab/README.en.md)
still has no proxy ownership; the IT service desk is unchanged.

![Original exact-hash proposal review](assets/engineering/impact-review.png)

See [screenshot provenance](assets/engineering/manifest.json).

## Proposed business behavior

The accountable owner must not be overwritten by a temporary proxy.
The fixture's supported owners are `avery` and `jordan`.

```text
effectiveOwner(ticket) = ticket.proxyOwner ?? ticket.owner ?? null
```

Assign, reassign or clear a nullable proxy while preserving ticket identity,
title, status and accountable owner. Filtering uses the effective owner and
intersects the status condition with AND, including unassigned tickets.
Existing and newly created tickets start with `proxyOwner: null`.

## Impact surfaces and constraints

| Surface in the engineering fixture | Proposed change | Preservation requirement |
|---|---|---|
| [Domain](../../demos/engineering-lab/src/domain.mjs) | Effective owner, proxy validation and combined filtering | Accountable owner unchanged; null semantics and AND preserved |
| [Store](../../demos/engineering-lab/src/store.mjs) | Nullable SQLite `proxy_owner`; `assignProxy` | Additive idempotent migration, no table rebuild or legacy-data loss, persisted reopen |
| [API](../../demos/engineering-lab/src/api.mjs) | Serialize `proxyOwner` and `effectiveOwner`, including null | Original serialized fields preserved |
| [Contract](../../demos/engineering-lab/contract.md) | Document behavior, validation, clearing and migration | No unsupported identity or authorization feature |

Only those four files may change. Invalid or undefined proxy values must throw
`TypeError`; missing, nonpositive, noninteger or nonnumeric IDs must throw
`RangeError`, without inserting or changing a ticket. Both supported owners
and null are valid assignments. All fifteen approved visible tests remain
unchanged. Implementation must also pass **35 independent impact checks**.
These are future acceptance requirements, not current results.

## Exact proposal binding

| Binding | Value |
|---|---|
| Proposal hash | `2da119edb9b422f51024d85af9e9278aed748a958c1fa4891714cf1af869f02a` |
| Fixture source | `0eb9973b3fb09d648ebeea21b64786a763fc3021` |
| Fixture hash | `4d25f387db0329a1add68680ebd2f52974ae58e5996ce0adb3e61b12c40f351d` |
| Contract hash | `1581ec33f802fe9c0d638dc0ebb19d1ac8f78c65c1e36d3799dfbb53fa554eba` |
| Sandbox image | `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` |

Approval must bind the unchanged proposal, fixture, contract and immutable
image. A revised proposal needs a new hash and review. A local operator receipt
is a development-test gate, not authenticated GitHub Human acceptance or an
approval of a separate delivery stage.

## Real proposal cost and isolation

The qualified proposal used the observed default `gpt-5.6-sol` model:
one call, **50,733 ms** wall time, **7,209 input / 3,445 output tokens**,
zero cache-read tokens and 7,206 cache-write tokens already included in input.
Recorded usage was one premium-request unit and **10,494,200,000 nano-AIU**;
no dollar price was inferred. Zero tools and zero tool requests were verified,
and the 15-test control sandbox was cleaned.

The earlier isolation-rejected call remains separate: 45,871 ms,
8,294 input / 3,182 output tokens, one premium-request unit and
10,510,700,000 nano-AIU. Two available tool aliases caused rejection despite
zero requests. Its output was not reused or executed. This is a disclosed
compatibility failure, not a hidden successful proposal retry.

## Next authorized step

```text
Review exact proposal → explicit operator approval → verify all bindings
    → one bounded implementation call → unchanged 15 tests + 35 impact checks
    → report actual outcome, including failures → clean sandbox
```

The implementation has not started. After explicit approval, the adapter may
apply only the four permitted files and execute generated source only in
restricted Docker. Preserve the outcome instead of patching or retrying it
silently. Use the [reusable impact workflow](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/engineering-judgment-demos.en.md)
for operator commands; this page records the actual current gate.
