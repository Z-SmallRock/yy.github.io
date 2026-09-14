---
title: Electron package.json 打包配置
slug: electron-package-json-打包配置
publishedAt: '2020-12-25'
updatedAt: '2020-12-25'
category: Electron
summary: 一份常用的 Electron Builder 配置示例，包含 Windows 安装包、图标、输出目录和安装选项。
readingTime: 3
sourceId: '111677368'
---
electron常用package.json配置如下

```javascript
{
    "name": "xxxxxxxxxxx",
    "license": "ISC",
    "author": "xxxxxxxxxx",
    "build": {
        "asar": true,
        "win": {
            "target": [
                {
                    "arch": [
                        "ia32"
                    ],
                    "target": "nsis"
                }
            ],
            "icon": "./resources/ico.ico"
        },
        "directories": {
            "output": "build"
        },
        "productName": "xxxx",
        "extraResources": {
            "to": "../assets",
            "from": "./assets/"
        },
        "appId": "com.qq.xxxx"
    },
    "env": "online",
    "scripts": {
        "test": "echo \"Error: no test specified\" && exit 1",
        "start": "electron .",
        "dist": "electron-builder",
        "pack": "electron-builder --dir"
    },
    "keywords": [
        "win student"
    ],
    "devDependencies": {
        "electron": "5.0.8",
        "electron-builder": "^22.9.1"
    },
    "main": "src/main.js",
    "dependencies": {
        "websocket": "^1.0.31",
        "ping": "^0.2.3",
        "ping-tcp-js": "1.3.0",
        "qqvolume": "^1.0.5",
        "mqtt": "4.2.1",
        "tar-fs": "^2.0.0",
        "electron-store": "^5.1.1",
        "electron-package": "^0.1.0",
        "qqghook": "1.0.3",
        "electron-log": "^4.1.0",
        "node-fetch": "^2.6.0"
    },
    "description": "description"
}
```

使用electron-builder进行打包。npm run dist/pack  (dist:打包以及安装包 pack只打包。不生成安装包)
