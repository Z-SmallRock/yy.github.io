---
title: C++ ZIP 文件压缩与解压：Qt 解压 ZIP
slug: c-zip-文件压缩与解压-qt-解压-zip
publishedAt: '2018-03-30'
category: C++
summary: 介绍 C++ zip/unzip 接口的基本用法，以及在 Qt 项目中封装 ZIP 解压功能的思路。
readingTime: 2
sourceId: '79760590'
---
```cpp
//解压缩
For unzipping, add "unzip.cpp" to your project. Then, for example,
  #include "unzip.h"
  //
  HZIP hz = OpenZip("c:\\stuff.zip",0);
  ZIPENTRY ze; GetZipItem(hz,-1,&ze); int numitems=ze.index;
  for (int i=0; i<numitems; i++)
  { GetZipItem(hz,i,&ze);
    UnzipItem(hz,i,ze.name);
  }
  CloseZip(hz);

//压缩
For zipping, add "zip.cpp" to your project. (You can add just one of
zip/unzip, or both; they function independently and also co-exist.)
  #include "zip.h"
  //
  HZIP hz = CreateZip("c:\\simple1.zip",0);
  ZipAdd(hz,"znsimple.bmp", "c:\\simple.bmp");
  ZipAdd(hz,"znsimple.txt", "c:\\simple.txt");
  CloseZip(hz);
```

下载使用

如果对于win32项目。直接上面的链接下载就可以使用

对于qt无法使用报错的问题。进行了简单的封装。目前可以在qt中进行zip的解压。很方便的就可以使用了。

github地址：[https://github.com/zhaoxiaolei519109457/unzip.git](https://github.com/zhaoxiaolei519109457/unzip.git "https://github.com/zhaoxiaolei519109457/unzip.git")

如果需要进行压缩等操作。可自行封装
