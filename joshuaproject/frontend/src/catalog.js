import { animate, stagger } from 'animejs';

const MAIN_CATEGORIES = {
    "Washroom & Hygiene": ["DISPENSER", "TISSUE DISPENSER", "TISSUE PAPER"],
    "Cleaning Chemicals": ["TASKI CLEANING CHEMICAL", "BRANDED CLEANING CHEMICAL", "ROOM FRESHENER & OTHER"],
    "Cleaning Tools": ["CLEANING TOOLS", "CLEANING BRUSH", "WIPERS / MOPS & MOP STICKS", "DUSTER CLOTH & SCRUBBER", "BROOM,DOOR MAT & GARBAGE BAG", "DUSTBIN"],
    "Office & Stationery": ["STATIONERY & OFFICE PRODUCTS", "COPIER PAPERS & FILES/FOLDER", "BOARD/STAND OTHER"],
    "Safety & Medical": ["SAFETY PRODUCTS", "MASKS & HANDS GLOVES", "HOSPITAL DISPOSABLE"],
    "Other Supplies": ["OTHER PRODUCTS"]
};

const SUBCATEGORY_NAMES = {
    "DISPENSER": "Hand & Soap Dispensers",
    "TISSUE DISPENSER": "Tissue Dispensers",
    "TISSUE PAPER": "Hygiene Tissue Paper",
    "TASKI CLEANING CHEMICAL": "Taski Cleaning Chemicals",
    "BRANDED CLEANING CHEMICAL": "Branded Chemicals",
    "ROOM FRESHENER & OTHER": "Room Fresheners",
    "CLEANING TOOLS": "Cleaning Tools",
    "CLEANING BRUSH": "Cleaning Brushes",
    "WIPERS / MOPS & MOP STICKS": "Wipers & Mop Sticks",
    "DUSTER CLOTH & SCRUBBER": "Cloths & Scrubbers",
    "BROOM,DOOR MAT & GARBAGE BAG": "Brooms, Mats & Bags",
    "DUSTBIN": "Dustbins & Garbage Bins",
    "STATIONERY & OFFICE PRODUCTS": "Office Stationery",
    "COPIER PAPERS & FILES/FOLDER": "Papers, Files & Folders",
    "BOARD/STAND OTHER": "Boards & Stands",
    "SAFETY PRODUCTS": "Safety Gear (PPE)",
    "MASKS & HANDS GLOVES": "Masks & Gloves",
    "HOSPITAL DISPOSABLE": "Hospital Disposables",
    "OTHER PRODUCTS": "Other B2B Supplies"
};

const state = {
    products: [],
    filteredProducts: [],
    categories: {},
    activeCategory: 'all',
    searchQuery: '',
    sortOption: 'default',
    currentPage: 1,
    itemsPerPage: 12,
    selectedSubCategories: {},
    expandedSections: {}
};

window.state = state;

function getMainCategory(subCat) {
    for (const [main, subs] of Object.entries(MAIN_CATEGORIES)) {
        if (subs.includes(subCat)) return main;
    }
    return 'Other Supplies';
}

function calculateCategories() {
    state.categories = {};
    state.products.forEach(p => {
        const main = getMainCategory(p.category);
        state.categories[main] = (state.categories[main] || 0) + 1;
    });
}

function renderCategories() {
    const list = document.getElementById('categoryList');
    const mobileSelect = document.getElementById('mobileCategorySelect');

    let listHtml = `<li class="category-item ${state.activeCategory === 'all' ? 'active' : ''}" data-cat="all"><span>All Products</span><span class="category-count">${state.products.length}</span></li>`;
    let selectHtml = `<option value="all" ${state.activeCategory === 'all' ? 'selected' : ''}>All Categories (${state.products.length})</option>`;

    Object.keys(MAIN_CATEGORIES).forEach(main => {
        const count = state.categories[main] || 0;
        if (!count) return;
        listHtml += `<li class="category-item ${state.activeCategory === main ? 'active' : ''}" data-cat="${main}"><span>${main}</span><span class="category-count">${count}</span></li>`;
        selectHtml += `<option value="${main}" ${state.activeCategory === main ? 'selected' : ''}>${main} (${count})</option>`;
    });

    list.innerHTML = listHtml;
    if (mobileSelect) mobileSelect.innerHTML = selectHtml;

    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => selectCategory(item.dataset.cat));
    });
}

function selectCategory(cat) {
    state.activeCategory = cat;
    state.currentPage = 1;
    state.expandedSections = {};

    document.querySelectorAll('.category-item').forEach(item => {
        const v = item.dataset.cat;
        const isActive = v === 'all'
            ? state.activeCategory === 'all'
            : state.activeCategory === v || (MAIN_CATEGORIES[v] && MAIN_CATEGORIES[v].includes(state.activeCategory));
        item.classList.toggle('active', isActive);
    });

    const mobileSelect = document.getElementById('mobileCategorySelect');
    if (mobileSelect) {
        const val = MAIN_CATEGORIES[cat] ? cat : (Object.keys(MAIN_CATEGORIES).find(mc => MAIN_CATEGORIES[mc].includes(cat)) || cat);
        mobileSelect.value = val;
    }

    const nameEl = document.getElementById('activeCategoryName');
    nameEl.textContent = cat === 'all' ? 'All Categories' : (SUBCATEGORY_NAMES[cat] || cat);

    applyFilterAndSort();
}

function applyFilterAndSort() {
    state.expandedSections = {};
    let result = [...state.products];

    if (state.activeCategory !== 'all') {
        if (MAIN_CATEGORIES[state.activeCategory]) {
            const allowed = MAIN_CATEGORIES[state.activeCategory];
            result = result.filter(p => allowed.includes(p.category));
        } else {
            result = result.filter(p => p.category === state.activeCategory);
        }
    }

    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase().trim();
        result = result.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            Object.values(p.specs).some(v => v.toString().toLowerCase().includes(q))
        );

        const bar = document.getElementById('searchStatusBar');
        const text = document.getElementById('searchResultText');
        bar.style.display = 'flex';
        text.textContent = `${result.length} results for "${state.searchQuery}"`;
    } else {
        document.getElementById('searchStatusBar').style.display = 'none';
    }

    if (state.sortOption === 'name-asc') {
        result.sort((a, b) => a.name.localeCompare(b.name));
    }

    state.filteredProducts = result;
    state.currentPage = 1;
    renderProducts();
}

function renderProducts() {
    const grid = document.getElementById('productsGrid');

    if (!state.filteredProducts.length) {
        grid.innerHTML = `<div class="loading-spinner"><p>Nothing here — try different keywords or reset the filter.</p></div>`;
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }

    const groupedByMain = {};
    Object.keys(MAIN_CATEGORIES).forEach(main => { groupedByMain[main] = []; });
    state.filteredProducts.forEach(p => {
        const main = getMainCategory(p.category);
        if (!groupedByMain[main]) groupedByMain[main] = [];
        groupedByMain[main].push(p);
    });

    if (!state.selectedSubCategories) state.selectedSubCategories = {};

    let html = '';

    Object.keys(MAIN_CATEGORIES).forEach(main => {
        const products = groupedByMain[main] || [];
        if (!products.length) return;

        const activeSubCats = MAIN_CATEGORIES[main].filter(sub => state.products.some(p => p.category === sub));
        if (!state.selectedSubCategories[main]) state.selectedSubCategories[main] = 'all';
        const selectedSub = state.selectedSubCategories[main];

        let toShow = products;
        if (selectedSub !== 'all') toShow = products.filter(p => p.category === selectedSub);

        const initialLimit = window.matchMedia('(max-width: 900px)').matches ? 6 : 8;
        const expanded = state.expandedSections[main + '|' + selectedSub];
        const hiddenCount = expanded ? 0 : Math.max(0, toShow.length - initialLimit);
        const visibleProducts = expanded ? toShow : toShow.slice(0, initialLimit);

        let tabsHtml = `<button class="portronics-tab ${selectedSub === 'all' ? 'active' : ''}" data-main="${main}" data-sub="all">All</button>`;
        activeSubCats.forEach(sub => {
            tabsHtml += `<button class="portronics-tab ${selectedSub === sub ? 'active' : ''}" data-main="${main}" data-sub="${sub}">${SUBCATEGORY_NAMES[sub] || sub}</button>`;
        });

        let cardsHtml = '';
        visibleProducts.forEach(p => {
            const ribbon = p.brand ? p.brand.toUpperCase() : 'B2B QUALITY';
            cardsHtml += `
                <div class="portronics-card" data-id="${p.id}">
                    <div class="portronics-card-img-container">
                        <img src="/assets/images/${p.image_file}" alt="${p.name}" loading="lazy">
                    </div>
                    <span class="portronics-card-tag">${ribbon}</span>
                    <div class="portronics-card-info">
                        <h3 class="portronics-card-title" title="${p.name}">${p.name}</h3>
                        <p class="portronics-card-description">${p.description}</p>
                        <button class="portronics-card-btn">View Details</button>
                    </div>
                </div>`;
        });

        if (!cardsHtml) {
            cardsHtml = `<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-3)">No items in this subcategory match your search.</div>`;
        }

        const showMoreHtml = hiddenCount > 0
            ? `<div class="portronics-show-more-wrap"><button class="portronics-show-more-btn" data-main="${main}" data-sub="${selectedSub}">Show ${hiddenCount} more</button></div>`
            : '';

        html += `
            <div class="portronics-section" data-main-cat="${main}">
                <div class="portronics-section-header">
                    <h2 class="portronics-section-title">${main}</h2>
                    <button class="portronics-view-all-btn" data-main="${main}">VIEW ALL</button>
                </div>
                <div class="portronics-tabs-wrapper">
                    <div class="portronics-tabs">${tabsHtml}</div>
                </div>
                <div class="portronics-products-grid">${cardsHtml}</div>
                ${showMoreHtml}
            </div>`;
    });

    grid.innerHTML = html;

    document.querySelectorAll('.portronics-card').forEach(card => {
        card.addEventListener('click', () => {
            const product = state.products.find(p => p.id === card.dataset.id);
            if (product && window.openProductModal) window.openProductModal(product);
        });
    });

    document.querySelectorAll('.portronics-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            state.selectedSubCategories[tab.dataset.main] = tab.dataset.sub;
            renderProducts();
        });
    });

    document.querySelectorAll('.portronics-view-all-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectCategory(btn.dataset.main);
            document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.querySelectorAll('.portronics-show-more-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = btn.dataset.main + '|' + btn.dataset.sub;
            state.expandedSections[key] = !state.expandedSections[key];
            renderProducts();
            // animate the newly revealed cards in
            const section = btn.closest('.portronics-section');
            if (section) {
                const cards = section.querySelectorAll('.portronics-card');
                animate(cards, {
                    opacity: [0, 1],
                    translateY: [20, 0],
                    duration: 450,
                    delay: stagger(35),
                    easing: 'easeOutExpo'
                });
            }
        });
    });

    document.getElementById('paginationContainer').style.display = 'none';

    const cardEls = document.querySelectorAll('.portronics-card');
    const cardObserver = new IntersectionObserver((entries) => {
        const visible = entries.filter(e => e.isIntersecting).map(e => e.target);
        if (!visible.length) return;
        animate(visible, {
            opacity: [0, 1],
            translateY: [24, 0],
            duration: 500,
            easing: 'easeOutExpo',
            delay: stagger(40)
        });
        visible.forEach(el => {
            el.classList.add('visible');
            cardObserver.unobserve(el);
        });
    }, { threshold: 0.1 });

    cardEls.forEach(card => cardObserver.observe(card));
}

function renderMegaMenu() {
    const grid = document.getElementById('megaMenuGrid');
    if (!grid) return;

    let html = '';
    Object.entries(MAIN_CATEGORIES).forEach(([main, subs]) => {
        let subsHtml = '';
        subs.forEach(sub => {
            const first = state.products.find(p => p.category === sub);
            const name = SUBCATEGORY_NAMES[sub] || sub;
            subsHtml += `
                <li class="mega-menu-item" data-cat="${sub}">
                    <div class="mega-menu-item-icon">
                        ${first ? `<img src="/assets/images/${first.image_file}" alt="${name}" loading="lazy">` : ''}
                    </div>
                    <span class="mega-menu-item-name">${name}</span>
                </li>`;
        });
        html += `
            <div class="mega-menu-column">
                <h4 class="mega-menu-column-title">${main}</h4>
                <ul class="mega-menu-list">${subsHtml}</ul>
            </div>`;
    });

    grid.innerHTML = html;

    document.querySelectorAll('.mega-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            selectCategory(item.dataset.cat);
            document.getElementById('megaMenu').classList.remove('open');
            document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
        });
    });
}

export async function initCatalog() {
    try {
        const res = await fetch('/products_db.json');
        if (!res.ok) throw new Error('Failed to load products');
        state.products = await res.json();
        window.state = state;

        calculateCategories();
        renderCategories();
        renderMegaMenu();
        applyFilterAndSort();
        attachCatalogEvents();
    } catch (err) {
        const grid = document.getElementById('productsGrid');
        if (grid) grid.innerHTML = `<div class="loading-spinner"><p style="color:red;">Could not load the product catalog. Please refresh.</p></div>`;
    }
}

function attachCatalogEvents() {
    const searchInput = document.getElementById('headerSearchInput');
    const resetSearch = document.getElementById('btnResetSearch');
    const sortSelect = document.getElementById('sortSelect');
    const mobileSelect = document.getElementById('mobileCategorySelect');

    let debounce;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            state.searchQuery = e.target.value;
            state.currentPage = 1;
            applyFilterAndSort();
        }, 280);
    });

    resetSearch?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.searchQuery = '';
        applyFilterAndSort();
    });

    sortSelect?.addEventListener('change', (e) => {
        state.sortOption = e.target.value;
        applyFilterAndSort();
    });

    mobileSelect?.addEventListener('change', (e) => selectCategory(e.target.value));

    document.querySelectorAll('.footer-cat-link').forEach(link => {
        link.addEventListener('click', () => selectCategory(link.dataset.cat));
    });

    document.querySelectorAll('.editorial-card').forEach(card => {
        card.addEventListener('click', () => {
            selectCategory(card.dataset.cat);
            document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
        });
    });
}
