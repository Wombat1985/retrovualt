$ErrorActionPreference = 'Stop'

$manifestPath = Join-Path $PSScriptRoot 'retro-console-manifest.json'
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$slugs = @($manifest | ForEach-Object { $_.slug })

& (Join-Path $PSScriptRoot 'generate-console-catalog.ps1') -ConsoleSlugs $slugs
