---
title: "OrCAD Capture：Implementation Type 是什么"
slug: "orcad-implementation-type"
publishedAt: '2026-10-13'
category: "EDA"
summary: "层次化设计里层次块的 Implementation Type 到底声明了什么：各取值如何影响网表与仿真、与 Implementation name / Path 如何配合、选错时会怎样。"
readingTime: 3
sourceId: "wiki-eda-implementation-type"
---
> 在 EDA 里看到 `Implementation Type`，要先分清是 **Altium**（元件挂的模型类型）还是 **OrCAD**（层次块的子电路实现形式）。本文只讲 OrCAD 这一层。

## 一句话理解

`Implementation Type` 出现在 **层次化设计（Hierarchical Design）** 中你放在顶层的那个**方框（Hierarchical Block / 子图符号）**的属性里。

这个方框本身不画任何电路，它只是个"占位 + 声明"：**告诉 Capture 我这块内容是什么形式的、你去哪找**。`Implementation Type` 就是这个声明。

## 一个具体例子

假设顶层要放一个电源模块，步骤是：

1. 菜单 **Place → Hierarchical Block**，画一个框，起名 `MY_POWER`。
2. 双击这个框，填三个配套属性：
   - **Implementation name**：`MY_POWER`（子图的逻辑名，必须和子图根一致）
   - **Implementation Type**：`Schematic View`（表明这框的内容是一张原理图页）
   - **Path and filename**：留空（表示子图就在同一个 `.dsn` 工程里）
3. 点 OK 后，工程管理器里自动生成一个 `MY_POWER` 文件夹，里面放实际画电路的 `PAGE1`。
4. **生成网表 / 仿真时**，Capture 看到 `Implementation Type = Schematic View`，就知道要把这个框**展开成那张子图里的元件和连线**。

> 如果第 2 步选的不是 `Schematic View`，工具的解析方式会完全不同——见下图。

![OrCAD Implementation Type 的四种解析方式](/images/articles/orcad-implementation-type/a826f062a89b34f5f76f.webp)

*同一类子图框，Implementation Type 取不同值时，Capture 在生成网表/仿真时的解析方式不同。*

## 为什么要有这个属性

OrCAD 要能**生成网表、跑仿真、层次展开**——它必须知道每个框"怎么解析"。`Implementation Type` 就是给工具的那条指令：

| 取值 | 工具怎么处理这个框 | 典型场景 |
|---|---|---|
| **Schematic View** | 当成一张原理图页，把里面的元件和网络**展开**进顶层 | 最常规的多页 / 层次原理图 |
| **VHDL / Verilog** | 当成一段 HDL 代码（行为模型 / 黑盒），不展开成元件 | FPGA/CPLD 设计，子模块用代码描述 |
| **EDIF** | 内容来自第三方 EDA 工具生成的 EDIF 网表 | 跨工具导入的模块 |
| **PSpice Model / PSpice Stimulus** | 仿真时当成 SPICE 子电路 / 激励源接进来 | 自带符号 + 第三方 SPICE 模型 |
| **Project** | 关联一个 OrCAD Express 工程 | 系统级仿真 |
| **（空）/ Primitive** | 基元元件，自己就是完整符号，**没有下层实现** | 电阻、电容、普通 IC |

## 和普通元件的区别

- **普通电阻电容**（`Implementation Type` 为空 / Primitive）：符号自己就带引脚 + 网表信息，没有"下层"，所以**不用填这三个属性**，你也不会在它们身上见到 `Implementation Type`。
- **层次块 / FPGA 符号 / 第三方模型符号**：它本身是空的，全靠 `Implementation Type` + `Implementation name` + `Path` 这三人组把"真正的电路 / 代码 / 模型"挂上来。

## 三个属性怎么配合（一句话版）

- `Implementation name` = 这框叫什么、去哪找（子图根名 / 模型名 / 实体名）
- `Implementation Type` = 那东西**是什么形式**（原理图？HDL？SPICE？）
- `Path and filename` = 那个东西的**文件路径**（`.dsn` / `.vhd` / `.lib`）；留空 = 同工程内

三者必须自洽：类型选 `Schematic View` 但 Path 指向一个 `.vhd`，或者 name 跟子图根对不上——**DRC 直接报"找不到子电路"，仿真还会漏节点**。

## 延伸：Altium 里也有这个词，但意思不同

Altium Designer 的 `Implementation Type` 指的是**元件符号挂的模型属于哪个域**（Footprint / Simulation / PCB3D / Signal Integrity / Ibis），旁边跟着的是 Name 和 Library，而不是 name/path。详见 [EDA-元件标识与封装速查.md](/articles/eda-refdes-footprint) 的封装部分。

## 实践小贴士

1. 新建层次块后第一时间确认 **Implementation Type** 和 **name** 一致，别等 DRC 报了再回头找。
2. `Path and filename` 留空 = 子图在同工程；一旦把子图挪到别的工程或路径，记得同步改这里，否则 Descend Hierarchy 会失效。
3. 只做纯原理图、不用仿真，也可以挂 `PSpice Model` 类型——但它不影响网表，只在跑 PSpice 时生效，别和 `Schematic View` 混用。
4. 普通元件若被误设成非空 Implementation Type（比如从别处复制来的块直接当元件放），最容易的表现是网表里多出一堆"未解析"的模块。
