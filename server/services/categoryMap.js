// 앱 카테고리(등산/낚시/자전거/먹방/힐링/기타) <-> TourAPI 코드 매핑
// cat3 코드값을 직접 하드코딩하지 않고, categoryCode2 API에서 이름으로 찾아 매칭한다.
// (레포츠 대분류 A03 트리는 자주 바뀌지 않으므로 메모리에 캐시)

import { getCategoryCodes, CONTENT_TYPE } from "./tourApi.js";

const LEPORTS_CAT1 = "A03";

// 앱 카테고리 정의: 이름/라벨/레포츠 cat3 매칭 키워드/키워드 검색 폴백어
export const APP_CATEGORIES = [
  {
    id: "hiking",
    label: { ko: "등산", en: "Hiking" },
    icon: "⛰️",
    cat3Keywords: ["트래킹"],
    searchKeywords: { ko: ["등산", "트레킹"], en: ["hiking", "trekking", "mountain"] },
  },
  {
    id: "fishing",
    label: { ko: "낚시", en: "Fishing" },
    icon: "🎣",
    cat3Keywords: ["낚시"],
    searchKeywords: { ko: ["낚시"], en: ["fishing"] },
  },
  {
    id: "cycling",
    label: { ko: "자전거", en: "Cycling" },
    icon: "🚴",
    cat3Keywords: ["자전거"],
    searchKeywords: { ko: ["자전거", "자전거길"], en: ["cycling", "bike"] },
  },
  {
    id: "food",
    label: { ko: "먹방", en: "Food" },
    icon: "🍽️",
    contentTypeId: CONTENT_TYPE.FOOD,
    searchKeywords: { ko: ["맛집"], en: ["restaurant", "local food"] },
  },
  {
    id: "healing",
    label: { ko: "힐링", en: "Healing" },
    icon: "🌿",
    cat3Keywords: ["휴양", "치유"],
    searchKeywords: { ko: ["힐링", "휴양림", "치유의숲", "스파"], en: ["healing", "wellness", "spa", "forest"] },
  },
  {
    id: "etc",
    label: { ko: "기타", en: "Other" },
    icon: "✨",
    searchKeywords: { ko: [], en: [] },
  },
];

let cat3TreeCache = null;
let cat3TreeCachedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12시간

// A03(레포츠) 산하 cat3 전체 트리를 [{cat2, cat3, name}] 형태로 가져온다 (한국어 기준으로 이름 매칭)
async function getLeportsCat3Tree() {
  const now = Date.now();
  if (cat3TreeCache && now - cat3TreeCachedAt < CACHE_TTL_MS) return cat3TreeCache;

  const cat2List = await getCategoryCodes("ko", { cat1: LEPORTS_CAT1 });
  const tree = [];
  for (const cat2 of cat2List) {
    try {
      const cat3List = await getCategoryCodes("ko", { cat1: LEPORTS_CAT1, cat2: cat2.code });
      for (const cat3 of cat3List) {
        tree.push({ cat2: cat2.code, cat3: cat3.code, name: cat3.name });
      }
    } catch {
      // 일부 cat2는 하위 코드가 없을 수 있음 - 무시하고 계속 진행
    }
  }

  cat3TreeCache = tree;
  cat3TreeCachedAt = now;
  return tree;
}

// 앱 카테고리 하나에 대해, 실제 조회에 쓸 조건(cat 코드 or 키워드 목록)을 구한다.
export async function resolveCategory(categoryId) {
  const category = APP_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;

  if (category.contentTypeId) {
    return { type: "contentType", contentTypeId: category.contentTypeId, category };
  }

  if (category.cat3Keywords?.length) {
    try {
      const tree = await getLeportsCat3Tree();
      const matches = tree.filter((node) =>
        category.cat3Keywords.some((kw) => node.name.includes(kw))
      );
      if (matches.length) {
        return {
          type: "cat3",
          cat1: LEPORTS_CAT1,
          matches, // [{cat2, cat3, name}]
          category,
        };
      }
    } catch {
      // TourAPI 장애 시 키워드 검색으로 폴백
    }
  }

  return { type: "keyword", category };
}
