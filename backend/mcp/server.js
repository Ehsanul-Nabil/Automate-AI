import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import dotenv from "dotenv";
import path from "node:path";
import axios from "axios"
import { fileURLToPath } from "node:url";
import { HumanMessage } from "@langchain/core/messages";

const _fileName = fileURLToPath(import.meta.url);
const dirName = path.dirname(_fileName);
dotenv.config({
  path: path.resolve(dirName, "../.env"),
});

import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TavilySearch } from "@langchain/tavily";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import connectDb from "../config/db.js";
import Integration from "../models/integration.model.js";
import { decrypt } from "../config/encrypt-decrypt.js";

const server = new McpServer({
  name: "automate-ai-mcp-server",
  version: "1.0.0",
});

const getHeader = (headers = [], name) => {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || "";
};

const verifyAuthToken = (token) => {
  const payload = jwt.verify(token, process.env.MCP_AUTH_SECRET, {
    algorithms: ["HS256"],
    issuer: "automate-backend",
    audience: "automate-mcp",
  });

  return payload.sub;
};

const getGoogleOauthClient = async (userId, requiredService) => {
  await connectDb();
  const integration = await Integration.findOne({
    userId,
    provider: "google",
    services: requiredService,
    status: "connected",
  }).select("+tokens.refreshToken");

  if (!integration || !integration.tokens?.refreshToken) {
    throw new Error(
      `Google ${requiredService} is not connected or its refresh token is unavailable.`
    );
  }

  const refresh_token = decrypt(integration?.tokens?.refreshToken);
  const OAuthClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  OAuthClient.setCredentials({ refresh_token });
  return OAuthClient;
};

if (!process.env.TAVILY_API_KEY) {
  throw new Error("TAVILY_API_KEY missing. Check the backend .env path.");
}

const tavilySearch = new TavilySearch({
  maxResults: 5,
  topic: "general",
  tavilyApiKey: process.env.TAVILY_API_KEY,
});

server.registerTool(
  "web_search",
  {
    description: "Search the web for current information, tutorials, and news.",
    inputSchema: z.object({
      query: z.string(),
    }),
  },
  async ({ query }) => {
    try {
      const result = await tavilySearch.invoke({ query });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (error) {
      console.error(error);
      return {
        content: [
          {
            type: "text",
            text: "web search failed",
          },
        ],
      };
    }
  }
);

server.registerTool(
  "send_email",
  {
    description:
      "Send an email through the authenticated user's connected Gmail account. Only execute after explicit user approval.",
    inputSchema: z.object({
      authToken: z.string().min(1),
      to: z.string().email(),
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(2000),
    }),
  },
  async ({ authToken, to, subject, body }) => {
    try {
      const userId = verifyAuthToken(authToken);
      const oauthClient = await getGoogleOauthClient(userId, "gmail");

      const gmail = google.gmail({
        version: "v1",
        auth: oauthClient,
      });

      const base64Subject = Buffer.from(subject, "utf8").toString("base64");
      const encodedSubject = `=?utf-8?B?${base64Subject}?=`;

      const emailLines = [
        `To: ${to}`,
        `Subject: ${encodedSubject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(body, "utf8").toString("base64"),
      ];

      const rawEmail = emailLines.join("\r\n");
      const encodedMessage = Buffer.from(rawEmail, "utf8")
        .toString("base64url")
        // .replace(/\+/g, "-")
        // .replace(/\//g, "_")
        // .replace(/=+$/, "");

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodedMessage },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "email sent Successfully",
              messageId: response?.data?.id,
              recipient: to,
              subject,
            }),
          },
        ],
      };
    } catch (error) {
      console.error(error);
      return {
        content: [
          {
            type: "text",
            text: "send email failed",
          },
        ],
      };
    }
  }
);

server.registerTool(
  "create_calender_event",
  {
    description:
      "Create an event in the authenticated user's primary Google Calendar. Resolve relative dates using current date. Default timezone: Asia/Kolkata.",
    inputSchema: z.object({
      authToken: z.string().min(1),
      summary: z.string().trim().min(1).max(200),
      description: z.string().trim().max(5000).optional(),
      startDateTime: z.string().datetime({ offset: true }),
      endDateTime: z.string().datetime({ offset: true }),
      timeZone: z.string().trim().min(1).default("Asia/Kolkata"),
    }),
  },
  async ({
    authToken,
    summary,
    description,
    startDateTime,
    endDateTime,
    timeZone,
  }) => {
    try {
      const userId = verifyAuthToken(authToken);
      const oauthClient = await getGoogleOauthClient(userId, "google_calender");
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);

      if (end <= start) {
        return {
          content: [
            {
              type: "text",
              text: "The event end time must be later than its start time.",
            },
          ],
        };
      }

      if (start <= new Date()) {
        return {
          content: [
            {
              type: "text",
              text: "The event start time must be in the future.",
            },
          ],
        };
      }

      const calender = google.calendar({
        version: "v3",
        auth: oauthClient,
      });

      const response = await calender.events.insert({
        calendarId: "primary",
        requestBody: {
          summary,
          ...(description ? { description } : {}),
          start: { dateTime: start.toISOString(), timeZone },
          end: { dateTime: end.toISOString(), timeZone },
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Calendar event created successfully.",
              event: {
                id: response.data.id,
                summary: response.data.summary,
                start: response.data.start,
                end: response.data.end,
                htmlLink: response.data.htmlLink,
              },
            }),
          },
        ],
      };
    } catch (error) {
      console.error(error);
      return {
        content: [
          {
            type: "text",
            text: "create event failed",
          },
        ],
      };
    }
  }
);

server.registerTool(
  "list_emails",
  {
    description:
      "List or search emails from the authenticated user's Gmail account.",
    inputSchema: z.object({
      authToken: z.string().min(1),
      query: z.string().trim().max(500).default("in:inbox"),
      maxResults: z.number().int().min(1).max(25).default(10),
    }),
  },
  async ({ authToken, query, maxResults }) => {
    try {
      const userId = verifyAuthToken(authToken);
      const oauthClient = await getGoogleOauthClient(userId, "gmail");

      const gmail = google.gmail({
        version: "v1",
        auth: oauthClient,
      });

      const listResponse = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
      });

      const messagesRef = listResponse.data.messages || [];

      const emails = await Promise.all(
        messagesRef.map(async (ref) => {
          const response = await gmail.users.messages.get({
            id: ref.id,
            userId: "me",
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"],
          });

          const message = response?.data;
          const headers = message?.payload?.headers || [];
          // const getHeader = (hdrs, name) =>
          //   hdrs.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          //     ?.value || "";

          return {
            id: message.id,
            threadId: message.threadId,
            from: getHeader(headers, "From"),
            to: getHeader(headers, "To"),
            subject: getHeader(headers, "Subject") || "(No subject)",
            date: getHeader(headers, "Date"),
            snippet: message.snippet || "",
            unread: (message.labelIds || []).includes("UNREAD"),
          };
        })
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              query,
              count: emails.length,
              nextPageToken: listResponse.data.nextPageToken || null,
              emails,
            }),
          },
        ],
      };
    } catch (error) {
      console.error(error);
      return {
        content: [
          {
            type: "text",
            text: `list emails failed ${error}`,
          },
        ],
      };
    }
  }
);

server.registerTool(
  "list_calender_events",
  {
    description:
      "Retrieve events from the authenticated user's primary Google Calendar.",
    inputSchema: z.object({
      authToken: z.string().min(1),
      timeMin: z.string().datetime({ offset: true }),
      timeMax: z.string().datetime({ offset: true }),
      maxResults: z.number().int().min(1).max(50).default(10),
    }),
  },
  async ({ authToken, timeMin, timeMax, maxResults }) => {
    try {
      const userId = verifyAuthToken(authToken);
      const oauthClient = await getGoogleOauthClient(userId, "google_calender");
      const start = new Date(timeMin);
      const end = new Date(timeMax);

      if (end <= start) {
        return {
          content: [
            {
              type: "text",
              text: "The event end time must be later than its start time.",
            },
          ],
        };
      }

      const calender = google.calendar({
        version: "v3",
        auth: oauthClient,
      });

      const response = await calender.events.list({
        calendarId: "primary",
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = (response.data.items || []).map((event) => ({
        id: event.id,
        summary: event.summary || "no event title",
        description: event.description,
        start: event.start?.dateTime || event.start?.date || null,
        end: event.end?.dateTime || event.end?.date || null,
        htmlLink: event.htmlLink || null,
        status: event.status,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              count: events.length,
              events,
            }),
          },
        ],
      };
    } catch (error) {
      console.error(error);
      return {
        content: [
          {
            type: "text",
            text: "list events failed",
          },
        ],
      };
    }
  }
);

// server.registerTool(
//   "publish_instagram_post",
//   {
//     description:
//       "Publish an image to the authenticated user's connected Instagram account.",
//     inputSchema: z.object({
//       authToken: z.string().min(1),
//       imageUrl: z
//         .string()
//         .url()
//         .refine((url) => url.startsWith("https://")),
//       caption: z.string().trim().max(2200).optional(),
//     }),
//   },
//   async ({ authToken, imageUrl, caption }) => {
//     try {
//       const userId = verifyAuthToken(authToken);
//       await connectDb();
//       const integration = await Integration.findOne({
//         userId,
//         provider: "instagram",
//         services: "instagram",
//         status: "connected",
//       }).select(
//         "+tokens.accessToken providerAccountId account.username tokens.expiresAt"
//       );

//       if (!integration?.tokens?.accessToken || !integration?.providerAccountId) {
//         throw new Error(
//           "instagram is not connected or its access token is unavailable."
//         );
//       }

//       const access_token = decrypt(integration?.tokens?.accessToken);
//       const graphVersion = process.env.INSTAGRAM_GRAPH_VERSION;
//       const graphUrl = `https://graph.instagram.com/${graphVersion}`;

//       const response = await axios.post(
//         `${graphUrl}/${integration.providerAccountId}/media`,
//         null,
//         {
//           params: { image_url: imageUrl, caption, access_token },
//         }
//       );

//       console.error("insta response", response);
//       const creationId = response.data?.id;

//       let isReady = false;

//       for (let attempt = 0; attempt < 10; attempt++) {
//         const statusResponse = await axios.get(`${graphUrl}/${creationId}`, {
//           params: { fields: "status_code", access_token },
//         });

//         if (statusResponse.data?.status_code === "FINISHED") {
//           isReady = true;
//           break;
//         }

//         await new Promise((r) => setTimeout(r, 3000));
//       }

//       if (!isReady) {
//         return {
//           content: [
//             {
//               type: "text",
//               text: "Instagram media processing timeout.",
//             },
//           ],
//         };
//       }

//       const publishResponse = await axios.post(
//         `${graphUrl}/${integration.providerAccountId}/media_publish`,
//         null,
//         {
//           params: { creation_id: creationId, access_token },
//         }
//       );

//       return {
//         content: [
//           {
//             type: "text",
//             text: JSON.stringify({
//               success: true,
//               mediaId: publishResponse.data?.id,
//               caption,
//             }),
//           },
//         ],
//       };
//     } catch (error) {
//       console.error(error);
//       return {
//         content: [
//           {
//             type: "text",
//             text: `instagram publishing failed ${error}`,
//           },
//         ],
//       };
//     }
//   }
// );

server.registerTool(
  "publish_instagram_post",
  {
    description: `Publish an image to the authenticated user's connected Instagram account.

Use this tool ONLY when the user explicitly requests an Instagram post or asks to publish an image to Instagram.

Supported Image Formats:
- JPEG, PNG, WEBP, and BMP are fully supported by the Meta Graph API.
- Accept URL links ending in '.webp' seamlessly without raising structural format warnings to the user.

Requirements:
- imageUrl must be a public HTTPS URL.
- Generate a caption if one is not provided.
- The application requires explicit user approval before publishing.`,
    inputSchema: z.object({
      authToken: z.string().min(1),
      imageUrl: z
        .string()
        .url()
        .refine((url) => url.startsWith("https://")),
      caption: z.string().trim().max(2200).optional(),
    }),
  },
  async ({ authToken, imageUrl, caption }) => {
    try {
      const userId = verifyAuthToken(authToken);
      await connectDb();
      const integration = await Integration.findOne({
        userId,
        provider: "instagram",
        services: "instagram",
        status: "connected",
      }).select(
        "+tokens.accessToken providerAccountId account.username tokens.expiresAt"
      );

      if (!integration?.tokens?.accessToken || !integration?.providerAccountId) {
        throw new Error(
          `instagram is not connected or its access token is unavailable.`
        );
      }

      const access_token = decrypt(integration?.tokens?.accessToken);
      const graphVersion = process.env.INSTAGRAM_GRAPH_VERSION;
      const graphUrl = `https://graph.facebook.com/${graphVersion}`;

      let finalImageUrl = imageUrl;
      if (
        finalImageUrl.includes("cloudinary.com") &&
        finalImageUrl.endsWith(".webp")
      ) {
        finalImageUrl = finalImageUrl.replace(/\.webp$/, ".jpg");
      }

      const response = await axios.post(
        `${graphUrl}/${integration.providerAccountId}/media`,
        null,
        {
          params: {
            image_url: finalImageUrl,
            caption: caption || "",
            access_token,
          },
          timeout: 15000,
        }
      );

      console.error("insta response", response.data);
      const creationId = response.data?.id;

      if (!creationId) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Failed to create media container ID from Meta.",
            },
          ],
        };
      }

      let isReady = false;

      for (let attempt = 0; attempt < 10; attempt++) {
        const statusResponse = await axios.get(`${graphUrl}/${creationId}`, {
          params: { fields: "status_code", access_token },
          timeout: 10000,
        });

        if (statusResponse.data?.status_code === "FINISHED") {
          isReady = true;
          break;
        }

        await new Promise((r) => setTimeout(r, 3000));
      }

      if (!isReady) {
        return {
          content: [
            {
              type: "text",
              text: "Instagram media processing timeout.",
            },
          ],
        };
      }

      const publishResponse = await axios.post(
        `${graphUrl}/${integration.providerAccountId}/media_publish`,
        null,
        {
          params: { creation_id: creationId, access_token },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              mediaId: publishResponse.data?.id,
              caption,
            }),
          },
        ],
      };
    } catch (error) {
      console.error(error);
      return {
        content: [
          {
            type: "text",
            text: `instagram publishing failed ${error}`,
          },
        ],
      };
    }
  }
);

//Analyze the Image
server.registerTool(
  "analyze_image",
  {
    description: `
Analyze an image using the Google Gemini vision model.

Use this tool whenever the user uploads or provides an image and asks a question about it, or simply wants to know what the image contains.

Examples:
- What is in this image?
- Describe this image.
- Explain this screenshot.
- Read the text in this image.
- Explain this code screenshot.

IMPORTANT:
- Analyze the image and answer the user's question.
- If the user only uploads an image without a question, describe the image and its important visible details.
- Never suggest publishing the image to Instagram unless the user explicitly asks to publish or post it.
- This tool only analyzes images. It never publishes them.
`,
    inputSchema: z.object({
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
  },
  async ({ imageUrl, prompt }) => {
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch image. Status: ${imageResponse.status}`
        );
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const base64image = Buffer.from(arrayBuffer).toString("base64");
      const contentType = imageResponse.headers.get("content-type");

      const imageAnalyzer = new ChatGoogleGenerativeAI({
        model: "gemini-3.5-flash-lite",
        temperature: 0,
        maxRetries: 2,
        apiKey: process.env.GOOGLE_API_KEY,
      });

      const message = new HumanMessage({
        content: [
          {
            type: "text",
            text: `${prompt} Describe this image clearly and accurately.`,
          },
          {
            type: "image_url",
            image_url: `data:${contentType};base64,${base64image}`,
          },
        ],
      });

      const response = await imageAnalyzer.invoke([message]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              result:
                typeof response.content === "string"
                  ? response.content.trim()
                  : response.content,
            }),
          },
        ],
      };
    } catch (error) {
      console.log(error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `image analysis failed ${error}`,
          },
        ],
      };
    }
  }
);

const main = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp server started successfully");
};

main().catch((error) => {
  console.error("mcp server error", error);
  process.exit(1);
});