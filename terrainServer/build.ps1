#Requires -Version 5.1
<#
.SYNOPSIS
    陕西省 GEM/SRTM 高程数据 → Mapbox Terrain-RGB MBTiles 构建脚本

.DESCRIPTION
    本脚本由 npm run build 调用，将上级目录 terrainSrtmImgs 中的 4 块 SRTM/GEM .img 瓦片
    合并、重投影、编码为 Terrain-RGB 格式，最终输出到 buildTerrainFiles/ 目录。

    处理流程：
      1. gdalbuildvrt  — 4 块分幅合并为虚拟镶嵌 (buildTerrainFiles/shaanxi_mosaic.vrt)
      2. gdalwarp      — 重投影至 Web Mercator (EPSG:3857)
      3. gdal_calc.py  — 高程值编码为 Mapbox Terrain-RGB 三波段 GeoTIFF
      4. gdal_translate — 生成 MBTiles 瓦片包 (buildTerrainFiles/terrain.mbtiles)

    依赖：GDAL 3.0+（需支持 ELEVATION_TYPE=terrain-rgb），推荐 OSGeo4W 或 QGIS 自带 GDAL。

.EXAMPLE
    npm run build
    # 或
    powershell -ExecutionPolicy Bypass -File ./build.ps1
#>
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# GDAL 工具链探测
# 在 Windows 上 GDAL 可能来自 OSGeo4W、QGIS、Conda 等，路径不统一，需逐一查找。
# ---------------------------------------------------------------------------

<#
.SYNOPSIS
    查找 gdalwarp 可执行文件路径（作为 GDAL 安装根目录的锚点）。
#>
function Find-Gdal {
    # 优先使用 PATH 中已配置的 gdalwarp
    $cmd = Get-Command gdalwarp -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    # 常见 Windows 安装路径候选列表
    $condaGdal = Join-Path $env:LOCALAPPDATA 'GDAL\conda-env\Library\bin\gdalwarp.exe'
    $candidates = @(
        $condaGdal,
        'C:\Program Files\GDAL\gdalwarp.exe',
        'C:\Program Files\QGIS 3.40.0\bin\gdalwarp.exe',
        'C:\Program Files\QGIS 3.34.0\bin\gdalwarp.exe',
        'C:\Program Files\QGIS 3.32.0\bin\gdalwarp.exe',
        'C:\OSGeo4W64\bin\gdalwarp.exe',
        'C:\OSGeo4W\bin\gdalwarp.exe'
    )
    foreach ($p in $candidates) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

<#
.SYNOPSIS
    在 GDAL bin 目录及其关联路径中查找指定工具（exe 或 Python 脚本）。
.PARAMETER BinDir
    gdalwarp 所在 bin 目录，用于推导同目录下的其他工具。
.PARAMETER ToolName
    工具文件名，如 gdalbuildvrt.exe、gdal_calc.py。
#>
function Find-GdalTool {
    param(
        [Parameter(Mandatory = $true)][string]$BinDir,
        [Parameter(Mandatory = $true)][string]$ToolName
    )

    $cmd = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidate = Join-Path $BinDir $ToolName
    if (Test-Path $candidate) { return $candidate }

    # OSGeo4W / Conda 环境：Scripts 目录可能包含 gdal 相关脚本
    $envRoot = Split-Path (Split-Path $BinDir -Parent) -Parent
    $envScriptCandidate = Join-Path (Join-Path $envRoot 'Scripts') $ToolName
    if (Test-Path $envScriptCandidate) { return $envScriptCandidate }

    # gdal_calc.py 也可能位于 Python site-packages
    if ($ToolName -eq 'gdal_calc.py') {
        $sitePackageCandidate = Join-Path $envRoot 'Lib\site-packages\osgeo_utils\gdal_calc.py'
        if (Test-Path $sitePackageCandidate) { return $sitePackageCandidate }
    }

    return $null
}

<#
.SYNOPSIS
    查找与 GDAL 绑定的 Python 解释器（gdal_calc.py 需要 osgeo 模块）。
#>
function Find-GdalPython {
    param([Parameter(Mandatory = $true)][string]$BinDir)

    $envRoot = Split-Path (Split-Path $BinDir -Parent) -Parent
    $candidates = @(
        (Join-Path $envRoot 'python.exe'),
        (Join-Path (Split-Path $BinDir -Parent) 'apps\Python312\python.exe'),
        (Join-Path (Split-Path $BinDir -Parent) 'apps\Python311\python.exe'),
        (Join-Path (Split-Path $BinDir -Parent) 'apps\Python310\python.exe'),
        (Join-Path (Split-Path $BinDir -Parent) 'apps\Python39\python.exe')
    )

    foreach ($p in $candidates) {
        if (Test-Path $p) { return $p }
    }

    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    return $null
}

<#
.SYNOPSIS
    执行外部命令并在非零退出码时抛出异常。
#>
function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $FilePath"
    }
}

# ---------------------------------------------------------------------------
# 前置检查：GDAL 工具链完整性
# ---------------------------------------------------------------------------

$gdalWarp = Find-Gdal
if (-not $gdalWarp) {
    Write-Host @"

[Error] GDAL was not found. Install one of:
  1. OSGeo4W: https://trac.osgeo.org/osgeo4w/
  2. QGIS with GDAL, then add the bin directory to PATH.

After installation, reopen the terminal and run: gdalinfo --version
"@ -ForegroundColor Red
    exit 1
}

$binDir = Split-Path $gdalWarp -Parent
$gdalBuildVrt = Find-GdalTool $binDir 'gdalbuildvrt.exe'
$gdalTranslate = Find-GdalTool $binDir 'gdal_translate.exe'
$gdalCalc = Find-GdalTool $binDir 'gdal_calc.py'
$gdalPython = Find-GdalPython $binDir

if (-not $gdalBuildVrt -or -not $gdalTranslate -or -not $gdalCalc -or -not $gdalPython) {
    throw "Incomplete GDAL tools: gdalbuildvrt, gdal_translate, gdal_calc.py, and a Python runtime with osgeo are required."
}

# ---------------------------------------------------------------------------
# 输入数据：陕西省区域 4 块 SRTM/GEM 分幅（EHFA 格式，GDAL 可直接读取）
# ---------------------------------------------------------------------------

$root = Split-Path $PSScriptRoot -Parent
$imgTiles = @(
    (Join-Path $root 'terrainSrtmImgs\srtm_58_05.img\srtm_58_05.img'),
    (Join-Path $root 'terrainSrtmImgs\srtm_58_06.img\srtm_58_06.img'),
    (Join-Path $root 'terrainSrtmImgs\srtm_59_05.img\srtm_59_05.img'),
    (Join-Path $root 'terrainSrtmImgs\srtm_59_06.img\srtm_59_06.img')
)

foreach ($f in $imgTiles) {
    if (-not (Test-Path -LiteralPath $f)) {
        throw "Missing elevation file: $f"
    }
}

# 中间产物与最终输出统一写入 buildTerrainFiles 子目录
$work = Join-Path $PSScriptRoot 'buildTerrainFiles'
New-Item -ItemType Directory -Force -Path $work | Out-Null

$vrt = Join-Path $work 'shaanxi_mosaic.vrt'
$tif3857 = Join-Path $work 'shaanxi_3857.tif'
$terrainRgbTif = Join-Path $work 'shaanxi_terrain_rgb.tif'
$mbtiles = Join-Path $work 'terrain.mbtiles'

Write-Host "GDAL: $gdalWarp"

# ---------------------------------------------------------------------------
# Step 1: 虚拟镶嵌 — 将 4 块分幅合并为一个 VRT，无需复制原始数据
# ---------------------------------------------------------------------------
Write-Host "Building VRT from 4 SRTM/GEM tiles..."
Invoke-Native $gdalBuildVrt (@($vrt) + $imgTiles)

# ---------------------------------------------------------------------------
# Step 2: 重投影 — SRTM 原生坐标系 → Web Mercator (EPSG:3857)，供在线地图使用
# ---------------------------------------------------------------------------
Write-Host "Warping to Web Mercator (EPSG:3857)..."
Invoke-Native $gdalWarp @(
    '-t_srs', 'EPSG:3857',
    '-r', 'bilinear',
    '-multi',
    '-wo', 'NUM_THREADS=ALL_CPUS',
    $vrt,
    $tif3857
)

# ---------------------------------------------------------------------------
# Step 3: Terrain-RGB 编码 — Mapbox 标准高程编码公式
#   encoded = (elevation + 10000) * 10
#   R = floor(encoded / 65536), G = floor((encoded % 65536) / 256), B = encoded % 256
# 思极地图 raster-dem (encoding: mapbox) 依赖此格式解码高程。
# ---------------------------------------------------------------------------
Write-Host "Encoding Mapbox Terrain-RGB as a 3-band GeoTIFF..."
if (Test-Path $terrainRgbTif) { Remove-Item $terrainRgbTif -Force }

$encodedElevation = '((A.astype(float) + 10000) * 10)'
Invoke-Native $gdalPython @(
    $gdalCalc,
    '-A', $tif3857,
    "--outfile=$terrainRgbTif",
    '--format=GTiff',
    '--type=Byte',
    '--NoDataValue=0',
    '--overwrite',
    "--calc=minimum(255, maximum(0, floor($encodedElevation / 65536)))",
    "--calc=minimum(255, maximum(0, floor(($encodedElevation % 65536) / 256)))",
    "--calc=minimum(255, maximum(0, floor($encodedElevation % 256)))",
    '--co=COMPRESS=DEFLATE',
    '--co=INTERLEAVE=PIXEL'
)

# ---------------------------------------------------------------------------
# Step 4: 生成 MBTiles — 单文件 SQLite 瓦片包，避免数万 PNG 碎片
#   ELEVATION_TYPE=terrain-rgb 需 GDAL 3.0+
#   MAXZOOM 可调：级别越高文件越大、生成越慢
# ---------------------------------------------------------------------------
Write-Host "Creating Terrain-RGB MBTiles..."
if (Test-Path $mbtiles) { Remove-Item $mbtiles -Force }

Invoke-Native $gdalTranslate @(
    $terrainRgbTif,
    $mbtiles,
    '-of', 'MBTiles',
    '-co', 'ELEVATION_TYPE=terrain-rgb',
    '-co', 'TILE_FORMAT=PNG',
    '-co', 'ZOOM_LEVEL_STRATEGY=LOWER',
    '-co', 'MINZOOM=0',
    '-co', 'MAXZOOM=14'
)

Write-Host ""
Write-Host "Done: $mbtiles" -ForegroundColor Green
Write-Host "Start server: cd terrain-server && npm start"
