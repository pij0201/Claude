import express from "express";
import apiRouter from "../server/routes/api.js";

const app = express();

app.use(express.json());
app.use("/api", apiRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "서버 오류가 발생했습니다." });
});

export default app;
