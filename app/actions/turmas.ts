'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const turmaSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  segmento: z.enum(['EDUCACAO_INFANTIL', 'FUNDAMENTAL', 'MEDIO', 'OUTRO']).optional().nullable(),
  tipo_curso: z.string().optional().nullable(),
  situacao: z.string().default('ATIVA'),
  empresa_id: z.string().uuid('Empresa é obrigatória'),
  unidade_id: z.string().uuid().optional().nullable(),
})

/**
 * Listar todas as turmas
 */
export async function listarTurmas() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('turmas')
    .select(`
      id,
      descricao,
      segmento,
      tipo_curso,
      situacao,
      empresa_id,
      unidade_id,
      created_at,
      updated_at,
      empresas:empresa_id (
        id,
        nome
      ),
      unidades:unidade_id (
        id,
        nome
      )
    `)
    .order('descricao')

  if (error) {
    console.error('Erro ao listar turmas:', error)
    throw new Error('Erro ao carregar turmas')
  }

  return data || []
}

/**
 * Obter uma turma por ID
 */
export async function obterTurma(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('turmas')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Erro ao obter turma:', error)
    throw new Error('Erro ao carregar turma')
  }

  return data
}

/**
 * Criar turma
 */
export async function criarTurma(dados: z.infer<typeof turmaSchema>) {
  const supabase = await createClient()

  const dadosValidados = turmaSchema.parse(dados)

  const { data, error } = await supabase
    .from('turmas')
    .insert({
      descricao: dadosValidados.descricao,
      segmento: dadosValidados.segmento || null,
      tipo_curso: dadosValidados.tipo_curso || null,
      situacao: dadosValidados.situacao || 'ATIVA',
      empresa_id: dadosValidados.empresa_id,
      unidade_id: dadosValidados.unidade_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar turma:', error)
    throw new Error('Erro ao criar turma')
  }

  return data
}

/**
 * Atualizar turma
 */
export async function atualizarTurma(id: string, dados: z.infer<typeof turmaSchema>) {
  const supabase = await createClient()

  const dadosValidados = turmaSchema.parse(dados)

  const { data, error } = await supabase
    .from('turmas')
    .update({
      descricao: dadosValidados.descricao,
      segmento: dadosValidados.segmento || null,
      tipo_curso: dadosValidados.tipo_curso || null,
      situacao: dadosValidados.situacao || 'ATIVA',
      empresa_id: dadosValidados.empresa_id,
      unidade_id: dadosValidados.unidade_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar turma:', error)
    throw new Error('Erro ao atualizar turma')
  }

  return data
}

/**
 * Deletar turma
 */
export async function deletarTurma(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('turmas')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao deletar turma:', error)
    throw new Error('Erro ao deletar turma')
  }
}
