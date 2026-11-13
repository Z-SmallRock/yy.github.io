---
title: "Boost.Interprocess 速查"
slug: "boost-interprocess"
publishedAt: '2026-10-08'
category: "C++"
summary: "多进程共享内存的选型与落地：managed_shared_memory、段内容器、进程间锁、消息队列，附写端/读端示例和一份坑位清单。"
readingTime: 7
sourceId: "wiki-cpp-boost-interprocess"
---
> 定位：让多个**进程**共享一段内存，并在这段内存里放 C++ 对象和同步原语。
> 解决两件事：① 数据怎么传（零拷贝）② 传的时候怎么不打架（进程间锁）。

## 1. 用在哪里

| 场景 | 为什么选它 | 典型组件 |
|---|---|---|
| 多进程共享大块数据（图像帧、点云、行情快照、缓存表） | 零拷贝，避免 socket 序列化开销 | `managed_shared_memory` |
| 进程间传命令/小消息 | 自带阻塞与超时，不用自己搞分配器 | `message_queue` |
| 一个进程写、多个进程读的配置/状态 | 内核持久，进程重启数据还在 | `managed_shared_memory` / `managed_mapped_file` |
| 只允许一个进程实例运行 / 保护独占资源 | 系统级具名锁 | `named_mutex`、`file_lock` |
| 断点续跑、状态持久化 | 映射文件 + 手动 flush | `managed_mapped_file` |
| 父子进程高频交换结构化数据 | 比 pipe 快，且能直接读结构体 | `managed_shared_memory` + 段内容器 |

**不适用**：跨机器 / 跨语言（→ gRPC、Redis、MQ）；简单父子通信（→ pipe、socketpair）；超高吞吐 SPSC（→ 无锁环形队列）。

## 2. 核心模型

三层心智模型：

1. **字节块**：`shared_memory_object` + `mapped_region`，等价于 `shm_open` + `mmap`。
2. **托管段**（日常 90% 用它）：`managed_shared_memory`，在字节块上加一个段管理器，提供段内 `malloc/free`、**命名对象**、锁。
3. **段内对象**：`boost::container` 容器 + `bip::allocator`，真正放你的数据结构。

![共享内存映射模型](/images/articles/boost-interprocess/1a7261a4c8c7aba3b057.webp)

关键点：同一块物理内存映射到不同进程后，**虚拟地址不一样**，所以段内不能用裸指针。

## 3. 组件速查

| 类别 | 组件 | 头文件 |
|---|---|---|
| 裸共享内存 | `shared_memory_object`、`windows_shared_memory`、`mapped_region` | `shared_memory_object.hpp`、`mapped_region.hpp` |
| 托管段 | `managed_shared_memory`、`managed_mapped_file` | `managed_shared_memory.hpp`、`managed_mapped_file.hpp` |
| 内存映射文件 | `file_mapping` + `mapped_region` | `file_mapping.hpp` |
| 同步 | `named_mutex`/`interprocess_mutex`、`named_semaphore`、`named_condition`/`interprocess_condition`、`named_upgradable_mutex`、`file_lock` | `sync/*.hpp` |
| 消息 | `message_queue` | `ipc/message_queue.hpp` |
| 容器/分配器 | `bip::vector/string/map`、`bip::allocator`、`offset_ptr` | `containers/*.hpp`、`allocators/allocator.hpp` |
| 智能指针 | 段内 `shared_ptr`/`unique_ptr`/`weak_ptr` | `smart_ptr/*.hpp` |

打开方式三种：`create_only`（必须不存在）、`open_only`（必须存在）、`open_or_create`。

## 4. 怎么用

### 4.1 公共类型定义

```cpp
// common.hpp
#include <boost/interprocess/managed_shared_memory.hpp>
#include <boost/interprocess/containers/vector.hpp>
#include <boost/interprocess/allocators/allocator.hpp>
#include <boost/interprocess/sync/named_mutex.hpp>
#include <boost/interprocess/sync/scoped_lock.hpp>
namespace bip = boost::interprocess;

using Mgr   = bip::managed_shared_memory::segment_manager;
using Alloc = bip::allocator<int, Mgr>;
using Vec   = bip::vector<int, Alloc>;   // 注意：不是 std::vector
```

### 4.2 写端

```cpp
bip::shared_memory_object::remove("MyShm");   // 清掉上次残留
bip::named_mutex::remove("MyShmMutex");

bip::managed_shared_memory seg(bip::create_only, "MyShm", 1024 * 1024);
bip::named_mutex           mtx(bip::create_only, "MyShmMutex");

Vec* v = seg.construct<Vec>("Data")(seg.get_segment_manager());  // 段内构造
{
    bip::scoped_lock<bip::named_mutex> lk(mtx);
    for (int i = 0; i < 5; ++i) v->push_back(i * 10);
}

// 收尾
seg.destroy<Vec>("Data");
bip::shared_memory_object::remove("MyShm");
bip::named_mutex::remove("MyShmMutex");
```

### 4.3 读端

```cpp
bip::managed_shared_memory seg(bip::open_only, "MyShm");
bip::named_mutex           mtx(bip::open_only, "MyShmMutex");

auto [p, n] = seg.find<Vec>("Data");      // 按名字找回对象，n 是对象个数
if (p) {
    bip::scoped_lock<bip::named_mutex> lk(mtx);
    for (int x : *p) std::cout << x << " ";
}
```

### 4.4 锁放进段里（数据结构自带锁）

```cpp
struct Shared {
    bip::interprocess_mutex     mtx;
    bip::interprocess_condition cv;
    Vec                         q;
    Shared(const Alloc& a) : q(a) {}      // mtx/cv 走默认构造
};

auto* s = seg.find_or_construct<Shared>("Shared")(seg.get_segment_manager());
bip::scoped_lock<bip::interprocess_mutex> lk(s->mtx);
s->cv.wait(lk, [&]{ return !s->q.empty(); });
```

### 4.5 只传字节流：消息队列

```cpp
bip::message_queue mq(bip::open_or_create, "MyMq", /*max_num=*/100, /*max_size=*/sizeof(int));
mq.send(&x, sizeof(x), /*priority=*/0);
mq.timed_receive(&buf, sizeof(buf), recvd, prio,
                 boost::posix_time::microsec_clock::universal_time() + boost::posix_time::seconds(1));
// mq.remove("MyMq");
```

### 4.6 落盘持久化

```cpp
bip::managed_mapped_file file(bip::open_or_create, "state.db", 1 << 20);
// ... 操作 ...
file.flush();                    // 手动落盘
file.grow("state.db", 4 << 20);  // 需要扩容时用（managed_shared_memory 没有 grow）
bip::file_lock lk("state.db.lock");  // 配文件锁防多进程同时写
```

## 5. 坑位清单

| 坑 | 说明 / 对策 |
|---|---|
| 地址不同 | 段内**禁裸指针/引用**。`std::vector`/`std::string` 不能用（内部裸指针 + 全局 new），改用 `bip::vector`/`bip::string`；跨段引用用 `offset_ptr<T>` |
| 生命周期 | Linux 是 `/dev/shm` 下**内核持久对象**，进程崩了数据还在 → 启动先 `remove()` 或用 `find_or_construct`；Windows 相反，最后一个映射关闭即销毁 |
| 段不自动长大 | `managed_shared_memory` 不能扩；`managed_mapped_file::grow()` 可以。起步预留 64KB~1MB |
| 孤儿锁 | 持锁进程崩溃，Boost **不保证**跨平台自动恢复 → `timed_lock` + 超时 + 心跳/看门狗兜底 |
| 名字全局冲突 | `"MyShm"` 是系统级名字，多实例会打架 → 名字拼 PID / 用户 ID / 版本号 |
| 权限 | 构造时传 `permissions(0666)`，否则跨用户进程 open 失败 |
| 虚表 | 段内对象不要有虚函数（vptr 指向本进程代码段），别放 `std::function` 之类 |
| 编译链接 | 基本 header-only，需 `-lpthread`；glibc < 2.34 还要 `-lrt` |
| 调试 | `ipcs -m` 查看；残留直接 `rm /dev/shm/MyShm` |

```bash
g++ writer.cpp -o writer -lrt -lpthread -I/path/to/boost
```

## 6. 一句话选型

- 只传小消息 → `message_queue`
- 共享大块数据 / 零拷贝 → `managed_shared_memory` + `bip` 容器
- 要落地成文件 → `managed_mapped_file` + `file_lock`
- 只要互斥 → `named_mutex`（系统级）或 `file_lock`（文件级）
