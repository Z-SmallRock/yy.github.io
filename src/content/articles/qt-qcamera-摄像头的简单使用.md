---
title: Qt QCamera 摄像头的简单使用
slug: qt-qcamera-摄像头的简单使用
publishedAt: '2019-04-03'
category: Qt
summary: 演示 Qt QCamera、QCameraViewfinder 和 QCameraImageCapture 的基础接入与设备遍历。
readingTime: 3
sourceId: '88992902'
---
## 运行效果

![摄像头预览界面](/images/articles/qt-qcamera-摄像头的简单使用/6b611bb3f24c4c8a2b35.webp)

![摄像头采集效果](/images/articles/qt-qcamera-摄像头的简单使用/c4f2f6f6a12941cc5b47.webp)

![摄像头保存效果](/images/articles/qt-qcamera-摄像头的简单使用/8c8d038a657370514982.webp)

## 初始化摄像头

头文件中声明摄像头、取景器和截图对象：

```cpp
QCamera *camera;                    // 摄像头
QCameraViewfinder *viewfinder;      // 摄像头取景器部件
QCameraImageCapture *imageCapture;  // 截图部件
```

在源文件中完成对象创建、信号连接并启动摄像头：

```cpp
camera = new QCamera;
viewfinder = new QCameraViewfinder(ui->label_2);
imageCapture = new QCameraImageCapture(camera);
camera->setViewfinder(viewfinder);

QObject::connect(
    ui->pushButton,
    SIGNAL(clicked()),
    this,
    SLOT(ShowTheCapture()));
QObject::connect(
    ui->SaveButton,
    SIGNAL(clicked()),
    this,
    SLOT(SavePicture()));
QObject::connect(
    imageCapture,
    SIGNAL(imageCaptured(int, QImage)),
    this,
    SLOT(displayImage(int, QImage)));

imageCapture->setCaptureDestination(QCameraImageCapture::CaptureToFile);
camera->setCaptureMode(QCamera::CaptureVideo);
camera->start();
```

至此，最基本的摄像头预览和截图功能已经完成。

## 遍历当前所有摄像头

```cpp
QList<QCameraInfo> cameras = QCameraInfo::availableCameras();
foreach (const QCameraInfo &cameraInfo, cameras)
{
    QString description = cameraInfo.description();
    QString deviceName = cameraInfo.deviceName();

    if (deviceName == "yourcamera")
    {
        // 选择需要使用的摄像头
        camera = new QCamera(cameraInfo);
        camera->start();
    }
}
```
