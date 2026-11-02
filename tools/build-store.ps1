param([string]$Node = 'node')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
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
$runtimeDirectories = @('background', 'content', 'css', 'fonts', 'icons', 'offscreen', 'popup', 'licenses', 'themes')
$runtimeFiles = @('manifest.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md')
foreach ($name in @($runtimeDirectories) + @($runtimeFiles)) {
    $source = Join-Path $projectRoot $name
    # A runtime directory without files (themes/ after the bundled wallpapers were dropped) is skipped:
    # an empty folder becomes a ZIP entry of its own and adds nothing to the package.
    if ((Test-Path -LiteralPath $source -PathType Container) -and -not (Get-ChildItem -LiteralPath $source -Recurse -File | Select-Object -First 1)) { continue }
    Copy-Item -LiteralPath $source -Destination (Join-Path $resolvedStage $name) -Recurse
}
# Empty subfolders inside copied directories would add ZIP entries without files too.
Get-ChildItem -LiteralPath $resolvedStage -Recurse -Directory | Sort-Object { $_.FullName.Length } -Descending |
    Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force | Select-Object -First 1) } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
$stageManifestPath = Join-Path $resolvedStage 'manifest.json'
$stageManifest = Get-Content -LiteralPath $stageManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($stageManifest.PSObject.Properties['update_url']) {
    $stageManifest.PSObject.Properties.Remove('update_url')
    [IO.File]::WriteAllText($stageManifestPath, ($stageManifest | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
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
