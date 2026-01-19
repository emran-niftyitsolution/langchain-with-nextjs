import { FilterState } from "@/components/UsersFilter";
import Fuse from "fuse.js";

/**
 * Fuzzy match a string against a list of common options
 * 
 * @param input - The extracted role/department value
 * @param options - List of values to match against
 * @param threshold - How strict matching is (higher = looser). 
 * If dynamic options are provided, we use a looser threshold (0.6) to allow "web" -> "Web Development"
 */
function fuzzyMatch(input: string, options: string[], threshold = 0.4): string {
  if (!input) return "";
  
  // Capitalize the input for comparison
  const capitalizedInput = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
  
  // If exact match (case-insensitive), return the correct casing
  const exactMatch = options.find(opt => opt.toLowerCase() === input.toLowerCase());
  if (exactMatch) return exactMatch;
  
  // Try fuzzy matching
  const fuse = new Fuse(options, {
    threshold,
    distance: 100,
    includeScore: true,
  });
  
  const results = fuse.search(input);
  
  // If match found
  if (results.length > 0 && results[0].score !== undefined && results[0].score < threshold) {
    return results[0].item;
  }
  
  // No close match found - return original
  return capitalizedInput;
}

export function parseQueryToFilters(
  query: string, 
  existingRoles: string[] = [], 
  existingDepartments: string[] = []
): FilterState {
  const filters: FilterState = {
    search: "",
    phone: "",
    role: "",
    department: "",
    minAge: "",
    maxAge: "",
  };

  // Use dynamic options provided from DB
  const roleOptions = existingRoles;
  const deptOptions = existingDepartments;
  
  // Use a balanced threshold: lenient enough for typos, strict enough for accuracy
  const roleThreshold = 0.5;
  const deptThreshold = 0.5;

  const lowerQuery = query.toLowerCase();



  // Extract age filters
  const maxAgeMatch = lowerQuery.match(/max(?:imum)?\s*(?:age)?\s*(?:is|of|:)?\s*(\d+)/i);
  const minAgeMatch = lowerQuery.match(/min(?:imum)?\s*(?:age)?\s*(?:is|of|:)?\s*(\d+)/i);
  const ageMatch = lowerQuery.match(/age\s*(?:is|of|:)?\s*(\d+)/i);
  const ageRangeMatch = lowerQuery.match(/age\s*(?:between|from)?\s*(\d+)\s*(?:and|to|-)\s*(\d+)/i);

  if (maxAgeMatch) {
    filters.maxAge = maxAgeMatch[1];
  } else if (ageRangeMatch) {
    filters.minAge = ageRangeMatch[1];
    filters.maxAge = ageRangeMatch[2];
  } else if (minAgeMatch) {
    filters.minAge = minAgeMatch[1];
  } else if (ageMatch) {
    const age = ageMatch[1];
    filters.minAge = age;
    filters.maxAge = age;
  }

  // Extract role - use context-aware patterns
  // First try common role patterns for better matching
  const commonRolePatterns = [
    { keyword: "developer", pattern: /\b(?:show|find|get|list|search|with|role|position|job|as|is)\s+(?:a\s+)?developers?\b/i },
    { keyword: "manager", pattern: /\b(?:show|find|get|list|search|with|role|position|job|as|is)\s+(?:a\s+)?managers?\b/i },
    { keyword: "designer", pattern: /\b(?:show|find|get|list|search|with|role|position|job|as|is)\s+(?:a\s+)?designers?\b/i },
    { keyword: "engineer", pattern: /\b(?:show|find|get|list|search|with|role|position|job|as|is)\s+(?:an\s+)?engineers?\b/i },
    { keyword: "admin", pattern: /\b(?:show|find|get|list|search|with|role|position|job|as|is)\s+(?:an\s+)?admins?\b/i },
    { keyword: "analyst", pattern: /\b(?:show|find|get|list|search|with|role|position|job|as|is)\s+(?:an\s+)?analysts?\b/i },
    { keyword: "director", pattern: /\b(?:show|find|get|list|search|with|role|position|job|as|is)\s+(?:a\s+)?directors?\b/i },
  ];
  
  for (const role of commonRolePatterns) {
    if (role.pattern.test(query)) {
      filters.role = role.keyword.charAt(0).toUpperCase() + role.keyword.slice(1);
      break;
    }
  }

  // If no common role found, try generic role patterns to capture any role name
  if (!filters.role) {
    const genericRolePatterns = [
      /\b(?:role|position|job)\s+(?:is|:)\s+(\w+(?:\s+\w+)?)/i,  // "role is admin" or "position: web developer"
      /\b(?:with|as|is)\s+(?:a|an|the)?\s*(\w+)\s+(?:role|position|job)\b/i,  // "with admin role" or "as a developer position"
      /\b(?:show|find|get|list)\s+(\w+)s?\s+(?:in|from)\s+\w+/i,  // "show developers in sales" or "find qa in marketing"
      /\b(?:show|find|get|list)\s+(?:all\s+)?(\w+)s?\s*$/i,  // "show admins" or "find developers" (at end of query)
    ];

    for (const pattern of genericRolePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const role = match[1].trim();
        // Remove trailing 's' if present (e.g., "admins" -> "admin")
        const singularRole = role.endsWith('s') ? role.slice(0, -1) : role;
        // Apply fuzzy matching against available roles
        filters.role = fuzzyMatch(singularRole, roleOptions, roleThreshold);
        break;
      }
    }
  }


  // Extract department - use flexible pattern to capture ANY department name
  // Patterns to extract department from various query formats
  const deptPatterns = [
    /\b(?:department|dept)\s+(?:is|:)\s+(\w+(?:\s+\w+)?)/i,  // "department is web" or "dept: web development"
    /\b(?:role|position|job)\s+(?:is|:)\s+\w+\s+(?:in|from)\s+(\w+(?:\s+\w+)?)/i,  // "role is architect in legal"
    /\b(?:in|from|of)\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:department|dept)\b/i,  // "in web department" or "from the sales department"
    // For patterns like "show X in Y", make sure Y comes after "in" and is not followed by "department" keyword
    /\b(?:show|find|get|list)\s+\w+s?\s+(?:in|from)\s+(\w+(?:\s+\w+)?)\s*$/i,  // "show managers in marketing" (department at end)
    /\b(?:show|find|get|list)\s+(?:users?|all)\s+(?:in|from)\s+(\w+(?:\s+\w+)?)\s+(?:department)?/i,  // "show users in web" or "find all in sales"
    /\b(?:show|find|get|list)\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:department|dept)\b/i,  // "show web department" or "list sales department"
  ];
  
  for (const pattern of deptPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const dept = match[1].trim();
      // For multi-word departments, capitalize each word
      const normalizedDept = dept.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      // Apply fuzzy matching against available departments
      filters.department = fuzzyMatch(normalizedDept, deptOptions, deptThreshold);
      break;
    }
  }



  // Extract phone number - improved patterns
  const phonePatterns = [
    /(?:phone|number|mobile|cell)\s*(?:number|is|:)?\s*([+\d\s\-()]+)/i,
    /(?:with\s+phone|phone\s+starts?\s+with|phone\s+number|phone\s+contains?|phone\s+has)\s+([+\d\s\-()]+)/i,
    /(?:filter|find|show|get|list|search)\s+(?:users?\s+)?(?:with\s+)?phone\s+([+\d\s\-()]+)/i,
    /(?:filter|find|show|get|list|search)\s+(?:users?\s+)?phone\s+(?:starts?\s+with|contains?|is|:)\s*([+\d\s\-()]+)/i,
    /(?:filter|phone)\s+(?:with|is|:)?\s*([+\d\s\-()]+)/i, // "filter phone with 88015" or "phone 88015"
  ];

  for (const pattern of phonePatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const phoneMatch = match[1].trim().replace(/\s+/g, "");
      if (phoneMatch && phoneMatch.length >= 3) { // At least 3 digits
        filters.phone = phoneMatch;
        break;
      }
    }
  }

  // Also check for standalone phone numbers (5+ digits) that might be phone filters
  // This handles cases like "filter phone with 88015" or just "88015" in phone context
  if (!filters.phone) {
    const standalonePhonePattern = /\b(\+?\d{5,})\b/g;
    const phoneMatches = query.match(standalonePhonePattern);
    if (phoneMatches) {
      // Check if it's in a phone-related context (phone, filter, number, or common phone patterns)
      const phoneContext = /(?:phone|number|mobile|cell|filter|880|8801|88015)/i.test(query);
      if (phoneContext) {
        // Take the first phone-like number found
        filters.phone = phoneMatches[0].replace(/\s+/g, "");
      }
    }
  }

  // Extract search terms (name or email)
  const searchPatterns = [
    /(?:find|show|get|list|search)\s+(?:users?\s+)?(?:named|with\s+name|called)\s+(.+?)(?:\s+with|\s+in|\s+that|$)/i,
    /(?:find|show|get|list|search)\s+(?:users?\s+)?(?:with\s+email|email)\s+(.+?)(?:\s+with|\s+in|\s+that|$)/i,
  ];

  for (const pattern of searchPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      filters.search = match[1].trim();
      break;
    }
  }

  return filters;
}
