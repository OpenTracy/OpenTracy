import anthropicIcon from '../assets/anthropic.svg';
import bedrockIcon from '../assets/bedrock.svg';
import cerebrasIcon from '../assets/cerebras.svg';
import cohereIcon from '../assets/cohere-color.svg';
import deepseekIcon from '../assets/deepseek.svg';
import geminiIcon from '../assets/gemini-color.svg';
import groqIcon from '../assets/groq.svg';
import huggingFaceIcon from '../assets/huggingface.svg';
import metaIcon from '../assets/meta.svg';
import mistralIcon from '../assets/Mistral.svg';
import moonshotIcon from '../assets/moonshot.svg';
import openaiIcon from '../assets/openai.svg';
import perplexityIcon from '../assets/perplexity.svg';
import qwenIcon from '../assets/qwen.svg';
import sambanovaIcon from '../assets/sambanova-color.svg';
import togetherIcon from '../assets/together-color.svg';
import opentracyIcon from '../assets/opentracy-logo.png';

export const MODELS = [
  // deepseek
  'deepseek-r1-distill-llama-70b',
  'DeepSeek-R1-Distill-Llama-70B',
  'DeepSeek-R1',
  'DeepSeek-V3-0324',
  'deepseek-ai/DeepSeek-V3',
  'deepseek-ai/DeepSeek-R1',
  'deepseek-reasoner',
  'deepseek-chat',
  'deepseek-coder',

  // meta-llama
  'llama3.1-8b',
  'llama-3.3-70b',
  'llama-3.3-70b-versatile',
  'llama-3.3-70b-specdec',
  'llama-guard-4-12b',
  'llama2-70b-4096',
  'llama3-8b-8192',
  'llama-3.2-3b-preview',
  'llama-3.2-11b-text-preview',
  'llama-3.2-90b-text-preview',
  'llama3-70b-8192',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'Meta-Llama-3.1-8B-Instruct',
  'Meta-Llama-3.1-405B-Instruct',
  'Llama-4-Maverick-17B-128E-Instruct',
  'Meta-Llama-3.3-70B-Instruct',
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
  'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct',
  'meta-llama/Llama-3.2-3B-Instruct-Turbo',

  // cohere
  'command-r-plus',
  'command-r',
  'command',
  'command-light',

  // qwen
  'qwen-3-32b',
  'qwen/qwen3-32b',
  'Qwen3-32B',
  'Qwen/Qwen2.5-7B-Instruct-Turbo',
  'Qwen/Qwen2.5-72B-Instruct-Turbo',

  // moonshot
  'moonshotai/kimi-k2-instruct',
  'moonshotai/Kimi-K2-Instruct',

  // mistral / mixtral / devstral
  'mistral-saba-24b',
  'mistralai/Mixtral-8x7B-Instruct-v0.1',
  'mistralai/Mistral-7B-Instruct-v0.1',
  'mistralai/Mistral-Small-24B-Instruct-2501',
  'mistral-tiny',
  'mistral-small',
  'mistral-small-latest',
  'mistral-medium',
  'mistral-medium-latest',
  'mistral-medium-2505',
  'mistral-medium-2312',
  'mistral-large-latest',
  'mistral-large-2411',
  'mistral-large-2402',
  'mistral-large-2407',
  'pixtral-large-latest',
  'pixtral-large-2411',
  'pixtral-12b-2409',
  'open-mistral-7b',
  'open-mixtral-8x7b',
  'open-mixtral-8x22b',
  'open-mistral-nemo',
  'open-mistral-nemo-2407',
  'codestral-latest',
  'codestral-2405',
  'devstral-small-2505',
  'devstral-small-2507',
  'devstral-medium-2507',
  'magistral-medium-latest',
  'magistral-medium-2506',
  'magistral-small-latest',
  'magistral-small-2506',

  // openai
  'gpt-4-0613',
  'gpt-4',
  'gpt-3.5-turbo',
  'davinci-002',
  'babbage-002',
  'gpt-3.5-turbo-instruct',
  'gpt-3.5-turbo-instruct-0914',
  'gpt-4-1106-preview',
  'gpt-3.5-turbo-1106',
  'gpt-4-0125-preview',
  'gpt-4-turbo-preview',
  'gpt-3.5-turbo-0125',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-4o',
  'gpt-4o-2024-05-13',
  'gpt-4o-mini-2024-07-18',
  'gpt-4o-mini',
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-11-20',
  'gpt-4o-search-preview-2025-03-11',
  'gpt-4o-search-preview',
  'gpt-4o-mini-search-preview-2025-03-11',
  'gpt-4o-mini-search-preview',
  'gpt-4.1-2025-04-14',
  'gpt-4.1',
  'gpt-4.1-mini-2025-04-14',
  'gpt-4.1-mini',
  'gpt-4.1-nano-2025-04-14',
  'gpt-4.1-nano',
  'gpt-3.5-turbo-16k',

  // anthropic
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20240620',
  'claude-3-haiku-20240307',
  'claude-3-opus-20240229',

  // google (Gemini / Gemma)
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-flash-002',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash-8b-001',
  'gemini-1.5-flash-8b-latest',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-thinking-exp-01-21',
  'gemini-2.0-flash-thinking-exp',
  'gemini-2.0-flash-thinking-exp-1219',
  'gemma2-9b-it',
  'gemma-3-1b-it',
  'gemma-3-4b-it',
  'gemma-3-12b-it',
  'gemma-3-27b-it',
  'gemma-3n-e4b-it',
  'gemma-3n-e2b-it',
  'gemini-2.5-flash-lit',

  // sonar
  'sonar',
  'sonar-pro',
  'sonar-reasoning',
  'sonar-deep-research',
];

export const MODEL_ICONS = {
  anthropicIcon,
  bedrockIcon,
  cerebrasIcon,
  cohereIcon,
  deepseekIcon,
  geminiIcon,
  groqIcon,
  huggingFaceIcon,
  metaIcon,
  mistralIcon,
  moonshotIcon,
  openaiIcon,
  perplexityIcon,
  qwenIcon,
  sambanovaIcon,
  togetherIcon,
  opentracyIcon,
};
