import Queue from "bull";

export const orderQueue = new Queue("orders", process.env.REDIS_URL!);
