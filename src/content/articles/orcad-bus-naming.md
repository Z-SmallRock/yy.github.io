---
title: "OrCAD Capture：Bus 总线的定义、命名与标注"
slug: "orcad-bus-naming"
publishedAt: '2026-10-13'
category: "EDA"
summary: "从“总线只是清单、不导电”讲起：Bus 的画法、命名语法、Net Alias / Bus Entry / 跨页连接符的选用、子总线抽取，以及 DRC 排错速查。"
readingTime: 5
sourceId: "wiki-eda-orcad-bus"
---
> 范围：OrCAD Capture / Capture CIS 的原理图侧总线。涉及 Allegro 网表与 PCB 侧的部分会单独标出。
> 一句话先说结论：**总线粗线本身不导电，它只是一张"清单"；真正建立电气连接的是每根 bit 线上的 Net Alias 名字。**

## 1. 总线到底是什么

Capture 里的 Bus 是**图形对象 + 名字标签**，不是电气对象。它做三件事：

1. **视觉压缩** —— 32 根地址线画成一根粗线；
2. **声明成员集合** —— `ADDR[0:31]` 告诉工具"这条总线里应该出现 ADDR0…ADDR31 这 32 个网络"；
3. **给 DRC / 网表提供依据** —— 名字对不上就报错，防止画错。

它**不做**的事：不传递任何电气连接。两根线只要 Net Alias 都叫 `DATA0`，无论中间有没有画总线、有没有画 Bus Entry，它们在电气上就是同一个网络。

![OrCAD Capture 总线结构解剖](/images/articles/orcad-bus-naming/1425f46fb214cee2c3c7.webp)

*粗线（Bus）、斜线（Bus Entry）、文字（Net Alias）三者的分工。决定连通性的是最右边那列名字。*

## 2. 定义：画一条总线的 SOP

| 步骤 | 操作 | 说明 |
|---|---|---|
| 1 | `Place → Bus`（部分版本快捷键 `B`） | 画粗线本体，和画 wire 一样拖就行 |
| 2 | `Place → Net Alias`（快捷键 `N`） | 在**粗线**上放总线名，如 `DATA[7:0]`。**总线必须命名**，否则 DRC 报错 |
| 3 | `Place → Bus Entry` | 放 45° 斜线，一端落在粗线上；方向不对用 `Edit → Rotate`（`R`）旋转 |
| 4 | `Place → Wire`（`W`） | 从 Bus Entry 另一端接到器件引脚 |
| 5 | `Place → Net Alias` | 在**每根 bit 线**上放成员名：`DATA7`、`DATA6`… |

两个必须记住的机械细节：

- **Net Alias 只能放在 wire / bus 上，不能放在 pin 上**；别名的**首字符要压在导线上**，否则 Capture 认不到这个连接点。
- **不画 Bus Entry，直接把 wire 怼到粗线上 = 没连接**。这是新手最常踩的坑。

### 批量生成 bit 名字（省时间的关键技巧）

画好第一根线 + 第一个别名后：**选中该线 → 按住 `C` 拖动复制**到下一个位置，别名数字会**自动 +1**；再按 `Edit → Repeat`（`F4`）按相同间距继续铺。32 位总线十几秒搞定。注意第一根要用总线范围里**最小**的那个值（如 `A[0:3]` 就先写 `A0`），递增方向才对。

## 3. 命名：语法规则

官方格式：`basename[x..y]`，其中 `x..y` 是十进制整数区间，成员数 = |y-x|+1。

![总线命名语法与正误对照](/images/articles/orcad-bus-naming/97c3687b04798633501d.webp)

*语法、成员展开，以及 6 个最常见的命名坑。*

### 硬性规则

| 规则 | 说明 |
|---|---|
| 分隔符三选一 | `..`、`:`、`-` 完全等价：`DATA[0:7]` = `DATA[0..7]` = `DATA[0-7]` |
| 成员名 = 前缀 + 数字 | `DATA[7:0]` 的成员只能是 `DATA7`…`DATA0`，不能是别的 |
| 前缀与 `[` 之间**不要空格** | 空格会在生成网表时出奇怪问题 |
| 前缀**不能以数字结尾** | `DATA1[0:3]` 有风险，`BUS2A` 没问题（数字在中间可以） |
| 全项目统一位序 | Capture **不区分** `DATA[7:0]` 和 `DATA[0:7]`（成员集合相同），但人和下游工具会区分 |

### 推荐命名习惯

| 信号类型 | 推荐 | 说明 |
|---|---|---|
| 数据 / 地址 | `DATA[7:0]`、`ADDR[15:0]` | 统一 **MSB 在前**，和芯片手册位序对齐 |
| 通用并行口 | `GPIO[31:0]`、`Xm0DATA[15:0]` | 前缀带模块名，避免多页重名 |
| 低有效信号 | `RESET*`、`CS\`、`OE\` | 结尾 `*` 或 `\` 是 OrCAD 传统低有效标记；以 `\` 结尾的名字在部分版本/设置下会渲染成上划线 |
| 控制类杂信号 | **别塞进总线** | 见下一节的"能力边界" |

## 4. 标注：四类对象怎么选

| 对象 | 菜单 | 用在哪 | 关键点 |
|---|---|---|---|
| **Net Alias** | `Place → Net Alias` | 同一页内给网络/总线起名字 | 页内**同名即连**，是总线机制的地基 |
| **Bus Entry** | `Place → Bus Entry` | 单根线 ↔ 总线、子总线 ↔ 总线 | 45° 斜线；方向不对用 `R` 旋转，不是 `Mirror` |
| **Off-Page Connector** | `Place → Off-Page Connector` | **扁平多页**设计，跨页连同一组网络 | 两边 **Name 必须完全相同**（总线就写 `DATA[7:0]`）；样式（Left/Right）要一致，混用会让工具认为是两个网络 |
| **Hierarchical Port / Pin** | `Place → Hierarchical Port` / `Hierarchical Pin` | **层次化**设计 | Port 放在子图页内，Pin 放在顶层 block 符号上，两者名字必须一致；总线就写 `ADDR[0:31]` |
| **Port** | `Place → Port` | 需要带**方向**（in/out/bidir）的场合，如 Verilog/VHDL 网表、PSpice | 与 Hierarchical Port 不是一回事，别混用 |

> 跨页时**别偷懒**：总线名 + 成员别名 + 连接符名字，三者要一起对得上。层次化里最容易出的问题就是顶层 Port 名写成 `USB_DP_IN`、下层网络写 `USB_DP`，DRC 直接报不匹配。

## 5. 从总线里"抽"一部分（Ripping）

Capture 支持抽**子总线**，但方式是**靠名字**而不是靠位置：

- 想把 `ADDR[8:15]` 从 `ADDR[0:15]` 里抽出来 → 在两条总线之间放一个 Bus Entry，子总线名必须是母总线名的**子集**（成员名 ADDR8…ADDR15 本来就在母集合里）。
- 抽出来的子总线可以再走 Off-Page / Hierarchical Port 到任意一页。

**能力边界**（和 Mentor EN / Concept HDL 对比时经常被吐槽的点）：

- Capture 的 Bus Entry **没有编号**，做不到"把 4 位总线挂到 32 位总线的第 9~12 位"这种**位偏移**连接——因为成员是靠名字匹配的，不是靠位置。
- 也做不到"总线叫 `JTAG[0:3]`，成员却是 `TCK/TMS/TDI/TDO`"——成员名只能是前缀+数字。这类杂信号组只能：
  1. 老老实实画独立网络 + `Place → Text` 注释；或
  2. 到 Allegro 侧给这些网络打 `BUS_NAME` 属性来归组（网表里的 net 名仍是各自的名字）。
- Capture 也没有 Mentor 那种"换名符"；需要"一个网络两个名字"时的土办法是串一个 0Ω 电阻，两边挂不同网络名。

## 6. 网表与 Allegro 侧

- Capture `Tools → Create Netlist` 时，总线会被**展开成独立的 flat 网络**：`DATA[7:0]` → `DATA7`、`DATA6` … `DATA0`。PSpice 同样按展开后的节点处理。
- Allegro PCB Editor 里反过来用**角括号**语法来选中总线位：`DATA<3>` 选单个位，`DATA<3:1>` 选子区间，`DATA<1,2,3>` 选列表；位号与网络名末尾数字必须精确对应。
- 对那些名字里没有位号、但你仍想当一组来处理的网络（如 `TCK/TMS/TDI/TDO`），Allegro 可以给它们赋 `BUS_NAME` 属性来归组。
- 同步失败时最常见的根因就是**命名不合规**：写成 `DATA0-DATA7`、`DATA_0_TO_7` 这类非标准格式，网表解析器会把它们拆成互不相干的独立网络，总线属性全丢。

## 7. DRC 常见报错速查

报错文案各版本略有差异，按现象对症：

| 现象 / 报错 | 原因 | 处理 |
|---|---|---|
| "Bus has no name and therefore defines no signals" | 画了总线没命名 | `Place → Net Alias` 给它起名 |
| 位线接不进总线 | 没画 Bus Entry，或 Bus Entry 没真正落到粗线上 | 重放 Bus Entry，确认端点重合 |
| 位线接进去了但报成员不匹配 | 别名不是 `前缀+数字`，或数字超出总线范围 | 改别名，使其落在总线区间内 |
| 子总线抽不出来 | 子总线名不是母总线的子集 | 改名为子集区间 |
| 跨页网络没连上 | Off-Page Connector 名字不一致 / 样式混用；层次 Port 与 Pin 名不一致 | 全局统一名字与样式 |
| 生成网表时名字异常 | 前缀以数字结尾、前缀与 `[` 之间有空格 | 按第 3 节的硬性规则改名 |

## 8. 实践小贴士

1. **先命名总线，再画 Bus Entry**。总线没名字时 DRC 会先报一堆错，反而难排查。
2. **总线名和位别名一次性用递增复制（按住 `C` 拖 + `F4`）生成**，手写 32 个名字必错一个。
3. **全项目统一 `[MSB:LSB]` 和分隔符**。虽然 `:` `..` `-` 等价，但混写会让 grep、约束文件导出、同事 Review 全部变痛苦。
4. **前缀别以数字结尾**（`USB1[0:3]` 这种尤其危险），真要带编号就写成 `USB1_D[0:3]`。
5. **低有效用后缀 `*` 或 `\`，别用前导 `/`**。`RESET_N` 也是可接受的现代写法，但和 `\` 不要混用。
6. **跨页总线先查三处一致性**：总线名、成员别名、连接符名。用 `Edit → Browse → Nets / Off-page` 列表批量核对，比翻页快得多。
7. **杂信号组不要硬塞总线**。Capture 要求成员名 = 前缀+数字，硬塞只会换来一堆 DRC 警告；用普通网络 + 注释，或留到 Allegro 用 `BUS_NAME` 归组。

## 相关笔记

- [OrCAD-Implementation-Type.md](/articles/orcad-implementation-type) —— 层次块的总线跨页与 Implementation Type 的关系
- [EDA-元件标识与封装速查.md](/articles/eda-refdes-footprint) —— 参考标识符 / 封装命名体系
