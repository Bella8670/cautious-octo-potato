# 每日学习云端推送

这个目录用于把每日推送迁到云端定时执行，避免依赖本机 Mac/Codex 是否开机。

## 已实现

- 每天 07:00 Asia/Shanghai 运行 GitHub Actions。
- `daily-news.yml`：新闻深度简报，发杨谦飞书私聊。
- `daily-growth.yml`：个人能力精进，发杨谦飞书私聊。
- `daily-call-center.yml`：呼叫中心学习素材，发“运荔枝呼叫中心管理”群。
- 使用飞书应用机器人身份发送，不依赖本机用户 OAuth。

## 必需 Secrets

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 配置：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_USER_OPEN_ID`，当前值为 `ou_0aaad9f5d663b3324cac1bf07a4eef19`
- `FEISHU_CC_CHAT_ID`，当前值为 `oc_999554f7350958c154053c6a78b621ae`
- `OPENAI_API_KEY`

可选变量：

- `OPENAI_MODEL`，默认 `gpt-4o-mini`

## 本地测试

只预览不发送：

```bash
DRY_RUN=1 OPENAI_API_KEY=... npm run news
DRY_RUN=1 OPENAI_API_KEY=... npm run growth
DRY_RUN=1 OPENAI_API_KEY=... npm run call-center
```

实际发送：

```bash
FEISHU_APP_ID=... FEISHU_APP_SECRET=... FEISHU_USER_OPEN_ID=ou_0aaad9f5d663b3324cac1bf07a4eef19 OPENAI_API_KEY=... npm run news
```

## 注意

飞书机器人私聊发送已在本机验证通过。云端部署时不要把 app secret 或 OpenAI key 写入代码，只放到 GitHub Secrets。

呼叫中心群推送使用机器人身份，云端启用前请确认机器人已在目标群内，且应用具备 `im:message:send_as_bot` 权限。

## 一键创建 GitHub 私有仓库并配置 Secrets

先安装并登录 GitHub CLI：

```bash
brew install gh
gh auth login
```

然后在当前目录执行：

```bash
export FEISHU_APP_ID="..."
export FEISHU_APP_SECRET="..."
export FEISHU_USER_OPEN_ID="ou_0aaad9f5d663b3324cac1bf07a4eef19"
export FEISHU_CC_CHAT_ID="oc_999554f7350958c154053c6a78b621ae"
export OPENAI_API_KEY="..."
./scripts/setup-github-cloud.sh daily-learning-cloud-push
```

脚本会创建私有仓库、推送代码、写入 GitHub Actions Secrets，并提示如何手动触发三个 workflow 测试。
