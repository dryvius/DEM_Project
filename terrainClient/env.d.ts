/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EPGIS_APP_KEY: string
  readonly VITE_EPGIS_APP_SECRET: string
  readonly VITE_EPGIS_SDK_URL: string
  readonly VITE_EPGIS_MAP_STYLE: string
  readonly VITE_TERRAIN_SOURCE: string
  readonly VITE_TERRAIN_TILE_URL: string
  readonly VITE_TERRAIN_URL: string
  readonly VITE_TERRAIN_MAX_ZOOM: string
  readonly VITE_TERRAIN_EXAGGERATION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
