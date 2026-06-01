// --- LOGIN & DYNAMIC USERNAME LOGIC ---
const loginOverlay = document.getElementById('login-overlay');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const appContainer = document.getElementById('app-container');

const loginUsernameInput = document.getElementById('login-username');
const displayUsername = document.getElementById('display-username');
const userAvatar = document.getElementById('user-avatar');

// --- DEVICE BASED LOCALSTORAGE CHAT SESSION STORAGE CONFIG ---
let chatSessions = JSON.parse(localStorage.getItem('stt_sessions')) || [];
let activeSessionId = localStorage.getItem('stt_active_session_id') || null;

loginSubmitBtn.addEventListener('click', () => {
    const inputName = loginUsernameInput.value.trim();
    
    if (inputName === "") {
        alert("Please enter a username to proceed.");
        return;
    }

    // Save login profile state locally
    localStorage.setItem('stt_username', inputName);
    initializeWorkspace(inputName);
});

// Check if username already exists on this device
window.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('stt_username');
    if (savedName) {
        initializeWorkspace(savedName);
    }
});

function initializeWorkspace(username) {
    displayUsername.innerText = username;
    userAvatar.innerText = username.charAt(0).toUpperCase();

    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');

    // Load up history panel logs
    renderSessionsList();
    
    if (activeSessionId) {
        loadSession(activeSessionId);
    } else if (chatSessions.length > 0) {
        loadSession(chatSessions[0].id);
    } else {
        createNewSession();
    }
}

// --- SPEECH DETECTOR SYSTEMS SETUP ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    alert("Your browser does not support Speech Recognition. Please try using Google Chrome.");
} else {
    const recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = true; 
    recognition.lang = 'bn-BD';

    const editorRecognition = new SpeechRecognition();
    editorRecognition.continuous = false;
    editorRecognition.interimResults = false;
    editorRecognition.lang = 'bn-BD';

    const recordBtn = document.getElementById('record-btn');
    const stopBtn = document.getElementById('stop-btn');
    const saveBtn = document.getElementById('save-btn');
    const textOutput = document.getElementById('text-output');
    const statusMsg = document.getElementById('status');
    const customMenu = document.getElementById('custom-menu');
    const editWordOption = document.getElementById('edit-word-option');
    const newSessionBtn = document.getElementById('new-session-btn');
    const sessionsListContainer = document.getElementById('sessions-list');

    let lastTimestamp = 0;
    let selectedText = "";
    let selectionStart = 0;
    let selectionEnd = 0;
    let liveStringCache = "";       
    let userClickedStop = true;

    // Save text area into current active local layout session automatically as user dictates or edits
    textOutput.addEventListener('input', () => {
        updateActiveSessionText(textOutput.value);
    });

    recordBtn.addEventListener('click', () => {
        userClickedStop = false;
        lastTimestamp = Date.now();
        liveStringCache = textOutput.value; 
        recognition.start();
    });

    stopBtn.addEventListener('click', () => {
        userClickedStop = true;
        recognition.stop();
    });

    recognition.onstart = () => {
        recordBtn.disabled = true;
        recordBtn.classList.add('recording');
        recordBtn.innerText = "🔴 Listening Live...";
        stopBtn.disabled = false;
        statusMsg.innerText = "Engine Active";
        statusMsg.style.borderColor = "#10b981";
        statusMsg.style.color = "#10b981";
    };

    recognition.onresult = (event) => {
        const currentTime = Date.now();
        let currentChunkFinalized = '';
        let currentChunkInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptChunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                currentChunkFinalized += transcriptChunk;
            } else {
                currentChunkInterim += transcriptChunk;
            }
        }

        let punctuation = '';
        if (liveStringCache.length > 0 && currentChunkFinalized.length > 0) {
            const pauseDuration = currentTime - lastTimestamp;
            if (liveStringCache.endsWith('।') || liveStringCache.endsWith('। ')) {
                punctuation = ' ';
            } else if (pauseDuration > 3000) {
                punctuation = '। '; 
            } else if (pauseDuration > 1200) {
                punctuation = ', '; 
            } else {
                punctuation = ' '; 
            }
        }

        let compiledFinal = liveStringCache + (currentChunkFinalized ? punctuation + currentChunkFinalized.trim() : '');
        textOutput.value = compiledFinal + (currentChunkInterim ? ' ' + currentChunkInterim.trim() : '');
        
        textOutput.scrollTop = textOutput.scrollHeight;

        if (currentChunkFinalized) {
            lastTimestamp = Date.now();
            liveStringCache = compiledFinal; 
            updateActiveSessionText(compiledFinal);
        }
    };

    recognition.onend = () => {
        if (!userClickedStop) {
            liveStringCache = textOutput.value;
            recognition.start();
        } else {
            if (textOutput.value.trim() && !textOutput.value.trim().endsWith('।')) {
                textOutput.value += '।';
            }
            statusMsg.innerText = "Engine Idle";
            statusMsg.style.borderColor = "#334155";
            statusMsg.style.color = "#94a3b8";
            resetButtonStates();
            updateActiveSessionText(textOutput.value);
        }
    };

    recognition.onerror = (event) => {
        if (event.error === 'no-speech') return;
        if (event.error === 'aborted') return;
        console.log("Engine recovered:", event.error);
    };

    function resetButtonStates() {
        recordBtn.disabled = false;
        recordBtn.classList.remove('recording');
        recordBtn.innerText = "🎤 Start Recording";
        stopBtn.disabled = true;
    }

    // --- DEVICE BASED SESSION STORAGE SYSTEMS ---
    newSessionBtn.addEventListener('click', () => {
        if (!userClickedStop) {
            alert("Please stop recording before creating a new session.");
            return;
        }
        createNewSession();
    });

    function createNewSession() {
        const id = 'session_' + Date.now();
        const newSession = {
            id: id,
            title: "New Transcription",
            text: "",
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };

        chatSessions.unshift(newSession);
        activeSessionId = id;
        saveSessionsToDevice();
        
        renderSessionsList();
        loadSession(id);
    }

    function loadSession(id) {
        const session = chatSessions.find(s => s.id === id);
        if (!session) return;

        activeSessionId = id;
        localStorage.setItem('stt_active_session_id', id);
        
        textOutput.value = session.text;
        liveStringCache = session.text;
        
        // Highlight active layout element 
        document.querySelectorAll('.session-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id === id) item.classList.add('active');
        });
    }

    function updateActiveSessionText(text) {
        const session = chatSessions.find(s => s.id === activeSessionId);
        if (!session) return;

        session.text = text;

        // Auto-update title based on first few spoken words
        if (text.trim() !== "") {
            const cleanText = text.replace(/[।,,]/g, '').trim();
            const words = cleanText.split(/\s+/);
            session.title = words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '');
        } else {
            session.title = "New Transcription";
        }

        saveSessionsToDevice();
        
        // Quietly update layout parameters without breaking input focus
        const activeItem = document.querySelector(`.session-item[data-id="${activeSessionId}"] .session-title`);
        if (activeItem) activeItem.innerText = session.title;
    }

    function deleteSession(id, event) {
        event.stopPropagation(); // Avoid triggering loading event selection link
        
        chatSessions = chatSessions.filter(s => s.id !== id);
        saveSessionsToDevice();
        
        if (activeSessionId === id) {
            activeSessionId = chatSessions.length > 0 ? chatSessions[0].id : null;
            localStorage.setItem('stt_active_session_id', activeSessionId);
        }

        renderSessionsList();

        if (activeSessionId) {
            loadSession(activeSessionId);
        } else {
            createNewSession();
        }
    }

    function saveSessionsToDevice() {
        localStorage.setItem('stt_sessions', JSON.stringify(chatSessions));
    }

    function renderSessionsList() {
        sessionsListContainer.innerHTML = '';
        
        chatSessions.forEach(session => {
            const item = document.createElement('div');
            item.className = `session-item ${session.id === activeSessionId ? 'active' : ''}`;
            item.dataset.id = session.id;
            
            item.innerHTML = `
                <div class="session-info">
                    <span class="session-title">${session.title}</span>
                    <span class="session-date">${session.date}</span>
                </div>
                <button class="delete-session-btn" title="Delete Session">🗑</button>
            `;
            
            item.addEventListener('click', () => loadSession(session.id));
            item.querySelector('.delete-session-btn').addEventListener('click', (e) => deleteSession(session.id, e));
            
            sessionsListContainer.appendChild(item);
        });
    }

    // --- SELECTION EDIT FUNCTIONALITY ---
    textOutput.addEventListener('contextmenu', (e) => {
        selectionStart = textOutput.selectionStart;
        selectionEnd = textOutput.selectionEnd;
        selectedText = textOutput.value.substring(selectionStart, selectionEnd).trim();

        if (selectedText.length > 0) {
            e.preventDefault(); 
            customMenu.style.left = `${e.pageX}px`;
            customMenu.style.top = `${e.pageY}px`;
            customMenu.style.display = 'block';
        }
    });

    document.addEventListener('click', () => {
        customMenu.style.display = 'none';
    });

    editWordOption.addEventListener('click', () => {
        statusMsg.innerText = "Processing Patch...";
        editorRecognition.start();
    });

    editorRecognition.onstart = () => {
        statusMsg.innerText = `Say patch word...`;
    };

    editorRecognition.onresult = (event) => {
        const newWord = event.results[0][0].transcript.trim();
        if (newWord) {
            const fullText = textOutput.value;
            const updatedText = fullText.substring(0, selectionStart) + newWord + fullText.substring(selectionEnd);
            textOutput.value = updatedText;
            liveStringCache = updatedText; 
            updateActiveSessionText(updatedText);
            statusMsg.innerText = "Patch Appended";
        }
    };

    editorRecognition.onerror = () => {
        statusMsg.innerText = "Patch Error";
    };

    // --- SAVE TEXT TO MICROSOFT WORD FILE (.DOC) WITH BREAKS ---
    saveBtn.addEventListener('click', () => {
        const rawText = textOutput.value;
        if (!rawText.trim()) {
            alert("There is no text to save!");
            return;
        }

        const paragraphs = rawText.split('\n');
        let htmlBodyContent = '';
        
        paragraphs.forEach(para => {
            if(para.trim() !== '') {
                htmlBodyContent += `<p style="font-family: 'Arial', sans-serif; font-size: 14pt; line-height: 1.5; margin-bottom: 12pt;">${para.trim()}</p>`;
            } else {
                htmlBodyContent += `<p><br></p>`;
            }
        });

        const wordDocumentTemplate = 
            `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>Exported Transcript</title>
                </head>
            <body style="padding:20px;">
                ${htmlBodyContent}
            </body>
            </html>`;

        const blob = new Blob(['\ufeff' + wordDocumentTemplate], {
            type: 'application/msword;charset=utf-8'
        });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Bengali_Transcript.doc"; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        statusMsg.innerText = "Word Document Exported";
    });
}
