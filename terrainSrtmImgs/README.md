# terrainSrtmImgs

本目录用于存放 **SRTM/GDEM 数字高程** 原始分幅数据，供 `terrainServer/build.ps1` 构建 Terrain-RGB 瓦片使用。

## 目录说明

| 内容 | 说明 |
|------|------|
| 数据格式 | EHFA 格式 `.img` 文件（GDAL 可直接读取） |
| 默认分幅 | 陕西省及周边区域 4 块分幅：`srtm_58_05`、`srtm_58_06`、`srtm_59_05`、`srtm_59_06` |
| 目录结构 | 每块分幅解压后置于同名子目录，例如 `srtm_58_05.img/srtm_58_05.img` |

> 原始高程数据体积较大，已通过 `.gitignore` 排除，需在本机自行下载并放置于此目录。

## 数据来源

文件夹中的相关数据可在 **[地理空间数据云](https://www.gscloud.cn/home)** 下载对应资源：

1. 打开 [https://www.gscloud.cn/home](https://www.gscloud.cn/home) 并注册/登录
2. 进入 **公开数据 → DEM 数字高程数据**
3. 检索并下载所需区域的 **90 米 SRTM** 或 **30 米 GDEM** 分幅
4. 解压后将 `.img` 文件按上述目录结构放入本文件夹

## 相关文档

- 项目总览：[../README.md](../README.md)
- 构建脚本配置：`terrainServer/build.ps1` 中的 `$imgTiles` 路径
