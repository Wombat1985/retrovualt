param(
  [Parameter(Mandatory = $true)]
  [string[]]$ConsoleSlugs
)

$ErrorActionPreference = 'Stop'

$snapshotDate = '2026-04-11'
$manifestPath = Join-Path $PSScriptRoot 'retro-console-manifest.json'
$consoles = Get-Content $manifestPath -Raw | ConvertFrom-Json

function Get-Rarity([decimal]$priceLoose) {
  if ($priceLoose -ge 100) { return 'Grail' }
  if ($priceLoose -ge 30) { return 'Classic' }
  return 'Common'
}

function Get-ConsoleCatalog {
  param(
    [object]$Console
  )

  $cursor = ''
  $seen = @{}
  $consoleEntries = New-Object System.Collections.Generic.List[object]

  do {
    $body = @{
      sort = 'name'
      when = 'none'
      'release-date' = $snapshotDate
      'exclude-hardware' = 'true'
      'exclude-variants' = 'true'
    }

    if ($cursor) {
      $body.cursor = $cursor
    }

    $html = (Invoke-WebRequest `
      -Uri "https://www.pricecharting.com/console/$($Console.slug)" `
      -Method Post `
      -Body $body `
      -UseBasicParsing `
      -Headers @{
        'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36'
        'Referer' = "https://www.pricecharting.com/console/$($Console.slug)"
        'Accept-Language' = 'en-US,en;q=0.9'
      }).Content

    $rows = [regex]::Matches($html, '<tr id="product-\d+" data-product="\d+">[\s\S]*?<\/tr>')

    foreach ($row in $rows) {
      $block = $row.Value
      $titleMatch = [regex]::Match($block, '<a href="/game/[^/]+/([^"?#]+)">([^<]+)</a>')
      $coverMatch = [regex]::Match($block, '<img class="photo" loading="lazy" src="([^"]+)"')
      $looseMatch = [regex]::Match($block, '<td class="price numeric used_price">[\s\S]*?<span class="js-price">\$(\d[\d,]*(?:\.\d{2})?)</span>')
      $completeMatch = [regex]::Match($block, '<td class="price numeric cib_price">[\s\S]*?<span class="js-price">\$(\d[\d,]*(?:\.\d{2})?)</span>')

      if (-not ($titleMatch.Success -and $coverMatch.Success -and $looseMatch.Success)) {
        continue
      }

      $slug = $titleMatch.Groups[1].Value
      $id = "$($Console.slug)-$slug"

      if ($seen.ContainsKey($id)) {
        continue
      }

      $seen[$id] = $true
      $title = [System.Net.WebUtility]::HtmlDecode($titleMatch.Groups[2].Value)
      $coverUrl = ($coverMatch.Groups[1].Value -replace '/60.jpg', '/240.jpg')
      $priceLoose = [decimal]($looseMatch.Groups[1].Value -replace ',', '')
      $priceComplete = if ($completeMatch.Success) { [decimal]($completeMatch.Groups[1].Value -replace ',', '') } else { $null }

      $consoleEntries.Add([pscustomobject]@{
        id = $id
        title = $title
        console = $Console.name
        year = $null
        region = $Console.region
        coverUrl = $coverUrl
        priceLoose = $priceLoose
        priceComplete = $priceComplete
        priceSourceUrl = "https://www.pricecharting.com/game/$($Console.slug)/$slug"
        coverSourceUrl = "https://www.pricecharting.com/game/$($Console.slug)/$slug"
        trendDelta = 0
        rarity = (Get-Rarity $priceLoose)
      })
    }

    $cursorMatch = [regex]::Match($html, 'name="cursor" value="(\d+)"')
    $cursor = if ($cursorMatch.Success) { $cursorMatch.Groups[1].Value } else { '' }
    Start-Sleep -Milliseconds 150
  } while ($cursor)

  return $consoleEntries
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$outputDir = Join-Path $projectRoot 'public\catalogs'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$requestedConsoleSlugs = @(
  foreach ($slug in $ConsoleSlugs) {
    $slug -split ','
  }
) | Where-Object { $_ } | ForEach-Object { $_.Trim() }

$consoleLookup = @{}
foreach ($console in $consoles) {
  $consoleLookup[$console.slug] = $console
}

foreach ($slug in $requestedConsoleSlugs) {
  if (-not $consoleLookup.ContainsKey($slug)) {
    throw "Unknown console slug '$slug'."
  }

  $console = $consoleLookup[$slug]
  Write-Output "Generating $($console.name)..."
  $entries = Get-ConsoleCatalog -Console $console
  $catalogFileName = "catalog-$($console.slug).json"
  ConvertTo-Json -InputObject @($entries) -Depth 5 -Compress | Set-Content (Join-Path $outputDir $catalogFileName)
  Write-Output "Generated $($entries.Count) entries for $($console.name)."
}

$allEntries = New-Object System.Collections.Generic.List[object]
$consoleManifest = New-Object System.Collections.Generic.List[object]

foreach ($file in (Get-ChildItem -Path $outputDir -Filter 'catalog-*.json' | Sort-Object Name)) {
  $slug = ($file.BaseName -replace '^catalog-', '')
  if (-not $consoleLookup.ContainsKey($slug)) {
    continue
  }

  $entries = @(Get-Content $file.FullName -Raw | ConvertFrom-Json)
  foreach ($entry in $entries) {
    $allEntries.Add($entry)
  }

  $consoleManifest.Add([pscustomobject]@{
    console = $consoleLookup[$slug].name
    slug = $slug
    region = $consoleLookup[$slug].region
    market = $consoleLookup[$slug].market
    count = $entries.Count
    file = "/catalogs/$($file.Name)"
  })
}

$allEntries | ConvertTo-Json -Depth 5 -Compress | Set-Content (Join-Path $outputDir 'retro-catalog.json')

[pscustomobject]@{
  snapshotDate = $snapshotDate
  totalGames = $allEntries.Count
  consoles = ($consoleManifest | Sort-Object console)
} | ConvertTo-Json -Depth 5 -Compress | Set-Content (Join-Path $outputDir 'retro-catalog-meta.json')

Write-Output "Catalog index now has $($allEntries.Count) retro entries across $($consoleManifest.Count) consoles."
