---
id: dk-0eb48f8f
type: task
created: 2026-10-12
status: wip
since: 2026-10-20
area: tools
priority: P2
rank: z
parent:
fixes: []
blocked_by: []
relates: []
---
# One readTable helper for the hand-rolled TOML readers in pack_index.cjs

Baseline review 2026-10-12 (abstraction). pack_index.cjs has indexTableRange/readPackIndexRef and readMetafileDownload (:131, :163-175), each with its own key = "value" regex; scan_jars.cjs parseModsToml is a third.
Why: a quoting/CRLF fix in one reader won't reach the others.
Direction: readTable(text, header, keys) in pack_index.cjs for the index ref and metafile download table; scan_jars may stay separate (multiline [[...]] blocks).
