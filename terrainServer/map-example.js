/**
 * 思极地图 / Mapbox GL 风格 API 示例（在浏览器或思极地图 SDK 环境中使用）
 * 先执行: npm start
 */
function addLocalTerrain(map) {
  // 须在 Map 实例上注册（SGMap 全局无此方法）
  map._addCustomSource('local-terrain');

  map.addSource('local-terrain', {
    type: 'raster-dem',
    tiles: ['http://localhost:8080/terrain/{z}/{x}/{y}.png'],
    tileSize: 256,
    encoding: 'mapbox',
  });

  map.setTerrain({
    source: 'local-terrain',
    exaggeration: 1.0,
  });
}
