---
title: 'Docker curl: (56) Recv failure: 连接被对方重设'
slug: docker-curl-recv-failure-连接被对方重设
publishedAt: '2021-08-27'
updatedAt: '2021-08-27'
category: Docker
summary: Docker 服务已经启动，但从容器外部访问时连接被重置的排查记录。
readingTime: 1
sourceId: '119958339'
---

## 现象

Docker 服务正常启动，但是在外部使用 `curl` 访问时一直报错：

```text
curl: (56) Recv failure: 连接被对方重设
```

## 解决方案

服务可能通过配置文件或代码把监听地址写成了 `127.0.0.1`。将原地址改成 `0.0.0.0`，重新运行服务后即可从容器外部连接。
