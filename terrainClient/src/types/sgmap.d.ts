export interface SGMapLngLatLike {
  lng: number
  lat: number
}

export type SGMapCenter = [number, number] | SGMapLngLatLike

export interface SGMapMapOptions {
  container: string | HTMLElement
  style: string
  center?: SGMapCenter
  zoom?: number
  pitch?: number
  bearing?: number
  maxPitch?: number
  localIdeographFontFamily?: string
  dragPan?: boolean
  scrollZoom?: boolean
  dragRotate?: boolean
}

export interface SGMapTerrainSpecification {
  source: string
  exaggeration?: number
}

export interface SGMapRasterDemSource {
  type: 'raster-dem'
  /** 思极 aegis 地形源，如 aegis://aegis.Terrain3D */
  url?: string
  tiles?: string[]
  tileSize?: number
  encoding?: 'sgmap' | 'terrarium' | 'epgis'
  maxzoom?: number
  minzoom?: number
  /** 西, 南, 东, 北 */
  bounds?: [number, number, number, number]
}

export interface SGMapSourceDataEvent {
  sourceId?: string
  isSourceLoaded?: boolean
  /** 瓦片内容加载完成时为 'content' */
  sourceDataType?: string
  tile?: unknown
}

export type SGMapEventListener =
  | (() => void)
  | ((event: SGMapSourceDataEvent) => void)

export interface SGMapMap {
  on(type: 'load' | 'style.load' | 'moveend' | 'idle', listener: () => void): void
  on(type: 'sourcedata', listener: (event: SGMapSourceDataEvent) => void): void
  off(type: 'load' | 'style.load' | 'moveend' | 'idle', listener: () => void): void
  off(type: 'sourcedata', listener: (event: SGMapSourceDataEvent) => void): void
  once(type: 'load' | 'style.load' | 'idle' | 'moveend', listener: () => void): void
  isStyleLoaded?(): boolean
  addSource(id: string, source: SGMapRasterDemSource): void
  removeSource(id: string): void
  getSource(id: string): unknown
  getTerrain(): SGMapTerrainSpecification | null | undefined
  setTerrain(spec: SGMapTerrainSpecification | null): void
  /** 注册自定义 raster-dem 源 ID，允许加载非 *.sg 域名瓦片 */
  _addCustomSource(sourceId: string): void
  _removeCustomSource(sourceId: string): void
  setPitch(pitch: number): void
  flyTo(options: {
    center?: SGMapCenter
    zoom?: number
    pitch?: number
    bearing?: number
    duration?: number
  }): void
  remove(): void
}

export interface SGMapTokenTask {
  login(appKey: string, appSecret: string): Promise<void>
}

export interface SGMapNamespace {
  Map: new (options: SGMapMapOptions) => SGMapMap
  tokenTask: SGMapTokenTask
}

declare global {
  interface Window {
    SGMap: SGMapNamespace
  }
}

export {}
