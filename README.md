# 微信群 AI 机器人（Wechaty + DeepSeek）

基于 **个人微信网页版协议**（`wechaty-puppet-wechat`）的群聊机器人：在群内用关键词或 @ 触发 **DeepSeek** 短回复，并支持 **@ +「今日运势」** 本地抽签（同人同日固定）。

> **重要**：微信对网页版与自动化限制严格，可能导致无法扫码、503、账号风控等。本项目仅供学习与技术验证，**不保证可用**，使用风险自负，请遵守微信用户协议及相关法律法规。

## 技术栈

- Node.js（建议 ≥ 18）
- [wechaty](https://github.com/wechaty/wechaty)
- [wechaty-puppet-wechat](https://github.com/wechaty/wechaty-puppet-wechat)
- [axios](https://github.com/axios/axios)（调用 DeepSeek）
- [dotenv](https://github.com/motdotla/dotenv)

## 功能说明

| 能力 | 触发条件 | 行为 |
|------|----------|------|
| AI 短回复 | **仅群聊**；消息含 **`AI`**，或 **@机器人** | 调用 DeepSeek，回复 **最多 25 个字**（超出截断） |
| 今日运势 | **仅群聊**；**必须 @机器人**，且消息含 **`今日运势`** | 不调用 API，从内置词库按 **用户名 + 本地日期** 种子伪随机生成，**同人同一天结果相同**，隔天变化 |

其它规则：

- 忽略机器人自己发的消息，避免自言自语。
- 每条群消息会在控制台输出 `[message]` 日志，便于调试。

## 项目结构

```
wechatbot/
├── bot.js           # 入口
├── package.json
├── .env             # 本地密钥（勿提交）
├── .env.example     # 环境变量示例
├── README.md
└── node_modules/    # npm install 生成
```

## 环境变量

复制 `.env.example` 为 `.env`，至少配置：

| 变量 | 说明 |
|------|------|
| `API_KEY` | DeepSeek API Key（[平台](https://platform.deepseek.com/) 申请） |

## 安装与运行

```bash
cd wechatbot
npm install
node bot.js
```

或使用：

```bash
npm start
```

首次运行控制台会打印 **扫码链接**，用浏览器打开后用需挂机器人的微信号扫码登录网页微信。

### 调试：显示 Puppeteer 浏览器窗口

```powershell
# Windows PowerShell 示例
$env:WECHATY_PUPPET_WECHAT_PUPPETEER_HEAD="1"
node bot.js
```

## 常见问题

1. **`starting puppet ... timeout`**  
   Wechaty 对 `puppet.start()` 有约 15 秒等待；冷启动 Chromium 较慢时会出现 WARN，若稍后仍能扫码可暂忽略。

2. **`503` / `init() without a ready angular env`**  
   网页微信页面未进入预期环境，常见于策略调整或账号不可用网页版。

3. **手机提示无法扫码登录其它设备 / 被登出**  
   属微信侧风控，需按客户端提示等待申诉或更换策略；**无法通过改本仓库代码绕过**。

## 配置调整

- **AI 回复字数上限**：修改 `bot.js` 中 `MAX_REPLY_CHARS` 与 `callDeepSeek` 内 system 提示中的字数描述。
- **运势词库**：修改 `FORTUNE_POOL` 对象中的数组即可。

## 许可与免责

代码按项目实际情况使用；第三方库各自遵循其许可证。因使用本项目导致的账号限制、数据丢失或其它损失，**作者与仓库维护者不承担任何责任**。
