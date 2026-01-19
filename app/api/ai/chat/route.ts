
import connectDB from "@/lib/mongodb";
import { parseQueryToFilters } from "@/lib/parseQueryToFilters";
import User from "@/models/User";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";

const systemPrompt = `You are an AI assistant for a User Management System.
You have tools to manage users directly in the database. 
- Use 'create_user' to add new users.
- Use 'update_user' to modify existing users (searched by name).
- Use 'delete_user' to remove users (searched by name).

When a user asks to modify data, use the appropriate tool. 
After a tool is called, summarize the result to the user.

You can also sort the user list:
- Examples: "sort by age descending", "show newest users", "sort by name", "youngest users first".
Valid sort fields: name, email, age, role, department, createdAt.

Always be helpful and conversational.`;

async function handleUpdate(nameQuery: string, updates: any) {
  try {
    await connectDB();
    const users = await User.find({ name: { $regex: nameQuery, $options: "i" } });
    if (users.length === 0) return `Error: No user found matching "${nameQuery}".`;
    if (users.length > 1) return `Error: Multiple users found: ${users.map(u => u.name).join(", ")}. Please be more specific.`;
    
    const user = await User.findByIdAndUpdate(users[0]._id, updates, { new: true, runValidators: true });
    return `Success: Updated ${user.name}.`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleDelete(nameQuery: string) {
  try {
    await connectDB();
    const users = await User.find({ name: { $regex: nameQuery, $options: "i" } });
    if (users.length === 0) return `Error: No user found matching "${nameQuery}".`;
    if (users.length > 1) return `Error: Multiple users found: ${users.map(u => u.name).join(", ")}. Please be more specific.`;
    
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
    const deployment = process.env.NEXT_PUBLIC_AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o";
    const apiVersion = process.env.NEXT_PUBLIC_AZURE_OPENAI_API_VERSION || "2024-05-01-preview";

    if (!apiKey || !endpoint) return NextResponse.json({ error: "Azure OpenAI config missing" }, { status: 500 });
    
    const baseURL = `${endpoint}/openai/deployments/${deployment}`;
    process.env.OPENAI_API_KEY = apiKey;
    process.env.OPENAI_BASE_URL = baseURL;

    let existingRoles: string[] = [];
    let existingDepartments: string[] = [];
    try {
      await connectDB();
      existingRoles = await User.distinct("role");
      existingDepartments = await User.distinct("department");
    } catch (e) {}

    const chatModel = new ChatOpenAI({
      modelName: deployment,
      apiKey: apiKey,
      configuration: {
        baseURL: baseURL,
        defaultQuery: { "api-version": apiVersion },
        defaultHeaders: { "api-key": apiKey },
      },
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
              name_query: { type: "string" }
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
    
    // Convert history to LangChain messages
    const historyMessages = (history || []).map((msg: any) => {
      if (msg.role === "user") return new HumanMessage(msg.content);
      if (msg.role === "assistant") return new AIMessage(msg.content);
      return new HumanMessage(msg.content); // Default to HumanMessage if role is unknown
    });

    let messages: any[] = [
      new SystemMessage(fullSystemPrompt),
      ...historyMessages,
      new HumanMessage(message)
    ];

    let result = await modelWithTools.invoke(messages);
    let refresh = false;

    if (result.tool_calls && result.tool_calls.length > 0) {
      refresh = true;
      messages.push(result);
      
      for (const toolCall of result.tool_calls) {
        let toolOutput = "";
        if (toolCall.name === "update_user") {
          toolOutput = await handleUpdate(toolCall.args.name_query, toolCall.args.updates);
        } else if (toolCall.name === "delete_user") {
          toolOutput = await handleDelete(toolCall.args.name_query);
        } else if (toolCall.name === "create_user") {
          toolOutput = await handleCreate(toolCall.args);
        }
        
        messages.push(new ToolMessage({
          content: toolOutput,
          tool_call_id: toolCall.id!
        }));
      }
      
      result = await modelWithTools.invoke(messages);
    }

    const aiResponse = result.content as string;
    // Don't apply filters if we performed a write operation (create, update, or delete)
    const filters = refresh ? {} : parseQueryToFilters(message, existingRoles, existingDepartments);

    return NextResponse.json({
      response: aiResponse,
      filters: filters,
      refresh: refresh
    });
  } catch (error) {
    console.error("AI Chat Error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
