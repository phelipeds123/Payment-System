-- Criar tabela de pessoas
CREATE TABLE public.pessoas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  funcao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de trabalhos
CREATE TABLE public.trabalhos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor_total DECIMAL(10, 2) NOT NULL,
  valor_pago DECIMAL(10, 2) NOT NULL DEFAULT 0,
  concluido BOOLEAN NOT NULL DEFAULT false,
  prioridade INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de pagamentos semanais (slots temporários)
CREATE TABLE public.pagamentos_semanais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalho_id UUID NOT NULL REFERENCES public.trabalhos(id) ON DELETE CASCADE,
  pessoa_nome TEXT NOT NULL,
  pessoa_funcao TEXT NOT NULL,
  descricao_trabalho TEXT NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  posicao INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de histórico de pagamentos
CREATE TABLE public.historico_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  trabalho_id UUID NOT NULL REFERENCES public.trabalhos(id) ON DELETE CASCADE,
  pessoa_nome TEXT NOT NULL,
  pessoa_funcao TEXT NOT NULL,
  descricao_trabalho TEXT NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  data_pagamento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trabalhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_semanais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_pagamentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acesso público para este app interno)
CREATE POLICY "Permitir acesso total a pessoas" ON public.pessoas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso total a trabalhos" ON public.trabalhos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso total a pagamentos semanais" ON public.pagamentos_semanais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso total a histórico" ON public.historico_pagamentos FOR ALL USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_trabalhos_pessoa ON public.trabalhos(pessoa_id);
CREATE INDEX idx_trabalhos_concluido ON public.trabalhos(concluido);
CREATE INDEX idx_pagamentos_semanais_posicao ON public.pagamentos_semanais(posicao);
CREATE INDEX idx_historico_pessoa ON public.historico_pagamentos(pessoa_id);
CREATE INDEX idx_historico_data ON public.historico_pagamentos(data_pagamento DESC);