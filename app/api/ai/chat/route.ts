
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const systemPrompt = `
# ROLE: EXPERT USER DATABASE ADMINISTRATOR
You are a precision-oriented AI assistant specialized in managing user data.

# PRIMARY OBJECTIVES:
1. **Purity of Intent:** Map user requests to the most efficient tool.
2. **Data Integrity:** Only modify or delete records after unique identification.
3. **Natural Synthesis:** Summarize tool outputs into human-friendly responses.

# UNRELATED CONTENT GUARDRAIL:
If the user's message is unrelated to user management, database records, search, or system operations (e.g., general talk, jokes, weather, etc.):
- **DO NOT** attempt to use any tools.
- **DO NOT** try to interpret it as a filter.
- **RESPONSE:** Provide a friendly "Sample Message" that briefly explains what you *can* do. 
- *Example Response:* "I specialize in managing your user database. I can help you find specific users (e.g., 'Show all admins'), update records (e.g., 'Change John's role to Developer'), or create new profiles. How can I help you with your data today?"

# OPERATIONAL GUIDELINES:

## 1. DATA SCHEMA & VALIDATION
- **Fields:** [name, email, phone, age, address, role, department].
- **Format:** Emails must be lowercase. Roles and Departments should match existing values when possible.
- **Constraints:** 'email' is the only guaranteed unique identifier.

## 2. MODIFICATION PROTOCOL (UPDATE/DELETE)
- **Step 1 (Attempt):** Always prioritize name-based matching first for user convenience.
- **Step 2 (Evaluate):** If the database returns multiple records, STOP execution. 
- **Step 3 (Clarify):** List the conflicting users (including emails) and ask the user to provide the correct email to disambiguate.
- **Step 4 (Trust the Tool):** Do not prematurely ask for an email unless you have reason to believe the name is highly common or the tool indicates a conflict.

## 3. DATA CREATION PROTOCOL
- **Mandatory:** 'name' and 'email' are required for all new records.
- **Verification:** If a user says "Add John", you must reply: "I can add John, but I'll need his email address and preferably his role/department to complete the profile."

## 4. NEGATIVE CONSTRAINTS (NEVER DO THESE):
- NEVER invent or hallucinate emails, IDs, or search results.
- NEVER apply a 'name' filter when a user is asking for a category (e.g., "show admins").
- NEVER assume a user wants to delete all matches if multiple are found.
- NEVER share sensitive database structure information beyond the schema provided.

# INTERACTION PIPELINE (CHAIN-OF-THOUGHT):
1. **Classify:** Is this a Search (filter), Creation, Modification, or Deletion request?
2. **Extract:** Pull specific values from the user input.
3. **Execute:** Call the respective tool.
4. **Synthesize:** Convert tool response (Success/Error) into a clear natural language summary.

# REFERENCE EXAMPLES:
- *Request:* "Update Daryl's age to 30" -> Call 'update_user' with { name_query: "Daryl", updates: { age: 30 } }
- *Request:* "Show developers" -> DO NOT extract filters here (handled by specialized parser). Just answer: "Here are the developers I found."
- *Request:* "Delete test@test.com" -> Call 'delete_user' with { email: "test@test.com" }
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
  shouldReset: z.boolean().optional().describe("Whether to clear existing filters before applying these (use if the new request conflicts with or replaces the current context)"),
  unrelated: z.boolean().optional().describe("Set to true if the message is off-topic or unrelated to database/user management"),
});

const filterParser = StructuredOutputParser.fromZodSchema(filterSchema);

async function extractFiltersWithLangChain(message: string, existingRoles: string[], existingDepartments: string[], currentFilters: any, model: ChatOpenAI) {
  try {
    const prompt = `
# ROLE: SEARCH FILTER EXTRACTION SPECIALIST
Extract structured search criteria from user messages for a database lookup.

# SYSTEM CONTEXT:
- Available Roles: [${existingRoles.join(", ")}]
- Available Departments: [${existingDepartments.join(", ")}]
- Current Filters: ${JSON.stringify(currentFilters || {})}

# EXTRACTION LOGIC:
1. **Context Guardrail:** Determine if the message is related to user management, database records, search filters, or system state. If the user is asking about something completely unrelated (e.g., "how is the weather", "tell me a joke", or just general chat), extraction MUST return { "unrelated": true }.
2. **Intent Gate:** If the message is a command to CREATE, UPDATE, or DELETE, extraction MUST result in an empty object {}.
3. **Conflict Detection:** Analyze the "Current Filters". If the new search request logically replaces or conflicts with them (e.g., searching for a different user name, a different role without saying "also", or starting a clearly new search topic), set "shouldReset": true.
4. **Normalization:** Map user roles/depts to the "Available" list.

# FEW-SHOT EXAMPLES:
- User: "Find active admins" -> { "role": ["Admin"], "shouldReset": true }
- User: "Whos over age 50?" (when Current Filters has name="John") -> { "minAge": "50", "shouldReset": true }
- User: "Also include HR department" (when Current Filters has role=["Developer"]) -> { "department": ["HR"], "shouldReset": false }
- User: "What is your favorite color?" -> { "unrelated": true }

# MESSAGE FOR ANALYSIS:
"{message}"

# INSTRUCTIONS:
{format_instructions}
`;

    const formatInstructions = filterParser.getFormatInstructions();
    const result = await model.invoke(prompt.replace("{message}", message).replace("{format_instructions}", formatInstructions));
    
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const parsed = await filterParser.parse(content);
    
    // Return null if empty to avoid triggering filter updates in the UI
    if (Object.keys(parsed).length === 0) return null;
    
    // Extract shouldReset and clean the filters object
    const { shouldReset, unrelated, ...filters } = parsed;
    
    if (unrelated) return { filters: {}, shouldReset: false, unrelated: true };
    
    return { filters: Object.keys(filters).length > 0 ? filters : {}, shouldReset: !!shouldReset };
  } catch (e) {
    console.error("Filter extraction error:", e);
    return null;
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
    const { message, history, currentFilters } = await request.json();
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

          const filterResult = refresh ? null : await extractFiltersWithLangChain(message, existingRoles, existingDepartments, currentFilters, chatModel);
          const filters = filterResult?.filters;
          const shouldReset = filterResult?.shouldReset;
          const isUnrelated = filterResult?.unrelated;

          if (isUnrelated) {
            messages.push(new SystemMessage("SYSTEM NOTE: The user has asked an off-topic question. Respond with your 'Sample Message' describing what you can do."));
          }
          
          sendStatus("Generating response...");
          // Send final metadata
          controller.enqueue(encoder.encode(JSON.stringify({ filters: filters || {}, shouldReset, refresh, metadata: true }) + "\n"));

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
