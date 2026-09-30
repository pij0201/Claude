import { Router } from "express";
import * as tourApi from "../services/tourApi.js";
import { APP_CATEGORIES, resolveCategory } from "../services/categoryMap.js";
import { recommendSpots } from "../services/claude.js";

const router = Router();

function normalizeLang(lang) {
  return lang === "en" ? "en" : "ko";
}

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

// 카테고리 목록 (등산/낚시/자전거/먹방/힐링/기타)
router.get("/categories", (req, res) => {
  const lang = normalizeLang(req.query.lang);
  res.json(
    APP_CATEGORIES.map((c) => ({ id: c.id, label: c.label[lang], icon: c.icon }))
  );
});

// 시도 목록 (areaCode 없을 때) 또는 시군구 목록 (areaCode 지정 시)
router.get(
  "/regions",
  asyncHandler(async (req, res) => {
    const lang = normalizeLang(req.query.lang);
    const areaCode = req.query.areaCode;
    const raw = await tourApi.getAreaCodes(lang, areaCode);
    res.json(raw.map((r) => ({ code: r.code, name: r.name })));
  })
);

async function gatherCandidates({ resolved, lang, areaCode, sigunguCode }) {
  const seen = new Map();
  const add = (items) => {
    for (const item of items) {
      if (item.contentid && !seen.has(item.contentid)) seen.set(item.contentid, item);
    }
  };

  if (resolved.type === "contentType") {
    add(await tourApi.getAreaBasedList(lang, { areaCode, sigunguCode, contentTypeId: resolved.contentTypeId }));
  } else if (resolved.type === "cat3") {
    const matches = resolved.matches.slice(0, 6); // API 호출 과다 방지
    for (const m of matches) {
      try {
        add(
          await tourApi.getAreaBasedList(lang, {
            areaCode,
            sigunguCode,
            cat1: resolved.cat1,
            cat2: m.cat2,
            cat3: m.cat3,
          })
        );
      } catch {
        // 개별 카테고리 조회 실패는 건너뜀
      }
    }
  } else {
    // keyword 폴백 (힐링, 기타, 혹은 cat3 매칭 실패)
    const keywords = resolved.category.searchKeywords?.[lang] || [];
    if (keywords.length === 0) {
      add(await tourApi.getAreaBasedList(lang, { areaCode, sigunguCode }));
    } else {
      for (const kw of keywords) {
        try {
          add(await tourApi.searchKeyword(lang, { keyword: kw, areaCode }));
        } catch {
          // 개별 키워드 검색 실패는 건너뜀
        }
      }
    }
  }

  return Array.from(seen.values());
}

// 지역 + 카테고리 기반 AI 추천
router.post(
  "/recommend",
  asyncHandler(async (req, res) => {
    const lang = normalizeLang(req.body.lang);
    const { areaCode, sigunguCode, regionName, categoryId } = req.body;

    if (!areaCode) {
      return res.status(400).json({ error: "areaCode is required" });
    }

    const resolved = await resolveCategory(categoryId || "etc");
    if (!resolved) {
      return res.status(400).json({ error: `unknown categoryId: ${categoryId}` });
    }

    const candidates = await gatherCandidates({ resolved, lang, areaCode, sigunguCode });

    const result = await recommendSpots(candidates, {
      lang,
      categoryLabel: resolved.category.label[lang],
      regionName,
      limit: 8,
    });

    const byId = new Map(candidates.map((c) => [c.contentid, c]));
    const spots = result.spots
      .map((s) => {
        const base = byId.get(s.contentid);
        if (!base) return null;
        return {
          contentid: base.contentid,
          contenttypeid: base.contenttypeid,
          title: base.title,
          addr: [base.addr1, base.addr2].filter(Boolean).join(" "),
          image: base.firstimage || base.firstimage2 || null,
          mapx: base.mapx,
          mapy: base.mapy,
          blurb: s.blurb,
        };
      })
      .filter(Boolean);

    res.json({ regionSummary: result.regionSummary, count: spots.length, spots });
  })
);

// 개별 여행지 상세 정보
router.get(
  "/spot/:contentId",
  asyncHandler(async (req, res) => {
    const lang = normalizeLang(req.query.lang);
    const detail = await tourApi.getDetailCommon(lang, req.params.contentId);
    if (!detail) return res.status(404).json({ error: "not found" });
    res.json({
      contentid: detail.contentid,
      title: detail.title,
      addr: [detail.addr1, detail.addr2].filter(Boolean).join(" "),
      overview: detail.overview,
      image: detail.firstimage || null,
      tel: detail.tel || null,
      homepage: detail.homepage || null,
      mapx: detail.mapx,
      mapy: detail.mapy,
    });
  })
);

export default router;
