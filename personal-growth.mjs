const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_USER_OPEN_ID = process.env.FEISHU_USER_OPEN_ID || "ou_0aaad9f5d663b3324cac1bf07a4eef19";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DRY_RUN = process.env.DRY_RUN === "1";

const topics = ["经营管理", "AI效率", "销售客服", "表达汇报", "复盘思维", "团队管理", "数据经营", "时间精力管理"];

function todayLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(new Date());
}

function topicForToday() {
  const dayNumber = Math.floor(Date.now() / 86400000);
  return topics[dayNumber % topics.length];
}

function fallbackMessage(topic) {
  return [
    "💡 今日能力精进",
    `主题：${topic}里的一个可执行小动作`,
    "推荐：高效复盘方法 https://www.processon.com/knowledge/fupan",
    "为什么看：每天管理动作不需要很大，关键是把目标、结果、原因和下一步讲清楚。",
    "今天练：选一件昨天没达预期的小事，用4句话写清目标、差距、原因、明天动作。",
    "适用场景：晨会 / 复盘 / 团队管理",
    "避坑：不要把学习停在收藏链接，必须落到今天能做的一句话或一个动作。"
  ].join("\n");
}

async function generateMessage() {
  const topic = topicForToday();
  if (!OPENAI_API_KEY) return fallbackMessage(topic);

  const prompt = `今天是${todayLabel()}。请生成一条发给杨谦的个人能力精进推送，主题轮换到：${topic}。
要求：
第一行：💡 今日能力精进
第二行：主题：一句话主题
第三行：推荐：标题 + 公开链接
第四行：为什么看：解决什么实际问题
第五行：今天练：1个当天能做的小动作
第六行：适用场景：晨会/复盘/带团队/经营分析/客户沟通/AI效率/表达汇报中的一种或多种
第七行：避坑：一个容易误用或流于形式的点
总长度180-320字。链接只给1个，内容要实用，避免鸡汤。`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "你只输出可直接发送到飞书的中文学习推送。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.4
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || fallbackMessage(topic);
}

async function getTenantToken() {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) throw new Error("Missing FEISHU_APP_ID or FEISHU_APP_SECRET");
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET })
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) throw new Error(`Feishu token failed: ${JSON.stringify(data)}`);
  return data.tenant_access_token;
}

async function sendText(text) {
  if (DRY_RUN) {
    console.log(text);
    return;
  }
  const token = await getTenantToken();
  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      receive_id: FEISHU_USER_OPEN_ID,
      msg_type: "text",
      content: JSON.stringify({ text })
    })
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) throw new Error(`Feishu send failed: ${JSON.stringify(data)}`);
  console.log(JSON.stringify({ ok: true, message_id: data.data?.message_id, chat_id: data.data?.chat_id }));
}

await sendText(await generateMessage());
