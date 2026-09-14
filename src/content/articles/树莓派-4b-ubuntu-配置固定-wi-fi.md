---
title: 树莓派 4B Ubuntu 配置固定 Wi-Fi
slug: 树莓派-4b-ubuntu-配置固定-wi-fi
publishedAt: '2021-09-02'
category: Linux
summary: 记录树莓派 4B Ubuntu 使用 Netplan 配置固定 Wi-Fi 地址并应用配置的步骤。
readingTime: 1
sourceId: '120069692'
---
 ubuntu 版本

![](/images/articles/树莓派-4b-ubuntu-配置固定-wi-fi/0602c17e08f821d0e58f.webp)

修改配置文件

vim /etc/netplan/50-cloud-init.yaml

![](/images/articles/树莓派-4b-ubuntu-配置固定-wi-fi/5aaca906997482ce1e69.webp)

注意空格

netplan generate (报错的话有可能是yaml内的空格)

netplan --debug apply

ifconfig

重启即可连接
