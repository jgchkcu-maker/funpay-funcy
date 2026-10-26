param([string]$Node = 'node')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'manifest.json') -Raw | ConvertFrom-Json
$version = $manifest.version
if ($version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') { throw 'Invalid manifest version' }
$distRoot = Join-Path $projectRoot 'dist'
$staging = Join-Path $distRoot "funcy-$version-staging"
$zipPath = Join-Path $distRoot "funcy-$version.zip"
# Every recursive removal is constrained to this checkout's exact staging directory.
$resolvedStage = [IO.Path]::GetFullPath($staging)
if (-not $resolvedStage.StartsWith([IO.Path]::GetFullPath($distRoot) + [IO.Path]::DirectorySeparatorChar) -or (Split-Path $resolvedStage -Leaf) -ne "funcy-$version-staging") { throw 'Unsafe staging path' }
New-Item -ItemType Directory -Force -Path $distRoot | Out-Null
if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
New-Item -ItemType Directory -Path $resolvedStage | Out-Null
$runtimeDirectories = @('background', 'content', 'css', 'fonts', 'icons', 'offscreen', 'popup', 'licenses')
$runtimeFiles = @('manifest.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md')
foreach ($name in @($runtimeDirectories) + @($runtimeFiles)) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination (Join-Path $resolvedStage $name) -Recurse
}
& $Node (Join-Path $PSScriptRoot 'validate-store.cjs') $resolvedStage
if ($LASTEXITCODE -ne 0) { throw 'Staged package validation failed' }
$prefix = $resolvedStage.TrimEnd('\') + '\'
$included = Get-ChildItem -LiteralPath $resolvedStage -Recurse -File | Sort-Object FullName | ForEach-Object {
    [pscustomobject]@{ file = $_.FullName.Substring($prefix.Length).Replace('\', '/'); bytes = $_.Length; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$included | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $distRoot "funcy-$version-files.json") -Encoding UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
[IO.Compression.ZipFile]::CreateFromDirectory($resolvedStage, $zipPath, [IO.Compression.CompressionLevel]::Optimal, $false)
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    if (-not ($archive.Entries | Where-Object { $_.FullName -eq 'manifest.json' })) { throw 'ZIP root has no manifest' }
    if ($archive.Entries.Count -ne @($included).Count) { throw 'ZIP file count mismatch' }
} finally { $archive.Dispose() }
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  funcy-$version.zip" | Set-Content -LiteralPath (Join-Path $distRoot "funcy-$version.sha256") -Encoding ASCII
Write-Output "Built $zipPath ($(@($included).Count) files)"
Write-Output "SHA-256: $hash"
