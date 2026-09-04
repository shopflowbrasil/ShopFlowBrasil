// ============ CONFIGURAÇÃO DO SUPABASE ============
// IMPORTANTE: Use apenas a chave ANON pública aqui
// NUNCA coloque a Service Role Key no frontend

const SUPABASE_URL = 'db.ivqdpoohgejivasrwpzb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cWRwYm9vbmdlaml2YXNyd3FwYiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM0NzY5NDAwLCJleHAiOjIwNTAzNDU0MDB9.SUa7E0CSSfRAe1nK0EOvNYG-G7ZC4a8yQOEXdTSCJe0';

// Inicializar Supabase
let supabase;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase inicializado com sucesso');
    } else {
        console.error('Supabase JS não carregado');
    }
} catch (error) {
    console.error('Erro ao inicializar Supabase:', error);
}

// Configurações do site
const SITE_CONFIG = {
    name: 'ShopFlowBrasil',
    version: '1.0.0',
    defaultImage: 'https://via.placeholder.com/400x300?text=ShopFlowBrasil',
    maxImages: 5,
    imageTransitionTime: 3000,
    passwordMinLength: 8,
    storageBucket: 'shopflow-media',
    storagePaths: {
        products: 'products/',
        videos: 'videos/',
        avatars: 'avatars/'
    }
};

// Exportar configuração
window.SITE_CONFIG = SITE_CONFIG;
window.supabase = supabase;