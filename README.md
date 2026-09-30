# Local Trip — 공공데이터 + AI 지역 여행 추천 앱

공공데이터포털의 TourAPI(한국관광공사)와 Claude AI를 이용해, 안 가본 지역을
등산·낚시·자전거·먹방·힐링 같은 관심 카테고리로 추천해주는 심플한 웹 앱입니다.
한국어/영어를 지원해 외국인 관광객도 사용할 수 있습니다.

## 1. 준비물

- Node.js 18 이상
- 공공데이터포털(data.go.kr) "한국관광공사_국문관광정보서비스(TourAPI)" 활용신청 후 발급받은 인증키
  - 마이페이지 > 데이터활용 > Open API 인증키 발급현황 > **일반 인증키(Decoding)** 값을 사용하세요.
- (선택) Anthropic API 키 — 없어도 앱은 동작하며, 이 경우 AI 추천 문구 대신
  간단한 규칙 기반 문구가 표시됩니다.

## 2. 설치 및 실행

```bash
npm install
cp .env.example .env
```

`.env` 파일을 열어 아래 값을 채워주세요.

```
TOUR_API_KEY=발급받은_공공데이터포털_인증키(Decoding)
ANTHROPIC_API_KEY=발급받은_Anthropic_API_키(선택)
```

서버 실행:

```bash
npm start
```

브라우저에서 `http://localhost:3000` 접속.

## 3. 폴더 구조

```
server/
  index.js            Express 서버 진입점
  routes/api.js        /api/regions, /api/categories, /api/recommend, /api/spot/:id
  services/tourApi.js  공공데이터포털 TourAPI 4.0 클라이언트 (KorService2/EngService2)
  services/categoryMap.js  등산/낚시/자전거/먹방/힐링 카테고리 <-> TourAPI 코드 매핑
  services/claude.js   Claude API로 추천 순위/문구 생성 (키 없으면 규칙 기반 폴백)
public/
  index.html, css/style.css, js/app.js   프론트엔드 (프레임워크 없는 바닐라 JS)
```

## 4. 동작 방식

1. 사용자가 지역(시/도, 필요하면 시/군/구)과 관심 카테고리를 선택합니다.
2. 서버가 TourAPI에서 해당 지역·카테고리의 후보 여행지를 가져옵니다.
   - 등산/낚시/자전거는 TourAPI의 레포츠(A03) 분류 코드를 실시간 조회해 매칭하고,
     매칭되는 세부 코드가 없으면 키워드 검색으로 대체합니다.
   - 먹방은 음식점(contentTypeId=39)으로 바로 조회합니다.
   - 힐링/기타는 키워드 검색("힐링", "치유의숲" 등)으로 후보를 모읍니다.
3. 후보 목록을 Claude에게 전달해 카테고리에 가장 잘 맞는 장소를 고르고,
   짧은 추천 문구와 지역 소개 문장을 생성합니다(API 키가 없으면 규칙 기반으로 대체).
4. "아직 안 가본 지역 추천받기" 버튼은 브라우저 localStorage에 저장된
   "이미 검색한 지역" 목록을 제외하고 무작위로 새 지역을 골라줍니다.

## 5. 참고 / 한계

- TourAPI의 세부 카테고리(cat3) 코드는 서버가 실행 중 실시간으로 조회해 캐싱하므로,
  공공데이터포털 쪽 분류 체계가 바뀌어도 코드를 하드코딩하지 않아 계속 동작합니다.
- 서비스키는 서버(.env)에만 저장되며 브라우저로 전달되지 않습니다.
- 실제 배포 시에는 `ANTHROPIC_API_KEY`, `TOUR_API_KEY`가 노출되지 않도록
  서버 환경변수로만 관리하세요.
