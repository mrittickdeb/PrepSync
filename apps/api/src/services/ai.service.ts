import Groq from 'groq-sdk';
import type { Domain, Difficulty, EvaluationDimensions, TranscriptEntry } from '@prepsync/shared';
import { DOMAIN_LABELS, DIFFICULTY_LABELS } from '@prepsync/shared';

// ===== Groq client =====

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const MODEL = 'llama-3.3-70b-versatile';

// ===== System prompts =====

function interviewerSystemPrompt(domain: Domain, difficulty: Difficulty): string {
  return `You are an expert technical interviewer at a top tech company.

DOMAIN: ${DOMAIN_LABELS[domain]}
DIFFICULTY: ${DIFFICULTY_LABELS[difficulty]}

RULES:
1. Ask ONE clear, well-scoped question appropriate for the domain and difficulty.
2. For DSA: ask a coding problem with clear constraints and examples.
3. For System Design: ask a design question (e.g. "Design a URL shortener").
4. For Backend: ask about APIs, databases, scaling, or infrastructure.
5. For Conceptual: ask about CS fundamentals — OS, networking, DBMS.
6. For Behavioural: ask a STAR-format question about teamwork, conflict, leadership.
7. Be professional but friendly. Do not give hints in the initial question.
8. Keep the question concise — 3-5 sentences max.

Respond with ONLY the interview question. No greetings, no meta-commentary.`;
}

function followUpSystemPrompt(domain: Domain): string {
  return `You are a technical interviewer conducting a follow-up in a ${DOMAIN_LABELS[domain]} interview.

RULES:
1. Read the candidate's previous answer carefully.
2. Ask a follow-up that probes deeper — edge cases, complexity analysis, alternative approaches, or communication gaps.
3. Reference specific parts of their answer. Do NOT ask generic follow-ups.
4. Keep it to 1-2 sentences.
5. If their answer is complete and thorough, acknowledge it and move to a related sub-topic.

Respond with ONLY the follow-up question.`;
}

const EVALUATION_SYSTEM_PROMPT = `You are an expert technical interview evaluator. Given a full interview transcript, produce a structured evaluation.

You MUST respond with valid JSON matching this exact schema:
{
  "overallScore": <number 0-100>,
  "dimensions": {
    "correctness": <number 0-100>,
    "approachQuality": <number 0-100>,
    "timeEfficiency": <number 0-100>,
    "communicationClarity": <number 0-100>,
    "problemDecomposition": <number 0-100>,
    "edgeCaseHandling": <number 0-100>
  },
  "mistakesIdentified": ["<string>", ...],
  "strongAnswerExample": "<string describing what a strong answer would look like>",
  "improvementSuggestions": ["<string>", ...],
  "topicsToReview": ["<string>", ...]
}

SCORING GUIDE:
- 0-39: Poor — fundamental gaps, incorrect solution
- 40-59: Below Average — partial solution, significant gaps
- 60-79: Good — mostly correct, room for improvement
- 80-100: Excellent — strong, comprehensive answer

CRITICAL EVALUATION CRITERIA:
1. TECHNICAL ACCURACY: Check the code syntax, logic, and correctness. If the candidate wrote buggy or incorrect code, grade 'correctness' and 'overallScore' strictly below 50.
2. EDGE CASES: Actively look for whether the candidate identified and handled edge cases (e.g. empty inputs, null pointers, array bounds, duplicate values, extreme integers, negative inputs). If they completely ignored edge cases, penalize their 'edgeCaseHandling' score (below 40).
3. COMPLEXITY ANALYSIS: Did they analyze time and space complexity (Big O) correctly? If they calculated it incorrectly or skipped it, dock their 'timeEfficiency' score.
4. RIGOR: Be extremely strict and professional. Do not award high scores (60+) to brief, generic, or hand-waving answers. Reference specific portions of the transcript in "mistakesIdentified" and "improvementSuggestions".

Respond with ONLY the JSON. No markdown fences, no explanation.`;

const SUMMARISER_SYSTEM_PROMPT = `You are a session summariser for a technical interview practice platform.
Given the interview transcript, produce a structured summary.

You MUST respond with valid JSON matching this exact schema:
{
  "topicsCovered": ["<string>", ...],
  "strongMoments": ["<string>", ...],
  "weakMoments": ["<string>", ...],
  "actionItems": ["<string>", ...]
}

Keep each item concise (1 sentence). 2-4 items per field.
Respond with ONLY the JSON. No markdown fences.`;

// ===== AI Functions =====

function formatTranscript(transcript: TranscriptEntry[]): string {
  return transcript
    .map((entry) => {
      const role = entry.role === 'ai' ? 'Interviewer' : entry.role === 'user' ? 'Candidate' : 'System';
      return `[${role}]: ${entry.content}`;
    })
    .join('\n\n');
}

export async function generateQuestion(
  domain: Domain,
  difficulty: Difficulty,
): Promise<string> {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: interviewerSystemPrompt(domain, difficulty) },
      { role: 'user', content: 'Begin the interview. Ask your question.' },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content?.trim() || 'Tell me about a challenging technical problem you solved recently.';
}

export async function generateFollowUp(
  domain: Domain,
  transcript: TranscriptEntry[],
): Promise<string> {
  const formatted = formatTranscript(transcript);

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: followUpSystemPrompt(domain) },
      {
        role: 'user',
        content: `Here is the interview so far:\n\n${formatted}\n\nAsk your follow-up question.`,
      },
    ],
    temperature: 0.6,
    max_tokens: 300,
  });

  return response.choices[0]?.message?.content?.trim() || 'Can you elaborate on your approach?';
}

export async function generateEvaluation(
  transcript: TranscriptEntry[],
  domain: Domain,
  difficulty: Difficulty,
): Promise<{
  overallScore: number;
  dimensions: EvaluationDimensions;
  mistakesIdentified: string[];
  strongAnswerExample: string;
  improvementSuggestions: string[];
  topicsToReview: string[];
}> {
  const userMessages = transcript.filter((t) => t.role === 'user');
  const totalLength = userMessages.reduce((sum, m) => sum + (m.content?.trim()?.length || 0), 0);

  // If user didn't send any message, or messages are extremely short (less than 15 chars total)
  if (userMessages.length === 0 || totalLength < 15) {
    return {
      overallScore: 0,
      dimensions: {
        correctness: 0,
        approachQuality: 0,
        timeEfficiency: 0,
        communicationClarity: 0,
        problemDecomposition: 0,
        edgeCaseHandling: 0,
      },
      mistakesIdentified: ['The interview session was ended early or had insufficient content to evaluate.'],
      strongAnswerExample: 'Provide a structured, detailed response to the interviewer\'s questions to receive a full evaluation.',
      improvementSuggestions: ['Complete the interview rounds with actual answers to get evaluated.'],
      topicsToReview: [DOMAIN_LABELS[domain]],
    };
  }

  const formatted = formatTranscript(transcript);

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Domain: ${DOMAIN_LABELS[domain]}\nDifficulty: ${DIFFICULTY_LABELS[difficulty]}\n\nTranscript:\n${formatted}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const raw = response.choices[0]?.message?.content?.trim() || '{}';

  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/gm, '').replace(/\n?```$/gm, '');
    const parsed = JSON.parse(cleaned);

    return {
      overallScore: Math.min(100, Math.max(0, parsed.overallScore || 50)),
      dimensions: {
        correctness: parsed.dimensions?.correctness || 50,
        approachQuality: parsed.dimensions?.approachQuality || 50,
        timeEfficiency: parsed.dimensions?.timeEfficiency || 50,
        communicationClarity: parsed.dimensions?.communicationClarity || 50,
        problemDecomposition: parsed.dimensions?.problemDecomposition || 50,
        edgeCaseHandling: parsed.dimensions?.edgeCaseHandling || 50,
      },
      mistakesIdentified: parsed.mistakesIdentified || [],
      strongAnswerExample: parsed.strongAnswerExample || '',
      improvementSuggestions: parsed.improvementSuggestions || [],
      topicsToReview: parsed.topicsToReview || [],
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      overallScore: 50,
      dimensions: {
        correctness: 50,
        approachQuality: 50,
        timeEfficiency: 50,
        communicationClarity: 50,
        problemDecomposition: 50,
        edgeCaseHandling: 50,
      },
      mistakesIdentified: ['Evaluation could not be parsed — please try again'],
      strongAnswerExample: '',
      improvementSuggestions: ['Practice your approach to this problem'],
      topicsToReview: [DOMAIN_LABELS[domain]],
    };
  }
}

export async function generateSummary(
  transcript: TranscriptEntry[],
): Promise<{
  topicsCovered: string[];
  strongMoments: string[];
  weakMoments: string[];
  actionItems: string[];
}> {
  const formatted = formatTranscript(transcript);

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SUMMARISER_SYSTEM_PROMPT },
      { role: 'user', content: formatted },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  const raw = response.choices[0]?.message?.content?.trim() || '{}';

  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/gm, '').replace(/\n?```$/gm, '');
    const parsed = JSON.parse(cleaned);

    return {
      topicsCovered: parsed.topicsCovered || [],
      strongMoments: parsed.strongMoments || [],
      weakMoments: parsed.weakMoments || [],
      actionItems: parsed.actionItems || [],
    };
  } catch {
    return {
      topicsCovered: [],
      strongMoments: [],
      weakMoments: [],
      actionItems: ['Review session transcript for improvement areas'],
    };
  }
}
