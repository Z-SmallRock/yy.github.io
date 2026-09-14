---
title: Qt QTcpSocket 连接中断状态判定
slug: qt-qtcpsocket-连接中断状态判定
publishedAt: '2019-05-21'
category: Qt
summary: 总结 QTcpSocket 在不同断网场景下的信号表现，以及心跳、网络检测和自动重连方案。
readingTime: 4
sourceId: '90407230'
---
 简述
对于一个C/S结构的程序，客户端有些时候需要实时得知与服务器的连接状态。而对于客户端与服务器断开连接的因素很多，现在就目前遇到的情况进行一下总结。

分为下面六种不同情况
1.客户端网线断开
2.客户端网络断开
3.客户端通过HTTP代理连接服务器，代理机器断开代理
4.客户端通过HTTP代理连接服务器，代理机器的网络断开
5.客户端通过HTTP代理连接服务器，代理机器的网线断开
6.服务器断开
同时对于以上六种情况又分为连接服务器之前和连接上服务器之后，下面就分别对不同的情况进行分析。
开始连接服务器之前
1、 客户端网线断开
此时用socket调用connectToHost方法连接服务器会立即触发QTcpSocket的error信号，我们可以绑定相应的槽去处理连接失败的结果。

2、 客户端网络断开
3、 客户端通过HTTP代理连接服务器，代理机器断开代理
4、 客户端通过HTTP代理连接服务器，代理机器的网络断开
5.、客户端通过HTTP代理连接服务器，代理机器的网线断开
6、 服务器断开
此时用socket调用connectToHost方法连接服务器并不会立即触发QTcpSocket的error信号，而是经过40s+的连接等待超时发出error信号，见下图。

已经连接上服务器
1、 客户端网线断开
此时socket不会发送error信号，也不会发送disconnect信号，查询资料是因为网线断开是属于物理链路层，tcp无法察觉到，socket仍处于连接状态。

2、 客户端网络断开
3、 客户端通过HTTP代理连接服务器，代理机器断开代理
4、 客户端通过HTTP代理连接服务器，代理机器的网络断开
5.、客户端通过HTTP代理连接服务器，代理机器的网线断开

第二和第三种情况下会立即触发error信号，而第四和第五种情况下会等待30s左右会发送error信号。

6、 服务器断开
此时socket会发送disconnect信号，可以绑定相应的槽去处理服务器断开的情况。

检测与服务器断开的另外方法
对于有些程序（客户端）需要立即知道与服务端连接状态，而不是等待几十秒之后才有信号通知到或者根本就检测不出与服务器断开，除了利用QTcpSocket提供的信号（有几种情况不会发出信号或发出信号延迟），这里列出另外几种处理方法。

1、发送心跳包，即客户端每隔一段时间发送一条报文，报文不需附带具体内容，只需要让服务端知道这是一条心跳报文，并回发一条消息，客户端收到这条消息后就得知与服务器保持连接的状态。

检测本地网络，定义一个时钟，每次timeout去检测本地的网络，关于怎么判断本地网络是否通畅呢？
2、可以用windows提供的IsNetworkAlive方法，返回为false为网络异常。加上头文件为#include “Sensapi.h”。同时需要包含Sensapi.lib。
（通过IsNetworkAlive方法判断本地网络，在客户端已经连接上服务器，并且禁用网络时会立即发送error信号，在error信号绑定的槽中去调用这个方法发现返回值为true，因为这种情况下禁用网络后会立即发送error信号，调用IsNetworkAlive方法时可能立即检测不到网络异常。如果通过断点的方式，在调用IsNetworkAlive时就会返回false）

```cpp
DWORD dwFlag;
    if (FALSE == IsNetworkAlive(&dwFlag))
    {
        qDebug() << "NetWorkError";
    }
```

注意：
但是这种方法，在本地存在虚拟机并且虚拟机开启时会失效，因为IsNetworkAlive会检测本地所有的网络，在网线断开后，可能检测到虚拟机网络正常，导致返回ture。

3、如果有自己的服务器就ping服务器（前提服务器不会挂），否则就ping一个相对可靠的IP （比如百度），通过看他ping的结果怎么样.
同时在C++ 实现 ping 功能&& 域名（URL）解析实际 IP地址 这篇博客中用C++实现了 ping的 功能，有兴趣的小伙伴可以看一看，了解一下。

```cpp
QProcess *cmd = new QProcess;
cmd->start("ping www.baidu.com");
// 等待ping 的结果
while (cmd->waitForFinished())
{
    QString result = QString::fromLocal8Bit(cmd->readAll());
    qDebug() << result;
}

或

QHostInfo::lookupHost("www.baidu.com", this, SLOT(lookedUp(QHostInfo)));

void lookedUp(QHostInfo &host)
{
     qDebug() << host.addresses().first().toString();
}
//得到IP 地址 就是在互联网上 如果不能得到 就不行
```

4、QNetworkConfigurationManager::isOnline()。
当然这个只能检查你是否有网络链接，而不能检测你是否连接到互联网。

对于需要自动重连的客户端可以通过以上方法，在判断出与服务器断开后可以重新连接，或者通过超时定时器进行重连，方法很多，在于尝试。
---------------------
作者：前行中的小猪
原文：
