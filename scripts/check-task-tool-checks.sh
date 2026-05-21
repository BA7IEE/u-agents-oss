#!/bin/bash
# U-API: stub — upstream v0.9.5 registers this in lint chain via package.json
#         `lint:tool-name-checks` script but ships no implementation file
#         (C13 pattern same as v0.9.1 routing.ts / v0.9.4 HANDLED_CHANNELS / M2.5 CI stubs).
#         When upstream lands the real implementation in a future release, sync will
#         replace this stub automatically. Until then, exit 0 to keep `bun run lint` green.
# 详见 .planning/sync-reports/UPSTREAM-PREVIEW-v0.9.5-2026-05-21.md §4.3
exit 0
