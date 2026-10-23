---
id: dk-41edac11
type: idea
created: 2026-10-20
status: done
since: 2026-10-23
area: server-smoke
priority: P3
rank: zzt
parent:
fixes: []
blocked_by: []
relates: []
---
# Extract a cpu_sampler from boot() if it grows

tools/server_smoke/boot.cjs boot() holds spawn/tee, the Done/crash wait loop, CPU sampling state (sampling, cpu, lastCpuAt, nextSample, sampleCpu), the thread dump and stop/kill (componentization review 2026-10-20). The sampler state is only testable through a real JVM. If boot() grows again, extract a small cpu_sampler module (start/stop, exposes cpu and lastGrowthAt) so boot() only supervises. Fine as is for now.
