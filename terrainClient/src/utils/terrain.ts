import {
  LOCAL_TERRAIN_BOUNDS,
  LOCAL_TERRAIN_MAX_ZOOM,
  LOCAL_TERRAIN_MIN_ZOOM,
  LOCAL_TERRAIN_SOURCE_ID,
  LOCAL_TERRAIN_TILE_SIZE,
  LOCAL_TERRAIN_TILE_URL,
  OFFICIAL_TERRAIN_MAX_ZOOM,
  OFFICIAL_TERRAIN_SOURCE_ID,
  OFFICIAL_TERRAIN_TILE_SIZE,
  OFFICIAL_TERRAIN_URL,
  TERRAIN_DEMO_CENTER,
} from '@/constants/map'
import type { SGMapCenter, SGMapMap } from '@/types/sgmap'

const OFFICIAL_TERRAIN_TILEJSON_URL = 'https://map.sgcc.com.cn/v1/aegis.Terrain3D.json'
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
const PNG_COLOR_TYPE_OFFSET = 25

export interface OfficialTerrainTileJson {
  tilesize?: number
  maxzoom?: number
  minzoom?: number
}

export interface OfficialTerrainOptions {
  url?: string
  exaggeration?: number
  maxzoom?: number
  tileSize?: number
}

export interface LocalTerrainOptions {
  tileUrl: string
  exaggeration?: number
  minzoom?: number
  maxzoom?: number
}

const DEFAULT_TERRAIN_SERVER = 'http://localhost:8080'

/** 读取 TileJSON 元数据，使 tileSize / maxzoom 与服务端一致 */
export async function fetchOfficialTerrainMeta(
  tileJsonUrl: string = OFFICIAL_TERRAIN_TILEJSON_URL,
): Promise<OfficialTerrainTileJson | null> {
  try {
    const response = await fetch(tileJsonUrl)
    if (!response.ok) {
      return null
    }
    return (await response.json()) as OfficialTerrainTileJson
  } catch {
    return null
  }
}

function applyTerrain(map: SGMapMap, sourceId: string, exaggeration: number): void {
  map.setTerrain({
    source: sourceId,
    exaggeration,
  })
}

/** 等待地图进入 idle，避免在 _render 栈内操作地形 */
export function waitForMapIdle(map: SGMapMap, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false

    const finish = (): void => {
      if (settled) {
        return
      }
      settled = true
      map.off('idle', finish)
      window.clearTimeout(timeoutId)
      resolve()
    }

    map.once('idle', finish)
    const timeoutId = window.setTimeout(finish, timeoutMs)
  })
}

/** 脱离当前调用栈（含 SGMap _render），在下一帧执行 */
export function deferToNextFrame(task: () => void): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        task()
        resolve()
      })
    })
  })
}

/**
 * 在 addSource 与视角就绪后安全启用三维地形。
 * setTerrain 不可与 addSource 同栈同步调用，否则会触发 emptyDEMTexture / pack 崩溃。
 */
export async function enableTerrainSafely(
  map: SGMapMap,
  sourceId: string,
  exaggeration: number,
): Promise<void> {
  await deferToNextFrame(() => {
    applyTerrain(map, sourceId, exaggeration)
  })
  await waitForMapIdle(map, 12000)
}

export interface SGMapFlyToOptions {
  center?: SGMapCenter
  zoom?: number
  pitch?: number
  bearing?: number
  duration?: number
}

export function flyToAsync(map: SGMapMap, options: SGMapFlyToOptions): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const duration = options.duration ?? 0

    const finish = (): void => {
      if (settled) {
        return
      }
      settled = true
      map.off('moveend', finish)
      map.off('idle', finish)
      window.clearTimeout(timeoutId)
      resolve()
    }

    map.once('moveend', finish)
    map.once('idle', finish)
    map.flyTo(options)
    const timeoutId = window.setTimeout(finish, duration + 1500)
  })
}

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length <= PNG_COLOR_TYPE_OFFSET) {
    return false
  }

  return PNG_SIGNATURE.every((value, index): boolean => bytes[index] === value)
}

function describePngColorType(colorType: number): string {
  switch (colorType) {
    case 0:
      return '灰度图'
    case 2:
      return 'RGB'
    case 3:
      return '索引色'
    case 4:
      return '灰度 + Alpha'
    case 6:
      return 'RGBA'
    default:
      return `未知类型 ${colorType}`
  }
}

function assertTerrainRgbPng(bytes: Uint8Array, url: string): void {
  if (!isPng(bytes)) {
    throw new Error(`响应不是合法 PNG：${url}`)
  }

  const colorType = bytes[PNG_COLOR_TYPE_OFFSET] ?? -1
  if (colorType !== 2 && colorType !== 6) {
    throw new Error(
      `本地高程瓦片不是 Terrain-RGB/RGBA PNG（当前为${describePngColorType(
        colorType,
      )}）。请重新运行 terrain-server/build.ps1 生成 RGB 瓦片。`,
    )
  }
}

/** 主线程预检 terrain-server 是否可达（Worker 内失败时难以排查） */
export async function probeLocalTerrainServer(tileUrlTemplate: string): Promise<void> {
  const z = LOCAL_TERRAIN_MIN_ZOOM
  const [lng, lat] = TERRAIN_DEMO_CENTER
  const scale = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * scale)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  )

  const tilePath = tileUrlTemplate
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
  const url = resolveTerrainTileUrl(tilePath)

  try {
    const response = await fetch(url, { cache: 'reload' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('image')) {
      throw new Error(`响应非图片 (${contentType})`)
    }
    assertTerrainRgbPng(new Uint8Array(await response.arrayBuffer()), url)
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : '网络错误'
    throw new Error(
      `无法访问地形瓦片 ${url}（${detail}）。请确认 terrain-server 已启动：cd terrain-server && npm start`,
    )
  }
}

/**
 * 思极官网文档：aegis://aegis.Terrain3D 三维地形 DEM
 * @see https://map.sgcc.com.cn （地形示例）
 */
export function addOfficialTerrain(map: SGMapMap, options: OfficialTerrainOptions = {}): void {
  const {
    url = OFFICIAL_TERRAIN_URL,
    maxzoom = OFFICIAL_TERRAIN_MAX_ZOOM,
    tileSize = OFFICIAL_TERRAIN_TILE_SIZE,
  } = options

  if (map.getSource(OFFICIAL_TERRAIN_SOURCE_ID)) {
    map.removeSource(OFFICIAL_TERRAIN_SOURCE_ID)
  }

  map.addSource(OFFICIAL_TERRAIN_SOURCE_ID, {
    type: 'raster-dem',
    url,
    tileSize,
    maxzoom,
  })
}

/** 拉取 TileJSON 元数据并挂载官网 DEM，返回实际使用的 tileSize */
export async function mountOfficialTerrain(
  map: SGMapMap,
  options: OfficialTerrainOptions = {},
): Promise<{ tileSize: number; maxzoom: number }> {
  const meta = await fetchOfficialTerrainMeta()
  const tileSize = options.tileSize ?? meta?.tilesize ?? OFFICIAL_TERRAIN_TILE_SIZE
  const maxzoom = options.maxzoom ?? meta?.maxzoom ?? OFFICIAL_TERRAIN_MAX_ZOOM

  addOfficialTerrain(map, {
    ...options,
    tileSize,
    maxzoom,
  })

  await waitForMapIdle(map)

  return { tileSize, maxzoom }
}

/**
 * 思极地图在 Web Worker 中请求瓦片，相对路径无法解析，须转为绝对 URL。
 * 开发环境直连 terrain-server（8080），比经 Vite 代理更稳定。
 */
export function resolveTerrainTileUrl(template: string): string {
  const trimmed = template.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (import.meta.env.DEV) {
    return `${DEFAULT_TERRAIN_SERVER}${path}`
  }
  return `${window.location.origin}${path}`
}

export function registerLocalTerrainSource(map: SGMapMap): void {
  map._addCustomSource(LOCAL_TERRAIN_SOURCE_ID)
}

export function unregisterLocalTerrainSource(map: SGMapMap): void {
  map._removeCustomSource(LOCAL_TERRAIN_SOURCE_ID)
}

/** 本地 GEM Terrain-RGB 瓦片（需 terrain-server + map._addCustomSource） */
export function addLocalTerrain(map: SGMapMap, options: LocalTerrainOptions): void {
  const {
    tileUrl,
    minzoom = LOCAL_TERRAIN_MIN_ZOOM,
    maxzoom = LOCAL_TERRAIN_MAX_ZOOM,
  } = options
  const absoluteTileUrl = resolveTerrainTileUrl(tileUrl)

  registerLocalTerrainSource(map)

  if (map.getSource(LOCAL_TERRAIN_SOURCE_ID)) {
    map.removeSource(LOCAL_TERRAIN_SOURCE_ID)
  }

  map.addSource(LOCAL_TERRAIN_SOURCE_ID, {
    type: 'raster-dem',
    tiles: [absoluteTileUrl],
    tileSize: LOCAL_TERRAIN_TILE_SIZE,
    encoding: 'sgmap',
    bounds: LOCAL_TERRAIN_BOUNDS,
    minzoom,
    maxzoom,
  })
}

export function getDefaultTerrainTileUrl(): string {
  if (import.meta.env.DEV) {
    return LOCAL_TERRAIN_TILE_URL
  }
  return `${DEFAULT_TERRAIN_SERVER}${LOCAL_TERRAIN_TILE_URL}`
}

/** 挂载本地 DEM 源（不含 setTerrain，须再调用 enableTerrainSafely） */
export async function mountLocalTerrain(
  map: SGMapMap,
  options: LocalTerrainOptions = { tileUrl: getDefaultTerrainTileUrl() },
): Promise<void> {
  const tileUrl = options.tileUrl ?? getDefaultTerrainTileUrl()
  const minzoom = options.minzoom ?? LOCAL_TERRAIN_MIN_ZOOM
  const maxzoom = options.maxzoom ?? LOCAL_TERRAIN_MAX_ZOOM

  await probeLocalTerrainServer(tileUrl)

  addLocalTerrain(map, {
    tileUrl,
    minzoom,
    maxzoom,
  })

  await waitForMapIdle(map)
}
