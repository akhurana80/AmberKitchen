import express from "express";

const app = express();
app.use(express.json());

app.get("/", (_, res) => {
  res.send("wallet-service running");
});

app.listen(4000, () => {
  console.log("wallet-service started");
});
