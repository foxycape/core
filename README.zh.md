<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

面向 Obsidian 的 PDF 阅读器：划线、引用与深度链接都能回到原文，和笔记工作流连在一起。

[English](README.md) | [中文](README.zh.md)

## 为什么需要它

在 Obsidian 里读 PDF，笔记链路经常断掉：

- 划线留在 PDF 里，vault 笔记在另一边。
- 要图时只能截图，糊且难管理。
- 粘贴的摘录和图片很少能指回具体页或区域。
- 深色主题下，浅色 PDF 页很刺眼。
- 换阅读器后，已有的页码/选区链接可能失效。

Foxycape PDF 在 Obsidian 内补上这些缺口。

## 功能特点

### 划线同步笔记

不必让划线只留在 PDF 里。新建划线时，可自动创建或更新与 PDF 同名的 Markdown 笔记，追加带回链的摘录，并可选分屏打开；不需要时可在设置中关闭。

<!-- GIF: docs/gifs/highlight-notes.gif — 划线后自动写入同名笔记 -->

### 提取内嵌高清图

不用靠模糊截图凑合。悬停内嵌图片（移动端用触控控件）即可预览、复制或下载原图。

<!-- GIF: docs/gifs/embed-images.gif — 悬停镜头：预览 / 复制 / 下载 -->

### 文本与图片引用，一键回源

引用带着出处，之后还能从笔记跳回 PDF：

- 复制文本引用为带深度链接的 Markdown（`#page=` / `#selection=` / `#markId=`）。
- 复制图片引用；粘贴到 Markdown 时自动保存 PNG 到 PDF 旁，并插入可点击链接。
- 右键笔记中的图片 → **在 Foxycape 中打开**，回到对应页并高亮原始区域。

<!-- GIF: docs/gifs/cite-and-back.gif — 复制引用 → 粘贴 → 回 PDF -->

### 适配 Obsidian 主题

深色 vault 里浅色 PDF 页往往刺眼。可选将灰度矢量色映射到主题前景/背景（BETA），范围可选全部 / 仅深色 / 仅浅色；彩色图与彩色矢量保持原色。

<!-- GIF: docs/gifs/theme-adapt.gif — PDF 页面随主题变化 -->

### 兼容内置阅读器的位置与链接

换阅读器不该弄坏已有链接。兼容 Obsidian 的 `#page=`、`#selection=`，可设为默认 PDF 阅读器，已打开时复用标签，并支持 `#markId=` 精确定位划线。

<!-- GIF: docs/gifs/compat-links.gif — 打开已有页码/选区链接 -->

### 划线样式与划线列表

支持荧光笔、波浪线、直线下划线及自定义颜色。划线列表可筛选、排序、跳转与删除。

<!-- GIF: docs/gifs/annotations.gif — 标注样式与划线列表 -->

### 智能拷贝 — 自动去掉软换行

PDF 排版常把句子拦腰截断，复制后满是多余换行。照常选中并复制即可：Foxycape 会去掉这些软换行，粘贴成连贯段落，真正的段落分隔仍会保留。

<!-- GIF: docs/gifs/smart-copy.gif — 选中文本 → 复制 → 粘贴无句中换行 -->

### 导航与搜索

目录、缩略图、页码跳转，以及文档内搜索（`Mod+F`），支持区分大小写 / 变音符号 / 全字匹配。搜索基于 PDF 文本层（无 OCR）。

<!-- GIF: docs/gifs/navigate-search.gif — 目录、缩略图与搜索 -->

### 阅读布局

缩放（自动 / 适合页宽 / 百分比）、纵向或横向滚动、单页 / 双页 / 书籍布局、页面旋转、密码 PDF。支持桌面与移动端。

<!-- GIF: docs/gifs/layout.gif — 布局与缩放 -->

## 许可证

采用 [GNU Affero General Public License v3](LICENSE.md)（AGPL-3.0）与商业许可的双许可。

- **AGPL**：可免费使用、修改与再分发，但须遵守 AGPL（含对修改版网络提供时的源码义务）。
- **商业许可**：若无法遵守 AGPL，可联系 **company@tiefeiying.com** 洽谈商业授权。

全文见 [LICENSE.md](LICENSE.md)。
