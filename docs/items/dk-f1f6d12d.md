---
id: dk-f1f6d12d
type: bug
created: 2026-11-06
status: done
since: 2026-11-11
area: pack
priority: P2
rank: zzzzzzzzzzzzzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# Pack test flags ignore_rtp and Jade sort-order findings

The headless pack test for the Tweaks/Client 0.12.0 pin (2026-11-06, artifacts jobs/2026-11-06-pin-storage-tabs-0.12.0/packtest.console.log) exited 1 on two NEW findings in files that pin does not touch:
- evileye_essentials:ignore_rtp -> ftbessentials:ignore_rtp (Evil Eye Essentials 0.2.0 jar)
- config/jade/sort-order.json -> balm:jade
Not yet confirmed whether they predate the pin (main was not re-run). Decide: fix at the source, or baseline them with a reason.
