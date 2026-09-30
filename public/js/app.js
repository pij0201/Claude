const I18N = {
  ko: {
    labelSido: "지역 (시/도)",
    labelSigungu: "세부 지역 (선택)",
    optAll: "전체",
    discoverNew: "아직 안 가본 지역 추천받기",
    labelCategory: "관심 카테고리",
    getRecommend: "추천받기",
    loading: "추천을 준비하고 있어요...",
    noResults: "결과가 없어요. 다른 지역이나 카테고리를 시도해보세요.",
    selectRegionFirst: "지역을 먼저 선택해주세요.",
    errorPrefix: "문제가 발생했어요: ",
  },
  en: {
    labelSido: "Region (Province)",
    labelSigungu: "Sub-region (optional)",
    optAll: "All",
    discoverNew: "Suggest a region I haven't visited",
    labelCategory: "Interests",
    getRecommend: "Get Recommendations",
    loading: "Finding great spots for you...",
    noResults: "No results. Try a different region or category.",
    selectRegionFirst: "Please select a region first.",
    errorPrefix: "Something went wrong: ",
  },
};

const state = {
  lang: "ko",
  sidoList: [],
  categories: [],
  selectedSido: null,
  selectedSigungu: "",
  selectedCategory: "etc",
};

const el = {
  langToggle: document.getElementById("langToggle"),
  sidoSelect: document.getElementById("sidoSelect"),
  sigunguSelect: document.getElementById("sigunguSelect"),
  discoverBtn: document.getElementById("discoverBtn"),
  categoryChips: document.getElementById("categoryChips"),
  recommendBtn: document.getElementById("recommendBtn"),
  summarySection: document.getElementById("summarySection"),
  regionSummary: document.getElementById("regionSummary"),
  resultsSection: document.getElementById("resultsSection"),
  stateSection: document.getElementById("stateSection"),
  stateMessage: document.getElementById("stateMessage"),
  detailModal: document.getElementById("detailModal"),
  modalBody: document.getElementById("modalBody"),
  modalClose: document.getElementById("modalClose"),
};

function t(key) {
  return I18N[state.lang][key] || key;
}

function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  el.langToggle.textContent = state.lang === "ko" ? "EN" : "한국어";
}

function getSeenRegions() {
  try {
    return JSON.parse(localStorage.getItem("seenRegions") || "[]");
  } catch {
    return [];
  }
}

function markRegionSeen(code) {
  const seen = new Set(getSeenRegions());
  seen.add(code);
  localStorage.setItem("seenRegions", JSON.stringify([...seen]));
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function loadSidoList() {
  state.sidoList = await fetchJSON(`/api/regions?lang=${state.lang}`);
  el.sidoSelect.innerHTML = state.sidoList
    .map((r) => `<option value="${r.code}">${r.name}</option>`)
    .join("");
  if (!state.selectedSido) state.selectedSido = state.sidoList[0]?.code;
  el.sidoSelect.value = state.selectedSido;
  await loadSigunguList();
}

async function loadSigunguList() {
  const list = await fetchJSON(`/api/regions?lang=${state.lang}&areaCode=${state.selectedSido}`);
  el.sigunguSelect.innerHTML =
    `<option value="" data-i18n="optAll">${t("optAll")}</option>` +
    list.map((r) => `<option value="${r.code}">${r.name}</option>`).join("");
  state.selectedSigungu = "";
}

async function loadCategories() {
  state.categories = await fetchJSON(`/api/categories?lang=${state.lang}`);
  el.categoryChips.innerHTML = state.categories
    .map(
      (c) =>
        `<button type="button" class="chip${c.id === state.selectedCategory ? " selected" : ""}" data-id="${c.id}">${c.icon} ${c.label}</button>`
    )
    .join("");
}

function currentSidoName() {
  return state.sidoList.find((r) => r.code === state.selectedSido)?.name || "";
}

function showState(message) {
  el.stateSection.classList.remove("hidden");
  el.stateMessage.textContent = message;
  el.resultsSection.innerHTML = "";
  el.summarySection.classList.add("hidden");
}

function clearState() {
  el.stateSection.classList.add("hidden");
}

function renderResults(data) {
  clearState();
  el.summarySection.classList.remove("hidden");
  el.regionSummary.textContent = data.regionSummary || "";

  if (!data.spots.length) {
    showState(t("noResults"));
    return;
  }

  el.resultsSection.innerHTML = data.spots
    .map(
      (s) => `
      <article class="card" data-id="${s.contentid}">
        ${
          s.image
            ? `<img class="card-img" src="${s.image}" alt="${s.title}" loading="lazy" />`
            : `<div class="card-img placeholder">🗺️</div>`
        }
        <div class="card-body">
          <div class="card-title">${s.title}</div>
          <div class="card-addr">${s.addr || ""}</div>
          <div class="card-blurb">${s.blurb || ""}</div>
        </div>
      </article>`
    )
    .join("");

  el.resultsSection.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => openDetail(card.dataset.id));
  });
}

async function openDetail(contentId) {
  el.detailModal.classList.remove("hidden");
  el.modalBody.innerHTML = "";
  try {
    const d = await fetchJSON(`/api/spot/${contentId}?lang=${state.lang}`);
    el.modalBody.innerHTML = `
      ${d.image ? `<img class="modal-img" src="${d.image}" alt="${d.title}" />` : ""}
      <h2 class="modal-title">${d.title}</h2>
      <div class="modal-addr">${d.addr || ""}${d.tel ? " · " + d.tel : ""}</div>
      <p class="modal-overview">${d.overview || ""}</p>
      ${d.homepage ? `<div>${d.homepage}</div>` : ""}
    `;
  } catch (err) {
    el.modalBody.innerHTML = `<p>${t("errorPrefix")}${err.message}</p>`;
  }
}

async function handleRecommend() {
  if (!state.selectedSido) {
    showState(t("selectRegionFirst"));
    return;
  }
  el.recommendBtn.disabled = true;
  showState(t("loading"));
  try {
    const data = await fetchJSON("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        areaCode: state.selectedSido,
        sigunguCode: state.selectedSigungu,
        regionName: currentSidoName(),
        categoryId: state.selectedCategory,
        lang: state.lang,
      }),
    });
    markRegionSeen(state.selectedSido);
    renderResults(data);
  } catch (err) {
    showState(t("errorPrefix") + err.message);
  } finally {
    el.recommendBtn.disabled = false;
  }
}

function discoverNewRegion() {
  const seen = new Set(getSeenRegions());
  const unseen = state.sidoList.filter((r) => !seen.has(r.code));
  const pool = unseen.length ? unseen : state.sidoList;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return;
  state.selectedSido = pick.code;
  el.sidoSelect.value = pick.code;
  loadSigunguList();
}

el.langToggle.addEventListener("click", async () => {
  state.lang = state.lang === "ko" ? "en" : "ko";
  applyStaticI18n();
  await Promise.all([loadSidoList(), loadCategories()]);
});

el.sidoSelect.addEventListener("change", () => {
  state.selectedSido = el.sidoSelect.value;
  loadSigunguList();
});

el.sigunguSelect.addEventListener("change", () => {
  state.selectedSigungu = el.sigunguSelect.value;
});

el.discoverBtn.addEventListener("click", discoverNewRegion);

el.categoryChips.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  state.selectedCategory = btn.dataset.id;
  el.categoryChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("selected", c === btn));
});

el.recommendBtn.addEventListener("click", handleRecommend);
el.modalClose.addEventListener("click", () => el.detailModal.classList.add("hidden"));
el.detailModal.addEventListener("click", (e) => {
  if (e.target === el.detailModal) el.detailModal.classList.add("hidden");
});

(async function init() {
  applyStaticI18n();
  await Promise.all([loadSidoList(), loadCategories()]);
})();
