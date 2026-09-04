// ============ ESTADO GLOBAL ============
const state = {
    currentUser: null,
    userProfile: null,
    products: [],
    filteredProducts: [],
    categories: [],
    favorites: [],
    cart: [],
    currentFilter: 'all',
    searchQuery: '',
    currentProduct: null,
    mediaIndex: 0,
    mediaInterval: null,
    isLoading: true,
    authMode: 'login',
    isMenuOpen: false,
    mediaTimer: null
};

// ============ UTILITÁRIOS ============
function formatPrice(price) {
    if (price === null || price === undefined || isNaN(price)) return 'R$ 0,00';
    return `R$ ${Number(price).toFixed(2).replace('.', ',')}`;
}

function calculateDiscount(oldPrice, currentPrice) {
    if (!oldPrice || !currentPrice || oldPrice <= currentPrice) return 0;
    return Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function showConfirmModal(message, onConfirm, confirmText = 'Remover') {
    const modal = document.getElementById('confirmModal');
    const body = document.getElementById('confirmModalBody');
    if (!modal || !body) return;
    
    body.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h3 style="margin-bottom: 16px; font-size: 18px; color: var(--text-primary);">${message}</h3>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button class="btn btn-secondary" id="confirmCancelBtn">Cancelar</button>
                <button class="btn btn-primary" id="confirmYesBtn">${confirmText}</button>
            </div>
        </div>
    `;
    
    showModal('confirmModal');
    
    document.getElementById('confirmCancelBtn').addEventListener('click', () => {
        hideModal('confirmModal');
    });
    
    document.getElementById('confirmYesBtn').addEventListener('click', () => {
        hideModal('confirmModal');
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============ GERENCIAMENTO DE CARRINHO ============
function loadCart() {
    try {
        const savedCart = localStorage.getItem('shopflow_cart');
        if (savedCart) {
            state.cart = JSON.parse(savedCart);
        }
    } catch (e) {
        state.cart = [];
    }
    updateCartUI();
}

function saveCart() {
    try {
        localStorage.setItem('shopflow_cart', JSON.stringify(state.cart));
    } catch (e) {
        console.error('Erro ao salvar carrinho:', e);
    }
    updateCartUI();
}

function addToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        state.cart.push({
            id: product.id,
            quantity: 1
        });
    }
    
    saveCart();
    showToast('Produto adicionado ao carrinho!', 'success');
}

function removeFromCart(productId) {
    showConfirmModal('Tem certeza que deseja remover este produto do carrinho?', () => {
        state.cart = state.cart.filter(item => item.id !== productId);
        saveCart();
        showToast('Produto removido do carrinho.', 'info');
        renderCart();
    });
}

function updateCartUI() {
    const cartCount = state.cart.reduce((total, item) => total + (item.quantity || 1), 0);
    const cartCountEl = document.getElementById('cartCount');
    const sidebarCartCount = document.getElementById('sidebarCartCount');
    
    if (cartCountEl) {
        if (cartCount > 0) {
            cartCountEl.textContent = cartCount;
            cartCountEl.style.display = 'flex';
        } else {
            cartCountEl.style.display = 'none';
        }
    }
    
    if (sidebarCartCount) {
        if (cartCount > 0) {
            sidebarCartCount.textContent = cartCount;
            sidebarCartCount.style.display = 'flex';
        } else {
            sidebarCartCount.style.display = 'none';
        }
    }
}

function renderCart() {
    const cartModalBody = document.getElementById('cartModalBody');
    if (!cartModalBody) return;
    
    if (state.cart.length === 0) {
        cartModalBody.innerHTML = `
            <div class="cart-header" style="margin-bottom: 20px;">
                <h3 class="cart-title" style="font-size: 24px; font-weight: 700;">Carrinho</h3>
            </div>
            <div class="cart-empty" style="text-align: center; padding: 40px 20px;">
                <p style="font-size: 48px; margin-bottom: 16px;">🛒</p>
                <p style="color: var(--text-secondary);">Seu carrinho está vazio.</p>
            </div>
        `;
        return;
    }
    
    let totalPrice = 0;
    let cartItemsHTML = '';
    
    state.cart.forEach(item => {
        const product = state.products.find(p => p.id === item.id);
        if (!product) return;
        
        const price = product.price || 0;
        totalPrice += price * (item.quantity || 1);
        
        let mediaUrl = product.images && product.images.length > 0 ? product.images[0] : 'https://via.placeholder.com/80x80?text=SFB';
        let mediaType = 'image';
        
        if (product.video_url) {
            mediaUrl = product.video_url;
            mediaType = 'video';
        }
        
        cartItemsHTML += `
            <div class="cart-item" style="display: flex; gap: 12px; padding: 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 12px;">
                <div class="cart-item-image" style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; flex-shrink: 0;">
                    ${mediaType === 'video' ? 
                        `<video src="${mediaUrl}" muted loop playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>` : 
                        `<img src="${mediaUrl}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">`}
                </div>
                <div class="cart-item-info" style="flex: 1;">
                    <div class="cart-item-name" style="font-weight: 600; margin-bottom: 4px;">${product.name}</div>
                    <div class="cart-item-price" style="color: var(--accent); font-weight: 600;">${formatPrice(price)}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Qtd: ${item.quantity || 1}</div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart('${product.id}')" 
                        style="background: none; border: none; color: var(--text-muted); font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"
                        aria-label="Remover produto">×</button>
            </div>
        `;
    });
    
    cartModalBody.innerHTML = `
        <div class="cart-header" style="margin-bottom: 20px;">
            <h3 class="cart-title" style="font-size: 24px; font-weight: 700;">Carrinho</h3>
        </div>
        <div class="cart-items" style="margin-bottom: 20px;">
            ${cartItemsHTML}
        </div>
        <div class="cart-total" style="display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid var(--border-color);">
            <span style="font-weight: 600;">Total:</span>
            <span style="font-size: 20px; font-weight: 700; color: var(--accent);">${formatPrice(totalPrice)}</span>
        </div>
    `;
}

// ============ FAVORITOS ============
async function loadFavorites() {
    if (!state.currentUser) {
        state.favorites = [];
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select('product_id')
            .eq('user_id', state.currentUser.id);
        
        if (error) throw error;
        
        state.favorites = (data || []).map(fav => fav.product_id);
        updateFavoritesUI();
    } catch (error) {
        console.error('Erro ao carregar favoritos:', error);
        state.favorites = [];
    }
}

async function toggleFavorite(productId) {
    if (!state.currentUser) {
        showAuthModal();
        showToast('Faça login para favoritar produtos.', 'info');
        return;
    }
    
    const isFavorite = state.favorites.includes(productId);
    
    try {
        if (isFavorite) {
            const { error } = await supabase
                .from('favorites')
                .delete()
                .eq('user_id', state.currentUser.id)
                .eq('product_id', productId);
            
            if (error) throw error;
            
            state.favorites = state.favorites.filter(id => id !== productId);
            showToast('Produto removido dos favoritos.', 'info');
        } else {
            const { error } = await supabase
                .from('favorites')
                .insert([
                    { user_id: state.currentUser.id, product_id: productId }
                ]);
            
            if (error) throw error;
            
            state.favorites.push(productId);
            showToast('Produto adicionado aos favoritos!', 'success');
        }
        
        updateFavoritesUI();
    } catch (error) {
        console.error('Erro ao atualizar favorito:', error);
        showToast('Erro ao atualizar favorito. Tente novamente.', 'error');
    }
}

function updateFavoritesUI() {
    document.querySelectorAll('.product-favorite').forEach(btn => {
        const productId = btn.dataset.productId;
        if (state.favorites.includes(productId)) {
            btn.classList.add('active');
            btn.textContent = '♥';
        } else {
            btn.classList.remove('active');
            btn.textContent = '♡';
        }
    });
}

function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// ============ MÍDIA DOS PRODUTOS ============
function getProductMedia(product) {
    if (product.video_url) {
        return {
            type: 'video',
            url: product.video_url
        };
    }
    
    if (product.images && product.images.length > 0) {
        return {
            type: 'image',
            url: product.images[0],
            images: product.images
        };
    }
    
    return {
        type: 'image',
        url: 'https://via.placeholder.com/400x300?text=ShopFlowBrasil'
    };
}

// ============ RENDERIZAÇÃO DE PRODUTOS ============
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    const count = document.getElementById('productsCount');
    const title = document.getElementById('productsTitle');
    
    if (!grid) return;
    
    if (state.isLoading) {
        grid.innerHTML = Array(6).fill('<div class="product-skeleton"></div>').join('');
        return;
    }
    
    if (state.filteredProducts.length === 0) {
        grid.innerHTML = `
            <div class="products-error" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <div class="error-icon" style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                <p style="color: var(--text-secondary);">Nenhum produto encontrado.</p>
            </div>
        `;
        if (count) count.textContent = '';
        if (title) title.textContent = 'Nenhum produto encontrado';
        return;
    }
    
    if (count) count.textContent = `${state.filteredProducts.length} produto(s)`;
    
    let productsHTML = '';
    
    state.filteredProducts.forEach(product => {
        const media = getProductMedia(product);
        const discount = calculateDiscount(product.old_price, product.price);
        const favorite = isFavorite(product.id);
        
        let badgesHTML = '';
        if (product.is_promo) {
            badgesHTML += `<span class="product-badge badge-promo">🔥 Oferta</span>`;
        }
        if (product.rating >= 4.5) {
            badgesHTML += `<span class="product-badge badge-rating">⭐ Melhor avaliado</span>`;
        }
        if (discount > 0) {
            badgesHTML += `<span class="product-badge badge-price">-${discount}%</span>`;
        }
        
        productsHTML += `
            <div class="product-card" data-product-id="${product.id}" onclick="openProductDetail('${product.id}')">
                <div class="product-media">
                    ${media.type === 'video' ? 
                        `<video src="${media.url}" autoplay muted loop playsinline></video>` : 
                        `<img src="${media.url}" alt="${product.name}" loading="lazy">`}
                    ${badgesHTML}
                    <button class="product-favorite ${favorite ? 'active' : ''}" 
                            data-product-id="${product.id}"
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')"
                            aria-label="Favoritar produto">
                        ${favorite ? '♥' : '♡'}
                    </button>
                </div>
                <div class="product-info">
                    <div class="product-category">${product.category || 'Sem categoria'}</div>
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-rating">⭐ ${product.rating || 'N/A'}</div>
                    <div class="product-price">
                        ${product.old_price ? `<span class="product-old-price">${formatPrice(product.old_price)}</span>` : ''}
                        <span class="product-current-price">${formatPrice(product.price)}</span>
                        ${discount > 0 ? `<span class="product-discount">-${discount}%</span>` : ''}
                    </div>
                    <div class="product-actions">
                        <button class="product-action-btn primary" 
                                onclick="event.stopPropagation(); buyProduct('${product.id}')">
                            Ver produto
                        </button>
                        <button class="product-action-btn" 
                                onclick="event.stopPropagation(); addToCart('${product.id}')">
                            🛒
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = productsHTML;
    updateFavoritesUI();
}

function applyFilters() {
    let filtered = [...state.products];
    
    // Aplicar pesquisa
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(product => {
            const name = (product.name || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            return name.includes(query) || description.includes(query) || category.includes(query);
        });
    }
    
    // Aplicar filtro
    switch (state.currentFilter) {
        case 'best-rated':
            filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
        case 'lowest-price':
            filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
            break;
        case 'highest-price':
            filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
            break;
        case 'promos':
            filtered = filtered.filter(p => p.is_promo);
            break;
        case 'newest':
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        default:
            break;
    }
    
    state.filteredProducts = filtered;
    renderProducts();
    
    // Atualizar título
    const titles = {
        'all': 'Todos os produtos',
        'best-rated': 'Melhor avaliados',
        'lowest-price': 'Menor preço',
        'highest-price': 'Maior preço',
        'promos': 'Promoções',
        'newest': 'Mais recentes'
    };
    const titleEl = document.getElementById('productsTitle');
    if (titleEl) titleEl.textContent = titles[state.currentFilter] || 'Produtos';
}

// ============ CARREGAR DADOS ============
async function loadProducts() {
    state.isLoading = true;
    renderProducts();
    
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        state.products = data || [];
        state.filteredProducts = [...state.products];
        state.isLoading = false;
        
        updateStats();
        applyFilters();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        state.isLoading = false;
        
        const grid = document.getElementById('productsGrid');
        const errorEl = document.getElementById('productsError');
        if (grid) grid.innerHTML = '';
        if (errorEl) errorEl.style.display = 'block';
    }
}

async function loadCategories() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('category')
            .eq('active', true)
            .not('category', 'is', null);
        
        if (error) throw error;
        
        const categories = [...new Set((data || []).map(item => item.category))];
        state.categories = categories;
        renderCategories();
        updateStats();
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        state.categories = [];
        renderCategories();
    }
}

function renderCategories() {
    const sidebarCategories = document.getElementById('sidebarCategories');
    if (!sidebarCategories) return;
    
    if (state.categories.length === 0) {
        sidebarCategories.innerHTML = '<span style="color: var(--text-muted); font-size: 14px;">Nenhuma categoria.</span>';
        return;
    }
    
    sidebarCategories.innerHTML = state.categories.map(category => `
        <button class="category-chip" onclick="searchByCategory('${category.replace(/'/g, "\\'")}')" 
                style="padding: 6px 14px; background: var(--bg-tertiary); border: 1px solid var(--border-color); 
                       border-radius: 50px; cursor: pointer; font-size: 13px; color: var(--text-secondary); 
                       transition: all 0.3s; white-space: nowrap;">
            ${category}
        </button>
    `).join('');
}

function updateStats() {
    const statProducts = document.getElementById('statProducts');
    const statPromos = document.getElementById('statPromos');
    const statCategories = document.getElementById('statCategories');
    
    if (statProducts) statProducts.textContent = state.products.length;
    if (statPromos) statPromos.textContent = state.products.filter(p => p.is_promo).length;
    if (statCategories) statCategories.textContent = state.categories.length;
}

// ============ DETALHE DO PRODUTO ============
function openProductDetail(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    state.currentProduct = product;
    state.mediaIndex = 0;
    
    const modalBody = document.getElementById('productModalBody');
    if (!modalBody) return;
    
    const media = getProductMedia(product);
    const discount = calculateDiscount(product.old_price, product.price);
    const favorite = isFavorite(product.id);
    
    let mediaHTML = '';
    
    if (media.type === 'video') {
        mediaHTML = `
            <video src="${media.url}" controls autoplay muted loop playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
        `;
    } else if (media.images && media.images.length > 1) {
        mediaHTML = `
            <img src="${media.images[0]}" alt="${product.name}" id="detailImage" style="width: 100%; height: 100%; object-fit: cover;">
            <button class="product-media-nav product-media-prev" onclick="changeMedia(-1)" style="position: absolute; top: 50%; transform: translateY(-50%); left: 16px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; color: white; font-size: 20px;">❮</button>
            <button class="product-media-nav product-media-next" onclick="changeMedia(1)" style="position: absolute; top: 50%; transform: translateY(-50%); right: 16px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; color: white; font-size: 20px;">❯</button>
            <div class="product-media-dots" style="position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px;">
                ${media.images.map((img, index) => `
                    <span class="product-media-dot ${index === 0 ? 'active' : ''}" 
                          onclick="setMedia(${index})" 
                          style="width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.3s;"></span>
                `).join('')}
            </div>
        `;
    } else {
        mediaHTML = `
            <img src="${media.url}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">
        `;
    }
    
    modalBody.innerHTML = `
        <div class="product-detail" style="display: grid; grid-template-columns: 1fr; gap: 24px;">
            <div class="product-detail-media" style="position: relative; aspect-ratio: 16/10; background: var(--bg-tertiary); border-radius: 12px; overflow: hidden;">
                ${mediaHTML}
            </div>
            <div class="product-detail-info">
                <div class="product-detail-category" style="font-size: 14px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">${product.category || 'Sem categoria'}</div>
                <h2 class="product-detail-name" style="font-size: 24px; font-weight: 700; margin-bottom: 12px;">${product.name}</h2>
                <div class="product-detail-rating" style="margin-bottom: 16px; font-size: 16px; color: var(--rating);">⭐ ${product.rating || 'N/A'}</div>
                <div class="product-detail-price" style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px;">
                    ${product.old_price ? `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 18px;">${formatPrice(product.old_price)}</span>` : ''}
                    <span style="font-size: 28px; font-weight: 700;">${formatPrice(product.price)}</span>
                    ${discount > 0 ? `<span class="product-discount" style="background: var(--promo); color: white; padding: 4px 8px; border-radius: 50px; font-size: 14px; font-weight: 600;">-${discount}%</span>` : ''}
                </div>
                ${product.description ? `<p style="color: var(--text-secondary); line-height: 1.7; margin-bottom: 24px;">${product.description}</p>` : ''}
                <div class="product-detail-actions" style="display: flex; gap: 12px; margin-top: auto;">
                    <button class="btn btn-primary" onclick="buyProduct('${product.id}')" style="flex: 1;">Comprar</button>
                    <button class="btn btn-secondary" onclick="toggleFavorite('${product.id}')">${favorite ? '♥' : '♡'}</button>
                    <button class="btn btn-secondary" onclick="addToCart('${product.id}'); hideModal('productModal');">🛒</button>
                </div>
            </div>
        </div>
    `;
    
    showModal('productModal');
}

function changeMedia(direction) {
    const product = state.currentProduct;
    if (!product || !product.images) return;
    
    state.mediaIndex += direction;
    if (state.mediaIndex < 0) state.mediaIndex = product.images.length - 1;
    if (state.mediaIndex >= product.images.length) state.mediaIndex = 0;
    
    updateMediaDisplay();
}

function setMedia(index) {
    state.mediaIndex = index;
    updateMediaDisplay();
}

function updateMediaDisplay() {
    const product = state.currentProduct;
    if (!product || !product.images) return;
    
    const imageEl = document.getElementById('detailImage');
    if (imageEl) {
        imageEl.src = product.images[state.mediaIndex];
    }
    
    document.querySelectorAll('.product-media-dot').forEach((dot, index) => {
        if (index === state.mediaIndex) {
            dot.style.background = 'white';
            dot.style.transform = 'scale(1.3)';
        } else {
            dot.style.background = 'rgba(255,255,255,0.5)';
            dot.style.transform = 'scale(1)';
        }
    });
}

function buyProduct(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || !product.product_url) {
        showToast('Link do produto não disponível.', 'error');
        return;
    }
    
    window.open(product.product_url, '_blank');
}

// ============ AUTENTICAÇÃO ============
function showAuthModal(mode = 'login') {
    state.authMode = mode;
    
    const modalBody = document.getElementById('authModalBody');
    if (!modalBody) return;
    
    const isLogin = mode === 'login';
    
    modalBody.innerHTML = `
        <h2 style="margin-bottom: 24px; text-align: center; font-size: 24px; font-weight: 700;">
            ${isLogin ? 'Entrar' : 'Criar conta'}
        </h2>
        
        <div class="auth-tabs" style="display: flex; gap: 12px; margin-bottom: 24px;">
            <button class="auth-tab ${isLogin ? 'active' : ''}" onclick="switchAuthMode('login')" 
                    style="flex: 1; padding: 12px; text-align: center; background: ${isLogin ? 'var(--accent)' : 'var(--bg-card)'}; 
                           border: 1px solid ${isLogin ? 'var(--accent)' : 'var(--border-color)'}; border-radius: 50px; 
                           cursor: pointer; color: ${isLogin ? 'white' : 'var(--text-primary)'}; font-weight: 500;">
                Login
            </button>
            <button class="auth-tab ${!isLogin ? 'active' : ''}" onclick="switchAuthMode('register')" 
                    style="flex: 1; padding: 12px; text-align: center; background: ${!isLogin ? 'var(--accent)' : 'var(--bg-card)'}; 
                           border: 1px solid ${!isLogin ? 'var(--accent)' : 'var(--border-color)'}; border-radius: 50px; 
                           cursor: pointer; color: ${!isLogin ? 'white' : 'var(--text-primary)'}; font-weight: 500;">
                Cadastro
            </button>
        </div>
        
        <form class="auth-form" id="authForm" onsubmit="handleAuth(event)" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
                <label class="form-label" style="font-size: 14px; font-weight: 500; color: var(--text-secondary);">Usuário</label>
                <input type="text" id="authUsername" required 
                       style="padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border-color); 
                              border-radius: 8px; color: var(--text-primary); font-size: 14px;"
                       placeholder="Seu usuário">
            </div>
            
            ${!isLogin ? `
                <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
                    <label class="form-label" style="font-size: 14px; font-weight: 500; color: var(--text-secondary);">Email</label>
                    <input type="email" id="authEmail" required 
                           style="padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border-color); 
                                  border-radius: 8px; color: var(--text-primary); font-size: 14px;"
                           placeholder="seu@email.com">
                </div>
            ` : ''}
            
            <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
                <label class="form-label" style="font-size: 14px; font-weight: 500; color: var(--text-secondary);">Senha</label>
                <input type="password" id="authPassword" required 
                       style="padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border-color); 
                              border-radius: 8px; color: var(--text-primary); font-size: 14px;"
                       placeholder="Sua senha" minlength="8">
            </div>
            
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 8px;">
                ${isLogin ? 'Entrar' : 'Cadastrar'}
            </button>
        </form>
        
        ${isLogin ? `
            <div style="text-align: center; margin-top: 16px;">
                <a href="#" class="forgot-password" onclick="handleForgotPassword(event)" 
                   style="color: var(--text-muted); text-decoration: none; font-size: 13px;">
                    Esqueci minha senha
                </a>
            </div>
        ` : ''}
    `;
    
    showModal('authModal');
}

function switchAuthMode(mode) {
    state.authMode = mode;
    showAuthModal(mode);
}

function handleForgotPassword(event) {
    event.preventDefault();
    hideModal('authModal');
    showToast('Recuperação de senha enviada para seu email.', 'info');
}

async function handleAuth(event) {
    event.preventDefault();
    
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    
    if (!username || !password) {
        showToast('Preencha todos os campos.', 'error');
        return;
    }
    
    if (state.authMode === 'login') {
        try {
            // Buscar usuário pelo username
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('username', username)
                .single();
            
            if (profileError) {
                showToast('Usuário não encontrado.', 'error');
                return;
            }
            
            // Fazer login com email
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: profiles.email,
                password: password
            });
            
            if (authError) {
                if (authError.message.includes('Invalid login credentials')) {
                    showToast('Senha incorreta.', 'error');
                } else {
                    showToast('Erro ao fazer login. Tente novamente.', 'error');
                }
                return;
            }
            
            state.currentUser = authData.user;
            state.userProfile = profiles;
            
            updateUserUI();
            loadFavorites();
            hideModal('authModal');
            showToast(`Bem-vindo, ${profiles.username}!`, 'success');
        } catch (error) {
            console.error('Erro no login:', error);
            showToast('Erro ao fazer login. Tente novamente.', 'error');
        }
    } else {
        try {
            const email = document.getElementById('authEmail').value.trim();
            
            if (!email) {
                showToast('Preencha o email.', 'error');
                return;
            }
            
            // Registrar no Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username
                    }
                }
            });
            
            if (authError) throw authError;
            
            showToast('Conta criada com sucesso! Verifique seu email.', 'success');
            hideModal('authModal');
            
            // Tentar criar perfil manualmente
            if (authData.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: authData.user.id,
                            username: username,
                            email: email,
                            role: 'user'
                        }
                    ]);
                
                if (profileError) {
                    console.error('Erro ao criar perfil:', profileError);
                }
            }
        } catch (error) {
            console.error('Erro no cadastro:', error);
            if (error.message.includes('already registered')) {
                showToast('Este email já está cadastrado.', 'error');
            } else {
                showToast('Erro ao criar conta. Tente novamente.', 'error');
            }
        }
    }
}

function updateUserUI() {
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    
    if (!userName || !userAvatar) return;
    
    if (state.currentUser && state.userProfile) {
        userName.textContent = state.userProfile.username;
        
        if (state.userProfile.avatar_url) {
            userAvatar.innerHTML = `<img src="${state.userProfile.avatar_url}" alt="${state.userProfile.username}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            userAvatar.innerHTML = '<span class="user-placeholder">👤</span>';
        }
    } else {
        userName.textContent = 'Entrar';
        userAvatar.innerHTML = '<span class="user-placeholder">👤</span>';
    }
}

async function logout() {
    try {
        await supabase.auth.signOut();
        state.currentUser = null;
        state.userProfile = null;
        state.favorites = [];
        updateUserUI();
        showToast('Logout realizado com sucesso.', 'info');
    } catch (error) {
        console.error('Erro ao sair:', error);
    }
}

// ============ PESQUISA ============
function searchByCategory(category) {
    state.searchQuery = category;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = category;
    }
    const searchClear = document.getElementById('searchClear');
    if (searchClear) searchClear.style.display = 'block';
    closeMenu();
    applyFilters();
}

// ============ MENU ============
function openMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('menuOverlay');
    
    if (!sidebar || !overlay) return;
    
    state.isMenuOpen = true;
    sidebar.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('menuOverlay');
    
    if (!sidebar || !overlay) return;
    
    state.isMenuOpen = false;
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ============ REALTIME ============
function setupRealtime() {
    try {
        const channel = supabase
            .channel('products-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                (payload) => {
                    console.log('Mudança detectada:', payload);
                    loadProducts();
                    loadCategories();
                }
            )
            .subscribe();
    } catch (error) {
        console.error('Erro ao configurar Realtime:', error);
    }
}

// ============ INICIALIZAÇÃO ============
async function initApp() {
    // Carregar carrinho
    loadCart();
    
    // Verificar sessão
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            
            // Carregar perfil
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
            
            if (profiles) {
                state.userProfile = profiles;
            }
            
            updateUserUI();
            loadFavorites();
        }
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
    }
    
    // Carregar dados
    await Promise.all([
        loadProducts(),
        loadCategories()
    ]);
    
    // Configurar Realtime
    setupRealtime();
    
    // Event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Menu
    const menuToggle = document.getElementById('menuToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openMenu();
        });
    }
    
    if (sidebarClose) {
        sidebarClose.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeMenu();
        });
    }
    
    if (menuOverlay) {
        menuOverlay.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeMenu();
        });
    }
    
    // Fechar menu com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMenu();
            hideModal('productModal');
            hideModal('cartModal');
            hideModal('authModal');
            hideModal('confirmModal');
        }
    });
    
    // Pesquisa
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            state.searchQuery = e.target.value.trim();
            if (searchClear) {
                searchClear.style.display = state.searchQuery ? 'block' : 'none';
            }
            applyFilters();
        }, 300));
    }
    
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
            }
            state.searchQuery = '';
            searchClear.style.display = 'none';
            applyFilters();
            if (searchInput) searchInput.focus();
        });
    }
    
    // Filtros
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.currentFilter = chip.dataset.filter;
            applyFilters();
        });
    });
    
    // Botões hero
    const heroPromoBtn = document.getElementById('heroPromoBtn');
    const heroAllBtn = document.getElementById('heroAllBtn');
    
    if (heroPromoBtn) {
        heroPromoBtn.addEventListener('click', () => {
            state.currentFilter = 'promos';
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            const promoFilter = document.querySelector('[data-filter="promos"]');
            if (promoFilter) promoFilter.classList.add('active');
            applyFilters();
            const productsTitle = document.getElementById('productsTitle');
            if (productsTitle) productsTitle.scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    if (heroAllBtn) {
        heroAllBtn.addEventListener('click', () => {
            state.currentFilter = 'all';
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            const allFilter = document.querySelector('[data-filter="all"]');
            if (allFilter) allFilter.classList.add('active');
            applyFilters();
            const productsTitle = document.getElementById('productsTitle');
            if (productsTitle) productsTitle.scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    // User button
    const userBtn = document.getElementById('userBtn');
    if (userBtn) {
        userBtn.addEventListener('click', () => {
            if (state.currentUser) {
                showToast('Perfil em desenvolvimento.', 'info');
            } else {
                showAuthModal('login');
            }
        });
    }
    
    // Cart button
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            renderCart();
            showModal('cartModal');
        });
    }
    
    // Sidebar links
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const action = link.dataset.action;
            
            switch (action) {
                case 'cart':
                    closeMenu();
                    renderCart();
                    showModal('cartModal');
                    break;
                case 'best-rated':
                    closeMenu();
                    state.currentFilter = 'best-rated';
                    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                    const bestRatedFilter = document.querySelector('[data-filter="best-rated"]');
                    if (bestRatedFilter) bestRatedFilter.classList.add('active');
                    applyFilters();
                    break;
                case 'lowest-price':
                    closeMenu();
                    state.currentFilter = 'lowest-price';
                    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                    const lowestPriceFilter = document.querySelector('[data-filter="lowest-price"]');
                    if (lowestPriceFilter) lowestPriceFilter.classList.add('active');
                    applyFilters();
                    break;
                case 'account':
                    closeMenu();
                    if (state.currentUser) {
                        showToast('Perfil em desenvolvimento.', 'info');
                    } else {
                        showAuthModal('login');
                    }
                    break;
            }
        });
    });
    
    // Modal close buttons
    const modalCloseButtons = {
        'productModalClose': 'productModal',
        'cartModalClose': 'cartModal',
        'authModalClose': 'authModal',
        'confirmModalClose': 'confirmModal'
    };
    
    Object.entries(modalCloseButtons).forEach(([btnId, modalId]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => hideModal(modalId));
        }
    });
    
    // Retry button
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            const errorEl = document.getElementById('productsError');
            if (errorEl) errorEl.style.display = 'none';
            loadProducts();
        });
    }
    
    // Fechar modais clicando no overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    });
}

// Expor funções globalmente
window.formatPrice = formatPrice;
window.calculateDiscount = calculateDiscount;
window.showToast = showToast;
window.showModal = showModal;
window.hideModal = hideModal;
window.showConfirmModal = showConfirmModal;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.renderCart = renderCart;
window.toggleFavorite = toggleFavorite;
window.openProductDetail = openProductDetail;
window.changeMedia = changeMedia;
window.setMedia = setMedia;
window.buyProduct = buyProduct;
window.showAuthModal = showAuthModal;
window.switchAuthMode = switchAuthMode;
window.handleAuth = handleAuth;
window.handleForgotPassword = handleForgotPassword;
window.searchByCategory = searchByCategory;
window.openMenu = openMenu;
window.closeMenu = closeMenu;

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}