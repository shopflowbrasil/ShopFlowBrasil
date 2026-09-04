-- ============ SHOPFLOWBRASIL - SCHEMA SQL ============
-- Execute este script no SQL Editor do Supabase

-- ============ TABELAS ============

-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de produtos
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    old_price DECIMAL(10, 2),
    description TEXT,
    product_url TEXT,
    category TEXT,
    rating DECIMAL(2, 1) DEFAULT 0,
    images JSONB DEFAULT '[]',
    video_url TEXT,
    is_promo BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de favoritos
CREATE TABLE public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Tabela para futura integração com afiliados (Shopee)
CREATE TABLE public.affiliate_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    shopee_product_id TEXT,
    shopee_affiliate_link TEXT,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    commission DECIMAL(10, 2) DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    revenue DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ ÍNDICES ============
CREATE INDEX idx_products_active ON public.products(active);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_promo ON public.products(is_promo);
CREATE INDEX idx_products_created ON public.products(created_at DESC);
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_favorites_product ON public.favorites(product_id);
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- ============ TRIGGER PARA ATUALIZAR updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRIGGER PARA CRIAR PERFIL AUTOMATICAMENTE ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============ ROW LEVEL SECURITY (RLS) ============

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_data ENABLE ROW LEVEL SECURITY;

-- ============ POLÍTICAS - PROFILES ============
-- Usuários podem ver seus próprios perfis
CREATE POLICY "Usuários podem ver seus próprios perfis"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Usuários podem atualizar seus próprios perfis
CREATE POLICY "Usuários podem atualizar seus próprios perfis"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Usuários podem inserir seus próprios perfis
CREATE POLICY "Usuários podem inserir seus próprios perfis"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Administradores podem ver todos os perfis
CREATE POLICY "Administradores podem ver todos os perfis"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============ POLÍTICAS - PRODUCTS ============
-- Qualquer pessoa pode ver produtos ativos
CREATE POLICY "Qualquer pessoa pode ver produtos ativos"
    ON public.products FOR SELECT
    USING (active = true);

-- Administradores podem ver todos os produtos
CREATE POLICY "Administradores podem ver todos os produtos"
    ON public.products FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Administradores podem inserir produtos
CREATE POLICY "Administradores podem inserir produtos"
    ON public.products FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Administradores podem atualizar produtos
CREATE POLICY "Administradores podem atualizar produtos"
    ON public.products FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Administradores podem deletar produtos
CREATE POLICY "Administradores podem deletar produtos"
    ON public.products FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============ POLÍTICAS - FAVORITES ============
-- Usuários podem ver seus próprios favoritos
CREATE POLICY "Usuários podem ver seus próprios favoritos"
    ON public.favorites FOR SELECT
    USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios favoritos
CREATE POLICY "Usuários podem inserir seus próprios favoritos"
    ON public.favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Usuários podem deletar seus próprios favoritos
CREATE POLICY "Usuários podem deletar seus próprios favoritos"
    ON public.favorites FOR DELETE
    USING (auth.uid() = user_id);

-- ============ POLÍTICAS - AFFILIATE DATA ============
-- Administradores podem gerenciar dados de afiliados
CREATE POLICY "Administradores podem ver dados de afiliados"
    ON public.affiliate_data FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Administradores podem inserir dados de afiliados"
    ON public.affiliate_data FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Administradores podem atualizar dados de afiliados"
    ON public.affiliate_data FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============ STORAGE BUCKET ============
-- Criar bucket para mídia
INSERT INTO storage.buckets (id, name, public)
VALUES ('shopflow-media', 'shopflow-media', true);

-- Políticas de storage para o bucket
CREATE POLICY "Storage público para leitura"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'shopflow-media');

CREATE POLICY "Administradores podem fazer upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'shopflow-media'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Administradores podem atualizar arquivos"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'shopflow-media'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Administradores podem deletar arquivos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'shopflow-media'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============ REALTIME ============
-- Habilitar Realtime para a tabela de produtos
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;

-- ============ COMO PROMOVER USUÁRIO PARA ADMIN ============
-- Depois de criar um usuário pelo site, execute:
-- UPDATE public.profiles SET role = 'admin' WHERE username = 'SEU_USUARIO_AQUI';