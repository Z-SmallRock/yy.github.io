---
title: "EDA 元件标识与封装速查"
slug: "eda-refdes-footprint"
publishedAt: '2026-09-29'
category: "EDA"
summary: "把元件的三重身份拆开：位号（RefDes）与 Part name 的区别、BOM 分组、Footprint 的分层结构与关键属性，以及各家 EDA 的叫法。"
readingTime: 4
sourceId: "wiki-eda-refdes-footprint"
---
> 一个元件在 EDA 里有三重身份：**位号**（这块板上的哪一个）、**Part name**（它是什么器件）、**Footprint**（它怎么焊到板上）。下面逐一拆开。

## 一、位号 vs Part name：谁 与 是什么

**part name 是「类」，位号是「实例变量名」**——part name 回答"这是什么器件"（10kΩ 1% 0805 电阻、LM358DT 运放），同一类器件可以出现很多个；位号（Reference Designator / RefDes）回答"这块板上的哪一个是它"（R1、R2、R3 各自唯一）。

![位号与 part name 的区分](/images/articles/eda-refdes-footprint/599638c779e3c7980f80.webp)

*三个电阻共享同一个 part name，位号各自唯一；BOM 里按 part name 合并，位号列成清单。*

| | **位号（RefDes / Designator）** | **Part name（元件型号 / Value）** |
|---|---|---|
| 回答的问题 | 这个是谁、在哪 | 这是什么器件 |
| 唯一性 | **板内唯一**，不可重复 | 可重复，同类器件共享 |
| 例子 | R1、C12、U3、D2、Q4、J1 | 10kΩ 1% 0805、LM358DT、STM32F103C8T6 |
| 谁产生 | 原理图自动编号（Annotate） | 从元件库带出或手填 |
| 用在哪 | 原理图、PCB 丝印、BOM、装配图、调试维修 | BOM 分组、采购、库管理 |
| 各 EDA 字段 | KiCad `Reference` / Altium `Designator` / 立创 `位号` | KiCad `Value` / Altium `Comment` / 立创 `名称` |

### 最容易混的三层

1. **位号** `R1`——实例 ID
2. **Value / 参数** `10kΩ 1%`——电气参数，人读的
3. **MPN 厂家料号** `RC0805FR-0710KL`——采购用的精确料号

出 BOM 采购时只写 "10kΩ" 是灾难——符合 10kΩ 的料号有几百种（0402/0603/0805、1%/5%、不同温漂和功率）。BOM 分组键应该是 **型号 + 封装 + 关键参数**，只按型号分组会把 10kΩ 0402 和 10kΩ 0805 错误地合并成一行。

### 位号前缀惯例

源自 IEEE 315 / ASME Y14.44，非强制：R 电阻、C 电容、L 电感、D 二极管、Q 三极管/MOS、U 集成电路、J/P 连接器、FB 磁珠、F 保险丝、Y 晶振、TP 测试点、SW 开关、K 继电器、T 变压器。不同公司习惯有差异（IC 用 U 或 IC，连接器有 J/P/CN 三种写法），团队内统一即可，不必纠结对错。

### 位号的实践要点

- **丝印上印的是位号不是型号**——空间有限，且维修时要对着原理图找位置，位号才是定位信息。型号只在空间允许时偶尔印。
- **位号在 Re-annotate（重新编号）后会变**，别拿它当长期主键绑到外部系统（ERP、维修记录），它只在当前版本内稳定。
- **多通道 / 复用电路**的位号带后缀，如 `R1A / R1B` 或 `U1_1 / U1_2`。
- 手工改位号后要通过 ECO 同步到 PCB，否则原理图和板子对不上。

## 二、Footprint（封装）：元件的物理接口

### 一句话理解

Footprint（封装 / 焊盘图案 / land pattern）是**元件在 PCB 上的"着陆规格"**——一组按层组织的几何图形，精确描述元件的每个引脚如何物理地焊接到电路板上。

打个比方：原理图符号是元件的**逻辑接口**（引脚号、电气连接关系），footprint 是元件的**物理接口**（每个引脚在板上的坐标、焊盘形状与尺寸）。

### 为什么 EDA 里要拆成两个东西

逻辑与物理解耦，带来两个方向的好处：

- **一个符号配多种封装**：同一个运放（如 LM358），原理图符号完全一样，但可以选 SOIC-8、TSSOP-8、QFN-8 等封装。换封装不用改原理图，只在元件属性里指定新的 footprint。
- **一种封装装多种元件**：SOIC-8 的 footprint 可以给任何 8 引脚、引脚间距兼容的芯片用。

代价是：两者必须靠**引脚号（Pin Number）**一一对应——这是整个 EDA 数据模型里最关键、也最容易出错的一条桥梁。

![原理图符号与 PCB 封装的映射](/images/articles/eda-refdes-footprint/376db4d7810af1033fd7.webp)

*符号管逻辑（引脚名、网络连接），封装管物理（焊盘位置、尺寸），Pin 1 ↔ Pad 1 靠引脚号绑定。*

### Footprint 里有什么（按层组织）

![PCB footprint 分层拆解](/images/articles/eda-refdes-footprint/ed814ed3b5e42ac0939d.webp)

*顶部是板上实际看到的样子，下面是按层拆解后的各层图形。*

EDA 中的 footprint 本质上是"若干层上的一组图形元素"：

| 层 | 中文名 | 作用 | 备注 |
|---|---|---|---|
| Copper | 铜箔层 | **焊盘**，电气连接点 | 贴片（SMD）是一块铜皮；通孔（THT）有钻孔和焊环 |
| Solder Mask | 阻焊层 | 焊盘位置开窗，露出铜 | 防止回流焊时焊锡桥连；开窗通常比焊盘略大 |
| Paste Mask | 钢网层 | 印刷锡膏的开孔 | **仅贴片元件需要**；开孔通常比焊盘小 10–20% |
| Silkscreen | 丝印层 | 元件外形、位号（U1、R2）、1 脚标记 | 手工焊接和返修全靠它认方向 |
| Courtyard | 占用边界 | 元件的物理占用范围 | DRC 元件间距检查的依据 |
| Assembly | 装配层 | 贴片机的元件中心、旋转角度 | 用于生成贴片坐标文件 |
| 3D 模型（可选） | — | STEP 文件 | 结构干涉检查、机壳设计 |

### 关键属性

- **焊盘编号 = 原理图引脚号**：编号不一致是最常见、最致命的错误，直接导致网络连错甚至板子报废。
- **焊盘尺寸来自数据手册**：按厂家 Datasheet 的推荐值，或遵循 **IPC-7351** 标准（现代 EDA 的标准封装库基本都按它生成）。
- **通孔 vs 贴片**：通孔焊盘关心孔径（元件引脚直径 + 间隙）和焊环宽度；贴片焊盘关心长宽，影响可焊性和锡量。
- **原点（Origin）**：元件的坐标基准。贴片坐标、旋转角度都以它为参考，通常取几何中心或 1 脚焊盘。
- **1 脚方向**：元件旋转、放到 Bottom 面时要镜像，1 脚位置随之改变——丝印的 1 脚标记就是用来核对的。

### 制造输出都从 footprint 生成

- **Gerber**：每一层的铜、阻焊、钢网、丝印图形
- **钻孔文件（Excellon / NC Drill）**：通孔焊盘的孔位、孔径
- **贴片坐标文件（Pick & Place / Centroid）**：元件位置、旋转角、是否在 Bottom 面

### 各家 EDA 的叫法

| EDA 软件 | footprint 的叫法 | 库文件 |
|---|---|---|
| Altium Designer | PCB Footprint / Component | `.PcbLib` |
| KiCad | Footprint | `.pretty`（封装库） |
| Cadence OrCAD / Allegro | Package Symbol / Footprint | `.dra` / `.psm` |
| Mentor PADS | Decal（贴花，老叫法） | 封装库 |
| Eagle | Package | `.lbr` |
| 立创 EDA / 嘉立创 | 封装 | 在线元件库 |

### 实践提醒

1. **新封装最好拿实物或 Datasheet 量**：焊盘间距错 0.5mm，板子就废了。
2. **优先用标准库**：KiCad、立创 EDA 自带大量按 IPC-7351 验证过的封装，尽量别手画。
3. **建完后做 DRC**：元件间距、焊盘间距、丝印上焊盘等规则检查能提前挡住低级错误。
4. **footprint 里不含任何电气连接信息**——连接关系全部来自原理图网表，它只负责"几何"。
