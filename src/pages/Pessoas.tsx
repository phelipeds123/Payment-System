import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Loader2, User, DollarSign, Calendar, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

type Pessoa = {
  id: string;
  nome: string;
  funcao: string;
};

type Trabalho = {
  id: string;
  valor_total: number;
  valor_pago: number;
};

type HistoricoPagamento = {
  id: string;
  descricao_trabalho: string;
  valor: number;
  data_pagamento: string;
};

type PessoaDetalhes = {
  totalAPagar: number;
  totalPago: number;
  historico: HistoricoPagamento[];
};

const Pessoas = () => {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<Pessoa | null>(null);
  const [detalhes, setDetalhes] = useState<PessoaDetalhes | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState("");

  const loadPessoas = async () => {
    try {
      const { data, error } = await supabase.from("pessoas").select("*").order("nome", { ascending: true });

      if (error) throw error;
      setPessoas(data || []);
    } catch (error) {
      console.error("Erro ao carregar pessoas:", error);
      toast.error("Erro ao carregar pessoas");
    } finally {
      setLoading(false);
    }
  };

  const loadDetalhes = async (pessoaId: string) => {
    setLoadingDetalhes(true);
    try {
      const [trabalhosRes, historicoRes] = await Promise.all([
        supabase.from("trabalhos").select("valor_total, valor_pago").eq("pessoa_id", pessoaId).eq("concluido", false),
        supabase
          .from("historico_pagamentos")
          .select("id, descricao_trabalho, valor, data_pagamento")
          .eq("pessoa_id", pessoaId)
          .order("data_pagamento", { ascending: false }),
      ]);

      if (trabalhosRes.error) throw trabalhosRes.error;
      if (historicoRes.error) throw historicoRes.error;

      const totalAPagar = trabalhosRes.data?.reduce(
        (sum, t) => sum + (Number(t.valor_total) - Number(t.valor_pago)),
        0
      ) || 0;

      const totalPago = historicoRes.data?.reduce((sum, h) => sum + Number(h.valor), 0) || 0;

      setDetalhes({
        totalAPagar,
        totalPago,
        historico: historicoRes.data || [],
      });
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
      toast.error("Erro ao carregar detalhes da pessoa");
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || !funcao) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("pessoas").insert({ nome, funcao });

      if (error) throw error;

      setNome("");
      setFuncao("");
      await loadPessoas();
      toast.success("Pessoa cadastrada com sucesso!");
    } catch (error) {
      console.error("Erro ao cadastrar pessoa:", error);
      toast.error("Erro ao cadastrar pessoa");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemovePessoa = async (pessoaId: string) => {
    if (
      !window.confirm(
        "Tem certeza que deseja remover esta pessoa? TODOS os seus trabalhos e históricos de pagamento serão permanentemente excluídos. Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("pessoas").delete().eq("id", pessoaId);
      if (error) throw error;

      toast.success("Pessoa removida com sucesso!");
      setPessoaSelecionada(null); // Fecha o modal
      await loadPessoas(); // Recarrega a lista
    } catch (error) {
      console.error("Erro ao remover pessoa:", error);
      toast.error("Erro ao remover pessoa. Verifique se não há pagamentos semanais pendentes para esta pessoa.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePessoaClick = (pessoa: Pessoa) => {
    setPessoaSelecionada(pessoa);
    loadDetalhes(pessoa.id);
  };

  useEffect(() => {
    loadPessoas();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pessoas / Histórico</h1>
        <p className="text-muted-foreground">Cadastre pessoas e consulte histórico de pagamentos</p>
      </div>

      <Card className="p-6 bg-card">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Adicionar Nova Pessoa</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João Silva"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="funcao">Função</Label>
              <Input
                id="funcao"
                value={funcao}
                onChange={(e) => setFuncao(e.target.value)}
                placeholder="Ex: Desenvolvedor, Designer..."
              />
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? "Cadastrando..." : "Cadastrar Pessoa"}
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4 text-foreground">
          Pessoas Cadastradas ({pessoas.length})
        </h2>

        {pessoas.length === 0 ? (
          <Card className="p-8 text-center bg-card">
            <p className="text-muted-foreground">Nenhuma pessoa cadastrada ainda</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pessoas.map((pessoa) => (
              <Dialog key={pessoa.id}>
                <DialogTrigger asChild>
                  <Card
                    className="p-4 cursor-pointer hover:bg-slot-hover transition-colors bg-card"
                    onClick={() => handlePessoaClick(pessoa)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{pessoa.nome}</h3>
                        <Badge variant="secondary" className="mt-1">
                          {pessoa.funcao}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {pessoa.nome}
                    </DialogTitle>
                  </DialogHeader>

                  {loadingDetalhes ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : detalhes ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <Card className="p-4 bg-warning-light border-warning">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-warning" />
                            <p className="text-sm font-medium text-muted-foreground">Total a Pagar</p>
                          </div>
                          <p className="text-2xl font-bold text-warning">
                            R$ {detalhes.totalAPagar.toFixed(2)}
                          </p>
                        </Card>

                        <Card className="p-4 bg-success-light border-success">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-success" />
                            <p className="text-sm font-medium text-muted-foreground">Total Pago</p>
                          </div>
                          <p className="text-2xl font-bold text-success">
                            R$ {detalhes.totalPago.toFixed(2)}
                          </p>
                        </Card>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-foreground">
                          Histórico de Pagamentos ({detalhes.historico.length})
                        </h3>

                        {detalhes.historico.length === 0 ? (
                          <Card className="p-6 text-center bg-card">
                            <p className="text-muted-foreground">Nenhum pagamento registrado ainda</p>
                          </Card>
                        ) : (
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {detalhes.historico.map((pagamento) => (
                              <Card key={pagamento.id} className="p-3 bg-card">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {pagamento.descricao_trabalho}
                                    </p>
                                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(pagamento.data_pagamento).toLocaleDateString("pt-BR")}
                                    </div>
                                  </div>
                                  <p className="text-sm font-bold text-success whitespace-nowrap">
                                    R$ {Number(pagamento.valor).toFixed(2)}
                                  </p>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <DialogFooter className="pt-4">
                    <Button
                      variant="destructive"
                      onClick={() => pessoaSelecionada && handleRemovePessoa(pessoaSelecionada.id)}
                      disabled={submitting}
                      className="gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {submitting ? "Removendo..." : "Remover Pessoa"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pessoas;