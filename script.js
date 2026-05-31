// --- LOGIN & DYNAMIC USERNAME LOGIC ---
const loginOverlay = document.getElementById('login-overlay');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const appContainer = document.getElementById('app-container');

const loginUsernameInput = document.getElementById('login-username');
const displayUsername = document.getElementById('display-username');
const userAvatar = document.getElementById('user-avatar');

loginSubmitBtn.addEventListener('click', () => {
    const inputName = loginUsernameInput.value.trim();
    
    if (inputName === "") {
        alert("Please enter a username to proceed.");
        return;
    }

    displayUsername.innerText = inputName;
    userAvatar.innerText = inputName.charAt(0).toUpperCase();

    loginOverlay.style.opacity = '0';
    setTimeout(() => {
        loginOverlay.classList.add('hidden');
        appContainer.classList.remove('hidden');
    }, 400);
});

// --- LAG-PROOF MICRO-SESSION SPEECH ENGINE ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    alert("Your browser does not support Speech Recognition. Please try using Google Chrome.");
} else {
    const recognition = new SpeechRecognition();
    
    // FIX: Set continuous to false. This forces Chrome to process small, fast chunks 
    // of speech instantly instead of clogging up the browser's memory buffer.
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

    let lastTimestamp = 0;
    let selectedText = "";
    let selectionStart = 0;
    let selectionEnd = 0;

    // BASELINE SYSTEM MEMORY
    let liveStringCache = "";       
    let userClickedStop = true;    // Starts as true until record is clicked

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

        // Apply automatic punctuation pacing dynamically
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

        // Combine cached text, newly finalized phrase block, and live interim words
        let compiledFinal = liveStringCache + (currentChunkFinalized ? punctuation + currentChunkFinalized.trim() : '');
        textOutput.value = compiledFinal + (currentChunkInterim ? ' ' + currentChunkInterim.trim() : '');
        
        // Auto-scroll screen window down
        textOutput.scrollTop = textOutput.scrollHeight;

        if (currentChunkFinalized) {
            lastTimestamp = Date.now();
            // Instantly sync our baseline cache memory so it doesn't get lost
            liveStringCache = compiledFinal; 
        }
    };

    // FIX: THE SEAMLESS RE-LOOP CYCLE
    // Because continuous is false, Chrome naturally finishes the session when you pause slightly.
    // We catch that instant and loop it right back to life before any lag can form!
    recognition.onend = () => {
        if (!userClickedStop) {
            // Save current screen data to safety cache and hot-swap the mic back on
            liveStringCache = textOutput.value;
            recognition.start();
        } else {
            // Only run clean closures if user manually hits 'Stop Engine'
            if (textOutput.value.trim() && !textOutput.value.trim().endsWith('।')) {
                textOutput.value += '।';
            }
            statusMsg.innerText = "Engine Idle";
            statusMsg.style.borderColor = "#334155";
            statusMsg.style.color = "#94a3b8";
            resetButtonStates();
        }
    };

    // Keep errors from breaking our hot-swap cycle loop
    recognition.onerror = (event) => {
        if (event.error === 'no-speech') return;
        if (event.error === 'aborted') return;
        console.log("Engine recovered from parameter block:", event.error);
    };

    function resetButtonStates() {
        recordBtn.disabled = false;
        recordBtn.classList.remove('recording');
        recordBtn.innerText = "🎤 Start Recording";
        stopBtn.disabled = true;
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
            liveStringCache = updatedText; // Keep base synced
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