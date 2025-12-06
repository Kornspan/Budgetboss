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
  input: CategorySuggestionInput,
): Promise<{ categoryName: string; reason: string } | null> {
  const { data, error } = await supabase.functions.invoke('ai-suggest-category', {
    body: input,
  });
  if (error) {
    throw error;
  }
  return data?.suggestion ?? null;
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
