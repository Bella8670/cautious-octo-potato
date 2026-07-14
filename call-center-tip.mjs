const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_CC_CHAT_ID = process.env.FEISHU_CC_CHAT_ID || "oc_999554f7350958c154053c6a78b621ae";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DRY_RUN = process.env.DRY_RUN === "1";

const categories = ["客户端", "司机端", "400", "通用客服"];

function categoryForToday() {
  const dayNumber = Math.floor(Date.now() / 86400000);
  return categories[dayNumber % categories.length];
}

function fallbackMessage(category) {
  return [
    "💡 M.D学习小tip",
    `今日主题：${category}沟通先确认主诉再给动作`,
    "为什么学：一线电话里最容易急着解释，结果客户问题没听完整，后续备注也不清楚。",
    "方法：先用一句话复述对方问题，再补一个关键字段，最后说明下一步处理动作。",
    "可照说：我确认下，您现在主要想解决的是这个问题，对吗？我先把关键信息记完整，再给您同步下一步。",
    `适用场景：${category}`,
    "避坑：不要一上来连续追问或直接下结论，先确认客户真正要解决什么。"
  ].join("\n");
}

async function generateMessage() {
  const category = categoryForToday();
  if (!OPENAI_API_KEY) return fallbackMessage(category);

  const prompt = `请生成一条呼叫中心每日学习小tip，分类：${category}。
格式必须为7行：
第一行：💡 M.D学习小tip
第二行：今日主题：一句话主题
第三行：为什么学：说明解决什么一线问题
第四行：方法：用1-2句话讲清技巧
第五行：可照说：一句坐席能直接复用的话术
第六行：适用场景：客户端/司机端/400/通用客服中的一种或多种
第七行：避坑：提醒一个新人容易犯的错
总长度260-420字。语言接地气、职场温和，不要理论课，不要隐私信息。`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "你只输出可直接发送到飞书的中文呼叫中心学习推送。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.4
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || fallbackMessage(category);
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
  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      receive_id: FEISHU_CC_CHAT_ID,
      msg_type: "text",
      content: JSON.stringify({ text })
    })
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) throw new Error(`Feishu send failed: ${JSON.stringify(data)}`);
  console.log(JSON.stringify({ ok: true, message_id: data.data?.message_id, chat_id: data.data?.chat_id }));
}

await sendText(await generateMessage());
