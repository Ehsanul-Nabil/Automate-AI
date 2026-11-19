import express from "express"

import protect from "../middleware/protect.js"
import { connectGoogle, connectInstagram, disconnectGoogle, disconnectInstagram, getIntegrations, googleCallback, instagramCallback } from "../controllers/integration.controller.js"


const integrationRouter = express.Router()

integrationRouter.get("/google/connect", protect, connectGoogle)
integrationRouter.get("/google/callback", googleCallback)

integrationRouter.get("/instagram/connect", protect, connectInstagram)
integrationRouter.get("/instagram/callback", instagramCallback)

integrationRouter.get("/instagram/disconnect", protect, disconnectInstagram)
integrationRouter.get("/google/disconnect", protect, disconnectGoogle)

integrationRouter.get("/all", protect, getIntegrations)


export default integrationRouter