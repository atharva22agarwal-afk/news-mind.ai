
        // --- AUTH & STATE ---
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName') || 'Guest';
        if (!userId) window.location.href = 'login.html';

        document.getElementById('user-name-display').innerText = userName;
        document.getElementById('user-avatar').innerText = userName.charAt(0).toUpperCase();

        const socket = io();

        // --- UI UTILS ---
        function switchMode(mode) {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            if (mode === 'compare') {
                document.querySelectorAll('.mode-btn')[0].classList.add('active');
                document.getElementById('compare-mode').style.display = 'block';
                document.getElementById('summary-mode').style.display = 'none';
            } else {
                document.querySelectorAll('.mode-btn')[1].classList.add('active');
                document.getElementById('compare-mode').style.display = 'none';
                document.getElementById('summary-mode').style.display = 'block';
            }
        }

        function toggleLogoutMenu() { document.getElementById('logout-menu').classList.toggle('active'); }
        function handleLogout() { localStorage.clear(); window.location.href = 'login.html'; }

        function showLoading(msg) {
            const output = document.getElementById('intel-display');
            const report = document.getElementById('report-content');
            output.style.display = 'block';
            document.getElementById('intel-status').innerText = 'STATUS: ACQUIRING...';
            report.innerHTML = `<div style="text-align:center; padding:60px; color:var(--primary-orange);"><i class="ph ph-spinner ph-spin" style="font-size:2.5rem;"></i><br><br>${msg}</div>`;
        }

        // --- FEED LOGIC (REAL-TIME) ---
        async function loadFeed() {
            try {
                const res = await fetch(API.getPublicFeed);
                const data = await res.json();
                if (data.success) {
                    const stream = document.getElementById('feed-stream');
                    stream.innerHTML = '';
                    data.data.forEach(p => addPostToUI(p));
                }
            } catch (e) { }
        }

        function addPostToUI(post, isNew = false) {
            const stream = document.getElementById('feed-stream');
            const div = document.createElement('div');
            div.className = 'tweet-card';
            const time = new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            div.innerHTML = `
                <div class="tweet-meta">
                    <span class="tweet-author">@${post.authorName || 'anonymous'}</span>
                    <span>${time}</span>
                </div>
                <div class="tweet-content">${post.content}</div>
                <div class="tweet-actions">
                    <i class="ph ph-heart"></i>
                    <i class="ph ph-arrow-square-out" onclick="runOnInput('${post.content.replace(/'/g, "\\'")}')" title="Analyze this content"></i>
                </div>
            `;
            if (isNew) stream.prepend(div); else stream.appendChild(div);
        }

        async function postToFeed() {
            const input = document.getElementById('feedInput');
            const content = input.value.trim();
            if (!content) return;

            try {
                const res = await fetch(API.postToFeed, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content, authorName: userName, authorId: userId })
                });
                const data = await res.json();
                if (data.success) {
                    socket.emit('new-public-post', data.data);
                    input.value = '';
                }
            } catch (e) { }
        }

        socket.on('public-post-broadcast', (post) => {
            addPostToUI(post, true);
        });

        // --- UI UTILS & NAVIGATION ---
        function resetDashboard() {
            window.location.reload();
        }

        async function loadHistory() {
            try {
                const res = await fetch(`${API.getSummaries}?userId=${userId}&limit=10`);
                const data = await res.json();
                if (data.success) {
                    const container = document.getElementById('history-container');
                    container.innerHTML = '';
                    data.data.summaries.forEach(s => {
                        const div = document.createElement('div');
                        div.className = 'history-item';
                        div.innerHTML = `
                            <i class="ph ph-file-text" style="font-size:1.2rem;"></i>
                            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.85rem;">${s.title}</div>
                        `;
                        div.onclick = () => {
                            document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
                            div.classList.add('active');
                            displayReport(s);
                        };
                        container.appendChild(div);
                    });
                }
            } catch (e) { }
        }

        function displayReport(data) {
            const output = document.getElementById('intel-display');
            const report = document.getElementById('report-content');
            output.style.display = 'block';
            document.getElementById('inputSection').style.display = 'none';
            document.getElementById('intel-status').innerText = 'STATUS: RETRIEVED';

            const summaryId = data.id || (data.data && data.data.id) || null;
            
            // Extract content string safely
            let contentStr = '';
            if (typeof data === 'string') {
                contentStr = data;
            } else {
                const raw = data.summary || data.content || (data.data && (data.data.summary || data.data.content)) || data.comparison || '';
                contentStr = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
            }

            report.innerHTML = `
                ${marked.parse(contentStr || 'No content available.')}
                ${summaryId ? `
                <div style="margin-top:30px; display:flex; gap:15px; border-top:1px solid #eee; padding-top:20px;">
                    <button onclick="startDebate('${summaryId}')" class="btn-new" style="background:var(--primary-orange); padding:8px 20px; font-size:0.85rem;">
                        <i class="ph-bold ph-chats"></i> Launch Private Debate Room
                    </button>
                </div>
                ` : ''}
            `;
        }

        async function startDebate(id) {
            if (!id || id === 'undefined') return alert("Requires an active intelligence report ID.");

            showLoading("Initializing Secure Debate Room...");

            try {
                const res = await fetch(API.createDebate, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ summaryId: id, userId, userName })
                });
                const data = await res.json();
                if (data.success) {
                    // Important: currentDebateId MUST be the Firestore ID for API consistency
                    currentDebateId = data.data.id; 
                    
                    // Update UI state
                    document.getElementById('intel-status').innerText = 'STATUS: DEBATE ACTIVE';
                    switchFeedTab('analysis');
                    refreshAnalysis();
                    
                    // Post invitation to the public feed
                    const invitation = `🚨 DEBATE OPEN: "${data.data.topic}". Join the forensics in the War Room! [ID: ${data.data.roomId}]`;
                    document.getElementById('feedInput').value = invitation;
                    postToFeed();
                    
                    console.log(`Debate Room Active: ${currentDebateId}`);
                } else {
                    alert("Failed to create debate: " + data.message);
                    document.getElementById('intel-status').innerText = 'STATUS: ERROR';
                }
            } catch (e) {
                console.error("Debate Start Error:", e);
                alert("Debate logic error: " + e.message);
            }
        }

        let currentDebateId = null;

        async function runWarRoomAnalysis() {
            const u1 = document.getElementById('urlA').value;
            const u2 = document.getElementById('urlB').value;
            if (!u1 || !u2) return alert("Both targets required.");

            showLoading("Analyzing Targets...");
            const btn = document.getElementById('analyze-btn');
            if(btn) btn.disabled = true;

            try {
                const res = await fetch(API.toolsCompare, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url1: u1, url2: u2 })
                });
                const data = await res.json();
                if (data.success) {
                    displayReport(data.data);
                } else {
                    document.getElementById('report-content').innerHTML = "Analysis failed: " + data.message;
                    document.getElementById('intel-status').innerText = 'STATUS: ERROR';
                }
            } catch (e) { alert("Analysis failed: " + e.message); }
            if(btn) btn.disabled = false;
        }

        async function runSummary() {
            const input = document.getElementById('textInput').value.trim();
            if (!input) return;

            const isUrl = input.startsWith('http');
            showLoading("Synthesizing Intelligence...");
            const btn = document.getElementById('summary-btn');
            if(btn) btn.disabled = true;

            try {
                const res = await fetch(isUrl ? API.summarizeURL : API.summarizeText, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [isUrl ? 'url' : 'text']: input, userId })
                });

                const data = await res.json();
                if (data.success) {
                    displayReport(data.data);
                    loadHistory();
                } else {
                    document.getElementById('report-content').innerHTML = "Probe failed: " + data.message;
                    document.getElementById('intel-status').innerText = 'STATUS: ERROR';
                }
            } catch (e) {
                alert("Probe failed: " + e.message);
            }
            if(btn) btn.disabled = false;
        }

        function insertTemplate(type) {
            const templates = {
                debate: "🚨 STRATEGIC DEBATE INITIATED: ",
                factcheck: "🛡️ FACT CHECK REQUIRED: "
            };
            document.getElementById('feedInput').value = templates[type] || '';
        }

        function pushToMain() {
            const val = document.getElementById('feedInput').value;
            if(!val) return;
            switchMode('summary');
            document.getElementById('textInput').value = val;
        }

        function runOnInput(val) {
            switchMode('summary');
            document.getElementById('textInput').value = val;
            runSummary();
        }

        function switchFeedTab(tab) {
            const tabs = document.querySelectorAll('.feed-tab');
            if(tabs.length < 2) return;
            tabs.forEach(t => t.classList.remove('active'));
            
            if(tab === 'feed') {
                tabs[0].classList.add('active');
                document.getElementById('feed-panel').style.display = 'flex';
                document.getElementById('analysis-panel').style.display = 'none';
            } else {
                tabs[1].classList.add('active');
                document.getElementById('feed-panel').style.display = 'none';
                document.getElementById('analysis-panel').style.display = 'block';
            }
        }
        
        async function refreshAnalysis() {
            if(!currentDebateId) return;
            const container = document.getElementById('analysis-content');
            container.innerHTML = `<div style="text-align:center; padding:40px;"><i class="ph ph-spinner ph-spin" style="font-size:2rem; color:var(--primary-orange);"></i></div>`;
            
            try {
                const res = await fetch(`${API.getDebates}?roomId=${currentDebateId}`);
                const data = await res.json();
                if(data.success && data.data.length > 0) {
                    const room = data.data[0];
                    container.innerHTML = `
                        <div class="analysis-section">
                            <div class="section-title">Topic</div>
                            <div style="font-size:0.9rem; font-weight:600;">${room.topic}</div>
                        </div>
                        <div class="analysis-section">
                            <div class="section-title">Status</div>
                            <div style="font-size:0.85rem; color:#666;">Debate ID: ${currentDebateId}</div>
                        </div>
                    `;
                } else {
                    container.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">Analysis ready for real-time monitoring.</div>`;
                }
            } catch (e) {
                 container.innerHTML = `<div style="color:red; padding:20px;">Failed to refresh analysis.</div>`;
            }
        }

        window.onload = () => {
            loadFeed();
            loadHistory();
        };
    