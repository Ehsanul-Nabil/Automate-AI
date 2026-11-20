import { ChatGroq } from "@langchain/groq";
import { MessagesAnnotation, StateGraph, interrupt,Command } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { getMcpTools } from "../mcp/langgraph-mcp.js";
import { SystemMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import jwt from "jsonwebtoken";

dotenv.config();

const llm = new ChatGroq({
  model: "openai/gpt-oss-120b",
  temperature: 0,
  maxTokens: undefined,
  maxRetries: 2,
  // other params...
});

const client = new MongoClient(process.env.MONGO_URI);
const checkpointer = new MongoDBSaver({ client, dbName: "langgraph" });

const findTool = (tools, names) => {
  return tools.find((tool) => names?.includes(tool.name));
};


const makeAuthToken = (userId) => {
  return jwt.sign({}, process.env.MCP_AUTH_SECRET, {
    algorithm: "HS256",
    subject: String(userId),
    expiresIn: "2m",
    issuer: "automate-backend",
    audience: "automate-mcp",
  });
};

const generateCaption = async (imageUrl) => {
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    const contentType =
      imageResponse.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64image = Buffer.from(arrayBuffer).toString("base64");

    const imageAnalyzer = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0,
      maxRetries: 2,
    });

    const message = new HumanMessage({
      content: [
        {
          type: "text",
          text: `Analyze this image and generate a catchy social media caption with relevant hashtags. STRICT RULE: Do not include any greetings, introductory text, explanations, or conversational filler (like 'Sure, here is...', 'Here is a caption'). Output ONLY the caption and hashtags.`,
        },
        {
          type: "image_url",
          image_url: `data:${contentType};base64,${base64image}`,
        },
      ],
    });

    const response = await imageAnalyzer.invoke([message]);
    return response.content.trim();
  } catch (error) {
    console.log(error);
    return error;
  }
};

const limitMessageContext = (message, maxChars = 2000) => {
  if (typeof message.content !== "string") {
    return message;
  }
  if (message.content.length <= maxChars) {
    return message;
  }

  return {
    ...message,
    content: message.content.slice(0, maxChars) + "\n[content truncated]",
  };
};

export const createAgentGraph = async (agent, userId) => {
  const mcpTools = await getMcpTools();
//   console.log(mcpTools.map((tool) => tool.name));
console.log("mcpTools", mcpTools);

  const enabledTools = new Set(agent.tools || []);
  const isToolEnabled = (tool) => enabledTools.has(tool);

  const webSearchMCPTool = findTool(mcpTools, ["web_search", "automate_web_search"]);
  const sendEmailMCPTool = findTool(mcpTools, ["send_email", "automate_send_email"]);
  const createEventMCPTool = findTool(mcpTools, ["create_calender_event", "automate_create_calender_event" ]);
  const listEmailsMCPTool = findTool(mcpTools, ["list_emails", "automate_list_emails"]);
  const listCalenderEventsMCPTool = findTool(mcpTools, ["list_calender_events", "automate_list_calender_events"]);
  const publishOnInstagramMCPTool = findTool(mcpTools, ["publish_instagram_post", "automate_publish_instagram_post"]);
  const analyzeImageMCPTool = findTool(mcpTools, ["analyze_image", "automate_analyze_image"]);
  const finalTools = [];
  if (webSearchMCPTool && isToolEnabled("web_search")) {
    finalTools.push(
      new DynamicStructuredTool({
        name: "web_search",
        description: `Search the web for current information, news, tutorials, documentation, and factual questions.`,
        schema: z.object({
          query: z.string().describe("The search query"),
        }),
        func: async ({ query }) => {
          try {
            const result = await webSearchMCPTool.invoke({ query });
            console.log(result);
            return result;
          } catch (error) {
            console.error("❌ MCP search error:", error);
            return "web search failed";
          }
        },
      })
    );
  }

  if (sendEmailMCPTool && isToolEnabled("send_email")) {
  finalTools.push(
    new DynamicStructuredTool({
      name: "send_email",
      description: `Send an email using the authenticated user's connected Gmail account.

                  Infer a suitable email subject and body from the user's request.

                  If the user says "send an email and say hello":
                  - Subject: Hello
                  - Body: hello

                  Ask for the recipient email only if it is missing and cannot be inferred from the conversation.

                  Never ask for authentication tokens, API keys, passwords, or user IDs.

                  The application will request explicit approval before sending the email.`,
      schema: z.object({
        to: z.string().email().describe("recipient email address"),
        subject: z.string().trim().min(1).max(200).describe("email subject"),
        body: z.string().trim().min(1).max(2000).describe("email body"),
      }),
      func: async ({ to, subject, body }) => {
        try {
          const authToken = makeAuthToken(userId);
          const result = await sendEmailMCPTool.invoke({
            authToken,
            to,
            subject,
            body,
          });
          console.log(result);
          return result;
        } catch (error) {
          console.error("❌ MCP send_email error:", error);
          return "send email failed";
        }
      },
    })
  );
}

  if (createEventMCPTool && isToolEnabled("create_calender_event")) {
    finalTools.push(
      new DynamicStructuredTool({
        name: "create_calender_event",
        description: `Create an event in the authenticated user's primary Google Calendar.

  Infer the title and description from the user's request.

  Date and time rules:
  - Interpret today, tomorrow, and weekday references using the current date and time supplied in the conversation.
  - Default timezone: Asia/Kolkata.
  - If duration is missing, use 30 minutes.
  - Use ISO 8601 date-time strings with explicit timezone offsets.
  - If an essential meeting time is missing and cannot be inferred, ask the user instead of inventing a time.

  The application requires explicit approval before creating an event.`,
        schema: z.object({
          summary: z.string().trim().min(1).max(200).describe("event title"),
          description: z
            .string()
            .trim()
            .max(5000)
            .optional()
            .describe("event description"),
          startDateTime: z
            .string()
            .datetime({ offset: true })
            .describe("Event start in ISO 8601 with timezone offset"),
          endDateTime: z
            .string()
            .datetime({ offset: true })
            .describe("Event end in ISO 8601 with timezone offset"),
          timeZone: z
            .string()
            .trim()
            .min(1)
            .default("Asia/Kolkata")
            .describe("timezone"),
        }),
        func: async ({
          summary,
          description,
          startDateTime,
          endDateTime,
          timeZone,
        }) => {
          try {
            const authToken = makeAuthToken(userId);
            const result = await createEventMCPTool.invoke({
              authToken,
              summary,
              description,
              startDateTime,
              endDateTime,
              timeZone,
            });
            console.log(result);
            return result;
          } catch (error) {
            console.error("❌ MCP create_calender_event error:", error);
            return "create calendar event failed";
          }
        },
      })
    );
  }


  if (listEmailsMCPTool && isToolEnabled("list_emails")) {
  finalTools.push(
    new DynamicStructuredTool({
      name: "list_emails",
      description: `Search or list emails from the authenticated user's connected Gmail.

      Examples:
      - Show my latest emails.
      - Show unread emails.
      - Find emails from a specific sender.
      - Find emails about an invoice.

      Use Gmail search syntax:
      - in:inbox
      - is:unread
      - from:someone@example.com
      - subject:invoice
      - newer_than:7d

      Rules:
      - For latest inbox emails, use "in:inbox".
      - For unread emails, use "is:unread".
      - Use maxResults 10 by default.
      - This is read-only and does not require approval.
      - Never invent email results.`,
      schema: z.object({
        query: z.string().trim().max(500).default("in:inbox"),
        maxResults: z.number().int().min(1).max(25).default(10),
      }),
      func: async ({ query, maxResults }) => {
        try {
          const authToken = makeAuthToken(userId);
          const result = await listEmailsMCPTool.invoke({
            authToken,
            query,
            maxResults,
          });
          console.log(result);
          return result;
        } catch (error) {
          console.error("❌ MCP list_emails error:", error);
          return "list emails failed";
        }
      },
    })
  );
}

if (listCalenderEventsMCPTool && isToolEnabled("list_calender_events")) {
  finalTools.push(
    new DynamicStructuredTool({
      name: "list_calender_events",
      description: `Retrieve events from the authenticated user's primary Google Calendar.

Use current time to resolve requests such as today or tomorrow.
Provide timeMin and timeMax as ISO date-time strings with timezone offsets.
For today's meetings, use the beginning and end of today in the user's timezone.
For tomorrow's meetings, use the beginning and end of tomorrow.
Return a maximum of 10 events by default.
This tool only reads events; it does not modify them.`,
      schema: z.object({
        timeMin: z.string().datetime({ offset: true }),
        timeMax: z.string().datetime({ offset: true }),
        maxResults: z.number().int().min(1).max(50).default(10),
      }),
      func: async ({ timeMin, timeMax, maxResults }) => {
        try {
          const authToken = makeAuthToken(userId);
          const result = await listCalenderEventsMCPTool.invoke({
            authToken,
            timeMin,
            timeMax,
            maxResults,
          });
          console.log(result);
          return result;
        } catch (error) {
          console.error("❌ MCP search error:", error);
          return "list calendar events failed";
        }
      },
    })
  );
}

if (publishOnInstagramMCPTool && isToolEnabled("publish_instagram_post")) {
  finalTools.push(
    new DynamicStructuredTool({
      name: "publish_instagram_post",
      description: `Publish an image to the authenticated user's connected Instagram account.

      Use this tool ONLY when the user explicitly requests an Instagram post or asks to publish an image to Instagram.

      Examples:
      - Post this image on Instagram.
      - Upload this image to my Instagram.
      - Publish this image with a caption.

      Do NOT use this tool when:
      - The user only uploads an image.
      - The user asks what an image contains.
      - The user asks to explain or analyze an image.
      - The user asks to describe an image.

      For image understanding, use analyze_image instead.

      Requirements:
      - imageUrl must be a public HTTPS URL.
      - Generate a caption if one is not provided.
      - The application requires explicit user approval before publishing.
      - Never claim success unless publishing is confirmed.`,
      schema: z.object({
        imageUrl: z
          .string()
          .url()
          .refine((url) => url.startsWith("https://"))
          .describe("Public HTTPS image URL from Cloudinary"),
        caption: z
          .string()
          .trim()
          .max(2200)
          .optional()
          .describe("Optional Instagram caption"),
      }),
      func: async ({ imageUrl, caption }) => {
        try {
          console.log("imageUrl", imageUrl)
          const authToken = makeAuthToken(userId);
          let finalCaption = "";
          if (!caption) {
            finalCaption = await generateCaption(imageUrl);
          } else {
            finalCaption = caption;
          }

          const result = await publishOnInstagramMCPTool.invoke({
            authToken,
            imageUrl,
            caption: finalCaption,
          });
          console.log(result);
          return result;
        } catch (error) {
          console.error("❌ MCP search error:", error);
          return "publish instagram post failed";
        }
      },
    })
  );
}

if (analyzeImageMCPTool && isToolEnabled("analyze_image")) {
  finalTools.push(
    new DynamicStructuredTool({
      name: "analyze_image",
      description: `
          Analyze an image using this tool.

          Use this tool when the user asks to explain, describe, inspect, or understand an image.

          Pass the publicly accessible image URL and the user's question.
          Return the actual analysis from the image, not guesses based on its URL.
          `,
      schema: z.object({
        imageUrl: z
          .string()
          .url()
          .refine((url) => url.startsWith("https://")),
        prompt: z
          .string()
          .trim()
          .max(2200)
          .default("Describe this image clearly and accurately."),
      }),
      func: async ({ imageUrl, prompt }) => {
        try {
          const result = await analyzeImageMCPTool.invoke({
            imageUrl,
            prompt,
          });
          console.log(result);
          return result;
        } catch (error) {
          console.error("❌ MCP analyze image error:", error);
          return JSON.stringify({
            success: false,
            error: error.message || "Failed to analyze image",
          });
        }
      },
    })
  );
}

  const llmWithTools = llm.bindTools(finalTools);

  const currentDateTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date());

const systemPrompt = `
${agent.instructions || "You are AutoMate AI, a helpful personal assistant."}

CURRENT DATE AND TIME:
- Current date and time in Asia/Kolkata: ${currentDateTime}
- Resolve today, tomorrow, and weekday references using this timestamp.
- Do not ask the user to confirm a date that can be resolved.

DEFAULT SETTINGS:
- Timezone: Asia/Kolkata.
- Default calendar event duration: 30 minutes.
- Infer meaningful event titles.
- Ask only for essential missing information.
- Never fabricate tool results.

IMPORTANT ACTION RULE:
- When the user directly requests an action, call the relevant tool.
- The application handles approval through an approval card.
- Do not ask for approval in your chat response.
- Never claim an action succeeded unless the tool confirms success.

EMAIL SENDING RULES:
1. Call send_email when the required details are available.
2. Ask for the recipient only when it is missing and cannot be inferred.
3. Never ask for passwords, tokens, API keys, or user IDs.
4. The application requests approval before sending.
5. Never claim an email was sent without tool confirmation.

CALENDAR RULES:
1. Call create_calendar_event when sufficient details are available.
2. Do not ask "Would you like me to create it?"
3. Resolve relative dates using the current date above.
4. Default duration is 30 minutes.
5. Use ISO 8601 date-time strings with an explicit timezone offset.
6. Set timeZone to "Asia/Kolkata".
7. Ask a follow-up only when an essential detail is missing.
8. Use list_calendar_events to retrieve existing events.
9. Never claim an event was created without tool confirmation.

GMAIL EMAIL READING RULES:
1. Use list_emails when the user asks to see or search emails.
2. Use "in:inbox" for the latest inbox emails.
3. Use "is:unread" for unread emails.
4. Use Gmail search syntax for sender and subject searches.
5. Use read_email to retrieve a specific email's content.
6. If its message ID is unknown, call list_emails first.
7. Summarize actual retrieved email content.
8. Never invent email content.
9. Reading and searching emails are read-only.
10. Use list_emails and read_email, not their raw MCP tool names.

INSTAGRAM PUBLISHING RULES:
1. Call publish_instagram_image ONLY when the latest user message explicitly requests publishing, posting, sharing, or uploading an image to Instagram.
2. Uploading an image to chat is NOT permission to publish it.
3. Asking for image analysis, a description, or an Instagram caption is NOT permission to publish.
4. Never trigger publishing from an image upload alone.
5. Never infer publishing intent from an image URL, filename, image description, or unrelated previous conversation.
6. If the user only uploads an image, analyze it and describe it.
7. If the user asks for a caption, generate the caption without publishing.
8. If publishing intent is explicit but the image URL is missing, ask the user to upload the image first.
9. The application must obtain explicit approval before publishing.
10. Never claim a post was published without tool confirmation.

IMAGE ANALYSIS RULES:
1. If the user uploads an image or asks a question about an image, use analyze_image when the image URL is available.
2. If the user uploads an image without a question, analyze it and provide a useful description.
3. Answer image-related questions using the actual analysis.
4. Never call publish_instagram_image for image analysis or description.
5. Never suggest publishing solely because an image was uploaded.
6. Keep image analysis and Instagram publishing as separate actions.
7. If image analysis fails, explain the failure honestly.
8. Never claim to have viewed an image if analysis failed.

GENERAL RULES:
- Be concise and helpful.
- Infer parameters when sufficient context is available.
- Never substitute a natural-language promise for a tool call.
- Ask questions only when essential information is missing.

AVAILABLE TOOLS RULES:
- You can ONLY use tools provided to you through bindTools().
- Never attempt to use tools that are not available.
- If a user requests an action that requires an unavailable tool, politely explain that this agent does not have that capability.
- Never pretend to execute an unavailable tool.
`;

    const approvalTools = new Set([
    "send_email",
    "create_calendar_event",
    "publish_instagram_post",
    ]);

    // const chatNode = async (state) => {
    // const recentMessages = state.messages.slice(-4);
    // const response = await llmWithTools.invoke([
    //     new SystemMessage(systemPrompt),
    //     ...recentMessages,
    // ]);
    // return {
    //     messages: [response],
    // };
    // };

    const chatNode = async (state) => {
    const recentMessages = state.messages
      .slice(-4)
      .map((message) => limitMessageContext(message));

    const response = await llmWithTools.invoke([
      new SystemMessage(systemPrompt),
      ...recentMessages,
    ]);
    return {
      messages: [response],
    };
  };


  const toolNode = new ToolNode(finalTools);


  const actionApprovalNode = (state) => {
  const messages = state.messages || [];
  const lastMessage = messages[messages.length - 1];

  const tool_calls = lastMessage.tool_calls || [];

  if (tool_calls.length !== 1 || !approvalTools.has(tool_calls[0].name)) {
    return {
      messages: tool_calls.map(
        (call) =>
          new ToolMessage({
            tool_call_id: call.id,
            content: JSON.stringify({
              success: false,
              message: "Please request one approval-protected action at a time.",
            }),
          })
      ),
    };
  }

  const actionCall = tool_calls[0];
  const args = actionCall.args || {};

  if (actionCall.name === "send_email") {
    const { to, subject, body } = args;
    if (
      typeof to !== "string" ||
      typeof subject !== "string" ||
      typeof body !== "string" ||
      !to.trim() ||
      !subject.trim() ||
      !body.trim()
    ) {
      return {
        messages: [
          new ToolMessage({
            tool_call_id: actionCall.id,
            content: JSON.stringify({
              success: false,
              message: "The email draft is incomplete.",
            }),
          }),
        ],
      };
    }

    const decision = interrupt({
      type: "email_approval",
      tool_call_id: actionCall.id,
      email: { to, subject, body },
      message: "Review the email and approve or reject sending it.",
    });

    if (decision?.approved !== true) {
      return {
        messages: [
          new ToolMessage({
            tool_call_id: actionCall.id,
            content: JSON.stringify({
              success: false,
              rejected: true,
              message: "Email rejected. No email was sent.",
            }),
          }),
        ],
      };
    }

    return {};
  }

  if (actionCall.name === "create_calender_event") {
    const { summary, description, startDateTime, endDateTime, timeZone } = args;

    if (
      typeof summary !== "string" ||
      !summary.trim() ||
      !startDateTime ||
      !endDateTime
    ) {
      return {
        messages: [
          new ToolMessage({
            tool_call_id: actionCall.id,
            content: JSON.stringify({
              success: false,
              message:
                "Calendar event details are invalid. Please clarify the date or time.",
            }),
          }),
        ],
      };
    }

    const decision = interrupt({
      type: "calender_event_approval",
      tool_call_id: actionCall.id,
      event: {
        summary,
        description: description || "",
        startDateTime,
        endDateTime,
        timeZone,
      },
      message: "Review the calendar event and approve or reject its creation.",
    });

    if (decision?.approved !== true) {
      return {
        messages: [
          new ToolMessage({
            tool_call_id: actionCall.id,
            content: JSON.stringify({
              success: false,
              rejected: true,
              message: "Calendar event rejected. No event was created.",
            }),
          }),
        ],
      };
    }

    return {};
  }

  if (actionCall.name === "publish_instagram_post") {
      const { imageUrl, caption } = args;

      if (
        typeof imageUrl !== "string" ||
        !imageUrl ||
        (caption !== undefined && typeof caption !== "string")
      ) {
        return {
          messages: [
            new ToolMessage({
              tool_call_id: actionCall.id,
              content: JSON.stringify({
                success: false,
                message:
                  "Invalid Instagram post details. Please provide a public HTTPS image URL.",
              }),
            }),
          ],
        };
      }

      const decision = interrupt({
        type: "instagram_post_approval",
        tool_call_id: actionCall.id,
        imageUrl,
        caption: caption || "",
        message: "Review the Instagram image and caption, then approve or reject publishing.",
      });

      if (decision?.approved !== true) {
        return {
          messages: [
            new ToolMessage({
              tool_call_id: actionCall.id,
              content: JSON.stringify({
                success: false,
                rejected: true,
                message: "Instagram post rejected. Nothing was published.",
              }),
            }),
          ],
        };
      }

      return {};
    }
  

};

  const routeAfterChat = (state) => {
  const messages = state.messages || [];
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage?.tool_calls?.length) {
    return "__end__";
  }
  const requiresApproval = lastMessage?.tool_calls?.some((call) =>
    approvalTools.has(call.name)
  );
  return requiresApproval ? "actionApprovalNode" : "tools";
  };

  const routeAfterApproval = (state) => {
    const messages = state.messages || [];
    const lastMessage = messages[messages.length - 1];
    if (lastMessage instanceof ToolMessage) {
      return "chatNode";
    }

    return "tools";
  };

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("chatNode", chatNode)
    .addNode("tools", toolNode)
    .addNode("actionApprovalNode", actionApprovalNode)
    .addEdge("__start__", "chatNode")
    .addConditionalEdges("chatNode", routeAfterChat)
    .addEdge("tools", "chatNode")
    .addConditionalEdges("actionApprovalNode", routeAfterApproval)
    // .addEdge("chatNode", "__end__");

  return workflow.compile({ checkpointer });
};


export const resumeAgentGraph = async ({ agent, threadId, userId, approved }) => {
  if (!threadId) {
    throw new Error("threadId is required.");
  }

  if (!userId) {
    throw new Error("Authenticated userId is required.");
  }

  if (typeof approved !== "boolean") {
    throw new Error("approved must be true or false.");
  }

  const graph = await createAgentGraph(agent, userId);

  const result = await graph.invoke(
    new Command({
      resume: { approved },
    }),
    {
      configurable: { thread_id: threadId },
      recursionLimit: 15,
    }
  );

  const lastMessage = result.messages[result.messages.length - 1].content;
  return {
    aiResponse: lastMessage,
    interrupted: Boolean(result.__interrupt__?.length),
    interrupts: (result.__interrupt__ || []).map((item) => ({
      id: item.id,
      value: item.value,
    })),
  };
};
