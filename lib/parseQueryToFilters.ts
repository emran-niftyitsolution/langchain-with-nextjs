
import { FilterState } from "@/components/UsersFilter";
import Fuse from "fuse.js";

/**
 * Fuzzy match a string against a list of common options
 */
function fuzzyMatch(input: string, options: string[], threshold = 0.4): string {
  if (!input) return "";
  const capitalizedInput = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
  const exactMatch = options.find(opt => opt.toLowerCase() === input.toLowerCase());
  if (exactMatch) return exactMatch;
  const fuse = new Fuse(options, { threshold, distance: 100, includeScore: true });
  const results = fuse.search(input);
  if (results.length > 0 && results[0].score !== undefined && results[0].score < threshold) {
    return results[0].item;
  }
  return capitalizedInput;
}

export function parseQueryToFilters(
  query: string, 
  existingRoles: string[] = [], 
  existingDepartments: string[] = []
): Partial<FilterState> {
  const filters: Partial<FilterState> = {};

  const lowerQuery = query.toLowerCase();
  const roleSet = new Set<string>();
  const deptSet = new Set<string>();

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

  // 1. Common Role Patterns (check variants)
  const commonRolePatterns = [
    { keyword: "Developer", pattern: /\b(?:developers?|devs?)\b/i },
    { keyword: "Manager", pattern: /\b(?:managers?|leads?)\b/i },
    { keyword: "Designer", pattern: /\b(?:designers?|ux|ui)\b/i },
    { keyword: "Engineer", pattern: /\b(?:engineers?|eng)\b/i },
    { keyword: "Admin", pattern: /\b(?:admins?|administrators?)\b/i },
    { keyword: "Analyst", pattern: /\b(?:analysts?)\b/i },
    { keyword: "Director", pattern: /\b(?:directors?|vp|head)\b/i },
    { keyword: "Owner", pattern: /\b(?:owners?|founders?|ceo)\b/i },
  ];
  
  for (const item of commonRolePatterns) {
    if (item.pattern.test(query)) {
      // Check if this keyword exists in actual options to assume correct casing/validity
      // If matches existing, use that. Else use keyword.
      const match = fuzzyMatch(item.keyword, existingRoles, 0.4);
      roleSet.add(match || item.keyword);
    }
  }

  // 2. Dynamic Scanning for specific existing roles
  // Allows "admin and owner" to pick up both if they exist in DB
  existingRoles.forEach(role => {
    if (!role) return;
    try {
      // Escape special regex chars
      const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match role word boundary, optional 's' or 'es' for plural
      const pattern = new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i');
      if (pattern.test(query)) {
        roleSet.add(role);
      }
    } catch (e) {
      // Fallback if regex fails
    }
  });
  
  // 3. Dynamic Scanning for departments
  existingDepartments.forEach(dept => {
    if (!dept) return;
    try {
      const escaped = dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i');
      if (pattern.test(query)) {
        deptSet.add(dept);
      }
    } catch (e) {}
  });

  if (roleSet.size > 0) filters.role = Array.from(roleSet);
  if (deptSet.size > 0) filters.department = Array.from(deptSet);

  // Extract phone number
  const phonePatterns = [
    /(?:phone|number|mobile|cell)\s*(?:number|is|:)?\s*([+\d\s\-()]+)/i,
    /(?:with\s+phone|phone\s+starts?\s+with|phone\s+number|phone\s+contains?|phone\s+has)\s+([+\d\s\-()]+)/i,
    /(?:filter|find|show|get|list|search)\s+(?:users?\s+)?(?:with\s+)?phone\s+([+\d\s\-()]+)/i,
    /(?:filter|find|show|get|list|search)\s+(?:users?\s+)?phone\s+(?:starts?\s+with|contains?|is|:)\s*([+\d\s\-()]+)/i,
    /(?:filter|phone)\s+(?:with|is|:)?\s*([+\d\s\-()]+)/i,
  ];

  for (const pattern of phonePatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const phoneMatch = match[1].trim().replace(/\s+/g, "");
      if (phoneMatch && phoneMatch.length >= 3) {
        filters.phone = phoneMatch;
        break;
      }
    }
  }

  // Check for standalone phone
  if (!filters.phone) {
    const standalonePhonePattern = /\b(\+?\d{5,})\b/g;
    const phoneMatches = query.match(standalonePhonePattern);
    if (phoneMatches) {
      const phoneContext = /(?:phone|number|mobile|cell|filter|880|8801|88015)/i.test(query);
      if (phoneContext) {
        filters.phone = phoneMatches[0].replace(/\s+/g, "");
      }
    }
  }

  // Extract name or email from general search context
  // This logic runs last to capture things not matched as role/department effectively
  // But since we use Sets for roles/depts, we don't "consume" the query.
  // We need to be careful not to mistake "Admin" for a name if it was a role.
  // Checking exclusion: if a term matches a role/dept, don't use it as name?
  // Complex. For now, specific  // Extract name or email from general search context
  const searchPatterns = [
    /(?:find|show|get|list|search)\s+(?:users?\s+)?(?:named|with\s+name|called)\s+(.+?)(?:\s+with|\s+in|\s+that|$)/i,
    /(?:find|show|get|list|search)\s+(?:users?\s+)?(?:with\s+email|email)\s+(.+?)(?:\s+with|\s+in|\s+that|$)/i,
    // Negative lookahead to avoid capturing "that roles...", "whose department..." as name
    /(?:find|show|get|list|search)\s+(?:users?\s+)?(?!that\b|who\b|whose\b|where\b|roles?\b|departments?\b)(.+?)(?:\s+with|\s+in|\s+that|$)/i,
  ];

  for (let i = 0; i < searchPatterns.length; i++) {
    const pattern = searchPatterns[i];
    const match = query.match(pattern);
    if (match && match[1]) {
      const term = match[1].trim();
      const cleanTerm = term.replace(/[.,;]$/, "");
      
      const isRole = Array.from(roleSet).some(r => r.toLowerCase() === cleanTerm.toLowerCase());
      const isDept = Array.from(deptSet).some(d => d.toLowerCase() === cleanTerm.toLowerCase());

      if (!isRole && !isDept) {
        if (cleanTerm.includes('@')) {
          filters.email = cleanTerm;
        } else {
             // For generic pattern (index 2), skip if we already have specific filters
             // This avoids capturing context text like "that roles is..." as a name
             // User must use explicit "named X" syntax if they want to combine filters with name search
             if (i === 2) {
               if (roleSet.size > 0 || deptSet.size > 0 || filters.phone || filters.email) {
                 continue;
               }

               // Also check for filter description keywords (fallback if no filters found yet but text is structural)
               const isFilterDesc = /\b(?:roles?|departments?|depts?|job|position|is|are|and|or|that|which|whose|where|users?)\b/i.test(cleanTerm);
               if (isFilterDesc) {
                 continue; 
               }
             }
             filters.name = cleanTerm;
        }
      }
      break; 
    }
  }

  // Extract sort filters
  const sortPatterns = [
    /(?:sort|order|arrange)\s+(?:by|according\s+to|with)\s+([a-z]+)\s*(asc|desc|ascending|descending)?/i,
    /(?:show|list)\s+users?\s+(?:sorted|ordered)\s+(?:by|according\s+to|with)\s+([a-z]+)\s*(asc|desc|ascending|descending)?/i,
  ];

  let sortFound = false;
  for (const pattern of sortPatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      const field = match[1].toLowerCase();
      const validFields = ['name', 'email', 'age', 'role', 'department', 'createdAt'];
      if (validFields.includes(field)) {
        filters.sortBy = field;
        const order = match[2];
        if (order) {
          filters.sortOrder = order.toLowerCase().startsWith('desc') ? 'desc' : 'asc';
        } else {
          filters.sortOrder = (field === 'createdAt' || field === 'age') ? 'desc' : 'asc';
        }
        sortFound = true;
        break;
      }
    }
  }

  if (!sortFound) {
    if (lowerQuery.includes('newest') || lowerQuery.includes('latest')) {
      filters.sortBy = 'createdAt';
      filters.sortOrder = 'desc';
    } else if (lowerQuery.includes('oldest')) {
      filters.sortBy = 'createdAt';
      filters.sortOrder = 'asc';
    } else if (lowerQuery.includes('youngest')) {
      filters.sortBy = 'age';
      filters.sortOrder = 'asc';
    }
  }

  return filters;
}
