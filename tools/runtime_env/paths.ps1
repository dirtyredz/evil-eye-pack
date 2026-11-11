# Dot-source from an entry point; resolve the CLI beside this file, independent of cwd.
function Get-RuntimePath([string]$Key) {
  $value = & node (Join-Path $PSScriptRoot 'paths.cjs') $Key
  if ($LASTEXITCODE -ne 0 -or -not $value) { throw "Runtime path lookup failed: $Key" }
  return [string]$value
}
