$ErrorActionPreference = 'Stop'

$snapshotDate = '2026-04-30'
$consoles = @(
  @{ slug = 'nes'; name = 'NES' },
  @{ slug = 'famicom'; name = 'Famicom'; region = 'Japan' },
  @{ slug = 'famicom-disk-system'; name = 'Famicom Disk System'; region = 'Japan' },
  @{ slug = 'super-nintendo'; name = 'Super Nintendo' },
  @{ slug = 'super-famicom'; name = 'Super Famicom'; region = 'Japan' },
  @{ slug = 'nintendo-64'; name = 'Nintendo 64' },
  @{ slug = 'gameboy'; name = 'Game Boy' },
  @{ slug = 'gameboy-color'; name = 'Game Boy Color' },
  @{ slug = 'gameboy-advance'; name = 'Game Boy Advance' },
  @{ slug = 'virtual-boy'; name = 'Virtual Boy' },
  @{ slug = 'sega-master-system'; name = 'Sega Master System' },
  @{ slug = 'sega-genesis'; name = 'Sega Genesis' },
  @{ slug = 'sega-cd'; name = 'Sega CD' },
  @{ slug = 'sega-32x'; name = 'Sega 32X' },
  @{ slug = 'sega-saturn'; name = 'Sega Saturn' },
  @{ slug = 'sega-dreamcast'; name = 'Dreamcast' },
  @{ slug = 'sega-game-gear'; name = 'Game Gear' },
  @{ slug = 'playstation'; name = 'PlayStation' },
  @{ slug = 'turbografx-16'; name = 'TurboGrafx-16' },
  @{ slug = 'neo-geo-aes'; name = 'Neo Geo AES' },
  @{ slug = 'neo-geo-cd'; name = 'Neo Geo CD' },
  @{ slug = 'neo-geo-pocket-color'; name = 'Neo Geo Pocket Color' },
  @{ slug = 'atari-2600'; name = 'Atari 2600' },
  @{ slug = 'atari-5200'; name = 'Atari 5200' },
  @{ slug = 'atari-7800'; name = 'Atari 7800' },
  @{ slug = 'atari-lynx'; name = 'Atari Lynx' },
  @{ slug = 'jaguar'; name = 'Jaguar' }
)

function Get-Rarity([decimal]$priceLoose) {
  if ($priceLoose -ge 100) { return 'Grail' }
  if ($priceLoose -ge 30) { return 'Classic' }
  return 'Common'
}

$outputDir = Join-Path $PSScriptRoot '..\\public\\catalogs'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$allEntries = New-Object System.Collections.Generic.List[object]
$seen = @{}
$consoleManifest = New-Object System.Collections.Generic.List[object]

foreach ($console in $consoles) {
  $cursor = ''
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

    $html = (Invoke-WebRequest -Uri "https://www.pricecharting.com/console/$($console.slug)" -Method Post -Body $body -UseBasicParsing).Content
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
      $id = "$($console.slug)-$slug"

      if ($seen.ContainsKey($id)) {
        continue
      }

      $seen[$id] = $true
      $title = [System.Net.WebUtility]::HtmlDecode($titleMatch.Groups[2].Value)
      $coverUrl = ($coverMatch.Groups[1].Value -replace '/60.jpg', '/240.jpg')
      $priceLoose = [decimal]($looseMatch.Groups[1].Value -replace ',', '')
      $priceComplete = if ($completeMatch.Success) { [decimal]($completeMatch.Groups[1].Value -replace ',', '') } else { $null }

      $entry = [pscustomobject]@{
        id = $id
        title = $title
        console = $console.name
        year = $null
        region = if ($console.region) { $console.region } else { 'North America' }
        coverUrl = $coverUrl
        priceLoose = $priceLoose
        priceComplete = $priceComplete
        priceSourceUrl = "https://www.pricecharting.com/game/$($console.slug)/$slug"
        coverSourceUrl = "https://www.pricecharting.com/game/$($console.slug)/$slug"
        trendDelta = 0
        rarity = (Get-Rarity $priceLoose)
      }

      $allEntries.Add($entry)
      $consoleEntries.Add($entry)
    }

    $cursorMatch = [regex]::Match($html, 'name="cursor" value="(\d+)"')
    $cursor = if ($cursorMatch.Success) { $cursorMatch.Groups[1].Value } else { '' }
    Start-Sleep -Milliseconds 150
  } while ($cursor)

  $catalogFileName = "catalog-$($console.slug).json"
  $consoleEntries | ConvertTo-Json -Depth 5 -Compress | Set-Content (Join-Path $outputDir $catalogFileName)

  $consoleManifest.Add([pscustomobject]@{
    console = $console.name
    slug = $console.slug
    count = $consoleEntries.Count
    file = "/catalogs/$catalogFileName"
  })
}

$allEntries | ConvertTo-Json -Depth 5 -Compress | Set-Content (Join-Path $outputDir 'retro-catalog.json')

[pscustomobject]@{
  snapshotDate = $snapshotDate
  totalGames = $allEntries.Count
  consoles = ($consoleManifest | Sort-Object console)
} | ConvertTo-Json -Depth 5 -Compress | Set-Content (Join-Path $outputDir 'retro-catalog-meta.json')

Write-Output "Generated $($allEntries.Count) retro entries across $($consoleManifest.Count) consoles."
