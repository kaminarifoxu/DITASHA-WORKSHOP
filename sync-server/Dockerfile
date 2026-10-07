FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node store.mjs server.mjs admin.mjs ./
COPY --chown=node:node public ./public
RUN mkdir -p /data && chown node:node /data
USER node
ENV DATA_DIR=/data PORT=8787 NODE_ENV=production
EXPOSE 8787
CMD ["node","server.mjs"]
