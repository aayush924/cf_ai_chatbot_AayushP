// Cloudflare Pages + Realtime Voice Chat Application
// Uses WebSockets for real-time communication and Workers AI Whisper for transcription

const WORKER_URL = window.location.hostname === 'localhost' 
	? 'http://localhost:8787'
	: 'https://cf-ai-app.YOUR-SUBDOMAIN.workers.dev'; // Update this with your Worker URL

// Generate or retrieve session ID
let sessionId = localStorage.getItem('chatSessionId');
if (!sessionId) {
	sessionId = 'session-' + Math.random().toString(36).substring(2, 15);
	localStorage.setItem('chatSessionId', sessionId);
}

// DOM elements
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');
const voiceStatus = document.getElementById('voiceStatus');
const clearBtn = document.getElementById('clearBtn');
const connectionStatus = document.getElementById('connectionStatus');
const statusText = document.getElementById('statusText');
const statusDot = connectionStatus.querySelector('.status-dot');

// WebSocket connection
let ws = null;
let isConnected = false;

// Voice recording
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// Initialize WebSocket connection for realtime updates
function connectWebSocket() {
	try {
		const wsUrl = WORKER_URL.replace('http://', 'ws://').replace('https://', 'wss://');
		ws = new WebSocket(`${wsUrl}/ws?sessionId=${sessionId}`);
		
		ws.onopen = () => {
			console.log('WebSocket connected');
			isConnected = true;
			statusText.textContent = 'Connected';
			statusDot.classList.add('connected');
			statusDot.classList.remove('error');
		};
		
		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			console.log('WebSocket message:', data);
			
			// Note: We don't add messages via WebSocket because they're already
			// added directly via API responses to avoid duplicates
			if (data.type === 'transcription') {
				// Voice transcription complete
				messageInput.value = data.text;
			} else if (data.type === 'error') {
				console.error('Server error:', data.message);
				alert('Error: ' + data.message);
			}
		};
		
		ws.onerror = (error) => {
			console.error('WebSocket error:', error);
			statusText.textContent = 'Connection error';
			statusDot.classList.add('error');
			statusDot.classList.remove('connected');
		};
		
		ws.onclose = () => {
			console.log('WebSocket closed');
			isConnected = false;
			statusText.textContent = 'Disconnected';
			statusDot.classList.remove('connected');
			statusDot.classList.remove('error');
			
			// Reconnect after 3 seconds
			setTimeout(connectWebSocket, 3000);
		};
	} catch (error) {
		console.error('Failed to connect WebSocket:', error);
		// Fall back to HTTP-only mode
		statusText.textContent = 'HTTP mode (WebSocket unavailable)';
	}
}

// Load chat history on page load
async function loadHistory() {
	try {
		const response = await fetch(`${WORKER_URL}/api/history?sessionId=${sessionId}`);
		const data = await response.json();
		
		if (data.messages && data.messages.length > 0) {
			messagesDiv.innerHTML = '';
			data.messages.forEach(msg => {
				if (msg.role !== 'system') {
					addMessage(msg.content, msg.role === 'user' ? 'user' : 'assistant', false);
				}
			});
		}
	} catch (error) {
		console.error('Failed to load history:', error);
	}
}

// Send message (text or voice)
async function sendMessage() {
	const message = messageInput.value.trim();
	if (!message) return;

	// Disable input while processing
	messageInput.disabled = true;
	sendBtn.disabled = true;

	// Clear welcome message if present
	const welcome = messagesDiv.querySelector('.welcome-message');
	if (welcome) {
		welcome.remove();
	}

	// Add user message to UI
	addMessage(message, 'user');
	messageInput.value = '';

	// Show typing indicator
	const typingId = addTypingIndicator();

	try {
		const response = await fetch(`${WORKER_URL}/api/chat`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				message,
				sessionId
			})
		});

		const data = await response.json();

		// Remove typing indicator
		removeTypingIndicator(typingId);

		if (data.response) {
			addMessage(data.response, 'assistant');
		} else if (data.error) {
			addMessage('Sorry, I encountered an error: ' + data.error, 'assistant');
		}
	} catch (error) {
		removeTypingIndicator(typingId);
		addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
		console.error('Error:', error);
	}

	// Re-enable input
	messageInput.disabled = false;
	sendBtn.disabled = false;
	messageInput.focus();
}

// Voice recording with Cloudflare Realtime + Whisper
async function toggleVoiceInput() {
	if (isRecording) {
		stopRecording();
	} else {
		startRecording();
	}
}

async function startRecording() {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ 
			audio: {
				channelCount: 1,
				sampleRate: 16000,
				echoCancellation: true,
				noiseSuppression: true
			}
		});

		// Use MediaRecorder to capture audio
		mediaRecorder = new MediaRecorder(stream, {
			mimeType: 'audio/webm;codecs=opus'
		});

		audioChunks = [];

		mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				audioChunks.push(event.data);
			}
		};

		mediaRecorder.onstop = async () => {
			// Send audio to Worker for Whisper transcription
			const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
			await transcribeAudio(audioBlob);

			// Stop all tracks
			stream.getTracks().forEach(track => track.stop());
		};

		mediaRecorder.start();
		isRecording = true;
		voiceBtn.classList.add('recording');
		messageInput.classList.add('recording');
		voiceStatus.classList.add('active');
		voiceBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>';

		console.log('Recording started');
	} catch (error) {
		console.error('Failed to start recording:', error);
		alert('Microphone access denied or not available. Please check your browser permissions.');
	}
}

function stopRecording() {
	if (mediaRecorder && mediaRecorder.state !== 'inactive') {
		mediaRecorder.stop();
		isRecording = false;
		voiceBtn.classList.remove('recording');
		messageInput.classList.remove('recording');
		voiceStatus.classList.remove('active');
		voiceBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>';

		console.log('Recording stopped');
	}
}

// Send audio to Cloudflare Worker for Whisper transcription
async function transcribeAudio(audioBlob) {
	try {
		// Show transcribing status
		messageInput.placeholder = 'Transcribing...';
		voiceBtn.disabled = true;

		// Convert webm to format suitable for Whisper
		const formData = new FormData();
		formData.append('audio', audioBlob, 'recording.webm');
		formData.append('sessionId', sessionId);

		const response = await fetch(`${WORKER_URL}/api/transcribe`, {
			method: 'POST',
			body: formData
		});

		const data = await response.json();

		if (data.text) {
			// Set transcribed text in input
			messageInput.value = data.text;
			messageInput.placeholder = 'Type or speak your message...';
		} else if (data.error) {
			console.error('Transcription error:', data.error);
			alert('Transcription failed: ' + data.error);
		}
	} catch (error) {
		console.error('Failed to transcribe:', error);
		alert('Failed to transcribe audio. Please try again.');
	} finally {
		messageInput.placeholder = 'Type or speak your message...';
		voiceBtn.disabled = false;
	}
}

// UI helper functions
function addMessage(text, role, scroll = true) {
	const messageDiv = document.createElement('div');
	messageDiv.className = `message ${role}`;
	
	const avatar = document.createElement('div');
	avatar.className = 'avatar';
	avatar.textContent = role === 'user' ? '👤' : '🤖';
	
	const bubble = document.createElement('div');
	bubble.className = 'bubble';
	bubble.textContent = text;
	
	messageDiv.appendChild(avatar);
	messageDiv.appendChild(bubble);
	messagesDiv.appendChild(messageDiv);

	if (scroll) {
		messagesDiv.scrollTop = messagesDiv.scrollHeight;
	}
}

function addTypingIndicator() {
	const messageDiv = document.createElement('div');
	messageDiv.className = 'message assistant';
	messageDiv.id = 'typing-' + Date.now();
	
	const avatar = document.createElement('div');
	avatar.className = 'avatar';
	avatar.textContent = '🤖';
	
	const bubble = document.createElement('div');
	bubble.className = 'bubble';
	
	const typing = document.createElement('div');
	typing.className = 'typing-indicator';
	typing.innerHTML = '<span></span><span></span><span></span>';
	
	bubble.appendChild(typing);
	messageDiv.appendChild(avatar);
	messageDiv.appendChild(bubble);
	messagesDiv.appendChild(messageDiv);
	messagesDiv.scrollTop = messagesDiv.scrollHeight;
	
	return messageDiv.id;
}

function removeTypingIndicator(id) {
	const indicator = document.getElementById(id);
	if (indicator) {
		indicator.remove();
	}
}

async function clearChat() {
	if (!confirm('Are you sure you want to clear the chat history?')) {
		return;
	}

	try {
		await fetch(`${WORKER_URL}/api/clear`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ sessionId })
		});

		messagesDiv.innerHTML = `
			<div class="welcome-message">
				<h2>Welcome! 👋</h2>
				<p>Ask me anything by typing or using voice input</p>
				<p class="tech-info">Powered by Cloudflare Workers AI</p>
			</div>
		`;
	} catch (error) {
		console.error('Failed to clear chat:', error);
		alert('Failed to clear chat. Please try again.');
	}
}

// Event listeners
sendBtn.addEventListener('click', sendMessage);
voiceBtn.addEventListener('click', toggleVoiceInput);
clearBtn.addEventListener('click', clearChat);

messageInput.addEventListener('keypress', (e) => {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

// Initialize
connectWebSocket();
loadHistory();

