const express = require('express');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');  // 使用 sqlite 数据库

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const CACHE_CONTROL = process.env.TERRAIN_CACHE_CONTROL || 'no-store';
// 从 buildTerrainFiles 目录中读取 terrain.mbtiles 文件（Docker 可通过 MBTILES_PATH 覆盖）
const MBTILES_PATH =
  process.env.MBTILES_PATH ||
  path.join(__dirname, 'buildTerrainFiles', 'terrain.mbtiles');

if (!fs.existsSync(MBTILES_PATH)) {
  console.error(
    `未找到 terrain.mbtiles，请先运行: npm run build\n` +
      `（需已安装 GDAL 3.x，见 README.md）`
  );
  process.exit(1);
}

const app = express();
const db = new DatabaseSync(MBTILES_PATH, { readOnly: true });  // 只读模式打开 sqlite 数据库

// 获取地形瓦片数据
const getTile = db.prepare(
  'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
);

/** 缺失瓦片时返回合法 Terrain-RGB PNG，避免 404 文本导致 DEM 解析崩溃 */
const fallbackRow = db.prepare('SELECT tile_data FROM tiles LIMIT 1').get();
const FALLBACK_TILE = fallbackRow?.tile_data
  ? Buffer.from(fallbackRow.tile_data)
  : null;

// 发送地形瓦片数据
function sendTerrainTile(res, tileData) {
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', CACHE_CONTROL);
  res.send(Buffer.from(tileData));
}

// 跨域请求处理
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, Origin, X-Requested-With',
  )
  res.setHeader('Access-Control-Max-Age', '86400')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

// 地形瓦片接口
app.get('/terrain/:z/:x/:y.png', (req, res) => {
  const z = Number.parseInt(req.params.z, 10);
  const x = Number.parseInt(req.params.x, 10);
  const y = Number.parseInt(req.params.y, 10);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
    res.status(400).send('Invalid tile coordinates');
    return;
  }
  const tmsY = 2 ** z - 1 - y;
  const row = getTile.get(z, x, tmsY);
  if (row?.tile_data) {
    sendTerrainTile(res, row.tile_data);
    return;
  }
  if (FALLBACK_TILE) {
    sendTerrainTile(res, FALLBACK_TILE);
    return;
  }
  res.status(404).send('Tile not found');
});

// 健康检查接口
app.get('/health', (_req, res) => {
  const metaRows = db.prepare('SELECT name, value FROM metadata').all()
  const meta = Object.fromEntries(metaRows.map((r) => [r.name, r.value]))
  const zoomStats = db
    .prepare(
      'SELECT zoom_level, COUNT(*) AS count FROM tiles GROUP BY zoom_level ORDER BY zoom_level',
    )
    .all()
  res.json({
    ok: true,
    mbtiles: path.basename(MBTILES_PATH),
    bounds: meta.bounds ?? null,
    minzoom: meta.minzoom ?? null,
    maxzoom: meta.maxzoom ?? null,
    zoomLevels: zoomStats,
  })
});

app.listen(PORT, HOST, () => {
  console.log(`Terrain-RGB 瓦片服务: http://${HOST}:${PORT}/terrain/{z}/{x}/{y}.png`);
});
