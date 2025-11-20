/**
 * AI-Powered Chat Application on Cloudflare Workers + Pages
 * 
 * Features:
 * - Llama 3.3 via Workers AI for chat
 * - Whisper via Workers AI for voice transcription
 * - Durable Objects with WebSockets for realtime communication
 * - Cloudflare Pages for frontend
 */

import { DurableObject } from 'cloudflare:workers';

// ===== DURABLE OBJECT: ChatSession with WebSocket Support =====
// Manages conversation state, memory, and real-time WebSocket connections
export class ChatSession extends DurableObject {
	private messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
	private sessions: Set<WebSocket> = new Set();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// WebSocket connection for realtime updates
		if (url.pathname === '/ws') {
			const upgradeHeader = request.headers.get('Upgrade');
			if (upgradeHeader !== 'websocket') {
				return new Response('Expected Upgrade: websocket', { status: 426 });
			}

			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			this.ctx.acceptWebSocket(server);
			this.sessions.add(server);

			// Send connection confirmation
			server.send(JSON.stringify({
				type: 'connected',
				message: 'WebSocket connected to chat session'
			}));

			return new Response(null, {
				status: 101,
				webSocket: client
			});
		}

		// Get conversation history
		if (request.method === 'GET' && url.pathname === '/history') {
			return new Response(JSON.stringify({ messages: this.messages }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Add a message to history
		if (request.method === 'POST' && url.pathname === '/message') {
			const { role, content } = await request.json<{ role: 'user' | 'assistant' | 'system'; content: string }>();
			this.messages.push({ role, content });
			
			// Keep only last 20 messages to manage memory
			if (this.messages.length > 20) {
				this.messages = this.messages.slice(-20);
			}

			// Note: We don't broadcast messages to avoid duplicates
			// since messages are displayed via direct API responses

			return new Response(JSON.stringify({ success: true }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Clear conversation history
		if (request.method === 'POST' && url.pathname === '/clear') {
			this.messages = [];
			return new Response(JSON.stringify({ success: true }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response('Not found', { status: 404 });
	}

	// Broadcast message to all connected WebSocket clients
	private broadcast(message: any) {
		const messageStr = JSON.stringify(message);
		this.sessions.forEach(ws => {
			try {
				ws.send(messageStr);
			} catch (error) {
				console.error('Error broadcasting to WebSocket:', error);
				this.sessions.delete(ws);
			}
		});
	}

	// Handle WebSocket messages
	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		try {
			if (typeof message === 'string') {
				const data = JSON.parse(message);
				console.log('WebSocket message received:', data);
				
				// Handle different message types
				if (data.type === 'ping') {
					ws.send(JSON.stringify({ type: 'pong' }));
				}
			}
		} catch (error) {
			console.error('Error handling WebSocket message:', error);
		}
	}

	// Handle WebSocket close
	async webSocketClose(ws: WebSocket, code: number, reason: string) {
		this.sessions.delete(ws);
		console.log(`WebSocket closed: ${code} ${reason}`);
	}

	// Handle WebSocket error
	async webSocketError(ws: WebSocket, error: Error) {
		this.sessions.delete(ws);
		console.error('WebSocket error:', error);
	}
}

// ===== MAIN WORKER =====
export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// CORS headers for all responses
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// WebSocket connection
		if (url.pathname === '/ws') {
			const sessionId = url.searchParams.get('sessionId');
			if (!sessionId) {
				return new Response('Missing sessionId', { status: 400 });
			}

			// Get the Durable Object for this session
			const id = env.CHAT_SESSIONS.idFromName(sessionId);
			const chatSession = env.CHAT_SESSIONS.get(id);

			// Forward to Durable Object
			return chatSession.fetch(request);
		}

		// API: Transcribe audio using Workers AI Whisper
		if (url.pathname === '/api/transcribe' && request.method === 'POST') {
			try {
				const formData = await request.formData();
				const audioFile = formData.get('audio') as File;
				const sessionId = formData.get('sessionId') as string;

				if (!audioFile || !sessionId) {
					return new Response(JSON.stringify({ error: 'Missing audio or sessionId' }), {
						status: 400,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' }
					});
				}

				// Convert audio to ArrayBuffer for Whisper
				const audioBuffer = await audioFile.arrayBuffer();

				// Use Workers AI Whisper for speech-to-text
				const transcription = await env.AI.run('@cf/openai/whisper', {
					audio: [...new Uint8Array(audioBuffer)]
				}) as { text: string };

				return new Response(JSON.stringify({
					text: transcription.text || '',
					sessionId
				}), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});

			} catch (error) {
				console.error('Transcription error:', error);
				return new Response(JSON.stringify({
					error: 'Failed to transcribe audio',
					details: error instanceof Error ? error.message : 'Unknown error'
				}), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		// API: Send a chat message
		if (url.pathname === '/api/chat' && request.method === 'POST') {
			try {
				const { message, sessionId } = await request.json<{ message: string; sessionId: string }>();

				if (!message || !sessionId) {
					return new Response(JSON.stringify({ error: 'Missing message or sessionId' }), {
						status: 400,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' }
					});
				}

				// Get the Durable Object instance for this session
				const id = env.CHAT_SESSIONS.idFromName(sessionId);
				const chatSession = env.CHAT_SESSIONS.get(id);

				// Retrieve conversation history
				const historyResponse = await chatSession.fetch(new Request('http://internal/history'));
				const { messages } = await historyResponse.json<{ messages: Array<{ role: string; content: string }> }>();

				// Add user message to history
				await chatSession.fetch(new Request('http://internal/message', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ role: 'user', content: message })
				}));

				// Prepare messages for AI with system prompt
				const aiMessages = [
					{
						role: 'system',
						content: 'You are a helpful, friendly, and knowledgeable AI assistant. Provide clear, concise, and accurate responses. Be conversational and engaging.'
					},
					...messages,
					{ role: 'user', content: message }
				];

				// Call Workers AI with Llama 3.3
				const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
					messages: aiMessages,
					stream: false,
					max_tokens: 512
				}) as { response: string };

				const assistantMessage = aiResponse.response || 'I apologize, but I encountered an error generating a response.';

				// Save assistant response to history
				await chatSession.fetch(new Request('http://internal/message', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ role: 'assistant', content: assistantMessage })
				}));

				return new Response(JSON.stringify({
					response: assistantMessage,
					sessionId
				}), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});

			} catch (error) {
				console.error('Chat error:', error);
				return new Response(JSON.stringify({
					error: 'Failed to process chat message',
					details: error instanceof Error ? error.message : 'Unknown error'
				}), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		// API: Clear chat history
		if (url.pathname === '/api/clear' && request.method === 'POST') {
			try {
				const { sessionId } = await request.json<{ sessionId: string }>();
				
				if (!sessionId) {
					return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
						status: 400,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' }
					});
				}

				const id = env.CHAT_SESSIONS.idFromName(sessionId);
				const chatSession = env.CHAT_SESSIONS.get(id);
				await chatSession.fetch(new Request('http://internal/clear', { method: 'POST' }));

				return new Response(JSON.stringify({ success: true }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: 'Failed to clear chat' }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		// API: Get chat history
		if (url.pathname === '/api/history' && request.method === 'GET') {
			try {
				const sessionId = url.searchParams.get('sessionId');
				
				if (!sessionId) {
					return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
						status: 400,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' }
					});
				}

				const id = env.CHAT_SESSIONS.idFromName(sessionId);
				const chatSession = env.CHAT_SESSIONS.get(id);
				const historyResponse = await chatSession.fetch(new Request('http://internal/history'));
				const history = await historyResponse.json();

				return new Response(JSON.stringify(history), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: 'Failed to get history' }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
