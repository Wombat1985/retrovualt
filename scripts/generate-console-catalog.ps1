param(
  [Parameter(Mandatory = $true)]
  [string[]]$ConsoleSlugs
)

$ErrorActionPreference = 'Stop'

$snapshotDate = '2026-04-11'
$consoles = @(
  @{ slug = 'nes'; name = 'NES'; region = 'North America' },
  @{ slug = 'famicom'; name = 'Famicom'; region = 'Japan' },
  @{ slug = 'famicom-disk-system'; name = 'Famicom Disk System'; region = 'Japan' },
  @{ slug = 'super-nintendo'; name = 'Super Nintendo'; region = 'North America' },
  @{ slug = 'super-famicom'; name = 'Super Famicom'; region = 'Japan' },
  @{ slug = 'nintendo-64'; name = 'Nintendo 64'; region = 'North America' },
  @{ slug = 'gameboy'; name = 'Game Boy'; region = 'North America' },
  @{ slug = 'gameboy-color'; name = 'Game Boy Color'; region = 'North America' },
  @{ slug = 'gameboy-advance'; name = 'Game Boy Advance'; region = 'North America' },
  @{ slug = 'virtual-boy'; name = 'Virtual Boy'; region = 'North America' },
  @{ slug = 'sega-master-system'; name = 'Sega Master System'; region = 'North America' },
  @{ slug = 'sega-genesis'; name = 'Sega Genesis'; region = 'North America' },
  @{ slug = 'sega-cd'; name = 'Sega CD'; region = 'North America' },
  @{ slug = 'sega-32x'; name = 'Sega 32X'; region = 'North America' },
  @{ slug = 'sega-saturn'; name = 'Sega Saturn'; region = 'North America' },
  @{ slug = 'sega-dreamcast'; name = 'Dreamcast'; region = 'North America' },
  @{ slug = 'sega-game-gear'; name = 'Game Gear'; region = 'North America' },
  @{ slug = 'playstation'; name = 'PlayStation'; region = 'North America' },
  @{ slug = 'turbografx-16'; name = 'TurboGrafx-16'; region = 'North America' },
  @{ slug = 'neo-geo-aes'; name = 'Neo Geo AES'; region = 'North America' },
  @{ slug = 'neo-geo-cd'; name = 'Neo Geo CD'; region = 'North America' },
  @{ slug = 'neo-geo-pocket-color'; name = 'Neo Geo Pocket Color'; region = 'North America' },
  @{ slug = 'atari-2600'; name = 'Atari 2600'; region = 'North America' },
  @{ slug = 'atari-5200'; name = 'Atari 5200'; region = 'North America' },
  @{ slug = 'atari-7800'; name = 'Atari 7800'; region = 'North America' },
  @{ slug = 'atari-lynx'; name = 'Atari Lynx'; region = 'North America' },
  @{ slug = 'jaguar'; name = 'Jaguar'; region = 'North America' }
)

function Get-Rarity([decimal]$priceLoose) {
  if ($priceLoose -ge 100) { return 'Grail' }
  if ($priceLoose -ge 30) { return 'Classic' }
  return 'Common'
}

function Get-ConsoleCatalog {
  param(
    [hashtable]$Console
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
  $entries | ConvertTo-Json -Depth 5 -Compress | Set-Content (Join-Path $outputDir $catalogFileName)
  Write-Output "Generated $($entries.Count) entries for $($console.name)."
}

$allEntries = New-Object System.Collections.Generic.List[object]
$consoleManifest = New-Object System.Collections.Generic.List[object]

foreach ($file in (Get-ChildItem -Path $outputDir -Filter 'catalog-*.json' | Sort-Object Name)) {
  $slug = ($file.BaseName -replace '^catalog-', '')
  if (-not $consoleLookup.ContainsKey($slug)) {
    continue
  }

  $entries = Get-Content $file.FullName -Raw | ConvertFrom-Json
  foreach ($entry in $entries) {
    $allEntries.Add($entry)
  }

  $consoleManifest.Add([pscustomobject]@{
    console = $consoleLookup[$slug].name
    slug = $slug
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
