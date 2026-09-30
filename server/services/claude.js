import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function stripCodeFence(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

// 규칙 기반 폴백: ANTHROPIC_API_KEY가 없거나 호출 실패 시 사용
function fallbackRecommend(candidates, { lang, categoryLabel, regionName }, limit) {
  const picked = candidates.slice(0, limit);
  const blurb =
    lang === "en"
      ? `A popular ${categoryLabel || "travel"} spot in ${regionName || "this area"}.`
      : `${regionName || "이 지역"}의 인기 ${categoryLabel || "여행"} 명소예요.`;
  return {
    regionSummary:
      lang === "en"
        ? `Explore ${regionName || "this region"} — here are a few spots worth a visit.`
        : `${regionName || "이 지역"}을 둘러보세요 — 가볼 만한 곳을 모아봤어요.`,
    spots: picked.map((c) => ({ contentid: c.contentid, blurb })),
  };
}

/**
 * @param {object[]} candidates - TourAPI에서 가져온 후보 목록 (contentid, title, addr1, firstimage 등)
 * @param {object} opts - { lang: 'ko'|'en', categoryLabel, regionName, limit }
 */
export async function recommendSpots(candidates, opts = {}) {
  const { lang = "ko", categoryLabel = "", regionName = "", limit = 8 } = opts;
  const anthropic = getClient();

  if (!anthropic || candidates.length === 0) {
    return fallbackRecommend(candidates, { lang, categoryLabel, regionName }, limit);
  }

  const slim = candidates.slice(0, 40).map((c) => ({
    contentid: c.contentid,
    title: c.title,
    addr: c.addr1,
    hasImage: Boolean(c.firstimage),
  }));

  const langInstruction =
    lang === "en"
      ? "Write all text in natural, friendly English for a foreign tourist."
      : "모든 텍스트는 자연스러운 한국어로 작성하세요.";

  const prompt = `You are a local travel guide app's recommendation engine.
Region: ${regionName || "(unspecified)"}
User's interest category: ${categoryLabel || "(any)"}
Candidate spots (JSON): ${JSON.stringify(slim)}

Pick the best ${Math.min(limit, slim.length)} spots from the candidates for this user, favoring variety and spots with images.
${langInstruction}
Respond with ONLY raw JSON (no markdown fences) in this exact shape:
{
  "regionSummary": "one short enticing sentence introducing the region for someone who has never been there",
  "spots": [ { "contentid": "...", "blurb": "one short, specific sentence on why this spot fits the user's interest" } ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    const parsed = JSON.parse(stripCodeFence(text));
    if (!Array.isArray(parsed.spots)) throw new Error("invalid shape");
    return parsed;
  } catch (err) {
    console.error("[claude] recommend failed, falling back:", err.message);
    return fallbackRecommend(candidates, { lang, categoryLabel, regionName }, limit);
  }
}
