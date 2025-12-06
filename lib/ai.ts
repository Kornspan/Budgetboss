import { supabase } from './supabaseClient';
import { FireConfig, Goal, AiPersonality } from "../types";

export interface AiOptions {
  personality: AiPersonality;
  searchGroundingEnabled: boolean;
  displayName?: string;
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

export interface ChatMessageInput {
  contextData: string;
  message: string;
  options: AiOptions;
}

export async function getCategorySuggestion(
  transaction: any,
  categories: { id: string; name: string }[],
): Promise<{ suggestedCategoryId: string | null; suggestedCategoryName: string | null; reason: string } | null> {
  console.debug("AI suggest payload", {
    transactionId: transaction?.id ?? transaction?.external_transaction_id ?? transaction?.name ?? 'unknown',
    categoriesCount: categories.length,
  });

  if (!categories || categories.length === 0) {
    return {
      suggestedCategoryId: null,
      suggestedCategoryName: null,
      reason: "No categories are configured yet. Add categories before using AI suggestions.",
    };
  }

  const { data, error } = await supabase.functions.invoke('ai-suggest-category', {
    body: {
      transaction,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
    },
  });
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('No data returned from ai-suggest-category');
  }
  return {
    suggestedCategoryId: data.suggestedCategoryId ?? null,
    suggestedCategoryName: data.suggestedCategoryName ?? null,
    reason: data.reason ?? '',
  };
}

export async function requestChatReply(
  input: ChatMessageInput,
): Promise<{ text: string }> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      mode: 'chat',
      contextData: input.contextData,
      message: input.message,
      options: input.options,
    },
  });
  if (error) {
    throw error;
  }
  return { text: data?.text ?? '' };
}

export async function askFireCoach(input: FireCoachInput): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      mode: 'fireCoach',
      message: input.question,
      question: input.question,
      config: input.config,
      goals: input.goals,
      options: input.options,
    },
  });
  if (error) {
    throw error;
  }
  return data?.text ?? "I'm having trouble analyzing your scenario right now. Please try again later.";
}
