---
title: 海康 LED 显示屏网络协议对接
slug: 海康-led-显示屏网络协议对接
publishedAt: '2018-05-09'
updatedAt: '2018-05-09'
category: 硬件集成
summary: 记录 Windows 环境下停车场 LED 显示屏的数据结构、字符编码转换和 TCP/IP 通信实现。
readingTime: 8
sourceId: '80248864'
---
本文记录 Windows 下通过 TCP/IP 对接停车场 LED 显示屏，并显示系统当前日期的基础实现。

## 数据帧结构

```cpp
#define MAX_BUFFER		1024
#define MAX_BUFFER_SIZE 512
using namespace std;

struct  TCP_SEND_DATE
{
	unsigned char frameHear[4];      //帧头
	unsigned char frameAddress;		//地址
	unsigned char framesave[2];	    //保留1
	unsigned char frameworkercode;
	unsigned char framezhen[2];		//帧序号
	unsigned char datealllength[4];		//数据总长
	unsigned char framesave2[2];	    //保留2
	unsigned char datelength[4];			// 数据长度
	unsigned char framedate[MAX_BUFFER_SIZE]; //数据
	unsigned char frameend[4];		//帧尾
};
```

## UTF-8 转 GB2312

```cpp
char* U2G(const char* utf8)
{
        int len = MultiByteToWideChar(CP_UTF8, 0, utf8, -1, NULL, 0);
        wchar_t* wstr = new wchar_t[len + 1];
        memset(wstr, 0, len + 1);
        MultiByteToWideChar(CP_UTF8, 0, utf8, -1, wstr, len);
        len = WideCharToMultiByte(CP_ACP, 0, wstr, -1, NULL, 0, NULL, NULL);
        char* str = new char[len + 1];
        memset(str, 0, len + 1);
        WideCharToMultiByte(CP_ACP, 0, wstr, -1, str, len, NULL, NULL);
        if (wstr) delete[] wstr;
        return str;
}
```

## 连接设备并发送数据

```cpp
        time_t t = time(0);
        char tmp[64];
        strftime(tmp, sizeof(tmp), "%Y-%m-%d %H:%M:%S", localtime(&t));
        puts(tmp);
        unsigned char* ptemp = (unsigned char*)U2G(tmp);


        //初始化网络环境
        WSADATA wsa;
        if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0)
        {
                printf("WSAStartup failed\n");
                return -1;
        }
        // 初始化完成，创建一个TCP的socket
        SOCKET sServer = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (sServer == INVALID_SOCKET)
        {
                printf("socket failed\n");
                return -1;
        }
        //指定连接的服务端信息
        SOCKADDR_IN addrServ;
        addrServ.sin_family = AF_INET;
        addrServ.sin_port = htons(PORT);
        //客户端只需要连接指定的服务器地址，127.0.0.1是本机的回环地址
        addrServ.sin_addr.S_un.S_addr = inet_addr("192.168.1.202");
        // 服务器Bind 客户端是进行连接
        int ret = connect(sServer, (SOCKADDR*)&addrServ, sizeof(SOCKADDR));//开始连接
        if (SOCKET_ERROR == ret)
        {
                printf("socket connect failed\n");
                WSACleanup();
                closesocket(sServer);
                return -1;
        }
        //连接成功后，就可以进行通信了
        s_rsSend s_struct;


        s_struct.frameHear[0] = 0x55;
        s_struct.frameHear[1] = 0xaa;
        s_struct.frameHear[2] = 0x00;
        s_struct.frameHear[3] = 0x00;


        s_struct.frameAddress = 0x01;
        s_struct.framesave[0] = 0x00;
        s_struct.framesave[1] = 0x00;
        s_struct.frameworkercode = 0xDA;
        s_struct.framezhen[0] = 0x00;
        s_struct.framezhen[1] = 0x00;


        s_struct.datealllength[0] = 0x3d;
        s_struct.datealllength[1] = 0x00;
        s_struct.datealllength[2] = 0x00;
        s_struct.datealllength[3] = 0x00;


        s_struct.framesave2[0] = 0x00;
        s_struct.framesave2[1] = 0x00;


        s_struct.datelength[0] = 0x3d;
        s_struct.datelength[1] = 0x00;
        s_struct.datelength[2] = 0x00;
        s_struct.datelength[3] = 0x00;

        unsigned char szBuf[512] = {
                0x01,
                0x01,
                0x3C, 0x00, 0x00, 0x00,
                0x01,
                0x00, 0x00,
                0x00,
                0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x01, //45
                0x24, 0x00, 0x00, 0x00,
                0x0E,
                0x00, 0x00, 0x00, 0x00, 0x3f, 0x00, 0x3f, 0x00,
                0x01,
                0x00, 0x00,
                0x1C, 0xFF, 0x64, 0x05,
                0x10,
                0x0a, 0x00, 0x00, 0x00,
        }; 
        memcpy(szBuf + 51, ptemp, 10);
	
        s_struct.frameend[0] = 0x00;
        s_struct.frameend[1] = 0x00;
        s_struct.frameend[2] = 0x0d;
        s_struct.frameend[3] = 0x0a;
        memset(s_struct.framedate, 0x00, MAX_BUFFER_SIZE);
        memcpy(s_struct.framedate, szBuf, sizeof(szBuf));


        unsigned char c[MAX_BUFFER] = { 0 };
        memcpy(c, &s_struct, sizeof(s_struct));


        ret = send(sServer, (char*)c, sizeof(s_struct), 0);


        printf("--send %d\n", ret);
        if (SOCKET_ERROR == ret)
        {
                printf("socket send failed\n");
                closesocket(sServer);
                return -1;
        }

        closesocket(sServer);
        WSACleanup();
```

## 通信结果

发包内容：

![LED 显示屏发包内容](/images/articles/海康-led-显示屏网络协议对接/23d0c2ca012afe908899.webp)

回包内容：

![LED 显示屏回包内容](/images/articles/海康-led-显示屏网络协议对接/54220bbdaf01f6bda82e.webp)
