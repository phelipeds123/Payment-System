import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { GripVertical, X, CheckCircle, Loader2, DollarSign } from "lucide-react";
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

type PagamentoSemanal = {
  id: string;
  trabalho_id: string;
  pessoa_nome: string;
  pessoa_funcao: string;
  descricao_trabalho: string;
  valor: number;
  posicao: number;
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

const SortableSlot = ({
  slot,
  index,
  onRemove,
  onPay,
}: {
  slot: PagamentoSemanal | null;
  index: number;
  onRemove: (id: string) => void;
  onPay: (slot: PagamentoSemanal) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slot?.id || `empty-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="w-full">
      <Card
        className={`p-4 ${
          slot ? "bg-slot-filled hover:bg-slot-hover" : "bg-slot-empty"
        } border-2 transition-colors`}
      >
        {slot ? (
          <div className="flex items-start gap-3">
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1">
              <GripVertical className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{slot.pessoa_nome}</h3>
                  <p className="text-sm text-muted-foreground">{slot.pessoa_funcao}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(slot.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground mb-2">{slot.descricao_trabalho}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPay(slot)}
                  className="text-success hover:text-success hover:bg-success/10 border-success/50 gap-1.5"
                >
                  <DollarSign className="w-4 h-4" /> Pagar Manual
                </Button>
              </div>
              <p className="text-lg font-bold text-success">R$ {slot.valor.toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 text-muted-foreground">
            <span className="text-sm">Slot {index + 1} - Vazio</span>
          </div>
        )}
      </Card>
    </div>
  );
};

const Dashboard = () => {
  const [slots, setSlots] = useState<(PagamentoSemanal | null)[]>(Array(10).fill(null));
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadSlots = async () => {
    try {
      const { data, error } = await supabase
        .from("pagamentos_semanais")
        .select("*")
        .order("posicao", { ascending: true });

      if (error) throw error;

      const newSlots = Array(10).fill(null);
      data?.forEach((item) => {
        if (item.posicao >= 0 && item.posicao < 10) {
          newSlots[item.posicao] = item;
        }
      });
      setSlots(newSlots);
    } catch (error) {
      console.error("Erro ao carregar slots:", error);
      toast.error("Erro ao carregar pagamentos");
    } finally {
      setLoading(false);
    }
  };

  const fillEmptySlots = async () => {
    // A lógica complexa foi movida para uma função no Supabase.
    // Isso reduz o número de chamadas de rede e simplifica o código do frontend.
    try {
      const { error } = await supabase.rpc("preencher_slots_pagamento");
      if (error) throw error;

      await loadSlots();
      toast.success("Slots preenchidos automaticamente!");
    } catch (error) {
      console.error("Erro ao preencher slots:", error);
      toast.error("Erro ao preencher slots automaticamente");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = slots.findIndex((s) => s?.id === active.id);
    const newIndex = slots.findIndex((s) => s?.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedSlots = arrayMove(slots, oldIndex, newIndex);
    setSlots(reorderedSlots);

    try {
      const updates = reorderedSlots.map((slot, index) => {
        if (!slot) return null;
        return {
          id: slot.id,
          posicao: index,
        };
      }).filter(Boolean);

      // @ts-ignore
      const { error } = await supabase.from("pagamentos_semanais").upsert(updates);

      if (error) {
        throw error;
      }

      toast.success("Ordem atualizada!");
    } catch (error) {
      console.error("Erro ao reordenar:", error);
      toast.error("Erro ao reordenar slots");
      await loadSlots(); // Recarrega para reverter a mudança visual em caso de erro
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const { error } = await supabase.from("pagamentos_semanais").delete().eq("id", id);

      if (error) throw error;

      await loadSlots();
      toast.success("Slot removido!");
    } catch (error) {
      console.error("Erro ao remover slot:", error);
      toast.error("Erro ao remover slot");
    }
  };

  const handlePayManually = async (slot: PagamentoSemanal) => {
    if (!window.confirm(`Deseja confirmar o pagamento de R$ ${slot.valor.toFixed(2)} para ${slot.pessoa_nome}?`)) {
      return;
    }

    setApproving(true); // Reutiliza o estado de loading
    try {
      // 1. Mover para o histórico
      const { data: trabalho } = await supabase.from("trabalhos").select("pessoa_id").eq("id", slot.trabalho_id).single();
      if (!trabalho) throw new Error("Trabalho associado não encontrado.");

      await supabase.from("historico_pagamentos").insert({
        pessoa_id: trabalho.pessoa_id,
        trabalho_id: slot.trabalho_id,
        pessoa_nome: slot.pessoa_nome,
        pessoa_funcao: slot.pessoa_funcao,
        descricao_trabalho: slot.descricao_trabalho,
        valor: slot.valor,
      });

      // 2. Atualizar o trabalho (usando rpc para garantir a transação)
      const { error: rpcError } = await supabase.rpc("atualizar_valor_pago", {
        p_trabalho_id: slot.trabalho_id,
        p_valor_pago: slot.valor,
      });
      if (rpcError) throw rpcError;

      // 3. Remover o slot
      await handleRemove(slot.id);

      toast.success("Pagamento manual realizado com sucesso!");
    } catch (error) {
      console.error("Erro ao realizar pagamento manual:", error);
      toast.error("Erro ao realizar pagamento manual.");
    } finally {
      setApproving(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const filledSlots = slots.filter((s) => s !== null);
      if (filledSlots.length === 0) {
        toast.info("Nenhum pagamento para aprovar.");
        return;
      }

      // A lógica foi movida para uma função no Supabase para garantir atomicidade.
      const { error } = await supabase.rpc("aprovar_pagamentos_semanais");

      if (error) throw error;

      await loadSlots();
      toast.success("Pagamentos aprovados com sucesso!");

      // Preencher automaticamente após aprovação
      setTimeout(() => fillEmptySlots(), 500);
    } catch (error) {
      console.error("Erro ao aprovar pagamentos:", error);
      toast.error("Erro ao aprovar pagamentos");
    } finally {
      setApproving(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  useEffect(() => {
    if (!loading && slots.some((s) => s === null)) {
      fillEmptySlots();
    }
  }, [loading, slots]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const filledSlots = slots.filter((s) => s !== null) as PagamentoSemanal[];
  const totalSemana = filledSlots.reduce((sum, slot) => sum + (slot?.valor || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pagamentos da Semana</h1>
          <p className="text-muted-foreground">Gerencie os 10 pagamentos prioritários</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total da Semana</p>
          <p className="text-2xl font-bold text-success">R$ {totalSemana.toFixed(2)}</p>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slots.map((s) => s?.id || `empty-${slots.indexOf(s)}`)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-3">
            {slots.map((slot, index) => (
              <SortableSlot key={slot?.id || `empty-${index}`} slot={slot} index={index} onRemove={handleRemove} onPay={handlePayManually} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex justify-end">
        <Button onClick={handleApprove} disabled={approving || filledSlots.length === 0} size="lg" className="gap-2">
          {approving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          {approving ? "Aprovando..." : "Aprovar Semana"}
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;
      }));

      for (const update of updates) {
        await supabase.from("pagamentos_semanais").update({ posicao: update.posicao }).eq("id", update.id);
      }

      await loadSlots();
      toast.success("Ordem atualizada!");
    } catch (error) {
      console.error("Erro ao reordenar:", error);
      toast.error("Erro ao reordenar slots");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const { error } = await supabase.from("pagamentos_semanais").delete().eq("id", id);

      if (error) throw error;

      await loadSlots();
      toast.success("Slot removido!");
    } catch (error) {
      console.error("Erro ao remover slot:", error);
      toast.error("Erro ao remover slot");
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const filledSlots = slots.filter((s) => s !== null) as PagamentoSemanal[];

      if (filledSlots.length === 0) {
        toast.error("Nenhum pagamento para aprovar");
        return;
      }

      // Mover para histórico e atualizar trabalhos
      for (const slot of filledSlots) {
        // Adicionar ao histórico
        await supabase.from("historico_pagamentos").insert({
          pessoa_id: (
            await supabase
              .from("trabalhos")
              .select("pessoa_id")
              .eq("id", slot.trabalho_id)
              .single()
          ).data?.pessoa_id,
          trabalho_id: slot.trabalho_id,
          pessoa_nome: slot.pessoa_nome,
          pessoa_funcao: slot.pessoa_funcao,
          descricao_trabalho: slot.descricao_trabalho,
          valor: slot.valor,
        });

        // Atualizar valor pago do trabalho
        const { data: trabalho } = await supabase
          .from("trabalhos")
          .select("valor_total, valor_pago")
          .eq("id", slot.trabalho_id)
          .single();

        if (trabalho) {
          const novoValorPago = Number(trabalho.valor_pago) + Number(slot.valor);
          const concluido = novoValorPago >= Number(trabalho.valor_total);

          await supabase
            .from("trabalhos")
            .update({ valor_pago: novoValorPago, concluido })
            .eq("id", slot.trabalho_id);
        }
      }

      // Limpar slots semanais
      await supabase.from("pagamentos_semanais").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      await loadSlots();
      toast.success("Pagamentos aprovados com sucesso!");

      // Preencher automaticamente após aprovação
      setTimeout(() => fillEmptySlots(), 500);
    } catch (error) {
      console.error("Erro ao aprovar pagamentos:", error);
      toast.error("Erro ao aprovar pagamentos");
    } finally {
      setApproving(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  useEffect(() => {
    if (!loading && slots.some((s) => s === null)) {
      fillEmptySlots();
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const filledSlots = slots.filter((s) => s !== null);
  const totalSemana = filledSlots.reduce((sum, slot) => sum + (slot?.valor || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pagamentos da Semana</h1>
          <p className="text-muted-foreground">Gerencie os 10 pagamentos prioritários</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total da Semana</p>
          <p className="text-2xl font-bold text-success">R$ {totalSemana.toFixed(2)}</p>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filledSlots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-3">
            {slots.map((slot, index) => (
              <SortableSlot key={slot?.id || `empty-${index}`} slot={slot} index={index} onRemove={handleRemove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex justify-end">
        <Button onClick={handleApprove} disabled={approving || filledSlots.length === 0} size="lg" className="gap-2">
          {approving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          {approving ? "Aprovando..." : "Aprovar Semana"}
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;