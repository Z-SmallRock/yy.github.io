---
title: Electron Builder：app-builder.exe ERR_ELECTRON_BUILDER_EXECUTE
slug: electron-builder-app-builder-exe-err-electron-builder-execute
publishedAt: '2020-09-09'
category: Electron
summary: 记录 Electron Builder 执行 app-builder.exe 失败时改用 Yarn 和镜像配置的处理方法。
readingTime: 1
sourceId: '108486521'
---
![Electron Builder 报错信息](/images/articles/electron-builder-app-builder-exe-err-electron-builder-execute/c21e644affbe1cb18130.webp)

使用 `cnpm` 执行 Electron Builder 打包时出现 `ERR_ELECTRON_BUILDER_EXECUTE`。

## 处理方式

可以改用 Yarn。先安装 Yarn：

```powershell
npm install -g yarn --registry=https://registry.npm.taobao.org
```

再配置依赖下载源：

```powershell
yarn config set registry https://registry.npm.taobao.org -g
yarn config set sass_binary_site http://cdn.npm.taobao.org/dist/node-sass -g
```

配置完成后，使用以下命令重新打包：

```powershell
yarn run pack
```
