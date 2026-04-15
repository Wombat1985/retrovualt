param(
  [string]$ConsoleSlug = '',
  [int]$MaxItems = 0
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$catalogsDir = Join-Path $projectRoot 'public\catalogs'
$cacheDir = Join-Path $projectRoot 'server\data'
$cachePath = Join-Path $cacheDir 'year-cache-ps.json'

New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

if (Test-Path $cachePath) {
  $cache = @{}
  $parsedCache = Get-Content $cachePath -Raw | ConvertFrom-Json
  if ($parsedCache) {
    $parsedCache.PSObject.Properties | ForEach-Object {
      $cache[$_.Name] = $_.Value
    }
  }
} else {
  $cache = @{}
}

$files = Get-ChildItem -Path $catalogsDir -Filter 'catalog-*.json' | Sort-Object Name

if ($ConsoleSlug) {
  $targetName = "catalog-$ConsoleSlug.json"
  $files = $files | Where-Object { $_.Name -eq $targetName }

  if (-not $files) {
    throw "No catalog file found for console slug '$ConsoleSlug'."
  }
}

function Get-YearFromHtml {
  param(
    [string]$Html
  )

  $faqMatch = [regex]::Match($Html, '"name"\s*:\s*"When was .*? released\?"[\s\S]*?"text"\s*:\s*"[^"]*?(\d{4})"')
  if ($faqMatch.Success) {
    return [int]$faqMatch.Groups[1].Value
  }

  $releasedMatch = [regex]::Match($Html, 'was released [A-Za-z]+ \d{1,2}, (\d{4})')
  if ($releasedMatch.Success) {
    return [int]$releasedMatch.Groups[1].Value
  }

  $publishedMatch = [regex]::Match($Html, '"datePublished"\s*:\s*"(\d{4})')
  if ($publishedMatch.Success) {
    return [int]$publishedMatch.Groups[1].Value
  }

  return $null
}

$globalProcessed = 0

foreach ($file in $files) {
  $entries = Get-Content $file.FullName -Raw | ConvertFrom-Json
  $missing = @($entries | Where-Object { $null -eq $_.year })

  Write-Output "Processing $($file.Name): $($missing.Count) missing years"

  $processed = 0
  foreach ($entry in $missing) {
    if ($MaxItems -gt 0 -and $globalProcessed -ge $MaxItems) {
      break
    }

    if ($cache.ContainsKey($entry.id) -and $null -ne $cache[$entry.id]) {
      $entry.year = $cache[$entry.id]
      $processed++
      $globalProcessed++
      continue
    }

    try {
      $consoleSlug = ($entry.priceSourceUrl -split '/game/')[1] -split '/' | Select-Object -First 1
      $response = Invoke-WebRequest `
        -Uri $entry.priceSourceUrl `
        -UseBasicParsing `
        -TimeoutSec 25 `
        -Headers @{
          'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36'
          'Referer' = "https://www.pricecharting.com/console/$consoleSlug"
          'Accept-Language' = 'en-US,en;q=0.9'
        }

      $year = Get-YearFromHtml -Html $response.Content
      $entry.year = $year
      if ($null -ne $year) {
        $cache[$entry.id] = $year
        Write-Output "Year $year - $($entry.title)"
      } else {
        Write-Output "No year found - $($entry.title)"
      }
    } catch {
      Write-Warning "Failed year lookup for $($entry.title): $($_.Exception.Message)"
    }

    $processed++
    $globalProcessed++

    if (($processed % 25) -eq 0) {
      $entries | ConvertTo-Json -Depth 5 -Compress | Set-Content $file.FullName
      $cache | ConvertTo-Json -Depth 5 | Set-Content $cachePath
    }

    Start-Sleep -Milliseconds 180
  }

  $entries | ConvertTo-Json -Depth 5 -Compress | Set-Content $file.FullName
  $cache | ConvertTo-Json -Depth 5 | Set-Content $cachePath

  if ($MaxItems -gt 0 -and $globalProcessed -ge $MaxItems) {
    break
  }
}

Write-Output 'PowerShell year enrichment complete.'
