const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_USER_OPEN_ID = process.env.FEISHU_USER_OPEN_ID || "ou_0aaad9f5d663b3324cac1bf07a4eef19";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DRY_RUN = process.env.DRY_RUN === "1";

const sourceQueries = [
  ["国内宏观政策", "中国 宏观 政策 经济 财政 货币"],
  ["国际局势", "Reuters AP BBC world geopolitics energy shipping"],
  ["财经市场", "global markets economy central bank China Reuters"],
  ["物流供应链", "China logistics supply chain shipping freight port"],
  ["科技AI", "AI OpenAI Google Anthropic Microsoft Nvidia regulation"],
  ["产业消费", "China industry consumption business company policy"]
];

function todayLabel() {
  const date = new Date();
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric"
  }).format(date);
}

function stripXml(value) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function getTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripXml(match[1]) : "";
}

async function fetchNewsCandidates() {
  const candidates = [];
  await Promise.allSettled(
    sourceQueries.flatMap(([category, query]) => [
      fetchGoogleNews(category, query, candidates),
      fetchGdelt(category, query, candidates)
    ])
  );

  const seen = new Set();
  return candidates.filter((item) => {
    const key = item.title.replace(/\s+-\s+.*$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 45);
}

async function fetchGoogleNews(category, query, candidates) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:2d")}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
    const response = await fetch(url, {
      headers: { "user-agent": "daily-news-brief/1.0" },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return;
    const xml = await response.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    for (const item of items.slice(0, 8)) {
      const title = getTag(item, "title");
      const link = getTag(item, "link");
      const pubDate = getTag(item, "pubDate");
      const source = getTag(item, "source") || "Google News";
      if (!title || !link) continue;
      candidates.push({ category, title, link, pubDate, source });
    }
  } catch (error) {
    console.warn(`Google News skipped for ${category}: ${error.message}`);
  }
}

async function fetchGdelt(category, query, candidates) {
  try {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=12&format=json&timespan=48h&sort=HybridRel`;
    const response = await fetch(url, {
      headers: { "user-agent": "daily-news-brief/1.0" },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return;
    const data = await response.json();
    for (const article of (data.articles || []).slice(0, 8)) {
      if (!article.title || !article.url) continue;
      candidates.push({
        category,
        title: article.title,
        link: article.url,
        pubDate: article.seendate || "",
        source: article.domain || "GDELT"
      });
    }
  } catch (error) {
    console.warn(`GDELT skipped for ${category}: ${error.message}`);
  }
}

function fallbackBrief(candidates) {
  const selected = candidates.slice(0, 9);
  const lines = [
    `📰 今日国内外重要资讯｜${todayLabel()}`,
    "一句话总览：以下为近两天公开新闻源中值得关注的经营视角简报；未配置 OPENAI_API_KEY 时使用基础版摘要。",
    ""
  ];
  selected.forEach((item, index) => {
    lines.push(`${index + 1}. 【${item.category}】${item.title}`);
    lines.push(`   发生了什么：${item.source} 发布相关进展。`);
    lines.push("   为什么重要：该信息可能影响宏观预期、行业节奏或企业经营判断。");
    lines.push("   对你业务的判断：建议结合客户行业、物流成本、团队动作和AI效率工具观察后续变化。");
    lines.push(`   来源：${item.source} ${item.link}`);
  });
  lines.push("");
  lines.push("今日重点关注：继续观察政策、油价、汇率、AI监管和物流供应链变化。");
  return lines.join("\n");
}

async function generateBrief(candidates) {
  if (!OPENAI_API_KEY) return fallbackBrief(candidates);

  const prompt = [
    "你是给中国业务管理者看的新闻深度简报编辑。",
    "从候选新闻里选 8-10 条最重要的，不要选娱乐八卦、猎奇、低价值社会新闻。",
    "每条必须包含：发生了什么、为什么重要、对你业务的判断、来源。",
    "业务判断要贴近经营、团队管理、物流供应链、客户开发、AI效率或风险意识。",
    "总长度 900-1400 字，中文，直接清晰。",
    `今天日期标签：${todayLabel()}`,
    "",
    "候选新闻 JSON：",
    JSON.stringify(candidates, null, 2)
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "你只输出可直接发送到飞书的中文新闻简报，不输出额外解释。"
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || fallbackBrief(candidates);
}

async function getTenantToken() {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new Error("Missing FEISHU_APP_ID or FEISHU_APP_SECRET");
  }
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    })
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`Feishu token failed: ${JSON.stringify(data)}`);
  }
  return data.tenant_access_token;
}

async function sendFeishuText(text) {
  if (DRY_RUN) {
    console.log(text);
    return;
  }
  const token = await getTenantToken();
  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      receive_id: FEISHU_USER_OPEN_ID,
      msg_type: "text",
      content: JSON.stringify({ text })
    })
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`Feishu send failed: ${JSON.stringify(data)}`);
  }
  console.log(JSON.stringify({ ok: true, message_id: data.data?.message_id, chat_id: data.data?.chat_id }));
}

const candidates = await fetchNewsCandidates();
if (candidates.length < 8) {
  throw new Error(`Too few news candidates: ${candidates.length}`);
}
const brief = await generateBrief(candidates);
await sendFeishuText(brief);
