---
title: Boost 在 Windows 下编译
slug: boost-在-windows-下编译
publishedAt: '2019-02-16'
category: C++
summary: 记录 Windows 下使用 bjam 或 b2 编译 Boost 静态库、动态库及常用参数的方法。
readingTime: 3
sourceId: '87429402'
---
Boost 的编译过程可以按需生成 `regex`、`date_time`、`random`、`system` 等常用库。

## 编译步骤

1. 从 [Boost 官网](https://www.boost.org/) 下载源码并解压。
2. 在 Boost 根目录运行 Windows 脚本 `bootstrap.bat`，生成 `bjam.exe` 或 `b2.exe`。
3. 打开命令提示符，执行以下命令：

```bat
bjam install ^
  --prefix="E:\boost_1_69_0\vs2015" ^
  --toolset=msvc-14.0 ^
  address-model=64 ^
  --with-system ^
  --with-date_time ^
  --with-random ^
  --with-regex ^
  link=static ^
  runtime-link=static ^
  threading=multi
```

上面的配置会生成 Visual Studio 2015 使用的 64 位静态库，参数可以根据实际环境调整。

![Boost 编译结果](/images/articles/boost-在-windows-下编译/4c99d872bcff48915e0c.webp)

## 库文件名说明

Boost 库文件名通常由以下几部分组成：

```text
BOOST_LIB_PREFIX + BOOST_LIB_NAME + "-" + BOOST_LIB_TOOLSET + "-"
+ BOOST_LIB_THREAD_OPT + "-" + BOOST_LIB_RT_OPT + "-" + BOOST_LIB_VERSION
```

- `BOOST_LIB_PREFIX`：静态库为 `lib`，动态链接库没有此前缀。
- `BOOST_LIB_NAME`：库的基本名称，例如 `boost_regex`。
- `BOOST_LIB_TOOLSET`：编译工具集名称，例如 `vc6`、`vc7`、`bcb5`。
- `BOOST_LIB_THREAD_OPT`：多线程版本为 `-mt`，单线程版本为空。
- `BOOST_LIB_VERSION`：Boost 版本号，例如版本 `x.y` 会写成 `x_y`。

`BOOST_LIB_RT_OPT` 用来描述运行库和构建类型，可以组合以下字符：

- `s`：静态链接运行库；不出现时表示动态链接。
- `g`：调试或诊断运行库；不出现时表示 Release。
- `d`：Debug 版本；不出现时表示 Release。
- `p`：STLPort 版本。

对于 Visual C++，`g` 和 `d` 通常会一起出现。

## bjam 常用参数

Boost 自带的 `bootstrap.bat` 会生成 `bjam.exe` 和 `b2.exe`，并复制到 Boost 根目录。也可以进入 `tools/build`，通过其中的脚本或项目源码构建这些工具。

|   |   |   |
|---|---|---|
|**Feature**|**Allowed values**|**Notes**|
|variant|debug,release||
|link|shared,static|Determines if Boost.Build creates shared or static libraries|
|threading|single,multi|Cause the produced binaries to be thread-safe. This requires proper support in the source code itself.|
|address-model|32,64|Explicitly request either 32-bit or 64-bit code generation. This typically requires that your compiler is appropriately configured. Please refer to the section called “C++ Compilers” and your compiler documentation in case of problems.|
|toolset|(Depends on configuration)|The C++ compiler to use. See the section called “C++ Compilers” for a detailed list.<br><br>(Vs2008)msvc-8.0 (vs2010)msvc-10.0|
|include|(Arbitrary string)|Additional include paths for C and C++ compilers.|
|define|(Arbitrary string)|Additional macro definitions for C and C++ compilers. The string should be either SYMBOL or SYMBOL=VALUE|
|cxxflags|(Arbitrary string)|Custom options to pass to the C++ compiler.|
|cflags|(Arbitrary string)|Custom options to pass to the C compiler.|
|linkflags|(Arbitrary string)|Custom options to pass to the C++ linker.|
|runtime-link|shared,static|Determines if shared or static version of C and C++ runtimes should be used.|

|   |   |
|---|---|
|**--build-dir=**<builddir>|编译的临时文件会放在builddir里(这样比较好管理，编译完就可以把它删除了)|
|**--stagedir=**<stagedir>|存放编译后库文件的路径，默认是stage|
|**--build-type=**complete|编译所有版本，不然只会编译一小部分版本（确切地说是相当于:variant=release, threading=multi;link=shared\|static;runtime-link=shared）|
|**variant=**debug\|release|决定编译什么版本（对应文件中的d 调试版本 不出现表示 release 版）|
|**link=**static\|shared|决定使用静态库还是动态库。（对应文件中的BOOST_LIB_PREFIX ）|
|**threading=**single\|multi|决定使用单线程还是多线程库。（对应文件中的BOOST_LIB_THREAD_OPT）|
|**runtime-link=**static\|shared|决定是静态还是动态链接C/C++标准库。（对应文件中的BOOST_LIB_THREAD_OPT）|
|**--with-**<library>|只编译指定的库，如输入--with-regex就只编译regex库了。|
|**--show-**libraries|显示需要编译的库名称|

## 编译组合示例

### 静态库 + 静态运行库

```bat
bjam.exe --toolset=msvc-10.0 --with-date_time runtimelink=static link=static stage
```

生成静态库，并静态链接 C 运行时库。

- Debug：`libboost_date_time-vc100-mt-sgd-1_48.lib`
- Release：`libboost_date_time-vc100-mt-s-1_48.lib`

### 静态库 + 动态运行库

```bat
bjam.exe --toolset=msvc-10.0 --with-date_time runtimelink=shared link=static stage
```

生成静态库，并动态链接 C 运行时库。

- Debug：`libboost_date_time-vc100-mt-gd-1_48.lib`
- Release：`libboost_date_time-vc100-mt-1_48.lib`

### 动态库 + 动态运行库

```bat
bjam.exe --toolset=msvc-10.0 --with-date_time runtimelink=shared link=shared stage
```

生成动态库，并动态链接 C 运行时库。

- 导入库 Debug：`boost_date_time-vc100-mt-gd-1_48.lib`
- 导入库 Release：`boost_date_time-vc100-mt-1_48.lib`
- DLL Debug：`boost_date_time-vc100-mt-gd-1_48.dll`
- DLL Release：`boost_date_time-vc100-mt-1_48.dll`
