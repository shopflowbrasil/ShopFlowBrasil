// ============ ESTADO ADMIN ============
const adminState = {
    currentUser: null,
    userProfile: null,
    products: [],
    categories: [],
    currentTab: 'dashboard',
    editingProduct: null,
    isNewProduct: false,
    productSearchQuery: '',
    productFilter: 'all',
    productCategoryFilter: 'all',
    productSortBy: 'newest',
    mediaFiles: {
        images: [],
        video: null
    },
    isInitialized: false
};

// ============ UTILITÁRIOS ============
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

function showConfirmModal(message, onConfirm, confirmText = 'Confirmar') {
    const modal = document.getElementById('confirmModal');
    const body = document.getElementById('confirmModalBody');
    if (!modal || !body) return;
    
    body.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <p style="font-size: 16px; margin-bottom: 24px; color: var(--text-primary);">${message}</p>
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

function formatPrice(price) {
    if (price === null || price === undefined || isNaN(price)) return 'R$ 0,00';
    return `R$ ${Number(price).toFixed(2).replace('.', ',')}`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// ============ AUTENTICAÇÃO ADMIN (OBRIGATÓRIA) ============
async function checkAdminAccess() {
    console.log('Verificando acesso admin...');
    
    // Verificar se Supabase está inicializado
    if (!supabase) {
        console.error('Supabase não inicializado');
        window.location.href = 'index.html';
        return;
    }
    
    try {
        // Verificar sessão atual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            console.error('Erro ao verificar sessão:', sessionError);
            window.location.href = 'index.html';
            return;
        }
        
        // SE NÃO HOUVER SESSÃO, REDIRECIONAR IMEDIATAMENTE PARA INDEX
        if (!session) {
            console.log('Nenhuma sessão encontrada. Redirecionando para index...');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('Sessão encontrada:', session.user.id);
        adminState.currentUser = session.user;
        
        // Buscar perfil do usuário
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
        
        if (profileError) {
            console.error('Erro ao buscar perfil:', profileError);
            window.location.href = 'index.html';
            return;
        }
        
        // Se não encontrar perfil, redirecionar
        if (!profile) {
            console.log('Perfil não encontrado. Redirecionando...');
            window.location.href = 'index.html';
            return;
        }
        
        // VERIFICAR SE É ADMIN - SE NÃO FOR, REDIRECIONAR
        if (profile.role !== 'admin') {
            console.log('Usuário não é admin:', profile.role, '. Redirecionando...');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('Acesso admin concedido para:', profile.username);
        adminState.userProfile = profile;
        
        // Atualizar UI
        updateAdminUI(profile);
        
        // Carregar dados
        await loadAdminData();
        
        // Configurar event listeners
        setupAdminEventListeners();
        
        // Configurar Realtime
        setupRealtime();
        
        showToast(`Bem-vindo, ${profile.username}!`, 'success');
        
    } catch (error) {
        console.error('Erro ao verificar acesso admin:', error);
        window.location.href = 'index.html';
    }
}

// Função para atualizar UI do admin
function updateAdminUI(profile) {
    const userNameEl = document.getElementById('adminUserName');
    const userAvatarEl = document.getElementById('adminUserAvatar');
    
    if (userNameEl) {
        userNameEl.textContent = profile.username || 'Admin';
    }
    
    if (userAvatarEl) {
        if (profile.avatar_url) {
            userAvatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="${profile.username}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            userAvatarEl.innerHTML = '<span class="user-placeholder">👤</span>';
        }
    }
}

// ============ CARREGAR DADOS ============
async function loadAdminData() {
    await Promise.all([
        loadAdminProducts(),
        loadAdminCategories()
    ]);
    
    updateAdminStats();
    updateCategoryFilter();
}

async function loadAdminProducts() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        adminState.products = data || [];
        renderAdminProducts();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        const list = document.getElementById('adminProductsList');
        if (list) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <p>Erro ao carregar produtos. Tente novamente.</p>
                </div>
            `;
        }
    }
}

async function loadAdminCategories() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('category')
            .not('category', 'is', null);
        
        if (error) throw error;
        
        adminState.categories = [...new Set((data || []).map(item => item.category))];
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        adminState.categories = [];
    }
}

function updateAdminStats() {
    const totalProducts = adminState.products.length;
    const activeProducts = adminState.products.filter(p => p.active).length;
    const promoProducts = adminState.products.filter(p => p.is_promo).length;
    const categoriesCount = adminState.categories.length;
    
    const statProducts = document.getElementById('adminStatProducts');
    const statPromos = document.getElementById('adminStatPromos');
    const statCategories = document.getElementById('adminStatCategories');
    const statActive = document.getElementById('adminStatActive');
    
    if (statProducts) statProducts.textContent = totalProducts;
    if (statPromos) statPromos.textContent = promoProducts;
    if (statCategories) statCategories.textContent = categoriesCount;
    if (statActive) statActive.textContent = activeProducts;
    
    const affiliateProducts = document.getElementById('affiliateProducts');
    const affiliatePromos = document.getElementById('affiliatePromos');
    
    if (affiliateProducts) affiliateProducts.textContent = totalProducts;
    if (affiliatePromos) affiliatePromos.textContent = promoProducts;
}

function updateCategoryFilter() {
    const categoryFilter = document.getElementById('adminProductCategoryFilter');
    if (!categoryFilter) return;
    
    const currentValue = categoryFilter.value;
    
    categoryFilter.innerHTML = `
        <option value="all">Todas categorias</option>
        ${adminState.categories.map(cat => `
            <option value="${cat}" ${currentValue === cat ? 'selected' : ''}>${cat}</option>
        `).join('')}
    `;
}

// ============ RENDERIZAR PRODUTOS COM BUSCA AVANÇADA ============
function renderAdminProducts() {
    const list = document.getElementById('adminProductsList');
    if (!list) return;
    
    let filteredProducts = [...adminState.products];
    
    // Aplicar busca por texto
    if (adminState.productSearchQuery) {
        const query = adminState.productSearchQuery.toLowerCase();
        filteredProducts = filteredProducts.filter(product => {
            return (product.name || '').toLowerCase().includes(query) ||
                   (product.category || '').toLowerCase().includes(query) ||
                   (product.description || '').toLowerCase().includes(query) ||
                   (String(product.price || '')).includes(query);
        });
    }
    
    // Aplicar filtro de status
    switch (adminState.productFilter) {
        case 'active':
            filteredProducts = filteredProducts.filter(p => p.active);
            break;
        case 'inactive':
            filteredProducts = filteredProducts.filter(p => !p.active);
            break;
        case 'promo':
            filteredProducts = filteredProducts.filter(p => p.is_promo);
            break;
    }
    
    // Aplicar filtro de categoria
    if (adminState.productCategoryFilter !== 'all') {
        filteredProducts = filteredProducts.filter(p => p.category === adminState.productCategoryFilter);
    }
    
    // Aplicar ordenação
    switch (adminState.productSortBy) {
        case 'newest':
            filteredProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'oldest':
            filteredProducts.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'price-low':
            filteredProducts.sort((a, b) => (a.price || 0) - (b.price || 0));
            break;
        case 'price-high':
            filteredProducts.sort((a, b) => (b.price || 0) - (a.price || 0));
            break;
        case 'name':
            filteredProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
    }
    
    // Mostrar contagem de resultados
    const resultCount = document.getElementById('adminResultCount');
    if (resultCount) {
        resultCount.textContent = `${filteredProducts.length} produto(s) encontrado(s)`;
    }
    
    if (filteredProducts.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <p style="font-size: 48px; margin-bottom: 16px;">🔍</p>
                <p style="font-size: 16px; margin-bottom: 8px;">Nenhum produto encontrado.</p>
                <p style="font-size: 14px;">Tente ajustar sua busca ou filtros.</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = filteredProducts.map(product => {
        let mediaUrl = product.images && product.images.length > 0 ? 
            product.images[0] : 
            (product.video_url || 'https://via.placeholder.com/60x60?text=SFB');
        
        const mediaType = product.video_url ? 'video' : 'image';
        const isActive = product.active;
        const isPromo = product.is_promo;
        
        return `
            <div class="admin-product-item" style="display: flex; align-items: center; gap: 16px; padding: 16px; 
                 background: var(--bg-card); border: 1px solid ${isActive ? 'var(--border-color)' : 'rgba(255, 71, 87, 0.3)'}; 
                 border-radius: 12px; margin-bottom: 12px; transition: all 0.3s; 
                 opacity: ${isActive ? '1' : '0.7'};">
                <div class="admin-product-image" style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: var(--bg-tertiary);">
                    ${mediaType === 'video' ? 
                        `<video src="${mediaUrl}" muted loop playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>` : 
                        `<img src="${mediaUrl}" alt="${product.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">`}
                </div>
                <div class="admin-product-info" style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                        <span style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${product.name}
                        </span>
                        ${isPromo ? '<span style="background: var(--accent); color: white; padding: 2px 8px; border-radius: 50px; font-size: 10px; font-weight: 600;">🔥 PROMO</span>' : ''}
                        ${!isActive ? '<span style="background: var(--text-muted); color: white; padding: 2px 8px; border-radius: 50px; font-size: 10px; font-weight: 600;">INATIVO</span>' : ''}
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">
                        ${product.category || 'Sem categoria'}
                    </div>
                    <div style="font-size: 14px; font-weight: 600; color: var(--accent);">
                        ${formatPrice(product.price)}
                        ${product.old_price ? `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 12px; font-weight: 400; margin-left: 8px;">${formatPrice(product.old_price)}</span>` : ''}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                        Criado em: ${formatDate(product.created_at)}
                        ${product.rating ? ` • ⭐ ${product.rating}` : ''}
                    </div>
                </div>
                <div class="admin-product-actions" style="display: flex; gap: 8px; flex-shrink: 0;">
                    <button class="admin-action-btn" onclick="editProduct('${product.id}')" 
                            style="padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border-color); 
                                   background: var(--bg-tertiary); color: var(--text-primary); cursor: pointer; 
                                   font-size: 13px; font-weight: 500; transition: all 0.3s;"
                            onmouseover="this.style.background='var(--accent)'; this.style.color='white'; this.style.borderColor='var(--accent)'"
                            onmouseout="this.style.background='var(--bg-tertiary)'; this.style.color='var(--text-primary)'; this.style.borderColor='var(--border-color)'">
                        ✏️ Editar
                    </button>
                    <button class="admin-action-btn danger" onclick="toggleProductStatus('${product.id}')" 
                            style="padding: 10px 16px; border-radius: 8px; border: 1px solid ${isActive ? 'var(--accent)' : 'var(--success)'}; 
                                   background: transparent; color: ${isActive ? 'var(--accent)' : 'var(--success)'}; cursor: pointer; 
                                   font-size: 13px; font-weight: 500; transition: all 0.3s;"
                            onmouseover="this.style.background='${isActive ? 'var(--accent)' : 'var(--success)'}'; this.style.color='white'"
                            onmouseout="this.style.background='transparent'; this.style.color='${isActive ? 'var(--accent)' : 'var(--success)'}'">
                        ${isActive ? '🗑️ Excluir' : '↩️ Restaurar'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============ FORMULÁRIO DE PRODUTO ============
async function openNewProductForm() {
    adminState.isNewProduct = true;
    adminState.editingProduct = null;
    adminState.mediaFiles = { images: [], video: null };
    
    document.getElementById('productFormTitle').textContent = 'Novo Produto';
    
    const modalBody = document.getElementById('productFormBody');
    modalBody.innerHTML = productFormHTML();
    
    setupProductFormEvents();
    showModal('productFormModal');
}

async function editProduct(productId) {
    adminState.isNewProduct = false;
    adminState.editingProduct = adminState.products.find(p => p.id === productId);
    adminState.mediaFiles = { images: [], video: null };
    
    if (!adminState.editingProduct) return;
    
    document.getElementById('productFormTitle').textContent = 'Editar Produto';
    
    const modalBody = document.getElementById('productFormBody');
    modalBody.innerHTML = productFormHTML(adminState.editingProduct);
    
    setupProductFormEvents();
    showModal('productFormModal');
}

function productFormHTML(product = null) {
    return `
        <form id="productForm" onsubmit="handleProductSubmit(event)" style="display: flex; flex-direction: column; gap: 20px;">
            <div class="form-group">
                <label class="form-label">Fotos do produto (até 5)</label>
                <input type="file" id="productImages" accept="image/*" multiple class="form-input">
                ${product?.images?.length ? `
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                        ${product.images.map(img => `
                            <img src="${img}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <div class="form-group">
                <label class="form-label">Vídeo (opcional)</label>
                <input type="file" id="productVideo" accept="video/*" class="form-input">
                ${product?.video_url ? `
                    <video src="${product.video_url}" style="width: 120px; height: 80px; object-fit: cover; border-radius: 8px; margin-top: 8px;" muted loop playsinline></video>
                ` : ''}
            </div>
            
            <div class="form-group">
                <label class="form-label">Nome do produto *</label>
                <input type="text" id="productName" class="form-input" required 
                       value="${product?.name || ''}" placeholder="Nome do produto">
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                    <label class="form-label">Valor *</label>
                    <input type="number" id="productPrice" class="form-input" required 
                           value="${product?.price || ''}" placeholder="0.00" step="0.01" min="0">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Preço antigo (opcional)</label>
                    <input type="number" id="productOldPrice" class="form-input" 
                           value="${product?.old_price || ''}" placeholder="0.00" step="0.01" min="0">
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                    <label class="form-label">Categoria *</label>
                    <input type="text" id="productCategory" class="form-input" required 
                           value="${product?.category || ''}" placeholder="Ex: Eletrônicos" 
                           list="categoriesList">
                    <datalist id="categoriesList">
                        ${adminState.categories.map(cat => `<option value="${cat}">`).join('')}
                    </datalist>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Avaliação (0-5)</label>
                    <input type="number" id="productRating" class="form-input" 
                           value="${product?.rating || ''}" placeholder="4.5" step="0.1" min="0" max="5">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Descrição</label>
                <textarea id="productDescription" class="form-textarea" 
                          placeholder="Descrição do produto" rows="4">${product?.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label">Link do produto *</label>
                <input type="url" id="productUrl" class="form-input" required 
                       value="${product?.product_url || ''}" placeholder="https://...">
            </div>
            
            <div style="display: flex; gap: 20px;">
                <label class="form-checkbox">
                    <input type="checkbox" id="productPromo" ${product?.is_promo ? 'checked' : ''}>
                    <span>Produto em promoção</span>
                </label>
                
                <label class="form-checkbox">
                    <input type="checkbox" id="productActive" ${product?.active !== false ? 'checked' : ''}>
                    <span>Ativo na vitrine</span>
                </label>
            </div>
            
            <button type="submit" class="btn btn-primary" style="width: 100%;">
                ${product ? 'Salvar alterações' : 'Adicionar produto'}
            </button>
        </form>
    `;
}

function setupProductFormEvents() {
    // Pré-visualização de imagens
    document.getElementById('productImages')?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 5) {
            showToast('Máximo de 5 imagens permitido.', 'error');
            e.target.value = '';
            return;
        }
        
        adminState.mediaFiles.images = files;
        
        // Mostrar preview
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;';
        previewContainer.id = 'imagePreview';
        
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.cssText = 'width: 60px; height: 60px; object-fit: cover; border-radius: 8px;';
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
        
        const existingPreview = document.getElementById('imagePreview');
        if (existingPreview) existingPreview.remove();
        e.target.parentNode.appendChild(previewContainer);
    });
    
    // Pré-visualização de vídeo
    document.getElementById('productVideo')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            adminState.mediaFiles.video = file;
            
            const videoPreview = document.createElement('video');
            videoPreview.src = URL.createObjectURL(file);
            videoPreview.controls = true;
            videoPreview.style.cssText = 'width: 120px; height: 80px; object-fit: cover; border-radius: 8px; margin-top: 8px;';
            videoPreview.id = 'videoPreview';
            
            const existingPreview = document.getElementById('videoPreview');
            if (existingPreview) existingPreview.remove();
            e.target.parentNode.appendChild(videoPreview);
        }
    });
}

async function handleProductSubmit(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Salvando...';
    submitBtn.disabled = true;
    
    try {
        const formData = {
            name: document.getElementById('productName').value.trim(),
            price: parseFloat(document.getElementById('productPrice').value),
            old_price: document.getElementById('productOldPrice').value ? 
                parseFloat(document.getElementById('productOldPrice').value) : null,
            category: document.getElementById('productCategory').value.trim(),
            rating: document.getElementById('productRating').value ? 
                parseFloat(document.getElementById('productRating').value) : null,
            description: document.getElementById('productDescription').value.trim(),
            product_url: document.getElementById('productUrl').value.trim(),
            is_promo: document.getElementById('productPromo').checked,
            active: document.getElementById('productActive').checked
        };
        
        // Upload de imagens
        if (adminState.mediaFiles.images.length > 0) {
            const imageUrls = [];
            
            for (const file of adminState.mediaFiles.images) {
                const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                const filePath = `${SITE_CONFIG.storagePaths.products}${fileName}`;
                
                const { data, error } = await supabase.storage
                    .from(SITE_CONFIG.storageBucket)
                    .upload(filePath, file);
                
                if (error) throw error;
                
                const { data: { publicUrl } } = supabase.storage
                    .from(SITE_CONFIG.storageBucket)
                    .getPublicUrl(filePath);
                
                imageUrls.push(publicUrl);
            }
            
            if (imageUrls.length > 0) {
                formData.images = imageUrls;
            }
        }
        
        // Upload de vídeo
        if (adminState.mediaFiles.video) {
            const file = adminState.mediaFiles.video;
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const filePath = `${SITE_CONFIG.storagePaths.videos}${fileName}`;
            
            const { data, error } = await supabase.storage
                .from(SITE_CONFIG.storageBucket)
                .upload(filePath, file);
            
            if (error) throw error;
            
            const { data: { publicUrl } } = supabase.storage
                .from(SITE_CONFIG.storageBucket)
                .getPublicUrl(filePath);
            
            formData.video_url = publicUrl;
        }
        
        let result;
        
        if (adminState.isNewProduct) {
            result = await supabase
                .from('products')
                .insert([formData])
                .select();
        } else {
            result = await supabase
                .from('products')
                .update(formData)
                .eq('id', adminState.editingProduct.id)
                .select();
        }
        
        if (result.error) throw result.error;
        
        showToast(adminState.isNewProduct ? 'Produto adicionado com sucesso!' : 'Produto atualizado com sucesso!', 'success');
        hideModal('productFormModal');
        loadAdminProducts();
        updateAdminStats();
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        showToast('Erro ao salvar produto. Tente novamente.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function toggleProductStatus(productId) {
    const product = adminState.products.find(p => p.id === productId);
    if (!product) return;
    
    const action = product.active ? 'excluir' : 'restaurar';
    
    showConfirmModal(
        product.active ? 
            'Tem certeza que deseja excluir este produto da vitrine?' : 
            'Deseja restaurar este produto para a vitrine?',
        async () => {
            try {
                const { error } = await supabase
                    .from('products')
                    .update({ active: !product.active })
                    .eq('id', productId);
                
                if (error) throw error;
                
                showToast(`Produto ${product.active ? 'excluído da' : 'restaurado na'} vitrine.`, 'success');
                loadAdminProducts();
                updateAdminStats();
            } catch (error) {
                console.error('Erro ao alterar status do produto:', error);
                showToast('Erro ao alterar status do produto.', 'error');
            }
        },
        action === 'excluir' ? 'Excluir' : 'Restaurar'
    );
}

// ============ REALTIME ============
function setupRealtime() {
    if (!supabase) return;
    
    try {
        const channel = supabase
            .channel('admin-products-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                () => {
                    console.log('Mudança detectada no admin');
                    loadAdminProducts();
                    loadAdminCategories();
                    updateAdminStats();
                    updateCategoryFilter();
                }
            )
            .subscribe();
    } catch (error) {
        console.error('Erro ao configurar Realtime:', error);
    }
}

// ============ EVENT LISTENERS ============
function setupAdminEventListeners() {
    // Logout
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await supabase.auth.signOut();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Erro ao sair:', error);
                window.location.href = 'index.html';
            }
        });
    }
    
    // Tabs
    document.querySelectorAll('.admin-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = link.dataset.tab;
            
            document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');
            
            adminState.currentTab = tab;
        });
    });
    
    // Novo produto
    const newProductBtn = document.getElementById('newProductBtn');
    if (newProductBtn) {
        newProductBtn.addEventListener('click', openNewProductForm);
    }
    
    const dashboardNewProductBtn = document.getElementById('dashboardNewProductBtn');
    if (dashboardNewProductBtn) {
        dashboardNewProductBtn.addEventListener('click', openNewProductForm);
    }
    
    // Busca de produtos
    const productSearch = document.getElementById('adminProductSearch');
    if (productSearch) {
        productSearch.addEventListener('input', (e) => {
            adminState.productSearchQuery = e.target.value;
            renderAdminProducts();
        });
    }
    
    // Filtro de status
    const productFilter = document.getElementById('adminProductFilter');
    if (productFilter) {
        productFilter.addEventListener('change', (e) => {
            adminState.productFilter = e.target.value;
            renderAdminProducts();
        });
    }
    
    // Filtro de categoria
    const productCategoryFilter = document.getElementById('adminProductCategoryFilter');
    if (productCategoryFilter) {
        productCategoryFilter.addEventListener('change', (e) => {
            adminState.productCategoryFilter = e.target.value;
            renderAdminProducts();
        });
    }
    
    // Ordenação
    const productSortBy = document.getElementById('adminProductSortBy');
    if (productSortBy) {
        productSortBy.addEventListener('change', (e) => {
            adminState.productSortBy = e.target.value;
            renderAdminProducts();
        });
    }
    
    // Modal close
    const productFormClose = document.getElementById('productFormClose');
    if (productFormClose) {
        productFormClose.addEventListener('click', () => hideModal('productFormModal'));
    }
    
    const confirmModalClose = document.getElementById('confirmModalClose');
    if (confirmModalClose) {
        confirmModalClose.addEventListener('click', () => hideModal('confirmModal'));
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
    
    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideModal('productFormModal');
            hideModal('confirmModal');
        }
    });
}

// Expor funções globalmente
window.showToast = showToast;
window.showModal = showModal;
window.hideModal = hideModal;
window.showConfirmModal = showConfirmModal;
window.formatPrice = formatPrice;
window.formatDate = formatDate;
window.openNewProductForm = openNewProductForm;
window.editProduct = editProduct;
window.handleProductSubmit = handleProductSubmit;
window.toggleProductStatus = toggleProductStatus;

// ============ INICIALIZAÇÃO ============
async function initAdmin() {
    console.log('Inicializando painel admin...');
    
    // Verificar se Supabase está carregado
    if (!window.supabase) {
        console.error('Supabase não carregado');
        window.location.href = 'index.html';
        return;
    }
    
    // Verificar acesso (redireciona se não for admin)
    await checkAdminAccess();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}