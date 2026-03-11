import { NextRequest, NextResponse } from 'next/server';

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';

export async function POST(request: NextRequest) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Perplexity API key not configured. Add PERPLEXITY_API_KEY to .env.local' },
      { status: 503 }
    );
  }

  let body: { message?: string; history?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const messages = [
    {
      role: 'system' as const,
      content:
        'Kamu adalah Mbah Dukun, asisten yang bijak dan ramah. Jawablah dalam bahasa Indonesia dengan nada sedikit mistis tapi tetap membantu.',
    },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  try {
    const res = await fetch(PERPLEXITY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages,
        max_tokens: 1024,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Perplexity API error:', res.status, errText);
      return NextResponse.json(
        { error: res.status === 401 ? 'Invalid API key' : 'Perplexity request failed' },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content =
      data?.choices?.[0]?.message?.content ?? 'Mbah Dukun tidak bisa menjawab saat ini. Coba lagi.';

    return NextResponse.json({ content });
  } catch (e) {
    console.error('Chat API error:', e);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
