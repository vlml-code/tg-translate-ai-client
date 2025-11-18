interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: DeepSeekMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MessageForDigest {
  text: string;
  date: Date;
  senderName: string;
  channelTitle: string;
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

async function generateDigest(
  apiKey: string,
  messages: MessageForDigest[],
  prompt: string,
  tag?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured');
  }

  if (messages.length === 0) {
    throw new Error('No messages to generate digest from');
  }

  // Format messages for the prompt
  const formattedMessages = messages
    .map((msg) => {
      const dateStr = new Date(msg.date).toLocaleString();
      return `[${dateStr}] ${msg.channelTitle} - ${msg.senderName}: ${msg.text}`;
    })
    .join('\n\n');

  const tagInfo = tag ? `\n\nThese messages are tagged as: "${tag}"` : '';

  const userMessage = `${prompt}${tagInfo}\n\n---\n\nMessages:\n\n${formattedMessages}`;

  const requestBody: DeepSeekRequest = {
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'user',
        content: userMessage
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  };

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as DeepSeekResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from DeepSeek API');
    }

    return data.choices[0].message.content;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate digest: ${error.message}`);
    }
    throw new Error('Failed to generate digest: Unknown error');
  }
}

export const deepseekService = {
  generateDigest
};
