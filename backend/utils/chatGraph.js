import dotenv from 'dotenv'
import { ChatGroq } from "@langchain/groq"
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph"
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb"
import { MongoClient } from "mongodb"
dotenv.config()


const llm = new ChatGroq({
    model: "openai/gpt-oss-120b",
    temperature: 0,
    maxTokens: undefined,
    maxRetries: 2,
    // other params...
})

const client = new MongoClient(process.env.MONGO_URI);
const checkpointer = new MongoDBSaver({ client, dbName: "langgraph" });

const chatNode = async (state) => {
    // state is the current state of your LangGraph workflow.
//     state = {
//     messages: [
//         HumanMessage("Hello"),
//         AIMessage("Hello!"),
//         HumanMessage("My name is EAN")
//     ]
// }
    const recentMessages = state.messages.slice(-4);
    const response = await llm.invoke(recentMessages)

    return {
        messages: [response]
    }
}

const workflow = new StateGraph(MessagesAnnotation)
    .addNode("chatNode", chatNode)
    .addEdge("__start__", "chatNode")
    .addEdge("chatNode", "__end__")

const chatGraph = workflow.compile({ checkpointer })

export default chatGraph