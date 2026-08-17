# AIOpsLab Recovery — Proof of Work

## Purpose

This document records the read-only recovery investigation performed against the current AIOpsLab architecture before any implementation remediation is proposed.

It is documentation-only. It does not restore historical PR #132/#133 code, modify the application submodule, or change the current deployment architecture.

## Locked baseline

- Upstream: `microsoft/AIOpsLab`
- Baseline: `b9a814e75a98e670787dac7c2ed6794b4b68dae2`
- Recovery branch: `recovery/aiopslab-current-architecture`
- Application submodule: `xlab-uiuc/aiopslab-applications`
- Application pin: `8038be6b4989c647126f27715acc591c47133c2d`

## Investigation phases

### Phase 3 — Current framework architecture

Inspected the current ProblemRegistry, no-op problem, HotelReservation application, application base, orchestrator, integration smoke test, metadata, and submodule declaration.

Established that the current framework already owns the application lifecycle: delete/deploy/inject/start/evaluate/recover/cleanup. The HotelReservation no-op problem is already registered and the smoke test expects `No` with correct detection.

### Phase 4 — Application submodule

Inspected the pinned HotelReservation Kubernetes deployment tree in `aiopslab-applications`.

Observed mutable image references including:

- `777lefty/docker-frontend-service-container:latest`
- `777lefty/docker-geo-service-container:latest`
- `777lefty/docker-profile-service-container:latest`
- `777lefty/docker-rate-service-container:latest`
- `777lefty/docker-reserv-service-container:latest`
- `mongo`
- `memcached`
- `jaegertracing/all-in-one:latest`

The manifests use `IfNotPresent` in several deployments; this does not make a tag immutable.

No application-level PV/PVC manifest was established in the inspected deployment tree.

Conclusion: application artifact reproducibility is a confirmed defect, but the manifests were not proven to be the cause of the historical readiness failure.

### Phase 5 — Readiness boundary

Traced the current deployment path:

```text
HotelReservation.deploy()
  -> kubectl.apply_configs()
  -> wait_for_ready()
```

The current readiness implementation polls all pods in the namespace with a 300-second timeout. It does not provide a detailed per-pod failure diagnosis at timeout.

The authoritative Integration Smoke Test at the locked AIOpsLab and application commits passes, proving the current deploy/readiness lifecycle is operational in CI.

Conclusion: readiness diagnostics have a confirmed weakness; causal failure is not established.

### Phase 6 — Targeted evidence and provenance

Searched the accessible authoritative GitHub Actions history for a failing Integration Smoke Test run. No authoritative failing run was found that exposes evidence sufficient to correlate the historical `PodInitializing` condition to a specific failure mechanism.

The successful authoritative run checked out the locked application submodule commit and completed deployment, readiness, fault injection, workload execution, evaluation, recovery, and cleanup.

The CI workflow also explicitly pre-pulls/pre-installs infrastructure and uses longer infrastructure provisioning waits, confirming cold-start sensitivity as a credible environmental boundary.

Image provenance investigation confirmed that the application manifests use mutable/floating image identities. Authoritative immutable digest mappings for all five `777lefty` application images were not established; no replacement digest is selected by this proof of work.

## Root-cause model

The evidence supports three separate layers:

1. **Artifact provenance — confirmed defect**
   - Mutable application and infrastructure image references prevent immutable workload identity.

2. **Framework readiness — diagnostic weakness**
   - Deployment and readiness work in authoritative CI.
   - Global pod polling and a hard 300-second timeout provide limited failure diagnosis.
   - A causal framework defect is not proven.

3. **Runtime/environment — credible but unconfirmed failure domain**
   - Image pulls, initialization, scheduling, storage, and node readiness can affect startup timing.
   - The historical incident cannot currently be attributed to one of these mechanisms without a failing-run evidence set.

## Historical PR boundary

Historical PR #132 and PR #133 remain reference material only.

Their reproducibility concerns are relevant to the confirmed artifact-identity defect, but their historical standalone deployment implementation is not restored here. The current recovery approach preserves the existing AIOpsLab lifecycle.

## Remediation decision gate

No implementation remediation is proposed by this document.

When implementation is separately authorized, the evidence-based order is:

1. Establish authoritative image provenance and immutable identities.
2. Capture pod events/container state for an actual failing run if one becomes available.
3. Correlate the exact failure mechanism.
4. Select the smallest remediation boundary: application artifact, readiness/observability, CI/environment provisioning, or a combination.
5. Validate through the upstream Integration Smoke Test, which remains the authoritative acceptance gate.

## Governance

This proof of work does not modify fork `main`, historical branches, the application submodule, upstream repository state, or upstream issues.

No security-sensitive finding is disclosed here; security issues remain subject to the repository's security reporting process.
