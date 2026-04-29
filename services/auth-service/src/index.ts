import express from "express";

const app = express();
app.use(express.json());

app.get("/", (_, res) => {
  res.send("auth-service running");
});

app.listen(4000, () => {
  console.log("auth-service started");
});
