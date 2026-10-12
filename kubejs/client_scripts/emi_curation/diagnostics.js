// priority: 100
// Shared guarded error reporting for the EMI curation callbacks. Nothing in this
// package may throw into Forge's event bus or into EMI: an uncaught exception in a
// Forge listener hard-crashes the client without a crash report.

(function (ns) {
  var counts = {}

  // Logs at most the first 5 failures per site, then every 200th, so a failing tick
  // handler cannot flood latest.log.
  function shouldLog(where) {
    var n = (counts[where] || 0) + 1
    counts[where] = n
    return n <= 5 || n % 200 === 0
  }

  // KubeJS's class filter denies java.io, so no StringWriter: read the frames directly.
  function stackTrace(err) {
    try {
      var je = err && (err.javaException || err.rhinoException)
      if (!je) return null
      var lines = [String(je)]
      var frames = je.getStackTrace()
      for (var i = 0; i < frames.length && i < 25; i++) lines.push('  at ' + frames[i])
      return lines.join('\n')
    } catch (ignored) {
      return null
    }
  }

  function logError(where, err) {
    try {
      if (!shouldLog(where)) return
      console.error('EMI curation (' + where + '): ' + err + ' [occurrence ' + counts[where] + ']')
      var trace = stackTrace(err)
      if (trace) console.error(trace)
    } catch (ignored) {}
  }

  function info(msg) {
    try { console.info('EMI curation: ' + msg) } catch (ignored) {}
  }

  // Runs fn(); on failure logs and returns fallback instead of throwing.
  function guard(where, fn, fallback) {
    try {
      return fn()
    } catch (err) {
      logError(where, err)
      return fallback
    }
  }

  ns.diag = { logError: logError, info: info, guard: guard }
})(global.emiCuration || (global.emiCuration = {}))
