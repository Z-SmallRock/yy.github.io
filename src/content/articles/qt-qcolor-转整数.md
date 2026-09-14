---
title: Qt QColor 转整数
slug: qt-qcolor-转整数
publishedAt: '2019-04-04'
category: Qt
summary: 使用位运算将 QColor 的 RGBA 四个通道组合为一个整数。
readingTime: 1
sourceId: '89015125'
---
```cpp
static inline long long color_to_int(QColor color)
{
	auto shift = [&](unsigned val, int shift)
	{
		return ((val & 0xff) << shift);
	};

	return  shift(color.red(),    0) |
		shift(color.green(),  8) |
		shift(color.blue(),  16) |
		shift(color.alpha(), 24);
}
```
