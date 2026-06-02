import { onBeforeUnmount, ref, shallowRef } from 'vue'
import {
  LOCAL_TERRAIN_EXAGGERATION,
  LOCAL_TERRAIN_MAX_ZOOM,
  LOCAL_TERRAIN_MIN_ZOOM,
  LOCAL_TERRAIN_SOURCE_ID,
  OFFICIAL_TERRAIN_EXAGGERATION,
  OFFICIAL_TERRAIN_MAX_ZOOM,
  OFFICIAL_TERRAIN_SOURCE_ID,
  OFFICIAL_TERRAIN_URL,
  TERRAIN_DEMO_BEARING,
  TERRAIN_DEMO_CENTER,
  TERRAIN_DEMO_PITCH,
  TERRAIN_DEMO_ZOOM,
} from '@/constants/map'
import type { MapErrorInfo, MapLoadState } from '@/types/map'
import type { SGMapMap } from '@/types/sgmap'
import { loadScript } from '@/utils/loadScript'
import {
  enableTerrainSafely,
  flyToAsync,
  getDefaultTerrainTileUrl,
  mountLocalTerrain,
  mountOfficialTerrain,
  unregisterLocalTerrainSource,
} from '@/utils/terrain'

const DEFAULT_SDK_URL = 'https://map.sgcc.com.cn/maps?v=3.1.0'
// const DEFAULT_MAP_STYLE = 'aegis://styles/aegis/Streets-v2'
const DEFAULT_MAP_STYLE = 'aegis://styles/aegis/Satellite512'
const DEFAULT_TERRAIN_SOURCE = 'local'

function getEnvOrDefault(key: keyof ImportMetaEnv, fallback: string): string {
  const value = import.meta.env[key]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function parseZoom(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? String(fallback), 10)
  return Number.isFinite(value) ? value : fallback
}

function parseExaggeration(raw: string | undefined, fallback: number): number {
  const value = Number.parseFloat(raw ?? String(fallback))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function useLocalTerrainSource(): boolean {
  return getEnvOrDefault('VITE_TERRAIN_SOURCE', DEFAULT_TERRAIN_SOURCE) === 'local'
}

/**
 * 将 Base64 字符串解码为 UTF-8 明文（后端对 key/sn 做 Base64 编码时使用）
 */
export function decodeBase64Utf8(encoded: string): string {
  const trimmed = (encoded || '').trim().replace(/\s/g, '')
  if (!trimmed) return ''
  const binary = atob(trimmed)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

export function useEpgisMap(containerId: string) {
  const loadState = ref<MapLoadState>('idle')
  const errorInfo = ref<MapErrorInfo | null>(null)
  const mapInstance = shallowRef<SGMapMap | null>(null)

  let styleLoadHandler: (() => void) | null = null
  let mapLoadHandler: (() => void) | null = null
  let terrainReady = false
  let localTerrainMounted = false

  async function initMap(): Promise<void> {
    loadState.value = 'loading'
    errorInfo.value = null

    const appKey = 'your_app_key'
    const appSecret = 'your_app_secret'

    if (!appKey || !appSecret) {
      loadState.value = 'error'
      errorInfo.value = {
        message:
          '未配置思极地图密钥。请复制 .env.example 为 .env 并填写 VITE_EPGIS_APP_KEY / VITE_EPGIS_APP_SECRET。',
      }
      return
    }

    const sdkUrl = getEnvOrDefault('VITE_EPGIS_SDK_URL', DEFAULT_SDK_URL)
    const mapStyle = getEnvOrDefault('VITE_EPGIS_MAP_STYLE', DEFAULT_MAP_STYLE)
    const useLocalTerrain = useLocalTerrainSource()
    const terrainUrl = getEnvOrDefault('VITE_TERRAIN_URL', OFFICIAL_TERRAIN_URL)
    const terrainTileUrl = getEnvOrDefault('VITE_TERRAIN_TILE_URL', getDefaultTerrainTileUrl())
    const exaggeration = parseExaggeration(
      import.meta.env.VITE_TERRAIN_EXAGGERATION,
      useLocalTerrain ? LOCAL_TERRAIN_EXAGGERATION : OFFICIAL_TERRAIN_EXAGGERATION,
    )
    const terrainMaxZoom = parseZoom(
      import.meta.env.VITE_TERRAIN_MAX_ZOOM,
      useLocalTerrain ? LOCAL_TERRAIN_MAX_ZOOM : OFFICIAL_TERRAIN_MAX_ZOOM,
    )

    try {
      await loadScript(sdkUrl)

      if (!window.SGMap) {
        throw new Error('思极地图 SDK 未正确加载，请检查 VITE_EPGIS_SDK_URL 或网络。')
      }

      await window.SGMap.tokenTask.login(appKey, decodeBase64Utf8(appSecret))

      const container = document.getElementById(containerId)
      if (!container) {
        throw new Error(`找不到地图容器 #${containerId}`)
      }

      const map = new window.SGMap.Map({
        container,
        style: mapStyle,
        center: TERRAIN_DEMO_CENTER,
        zoom: TERRAIN_DEMO_ZOOM,
        // 须先以 pitch 0 初始化，待 DEM 瓦片就绪后再抬升视角，否则 SGMap 会在 emptyDEMTexture 处崩溃
        pitch: 0,
        bearing: TERRAIN_DEMO_BEARING,
        maxPitch: 85,
        localIdeographFontFamily: 'Microsoft YaHei',
        scrollZoom: true,
        dragPan: true,
        dragRotate: true,
      })

      mapInstance.value = map

      const mountTerrain = (): void => {
        if (terrainReady) {
          return
        }
        if (!map.isStyleLoaded?.()) {
          return
        }
        terrainReady = true

        // 不可在 style.load / tileLoaded 的 _render 回调栈内 addSource，须等 idle 后再挂载 DEM
        map.once('idle', () => {
          void (async (): Promise<void> => {
            try {
              if (useLocalTerrain) {
                await mountLocalTerrain(map, {
                  tileUrl: terrainTileUrl,
                  minzoom: LOCAL_TERRAIN_MIN_ZOOM,
                  maxzoom: terrainMaxZoom,
                })
                localTerrainMounted = true

                await enableTerrainSafely(map, LOCAL_TERRAIN_SOURCE_ID, exaggeration)

                // 地形开启并进入稳定态后再抬升俯仰角，避免 SGMap 首帧创建 emptyDEMTexture 崩溃
                await flyToAsync(map, {
                  center: TERRAIN_DEMO_CENTER,
                  zoom: TERRAIN_DEMO_ZOOM,
                  pitch: TERRAIN_DEMO_PITCH,
                  bearing: TERRAIN_DEMO_BEARING,
                  duration: 1200,
                })
              } else {
                await mountOfficialTerrain(map, {
                  url: terrainUrl,
                  exaggeration,
                  maxzoom: terrainMaxZoom,
                })

                await enableTerrainSafely(map, OFFICIAL_TERRAIN_SOURCE_ID, exaggeration)

                await flyToAsync(map, {
                  center: TERRAIN_DEMO_CENTER,
                  zoom: TERRAIN_DEMO_ZOOM,
                  pitch: TERRAIN_DEMO_PITCH,
                  bearing: TERRAIN_DEMO_BEARING,
                  duration: 1200,
                })
              }

              loadState.value = 'ready'
            } catch (error: unknown) {
              loadState.value = 'error'
              errorInfo.value = {
                message:
                  error instanceof Error
                    ? error.message
                    : useLocalTerrain
                      ? '本地高程加载失败，请确认 terrain-server 已启动（npm start）。'
                      : '官网高程加载失败',
              }
            }
          })()
        })
      }

      // 影像等样式需等 style.load 后再挂 DEM，否则 setTerrain 可能不作用于栅格底图
      styleLoadHandler = mountTerrain
      map.once('style.load', styleLoadHandler)

      mapLoadHandler = mountTerrain
      map.once('load', mapLoadHandler)
    } catch (error: unknown) {
      loadState.value = 'error'
      errorInfo.value = {
        message: error instanceof Error ? error.message : '地图初始化失败',
      }
    }
  }

  function destroyMap(): void {
    const map = mapInstance.value
    if (map) {
      if (styleLoadHandler) {
        map.off('style.load', styleLoadHandler)
      }
      if (mapLoadHandler) {
        map.off('load', mapLoadHandler)
      }
      if (localTerrainMounted) {
        unregisterLocalTerrainSource(map)
        localTerrainMounted = false
      }
      map.setTerrain(null)
      map.remove()
    }
    mapInstance.value = null
    styleLoadHandler = null
    mapLoadHandler = null
    terrainReady = false
    loadState.value = 'idle'
  }

  onBeforeUnmount(() => {
    destroyMap()
  })

  return {
    loadState,
    errorInfo,
    mapInstance,
    initMap,
    destroyMap,
  }
}
