import express from "express";

const app = express();
app.use(express.json());

app.get("/", (_, res) => {
  res.send("dispatch-service running");
});

app.listen(4000, () => {
  console.log("dispatch-service started");
});
