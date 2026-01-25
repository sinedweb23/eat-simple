'use server'

import { createClient } from '@/lib/supabase/server'
import { verificarSeEhAdmin } from './admin'
import { z } from 'zod'
import type { ProdutoCompleto, Categoria, GrupoProduto, Variacao, VariacaoValor, GrupoOpcional, Opcional, KitItem } from '@/lib/types/database'

// Schemas de validação
const categoriaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
  ordem: z.number().default(0),
  ativo: z.boolean().default(true),
})

const grupoProdutoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
  ordem: z.number().default(0),
  ativo: z.boolean().default(true),
})

const produtoSchema = z.object({
  empresa_id: z.string().uuid(),
  unidade_id: z.string().uuid().optional().nullable(),
  tipo: z.enum(['PRODUTO', 'SERVICO', 'KIT']),
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional().nullable(),
  preco: z.number().min(0, 'Preço deve ser maior ou igual a zero'),
  estoque: z.number().default(0),
  compra_unica: z.boolean().default(false),
  limite_max_compra_unica: z.number().default(1),
  permitir_pix: z.boolean().default(true),
  permitir_cartao: z.boolean().default(true),
  ativo: z.boolean().default(true),
  categoria_id: z.string().uuid().optional().nullable(),
  grupo_id: z.string().uuid().optional().nullable(),
  sku: z.string().optional().nullable(),
  imagem_url: z.string().url().optional().nullable(),
  ordem: z.number().default(0),
  // Campos fiscais
  ncm: z.string().optional().nullable(),
  cfop: z.string().optional().nullable(),
  unidade_comercial: z.string().optional().nullable(),
  cst_icms: z.string().optional().nullable(),
  csosn: z.string().optional().nullable(),
  icms_origem: z.string().optional().nullable(),
  aliq_icms: z.number().optional().nullable(),
  cst_pis: z.string().optional().nullable(),
  aliq_pis: z.number().optional().nullable(),
  cst_cofins: z.string().optional().nullable(),
  aliq_cofins: z.number().optional().nullable(),
  cbenef: z.string().optional().nullable(),
})

// Categorias
export async function listarCategorias(empresaId: string): Promise<Categoria[]> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (error) throw error
  return (data || []) as Categoria[]
}

export async function criarCategoria(empresaId: string, dados: z.infer<typeof categoriaSchema>): Promise<Categoria> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const validado = categoriaSchema.parse(dados)
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('categorias')
    .insert({ ...validado, empresa_id: empresaId })
    .select()
    .single()

  if (error) throw error
  return data as Categoria
}

export async function atualizarCategoria(id: string, dados: Partial<z.infer<typeof categoriaSchema>>): Promise<Categoria> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categorias')
    .update({ ...dados, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Categoria
}

export async function deletarCategoria(id: string): Promise<void> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('categorias')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// Grupos de Produtos
export async function listarGruposProdutos(empresaId: string): Promise<GrupoProduto[]> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('grupos_produtos')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (error) throw error
  return (data || []) as GrupoProduto[]
}

export async function criarGrupoProduto(empresaId: string, dados: z.infer<typeof grupoProdutoSchema>): Promise<GrupoProduto> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const validado = grupoProdutoSchema.parse(dados)
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('grupos_produtos')
    .insert({ ...validado, empresa_id: empresaId })
    .select()
    .single()

  if (error) throw error
  return data as GrupoProduto
}

// Produtos
export async function listarProdutos(empresaId: string): Promise<ProdutoCompleto[]> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('produtos')
    .select(`
      *,
      categoria:categorias(*),
      grupo:grupos_produtos(*)
    `)
    .eq('empresa_id', empresaId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as ProdutoCompleto[]
}

export async function obterProduto(id: string): Promise<ProdutoCompleto | null> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  
  // Buscar produto
  const { data: produto, error: produtoError } = await supabase
    .from('produtos')
    .select(`
      *,
      categoria:categorias(*),
      grupo:grupos_produtos(*)
    `)
    .eq('id', id)
    .single()

  if (produtoError) throw produtoError
  if (!produto) return null

  // Buscar variações
  const { data: variacoes } = await supabase
    .from('variacoes')
    .select(`
      *,
      valores:variacao_valores(*)
    `)
    .eq('produto_id', id)
    .order('ordem', { ascending: true })

  // Buscar grupos de opcionais
  const { data: gruposOpcionais } = await supabase
    .from('grupos_opcionais')
    .select(`
      *,
      opcionais:opcionais(*)
    `)
    .eq('produto_id', id)
    .order('ordem', { ascending: true })

  // Buscar disponibilidades
  const { data: disponibilidades } = await supabase
    .from('produto_disponibilidade')
    .select('*')
    .eq('produto_id', id)

  // Buscar itens do kit (se for kit)
  let kitsItens: KitItem[] = []
  if (produto.tipo === 'KIT') {
    const { data: itens } = await supabase
      .from('kits_itens')
      .select(`
        *,
        produto:produtos!kits_itens_produto_id_fkey(*)
      `)
      .eq('kit_produto_id', id)
      .order('ordem', { ascending: true })
    kitsItens = (itens || []) as KitItem[]
  }

  return {
    ...produto,
    variacoes: variacoes || [],
    grupos_opcionais: gruposOpcionais || [],
    disponibilidades: disponibilidades || [],
    kits_itens: kitsItens,
  } as ProdutoCompleto
}

export async function criarProduto(dados: z.infer<typeof produtoSchema>): Promise<ProdutoCompleto> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const validado = produtoSchema.parse(dados)
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('produtos')
    .insert(validado)
    .select(`
      *,
      categoria:categorias(*),
      grupo:grupos_produtos(*)
    `)
    .single()

  if (error) throw error
  return data as ProdutoCompleto
}

export async function atualizarProduto(id: string, dados: Partial<z.infer<typeof produtoSchema>>): Promise<ProdutoCompleto> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('produtos')
    .update({ ...dados, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      categoria:categorias(*),
      grupo:grupos_produtos(*)
    `)
    .single()

  if (error) throw error
  return data as ProdutoCompleto
}

export async function deletarProduto(id: string): Promise<void> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('produtos')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// Variações
export async function criarVariacao(produtoId: string, dados: { nome: string; tipo: 'TEXTO' | 'NUMERO' | 'COR'; obrigatorio?: boolean; ordem?: number }): Promise<Variacao> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('variacoes')
    .insert({
      produto_id: produtoId,
      nome: dados.nome,
      tipo: dados.tipo,
      obrigatorio: dados.obrigatorio || false,
      ordem: dados.ordem || 0,
    })
    .select()
    .single()

  if (error) throw error
  return data as Variacao
}

export async function criarVariacaoValor(variacaoId: string, dados: { valor: string; label?: string; preco_adicional?: number; estoque?: number; ordem?: number }): Promise<VariacaoValor> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('variacao_valores')
    .insert({
      variacao_id: variacaoId,
      valor: dados.valor,
      label: dados.label,
      preco_adicional: dados.preco_adicional || 0,
      estoque: dados.estoque,
      ordem: dados.ordem || 0,
      ativo: true,
    })
    .select()
    .single()

  if (error) throw error
  return data as VariacaoValor
}

// Opcionais
export async function criarGrupoOpcional(produtoId: string, dados: { nome: string; descricao?: string; obrigatorio?: boolean; min_selecoes?: number; max_selecoes?: number; ordem?: number }): Promise<GrupoOpcional> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('grupos_opcionais')
    .insert({
      produto_id: produtoId,
      nome: dados.nome,
      descricao: dados.descricao,
      obrigatorio: dados.obrigatorio || false,
      min_selecoes: dados.min_selecoes || 0,
      max_selecoes: dados.max_selecoes,
      ordem: dados.ordem || 0,
    })
    .select()
    .single()

  if (error) throw error
  return data as GrupoOpcional
}

export async function criarOpcional(produtoId: string, dados: { nome: string; descricao?: string; preco: number; estoque?: number; grupo_id?: string; obrigatorio?: boolean; max_selecoes?: number; ordem?: number }): Promise<Opcional> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('opcionais')
    .insert({
      produto_id: produtoId,
      nome: dados.nome,
      descricao: dados.descricao,
      preco: dados.preco,
      estoque: dados.estoque,
      grupo_id: dados.grupo_id,
      obrigatorio: dados.obrigatorio || false,
      max_selecoes: dados.max_selecoes,
      ordem: dados.ordem || 0,
      ativo: true,
    })
    .select()
    .single()

  if (error) throw error
  return data as Opcional
}

// Disponibilidade
export async function listarTurmas(empresaId: string) {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('turmas')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('situacao', 'ATIVA')
    .order('descricao', { ascending: true })

  if (error) throw error
  return data || []
}

export async function listarAlunos(empresaId: string) {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('alunos')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('situacao', 'ATIVO')
    .order('nome', { ascending: true })

  if (error) throw error
  return data || []
}

export async function criarDisponibilidade(produtoId: string, dados: { tipo: 'TODOS' | 'SEGMENTO' | 'TURMA' | 'ALUNO'; segmento?: string; turma_id?: string; aluno_id?: string; disponivel_de?: string; disponivel_ate?: string }) {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('produto_disponibilidade')
    .insert({
      produto_id: produtoId,
      tipo: dados.tipo,
      segmento: dados.segmento || null,
      turma_id: dados.turma_id || null,
      aluno_id: dados.aluno_id || null,
      disponivel_de: dados.disponivel_de || null,
      disponivel_ate: dados.disponivel_ate || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deletarDisponibilidade(id: string) {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('produto_disponibilidade')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Actions para gerenciar itens do kit
export async function criarKitItem(kitProdutoId: string, produtoId: string, quantidade: number, ordem?: number): Promise<KitItem> {
  try {
    const ehAdmin = await verificarSeEhAdmin()
    if (!ehAdmin) {
      throw new Error('Não autorizado')
    }

    const supabase = await createClient()

    // Verificar se o produto é um kit
    const { data: kit, error: kitError } = await supabase
      .from('produtos')
      .select('tipo')
      .eq('id', kitProdutoId)
      .single()

    if (kitError) {
      console.error('[criarKitItem] Erro ao verificar kit:', kitError)
      throw new Error(`Erro ao verificar kit: ${kitError.message}`)
    }

    if (!kit || kit.tipo !== 'KIT') {
      throw new Error('Produto não é um kit')
    }

    // Verificar se o produto a ser adicionado não é o próprio kit
    if (kitProdutoId === produtoId) {
      throw new Error('Um kit não pode conter a si mesmo')
    }

    // Verificar se o produto a ser adicionado existe e não é um kit
    const { data: produto, error: produtoError } = await supabase
      .from('produtos')
      .select('id, tipo')
      .eq('id', produtoId)
      .single()

    if (produtoError) {
      console.error('[criarKitItem] Erro ao verificar produto:', produtoError)
      throw new Error(`Erro ao verificar produto: ${produtoError.message}`)
    }

    if (!produto) {
      throw new Error('Produto não encontrado')
    }

    if (produto.tipo === 'KIT') {
      throw new Error('Não é possível adicionar um kit dentro de outro kit')
    }

    const { data, error } = await supabase
      .from('kits_itens')
      .insert({
        kit_produto_id: kitProdutoId,
        produto_id: produtoId,
        quantidade,
        ordem: ordem || 0,
      })
      .select(`
        *,
        produto:produtos!kits_itens_produto_id_fkey(*)
      `)
      .single()

    if (error) {
      console.error('[criarKitItem] Erro ao inserir item do kit:', JSON.stringify(error, null, 2))
      const errorMessage = error.message || error.details || error.hint || 'Erro desconhecido ao adicionar produto ao kit'
      throw new Error(`Erro ao adicionar produto ao kit: ${errorMessage}`)
    }

    if (!data) {
      throw new Error('Item do kit não foi criado')
    }

    return data as KitItem
  } catch (error: any) {
    console.error('[criarKitItem] Erro completo:', error)
    throw error instanceof Error ? error : new Error(String(error))
  }
}

export async function listarKitItens(kitProdutoId: string): Promise<KitItem[]> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kits_itens')
    .select(`
      *,
      produto:produtos!kits_itens_produto_id_fkey(*)
    `)
    .eq('kit_produto_id', kitProdutoId)
    .order('ordem', { ascending: true })

  if (error) throw error
  return (data || []) as KitItem[]
}

export async function deletarKitItem(id: string): Promise<void> {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('kits_itens')
    .delete()
    .eq('id', id)

  if (error) throw error
}
