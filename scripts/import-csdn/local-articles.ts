import { slugifyTitle } from "./write-content";

export interface LocalArticleMetadata {
  filename: string;
  title: string;
  slug: string;
  category: string;
  publishedAt: string;
  updatedAt?: string;
  summary: string;
  sourceId: string;
}

export const localArticles = [
  {
    filename: "boost在windows下编译.md",
    title: "Boost 在 Windows 下编译",
    slug: "boost-在-windows-下编译",
    category: "C++",
    publishedAt: "2019-02-16",
    summary:
      "记录 Windows 下使用 bjam 或 b2 编译 Boost 静态库、动态库及常用参数的方法。",
    sourceId: "87429402",
  },
  {
    filename: "C++ zip文件压缩解压缩 qt解压zip.md",
    title: "C++ ZIP 文件压缩与解压：Qt 解压 ZIP",
    slug: "c-zip-文件压缩与解压-qt-解压-zip",
    category: "C++",
    publishedAt: "2018-03-30",
    summary:
      "介绍 C++ zip/unzip 接口的基本用法，以及在 Qt 项目中封装 ZIP 解压功能的思路。",
    sourceId: "79760590",
  },
  {
    filename:
      "chromium windows编译32位正式版以及私钥，默认浏览器，按钮去除等功能.md",
    title: "Chromium Windows 编译 32 位正式版及定制配置",
    slug: "chromium-windows-编译-32-位正式版及定制配置",
    category: "Chromium",
    publishedAt: "2022-11-09",
    summary:
      "整理 Chromium 在 Windows 上的源码拉取、32 位正式版编译及界面定制配置。",
    sourceId: "127750691",
  },
  {
    filename: "Electron ffi-napi 使用常见问题 error 193.md",
    title: "Electron ffi-napi 常见问题：Win32 error 193",
    slug: "electron-ffi-napi-常见问题-win32-error-193",
    category: "Electron",
    publishedAt: "2020-08-25",
    summary:
      "排查 Electron ffi-napi 加载 DLL 时出现 Win32 error 193 的位数不匹配问题。",
    sourceId: "108219585",
  },
  {
    filename: "electron package.json 打包配置.md",
    title: "Electron package.json 打包配置",
    slug: "electron-package-json-打包配置",
    category: "Electron",
    publishedAt: "2020-12-25",
    updatedAt: "2020-12-25",
    summary:
      "一份常用的 Electron Builder 配置示例，包含 Windows 安装包、图标、输出目录和安装选项。",
    sourceId: "111677368",
  },
  {
    filename:
      "Electron-builder app-builder.exe ERR_ELECTRON_BUILDER_EXECUTE.md",
    title:
      "Electron Builder：app-builder.exe ERR_ELECTRON_BUILDER_EXECUTE",
    slug:
      "electron-builder-app-builder-exe-err-electron-builder-execute",
    category: "Electron",
    publishedAt: "2020-09-09",
    summary:
      "记录 Electron Builder 执行 app-builder.exe 失败时改用 Yarn 和镜像配置的处理方法。",
    sourceId: "108486521",
  },
  {
    filename: "Electron利用ffi-napi屏蔽键盘消息.md",
    title: "Electron 利用 ffi-napi 屏蔽键盘消息",
    slug: "electron-利用-ffi-napi-屏蔽键盘消息",
    category: "Electron",
    publishedAt: "2020-08-27",
    summary:
      "介绍 Electron 通过 ffi-napi 调用 Windows DLL 钩子屏蔽键盘消息时的参数与架构问题。",
    sourceId: "108266390",
  },
  {
    filename: "if not defined npm_config_node_gyp.md",
    title: "修复 npm_config_node_gyp 环境变量问题",
    slug: "修复-npm-config-node-gyp-环境变量问题",
    category: "Node.js",
    publishedAt: "2020-12-01",
    summary:
      "修复重新编译 Electron 后 node-gyp 无法找到 npm_config_node_gyp 的环境变量配置。",
    sourceId: "110428510",
  },
  {
    filename: "qt QCamera摄像头的简单实用.md",
    title: "Qt QCamera 摄像头的简单使用",
    slug: "qt-qcamera-摄像头的简单使用",
    category: "Qt",
    publishedAt: "2019-04-03",
    summary:
      "演示 Qt QCamera、QCameraViewfinder 和 QCameraImageCapture 的基础接入与设备遍历。",
    sourceId: "88992902",
  },
  {
    filename: "Qt QTcpSocket 对连接服务器中断的不同情况进行判定.md",
    title: "Qt QTcpSocket 连接中断状态判定",
    slug: "qt-qtcpsocket-连接中断状态判定",
    category: "Qt",
    publishedAt: "2019-05-21",
    summary:
      "总结 QTcpSocket 在不同断网场景下的信号表现，以及心跳、网络检测和自动重连方案。",
    sourceId: "90407230",
  },
  {
    filename: "Qt 无法识别chartsUnknownmodule(s).md",
    title: "Qt 无法识别 Charts 模块",
    slug: "qt-无法识别-charts-模块",
    category: "Qt",
    publishedAt: "2020-03-24",
    summary:
      "解决 Qt 项目提示 Unknown module(s) in QT: charts 时缺少 Qt Charts 组件的问题。",
    sourceId: "105065796",
  },
  {
    filename: "qt 颜色QColor转int.md",
    title: "Qt QColor 转整数",
    slug: "qt-qcolor-转整数",
    category: "Qt",
    publishedAt: "2019-04-04",
    summary: "使用位运算将 QColor 的 RGBA 四个通道组合为一个整数。",
    sourceId: "89015125",
  },
  {
    filename: "Qt 整型与字符串 int与QString互转.md",
    title: "Qt 中 int 与 QString 互转",
    slug: "qt-中-int-与-qstring-互转",
    category: "Qt",
    publishedAt: "2018-12-12",
    summary:
      "说明 Qt 中通过 QString::toInt 和 QString::number 完成整数与字符串转换。",
    sourceId: "84971757",
  },
  {
    filename: "Win10 编译Electron源码.md",
    title: "Windows 10 编译 Electron 源码",
    slug: "windows-10-编译-electron-源码",
    category: "Electron",
    publishedAt: "2020-12-01",
    summary:
      "整理 Windows 10 上配置 depot_tools、Visual Studio、SDK 并拉取和编译 Electron 源码的流程。",
    sourceId: "110422777",
  },
  {
    filename: "海康LED显示屏网络协议对接.md",
    title: "海康 LED 显示屏网络协议对接",
    slug: "海康-led-显示屏网络协议对接",
    category: "硬件集成",
    publishedAt: "2018-05-09",
    updatedAt: "2018-05-09",
    summary:
      "记录 Windows 环境下停车场 LED 显示屏的数据结构、字符编码转换和 TCP/IP 通信实现。",
    sourceId: "80248864",
  },
  {
    filename: "十六进制与float间的互转.md",
    title: "十六进制与 float 互转",
    slug: "十六进制与-float-互转",
    category: "C++",
    publishedAt: "2018-08-14",
    summary:
      "通过共享二进制表示演示 32 位十六进制整数与 float 数值之间的互相转换。",
    sourceId: "81664449",
  },
  {
    filename: "树莓派B4 ubuntu 配置固定WiFi.md",
    title: "树莓派 4B Ubuntu 配置固定 Wi-Fi",
    slug: "树莓派-4b-ubuntu-配置固定-wi-fi",
    category: "Linux",
    publishedAt: "2021-09-02",
    summary:
      "记录树莓派 4B Ubuntu 使用 Netplan 配置固定 Wi-Fi 地址并应用配置的步骤。",
    sourceId: "120069692",
  },
  {
    filename: "未命名.md",
    title:
      "Electron preload 加载 Sentry 时出现 Unexpected token import",
    slug:
      "electron-preload-加载-sentry-时出现-unexpected-token-import",
    category: "Electron",
    publishedAt: "2020-10-19",
    summary:
      "解决 Electron preload 加载 Sentry 时因 CommonJS 环境不支持 import 语法而报错的问题。",
    sourceId: "109156740",
  },
] as const satisfies readonly LocalArticleMetadata[];

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

export function validateLocalArticleManifest(
  entries: readonly LocalArticleMetadata[],
): string[] {
  const errors: string[] = [];
  const filenames = new Set<string>();
  const slugs = new Set<string>();
  const sourceIds = new Set<string>();

  entries.forEach((entry, index) => {
    const label = `entry ${index + 1}`;
    for (const field of [
      "filename",
      "title",
      "slug",
      "category",
      "publishedAt",
      "summary",
      "sourceId",
    ] as const) {
      if (entry[field].trim() === "") {
        errors.push(`${label}: ${field} must not be empty`);
      }
    }
    if (!entry.filename.toLowerCase().endsWith(".md")) {
      errors.push(`${label}: filename must end with .md`);
    }
    if (!isValidDate(entry.publishedAt)) {
      errors.push(`${label}: publishedAt must be YYYY-MM-DD`);
    }
    if (entry.updatedAt && !isValidDate(entry.updatedAt)) {
      errors.push(`${label}: updatedAt must be YYYY-MM-DD`);
    }
    if (entry.slug !== slugifyTitle(entry.title)) {
      errors.push(
        `${label}: slug must equal slugifyTitle(title), expected "${slugifyTitle(entry.title)}"`,
      );
    }

    if (filenames.has(entry.filename)) {
      errors.push(`${label}: duplicate filename "${entry.filename}"`);
    }
    if (slugs.has(entry.slug)) {
      errors.push(`${label}: duplicate slug "${entry.slug}"`);
    }
    if (sourceIds.has(entry.sourceId)) {
      errors.push(`${label}: duplicate sourceId "${entry.sourceId}"`);
    }
    filenames.add(entry.filename);
    slugs.add(entry.slug);
    sourceIds.add(entry.sourceId);
  });

  return errors;
}
