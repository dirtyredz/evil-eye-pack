<#
.SYNOPSIS
  Shared guards and archive plumbing for cutover.ps1 and rollback.ps1 (dot-source it; functions only).
.DESCRIPTION
  Pure functions with injectable inputs (process list, free bytes) so tests can prove the guards
  without a launcher or a full disk. Nothing here runs on dot-source.
  Functions: Get-LauncherBlockers, Test-ArchiveSpace, Get-InstanceFiles, New-InstanceArchive,
  Test-HashManifest, Restore-InstanceArchive, Set-CfgKey.
#>

# Paths (relative to the instance folder, forward slashes) that are volatile and never archived.
$script:ArchiveExcludes = @(
  '^\.minecraft/logs(/|$)', '^\.minecraft/crash-reports(/|$)', '^\.minecraft/quickskin_cache(/|$)',
  '^\.minecraft/hs_err_pid[^/]*\.log$', '^\.minecraft/packwiz-install\.log$'
)

function Get-FileSha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

# Returns human-readable blockers; an empty array means MultiMC and the game are both closed.
# -Processes: objects with Name, ProcessId, CommandLine (default: the live process table).
function Get-LauncherBlockers([object[]]$Processes) {
  if ($null -eq $Processes) {
    $Processes = @(Get-CimInstance Win32_Process | ForEach-Object {
      [pscustomobject]@{ Name = $_.Name; ProcessId = $_.ProcessId; CommandLine = [string]$_.CommandLine } })
  }
  $blockers = @()
  foreach ($p in $Processes) {
    $name = [string]$p.Name
    $cmd = [string]$p.CommandLine
    if ($name -match '^multimc(\.exe)?$') {
      $blockers += "MultiMC is running (pid $($p.ProcessId)); close it fully"
    } elseif ($name -match '^javaw?(\.exe)?$' -and $cmd -match 'net\.minecraft|minecraftforge|neoforge|cpw\.mods|org\.multimc|\.minecraft') {
      $blockers += "A Minecraft/Java process is running (pid $($p.ProcessId)); close the game"
    }
  }
  return $blockers
}

# -FreeBytes overrides the real drive free space (tests). Required = bytes * 1.1 + 2 GiB headroom.
function Test-ArchiveSpace([string]$Path, [long]$SourceBytes, [Nullable[long]]$FreeBytes = $null) {
  $required = [long]([math]::Ceiling($SourceBytes * 1.1) + 2GB)
  if ($null -eq $FreeBytes) {
    $probe = [IO.Path]::GetFullPath($Path)
    while ($probe -and -not (Test-Path -LiteralPath $probe)) { $probe = Split-Path -Parent $probe }
    $FreeBytes = ([IO.DriveInfo]([IO.Path]::GetPathRoot($probe))).AvailableFreeSpace
  }
  return [pscustomobject]@{ Ok = ($FreeBytes -ge $required); Free = [long]$FreeBytes; Required = $required }
}

# Files to archive from an instance folder (everything except volatile excludes). Links are refused.
function Get-InstanceFiles([string]$InstanceDir) {
  $base = (Resolve-Path -LiteralPath $InstanceDir).ProviderPath.TrimEnd('\')
  $out = New-Object System.Collections.Generic.List[object]
  foreach ($f in Get-ChildItem -LiteralPath $base -Recurse -File -Force) {
    if ($f.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing link inside instance: $($f.FullName)" }
    $rel = $f.FullName.Substring($base.Length + 1).Replace('\', '/')
    $skip = $false
    foreach ($rx in $script:ArchiveExcludes) { if ($rel -match $rx) { $skip = $true; break } }
    if (-not $skip) { $out.Add([pscustomobject]@{ Rel = $rel; Full = $f.FullName; Length = $f.Length }) }
  }
  return $out.ToArray()
}

# Copies files into <ArchiveDir>/files, hashing source and copy (they must agree), then writes
# <ArchiveDir>/manifest.sha256 ("<sha256>  <relpath>") and archive.json. Returns the file count.
function New-InstanceArchive([string]$InstanceDir, [string]$ArchiveDir, [object[]]$Files, [scriptblock]$Log) {
  $filesRoot = Join-Path $ArchiveDir 'files'
  New-Item -ItemType Directory -Path $filesRoot -Force | Out-Null
  $lines = New-Object System.Collections.Generic.List[string]
  $bytes = 0L; $n = 0
  foreach ($f in $Files) {
    $dest = Join-Path $filesRoot ($f.Rel.Replace('/', '\'))
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    $srcHash = Get-FileSha256 $f.Full
    [IO.File]::Copy($f.Full, $dest, $false)
    [IO.File]::SetLastWriteTimeUtc($dest, [IO.File]::GetLastWriteTimeUtc($f.Full))
    if ((Get-FileSha256 $dest) -ne $srcHash) { throw "Archive copy differs from source: $($f.Rel)" }
    $lines.Add("$srcHash  $($f.Rel)")
    $bytes += $f.Length; $n++
    if ($Log -and ($n % 500 -eq 0)) { & $Log "  archived $n / $($Files.Count) files" }
  }
  $utf8 = New-Object Text.UTF8Encoding($false)
  [IO.File]::WriteAllLines((Join-Path $ArchiveDir 'manifest.sha256'), $lines.ToArray(), $utf8)
  $meta = [ordered]@{ instance = $InstanceDir; created = (Get-Date).ToString('o'); files = $n; bytes = $bytes }
  [IO.File]::WriteAllText((Join-Path $ArchiveDir 'archive.json'), (($meta | ConvertTo-Json) + "`n"), $utf8)
  return $n
}

# Verifies every manifest entry under <Root> (the archive 'files' folder or a restored instance).
# Returns problem strings (missing / hash mismatch); empty means byte-identical.
function Test-HashManifest([string]$Root, [string]$ManifestPath) {
  $problems = @()
  if (-not (Test-Path -LiteralPath $ManifestPath)) { return @("Hash manifest missing: $ManifestPath") }
  $entries = @(Get-Content -LiteralPath $ManifestPath -Encoding UTF8 | Where-Object { $_.Trim() })
  if ($entries.Count -eq 0) { return @("Hash manifest is empty: $ManifestPath") }
  foreach ($line in $entries) {
    if ($line -notmatch '^([0-9a-f]{64})  (.+)$') { $problems += "Malformed manifest line: $line"; continue }
    $hash = $Matches[1]; $rel = $Matches[2]
    $path = Join-Path $Root $rel.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { $problems += "Missing: $rel"; continue }
    if ((Get-FileSha256 $path) -ne $hash) { $problems += "Hash mismatch: $rel" }
  }
  return $problems
}

# Verifies the archive first (nothing is touched if it fails), then moves the live .minecraft into
# <QuarantineDir> (never deleted: it may hold a converted world) and rebuilds the instance from the
# archive. Returns the restored file count; throws if the restored bytes differ from the manifest.
function Restore-InstanceArchive([string]$ArchiveDir, [string]$InstanceDir, [string]$QuarantineDir) {
  $filesRoot = Join-Path $ArchiveDir 'files'
  $manifest = Join-Path $ArchiveDir 'manifest.sha256'
  $problems = @(Test-HashManifest $filesRoot $manifest)
  if ($problems.Count) { throw "Archive failed verification; nothing was touched:`n  " + ($problems -join "`n  ") }
  New-Item -ItemType Directory -Path $QuarantineDir -Force | Out-Null
  foreach ($name in 'instance.cfg', 'mmc-pack.json') {
    $live = Join-Path $InstanceDir $name
    if (Test-Path -LiteralPath $live) { Copy-Item -LiteralPath $live -Destination (Join-Path $QuarantineDir $name) }
  }
  $mc = Join-Path $InstanceDir '.minecraft'
  if (Test-Path -LiteralPath $mc) { Move-Item -LiteralPath $mc -Destination (Join-Path $QuarantineDir '.minecraft') }
  $n = 0
  foreach ($line in Get-Content -LiteralPath $manifest -Encoding UTF8 | Where-Object { $_.Trim() }) {
    $rel = $line.Substring(66)
    $src = Join-Path $filesRoot $rel.Replace('/', '\')
    $dst = Join-Path $InstanceDir $rel.Replace('/', '\')
    New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
    [IO.File]::Copy($src, $dst, $true)
    [IO.File]::SetLastWriteTimeUtc($dst, [IO.File]::GetLastWriteTimeUtc($src))
    $n++
  }
  $after = @(Test-HashManifest $InstanceDir $manifest)
  if ($after.Count) { throw "Restored instance differs from archive:`n  " + ($after -join "`n  ") }
  return $n
}

# Replaces KEY=value in instance.cfg text, adding the key when missing. Preserves line endings.
function Set-CfgKey([string]$Text, [string]$Key, [string]$Value) {
  $rx = '(?m)^' + [regex]::Escape($Key) + '=[^\r\n]*(?=\r?$)'
  if ([regex]::IsMatch($Text, $rx)) { return [regex]::Replace($Text, $rx, { param($m) "$Key=$Value" }) }
  $eol = if ($Text.Contains("`r`n")) { "`r`n" } else { "`n" }
  return $Text.TrimEnd("`r", "`n") + $eol + "$Key=$Value" + $eol
}
