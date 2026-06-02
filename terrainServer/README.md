# 陕西省 GEM 高程 → 本地 Terrain-RGB 瓦片服务

将 SRTM/GEM 高程数据合并为单个 `buildTerrainFiles/terrain.mbtiles`，由 Node.js 读取 MBTiles 并提供 XYZ 瓦片接口，供地图 `raster-dem`（`encoding: mapbox`）使用。

## 项目结构

```
terrainServer/
├── server.js                 # Express 瓦片服务（/terrain、/health）
├── build.ps1                 # GDAL 构建脚本（npm run build 调用）
├── package.json
├── Dockerfile
├── docker-compose.yml        # 仅运行瓦片服务
├── docker-compose.nginx.yml  # 可选：同栈 Nginx 反代
├── docker/
│   └── nginx.conf
└── buildTerrainFiles/        # 构建产物目录（需 gitignore 大文件时自行处理）
    ├── shaanxi_mosaic.vrt    # 中间文件
    ├── shaanxi_3857.tif
    ├── shaanxi_terrain_rgb.tif
    └── terrain.mbtiles       # 服务读取的最终产物
```

## 环境要求

1. **GDAL 3.0+**（`npm run build` 必需，需支持 `ELEVATION_TYPE=terrain-rgb`）
   - 推荐 [OSGeo4W](https://trac.osgeo.org/osgeo4w/) 或 QGIS，并将 `bin` 加入系统 PATH
   - 验证：`gdalinfo --version`
2. **Node.js 22.5+**（`server.js` 使用内置 `node:sqlite`，无需额外原生模块）

## 源数据

构建脚本 `build.ps1` 会读取其中 `$imgTiles` 配置的 4 个 EHFA 格式 `.img` 文件（文件头 `EHFA_HEADER_TAG`，GDAL 可直接读取）。路径在脚本内定义，部署前请按实际环境修改并确保文件存在。

默认流程：4 块分幅 → `gdalbuildvrt` 镶嵌 → `gdalwarp`（EPSG:3857）→ Terrain-RGB 编码 → `gdal_translate` 生成 MBTiles。

## 本地开发与运行

在 `terrainServer` 目录下执行：

```powershell
npm install
npm run build    # 调用 build.ps1，生成 buildTerrainFiles/terrain.mbtiles（耗时数分钟）
npm start        # http://localhost:8080/terrain/{z}/{x}/{y}.png
```

### 服务环境变量（`server.js`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `MBTILES_PATH` | `./buildTerrainFiles/terrain.mbtiles` | MBTiles 文件路径 |
| `TERRAIN_CACHE_CONTROL` | `no-store` | 瓦片 `Cache-Control` 响应头 |

健康检查：`GET /health` 返回 MBTiles 元数据与各级别瓦片数量。

## Docker 部署

镜像**只负责读 MBTiles 并提供瓦片 API**，不在容器内执行 GDAL。请先在宿主机执行 `npm run build` 生成 `buildTerrainFiles/terrain.mbtiles`，再启动容器。

```bash
# 确认产物存在
ls buildTerrainFiles/terrain.mbtiles

# 构建并启动（默认映射宿主机 8080）
docker compose up -d --build

# 验证
curl http://localhost:8080/health
curl -I http://localhost:8080/terrain/10/821/388.png
```

### Compose 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `TERRAIN_PORT` | `8080` | 宿主机映射端口 |
| `MBTILES_HOST_PATH` | `./buildTerrainFiles/terrain.mbtiles` | 宿主机 MBTiles 路径（只读挂载到容器 `/data/terrain.mbtiles`） |

容器内由 `docker-compose.yml` 设置 `MBTILES_PATH=/data/terrain.mbtiles`、`TERRAIN_CACHE_CONTROL=public, max-age=31536000, immutable`。

### 可选：同栈 Nginx（`docker-compose.nginx.yml`）

```bash
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
# 默认 http://localhost:8081/terrain/{z}/{x}/{y}.png
# 反代配置见 docker/nginx.conf
```

### 更新瓦片数据

替换宿主机上的 `terrain.mbtiles` 后重启即可，无需重建镜像：

```bash
docker compose restart terrain-server
```

### 为何不在 Docker 内构建 MBTiles？

GDAL 构建链依赖 GB 级原始 `.img` 与完整 GDAL 工具链，镜像体积大、构建耗时长。当前方案将**重构建**放在宿主机（`build.ps1`），**轻量运行时**放在 Docker（`Dockerfile` + `server.js`）。

## 地图客户端接入示例

瓦片 URL 模板：

```
http://<服务地址>:8080/terrain/{z}/{x}/{y}.png
```

Mapbox GL / 兼容 API 示例：

```javascript
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
```

生产环境若经 Nginx 反代，将上述 URL 换为对外域名与路径即可；反代需保留 `/terrain/` 前缀与上游 `server.js` 路由一致。

## 构建参数

| 项 | 位置 | 说明 |
|----|------|------|
| 最大缩放级别 | `build.ps1` 中 `MAXZOOM=14` | 越大文件越大、生成越慢 |
| 源数据路径 | `build.ps1` 中 `$imgTiles` | 4 块 SRTM/GEM 分幅路径 |

## 常见问题

**Q: 启动报错「未找到 terrain.mbtiles」？**  
A: 先在本目录执行 `npm run build`，并确认 `buildTerrainFiles/terrain.mbtiles` 存在。

**Q: `ELEVATION_TYPE=terrain-rgb` 报错？**  
A: GDAL 版本低于 3.0，请升级 OSGeo4W 或 QGIS 自带 GDAL。

**Q: 瓦片位置上下颠倒？**  
A: `server.js` 已对 TMS/XYZ 做 Y 轴转换：`tmsY = 2^z - 1 - y`。

**Q: 跨域或预检失败？**  
A: `server.js` 已配置 `Access-Control-Allow-Origin: *` 并处理 `OPTIONS`；若客户端带 `Authorization` 等自定义头，需确保请求命中本服务或反代未剥离 CORS 头。

**Q: 缺失瓦片导致 DEM 解析异常？**  
A: 无数据时 `server.js` 会返回库内 fallback PNG（见 `FALLBACK_TILE`），避免 404 文本响应。

**Q: 想提高最远缩放级别？**  
A: 修改 `build.ps1` 中 `-co MAXZOOM=14` 后重新 `npm run build`。
