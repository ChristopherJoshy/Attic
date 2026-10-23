import { animate } from 'animejs';

export function initModal() {
    const modal = document.getElementById('productModal');
    const modalClose = document.getElementById('modalClose');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalImage = document.getElementById('modalProductImage');
    const modalCategory = document.getElementById('modalProductCategory');
    const modalName = document.getElementById('modalProductName');
    const modalBrand = document.getElementById('modalProductBrand');
    const modalDescription = document.getElementById('modalProductDescription');
    const modalSpecsTable = document.getElementById('modalSpecsTable');
    const modalWhatsAppBtn = document.getElementById('modalWhatsAppBtn');

    function open(product) {
        const oritoOpen = document.getElementById('oritoOpenBox');
        const oritoClosed = document.getElementById('oritoClosedBox');
        if (oritoOpen && oritoClosed) {
            oritoOpen.style.display = 'none';
            oritoClosed.style.display = 'flex';
        }

        modalImage.src = `/assets/images/${product.image_file}`;
        modalImage.alt = product.name;
        modalCategory.textContent = product.category;
        modalName.textContent = product.name;
        modalBrand.textContent = product.brand;
        modalDescription.textContent = product.description;

        let specsHtml = '';
        for (const [key, val] of Object.entries(product.specs)) {
            specsHtml += `<tr><td class="spec-name">${key}</td><td class="spec-value">${val}</td></tr>`;
        }
        modalSpecsTable.innerHTML = specsHtml;

        const msg = `Hello Mount Enterprise! I would like to inquire about:\n------------------------------------------\nProduct: ${product.name}\nCategory: ${product.category}\nBrand: ${product.brand}\nCatalogue Page: ${product.page}\n------------------------------------------\nPlease share stock availability and wholesale pricing. Thank you!`;
        modalWhatsAppBtn.href = `https://wa.me/917802053467?text=${encodeURIComponent(msg)}`;

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';

        animate(document.querySelector('.modal-container'), {
            scale: [0.93, 1],
            opacity: [0, 1],
            duration: 350,
            easing: 'easeOutExpo'
        });
    }

    function close() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    modalClose?.addEventListener('click', close);
    modalOverlay?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    window.openProductModal = open;

    window.openProductModalById = function(id) {
        if (!window.state?.products) return;
        let product = window.state.products.find(p => p.id === id);
        if (!product) {
            const clean = id.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
            product = window.state.products.find(p => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase()));
        }
        if (product) open(product);
    };
}
