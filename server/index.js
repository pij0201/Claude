import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import apiRouter from "./routes/api.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/api", apiRouter);

// 에러 핸들러: TourAPI/Claude 호출 실패를 사용자에게 이해하기 쉬운 메시지로 변환
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.code === "NO_TOUR_API_KEY" ? 500 : 500;
  res.status(status).json({ error: err.message || "서버 오류가 발생했습니다." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Local Travel App running at http://localhost:${PORT}`);
  if (!process.env.TOUR_API_KEY) {
    console.warn("⚠️  TOUR_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요 (.env.example 참고).");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ℹ️  ANTHROPIC_API_KEY가 없어 AI 추천 대신 규칙 기반 추천으로 동작합니다.");
  }
});
