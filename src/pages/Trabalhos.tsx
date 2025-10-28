import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { GripVertical, Plus, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Pessoa = {
  id: string;
  nome: string;
  funcao: string;
};

type Trabalho = {
  id: string;
  pessoa_id: string;
  descricao: string;
  valor_total: number;
  valor_pago: number;
  prioridade: number;
  pessoa_nome?: string;
  pessoa_funcao?: string;
};

const SortableTrabalho = ({ trabalho }: { trabalho: Trabalho }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: trabalho.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const saldoRestante = trabalho.valor_total - trabalho.valor_pago;
  const progresso = (trabalho.valor_pago / trabalho.valor_total) * 100;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="p-4 bg-card hover:bg-slot-hover transition-colors">
        <div className="flex items-start gap-3">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1">
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-semibold text-foreground">{trabalho.pessoa_nome}</h3>
                <p className="text-sm text-muted-foreground">{trabalho.pessoa_funcao}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Saldo Restante</p>
                <p className="text-lg font-bold text-warning">R$ {saldoRestante.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{trabalho.descricao}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>R$ {trabalho.valor_pago.toFixed(2)} pago</span>
                <span>R$ {trabalho.valor_total.toFixed(2)} total</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="bg-success h-full transition-all"
                  style={{ width: `${Math.min(progresso, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

const Trabalhos = () => {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [pessoaId, setPessoaId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = async () => {
    try {
      const [pessoasRes, trabalhosRes] = await Promise.all([
        supabase.from("pessoas").select("*").order("nome", { ascending: true }),
        supabase
          .from("trabalhos")
          .select("*, pessoas:pessoa_id(nome, funcao)")
          .eq("concluido", false)
          .order("prioridade", { ascending: true }),
      ]);

      if (pessoasRes.error) throw pessoasRes.error;
      if (trabalhosRes.error) throw trabalhosRes.error;

      setPessoas(pessoasRes.data || []);

      const trabalhosMapeados = trabalhosRes.data?.map((t) => {
        const pessoa = Array.isArray(t.pessoas) ? t.pessoas[0] : t.pessoas;
        return {
          ...t,
          pessoa_nome: pessoa?.nome,
          pessoa_funcao: pessoa?.funcao,
        };
      });

      setTrabalhos(trabalhosMapeados || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pessoaId || !descricao || !valorTotal) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSubmitting(true);
    try {
      const maxPrioridade = trabalhos.length > 0 ? Math.max(...trabalhos.map((t) => t.prioridade)) : -1;

      const { error } = await supabase.from("trabalhos").insert({
        pessoa_id: pessoaId,
        descricao,
        valor_total: parseFloat(valorTotal),
        prioridade: maxPrioridade + 1,
      });

      if (error) throw error;

      setPessoaId("");
      setDescricao("");
      setValorTotal("");
      await loadData();
      toast.success("Trabalho lançado com sucesso!");
    } catch (error) {
      console.error("Erro ao lançar trabalho:", error);
      toast.error("Erro ao lançar trabalho");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = trabalhos.findIndex((t) => t.id === active.id);
    const newIndex = trabalhos.findIndex((t) => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(trabalhos, oldIndex, newIndex);

    setTrabalhos(reordered);

    try {
      const updates = reordered.map((trabalho, index) => ({
        id: trabalho.id,
        prioridade: index,
      }));

      // @ts-ignore - O upsert funciona com um subconjunto de propriedades, mas o TS não consegue inferir isso.
      const { error } = await supabase.from("trabalhos").upsert(updates);

      if (error) {
        throw error;
      }

      toast.success("Prioridade atualizada!");
    } catch (error) {
      console.error("Erro ao reordenar:", error);
      toast.error("Erro ao reordenar trabalhos");
      await loadData();
    }
  };

  useEffect(() => {
    loadData();
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
        <h1 className="text-3xl font-bold text-foreground">Lançar Trabalho / Fila Ativa</h1>
        <p className="text-muted-foreground">Adicione novos trabalhos e gerencie prioridades</p>
      </div>

      <Card className="p-6 bg-card">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Lançar Novo Trabalho</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pessoa">Pessoa</Label>
              <Select value={pessoaId} onValueChange={setPessoaId}>
                <SelectTrigger id="pessoa">
                  <SelectValue placeholder="Selecione uma pessoa" />
                </SelectTrigger>
                <SelectContent>
                  {pessoas.map((pessoa) => (
                    <SelectItem key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome} - {pessoa.funcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição do Trabalho</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Projeto X, Manutenção Y..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor Total (R$)</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? "Lançando..." : "Lançar Trabalho"}
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4 text-foreground">
          Fila Ativa de Trabalhos ({trabalhos.length})
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Arraste os trabalhos para definir a ordem de prioridade dos pagamentos
        </p>

        {trabalhos.length === 0 ? (
          <Card className="p-8 text-center bg-card">
            <p className="text-muted-foreground">Nenhum trabalho ativo no momento</p>
          </Card>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={trabalhos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-3">
                {trabalhos.map((trabalho) => (
                  <SortableTrabalho key={trabalho.id} trabalho={trabalho} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};

export default Trabalhos;