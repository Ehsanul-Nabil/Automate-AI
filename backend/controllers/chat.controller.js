import chatGraph from "../utils/chatGraph.js";
import Agent from "../models/agent.model.js";
import { createAgentGraph, resumeAgentGraph } from "../utils/agentGraph.js";
import { HumanMessage } from "@langchain/core/messages";
import { deductCredits } from "../utils/deductCredits.js";
import mongoose from "mongoose";


export const chat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "message required" });
    }

    const threadId = req.user._id.toString();
    const data = await chatGraph.invoke(
      {
        messages: [new HumanMessage(message)],
      },
      {
        configurable: { thread_id: threadId },
      }
    );

    await deductCredits({ userId: req.user._id, credits: 2 });

    const lastMessage = data.messages[data.messages.length - 1].content;

    return res.status(200).json({ aiResponse: lastMessage });
  } catch (error) {
    return res.status(500).json({ message: `chat controller error ${error}` });
  }
};



export const agentChat = async (req, res) => {
  try {
    const { message, agent } = req.body;
    if (!message) {
      return res.status(400).json({ message: "message required" });
    }

    if (!agent || !mongoose.Types.ObjectId.isValid(agent)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const existingAgent = await Agent.findById(agent);
    console.log("existingAgent ", existingAgent);
    if (!existingAgent) {
      return res.status(400).json({ message: "Agent not found" });
    }

    const threadId = `${req.user._id.toString()}:${existingAgent._id}`;
    const graph = await createAgentGraph(existingAgent, req.user._id);
    const result = await graph.invoke(
      {
        messages: [new HumanMessage(message)],
      },
      {
        configurable: { thread_id: threadId },
        recursionLimit: 5,
      }
    );

    await deductCredits({ userId: req.user._id, credits: 10 });

    console.log(result);
    const lastMessage = result.messages[result.messages.length - 1].content;

    return res.status(200).json({
      aiResponse: lastMessage,
      interrupted: Boolean(result.__interrupt__?.length),
      interrupts: (result.__interrupt__ || []).map((item) => ({
        id: item.id,
        value: item.value,
      })),
    });
  } catch (error) {
    console.error("agent chat controller error", error);
    return res
      .status(500)
      .json({ message: `agent chat controller error ${error}` });
  }
};


export const approveTool = async (req, res) => {
  try {
    const { agent, approved } = req.body;
    const userId = req.user._id;
    const existingAgent = await Agent.findOne({ name: agent });
    if (!existingAgent) {
      return res.status(400).json({ message: "Agent not found" });
    }
    const threadId = `${req.user._id.toString()}:${existingAgent?._id}`;
    const result = await resumeAgentGraph({
      agent: existingAgent,
      threadId,
      userId,
      approved,
    });

    await deductCredits({ userId: req.user._id, credits: 10 });

    return res.status(200).json(result);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `approve tool controller error ${error}` });
  }
};