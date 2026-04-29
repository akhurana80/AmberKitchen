import express from "express";

const app = express();
app.use(express.json());

app.get("/", (_, res) => {
  res.send("api-gateway running");
});

app.listen(4000, () => {
  console.log("api-gateway started");
});
