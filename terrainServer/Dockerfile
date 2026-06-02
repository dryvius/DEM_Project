# 运行时镜像：仅提供 MBTiles 瓦片服务，不在容器内执行 GDAL 构建。
# 构建 terrain.mbtiles 请在宿主机运行 npm run build，再通过 volume 挂载或 COPY 进镜像。
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    TERRAIN_CACHE_CONTROL="public, max-age=31536000, immutable"

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

RUN mkdir -p buildTerrainFiles

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
