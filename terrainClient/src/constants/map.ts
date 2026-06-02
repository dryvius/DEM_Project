/** 陕西省区域概览（西安） */
export const SHAANXI_DEFAULT_CENTER: [number, number] = [108.95, 34.27]

export const SHAANXI_DEFAULT_ZOOM = 10

/**
 * 三维地形演示视角（秦岭/华山一带，落在本地 GEM 覆盖范围内）
 * 本地 terrain.mbtiles 当前仅含 z=10，须与此 zoom 对齐才能加载 DEM。
 */
export const TERRAIN_DEMO_CENTER: [number, number] = [110.09, 34.48]

export const TERRAIN_DEMO_ZOOM = 10

export const TERRAIN_DEMO_PITCH = 75

export const TERRAIN_DEMO_BEARING = -25

/** 思极官网三维地形（aegis://aegis.Terrain3D） */
export const OFFICIAL_TERRAIN_SOURCE_ID = 'terrain'

export const OFFICIAL_TERRAIN_URL = 'aegis://aegis.Terrain3D'

/** 与 aegis.Terrain3D.json 中 tilesize 一致（256），误配 512 会导致 DEM 采样错位、地形呈平面 */
export const OFFICIAL_TERRAIN_TILE_SIZE = 256

export const OFFICIAL_TERRAIN_MAX_ZOOM = 14

/** 官网示例为 1.5；略提高默认值便于在影像底图上观察山体 */
export const OFFICIAL_TERRAIN_EXAGGERATION = 2.5

/** 本地 terrain-server（陕西省 GEM → Terrain-RGB MBTiles） */
export const LOCAL_TERRAIN_SOURCE_ID = 'local-terrain'

/** 与 terrain.mbtiles metadata 一致 */
export const LOCAL_TERRAIN_MIN_ZOOM = 10

export const LOCAL_TERRAIN_MAX_ZOOM = 10

export const LOCAL_TERRAIN_TILE_SIZE = 256

/** 与 terrain.mbtiles metadata.bounds 一致（西, 南, 东, 北） */
export const LOCAL_TERRAIN_BOUNDS: [number, number, number, number] = [
  105, 29.999835412614964, 115.00030517578125, 40,
]

/** 本地瓦片会反复重建，版本参数用于避开浏览器缓存旧 DEM PNG */
export const LOCAL_TERRAIN_TILE_URL = '/terrain/{z}/{x}/{y}.png?v=terrain-rgb-v2'

export const LOCAL_TERRAIN_EXAGGERATION = 2.5
