// client.js (Socket.IO + WebRTC)
const socket = io({ transports: ['websocket'] });
const messagesEl = document.getElementById('messages');
const usersEl = document.getElementById('users');
const form = document.getElementById('form');
const input = document.getElementById('input');
const typingEl = document.getElementById('typing');
const meEl = document.getElementById('me');

const btnStart = document.getElementById('btnStart');
const btnHangup = document.getElementById('btnHangup');
const btnMute = document.getElementById('btnMute');
const btnCam = document.getElementById('btnCam');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Username modal
const modal = document.getElementById('username-modal');
const usernameForm = document.getElementById('username-form');
const usernameInput = document.getElementById('username');

let me = { username: null, id: null };
let typingTimeout = null;

// --- WebRTC state ---
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let pc = null;
let localStream = null;

usernameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = usernameInput.value.trim();
  if (!name) return;
  socket.emit('join', name);
});

socket.on('joined', (payload) => {
  me = payload;
  meEl.textContent = `You are ${me.username}`;
  modal.classList.add('hidden');
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  socket.emit('message', { text });
  addMessage({ text, from: me.username, timestamp: Date.now() }, true);
  input.value = '';
  setTyping(false);
});

input.addEventListener('input', () => {
  setTyping(true);
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTyping(false), 1000);
});

function setTyping(isTyping) {
  socket.emit('typing', isTyping);
}

socket.on('message', (msg) => {
  if (msg.from === me.username) return;
  addMessage(msg, false);
});

socket.on('system', (text) => {
  const li = document.createElement('li');
  li.className = 'system';
  li.textContent = text;
  messagesEl.appendChild(li);
  scrollToBottom();
});

socket.on('typing', ({ from, isTyping }) => {
  typingEl.textContent = isTyping ? `${from} is typing…` : '';
});

socket.on('users', (list) => {
  usersEl.innerHTML = '';
  list.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u;
    if (u === me.username) li.classList.add('me');
    usersEl.appendChild(li);
  });
});

function addMessage(msg, isMe = false) {
  const li = document.createElement('li');
  if (isMe) li.classList.add('me');

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${msg.from} • ${new Date(msg.timestamp).toLocaleTimeString()}`;
  li.appendChild(meta);

  const text = document.createElement('div');
  text.textContent = msg.text;
  li.appendChild(text);

  messagesEl.appendChild(li);
  scrollToBottom();
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- Video Call Controls ---
btnStart.addEventListener('click', async () => {
  btnStart.disabled = true;
  try {
    await ensureLocalStream();
    await startCallAsCaller();
    btnHangup.disabled = false;
    btnMute.disabled = false;
    btnCam.disabled = false;
  } catch (err) {
    console.error(err);
    alert('Failed to start call: ' + err.message);
    btnStart.disabled = false;
  }
});

btnHangup.addEventListener('click', () => {
  endCall();
  socket.emit('webrtc-end');
});

btnMute.addEventListener('click', () => {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  btnMute.textContent = track.enabled ? 'Mute' : 'Unmute';
});

btnCam.addEventListener('click', () => {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  btnCam.textContent = track.enabled ? 'Camera Off' : 'Camera On';
});

async function ensureLocalStream() {
  if (localStream) return localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    return localStream;
  } catch (err) {
    console.error("Failed to access camera/mic:", err);
    alert("Please allow access to camera and microphone.");
  }
}


function createPeer() {
  pc = new RTCPeerConnection(rtcConfig);

  pc.ontrack = (event) => {
    if (!remoteVideo.srcObject) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit('webrtc-candidate', candidate);
  };

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

async function startCallAsCaller() {
  await ensureLocalStream();
  createPeer();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('webrtc-offer', offer);
}

async function startCallAsCallee(offer) {
  await ensureLocalStream();
  createPeer();
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('webrtc-answer', answer);
  btnHangup.disabled = false;
  btnMute.disabled = false;
  btnCam.disabled = false;
  btnStart.disabled = true;
}

function endCall() {
  if (pc) {
    pc.getSenders().forEach(s => { try { s.track && s.track.stop(); } catch (e) {} });
    pc.onicecandidate = null;
    pc.ontrack = null;
    try { pc.close(); } catch (e) {}
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  btnHangup.disabled = true;
  btnMute.disabled = true;
  btnCam.disabled = true;
  btnStart.disabled = false;
  btnMute.textContent = 'Mute';
  btnCam.textContent = 'Camera Off';
}

// --- Signaling handlers ---
socket.on('webrtc-offer', async ({ from, offer }) => {
  if (pc) return; // already in a call
  try {
    await startCallAsCallee(offer);
  } catch (e) {
    console.error('Error handling offer', e);
  }
});

socket.on('webrtc-answer', async ({ from, answer }) => {
  if (!pc) return;
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (e) {
    console.error('Error setting remote description', e);
  }
});

socket.on('webrtc-candidate', async ({ from, candidate }) => {
  if (!pc) return;
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('Error adding ICE candidate', e);
  }
});

socket.on('webrtc-end', () => {
  endCall();
});

// Helpful tips in console
console.log('%cWebSocket + WebRTC Chat', 'font-weight:bold');
console.log('Open this page on two devices (on the same LAN) and press Start Call.');
