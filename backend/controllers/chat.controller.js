import chatGraph from "../utils/chatGraph.js"
import { HumanMessage } from "@langchain/core/messages"

export const chat = async (req, res) => {
    try {
        const { message } = req.body

        if (!message) {
            return res.status(400).json({ message: "message required" })
        }

        const threadId = (req.user._id).toString()
        const data = await chatGraph.invoke(
            {
                messages: [
                    new HumanMessage(message)
                ]
            },
            {
                configurable: { thread_Id:threadId }
            }
        )

        const lastMessage = data.messages[data.messages.length - 1].content

        return res.status(200).json(lastMessage)
    } catch (error) {
        return res.status(500).json({ message: `chat controller error ${error}` })
    }
}