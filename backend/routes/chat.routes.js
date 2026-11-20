import express from "express";

import protect from "../middleware/protect.js";
import { agentChat, approveTool, chat } from "../controllers/chat.controller.js";

const chatRouter = express.Router();

chatRouter.post("/", protect, chat);
chatRouter.post("/agent", protect, agentChat);
chatRouter.post("/agent/resume", protect, approveTool);

export default chatRouter;