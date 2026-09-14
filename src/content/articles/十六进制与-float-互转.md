---
title: 十六进制与 float 互转
slug: 十六进制与-float-互转
publishedAt: '2018-08-14'
category: C++
summary: 通过共享二进制表示演示 32 位十六进制整数与 float 数值之间的互相转换。
readingTime: 1
sourceId: '81664449'
---
下面的示例通过同一段 32 位二进制数据，演示十六进制整数和 `float` 之间的互转。

```cpp
#include <stdio.h>

int main()
{
	int i = 0x41E40AD6;
	float *f = (float *)&i;
	printf("%f\n",*f);
    //28.505291 得到转换后的float数据

	float hf = 28.505291;
	int *hh = (int *)&hf;
	printf("%X\n",*hh);
    //41E40AD6 得到十六进制数据

	getchar();
	return 0;
}
```
