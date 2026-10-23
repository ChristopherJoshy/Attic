// Orito AI Chat Assistant
(function() {
    // Config state
    const config = {
        apiKey: 'YOUR_MISTRAL_API_KEY',
        model: 'open-mistral-7b',
    };

    // Chat session history
    let messages = [];

    // DOM Elements
    let DOM = {};

    function initDOM() {
        DOM = {
            widget: document.getElementById('oritoWidget'),
            closedBox: document.getElementById('oritoClosedBox'),
            openBox: document.getElementById('oritoOpenBox'),
            btnStartChat: document.getElementById('btnStartChat'),
            btnCloseToggle: document.getElementById('oritoCloseToggle'),
            chatArea: document.getElementById('oritoChatArea'),
            chatInput: document.getElementById('oritoChatInput'),
            btnSendMsg: document.getElementById('btnSendOritoMsg'),
            btnClearChat: document.getElementById('btnClearOritoChat')
        };
    }

    // Initial load
    window.addEventListener('DOMContentLoaded', () => {
        initDOM();
        attachEvents();
        resetChatHistory();
        if (window.lucide) {
            window.lucide.createIcons();
        }
    });

    // Reset Chat to initial greetings
    function resetChatHistory() {
        messages = [];
        if (DOM.chatArea) {
            DOM.chatArea.innerHTML = '';
            
            // Add initial welcome messages (Friendly and professional)
            appendMessage('orito', "Hello! I'm Orito, your personal guide for Mount Enterprise. How can I assist you with your office supplies or cleaning chemicals query today? 😊");
            appendMessage('orito', "Feel free to ask me to find specific products, compare safety specs, check wholesale rates, or recommend dispensers!");
        }
    }

    // Attach Event Listeners
    function attachEvents() {
        if (!DOM.closedBox) return;

        // Open chat window on clicking anywhere on the closed Orito card
        DOM.closedBox.addEventListener('click', () => {
            DOM.closedBox.style.display = 'none';
            DOM.openBox.style.display = 'flex';
            scrollChatToBottom();
        });

        // Close chat window (without wiping history)
        if (DOM.btnCloseToggle) {
            DOM.btnCloseToggle.addEventListener('click', () => {
                DOM.openBox.style.display = 'none';
                DOM.closedBox.style.display = 'flex';
            });
        }

        // Send message handlers
        DOM.btnSendMsg.addEventListener('click', handleUserSendMessage);
        DOM.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleUserSendMessage();
            }
        });

        // Clear Chat History
        if (DOM.btnClearChat) {
            DOM.btnClearChat.addEventListener('click', () => {
                if (confirm("Clear all messages? Orito will forget everything immediately.")) {
                    resetChatHistory();
                }
            });
        }

        // Close when clicking outside of Orito Widget wrapper (without wiping history)
        document.addEventListener('click', (e) => {
            if (DOM.openBox && DOM.openBox.style.display === 'flex') {
                if (!DOM.widget.contains(e.target) && e.target !== DOM.btnStartChat) {
                    DOM.openBox.style.display = 'none';
                    DOM.closedBox.style.display = 'flex';
                }
            }
        });
    }

    // Append message bubble to UI
    function appendMessage(sender, text) {
        const msgRow = document.createElement('div');
        msgRow.className = `orito-msg-row ${sender}`;
        
        // Thumbnail avatar
        const avatarCol = document.createElement('div');
        avatarCol.className = 'orito-msg-avatar';
        const avatarImg = document.createElement('img');
        avatarImg.src = sender === 'user' 
            ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100' // General user avatar
            : '/assets/images/Chat-window.svg';
        avatarImg.alt = sender === 'user' ? 'User' : 'Orito';
        avatarCol.appendChild(avatarImg);
        
        const bubble = document.createElement('div');
        bubble.className = 'orito-bubble';
        
        if (sender === 'user') {
            bubble.textContent = text;
        } else {
            // Render markdown details link syntax: [Product Name](detail:productId)
            bubble.innerHTML = formatMarkdown(text);
            
            // Bind click events on dynamic product links
            bubble.querySelectorAll('.product-nav-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    const id = link.dataset.id;
                    if (window.openProductModalById) {
                        window.openProductModalById(id);
                    }
                });
            });
        }
        
        msgRow.appendChild(avatarCol);
        msgRow.appendChild(bubble);
        DOM.chatArea.appendChild(msgRow);
        scrollChatToBottom();
    }

    // Scroll chat to bottom
    function scrollChatToBottom() {
        if (DOM.chatArea) {
            setTimeout(() => {
                DOM.chatArea.scrollTo({
                    top: DOM.chatArea.scrollHeight,
                    behavior: 'smooth'
                });
            }, 50);
        }
    }

    // Basic markdown and custom product link formatting
    function formatMarkdown(text) {
        // Safe escape HTML characters first to avoid HTML injection
        let safeText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
            
        // 1. Process custom detail links: [Product Name](detail:productId)
        const linkRegex = /\[([^\]]+)\]\(detail:([a-zA-Z0-9_-]+)\)/g;
        safeText = safeText.replace(linkRegex, '<a class="product-nav-link" data-id="$2" title="Click to view details">$1</a>');

        // 2. Bold tags: **text**
        safeText = safeText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // 3. Newlines to br
        safeText = safeText.replace(/\n/g, '<br>');

        return safeText;
    }

    // Retrieve matching catalog products (Client-Side RAG)
    function retrieveRelevantProducts(query) {
        if (!window.state || !window.state.products) {
            return [];
        }
        const cleanQuery = query.toLowerCase().trim();
        if (!cleanQuery) return [];
        
        const stopWords = new Set(['and', 'the', 'for', 'please', 'show', 'need', 'want', 'what', 'is', 'are', 'about', 'how', 'much', 'price', 'details', 'of', 'you', 'give', 'me', 'with']);
        const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
        
        if (queryWords.length === 0) {
            queryWords.push(cleanQuery);
        }
        
        const scored = window.state.products.map(p => {
            let score = 0;
            const name = p.name.toLowerCase();
            const cat = p.category.toLowerCase();
            const brand = p.brand.toLowerCase();
            const desc = p.description.toLowerCase();
            
            queryWords.forEach(word => {
                if (name.includes(word)) score += 5;
                if (cat.includes(word)) score += 4;
                if (brand.includes(word)) score += 4;
                if (desc.includes(word)) score += 1;
                
                if (name === word) score += 12;
                if (cat === word) score += 8;
            });
            
            return { product: p, score };
        });
        
        return scored
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
            .map(item => item.product);
    }

    // Retrieve active category list
    function getCategoriesSummary() {
        if (!window.state || !window.state.categories) {
            return "No categories loaded.";
        }
        return Object.keys(window.state.categories)
            .map(cat => `- ${cat} (${window.state.categories[cat]} products)`)
            .join('\n');
    }

    // Handle send messages
    async function handleUserSendMessage() {
        const text = DOM.chatInput.value.trim();
        if (!text) return;
        
        // 1. Check API Key configuration
        if (!config.apiKey || config.apiKey === 'YOUR_API_KEY_HERE') {
            appendMessage('user', text);
            DOM.chatInput.value = '';
            appendMessage('orito', "System: Mistral API key is not configured in 'dist/orito.js'. Please open the file and paste your key.");
            return;
        }
        
        // 2. Render user message
        appendMessage('user', text);
        DOM.chatInput.value = '';
        
        // 3. Render typing indicator
        const typingRow = document.createElement('div');
        typingRow.className = 'orito-msg-row orito typing-indicator-row';
        typingRow.innerHTML = `
            <div class="orito-msg-avatar">
                <img src="/assets/images/Chat-window.svg" alt="Orito">
            </div>
            <div class="orito-bubble">
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            </div>
        `;
        DOM.chatArea.appendChild(typingRow);
        scrollChatToBottom();
        
        // 4. Client-side Retrieval (RAG)
        const matchedProds = retrieveRelevantProducts(text);
        let ragContext = '';
        if (matchedProds.length > 0) {
            ragContext = `[CATALOG SEARCH RESULTS - Recommend these using [Product Name](detail:productId) markdown syntax]:\n`;
            matchedProds.forEach(p => {
                ragContext += `- [${p.name}](detail:${p.id}) | Category: ${p.category} | Brand: ${p.brand} | Catalogue Page Ref: Page ${p.page}\n  Specs: ${JSON.stringify(p.specs)}\n  Description: ${p.description}\n`;
            });
        } else {
            ragContext = `[GENERAL CATALOG CONTEXT]:\nAvailable Categories:\n${getCategoriesSummary()}\n`;
        }

        // Add user query to messaging history
        messages.push({ role: 'user', content: text });
        
        // Limit context message list length to save tokens
        const recentMessages = messages.slice(-8);

        // Greatest System Prompt for Orito
        const systemPrompt = `You are Orito, a purchase assistant for Mount Enterprise (Ahmedabad, Gujarat). You guide corporate purchase managers and clients to find office supplies, cleaning consumables, restrooms automation, and safety PPE from the catalogue.

YOUR PERSONALITY & STYLE:
- You are extremely welcoming, polite, helpful, and professional.
- Keep your responses brief, informative, and direct. Do not write generic marketing paragraphs or AI boilerplate.
- Address clients as corporate purchase managers or representatives.

YOUR CONSTRAINTS (CRITICAL):
- You ONLY answer questions related to Mount Enterprise, office stationery, files, hygiene tissue rolls, bathroom dispensers, Diversey Taski chemicals, safety protection wear (PPE), and industrial packaging.
- If a client asks about ANY unrelated topic (e.g. writing code, general knowledge, sports, other companies), you MUST politely but firmly decline to answer (e.g., "I am here to assist with Mount Enterprise product catalog and corporate supply queries. Please let me know how I can help you with office or hygiene supplies."). Do not break character.
- Do not make up product details. Only use facts in the provided context or ask them to contact the sales desk.

HOW TO RECOMMEND PRODUCTS:
- When recommending a product, ALWAYS provide a link in this format: [Product Name](detail:productId). For example: "I suggest the [Stainless Steel Soap Dispenser](detail:page_3_img_2_xref_1333) which fits restroom automation."
- When you output links in this format, the website will render them as clickable buttons that open the product specification modal.
- Provide the catalog page reference whenever relevant.

MOUNT ENTERPRISE COMPANY INFO:
- Address: Sahara Complex, Near Navjivan Hotel, Sanand Chokdi, Sarkhej, Ahmedabad - 382110, Gujarat.
- Contacts: +91 9649364022, +91 7802053467.
- WhatsApp Desk: +91 7802053467.
- Email: Mountenterprise26@gmail.com`;

        // Build Mistral request body
        const apiMessages = [
            { role: 'system', content: systemPrompt }
        ];
        
        apiMessages.push({ role: 'user', content: `[CONTEXT DATA]\n${ragContext}\n[END CONTEXT DATA]\nPlease answer my next query using the facts above.` });
        apiMessages.push({ role: 'assistant', content: `Understood. I will help the user find corporate office and hygiene supplies based strictly on the catalog details.` });
        
        recentMessages.forEach(msg => apiMessages.push(msg));
        
        try {
            const apiResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: apiMessages,
                    temperature: 0.15,
                    max_tokens: 350
                })
            });
            
            const indicator = DOM.chatArea.querySelector('.typing-indicator-row');
            if (indicator) indicator.remove();
            
            if (!apiResponse.ok) {
                const errData = await apiResponse.json().catch(() => ({}));
                throw new Error(errData.message || `Mistral HTTP error: ${apiResponse.status}`);
            }
            
            const data = await apiResponse.json();
            const reply = data.choices[0].message.content;
            
            messages.push({ role: 'assistant', content: reply });
            appendMessage('orito', reply);
            
        } catch (err) {
            const indicator = DOM.chatArea.querySelector('.typing-indicator-row');
            if (indicator) indicator.remove();
            
            console.error('Orito AI fetch error:', err);
            appendMessage('orito', `System Error: Failed to communicate with Mistral AI. Please verify your API key and network connection. (Details: ${err.message})`);
        }
    }

})();
