import express from "express";

const app = express();
app.use(express.json());

app.get("/", (_, res) => {
  res.send("payment-service running");
});

app.listen(4000, () => {
  console.log("payment-service started");
});
