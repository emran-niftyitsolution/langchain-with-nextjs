import connectDB from "@/lib/mongodb";
import { parseQueryToFilters } from "@/lib/parseQueryToFilters";
import User from "@/models/User";
import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";

const systemPrompt = `You are an AI assistant for a User Management System built with Next.js, MongoDB, and LangChain.

## PROJECT CONTEXT
This is a web application for managing users in a database. The system allows users to:
- View a table of all users with their information
- Filter users by various criteria
- Create new users through a modal form
- Use natural language queries (via you) to filter users

## USER DATA MODEL
Each user in the database has the following fields:
- name (required): User's full name
- email (required, unique): User's email address
- phone (optional): Phone number (can include country codes like +880)
- age (optional): User's age (number)
- address (optional): User's address
- role (optional): Job role
- department (optional): Department name
- createdAt: Timestamp when user was created
- updatedAt: Timestamp when user was last updated

## FILTER SYSTEM
The system supports filtering users by the following criteria:

1. **search** (text search): Searches in name and email fields (case-insensitive partial match)
   - Example: "find users named John" or "search for email containing gmail"

2. **phone** (partial match): Filters by phone number (case-insensitive regex match)
   - Supports partial matches: "88015" will match "+8801512345678" or "8801512345678"
   - Supports country codes: "+88015", "88015", etc.
   - Example: "filter phone with 88015" or "users with phone starting with +88015"

3. **role** (partial/flexible match): Filters by role name
   - Matches against actual roles existing in the database
   - Example: "show developers" or "find users with role Admin" or "role is QA"

4. **department** (partial/flexible match): Filters by department name
   - Matches against actual departments existing in the database
   - Example: "users in Engineering department" or "find Sales team" or "department is Web"

5. **minAge** (number): Minimum age filter
   - Example: "users with age minimum 25" or "age at least 30"

6. **maxAge** (number): Maximum age filter
   - Example: "users with age max 40" or "age maximum 50"

7. **Age range**: Can combine minAge and maxAge
   - Example: "users with age between 25 and 35"

## YOUR ROLE
When users ask you to filter users, you should:
1. Understand their natural language query completely
2. Identify which filter criteria they want to apply
3. Respond in a friendly, conversational manner
4. Clearly explain what filters will be applied
5. Be helpful and suggest alternatives if their query is unclear

## IMPORTANT NOTES
- Phone numbers can be in various formats: "+8801512345678", "8801512345678", "88015", etc.
- When users mention phone numbers like "88015", they likely want to filter by phone numbers that START WITH or CONTAIN that pattern
- The phone filter uses regex partial matching, so "88015" will match any phone containing "88015"
- Always be specific about what filters you're applying
- If a filter field isn't mentioned, don't apply it (avoid false positives)

## EXAMPLE QUERIES AND RESPONSES

Query: "Show all users with age max 40"
Response: "I'll filter users with maximum age of 40. Applying filter: maxAge: 40"

Query: "Find users in Engineering department"
Response: "I'll find users in the Engineering department. Applying filter: department: Engineering"

Query: "Users with age between 25 and 35"
Response: "I'll filter users aged between 25 and 35. Applying filters: minAge: 25, maxAge: 35"

Query: "Show developers"
Response: "I'll show users with the Developer role. Applying filter: role: Developer"

Query: "Filter phone with 88015"
Response: "I'll filter users whose phone numbers contain '88015'. This will match phone numbers like +8801512345678 or 8801512345678. Applying filter: phone: 88015"

Query: "Users with phone starting with +88015"
Response: "I'll find users with phone numbers starting with +88015. Applying filter: phone: +88015"

Query: "Find users named John in Engineering"
Response: "I'll find users named John in the Engineering department. Applying filters: search: John, department: Engineering"

Query: "find all users those role is admin and department is web"
Response: "I'll find all users with Admin role in the Web department. Applying filters: role: Admin, department: Web"


Always respond naturally, be helpful, and clearly explain what you're doing.`;

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Initialize Azure OpenAI chat model
    const apiKey = process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY;
    const endpoint = process.env.NEXT_PUBLIC_AZURE_OPENAI_CHAT_ENDPOINT;
    const deployment = process.env.NEXT_PUBLIC_AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-5";
    const apiVersion = process.env.NEXT_PUBLIC_AZURE_OPENAI_API_VERSION || "2025-01-01-preview";

    if (!apiKey) {
      console.error("Missing AZURE_OPENAI_API_KEY");
      return NextResponse.json(
        { error: "Azure OpenAI API key is missing" },
        { status: 500 }
      );
    }

    if (!endpoint) {
      console.error("Missing AZURE_OPENAI_CHAT_ENDPOINT");
      return NextResponse.json(
        { error: "Azure OpenAI endpoint is missing" },
        { status: 500 }
      );
    }

    // Configure Azure OpenAI
    // For Azure OpenAI, we construct the base URL with deployment and API version
    const baseURL = `${endpoint}/openai/deployments/${deployment}`;
    
    // Set environment variables that LangChain will read
    process.env.OPENAI_API_KEY = apiKey;
    process.env.OPENAI_BASE_URL = baseURL;
    
    // Fetch unique roles and departments from database for better fuzzy matching
    let existingRoles: string[] = [];
    let existingDepartments: string[] = [];
    
    try {
      await connectDB();
      existingRoles = await User.distinct("role");
      existingDepartments = await User.distinct("department");
      
      // Filter out null/undefined values
      existingRoles = existingRoles.filter(r => r);
      existingDepartments = existingDepartments.filter(d => d);
      
      console.log("Fetched existing roles:", existingRoles);
      console.log("Fetched existing departments:", existingDepartments);
    } catch (dbError) {
      console.error("Failed to fetch existing options from DB:", dbError);
      // Continue without dynamic options - parser handles fallbacks
    }
    
    const chatModel = new ChatOpenAI({
      modelName: deployment,
      apiKey: apiKey,
      configuration: {
        baseURL: baseURL,
        defaultQuery: {
          "api-version": apiVersion,
        },
        defaultHeaders: {
          "api-key": apiKey,
        },
      },
      // Note: gpt-5 model only supports default temperature (1), so we don't set it
    });

    // Get AI response
    const response = await chatModel.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ]);

    const aiResponse = response.content as string;

    // Parse query to extract filters using regex + dynamic fuzzy matching
    const filters = parseQueryToFilters(message, existingRoles, existingDepartments);

    // Log for debugging
    console.log("Query:", message);
    console.log("Extracted filters:", filters);

    return NextResponse.json({
      response: aiResponse,
      filters: filters,
    });
  } catch (error) {
    console.error("Error in AI chat:", error);
    return NextResponse.json(
      { error: "Failed to process AI request" },
      { status: 500 }
    );
  }
}
