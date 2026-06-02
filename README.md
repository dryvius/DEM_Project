# DEM_Project

陕西省 SRTM/GEM 高程数据 → Terrain-RGB 瓦片 → 思极地图三维地形演示的完整工作流。

本项目包含：**高程数据预处理**、**本地瓦片服务**、**地图前端演示** 三个部分，可离线构建 MBTiles 并在浏览器中挂载 `raster-dem` 三维地形。

## 架构概览

```
terrainSrtmImgs/          原始 SRTM/GEM 分幅 (.img)
        │
        ▼  GDAL 构建链 (build.ps1)
terrainServer/
  buildTerrainFiles/
    terrain.mbtiles       Terrain-RGB 瓦片库
        │
        ▼  Node.js 瓦片 API (:8080)
terrainClient/            Vue 3 + 思极地图 SDK
  raster-dem 三维地形演示
```

| 模块 | 说明 | 详细文档 |
|------|------|----------|
| `terrainSrtmImgs/` | 原始高程分幅数据（EHFA 格式 `.img`，未纳入 Git） | — |
| `terrainServer/` | GDAL 构建脚本 + Express MBTiles 瓦片服务 | [terrainServer/README.md](./terrainServer/README.md) |
| `terrainClient/` | Vite + Vue 3 思极地图本地 DEM 演示 | [terrainClient/README.md](./terrainClient/README.md) |

## 环境要求

| 组件 | 版本 / 工具 |
|------|-------------|
| Node.js | ≥ 22.5（瓦片服务使用内置 `node:sqlite`） |
| GDAL | ≥ 3.0，需支持 `ELEVATION_TYPE=terrain-rgb`（推荐 [OSGeo4W](https://trac.osgeo.org/osgeo4w/) 或 QGIS） |
| 思极地图密钥 | 前端底图需 `appKey` / `appSecret`（[思极地图开放平台](https://map.sgcc.com.cn/)） |

## 快速开始

### 1. 准备源数据

将 SRTM/GEM 分幅文件放入 `terrainSrtmImgs/`，并在 `terrainServer/build.ps1` 中配置 `$imgTiles` 路径（默认读取 4 块陕西省周边分幅）。

> 原始高程与构建产物体积较大，已通过 `.gitignore` 排除，需在本机自行准备。

### 2. 构建 MBTiles 并启动瓦片服务

```powershell
cd terrainServer
npm install
npm run build    # 调用 build.ps1，生成 buildTerrainFiles/terrain.mbtiles（耗时数分钟）
npm start        # http://localhost:8080/terrain/{z}/{x}/{y}.png
```

验证服务：

```powershell
curl http://localhost:8080/health
```

### 3. 启动地图演示客户端

```powershell
cd terrainClient
npm install
copy .env.example .env
# 编辑 .env，填入 VITE_EPGIS_APP_KEY 与 VITE_EPGIS_APP_SECRET
npm run dev
```

浏览器访问 `http://localhost:5173`，默认使用本地 Terrain-RGB 瓦片作为三维地形源。

## 瓦片 API

```
GET /terrain/{z}/{x}/{y}.png   # Terrain-RGB 瓦片（encoding: mapbox）
GET /health                    # 服务健康检查与 MBTiles 元数据
```

瓦片 URL 模板：

```
http://localhost:8080/terrain/{z}/{x}/{y}.png
```

Mapbox GL / 兼容 API 接入示例：

```javascript
map.addSource('local-terrain', {
  type: 'raster-dem',
  tiles: ['http://localhost:8080/terrain/{z}/{x}/{y}.png'],
  tileSize: 256,
  encoding: 'mapbox',
});

map.setTerrain({ source: 'local-terrain', exaggeration: 1.0 });
```

## Docker 部署（仅瓦片服务）

镜像只负责读取 MBTiles 并提供 API，**不在容器内执行 GDAL 构建**。请先在宿主机完成 `npm run build`：

```bash
cd terrainServer
docker compose up -d --build
curl http://localhost:8080/health
```

可选 Nginx 反代见 [terrainServer/README.md](./terrainServer/README.md)。

## 项目结构

```
DEM_Project/
├── README.md                 # 本文件
├── .gitignore
├── terrainSrtmImgs/          # 原始 SRTM/GEM 数据（Git 忽略）
├── terrainServer/            # 瓦片构建与服务
│   ├── server.js
│   ├── build.ps1
│   ├── buildTerrainFiles/    # 构建产物（Git 忽略大文件）
│   ├── Dockerfile
│   └── docker-compose.yml
└── terrainClient/            # 思极地图三维地形演示
    ├── src/
    ├── .env.example
    └── vite.config.ts
```

## 构建流程说明

GDAL 构建链（`terrainServer/build.ps1`）：

1. **镶嵌** — 多块 `.img` 分幅 → `gdalbuildvrt` 合并
2. **重投影** — `gdalwarp` 至 EPSG:3857
3. **Terrain-RGB 编码** — `gdal_translate` + `ELEVATION_TYPE=terrain-rgb`
4. **打包** — 输出 `terrain.mbtiles`（MBTiles 格式）

前端地形挂载流程见 [terrainClient/README.md](./terrainClient/README.md) 中的「地形加载流程」章节。

## 数据与 Git

以下内容**不会**提交到 Git 仓库（见根目录 `.gitignore`）：

- `terrainSrtmImgs/` — 原始高程数据
- `terrainServer/buildTerrainFiles/*.tif`、`.mbtiles`、`.vrt` — 构建产物
- `**/node_modules/`、`**/.env` — 依赖与环境变量

克隆仓库后需自行准备源数据并执行 `npm run build` 生成瓦片。

## 常见问题

**Q: 启动瓦片服务报错「未找到 terrain.mbtiles」？**  
A: 在 `terrainServer` 目录执行 `npm run build`，确认 `buildTerrainFiles/terrain.mbtiles` 已生成。

**Q: 前端提示无法访问地形瓦片？**  
A: 确认 `http://localhost:8080/health` 可访问，且 `terrainClient` 的 `VITE_TERRAIN_TILE_URL` 配置正确。

**Q: `ELEVATION_TYPE=terrain-rgb` 报错？**  
A: GDAL 版本低于 3.0，请升级 OSGeo4W 或 QGIS 自带 GDAL。

**Q: 地形呈平面或 DEM 解析异常？**  
A: 检查 `VITE_TERRAIN_MAX_ZOOM` 是否与瓦片实际层级一致；缺失瓦片时服务端会返回 fallback PNG 避免 404。

更多问题请参阅各子模块 README。

## 许可证

本项目仅供学习与内部演示使用。SRTM/GEM 高程数据请遵循相应数据提供方的使用条款；思极地图 SDK 与底图服务需遵守[思极地图开放平台](https://map.sgcc.com.cn/)协议。
