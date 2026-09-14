---
title: Qt 无法识别 Charts 模块
slug: qt-无法识别-charts-模块
publishedAt: '2020-03-24'
category: Qt
summary: '解决 Qt 项目提示 Unknown module(s) in QT: charts 时缺少 Qt Charts 组件的问题。'
readingTime: 1
sourceId: '105065796'
---
如果出现这种情况。一般是在安装qt的时候没有勾选Qtchart模块。

解决办法：

在qt安装目录下有个MaintenanceTool.exe运行。选中添加或移除组件

![](/images/articles/qt-无法识别-charts-模块/0578bd82e13ae196fc28.webp)

在设置里面添加临时存储库

添加存储库。这边添加清华大学的节点

[Index of /qt/online/qtsdkrepository/windows_x86/root/qt/ | 清华大学开源软件镜像站 | Tsinghua Open Source Mirror](https://mirrors.tuna.tsinghua.edu.cn/qt/online/qtsdkrepository/windows_x86/root/qt/ "Index of /qt/online/qtsdkrepository/windows_x86/root/qt/ | 清华大学开源软件镜像站 | Tsinghua Open Source Mirror")

然后就可以增删组件了。下载完后勾选自己想要的组件即可
