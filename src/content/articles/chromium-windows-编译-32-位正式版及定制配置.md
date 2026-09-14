---
title: Chromium Windows 编译 32 位正式版及定制配置
slug: chromium-windows-编译-32-位正式版及定制配置
publishedAt: '2022-11-09'
category: Chromium
summary: 整理 Chromium 在 Windows 上的源码拉取、32 位正式版编译及界面定制配置。
readingTime: 5
sourceId: '127750691'
---
## 准备工作

1. 准备能够访问 Chromium 代码仓库的网络环境。
2. 安装 Visual Studio 2019。建议使用默认路径安装到 C 盘，以减少额外的环境变量配置；Windows SDK 可以安装到其他磁盘。
3. 安装 Git。
4. 安装 Windows 10 SDK `10.0.20348.0`。实际版本以 `src/build/toolchain/win/setup_toolchain.py` 中的要求为准。

## 获取 depot_tools

先创建工作目录，例如 `D:\work`，然后克隆 Chromium 的构建工具：

```bat
cd /d D:\work
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
```

`depot_tools` 自带 Python 工具链。如果系统中已经安装了其他 Python 版本，可能需要检查 PATH 顺序，避免命令调用到不兼容的版本。

![depot_tools 目录](/images/articles/chromium-windows-编译-32-位正式版及定制配置/e7096edd4a67f87404ec.webp)

把 `D:\work\depot_tools` 添加到系统环境变量 `PATH` 的最前面。

![depot_tools 环境变量](/images/articles/chromium-windows-编译-32-位正式版及定制配置/0431e85d6df676c2e5a2.webp)

还需要设置以下系统环境变量：

```text
DEPOT_TOOLS_WIN_TOOLCHAIN=0
GYP_GENERATORS=msvs-ninja,ninja
GYP_MSVS_VERSION=2019
WindowsSdkDir=D:\Windows Kits\10
```

`WindowsSdkDir` 要按 Visual Studio 2019 实际使用的 SDK 路径填写。

## 拉取源码

进入 `depot_tools` 目录并更新工具：

```bat
cd /d D:\work\depot_tools
gclient
```

创建 Chromium 工作目录并拉取源码：

```bat
mkdir D:\work\chromium
cd /d D:\work\chromium
fetch --no-history chromium
```

下载中断后，可以继续同步：

```bat
gclient sync --with_branch_heads
```

进入源码目录并运行 hooks：

```bat
cd /d D:\work\chromium\src
gclient runhooks
```

默认配置可以直接使用 Ninja 编译：

```bat
ninja -C out\Default chrome -j 8
```

## 编译 32 位正式版

1. 打开 `D:\work\chromium\.gclient`，添加 `"checkout_pgo_profiles": True`。

   ![gclient PGO 配置](/images/articles/chromium-windows-编译-32-位正式版及定制配置/f072ac587cf53634eb26.webp)

2. 更新源码并生成工程：

   ```bat
   fetch --no-history chromium
   cd /d D:\work\chromium\src
   gn gen out\release --ide=vs --args=""
   gn args out\release-x86
   ```

3. 在 `gn args` 打开的配置窗口中加入：

   ```text
   is_debug = false
   target_cpu = "x86"
   is_official_build = true
   symbol_level = 0
   blink_symbol_level = 0
   v8_symbol_level = 0
   enable_nacl = false
   ffmpeg_branding = "Chrome"
   proprietary_codecs = true
   ```

4. 保存并关闭配置窗口，命令行会继续执行。

## 修改进程名称

如果需要修改生成程序的进程名称，可以调整 `src/chrome/build.gn`。

![修改 Chromium 进程名称](/images/articles/chromium-windows-编译-32-位正式版及定制配置/e067ee403b04b4f4f210.webp)

## 自定义界面

### 去除私钥提示

修改文件：

```text
chrome/browser/ui/startup/infobar_utils.cc
```

![去除私钥提示](/images/articles/chromium-windows-编译-32-位正式版及定制配置/4b3885c65639d0d584bd.webp)

### 去除默认浏览器提示

同样修改：

```text
chrome/browser/ui/startup/infobar_utils.cc
```

![去除默认浏览器提示](/images/articles/chromium-windows-编译-32-位正式版及定制配置/a2f0b4de2da1e8a7d0a5.webp)

### 修改注册表产品名称

修改文件：

```text
chrome/install_static/chromium_install_modes.cc
```

第一个 `kCompanyPathName` 是注册表根目录。如果还要增加子目录，可以设置 `install_suffix`，例如使用 `chromiumBrowser`。

![修改注册表产品名称](/images/articles/chromium-windows-编译-32-位正式版及定制配置/cde1906e73d758fd94e8.webp)

如果子目录只希望显示为 `Browser`，还需要修改：

```text
chrome/install_static/install_util.cc
```

![修改注册表子目录](/images/articles/chromium-windows-编译-32-位正式版及定制配置/c9a7bb588faf0dc500b0.webp)

### 去除工具栏实验室和登录按钮

修改以下文件：

```text
chrome/browser/ui/views/toolbar/toolbar_view.cc
chrome/browser/ui/views/frame/browser_view.cc
```

![修改 toolbar_view](/images/articles/chromium-windows-编译-32-位正式版及定制配置/0b4739eb2332bb78b0d6.webp)

![修改 browser_view](/images/articles/chromium-windows-编译-32-位正式版及定制配置/af0cc57d8bd988357b2a.webp)

### 去除设置页登录入口

依次修改：

```text
chrome/browser/resources/settings/settings_menu/settings_menu.html
chrome/browser/resources/settings/basic_page/basic_page.html
chrome/browser/resources/settings/route.ts
```

![修改 settings_menu](/images/articles/chromium-windows-编译-32-位正式版及定制配置/496508bfb54bef171c38.webp)

![修改 basic_page](/images/articles/chromium-windows-编译-32-位正式版及定制配置/75404983a0d67743de35.webp)

![修改 route.ts](/images/articles/chromium-windows-编译-32-位正式版及定制配置/9ce75853273c0664f98b.webp)

原本还计划完全禁用 Chromium 登录，但没有找到对应的完整代码入口，这里只保留已验证过的界面调整。

![设置页调整结果](/images/articles/chromium-windows-编译-32-位正式版及定制配置/e1442fb287700388aadf.webp)
