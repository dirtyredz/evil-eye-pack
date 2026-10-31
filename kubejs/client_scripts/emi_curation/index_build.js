// priority: 75
// Resumable construction of an immutable EMI index view. A build snapshots the source once,
// keeps partial output private, and exposes only a complete frozen list to session.js.

(function (ns) {
  var DEFAULT_ITEMS = 256
  var DEFAULT_MILLIS = 4

  function start(source, isHidden) {
    return {
      source: source,
      input: ns.interop.copy(source),
      output: ns.interop.newList(),
      cursor: 0,
      isHidden: isHidden,
      result: null
    }
  }

  // Advances by at most 256 classifications or 4 ms. A single classification cannot be
  // pre-empted, so the first item is always allowed even if the clock budget has elapsed.
  function step(job, maxItems, maxMillis, clock) {
    if (job.result) return { done: true, count: 0, result: job.result }
    var itemLimit = maxItems == null ? DEFAULT_ITEMS : maxItems
    var timeLimit = maxMillis == null ? DEFAULT_MILLIS : maxMillis
    var now = clock || function () { return Date.now() }
    var started = now()
    var count = 0
    var C = ns.collections
    var length = C.len(job.input)
    while (job.cursor < length && count < itemLimit && (count === 0 || now() - started < timeLimit)) {
      var stack = C.at(job.input, job.cursor++)
      if (!job.isHidden(stack)) job.output.add(stack)
      count++
    }
    if (job.cursor >= length) job.result = ns.interop.freeze(job.output)
    return { done: !!job.result, count: count, result: job.result }
  }

  ns.indexBuild = { start: start, step: step, DEFAULT_ITEMS: DEFAULT_ITEMS, DEFAULT_MILLIS: DEFAULT_MILLIS }
})(global.emiCuration || (global.emiCuration = {}))
