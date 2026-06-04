# AI 聊天插件

[![GitHub release](https://img.shields.io/github/v/release/XingYunStar/napcat-plugin-ai-chat)](https://github.com/XingYunStar/napcat-plugin-ai-chat/releases)
[![License](https://img.shields.io/github/license/XingYunStar/napcat-plugin-ai-chat)](LICENSE)

一个功能强大的 AI 聊天插件，支持 OpenAI 兼容 API，可接入 DeepSeek、SiliconFlow 等众多大模型，提供文本对话与视觉识别能力。

## ✨ 功能特性

- 🤖 **多触发方式**：支持唤醒词（前缀）和 @ 机器人两种触发，可独立开关
- 🧠 **文本对话**：完整的上下文记忆，可配置系统提示词、对话轮次
- 🖼️ **视觉识别**：发送图片并搭配触发词，调用视觉模型进行识别或 OCR
- 🔄 **模型管理**：文本/视觉模型分开配置，支持从 API 动态获取模型列表
- ✂️ **分段回复**：按自定义正则拆分长文本，避免消息被折叠
- 🔒 **访问控制**：支持用户/群白名单、黑名单，精确控制使用权限
- 🎨 **WebUI 仪表盘**：可视化配置所有参数，实时查看状态、测试模型连接
- 📦 **开箱即用**：默认配置即可快速体验 AI 聊天

## 📦 安装方式

### 方式一：插件商店安装（推荐）

1. 打开 NapCat 终端，执行以下命令替换插件源地址：
   ```bash
   sed -i 's/NapNeko\/napcat-plugin-index/HolyFoxTeam\/napcat-plugin-community-index/g' ./napcat/napcat.mjs
   ```

2. 重启 NapCat 容器：
   ```bash
   docker restart napcat
   # 或
   systemctl restart napcat
   ```

3. 打开 NapCat WebUI，进入插件商店，搜索 **"AI聊天"** 即可安装

### 方式二：手动安装

1. 从 [Releases](https://github.com/XingYunStar/napcat-plugin-ai-chat/releases) 下载最新版本的 `.zip` 文件
2. 解压到 NapCat 的 `plugins` 目录
3. 重启 NapCat

## ⚙️ 配置说明

在 NapCat WebUI 的插件管理页面（或扩展仪表盘）可以配置以下参数：

### 基本设置
| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 总开关 | 关闭后所有触发方式失效 | 开启 |
| 启用唤醒词 | 以唤醒词开头的消息触发 | 开启 |
| 唤醒词 | 自定义前缀，如"机器人" | `机器人` |
| 启用 @ 触发 | @ 机器人触发 | 关闭 |

### 文本模型配置
| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| API 地址 | 兼容 OpenAI 格式的 API 地址 | `https://api.deepseek.com` |
| API 密钥 | API 鉴权密钥 | 空 |
| 选择模型 | 从 API 获取的模型列表中选择 | 空 |
| 自定义模型 | 若列表中没有，可在此输入模型 ID | 空 |
| 系统提示词 | 定义 AI 的人设、世界观等 | `你是一个有用的助手。` |
| Max Tokens | 生成回复的最大长度 | `2000` |
| Temperature | 随机性参数（0~2） | `0.7` |
| Top P | 核采样参数（0~1） | `1.0` |
| 引用回复 | 回复时是否引用原消息 | 开启 |
| 分段回复 | 是否按正则拆分长回复 | 关闭 |
| 分段正则 | 拆分规则 | `[。！？!?…]+` |
| 最大对话轮次 | 保留最近 N 轮上下文 | `50` |

### 视觉模型配置
| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 启用视觉模型 | 开启后，发送图片并触发可调用视觉模型 | 关闭 |
| 视觉 API 地址 | 视觉模型接口地址 | `https://api.siliconflow.cn` |
| 视觉 API 密钥 | 视觉模型密钥 | 空 |
| 选择视觉模型 | 从 API 获取的列表中选择 | `nex-agi/Nex-N2-Pro` |
| 自定义视觉模型 | 手动输入模型 ID | 空 |

### 访问控制
| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 用户白名单 | 逗号分隔 QQ 号，白名单优先 | 空 |
| 用户黑名单 | 逗号分隔 QQ 号 | 空 |
| 群白名单 | 逗号分隔群号 | 空 |
| 群黑名单 | 逗号分隔群号 | 空 |

## 🚀 使用说明

1. 安装并启用插件
2. 填写文本模型 API 地址和密钥（推荐 DeepSeek，可前往 [likefirefly.com](https://likefirefly.com/ai) 注册获取免费额度）
3. 保存配置后，点击"获取模型列表"或等待自动拉取，选择一个模型
4. 设置唤醒词（如"机器人"），或开启 @ 触发
5. 在群聊中发送 `机器人 你好` 或 `@Bot 你好`，即可开始对话

**视觉模型使用示例：**
- 发送 `机器人 这是什么？` 并附带一张图片
- 插件会调用视觉模型，返回图片内容描述

**注意：** 视觉模型需要依赖触发词，仅发送图片而不用唤醒词或 @ 机器人，不会触发识别。

## 📝 注意事项

- 插件依赖 NapCat 的 `get_image` 接口将 QQ 图片转为 base64，请确保 NapCat 版本支持
- 部分视觉 API 对图片格式有要求，若识别失败可尝试切换模型
- 白名单优先级高于黑名单，用户维度高于群维度
- 保存设置后关闭插件再启用，等待 5 秒后打开设置才能确保模型列表加载

## 👤 作者

**星陨** (XingYunStar)

- GitHub: [@XingYunStar](https://github.com/XingYunStar)

## 📄 许可证

MIT License © 2026 星陨

---

## 🔧 技术说明

### 插件 ID
```
napcat-plugin-ai-chat-pro
```

### 支持的 NapCat 版本
- NapCat v4.14.0 及以上

### 依赖的 API
- `get_group_info` - 获取群基本信息
- `get_group_detail_info` - 获取群详细信息（含群简介）
- `set_group_add_request` - 处理加群请求
- `send_group_msg` - 发送群消息
- `send_private_msg` - 发送私聊消息

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## ⭐ Star

如果这个插件对你有帮助，欢迎给个 Star ⭐