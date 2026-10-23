const catppuccin = {
    base: '#1e1e2e',
    mantle: '#181825',
    crust: '#11111b',
    surface0: '#313244',
    surface1: '#45475a',
    surface2: '#585b70',
    overlay0: '#6c7086',
    text: '#cdd6f4',
    subtext0: '#a6adc8',
    subtext1: '#bac2de',
    lavender: '#b4befe',
    blue: '#89b4fa',
    sapphire: '#74c7ec',
    sky: '#89dceb',
    teal: '#94e2d5',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    peach: '#fab387',
    red: '#f38ba8',
    maroon: '#eba0ac',
    mauve: '#cba6f7',
    pink: '#f5c2e7',
    flamingo: '#f2cdcd',
    rosewater: '#f5e0dc'
};

// Format model name for display
function formatModelName(model) {
    if (!model) return '--';
    
    if (model === 'exact_match') {
        return 'Exact Match';
    }
    
    if (model.startsWith('llm:')) {
        const llmName = model.replace('llm:', '').toLowerCase();
        if (llmName.includes('gpt-oss-120b') || llmName.includes('gpt-oss')) return 'AI (GPT-120B)';
        if (llmName.includes('gpt-4')) return 'AI (GPT-4)';
        if (llmName.includes('gpt-3')) return 'AI (GPT-3.5)';
        if (llmName.includes('llama-3.3')) return 'AI (Llama 3.3)';
        if (llmName.includes('llama')) return 'AI (Llama)';
        if (llmName.includes('mixtral')) return 'AI (Mixtral)';
        if (llmName.includes('gemma')) return 'AI (Gemma)';
        if (llmName.includes('kimi')) return 'AI (Kimi)';
        if (llmName.includes('claude')) return 'AI (Claude)';
        return 'AI';
    }
    
    if (model.startsWith('fallback:')) {
        const fallbackType = model.replace('fallback:', '');
        switch (fallbackType) {
            case 'embedding': return 'Semantic';
            case 'hybrid': return 'Hybrid';
            case 'heuristic': return 'Heuristic';
            case 'fast': return 'Fast';
            default: return 'Fallback';
        }
    }
    
    return model;
}

let ws = null;
let network = null;
let nodes = null;
let edges = null;
let pathData = [];
let isRunning = false;
let fitTimeout = null;
let lastFitTime = 0;
let imageCache = {};
let physicsRunning = true;
let isFullscreen = false;
let resizeObserver = null;
let pendingNodeUpdates = [];
let isProcessingNodes = false;
let runCompleted = false;

const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const startTopicInput = document.getElementById('start-topic');
const targetTopicInput = document.getElementById('target-topic');
const maxStepsInput = document.getElementById('max-steps');
const useApiInput = document.getElementById('use-api');
const statusBadge = document.getElementById('status-badge');
const modelBadge = document.getElementById('model-badge');
const stepCounter = document.getElementById('step-counter');
const breadcrumb = document.getElementById('breadcrumb');
const previewContent = document.getElementById('preview-content');
const runLog = document.getElementById('run-log');
const graphContainer = document.getElementById('graph');
let graphWrapper = null; // Will be set in DOMContentLoaded

// Fullscreen functionality
function toggleFullscreen() {
    const container = graphWrapper;
    
    if (!isFullscreen) {
        // Enter fullscreen
        container.classList.add('fullscreen');
        document.body.style.overflow = 'hidden';
        isFullscreen = true;
        
        // Update button
        const btn = document.getElementById('fullscreen-btn');
        if (btn) {
            btn.innerHTML = '<span class="btn-icon">✕</span><span class="btn-text">Exit</span>';
            btn.title = 'Exit fullscreen (Esc)';
        }
        
        // Resize network immediately
        if (network) {
            network.redraw();
            network.fit({ animation: false });
        }
    } else {
        exitFullscreen();
    }
}

function exitFullscreen() {
    if (!isFullscreen) return;
    
    const container = graphWrapper;
    container.classList.remove('fullscreen');
    document.body.style.overflow = '';
    isFullscreen = false;
    
    // Update button
    const btn = document.getElementById('fullscreen-btn');
    if (btn) {
        btn.innerHTML = '<span class="btn-icon">⛶</span><span class="btn-text">Fullscreen</span>';
        btn.title = 'Enter fullscreen (F)';
    }
    
    // Resize network immediately
    if (network) {
        network.redraw();
        network.fit({ animation: false });
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to exit fullscreen
    if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
    }
    // F to toggle fullscreen (when not typing in input)
    if (e.key === 'f' || e.key === 'F') {
        const activeEl = document.activeElement;
        if (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA') {
            e.preventDefault();
            toggleFullscreen();
        }
    }
    // R to reset view
    if ((e.key === 'r' || e.key === 'R') && network) {
        const activeEl = document.activeElement;
        if (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA') {
            e.preventDefault();
            network.fit({ animation: false });
        }
    }
});

function updateModelBadge(model) {
    if (!modelBadge) return;
    
    const displayName = formatModelName(model);
    modelBadge.textContent = displayName;
    
    // Remove all model classes
    modelBadge.classList.remove('llm', 'fallback', 'exact');
    
    // Add appropriate class based on model type
    if (model === 'exact_match') {
        modelBadge.classList.add('exact');
    } else if (model && model.startsWith('llm:')) {
        modelBadge.classList.add('llm');
    } else if (model && model.startsWith('fallback:')) {
        modelBadge.classList.add('fallback');
    }
}

function resetModelBadge() {
    if (!modelBadge) return;
    modelBadge.textContent = '--';
    modelBadge.classList.remove('llm', 'fallback', 'exact');
}

function initGraph() {
    nodes = new vis.DataSet([]);
    edges = new vis.DataSet([]);

    const options = {
        nodes: {
            shape: 'circularImage',
            size: 50,
            font: {
                size: 13,
                color: catppuccin.text,
                face: 'Inter, Segoe UI, sans-serif',
                align: 'center',
                vadjust: 36,
                strokeWidth: 3,
                strokeColor: catppuccin.crust
            },
            borderWidth: 4,
            borderWidthSelected: 5,
            color: {
                border: catppuccin.lavender,
                background: catppuccin.surface0,
                highlight: {
                    border: catppuccin.mauve,
                    background: catppuccin.surface1
                },
                hover: {
                    border: catppuccin.pink,
                    background: catppuccin.surface1
                }
            },
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.4)',
                size: 12,
                x: 3,
                y: 3
            },
            chosen: {
                node: function(values, id, selected, hovering) {
                    if (selected) {
                        values.shadow = true;
                        values.shadowColor = catppuccin.mauve + '60';
                        values.shadowSize = 20;
                    }
                }
            }
        },
        edges: {
            width: 3,
            color: {
                color: catppuccin.surface2,
                highlight: catppuccin.lavender,
                hover: catppuccin.mauve,
                opacity: 0.9
            },
            arrows: {
                to: {
                    enabled: true,
                    scaleFactor: 0.9,
                    type: 'arrow'
                }
            },
            smooth: {
                enabled: true,
                type: 'dynamic',
                roundness: 0.5
            },
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.2)',
                size: 5,
                x: 2,
                y: 2
            },
            selectionWidth: 2,
            hoverWidth: 1.5
        },
        physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
                theta: 0.5,
                gravitationalConstant: -80,
                centralGravity: 0.01,
                springLength: 150,
                springConstant: 0.08,
                damping: 0.4,
                avoidOverlap: 0.8
            },
            maxVelocity: 50,
            minVelocity: 0.1,
            stabilization: {
                enabled: true,
                iterations: 100,
                fit: true,
                updateInterval: 25
            },
            timestep: 0.35,
            adaptiveTimestep: true
        },
        interaction: {
            hover: true,
            hoverConnectedEdges: true,
            tooltipDelay: 100,
            zoomView: true,
            dragView: true,
            zoomSpeed: 0.3,
            keyboard: {
                enabled: true,
                speed: { x: 10, y: 10, zoom: 0.02 },
                bindToWindow: false
            },
            navigationButtons: false,
            multiselect: false
        },
        layout: {
            randomSeed: 42,
            improvedLayout: true,
            hierarchical: false
        }
    };

    network = new vis.Network(graphContainer, { nodes, edges }, options);

    // Handle window resize
    resizeObserver = new ResizeObserver(() => {
        if (network) {
            network.redraw();
        }
    });
    resizeObserver.observe(graphContainer);

    // Smooth transition after stabilization
    network.on('stabilizationIterationsDone', function() {
        network.setOptions({
            physics: {
                enabled: true,
                forceAtlas2Based: {
                    gravitationalConstant: -30,
                    centralGravity: 0.005,
                    springConstant: 0.05,
                    damping: 0.9
                },
                maxVelocity: 20,
                minVelocity: 0.05
            }
        });
        physicsRunning = false;
        
        // Instant fit after stabilization
        network.fit({ animation: false });
    });

    // Pause physics during drag for smooth experience
    network.on('dragStart', function(params) {
        if (params.nodes.length > 0) {
            network.setOptions({ physics: { enabled: false } });
        }
    });

    network.on('dragEnd', function(params) {
        if (params.nodes.length > 0) {
            // Fix the dragged node position
            const nodeId = params.nodes[0];
            const positions = network.getPositions([nodeId]);
            if (positions[nodeId]) {
                nodes.update({
                    id: nodeId,
                    x: positions[nodeId].x,
                    y: positions[nodeId].y,
                    fixed: { x: true, y: true }
                });
            }
        }
        
        // Re-enable gentle physics
        setTimeout(() => {
            network.setOptions({
                physics: {
                    enabled: true,
                    forceAtlas2Based: {
                        gravitationalConstant: -25,
                        centralGravity: 0.003,
                        springConstant: 0.03,
                        damping: 0.95
                    },
                    maxVelocity: 10
                }
            });
        }, 100);
    });

    // Click to show preview
    network.on('click', function(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            showNodePreview(nodeId);
            
            // Highlight the path to this node
            highlightPathToNode(nodeId);
        } else {
            // Clicked on empty space - reset highlighting
            resetHighlighting();
        }
    });
    
    // Double-click to focus on node
    network.on('doubleClick', function(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            network.focus(nodeId, {
                scale: 1.8,
                animation: false
            });
        } else {
            // Double-click on empty space to fit all
            network.fit({ animation: false });
        }
    });

    // Zoom event handling for smooth experience
    network.on('zoom', function(params) {
        // Prevent extreme zoom levels
        if (params.scale < 0.1) {
            network.moveTo({ scale: 0.1 });
        } else if (params.scale > 3) {
            network.moveTo({ scale: 3 });
        }
    });
}

// Highlight the path from start to the selected node
function highlightPathToNode(nodeId) {
    const allNodes = nodes.get();
    const allEdges = edges.get();
    
    // Build path from node 1 to nodeId
    const pathNodeIds = [];
    for (let i = 1; i <= nodeId; i++) {
        pathNodeIds.push(i);
    }
    
    // Update node styles
    allNodes.forEach(node => {
        const isInPath = pathNodeIds.includes(node.id);
        nodes.update({
            id: node.id,
            opacity: isInPath ? 1 : 0.3
        });
    });
    
    // Update edge styles
    allEdges.forEach(edge => {
        const isInPath = pathNodeIds.includes(edge.from) && pathNodeIds.includes(edge.to);
        edges.update({
            id: edge.id,
            color: {
                color: isInPath ? catppuccin.mauve : catppuccin.surface1,
                opacity: isInPath ? 1 : 0.2
            },
            width: isInPath ? 4 : 2
        });
    });
}

// Reset all highlighting
function resetHighlighting() {
    const allNodes = nodes.get();
    const allEdges = edges.get();
    
    allNodes.forEach(node => {
        nodes.update({
            id: node.id,
            opacity: 1
        });
    });
    
    allEdges.forEach(edge => {
        edges.update({
            id: edge.id,
            color: {
                color: catppuccin.mauve,
                opacity: 0.9
            },
            width: 3
        });
    });
}

function getDefaultImage() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${catppuccin.surface1};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${catppuccin.surface0};stop-opacity:1" />
            </linearGradient>
            <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${catppuccin.mauve};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${catppuccin.lavender};stop-opacity:1" />
            </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#bgGrad)" stroke="${catppuccin.surface2}" stroke-width="2"/>
        <text x="50" y="62" text-anchor="middle" font-size="42" font-weight="bold" fill="url(#textGrad)" font-family="Inter, sans-serif">W</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function getStartNodeImage() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <defs>
            <linearGradient id="startGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${catppuccin.sapphire};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${catppuccin.blue};stop-opacity:1" />
            </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="${catppuccin.surface1}" stroke="url(#startGrad)" stroke-width="4"/>
        <text x="50" y="62" text-anchor="middle" font-size="38" fill="${catppuccin.sapphire}" font-family="Inter, sans-serif">▶</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function getTargetNodeImage() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <defs>
            <linearGradient id="targetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${catppuccin.green};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${catppuccin.teal};stop-opacity:1" />
            </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="${catppuccin.surface1}" stroke="url(#targetGrad)" stroke-width="4"/>
        <text x="50" y="62" text-anchor="middle" font-size="38" fill="${catppuccin.green}" font-family="Inter, sans-serif">🎯</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function throttledFit(duration = 0) {
    const now = Date.now();
    const minInterval = 500;
    
    if (now - lastFitTime < minInterval) {
        if (fitTimeout) clearTimeout(fitTimeout);
        fitTimeout = setTimeout(() => {
            lastFitTime = Date.now();
            if (network) {
                network.fit({ animation: false });
            }
        }, minInterval - (now - lastFitTime));
    } else {
        lastFitTime = now;
        if (network) {
            network.fit({ animation: false });
        }
    }
}

function preloadImage(url, callback) {
    if (!url || url.startsWith('data:')) {
        callback();
        return;
    }
    if (imageCache[url]) {
        callback();
        return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        imageCache[url] = true;
        callback();
    };
    img.onerror = () => {
        // On error, still call callback but mark as failed
        imageCache[url] = false;
        callback();
    };
    img.src = url;
}

// Process node updates in batches to prevent overwhelming the graph
function processNodeQueue() {
    if (isProcessingNodes || pendingNodeUpdates.length === 0) return;
    
    isProcessingNodes = true;
    const update = pendingNodeUpdates.shift();
    
    requestAnimationFrame(() => {
        update();
        isProcessingNodes = false;
        
        // Process next in queue after a small delay
        if (pendingNodeUpdates.length > 0) {
            setTimeout(processNodeQueue, 50);
        }
    });
}

function addNode(nodeData, isStart = false, isTarget = false, isCachedBatch = false) {
    // Check if node already exists
    if (nodes.get(nodeData.step)) return;

    let image = getDefaultImage();
    let borderColor = catppuccin.lavender;
    let bgColor = catppuccin.surface0;

    if (isStart) {
        image = nodeData.thumbnail || getStartNodeImage();
        borderColor = catppuccin.sapphire;
        bgColor = catppuccin.surface1;
    } else if (isTarget) {
        image = nodeData.thumbnail || getTargetNodeImage();
        borderColor = catppuccin.green;
        bgColor = catppuccin.surface1;
    } else if (nodeData.thumbnail) {
        image = nodeData.thumbnail;
        borderColor = catppuccin.peach;
    }

    const truncatedTitle = nodeData.title.length > 20 
        ? nodeData.title.substring(0, 18) + '…' 
        : nodeData.title;

    const addNodeToGraph = () => {
        // Calculate position based on previous node for a nice flowing layout
        let x, y;
        
        if (nodeData.step === 1) {
            // Start node at center
            x = 0;
            y = 0;
        } else {
            const prevPositions = network.getPositions([nodeData.step - 1]);
            if (prevPositions[nodeData.step - 1]) {
                // Create a flowing rightward path with some variation
                const prevX = prevPositions[nodeData.step - 1].x;
                const prevY = prevPositions[nodeData.step - 1].y;
                const angle = (Math.random() - 0.5) * Math.PI * 0.4; // -36 to 36 degrees
                const distance = 180 + Math.random() * 60;
                x = prevX + distance * Math.cos(angle);
                y = prevY + distance * Math.sin(angle);
            } else {
                // Fallback: position based on step number
                x = nodeData.step * 180;
                y = (Math.random() - 0.5) * 100;
            }
        }

        // Add the node
        nodes.add({
            id: nodeData.step,
            label: truncatedTitle,
            title: `${nodeData.title}\nStep ${nodeData.step}${nodeData.snippet ? '\n\n' + nodeData.snippet.substring(0, 100) + '...' : ''}`,
            image: image,
            x: x,
            y: y,
            color: {
                border: borderColor,
                background: bgColor,
                highlight: {
                    border: catppuccin.mauve,
                    background: catppuccin.surface1
                },
                hover: {
                    border: catppuccin.pink,
                    background: catppuccin.surface1
                }
            },
            data: nodeData,
            physics: true,
            fixed: false
        });

        // Add edge from previous node
        if (nodeData.step > 1) {
            edges.add({
                id: `edge-${nodeData.step - 1}-${nodeData.step}`,
                from: nodeData.step - 1,
                to: nodeData.step,
                color: {
                    color: catppuccin.mauve,
                    highlight: catppuccin.lavender,
                    hover: catppuccin.pink
                },
                width: 3
            });
        }

        // Focus on new node immediately (unless batch)
        if (!isCachedBatch) {
            if (network && nodes.get(nodeData.step)) {
                network.focus(nodeData.step, {
                    scale: Math.max(0.6, 1.0 - (nodeData.step * 0.03)),
                    animation: false
                });
            }
        }
    };

    // Preload image then add node
    preloadImage(image, () => {
        if (isCachedBatch) {
            // For cached batches, add immediately without queue
            addNodeToGraph();
        } else {
            // Queue the node addition for smooth rendering
            pendingNodeUpdates.push(addNodeToGraph);
            processNodeQueue();
        }
    });
}

function showNodePreview(nodeId) {
    const node = nodes.get(nodeId);
    if (!node || !node.data) return;

    const data = node.data;
    let html = '';

    if (data.thumbnail) {
        html += `<img src="${data.thumbnail}" alt="${data.title}" class="preview-thumbnail" onerror="this.style.display='none'">`;
    }

    html += `<div class="preview-title">${data.title}</div>`;
    html += `<div class="preview-step">Step ${data.step}</div>`;
    html += `<div class="preview-url"><a href="${data.url}" target="_blank">Open on Wikipedia</a></div>`;

    if (data.snippet) {
        html += `<div class="preview-snippet">${data.snippet}</div>`;
    }

    previewContent.innerHTML = html;
}

function updateBreadcrumb(path) {
    breadcrumb.innerHTML = '';

    path.forEach((node, index) => {
        const item = document.createElement('span');
        item.className = 'breadcrumb-item';

        const nodeSpan = document.createElement('span');
        nodeSpan.className = 'breadcrumb-node';
        if (index === path.length - 1) {
            nodeSpan.classList.add('current');
        }
        nodeSpan.textContent = node.title;
        nodeSpan.onclick = () => {
            showNodePreview(node.step);
            network.selectNodes([node.step]);
            network.focus(node.step, {
                scale: 1.5,
                animation: false
            });
        };

        item.appendChild(nodeSpan);

        if (index < path.length - 1) {
            const arrow = document.createElement('span');
            arrow.className = 'breadcrumb-arrow';
            arrow.textContent = '→';
            item.appendChild(arrow);
        }

        breadcrumb.appendChild(item);
    });
}

function addLogEntry(message, type = 'status') {
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message ${type}">${message}</span>
    `;

    runLog.insertBefore(entry, runLog.firstChild);

    while (runLog.children.length > 100) {
        runLog.removeChild(runLog.lastChild);
    }
}

function setStatus(status, message) {
    statusBadge.textContent = message;
    statusBadge.className = 'status-badge';

    if (status === 'running') {
        statusBadge.classList.add('running');
    } else if (status === 'success') {
        statusBadge.classList.add('success');
    } else if (status === 'error') {
        statusBadge.classList.add('error');
    }
}

function updateStepCounter(current, max) {
    stepCounter.textContent = `Step: ${current}/${max}`;
}

function resetUI() {
    // Clear data structures
    if (nodes) nodes.clear();
    if (edges) edges.clear();
    breadcrumb.innerHTML = '';
    runLog.innerHTML = '';
    previewContent.innerHTML = '<p class="placeholder-text">Click a node to see page details</p>';
    pathData = [];
    imageCache = {};
    pendingNodeUpdates = [];
    isProcessingNodes = false;
    runCompleted = false;
    updateStepCounter(0, maxStepsInput.value);
    setStatus('ready', 'Ready');
    resetModelBadge();

    if (fitTimeout) {
        clearTimeout(fitTimeout);
        fitTimeout = null;
    }

    // Reset physics for smooth new run
    physicsRunning = true;
    if (network) {
        network.setOptions({
            physics: {
                enabled: true,
                solver: 'forceAtlas2Based',
                forceAtlas2Based: {
                    theta: 0.5,
                    gravitationalConstant: -80,
                    centralGravity: 0.01,
                    springLength: 150,
                    springConstant: 0.08,
                    damping: 0.4,
                    avoidOverlap: 0.8
                },
                maxVelocity: 50,
                minVelocity: 0.1,
                stabilization: {
                    enabled: true,
                    iterations: 100,
                    fit: true
                }
            }
        });
    }
}

async function startRun() {
    const startTopic = startTopicInput.value.trim();
    const targetTopic = targetTopicInput.value.trim();
    const maxSteps = parseInt(maxStepsInput.value) || 50;

    if (!startTopic || !targetTopic) {
        alert('Please enter both start and target topics.');
        return;
    }

    resetUI();
    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;

    // Wake up the server first (Render free tier sleeps after inactivity)
    setStatus('running', 'Waking up server...');
    addLogEntry('Connecting to server (may take ~30s if sleeping)...', 'status');
    
    try {
        const wakeUpUrl = CONFIG.getApiUrl('/health');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for cold start
        
        await fetch(wakeUpUrl, { 
            method: 'GET',
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
    } catch (e) {
        // Server might not have /health endpoint, continue anyway
        console.log('Wake-up ping completed or timed out');
    }

    connectWebSocket(startTopic, targetTopic, maxSteps, 0);
}

function connectWebSocket(startTopic, targetTopic, maxSteps, retryCount) {
    const maxRetries = 3;
    const wsUrl = CONFIG.getWebSocketUrl();
    
    if (retryCount > 0) {
        addLogEntry(`Retry attempt ${retryCount}/${maxRetries}...`, 'status');
    }
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        setStatus('running', 'Connected!');
        addLogEntry('Connected to server', 'status');

        ws.send(JSON.stringify({
            start_topic: startTopic,
            target_topic: targetTopic,
            max_steps: maxSteps,
            use_api: useApiInput.checked
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        
        if (retryCount < maxRetries && isRunning) {
            // Retry after a delay
            const delay = (retryCount + 1) * 2000; // 2s, 4s, 6s
            setStatus('running', `Connection failed, retrying in ${delay/1000}s...`);
            setTimeout(() => {
                if (isRunning) {
                    connectWebSocket(startTopic, targetTopic, maxSteps, retryCount + 1);
                }
            }, delay);
        } else {
            addLogEntry('Connection error - server may be unavailable', 'error');
            setStatus('error', 'Connection Failed');
            stopRun();
        }
    };

    ws.onclose = (event) => {
        if (runCompleted) {
            // Run completed successfully, just clean up
            addLogEntry('Connection closed', 'status');
            stopRun();
        } else if (isRunning && !event.wasClean && retryCount < maxRetries) {
            // Unexpected close, try to reconnect
            const delay = (retryCount + 1) * 2000;
            setTimeout(() => {
                if (isRunning && !runCompleted) {
                    connectWebSocket(startTopic, targetTopic, maxSteps, retryCount + 1);
                }
            }, delay);
        } else if (isRunning) {
            addLogEntry('Connection closed', 'status');
            stopRun();
        }
    };
}

function handleMessage(data) {
    const maxSteps = parseInt(maxStepsInput.value) || 50;

    switch (data.type) {
        case 'status':
            setStatus('running', data.message);
            addLogEntry(data.message, 'status');
            break;

        case 'node':
            const node = data.node;
            pathData = data.path;

            const isStart = node.step === 1;
            const isCachedBatch = data.is_cached_batch === true;
            addNode(node, isStart, false, isCachedBatch);
            updateBreadcrumb(pathData);
            updateStepCounter(node.step, maxSteps);
            showNodePreview(node.step);

            addLogEntry(`📍 Arrived at: ${node.title}`, 'status');

            // Smooth animation for cached batches - fit all after last batch item
            if (isCachedBatch && data.batch_position === data.batch_total) {
                if (network) {
                    network.fit({ animation: false });
                }
            }
            break;

        case 'move':
            const modelInfo = formatModelName(data.model);
            updateModelBadge(data.model);
            addLogEntry(`🔗 Moving: ${data.from_title} → ${data.to_title} [${modelInfo}]`, 'move');
            // Show AI reasoning if available
            if (data.reasoning) {
                addLogEntry(`💭 ${data.reasoning}`, 'reasoning');
            }
            break;

        case 'complete':
            runCompleted = true;
            const timeStr = data.total_time ? ` in ${Math.round(data.total_time)}s` : '';
            
            // Update pathData from the complete message if provided
            if (data.path && data.path.length > 0) {
                pathData = data.path;
                updateBreadcrumb(pathData);
                updateStepCounter(data.total_steps, maxSteps);
            }
            
            if (data.success) {
                setStatus('success', 'Target Reached!');
                addLogEntry(`🎉 Success! Reached target in ${data.total_steps} steps${timeStr}.`, 'success');

                // Highlight the final node with success colors
                if (pathData.length > 0) {
                    const lastNodeId = pathData.length;
                    const lastNode = nodes.get(lastNodeId);
                    if (lastNode) {
                        nodes.update({
                            id: lastNodeId,
                            color: {
                                background: catppuccin.green,
                                border: catppuccin.teal,
                                highlight: {
                                    background: catppuccin.green,
                                    border: catppuccin.teal
                                }
                            },
                            borderWidth: 5,
                            shadow: {
                                enabled: true,
                                color: catppuccin.green + '60',
                                size: 25
                            }
                        });
                        
                        // Focus on the final node instantly
                        if (network) {
                            network.focus(lastNodeId, {
                                scale: 1.2,
                                animation: false
                            });
                        }
                    }
                }
            } else {
                setStatus('error', 'Target Not Reached');
                addLogEntry(`❌ ${data.message} (${data.total_steps} steps${timeStr}).`, 'error');
                
                // Highlight the last node to show where the run ended
                if (pathData.length > 0) {
                    const lastNodeId = pathData.length;
                    const lastNode = nodes.get(lastNodeId);
                    if (lastNode) {
                        nodes.update({
                            id: lastNodeId,
                            color: {
                                background: catppuccin.peach,
                                border: catppuccin.maroon,
                                highlight: {
                                    background: catppuccin.peach,
                                    border: catppuccin.maroon
                                }
                            },
                            borderWidth: 5
                        });
                        
                        // Focus on the final node
                        if (network) {
                            network.focus(lastNodeId, {
                                scale: 1.2,
                                animation: false
                            });
                        }
                    }
                }
            }
            
            // Disable physics after completion for stable viewing
            setTimeout(() => {
                if (network) {
                    network.setOptions({ physics: { enabled: false } });
                }
            }, 1000);
            
            stopRun();
            break;

        case 'error':
            addLogEntry(data.message, 'error');
            setStatus('error', 'Error');
            break;

        case 'cancelled':
            setStatus('ready', 'Cancelled');
            addLogEntry(data.message, 'status');
            break;
    }
}

function stopRun() {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    ws = null;
}

startBtn.addEventListener('click', startRun);
stopBtn.addEventListener('click', stopRun);

startTopicInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        targetTopicInput.focus();
    }
});

targetTopicInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !startBtn.disabled) {
        startRun();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Initialize graphWrapper now that DOM is ready
    graphWrapper = document.querySelector('.graph-container');
    
    initGraph();
    
    // Create graph control buttons
    createGraphControls();

    fetch(CONFIG.getApiUrl('/api/status'))
        .then(res => res.json())
        .then(data => {
            if (data.has_api_key) {
                addLogEntry(`LLM configured: ${data.model || 'Unknown'}`, 'status');
            } else {
                addLogEntry('Warning: No LLM API key. Using semantic fallback only.', 'error');
            }
            if (data.embedding_model) {
                addLogEntry(`Embeddings: ${data.embedding_model}`, 'status');
            }
            if (data.has_cache) {
                addLogEntry(`MongoDB cache active`, 'status');
            }
        })
        .catch(() => {
            addLogEntry('Could not check server status', 'error');
        });
});

// Create graph control buttons
function createGraphControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'graph-controls';
    controlsDiv.innerHTML = `
        <button id="fullscreen-btn" class="graph-control-btn" title="Enter fullscreen (F)" aria-label="Toggle fullscreen mode">
            <span class="btn-icon">⛶</span>
            <span class="btn-text">Fullscreen</span>
        </button>
        <button id="fit-btn" class="graph-control-btn" title="Fit to view (R)" aria-label="Fit graph to view">
            <span class="btn-icon">⊡</span>
            <span class="btn-text">Fit</span>
        </button>
        <button id="center-btn" class="graph-control-btn" title="Center on current node" aria-label="Center on current node">
            <span class="btn-icon">◎</span>
        </button>
        <button id="zoomin-btn" class="graph-control-btn" title="Zoom in (+)" aria-label="Zoom in">
            <span class="btn-icon">+</span>
        </button>
        <button id="zoomout-btn" class="graph-control-btn" title="Zoom out (-)" aria-label="Zoom out">
            <span class="btn-icon">−</span>
        </button>
    `;
    
    graphWrapper.appendChild(controlsDiv);
    
    // Add event listeners
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
    
    document.getElementById('fit-btn').addEventListener('click', () => {
        if (network) {
            network.fit({ animation: false });
        }
    });
    
    document.getElementById('center-btn').addEventListener('click', () => {
        if (network && pathData.length > 0) {
            const currentNodeId = pathData.length;
            network.focus(currentNodeId, {
                scale: 1.2,
                animation: false
            });
            showNodePreview(currentNodeId);
        }
    });
    
    document.getElementById('zoomin-btn').addEventListener('click', () => {
        if (network) {
            const scale = network.getScale();
            network.moveTo({
                scale: Math.min(scale * 1.4, 3),
                animation: false
            });
        }
    });
    
    document.getElementById('zoomout-btn').addEventListener('click', () => {
        if (network) {
            const scale = network.getScale();
            network.moveTo({
                scale: Math.max(scale / 1.4, 0.1),
                animation: false
            });
        }
    });
}
