'use server'

import { createClient } from '@/lib/supabase/server'
import type { PedidoStatus } from '@/lib/types/database'

export interface PedidoCompleto {
  id: string
  status: PedidoStatus
  total: number
  created_at: string
  updated_at: string
  aluno: {
    id: string
    nome: string
    prontuario: string
  }
  itens: {
    id: string
    produto_id: string
    produto_nome: string
    quantidade: number
    preco_unitario: number
    subtotal: number
  }[]
}

/**
 * Listar pedidos do usuário logado
 */
export async function listarMeusPedidos(): Promise<PedidoCompleto[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Não autenticado')
  }

  // Buscar usuário
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!usuario) {
    return []
  }

  // Buscar pedidos
  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select(`
      id,
      status,
      total,
      created_at,
      updated_at,
      aluno_id,
      alunos!inner (
        id,
        nome,
        prontuario
      )
    `)
    .eq('usuario_id', usuario.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar pedidos:', error)
    throw new Error('Erro ao buscar pedidos')
  }

  if (!pedidos || pedidos.length === 0) {
    return []
  }

  // Buscar itens dos pedidos
  const pedidoIds = pedidos.map(p => p.id)
  const { data: itens, error: itensError } = await supabase
    .from('pedido_itens')
    .select(`
      id,
      pedido_id,
      produto_id,
      quantidade,
      preco_unitario,
      subtotal,
      produtos!inner (
        nome
      )
    `)
    .in('pedido_id', pedidoIds)

  if (itensError) {
    console.error('Erro ao buscar itens dos pedidos:', itensError)
  }

  // Montar resposta
  const pedidosCompletos: PedidoCompleto[] = pedidos.map((pedido: any) => {
    const itensPedido = (itens || []).filter((item: any) => item.pedido_id === pedido.id)
    
    return {
      id: pedido.id,
      status: pedido.status,
      total: Number(pedido.total),
      created_at: pedido.created_at,
      updated_at: pedido.updated_at,
      aluno: {
        id: pedido.alunos.id,
        nome: pedido.alunos.nome,
        prontuario: pedido.alunos.prontuario,
      },
      itens: itensPedido.map((item: any) => ({
        id: item.id,
        produto_id: item.produto_id,
        produto_nome: item.produtos.nome,
        quantidade: item.quantidade,
        preco_unitario: Number(item.preco_unitario),
        subtotal: Number(item.subtotal),
      })),
    }
  })

  return pedidosCompletos
}
