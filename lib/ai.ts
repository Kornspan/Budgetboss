
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { FireConfig, Goal, AiPersonality } from "../types";

// Initialize the client with the environment variable API key
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Types ---

export interface AiOptions {
  personality: AiPersonality;
  searchGroundingEnabled: boolean;
  displayName?: string;
}

export interface MonthlySummary {
  monthLabel: string;
  totalSpentCents: number;
  totalBudgetedCents: number;
  netWorthCents: number;
  topCategories: { name: string; spentCents: number }[];
}

export interface CategorySuggestionInput {
  payee: string;
  amountCents: number;
  categoryNames: string[];
}

export interface FireCoachInput {
  config: FireConfig;
  goals: Goal[];
  question: string;
  options: AiOptions;
}

// --- Functions ---

/**
 * Creates a chat session with access to the user's financial context and Google Search.
 * Uses gemini-2.5-flash for search grounding support.
 */
export function createFinancialChatSession(contextData: string, options: AiOptions): Chat {
  const ai = getAi();
  
  let toneInstruction = '';
  switch (options.personality) {
    case 'direct':
      toneInstruction = 'Be brief, direct, and professional. Avoid fluff. Focus on the numbers.';
      break;
    case 'playful':
      toneInstruction = 'Be fun, cheerful, and use emojis. Explain things simply and engagingly.';
      break;
    case 'friendly':
    default:
      toneInstruction = 'Be concise, friendly, and encouraging.';
      break;
  }

  const systemInstruction = `
    You are an AI Financial Coach for ${options.displayName || 'the user'}.
    ${toneInstruction}
    You have read-only access to the user's current financial data provided below.
    
    === USER FINANCIAL DATA ===
    ${contextData}
    ===========================
    
    CAPABILITIES:
    1. Answer specific questions about the user's portfolio, spending, and budget based on the data above.
    2. Answer general personal finance questions (e.g., "How does a Roth IRA work?").
    3. Use Google Search to provide real-time updates on the stock market, economic news, or specific ticker symbols.
    
    RULES:
    - If you use Google Search, the application will automatically show citations, so you don't need to manually list URLs, but you should reference the information naturally.
    - Do not give specific investment advice (e.g., "You should buy stock X"). Instead, explain concepts or current market conditions.
    - Format response with Markdown.
  `;

  const tools: any[] = [];
  if (options.searchGroundingEnabled) {
    tools.push({ googleSearch: {} });
  }

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
      tools: tools.length > 0 ? tools : undefined,
    }
  });
}

/**
 * Suggests a category for a transaction based on payee and amount.
 * Uses gemini-2.5-flash-lite-latest for lowest latency.
 */
export async function getCategorySuggestion(input: CategorySuggestionInput): Promise<{ categoryName: string; reason: string } | null> {
  const ai = getAi();
  const model = 'gemini-2.5-flash-lite-latest';
  
  const prompt = `
    Suggest the single best category for this transaction.
    Payee: "${input.payee}"
    Amount: $${(input.amountCents / 100).toFixed(2)}
    
    Available Categories: ${input.categoryNames.join(', ')}
    
    Return JSON with:
    - categoryName: Must be exactly one of the available categories, or "Uncategorized" if no fit.
    - reason: A short (5-10 words) explanation.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categoryName: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["categoryName", "reason"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Suggestion Error:", error);
    return null;
  }
}

/**
 * Answers "What-If" scenarios about FIRE goals.
 * Uses gemini-3-pro-preview for complex reasoning.
 */
export async function askFireCoach(input: FireCoachInput): Promise<string> {
  const ai = getAi();
  
  const { options } = input;
  let toneInstruction = '';
  if (options.personality === 'direct') toneInstruction = 'Be direct and data-focused.';
  if (options.personality === 'playful') toneInstruction = 'Be encouraging and use a fun tone.';
  
  const prompt = `
    You are a FIRE (Financial Independence, Retire Early) expert.
    ${toneInstruction}
    
    User Financial Profile:
    - Portfolio Value: $${(input.config.currentPortfolioCents / 100).toFixed(2)}
    - Monthly Contribution: $${(input.config.monthlyContributionCents / 100).toFixed(2)}
    - Expected Real Return: ${input.config.expectedRealReturnPercent}%
    - Annual Spend Target: $${(input.config.annualSpendCents / 100).toFixed(2)}
    - Safe Withdrawal Rate: ${input.config.safeWithdrawalRatePercent}%
    
    Active Goals:
    ${input.goals.map(g => `- ${g.name}: $${(g.currentCents / 100).toFixed(2)} of $${(g.targetCents / 100).toFixed(2)}`).join('\n')}
    
    User Question: "${input.question}"
    
    Please answer in 2-4 short paragraphs (max 200 words).
    Provide at least 1 concrete recommendation.
    Base your answer on the math of compound interest and safe withdrawal rates where applicable.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });
    return response.text || "No response generated.";
  } catch (error) {
    console.error("AI FIRE Coach Error:", error);
    return "I'm having trouble analyzing your scenario right now. Please try again later.";
  }
}
