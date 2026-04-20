export function buildPythonCode(apiModelId: string): string {
  return [
    'from opentracy import OpenTracy',
    '',
    'client = OpenTracy(api_key="pk_live_your_api_key")',
    '',
    '# Standard completion',
    'response = client.chat.completions.create(',
    `    model="opentracy/${apiModelId}",`,
    '    messages=[',
    '        {"role": "user", "content": "Tell a brief story about OpenTracy."}',
    '    ],',
    '    max_tokens=250,',
    '    temperature=0.8,',
    ')',
    '',
    'print(response.choices[0].message.content)',
    '',
    '# Streaming',
    'for chunk in client.chat.completions.create(',
    `    model="opentracy/${apiModelId}",`,
    '    messages=[{"role": "user", "content": "Hello!"}],',
    '    stream=True,',
    '):',
    '    print(chunk.choices[0].delta.content or "", end="")',
  ].join('\n');
}

export function buildCurlCode(apiModelId: string): string {
  return [
    'curl -X POST "http://localhost:8000/v1/chat/completions" \\',
    '  -H "x-api-key: pk_live_your_api_key" \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    `    "model": "opentracy/${apiModelId}",`,
    '    "messages": [',
    '      {"role": "user", "content": "Hello! How can you help me?"}',
    '    ],',
    '    "max_tokens": 150,',
    '    "temperature": 0.7',
    "  }'",
  ].join('\n');
}

export function buildJsCode(apiModelId: string): string {
  return [
    'import OpenAI from "openai";',
    '',
    'const client = new OpenAI({',
    '  baseURL: "http://localhost:8000/v1",',
    '  apiKey: "pk_live_your_api_key",',
    '  defaultHeaders: { "x-api-key": "pk_live_your_api_key" },',
    '});',
    '',
    'const response = await client.chat.completions.create({',
    `  model: "opentracy/${apiModelId}",`,
    '  messages: [{ role: "user", content: "Hello!" }],',
    '  max_tokens: 150,',
    '});',
    '',
    'console.log(response.choices[0].message.content);',
  ].join('\n');
}
