---
title: Windows 10 编译 Electron 源码
slug: windows-10-编译-electron-源码
publishedAt: '2020-12-01'
category: Electron
summary: 整理 Windows 10 上配置 depot_tools、Visual Studio、SDK 并拉取和编译 Electron 源码的流程。
readingTime: 4
sourceId: '110422777'
---
1.  **环境安装与配置**
    1. **下载depot_tools工具仓库**
    2. **安装vs2017C++开发环境**
    3. **安装windows 10 sdk**
    4.  **安装python2.7**
    5.  **安装nodejs**
    6. **设置环境变量**
2.  **拉取代码**
3. **工程生成与编译构建**
    1. **生成工程**
    2. **编译**
    3. **打包**

当需要对 electron 进行删减或逻辑修改以实现个性化的需求时，第一步要做的就是其源码构建环境的搭建。由于涉及 chromium 和 nodejs 的源码编译，整个构建项目是非常庞大的，其过程中任何一个小环节出现问题都可能会导致最终的失败。

electron 官方维护了 [build-tools](https://github.com/electron/build-tools "build-tools") 工具库，以尽可能简单的实现源码构建环境配置。

在不采用该工具的情况下，我们需要参考官方指南手动进行相关环境配置。下面以 electron@5.0.8 版本为例（事实上任何版本的环境配置流程都类似，个人进行过 5.0.x 和 8.5.x 版本的环境配置尝试），简要介绍手动搭建 electron 源码构建环境的流程，并对遇到的相关问题进行汇总以供参考。

**1.** **环境安装与配置**

需要准备的环境、工具或建议：

- windows 10 系统
- 100G 以上硬盘空间
- CPU 性能强劲的 PC
- 科学上网渠道
- vs2017c++ 开发环境（必须是 vs2017，vs2019会报错某文件路径找不到）
- windowsSDK（必须从微软官方单独下载安装，从 vs2017 安装的热河版本，最后都会提示版本过低）
- nodejs 最新LTS稳定版本
- depot_tools
- 建议使用 cmd 管理员模式执行各种命令

**1.1** **下载** **depot_tools** **工具仓库**

|   |   |
|---|---|
|1<br><br>2<br><br>3<br><br>4|# 官方仓库：<br><br>git clone [https://chromium.googlesource.com/chromium/tools/depot_tools.git](https://chromium.googlesource.com/chromium/tools/depot_tools.git "https://chromium.googlesource.com/chromium/tools/depot_tools.git")<br><br># 国内可用（不建议使用，只能做初始的源码下载，最终执行命令进行更新时还是会从 googlesource 下载资源）：<br><br>git clone [https://source.codeaurora.org/quic/lc/chromium/tools/depot_tools](https://source.codeaurora.org/quic/lc/chromium/tools/depot_tools "https://source.codeaurora.org/quic/lc/chromium/tools/depot_tools")|

或者下载 zip 压缩文件后再解压（可迅雷下载到）： [https://storage.googleapis.com/chrome-infra/depot_tools.zip](https://storage.googleapis.com/chrome-infra/depot_tools.zip "https://storage.googleapis.com/chrome-infra/depot_tools.zip")

然后设置 depot_tools 目录路径到 PATH 环境变量中。

**1.2** **安装** **vs2017c++** **开发环境**

必须安装 Visual Studio 2017 IDE（社区版、专业版、企业版都可以），建议选择安装“Desktop development with C++” 组件及它下面的“MFC and ATL support” 组件。

如果安装路径不是默认的话。需要增加path

vs2017_install=安装路径

WINDOWSSDKDIR=DRIVE:\path\to\Windows Kits\10, replacing DRIVE: with the drive thatWindows Kits is on. Often, this will be C:.

官方下载地址（下载旧版需微软账号登录）：

[https://visualstudio.microsoft.com/zh-hans/vs/older-downloads/](https://visualstudio.microsoft.com/zh-hans/vs/older-downloads/ "https://visualstudio.microsoft.com/zh-hans/vs/older-downloads/")

**1.3** **安装** **Windows SDK**

需要单独下载和安装 Windows 10 SDK，安装最新版本即可。从微软官网下载 Windows SDK 的镜像安装，且安装需勾选 Debug Tools。Windows 10 SDK 官方下载地址：

[https://developer.microsoft.com/zh-cn/windows/downloads/windows-10-sdk/](https://developer.microsoft.com/zh-cn/windows/downloads/windows-10-sdk/ "https://developer.microsoft.com/zh-cn/windows/downloads/windows-10-sdk/")

**1.4** **安装** **Python2.7.17**

depot_tools 内其实自带有 python2 工具链，但这里我们参考官方指南选择自己全局安装一个。

Python2.7.17 官方下载地址参考： [Python Release Python 2.7.17 | Python.org](https://www.python.org/downloads/release/python-2717 "Python Release Python 2.7.17 | Python.org")

按默认方式安装成功后(若修改了安装位置，路径务必不要有空格、中文以避免不必要的麻烦)，需要设置一下环境变量 PATH 值：增加 C:\Python27 和 C:\Python27\Scripts 路径，其位置应当在 depot_tools 的前面。

然后进入安装目录 C:\Python27\Scripts，从命令行执行 easy_install.exe 以安装 pip。

最后还需要安装一个 pywin32。执行命令: pip install pywin32 -i [Simple Index](https://mirrors.aliyun.com/pypi/simple/ "Simple Index")

**1.5** **安装** **nodejs**

在 electron 项目的初始化流程中需要用到 nodejs、yarn 等工具命令，所以 nodejs 是必须的。

当前版本我们使用10.13.0。 nodejs 的淘宝镜像下载地址： [https://npm.taobao.org/mirrors/node](https://npm.taobao.org/mirrors/node "https://npm.taobao.org/mirrors/node")

安装 nodejs 完成后，全局安装 yarn，执行命令：npm i -g yarn

当然你也可以自己想办法安装

**1.6** **设置环境变量**

前面已经有涉及环境变量 PATH 的设置，如果你不知道如何设置环境变量，可以搜索学习一下。

- DEPOT_TOOLS_WIN_TOOLCHAIN=0：让 depot_tools 不下载 VS 2017 等工具链，使用系统全局安装的。
- GIT_CACHE_PATH=D:\.git_cache：用于 git 缓存目录，很有必要设置， 因为后面拉取代码量很大、时间很长，中途中断可能性很高，此时缓存的存在就相当救命了。
- DEPOT_TOOLS_DIR=D:\<..>\electron\depot_tools

**2.** **拉取代码**

该过程必须能够正常访问到 Google 代码仓库（即你必须有一个科学上网的渠道）。

在希望进行代码拉取与编译的目录下，打开命令提示符，执行如下命令（注意，其中的 @v5.0.8 为计划要构建的 electron 版本 tag）：

|   |
|---|
|1.mkdir electron && cd electron<br><br>2.gclient config  --name "src/electron"  --unmanaged  [https://github.com/electron/electron@v5.0.8](https://github.com/electron/electron@v5.0.8 "https://github.com/electron/electron@v5.0.8")|

该过程会更新 depot_tools、下载各种 depot_tools 需要的工具链，所以该过程可能会比较长。
执行成功后会生成一个 .gclient 文件，内容参考：

solutions = [
{ "name" : 'src/electron',
"url" : '[https://github.com/electron/electron@v5.0.8](https://github.com/electron/electron@v5.0.8 "https://github.com/electron/electron@v5.0.8")',
"deps_file" : 'DEPS',
"managed" : False,
"custom_deps" : {
},
"custom_vars": {},
},
]

接着执行如下命令：

|   |   |
|---|---|
|1|gclient sync --with_branch_heads --with_tags|

该命令即同步各种仓库代码到本地，由于仓库比较庞大，其过程可能相当的长(具体还取决于你的网速)，还可能会出现 N 次异常中断。

如果出现异常，可重新执行该命令，直到最后成功。中断后重新执行时，前面设置的 GIT_CACHE_PATH 指定目录中的缓存就发挥其作用了。

**3.** **工程生成与编译构建**

**3.1** **生成工程**

进入 src 目录，执行工程生成命令：

|   |   |
|---|---|
|1<br><br>2<br><br>3<br><br>4<br><br>5<br><br>6<br><br>7<br><br>8<br><br>9<br><br>10|# 进入 src 目录<br><br>cd src<br><br># 设置临时的环境变量<br><br>set CHROMIUM_BUILDTOOLS_PATH=%cd%\buildtools<br><br># 生成工程(Testing)<br><br>gn gen out/Testing --args="import(\"//electron/build/args/testing.gn\")"<br><br># 生成工程(Release)<br><br>gn gen out/Release --args="import(\"//electron/build/args/release.gn\")"<br><br># 生成工程(debug)<br><br>gn gen out/Debug --args="import(\"//electron/build/args/debug.gn\")"|

我们首先生成 Testing 工程进行测试，执行成功后，将在 out/Testing 目录生成 GN 工程。

**生成****vs****工程：**

如要生成 vs 工程(不是必须的)，可以加上 --ide=vs2017 参数，即执行：

|   |   |
|---|---|
|1|gn gen out/Testing --args="import(\"//electron/build/args/testing.gn\")" --ide=vs2017|

注意，vs 打开有 5600+ 个项目，所以会相当卡。

**生成** **32** **位工程：**

默认生成的是 64 位，加上参数 target_cpu=\"x86\" 可以生成 32 位的。命令参考：

|   |   |
|---|---|
|1|gn gen out/Release-x86 --args="import(\"//electron/build/args/Release.gn\") target_cpu=\"x86\""|

**3.2** **编译**

如果前面工程生成成功，则可进行编译操作。执行命令：

|   |   |
|---|---|
|1<br><br>2<br><br>3<br><br>4|# 编译 testing 版本<br><br>ninja -C out/Testing electron<br><br># 编译 release 版本<br><br>ninja -C out/Release electron|

对于 5.0.x 版本则有 17000 多个编译任务。其编译过程会使用多线程并行执行，相当消耗的 CPU，整个过程也比较耗时（一般需要几个小时，具体视 CPU 性能而有所差异）。

你可以使用 sccache 命令来提高后面的构建过程(仅据官方文档介绍提供参考，未进行过尝试)：

|   |   |
|---|---|
|1|gn gen out/Release --args="import(\"//electron/build/args/release.gn\") cc_wrapper=\"%CD%\electron\external_binaries\sccache\""|

如果顺利完成，则可以找到生成出来的 ./out/Release/electron.exe 文件。基本的 electron 源码构建即告结束。

**3.3** **打包**

执行一下命令可以将构建结果打包为 zip 文件，然后就可以拿到项目里使用了：

|   |   |
|---|---|
|1<br><br>2|electron/script/strip-binaries.py -d out/Release<br><br>ninja -C out/Release [electron:electron_dist_zip](/)|
