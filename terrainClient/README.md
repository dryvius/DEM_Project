# terrainClient · 思极地图 + 本地高程演示

基于 **Vite + Vue 3 + TypeScript** 的思极地图（SGMap SDK v3+）示例，默认挂载本地 Terrain-RGB 瓦片为 `raster-dem` 三维地形。

## 项目结构

```
terrainClient/
├── index.html
├── vite.config.ts          # 开发服务器与 /terrain 代理
├── package.json
├── .env.example            # 环境变量模板（复制为 .env）
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/index.ts
│   ├── views/MapView.vue
│   ├── components/EpgisMap.vue
│   ├── composables/useEpgisMap.ts   # SDK 登录、地图初始化、地形挂载流程
│   ├── constants/map.ts             # 视角、bounds、瓦片 URL 等常量
│   ├── utils/terrain.ts             # 本地/官网 DEM 挂载与预检
│   ├── utils/loadScript.ts
│   └── types/                       # SGMap 与地图状态类型
```

## 前置条件

1. 已在思极地图开放平台申请 `appKey` / `appSecret`（卫星影像底图）
2. 本地 Terrain-RGB 瓦片服务已就绪，默认地址：

   ```
   http://localhost:8080/terrain/{z}/{x}/{y}.png
   ```

   开发模式下 `src/utils/terrain.ts` 会将相对路径解析为上述地址（`resolveTerrainTileUrl`），供 SDK 在 Web Worker 内请求。

## 快速开始

在 `terrainClient` 目录下执行：

```powershell
npm install
copy .env.example .env
# 编辑 .env，填入 VITE_EPGIS_APP_KEY 与 VITE_EPGIS_APP_SECRET
npm run dev
```

浏览器访问 `http://localhost:5173`（端口见 `vite.config.ts` 中 `server.port`）。

生产构建与预览：

```powershell
npm run build
npm run preview
```

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改：

| 变量 | 说明 |
|------|------|
| `VITE_EPGIS_APP_KEY` | 思极地图 AppKey |
| `VITE_EPGIS_APP_SECRET` | 思极地图 AppSecret（可为 Base64，见 `decodeBase64Utf8`） |
| `VITE_EPGIS_SDK_URL` | SDK 地址，默认 `https://map.sgcc.com.cn/maps?v=3.1.0` |
| `VITE_EPGIS_MAP_STYLE` | 底图样式，默认 `aegis://styles/aegis/Satellite512` |
| `VITE_TERRAIN_SOURCE` | `local`（默认）或 `official` |
| `VITE_TERRAIN_TILE_URL` | 本地瓦片模板，默认见 `src/constants/map.ts` 中 `LOCAL_TERRAIN_TILE_URL` |
| `VITE_TERRAIN_MAX_ZOOM` | 本地地形最大层级，默认 `10`（须与瓦片数据一致） |
| `VITE_TERRAIN_EXAGGERATION` | 地形夸张系数，默认 `2.5` |
| `VITE_TERRAIN_URL` | 官网地形源，`official` 模式下使用，默认 `aegis://aegis.Terrain3D` |

## 开发代理（`vite.config.ts`）

开发服务器将 `/terrain` 代理到 `http://localhost:8080`，便于在浏览器中直接访问瓦片路径做调试。本地 DEM 挂载时仍以 `terrain.ts` 中的 `DEFAULT_TERRAIN_SERVER`（`http://localhost:8080`）解析绝对 URL，避免 Worker 内相对路径失效。

## 地形加载流程

核心逻辑分布在以下文件中：

| 步骤 | 文件 | 说明 |
|------|------|------|
| 地图初始化 | `src/composables/useEpgisMap.ts` | 加载 SDK、`tokenTask.login`、创建 `SGMap.Map` |
| 等待样式就绪 | 同上 | `style.load` / `load` 后于 `idle` 回调中挂 DEM，避免与 `_render` 同栈 |
| 本地 DEM | `src/utils/terrain.ts` | `mountLocalTerrain` → `map._addCustomSource` + `raster-dem`（`encoding: sgmap`） |
| 启用三维 | `src/utils/terrain.ts` | `enableTerrainSafely` 延迟 `setTerrain`，再 `flyToAsync` 抬升俯仰角 |
| 官网 DEM | `src/utils/terrain.ts` | `mountOfficialTerrain`，数据源 `aegis://aegis.Terrain3D` |

默认在 `VITE_TERRAIN_SOURCE=local` 时使用本地瓦片；若账号已开通官网 Terrain3D，可在 `.env` 中设置 `VITE_TERRAIN_SOURCE=official`。

本地模式相关常量（覆盖范围、默认 zoom、bounds）见 `src/constants/map.ts`。

## 常见问题

**Q: 提示未配置思极地图密钥？**  
A: 确认已创建 `.env` 并填写 `VITE_EPGIS_APP_KEY`、`VITE_EPGIS_APP_SECRET`。

**Q: 提示无法访问地形瓦片？**  
A: 确认 `http://localhost:8080/health` 可访问，且瓦片 URL 与 `VITE_TERRAIN_TILE_URL` / `resolveTerrainTileUrl` 一致。

**Q: 地形呈平面或 DEM 报错？**  
A: 检查 `VITE_TERRAIN_MAX_ZOOM` 是否与瓦片实际层级一致；演示视角使用 `TERRAIN_DEMO_ZOOM`（见 `src/constants/map.ts`）。

**Q: Worker 内瓦片 404 或相对路径无效？**  
A: 使用绝对 `http://` 地址，或保持默认相对路径由 `resolveTerrainTileUrl` 在开发环境补全为 `http://localhost:8080/...`。

**Q: 如何切换官网地形？**  
A: `.env` 设置 `VITE_TERRAIN_SOURCE=official`，可选配置 `VITE_TERRAIN_URL`。
