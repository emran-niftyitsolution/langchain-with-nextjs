
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const systemPrompt = `
You are the **User Database Administrator AI**, a precision-focused assistant responsible for managing user records via strict database tools.

### 1. DATA SCHEMA
You are managing a database with the following user fields. Use these exact field names for filtering and creation:
- **name** (string): Full name of the user.
- **email** (string): Unique identifier.
- **phone** (string): Contact phone number.
- **age** (integer)
- **address** (string): Physical address.
- **role** (string): e.g., "Admin", "Editor", "Viewer".
- **department** (string): e.g., "IT", "HR", "Sales".
- **createdAt** (date)

### 2. TOOL USAGE GUIDELINES

#### A. Retrieval & Filtering (READ)
When a user asks to see, find, or list users, you MUST map their natural language request to specific structured filters.
- **Strict Filtering:** ONLY apply filters for fields explicitly mentioned by the user. **DO NOT** add a 'name' filter or any other filter unless the user specifically asks for it.
    - *Bad Example:* User: "Show users > 40" -> Tool: { "name": "John", "age": { "$gt": 40 } } (WRONG - Do not invent names).
    - *Good Example:* User: "Show users > 40" -> Tool: { "age": { "$gt": 40 } } (CORRECT).
- **Ambiguity:** If a user asks for "users in Tech", infer "department": "IT" or ask for clarification if unsure.
- **Complex Filters:** Handle multi-condition logic.
    - *User:* "Show me active Admins over 40."
    - *Action:* Call search tool with { "role": "Admin", "status": "Active", "age": { "$gt": 40 } }.
- **Sorting:** If the user requests a sort order (e.g., "newest first"), apply sorting on the "createdAt" field descending.

#### B. Creation (CREATE)
- **Validation:** Do not invent data. If the user says "Create a user named John", you MUST ask for the required "email" and "role" before calling the create tool.
- **Uniqueness:** Assume email must be unique.

#### C. Modification (UPDATE)
- **Identification:** You can identify a user by their full name. 
- **Ambiguity:** If the name is common or the system finds multiple matches, the tool will return an error listing candidates. You should only ask for an email if the system cannot find a unique record or if the tool specifically requests it.
- **Partial Updates:** Only send the fields that strictly need changing.

#### D. Removal (DELETE)
- **Safety Lock:** This is a destructive action.
- **Confirmation:** If a unique user is clearly identified by name, you may proceed. However, if the target is vague (e.g., "delete the test user"), you must list the potential matches and ask for confirmation of the specific "email".

### 3. CRITICAL OPERATIONAL RULES
1.  **Trust the Tool:** The tools are designed to handle ambiguity. You can attempt to call 'update_user' or 'delete_user' with just a 'name_query'. If it fails due to multiple matches, then ask for clarification.
2.  **No Hallucinations:** Never output a User ID or email that was not provided by the tool output or the user.
3.  **Tool First:** Do not answer from your own knowledge base; use the provided tools to fetch the current state of the database.
4.  **Error Handling:** If a tool returns a "Multiple users found" error, show the list of matching users (with their emails if provided by the tool) and ask the user to provide the email of the target record.

### 4. INTERACTION FLOW
1.  **Analyze** the user's intent.
2.  **Verify** if you have the target name or email and the fields to change.
3.  **Execute** the tool immediately if you have a clear target name/email.
4.  **Clarify** ONLY if the tool returns an error or if the request is truly undecipherable.
5.  **Report** the results.
`;

const filterSchema = z.object({
  name: z.string().optional().describe("User's full name"),
  email: z.string().optional().describe("User's email address"),
  phone: z.string().optional().describe("User's phone number"),
  role: z.array(z.string()).optional().describe("List of user roles to filter by"),
  department: z.array(z.string()).optional().describe("List of departments to filter by"),
  minAge: z.string().optional().describe("Minimum age (as string)"),
  maxAge: z.string().optional().describe("Maximum age (as string)"),
  sortBy: z.enum(['name', 'email', 'age', 'role', 'department', 'createdAt']).optional().describe("Field to sort by"),
  sortOrder: z.enum(['asc', 'desc']).optional().describe("Sort direction"),
});

const filterParser = StructuredOutputParser.fromZodSchema(filterSchema);

async function extractFiltersWithLangChain(message: string, existingRoles: string[], existingDepartments: string[], model: ChatOpenAI) {
  try {
    const prompt = `Extract user search filters from the following message.
Only extract filters that are explicitly requested.
If no filters are found, return an empty object.

Available Roles: ${existingRoles.join(", ")}
Available Departments: ${existingDepartments.join(", ")}

Message: {message}

{format_instructions}`;

    const formatInstructions = filterParser.getFormatInstructions();
    const result = await model.invoke(prompt.replace("{message}", message).replace("{format_instructions}", formatInstructions));
    
    // The model might return a string in JSON format, parse it
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    return await filterParser.parse(content);
  } catch (e) {
    console.error("Filter extraction error:", e);
    return {};
  }
}

async function handleUpdate(nameQuery: string, updates: any, email?: string) {
  try {
    await connectDB();
    // If email is provided, use it for exact match. Otherwise use name regex.
    const query = email ? { email: email } : { name: { $regex: nameQuery, $options: "i" } };
    const users = await User.find(query);
    
    if (users.length === 0) return `Error: No user found matching ${email || `"${nameQuery}"`}.`;
    if (users.length > 1) return `Error: Multiple users found: ${users.map(u => u.name).join(", ")}. Please provide an email for precision.`;
    
    const user = await User.findByIdAndUpdate(users[0]._id, updates, { new: true, runValidators: true });
    return `Success: Updated ${user.name}.`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleDelete(nameQuery: string, email?: string) {
  try {
    await connectDB();
    const query = email ? { email: email } : { name: { $regex: nameQuery, $options: "i" } };
    const users = await User.find(query);
    
    if (users.length === 0) return `Error: No user found matching ${email || `"${nameQuery}"`}.`;
    if (users.length > 1) return `Error: Multiple users found: ${users.map(u => u.name).join(", ")}. Please provide an email for precision.`;
    
    await User.findByIdAndDelete(users[0]._id);
    return `Success: Deleted user ${users[0].name}.`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleCreate(userData: any) {
  try {
    await connectDB();
    const user = await User.create(userData);
    return `Success: Created user ${user.name} with email ${user.email}.`;
  } catch (err) {
    return `Error creating user: ${err instanceof Error ? err.message : "Validation error or duplicate email"}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const apiKey = process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY;
    const endpoint = process.env.NEXT_PUBLIC_AZURE_OPENAI_CHAT_ENDPOINT;
    const deployment = process.env.NEXT_PUBLIC_AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini";
    const apiVersion = process.env.NEXT_PUBLIC_AZURE_OPENAI_API_VERSION || "2024-05-01-preview";
    console.log("apiKey", apiKey);
    console.log("endpoint", endpoint);
    console.log("deployment", deployment);
    console.log("apiVersion", apiVersion);

    if (!apiKey || !endpoint) return NextResponse.json({ error: "Azure OpenAI config missing" }, { status: 500 });
    
    const baseURL = `${endpoint}/openai/deployments/${deployment}`;
    process.env.OPENAI_API_KEY = apiKey;
    process.env.OPENAI_BASE_URL = baseURL;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendStatus = (status: string) => {
          controller.enqueue(encoder.encode(JSON.stringify({ status }) + "\n"));
        };

        try {
          sendStatus("Connecting to database...");
          await connectDB();

          sendStatus("Fetching system metadata...");
          const [existingRoles, existingDepartments] = await Promise.all([
            User.distinct("role"),
            User.distinct("department")
          ]);

          const chatModel = new ChatOpenAI({
            apiKey: apiKey,
            modelName: deployment,
            maxTokens: 1000,
            configuration: {
              baseURL: baseURL,
              defaultQuery: { "api-version": apiVersion },
              defaultHeaders: { "api-key": apiKey },
            },
            streaming: true,
          });

          const tools = [
            {
              type: "function",
              function: {
                name: "update_user",
                description: "Update a user's information by name.",
                parameters: {
                  type: "object",
                  properties: {
                    name_query: { type: "string" },
                    email: { type: "string", description: "Optional email for exact identification if multiple users have the same name." },
                    updates: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        email: { type: "string" },
                        role: { type: "string" },
                        department: { type: "string" },
                        age: { type: "number" },
                        phone: { type: "string" },
                        address: { type: "string" }
                      }
                    }
                  },
                  required: ["name_query", "updates"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "delete_user",
                description: "Delete a user by name.",
                parameters: {
                  type: "object",
                  properties: {
                    name_query: { type: "string" },
                    email: { type: "string", description: "Optional email for exact identification if multiple users have the same name." }
                  },
                  required: ["name_query"]
                }
              }
            },
            {
              type: "function",
              function: {
                name: "create_user",
                description: "Create a new user.",
                parameters: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                    role: { type: "string" },
                    department: { type: "string" },
                    age: { type: "number" },
                    phone: { type: "string" },
                    address: { type: "string" }
                  },
                  required: ["name", "email"]
                }
              }
            }
          ];

          const modelWithTools = chatModel.bindTools(tools as any);
          const fullSystemPrompt = `${systemPrompt}\n\nExisting Roles: ${existingRoles.join(", ")}\nExisting Departments: ${existingDepartments.join(", ")}`;
          
          const historyMessages = (history || []).map((msg: any) => {
            if (msg.role === "user") return new HumanMessage(msg.content);
            if (msg.role === "assistant") return new AIMessage(msg.content);
            return new HumanMessage(msg.content);
          });

          let messages: any[] = [
            new SystemMessage(fullSystemPrompt),
            ...historyMessages,
            new HumanMessage(message)
          ];

          sendStatus("Analyzing your request...");
          let result = await modelWithTools.invoke(messages);
          let refresh = false;

          if (result.tool_calls && result.tool_calls.length > 0) {
            sendStatus("Executing database tools...");
            refresh = true;
            messages.push(result);
            
            const toolOutputs = await Promise.all(result.tool_calls.map(async (toolCall: any) => {
              let toolOutput = "";
              if (toolCall.name === "update_user") {
                toolOutput = await handleUpdate(toolCall.args.name_query, toolCall.args.updates, toolCall.args.email);
              } else if (toolCall.name === "delete_user") {
                toolOutput = await handleDelete(toolCall.args.name_query, toolCall.args.email);
              } else if (toolCall.name === "create_user") {
                toolOutput = await handleCreate(toolCall.args);
              }
              return new ToolMessage({
                content: toolOutput,
                tool_call_id: toolCall.id!
              });
            }));
            
            messages.push(...toolOutputs);
          }

          const filters = refresh ? {} : await extractFiltersWithLangChain(message, existingRoles, existingDepartments, chatModel);
          
          sendStatus("Generating response...");
          // Send final metadata
          controller.enqueue(encoder.encode(JSON.stringify({ filters, refresh, metadata: true }) + "\n"));

          // Final streaming of AI content
          const aiStream = await chatModel.stream(messages);
          for await (const chunk of aiStream) {
            if (chunk.content) {
              controller.enqueue(encoder.encode(chunk.content as string));
            }
          }
        } catch (err) {
          console.error("Streaming error:", err);
          controller.enqueue(encoder.encode(`\nError: ${err instanceof Error ? err.message : "Internal error"}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("AI Chat Error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
