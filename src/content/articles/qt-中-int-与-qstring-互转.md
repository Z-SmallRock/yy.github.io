---
title: Qt 中 int 与 QString 互转
slug: qt-中-int-与-qstring-互转
publishedAt: '2018-12-12'
category: Qt
summary: '说明 Qt 中通过 QString::toInt 和 QString::number 完成整数与字符串转换。'
readingTime: 1
sourceId: '84971757'
---
( 1）QString转int

直接调用toInt()函数

例：

QString str("100");

int tmp = str.toInt();

或者：

bool ok;

QString str("100");

int tmp = str.toInt(&ok);

注：ok表示转换是否成功，成功则ok为true，失败则ok为false。

2）int转QString

QString::number();

例：

int tmp = 100;

QString str = QString::number(tmp);
