---
title: 修复 npm_config_node_gyp 环境变量问题
slug: 修复-npm-config-node-gyp-环境变量问题
publishedAt: '2020-12-01'
category: Node.js
summary: 修复重新编译 Electron 后 node-gyp 无法找到 npm_config_node_gyp 的环境变量配置。
readingTime: 1
sourceId: '110428510'
---
重新编译 Electron 源码并调整环境变量后，`node-gyp` 在编译 Addon 插件时无法正常工作。

## 处理方法

1. 全局安装 `node-gyp`：

   ```powershell
   npm install -g node-gyp
   ```

2. 根据实际安装目录设置 `npm_config_node_gyp`：

   ```text
   npm_config_node_gyp=C:\Program Files\nodejs\node_modules\node-gyp\bin\node-gyp.js
   ```

3. 关闭并重新打开命令提示符，让新的环境变量生效。
