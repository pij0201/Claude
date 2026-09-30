// 공공데이터포털 - 한국관광공사 TourAPI 4.0 클라이언트
// 국문: KorService2, 영문: EngService2 (엔드포인트 이름은 동일, 응답 언어만 다름)

const BASE_URL = {
  ko: "https://apis.data.go.kr/B551011/KorService2",
  en: "https://apis.data.go.kr/B551011/EngService2",
};

const APP_NAME = "LocalTravelApp";

// 관광지(12), 문화시설(14), 축제공연행사(15), 레포츠(28), 숙박(32), 쇼핑(38), 음식점(39)
export const CONTENT_TYPE = {
  ATTRACTION: "12",
  CULTURE: "14",
  FESTIVAL: "15",
  LEPORTS: "28",
  LODGING: "32",
  SHOPPING: "38",
  FOOD: "39",
};

function getKey() {
  const key = process.env.TOUR_API_KEY;
  if (!key || key.includes("여기에")) {
    const err = new Error(
      "TOUR_API_KEY가 설정되지 않았습니다. .env 파일에 공공데이터포털 인증키(Decoding)를 넣어주세요."
    );
    err.code = "NO_TOUR_API_KEY";
    throw err;
  }
  return key;
}

async function callApi(lang, endpoint, params = {}) {
  try {
    return await callApiOnce(lang, endpoint, params);
  } catch (err) {
    // 영문 서비스(EngService2)는 국문과 별도의 활용신청이 필요함.
    // 아직 승인 전이라 키가 거부되면, 화면이 깨지지 않도록 국문 데이터로 대체한다.
    if (lang === "en" && err.code === "TOUR_API_NOT_REGISTERED") {
      console.warn(
        "[tourApi] EngService2 접근 불가(활용신청 필요) - KorService2로 대체합니다:",
        err.message
      );
      return callApiOnce("ko", endpoint, params);
    }
    throw err;
  }
}

async function callApiOnce(lang, endpoint, params = {}) {
  const base = BASE_URL[lang] || BASE_URL.ko;
  const url = new URL(`${base}/${endpoint}`);
  const search = url.searchParams;

  search.set("serviceKey", getKey());
  search.set("MobileOS", "ETC");
  search.set("MobileApp", APP_NAME);
  search.set("_type", "json");

  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    search.set(k, String(v));
  }

  const res = await fetch(url);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // 인증키 오류 등은 _type=json을 무시하고 XML로 내려오는 경우가 있음
    const msg = text.includes("SERVICE_KEY")
      ? "공공데이터포털 인증키가 유효하지 않습니다. .env의 TOUR_API_KEY를 확인해주세요."
      : `TourAPI 응답을 해석할 수 없습니다: ${text.slice(0, 200)}`;
    const err = new Error(msg);
    err.code = "TOUR_API_BAD_RESPONSE";
    throw err;
  }

  // 오류 응답 형태가 3가지라 정규화해서 처리한다:
  // 1) {response:{header:{resultCode,resultMsg}}} - 정상/일반 오류
  // 2) {resultCode,resultMsg} - 파라미터 오류 (게이트웨이 레벨)
  // 3) {OpenAPI_ServiceResponse:{cmmMsgHeader:{errMsg,returnReasonCode}}} - 인증키/등록 오류
  const cmmHeader = data?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (cmmHeader) {
    const err = new Error(`TourAPI 인증 오류 (${cmmHeader.returnReasonCode}): ${cmmHeader.errMsg}`);
    err.code = cmmHeader.returnReasonCode === "30" ? "TOUR_API_NOT_REGISTERED" : "TOUR_API_ERROR";
    throw err;
  }

  const header = data?.response?.header || data;
  if (!header || header.resultCode !== "0000") {
    const err = new Error(
      `TourAPI 오류 (${header?.resultCode}): ${header?.resultMsg || "알 수 없는 오류"}`
    );
    err.code = "TOUR_API_ERROR";
    throw err;
  }

  const items = data.response.body?.items;
  if (!items || items === "") return [];
  const item = items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// 시도 목록 (areaCode 없이 호출) 또는 시군구 목록 (areaCode 지정)
export function getAreaCodes(lang, areaCode) {
  return callApi(lang, "areaCode2", { areaCode, numOfRows: 100 });
}

// 카테고리(cat1/cat2/cat3) 목록
export function getCategoryCodes(lang, { cat1, cat2, cat3 } = {}) {
  return callApi(lang, "categoryCode2", { cat1, cat2, cat3, numOfRows: 100 });
}

// 지역 + 카테고리 기반 목록 조회
export function getAreaBasedList(lang, {
  areaCode,
  sigunguCode,
  contentTypeId,
  cat1,
  cat2,
  cat3,
  numOfRows = 30,
  pageNo = 1,
} = {}) {
  return callApi(lang, "areaBasedList2", {
    areaCode,
    sigunguCode,
    contentTypeId,
    cat1,
    cat2,
    cat3,
    numOfRows,
    pageNo,
    arrange: "O", // 대표이미지 우선 정렬
  });
}

// 키워드 검색
export function searchKeyword(lang, { keyword, areaCode, contentTypeId, numOfRows = 30, pageNo = 1 } = {}) {
  return callApi(lang, "searchKeyword2", {
    keyword,
    areaCode,
    contentTypeId,
    numOfRows,
    pageNo,
    arrange: "O",
  });
}

// 공통 상세정보
export async function getDetailCommon(lang, contentId) {
  const items = await callApi(lang, "detailCommon2", { contentId });
  return items[0] || null;
}
