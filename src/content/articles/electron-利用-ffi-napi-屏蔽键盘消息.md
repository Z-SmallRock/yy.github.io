---
title: Electron 利用 ffi-napi 屏蔽键盘消息
slug: electron-利用-ffi-napi-屏蔽键盘消息
publishedAt: '2020-08-27'
category: Electron
summary: 介绍 Electron 通过 ffi-napi 调用 Windows DLL 钩子屏蔽键盘消息时的参数与架构问题。
readingTime: 3
sourceId: '108266390'
---
Electron自带的键盘屏蔽无法满足要求的时候：比如屏蔽Alt+F4 或者Alt+Tab的

我们可以考虑使用ffi-napi调用dll的方式。利用C++的钩子函数进行键盘或者鼠标事件的屏蔽。中途遇到了几个坑。记录一下

1.无法识别HWND的问题

```javascript
var handle = win.getNativeWindowHandle()
获取到Electron的窗口句柄。但是在传参的时候发现无法识别HWND。
const dll = ffi.Library('GHookDll', {
    'SetHook': // 声明这个dll中的一个函数
        [
            'void', ['void*'], // 用json的格式罗列其返回类型和参数类型
        ]
});

利用void*的方式传参。在dll中的时候有C++去从void*转成hwnd来使用
```

2.

```javascript
'ClearHook': [
        'void',['void']
    ]


一般C++中参数如果为空的时候可以直接不传即可。但在在调用释放钩子函数的时候。发现如果不传参数的话直接报参数无法是被的错误。这个时候可以在dll的ClearHook函数中 ClearHook(void)这种方式。当然也可以直接写int型。这样在Electron使用的时候。直接传个0.
```

目前就做键盘屏蔽的时候遇到这两个坑。

后续开发过程中发现。可以使用addon的方式自己封装。更加方便管理

开发Electron注意各个模块的版本

```javascript
// electron 版本

console.log('process.versions.electron', process.versions.electron)

// ABI版本

console.log('process.versions.modules', process.versions.modules)

// NODE版本
console.log('process.versions.node', process.versions.node)

// V8 引擎版本
console.log('process.versions.v8', process.versions.v8)

// chrome版本
console.log('process.versions.chrome', process.versions.chrome)

// 架构信息
console.log('process.env.PROCESSOR_ARCHITECTURE', process.env.PROCESSOR_ARCHITECTURE)
```

如发现不对。欢迎指正
