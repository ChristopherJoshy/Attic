import os, re, difflib, asyncio, urllib.parse, httpx, numpy as np
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import lru_cache
from collections import OrderedDict
from dataclasses import dataclass
from dotenv import load_dotenv; load_dotenv()
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from fastembed import TextEmbedding

env = os.getenv
LLM_KEY = env("MOONSHOT_API_KEY") or env("GROQ_API_KEY", "")
LLM_URL = env("MOONSHOT_API_BASE_URL", "https://api.groq.com/openai/v1")
LLM_MODEL = "llama-3.3-70b-versatile"
MONGODB_URI = env("MONGODB_URI", "")
HF_KEY = env("HF_API_KEY") or env("HUGGINGFACE_API_KEY", "")
HF_MODEL = env("HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
ENABLE_EMBEDDING_FALLBACK = (env("ENABLE_EMBEDDING_FALLBACK", "false").lower() in {"1", "true", "yes", "on"})
WIKI_BASE, WIKI_API = "https://en.wikipedia.org", "https://en.wikipedia.org/w/api.php"
SCRAPE_DELAY, MAX_STEPS, LLM_TEMP, LLM_TOKENS, CACHE_DAYS = 0.02, 50, 0.6, 1024, 14

print(f"[CONFIG] LLM: {LLM_MODEL} @ {LLM_URL}")
print(f"[CONFIG] API Key: {'SET' if LLM_KEY else 'NOT SET'}")

_http_client = None
_client_lock = asyncio.Lock()

async def get_http_client():
    global _http_client
    if _http_client is None:
        async with _client_lock:
            if _http_client is None:
                _http_client = httpx.AsyncClient(
                    timeout=httpx.Timeout(30.0, connect=10.0, read=20.0),
                    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
                    http2=False,
                    headers={
                        "Api-User-Agent": "WikiRunAI/1.0 (https://github.com/ChristopherJoshy/WikiRunAi; educational project)",
                        "User-Agent": "WikiRunAI/1.0 (https://github.com/ChristopherJoshy/WikiRunAi; educational project)",
                        "Accept": "application/json",
                    },
                    follow_redirects=True
                )
    return _http_client

class LRUCache:
    __slots__ = ('cache', 'capacity', 'hits', 'misses')
    def __init__(self, cap=200): self.cache, self.capacity, self.hits, self.misses = OrderedDict(), cap, 0, 0
    def get(self, k):
        if k in self.cache: self.cache.move_to_end(k); self.hits += 1; return self.cache[k]
        self.misses += 1
    def put(self, k, v):
        if k in self.cache: self.cache.move_to_end(k)
        self.cache[k] = v
        if len(self.cache) > self.capacity: self.cache.popitem(last=False)

_page_cache = LRUCache(100)
_prefetch_tasks = {}

def prefetch_top_links(links, visited, count=1):
    for link in links[:count]:
        url = link["url"]
        if url not in visited and url not in _prefetch_tasks and _page_cache.get(url) is None:
            _prefetch_tasks[url] = asyncio.create_task(_prefetch_page(url))
            break

async def _prefetch_page(url):
    try:
        await get_page_data(url)
    except:
        pass
    finally:
        _prefetch_tasks.pop(url, None)

@asynccontextmanager
async def lifespan(app):
    yield
    global _http_client
    if _http_client:
        await _http_client.aclose()

app = FastAPI(title="WikiRun AI", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

active_runs = {}
mongo_client = None
wiki_cache = None
run_cache = None

def init_mongo():
    global mongo_client, wiki_cache, run_cache
    if not MONGODB_URI: return False
    try:
        mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        mongo_client.admin.command('ping')
        db = mongo_client.wikirun_ai
        wiki_cache, run_cache = db.page_cache, db.run_cache
        for c, k in [(wiki_cache, "url"), (run_cache, "run_key")]:
            c.create_index(k, unique=True)
            c.create_index("cached_at", expireAfterSeconds=CACHE_DAYS * 86400)
        return True
    except: return False

init_mongo()

class RunRequest(BaseModel):
    start_topic: str
    target_topic: str
    max_steps: int = MAX_STEPS

def wiki_url(topic): return f"{WIKI_BASE}/wiki/{urllib.parse.quote(topic.replace(' ', '_'))}"

def get_cached_page(url):
    try: return wiki_cache.find_one({"url": url}) if wiki_cache is not None else None
    except: return None

def cache_page(url, title, snippet, thumb, links):
    if wiki_cache is None: return
    try: wiki_cache.update_one({"url": url}, {"$set": {"url": url, "title": title, "snippet": snippet, "thumbnail": thumb, "links": links, "cached_at": datetime.now(timezone.utc)}}, upsert=True)
    except: pass

def get_cached_run(start, target):
    if run_cache is None: return None
    try:
        c = run_cache.find_one({"run_key": f"{start.lower()}→{target.lower()}"})
        return c.get("path", []) if c else None
    except: return None

def cache_run(start, target, path):
    if run_cache is None: return
    key = f"{start.lower()}→{target.lower()}"
    try: run_cache.update_one({"run_key": key}, {"$set": {"run_key": key, "path": path, "cached_at": datetime.now(timezone.utc)}}, upsert=True)
    except: pass

def url_to_title(url): return urllib.parse.unquote(url.split("/wiki/")[-1].replace("_", " ")) if "/wiki/" in url else ""

async def fetch_wiki_api(title, retries=3):
    client = await get_http_client()
    params = {"action": "query", "titles": title, "prop": "extracts|links|pageimages|info",
              "exintro": "true", "explaintext": "true", "exsentences": "3", "pllimit": "100",
              "plnamespace": "0", "piprop": "thumbnail", "pithumbsize": "300",
              "format": "json", "formatversion": "2", "redirects": "1"}
    for i in range(retries):
        try:
            r = await client.get(WIKI_API, params=params)
            if r.status_code == 200:
                pages = r.json().get("query", {}).get("pages", [])
                if pages and not pages[0].get("missing"):
                    p = pages[0]
                    ext = p.get("extract", "")
                    links = [{"title": l["title"], "url": wiki_url(l["title"]), "href": f"/wiki/{urllib.parse.quote(l['title'].replace(' ', '_'))}"}
                             for l in p.get("links", []) if l.get("title") and ":" not in l["title"]]
                    return {"title": p.get("title", title), "snippet": ext[:200] + "..." if len(ext) > 200 else ext,
                            "thumbnail": p.get("thumbnail", {}).get("source"), "links": links}
            elif r.status_code == 429: await asyncio.sleep(i + 1); continue
        except httpx.TimeoutException:
            if i < retries - 1: await asyncio.sleep(0.5 * (i + 1))
        except httpx.ConnectError:
            global _http_client
            if _http_client:
                try: await _http_client.aclose()
                except: pass
                _http_client = None
            if i < retries - 1: await asyncio.sleep(i + 1)
        except:
            if i < retries - 1: await asyncio.sleep(0.3 * (i + 1))

async def fetch_more_links(title, cont=None):
    try:
        params = {"action": "query", "titles": title, "prop": "links", "pllimit": "100", "plnamespace": "0", "format": "json", "formatversion": "2"}
        if cont: params["plcontinue"] = cont
        r = await (await get_http_client()).get(WIKI_API, params=params)
        if r.status_code == 200:
            pages = r.json().get("query", {}).get("pages", [])
            if pages:
                return [{"title": l["title"], "url": wiki_url(l["title"]), "href": f"/wiki/{urllib.parse.quote(l['title'].replace(' ', '_'))}"}
                        for l in pages[0].get("links", []) if l.get("title") and ":" not in l["title"]]
    except: pass
    return []

async def get_page_data(url):
    if (c := _page_cache.get(url)): return {**c, "from_cache": True}
    if (m := get_cached_page(url)):
        r = {"title": m.get("title", ""), "snippet": m.get("snippet", ""), "thumbnail": m.get("thumbnail"), "links": m.get("links", [])}
        _page_cache.put(url, r)
        return {**r, "from_cache": True}
    if not (title := url_to_title(url)): return None
    if not (data := await fetch_wiki_api(title)): return None
    r = {k: data[k] for k in ("title", "snippet", "thumbnail", "links")}
    _page_cache.put(url, r)
    asyncio.create_task(asyncio.to_thread(cache_page, url, r["title"], r["snippet"], r["thumbnail"], r["links"]))
    return {**r, "from_cache": False}

def get_category(text):
    text = text.lower()
    if any(x in text for x in ['fruit', 'vegetable', 'food', 'dish', 'cuisine']): return 'food'
    if any(x in text for x in ['animal', 'mammal', 'bird', 'fish', 'insect']): return 'animal'
    if any(x in text for x in ['city', 'country', 'place', 'river', 'mountain']): return 'geography'
    if any(x in text for x in ['science', 'physics', 'chemistry', 'biology']): return 'science'
    if any(x in text for x in ['history', 'war', 'battle', 'empire']): return 'history'
    if any(x in text for x in ['person', 'biography', 'actor', 'writer']): return 'person'
    return None

_HUB_KW = {'list of', 'outline of', 'index of', 'category:', 'portal:'}

def build_llm_prompt(current_title, target_title, links):
    target_lower = target_title.lower()
    target_words = set(w for w in target_lower.split() if len(w) > 2)
    target_category = get_category(target_lower)
    scored_links = []
    
    for i, link in enumerate(links[:100]):
        link_lower = link['title'].lower()
        if target_lower == link_lower:
            scored_links.append((1000, i, link))
            continue
        score = 0
        if target_lower in link_lower:
            score = 95
        elif link_lower in target_lower:
            score = 90
        else:
            link_words = set(link_lower.split())
            common = target_words & link_words
            if common:
                score = 50 + (len(common) * 20)
            else:
                link_cat = get_category(link_lower)
                if link_cat and link_cat == target_category:
                    score = 40
                elif any(hub in link_lower for hub in _HUB_KW):
                    score = 30
                else:
                    for tw in target_words:
                        for lw in link_words:
                            if len(tw) > 4 and len(lw) > 4 and tw[:4] == lw[:4]:
                                score = max(score, 35)
                                break
        scored_links.append((score, i, link))
    
    scored_links.sort(key=lambda x: -x[0])
    top_links = scored_links[:30]
    numbered_links = "\n".join([f"{idx+1}. {item[2]['title']}" for idx, item in enumerate(top_links)])
    
    prompt = f"""You are playing the Wikipedia Game. Navigate from "{current_title}" to "{target_title}".

TARGET: "{target_title}"
CURRENT: "{current_title}"

LINKS:
{numbered_links}

INSTRUCTIONS:
1. Analyze the relationship between the current page and the target.
2. Select the link that is semantically closest to the target or a major category/hub that leads to it.
3. If the target is a specific instance (e.g., "Apple"), look for its category (e.g., "Fruit", "Plants").
4. If the target is a broad topic, look for subtopics.

Reason briefly about the connection, then select the best link number.
Format: "Reasoning... CHOICE: [number]"
"""
    
    return prompt, [item[2] for item in top_links]

async def call_llm(prompt, retry=0):
    if not LLM_KEY:
        return None
    try:
        client = await get_http_client()
        r = await client.post(f"{LLM_URL}/chat/completions",
            headers={"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"},
            json={
                "model": LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": LLM_TEMP,
                "max_completion_tokens": LLM_TOKENS,
                "top_p": 1,
                "stream": False
            }, timeout=60.0)
        if r.status_code == 200:
            data = r.json()
            if (c := data.get("choices")):
                return c[0].get("message", {}).get("content", "").strip()
        elif r.status_code == 401:
            print(f"[LLM] Invalid API key")
            return None
        elif r.status_code in (429, 500, 502, 503) and retry < 2:
            await asyncio.sleep(retry + 1)
            return await call_llm(prompt, retry + 1)
        else:
            print(f"[LLM] Error {r.status_code}: {r.text[:200]}")
    except httpx.TimeoutException:
        if retry < 2: return await call_llm(prompt, retry + 1)
    except Exception as e:
        print(f"[LLM] Error: {e}")
    return None

_NUMBER_START_RE = re.compile(r'^(\d+)')
_NUMBER_FIND_RE = re.compile(r'\d+')
_CHOICE_RE = re.compile(r'CHOICE:\s*(\d+)', re.IGNORECASE)

def parse_llm_response(response, links, original_links=None):
    if not response:
        return None
    response = response.strip()
    
    choice_match = _CHOICE_RE.search(response)
    if choice_match:
        try:
            idx = int(choice_match.group(1)) - 1
            if 0 <= idx < len(links):
                return links[idx]
        except:
            pass
    
    match = _NUMBER_START_RE.match(response)
    if match:
        try:
            idx = int(match.group(1)) - 1
            if 0 <= idx < len(links):
                return links[idx]
        except:
            pass
    
    numbers = _NUMBER_FIND_RE.findall(response)
    for num in reversed(numbers):
        try:
            idx = int(num) - 1
            if 0 <= idx < len(links):
                return links[idx]
        except:
            continue
    
    return None

_emb_cache, _EMB_MAX = {}, 5000
HF_URL = f"https://api-inference.huggingface.co/models/{HF_MODEL}"

async def get_embeddings(texts: list[str], retry=0) -> list[np.ndarray] | None:
    if not texts: return None
    cached, uncached, unc_idx = [], [], []
    for i, t in enumerate(texts):
        k = t.lower().strip()
        if k in _emb_cache: cached.append((i, _emb_cache[k]))
        else: uncached.append(t); unc_idx.append(i)
    if not uncached: return [e for _, e in sorted(cached)]
    try:
        hdrs = {"Content-Type": "application/json"}
        if HF_KEY: hdrs["Authorization"] = f"Bearer {HF_KEY}"
        r = await (await get_http_client()).post(HF_URL, headers=hdrs,
            json={"inputs": uncached, "options": {"wait_for_model": True, "use_cache": True}}, timeout=15.0)
        if r.status_code == 200:
            embs = []
            for i, d in enumerate(r.json()):
                e = np.mean(np.array(d, dtype=np.float32), axis=0) if isinstance(d, list) and d and isinstance(d[0], list) else np.array(d, dtype=np.float32)
                embs.append(e)
                if len(_emb_cache) < _EMB_MAX: _emb_cache[uncached[i].lower().strip()] = e
            return [e for _, e in sorted(cached + list(zip(unc_idx, embs)))]
        elif r.status_code in (503, 429) and retry < 2:
            await asyncio.sleep(2.0 if r.status_code == 503 else retry + 1)
            return await get_embeddings(texts, retry + 1)
    except:
        if retry < 1: await asyncio.sleep(0.5); return await get_embeddings(texts, retry + 1)

def batch_cos_sim(target: np.ndarray, candidates: list[np.ndarray]) -> np.ndarray:
    if not candidates: return np.array([])
    m = np.stack(candidates)
    return (m @ target) / (np.linalg.norm(target) * np.maximum(np.linalg.norm(m, axis=1), 1e-8))

class NeuralSearchEngine:
    def __init__(self):
        print("[ENGINE] Initializing Hybrid Search Engine...")
        self.vectorizer = TfidfVectorizer(
            analyzer='char_wb', 
            ngram_range=(3, 5), 
            min_df=1, 
            strip_accents='unicode'
        )
        
        try:
            self.embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            self.has_model = True
            print("[ENGINE] Neural Model Loaded Successfully.")
        except Exception as e:
            print(f"[ENGINE] Failed to load Neural Model: {e}")
            self.has_model = False

    def rank(self, target: str, candidates: list[str], top_k_rerank: int = 30) -> list[tuple[float, int]]:
        if not candidates: return []
        
        try:
            corpus = [target] + candidates
            tfidf_matrix = self.vectorizer.fit_transform(corpus)
            lexical_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
            
            scored_candidates = [(float(s), i) for i, s in enumerate(lexical_scores)]
            scored_candidates.sort(key=lambda x: x[0], reverse=True)
            
        except Exception as e:
            print(f"[ENGINE] Lexical Error: {e}")
            return []

        if not self.has_model or (scored_candidates and scored_candidates[0][0] > 0.9):
            return scored_candidates

        top_candidates_indices = [idx for _, idx in scored_candidates[:top_k_rerank]]
        top_candidates_texts = [candidates[i] for i in top_candidates_indices]
        
        try:
            embeddings = list(self.embedding_model.embed([target] + top_candidates_texts))
            
            target_emb = embeddings[0]
            candidate_embs = np.stack(embeddings[1:])
            
            norm_target = np.linalg.norm(target_emb)
            norm_candidates = np.linalg.norm(candidate_embs, axis=1)
            
            semantic_scores = (candidate_embs @ target_emb) / (norm_target * norm_candidates)
            
            reranked = []
            target_cat = get_category(target)
            
            for i, score in enumerate(semantic_scores):
                original_idx = top_candidates_indices[i]
                lexical_score = next(s for s, idx in scored_candidates if idx == original_idx)
                
                final_score = (score * 0.65) + (lexical_score * 0.35)
                
                cand_text = candidates[original_idx].lower()
                if target_cat and get_category(cand_text) == target_cat:
                    final_score += 0.15
                
                if any(kw in cand_text for kw in _HUB_KW):
                    final_score += 0.05
                    
                reranked.append((final_score, original_idx))
                
            reranked.sort(key=lambda x: x[0], reverse=True)
            return reranked
            
        except Exception as e:
            print(f"[ENGINE] Semantic Error: {e}")
            return scored_candidates

_engine = NeuralSearchEngine()

async def smart_fallback(target, links, visited, path_titles=None):
    available_links = []
    for i, lnk in enumerate(links):
        if lnk["url"] not in visited:
            available_links.append((i, lnk))
    
    if not available_links: return None
    
    candidate_titles = [lnk["title"] for _, lnk in available_links]
    
    ranked_results = _engine.rank(target, candidate_titles)
    
    if not ranked_results: return available_links[0][1]
    
    best_score, best_idx = ranked_results[0]
    return available_links[best_idx][1]


async def run_agent(websocket, start_topic, target_topic, run_id, max_steps=MAX_STEPS, use_api=True):
    start_time = datetime.now()
    async def send(t, d):
        try: await websocket.send_json({"type": t, "timestamp": datetime.now().isoformat(), **d})
        except: pass
    
    if (cached_path := get_cached_run(start_topic, target_topic)):
        await send("status", {"message": f"Using cached run: {start_topic} → {target_topic}"})
        for i, node in enumerate(cached_path):
            await send("node", {"node": node, "path": cached_path, "visited_count": len(cached_path), "from_cache": True, "is_cached_batch": True, "batch_position": i + 1, "batch_total": len(cached_path)})
            await asyncio.sleep(0.05)
        await send("complete", {"success": True, "message": f"Completed (cached) in {len(cached_path)} steps!", "path": cached_path, "total_steps": len(cached_path), "total_time": (datetime.now() - start_time).total_seconds()})
        await asyncio.sleep(0.1)
        return
    
    visited, path = set(), []
    current_url, target_url = wiki_url(start_topic), wiki_url(target_topic)
    step = 0
    await send("status", {"message": f"Starting run: {start_topic} → {target_topic}"})
    target_task = asyncio.create_task(get_page_data(target_url))
    await send("status", {"message": "Fetching starting page..."})
    first_page_task = asyncio.create_task(get_page_data(current_url))
    try:
        target_data = await target_task
        target_title = target_data.get("title", target_topic) if target_data else target_topic
    except: target_title = target_topic
    target_title = target_title or target_topic
    
    while step < max_steps and active_runs.get(run_id):
        step += 1
        page_data, attempts = None, 0
        while not page_data and attempts < 5:
            attempts += 1
            try:
                page_data = await first_page_task if step == 1 and attempts == 1 else await get_page_data(current_url)
                if not page_data and attempts < 5:
                    await send("status", {"message": f"Retrying ({attempts + 1}/5)..."})
                    await asyncio.sleep(attempts)
            except:
                if attempts < 5: await send("status", {"message": f"Error, retrying ({attempts + 1}/5)..."}); await asyncio.sleep(attempts)
        if not page_data:
            await send("error", {"message": f"Failed to fetch after 5 attempts: {current_url}"}); break
        title, snippet, thumb, links = page_data["title"], page_data["snippet"], page_data["thumbnail"], page_data["links"]
        from_cache = page_data.get("from_cache", False)
        visited.add(current_url)
        node = {"step": step, "title": title, "url": current_url, "snippet": snippet, "thumbnail": thumb}
        path.append(node)
        await send("node", {"node": node, "path": path, "visited_count": len(visited), "from_cache": from_cache})
        
        if title.lower() == target_title.lower():
            cache_run(start_topic, target_topic, path)
            await send("complete", {"success": True, "message": f"Target reached in {step} steps!", "path": path, "total_steps": step, "total_time": (datetime.now() - start_time).total_seconds()})
            await asyncio.sleep(0.1); return
        
        available = [l for l in links if l["url"] not in visited]
        if not available: await send("error", {"message": "Dead end - no unvisited links!"}); break
        selected, model, reasoning = None, None, None
        tgt_low = target_title.lower()
        for lnk in available:
            if lnk["title"].lower() == tgt_low:
                selected, model, reasoning = lnk, "exact_match", f"Found exact match: '{target_title}'"
                break
        
        if not selected and use_api and LLM_KEY:
            prompt, filtered = build_llm_prompt(title, target_title, available)
            try:
                if (resp := await asyncio.wait_for(call_llm(prompt), timeout=20.0)):
                    if (sel := parse_llm_response(resp, filtered)) and sel["url"] not in visited:
                        selected, model = sel, f"llm:{LLM_MODEL}"
                        r = resp.split('CHOICE:')[0].strip() if 'CHOICE:' in resp.upper() else resp
                        reasoning = f"{r[:200]}..." if len(r) > 200 else r + f" → '{sel['title']}'"
            except asyncio.TimeoutError: reasoning = "LLM timed out"
            
            if not selected:
                if (sel := await smart_fallback(target_title, available, visited, [p.get('title', '') for p in path])):
                    selected, model = sel, "fallback:embedding"
                    reasoning = f"Semantic match: '{sel['title']}' → '{target_title}'"
        
        if not selected and not use_api:
            if (sel := await smart_fallback(target_title, available, visited, [p.get('title', '') for p in path])):
                selected, model, reasoning = sel, "fallback:embedding", f"Semantic: '{sel['title']}' → '{target_title}'"
        if not selected: await send("error", {"message": "Could not select a valid link."}); break
        await send("move", {"from_title": title, "to_title": selected["title"], "step": step, "model": model, "reasoning": reasoning})
        current_url = selected["url"]
        if (rem := [l for l in available if l["url"] != current_url and l["url"] not in visited]):
            prefetch_top_links(rem, visited, count=1)
        if not from_cache: await asyncio.sleep(SCRAPE_DELAY)
    
    if step >= max_steps:
        await send("complete", {"success": False, "message": f"Step limit ({max_steps}) reached.", "path": path, "total_steps": step, "total_time": (datetime.now() - start_time).total_seconds()})
        await asyncio.sleep(0.1)
    elif not active_runs.get(run_id):
        await send("cancelled", {"message": "Run cancelled.", "path": path, "total_steps": step})
        await asyncio.sleep(0.1)

def extract_topic(s):
    s = s.strip()
    if 'wikipedia.org/wiki/' in s:
        try: return urllib.parse.unquote(s.split('/wiki/')[-1].replace('_', ' ').split('#')[0].split('?')[0]).strip()
        except: pass
    return s

@app.websocket("/ws/run")
async def websocket_run(websocket: WebSocket):
    try: await websocket.accept()
    except: return
    run_id = None
    try:
        data = await websocket.receive_json()
        start, target = extract_topic(data.get("start_topic", "")), extract_topic(data.get("target_topic", ""))
        max_steps, use_api = data.get("max_steps", MAX_STEPS), data.get("use_api", True)
        if not start or not target:
            await websocket.send_json({"type": "error", "message": "Start and target topics required."})
            await websocket.close(); return
        run_id = f"{start}-{target}-{datetime.now().timestamp()}"
        active_runs[run_id] = True
        await run_agent(websocket, start, target, run_id, max_steps, use_api)
    except WebSocketDisconnect: pass
    except: pass
    finally:
        if run_id: active_runs.pop(run_id, None)
        try: await websocket.close()
        except: pass

@app.post("/api/cancel/{run_id}")
async def cancel_run(run_id):
    if run_id in active_runs: active_runs[run_id] = False; return {"status": "cancelled"}
    raise HTTPException(status_code=404, detail="Run not found")

@app.get("/health")
async def health(): return {"status": "ok"}

@app.get("/api/test-wiki")
async def test_wiki():
    try:
        if (d := await fetch_wiki_api("Python (programming language)")):
            return {"status": "success", "title": d["title"], "links": len(d["links"]), "thumb": d["thumbnail"] is not None}
        return {"status": "error", "message": "Failed"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/")
async def root(): return {"message": "WikiRun AI API", "status": "running"}

@app.get("/api/status")
async def status():
        return {"status": "running", "has_api_key": bool(LLM_KEY), "has_hf_key": bool(HF_KEY),
            "has_cache": wiki_cache is not None, "memory_cache": len(_page_cache.cache),
            "embedding_cache": len(_emb_cache), "hits": _page_cache.hits, "misses": _page_cache.misses,
            "active_runs": len(active_runs), "model": LLM_MODEL, "embedding_model": HF_MODEL,
            "embedding_fallback_enabled": ENABLE_EMBEDDING_FALLBACK}
