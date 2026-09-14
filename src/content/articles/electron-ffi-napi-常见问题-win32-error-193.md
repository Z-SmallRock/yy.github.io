---
title: Electron ffi-napi 常见问题：Win32 error 193
slug: electron-ffi-napi-常见问题-win32-error-193
publishedAt: '2020-08-25'
category: Electron
summary: 排查 Electron ffi-napi 加载 DLL 时出现 Win32 error 193 的位数不匹配问题。
readingTime: 1
sourceId: '108219585'
---
使用 Electron 和 `ffi-napi` 加载 DLL 时，出现以下错误：

```text
Error: Dynamic Linking Error: Win32 error 193
```

![Win32 error 193 报错信息](/images/articles/electron-ffi-napi-常见问题-win32-error-193/592a48e90a73d11aaf83.webp)

## 分析结果

错误码 `193` 表示“不是有效的 Win32 应用程序”。本次问题是 Node.js 为 64 位，而加载的 DLL 为 32 位，二者架构不一致。

将 DLL 重新编译为 64 位后即可正常加载。实际排查时，应确认 Electron、Node.js、原生模块和目标 DLL 使用相同的架构。
