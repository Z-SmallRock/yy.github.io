---
title: Electron preload 加载 Sentry 时出现 Unexpected token import
slug: electron-preload-加载-sentry-时出现-unexpected-token-import
publishedAt: '2020-10-19'
category: Electron
summary: 解决 Electron preload 加载 Sentry 时因 CommonJS 环境不支持 import 语法而报错的问题。
readingTime: 1
sourceId: '109156740'
---
 electron 在preload加载crash模块的时候报错  Unable to load preload script [SyntaxError: Unexpected token *](https://stackoverflow.com/questions/39436322/node-js-syntaxerror-unexpected-token-import "SyntaxError: Unexpected token *")

经分析`import` is indeed part of ES6 所以如果需要争取预加载carsh模块。可以把import改用require需要如下使用

```javascript
const  {init} = require('@sentry/electron')
const {crashReporter} = require('electron')

// 报告常规错误
init({
    dsn: 'url'
})

// 报告系统错误
crashReporter.start({
    companyName: 'companyName',
    productName: 'productName',
    ignoreSystemCrashHandler: true,
    submitURL: 'url'
})
```
