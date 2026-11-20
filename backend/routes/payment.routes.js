import express from "express";
import protect from "../middleware/protect.js";
import { createOrder, verify } from "../controllers/payment.controller.js";

const paymentRouter = express.Router();

paymentRouter.post("/create", protect, createOrder);
paymentRouter.post("/verify", protect, verify);

export default paymentRouter;