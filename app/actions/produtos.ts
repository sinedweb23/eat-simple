'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ProdutoComDisponibilidade, ProdutoCompleto, KitItem, Aluno } from '@/lib/types/database'

const alunoIdSchema = z.string().uuid().optional()

// Nova função: buscar produtos disponíveis para TODOS os alunos do responsável
export async function getProdutosDisponiveisParaResponsavel(): Promise<ProdutoComDisponibilidade[]> {
  try {
    const supabase = await createClient()
    console.log('[getProdutosDisponiveisParaResponsavel] Iniciando...')

    // 1. Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Não autenticado')
  }

    console.log('[getProdutosDisponiveisParaResponsavel] Buscando responsável para user.id:', user.id, 'email:', user.email)
    
    // Primeiro tentar buscar por auth_user_id
    let responsavel: any = null
    let responsavelError: any = null
    
    const { data: respPorAuth, error: errorAuth } = await supabase
      .from('usuarios')
      .select('id, auth_user_id, ativo')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (errorAuth) {
      console.error('[getProdutosDisponiveisParaResponsavel] Erro ao buscar por auth_user_id:', errorAuth)
      responsavelError = errorAuth
    } else if (respPorAuth) {
      responsavel = respPorAuth
    }

    // Se não encontrou por auth_user_id, tentar buscar por email
    if (!responsavel && user.email) {
      console.log('[getProdutosDisponiveisParaResponsavel] Tentando buscar por email:', user.email)
      
      const { data: respPorEmail, error: errorEmail } = await supabase
        .from('usuarios')
        .select('id, email_financeiro, email_pedagogico, auth_user_id, ativo')
        .or(`email_financeiro.eq.${user.email},email_pedagogico.eq.${user.email}`)
        .maybeSingle()

      if (errorEmail) {
        console.error('[getProdutosDisponiveisParaResponsavel] Erro ao buscar por email:', errorEmail)
        if (!responsavelError) {
          responsavelError = errorEmail
        }
      } else if (respPorEmail) {
        console.log('[getProdutosDisponiveisParaResponsavel] Responsável encontrado por email, mas sem auth_user_id vinculado')
        console.log('[getProdutosDisponiveisParaResponsavel] Responsável ID:', respPorEmail.id, 'auth_user_id:', respPorEmail.auth_user_id)
        
        // Se encontrou por email mas não tem auth_user_id, tentar vincular
        if (!respPorEmail.auth_user_id) {
          const { error: updateError } = await supabase
            .from('usuarios')
            .update({ auth_user_id: user.id })
            .eq('id', respPorEmail.id)

          if (updateError) {
            console.error('[getProdutosDisponiveisParaResponsavel] Erro ao vincular auth_user_id:', updateError)
            throw new Error('Responsável encontrado mas não foi possível vincular à conta. Entre em contato com o suporte.')
          }
          
          console.log('[getProdutosDisponiveisParaResponsavel] auth_user_id vinculado com sucesso!')
          responsavel = { ...respPorEmail, auth_user_id: user.id }
        } else {
          // Se tem auth_user_id mas é diferente, não pode usar
          throw new Error('Este email já está vinculado a outra conta.')
        }
      }
    }

    if (responsavelError && !responsavel) {
      console.error('[getProdutosDisponiveisParaResponsavel] Erro ao buscar responsável:', responsavelError)
      throw new Error(`Erro ao buscar responsável: ${responsavelError.message || 'Erro desconhecido'}`)
    }

    if (!responsavel) {
      console.log('[getProdutosDisponiveisParaResponsavel] Responsável não encontrado para user.id:', user.id, 'email:', user.email)
      throw new Error('Responsável não encontrado. Verifique se seu email está cadastrado como responsável ou solicite primeiro acesso.')
    }

    if (!responsavel.ativo) {
      throw new Error('Sua conta está inativa. Entre em contato com a administração.')
    }

    console.log('[getProdutosDisponiveisParaResponsavel] Responsável encontrado:', responsavel.id)

    // 2. Buscar todos os alunos vinculados
    const { data: vinculos } = await supabase
      .from('usuario_aluno')
      .select('aluno_id')
      .eq('usuario_id', responsavel.id)

    if (!vinculos || vinculos.length === 0) {
      return []
    }

    const alunoIds = vinculos.map(v => v.aluno_id)

    // 3. Buscar dados dos alunos
    const { data: alunos } = await supabase
      .from('alunos')
      .select('id, nome, empresa_id, unidade_id, turma_id')
      .in('id', alunoIds)
      .eq('situacao', 'ATIVO')

      const alunosTyped = (alunos || []) as Pick<Aluno, 'id' | 'nome' | 'empresa_id' | 'unidade_id' | 'turma_id'>[]

      if (alunosTyped.length === 0) {
        return []
      }
      
    // Buscar turmas e segmentos separadamente
    const turmasIds = alunosTyped.map(a => a.turma_id).filter(Boolean) as string[]
    let turmas: any[] = []
    
    if (turmasIds.length > 0) {
      const { data: turmasData } = await supabase
        .from('turmas')
        .select('id, segmento')
        .in('id', turmasIds)
      turmas = turmasData || []
    }

    const turmaSegmentoMap = new Map(
      turmas.map(t => [t.id, t.segmento])
    )

    // 4. Coletar empresas e unidades únicas
    const empresasIds = [...new Set(alunosTyped.map(a => a.empresa_id))]
    const unidadesIds = alunosTyped.map(a => a.unidade_id).filter(Boolean) as string[]
    const alunosSemUnidade = alunosTyped.some(a => !a.unidade_id)
    const segmentos = alunosTyped
      .map(a => turmaSegmentoMap.get(a.turma_id || ''))
      .filter(Boolean) as string[]
    

    // 5. Buscar produtos das empresas/unidades dos alunos
    // Buscar produtos da empresa (sem filtro de unidade primeiro, depois filtrar no código)
    const { data: produtosRaw, error: produtosError } = await supabase
      .from('produtos')
      .select('id, empresa_id, unidade_id, tipo, nome, descricao, preco, estoque, compra_unica, limite_max_compra_unica, permitir_pix, permitir_cartao, ativo, imagem_url, sku, categoria_id, grupo_id, ordem, created_at, updated_at')
      .eq('ativo', true)
      .in('empresa_id', empresasIds)

    if (produtosError) {
      console.error('Erro ao buscar produtos:', produtosError)
      return []
    }

    if (!produtosRaw || produtosRaw.length === 0) {
      return []
    }

    // Filtrar produtos por unidade no código
    // Regra: 
    // - Produto sem unidade (null) está disponível para TODOS os alunos da empresa
    // - Produto com unidade específica está disponível se:
    //   a) Algum aluno tem essa mesma unidade, OU
    //   b) Todos os alunos não têm unidade (null) - nesse caso, produto com unidade também aparece (assumindo que são da mesma empresa)
    console.log('[getProdutosDisponiveisParaResponsavel] Produtos brutos encontrados:', produtosRaw.length)
    console.log('[getProdutosDisponiveisParaResponsavel] Unidades dos alunos:', unidadesIds)
    console.log('[getProdutosDisponiveisParaResponsavel] Alunos sem unidade:', alunosSemUnidade)
    
    const produtos = produtosRaw.filter((p: any) => {
      // Se produto não tem unidade, está disponível para todos
      if (!p.unidade_id) {
        console.log(`[getProdutosDisponiveisParaResponsavel] Produto "${p.nome}" sem unidade - DISPONÍVEL`)
        return true
      }
      // Se produto tem unidade, verificar se algum aluno tem essa unidade
      if (unidadesIds.includes(p.unidade_id)) {
        console.log(`[getProdutosDisponiveisParaResponsavel] Produto "${p.nome}" com unidade ${p.unidade_id} - DISPONÍVEL (aluno tem essa unidade)`)
        return true
      }
      // Se todos os alunos não têm unidade (null), produto com unidade também aparece (mesma empresa)
      if (alunosSemUnidade && unidadesIds.length === 0) {
        console.log(`[getProdutosDisponiveisParaResponsavel] Produto "${p.nome}" com unidade ${p.unidade_id} - DISPONÍVEL (alunos sem unidade, mesma empresa)`)
        return true
      }
      console.log(`[getProdutosDisponiveisParaResponsavel] Produto "${p.nome}" com unidade ${p.unidade_id} - NÃO DISPONÍVEL`)
      return false
    })

    console.log('[getProdutosDisponiveisParaResponsavel] Produtos após filtro de unidade:', produtos.length)

    if (produtos.length === 0) {
      console.log('[getProdutosDisponiveisParaResponsavel] Nenhum produto passou no filtro de unidade')
      return []
    }

    // 6. Buscar disponibilidades
    const produtoIds = produtos.map(p => p.id)
    const { data: disponibilidades } = await supabase
      .from('produto_disponibilidade')
      .select('*')
      .in('produto_id', produtoIds)

    // 7. Filtrar produtos
    const agora = new Date()
    const produtosDisponiveis: ProdutoComDisponibilidade[] = []
    const produtosProcessados = new Set<string>()

    for (const produto of produtos) {
      if (produtosProcessados.has(produto.id)) continue

      const disponibilidadesProduto = (disponibilidades || []).filter(d => d.produto_id === produto.id)

      console.log(`[getProdutosDisponiveisParaResponsavel] Processando produto "${produto.nome}" (ID: ${produto.id}) - ${disponibilidadesProduto.length} disponibilidade(s)`)

      // Se não tem disponibilidade definida, produto NÃO está disponível (não aparece para ninguém)
      if (disponibilidadesProduto.length === 0) {
        console.log(`[getProdutosDisponiveisParaResponsavel] Produto "${produto.nome}" sem disponibilidade definida - NÃO DISPONÍVEL (não será exibido)`)
        produtosProcessados.add(produto.id)
        continue
      }

      let disponivelParaAlgumAluno = false

      // PRIMEIRO: Verificar se há disponibilidade "TODOS" válida (dentro da janela de datas)
      // Se houver "TODOS" válido, o produto está disponível para TODOS os alunos, não precisa verificar outros
      const disponibilidadeTodos = disponibilidadesProduto.find(disp => disp.tipo === 'TODOS')
      if (disponibilidadeTodos) {
        console.log(`[getProdutosDisponiveisParaResponsavel] Produto "${produto.nome}" tem disponibilidade TODOS - verificando janela de datas`)
        // Verificar janela de datas
        let dentroDaJanela = true
        if (disponibilidadeTodos.disponivel_de) {
          const dataInicio = new Date(disponibilidadeTodos.disponivel_de)
          if (agora < dataInicio) {
            dentroDaJanela = false
            console.log(`[getProdutosDisponiveisParaResponsavel] Produto "${produto.nome}" com disponibilidade TODOS ainda não está disponível (início: ${disponibilidadeTodos.disponivel_de})`)
          }
        }
        if (disponibilidadeTodos.disponivel_ate) {
          const dataFim = new Date(disponibilidadeTodos.disponivel_ate)
          if (agora > dataFim) {
            dentroDaJanela = false
            console.log(`[getProdutosDisponiveisParaResponsavel] Produto "${produto.nome}" com disponibilidade TODOS já expirou (fim: ${disponibilidadeTodos.disponivel_ate})`)
          }
        }

        if (dentroDaJanela) {
          // Se "TODOS" está válido, produto está disponível para todos os alunos
          disponivelParaAlgumAluno = true
          console.log(`[getProdutosDisponiveisParaResponsavel] ✅ Produto "${produto.nome}" está disponível para TODOS os alunos`)
        } else {
          console.log(`[getProdutosDisponiveisParaResponsavel] ❌ Produto "${produto.nome}" com disponibilidade TODOS está FORA da janela de datas`)
        }
      }

      // Se não encontrou "TODOS" válido, verificar outras regras de disponibilidade
      if (!disponivelParaAlgumAluno) {
        console.log(`[getProdutosDisponiveisParaResponsavel] Produto "${produto.nome}" não tem TODOS válido - verificando outras regras (SEGMENTO/TURMA/ALUNO)`)
        console.log(`[getProdutosDisponiveisParaResponsavel] Segmentos dos alunos:`, segmentos)
        console.log(`[getProdutosDisponiveisParaResponsavel] Turmas dos alunos:`, turmasIds)
        
        for (const aluno of alunosTyped) {
          for (const disp of disponibilidadesProduto) {
            // Pular "TODOS" já que já foi verificado acima
            if (disp.tipo === 'TODOS') continue

            // Verificar janela de datas
            let dentroDaJanela = true
            if (disp.disponivel_de) {
              const dataInicio = new Date(disp.disponivel_de)
              if (agora < dataInicio) dentroDaJanela = false
            }
            if (disp.disponivel_ate) {
              const dataFim = new Date(disp.disponivel_ate)
              if (agora > dataFim) dentroDaJanela = false
            }
            if (!dentroDaJanela) {
              console.log(`[getProdutosDisponiveisParaResponsavel] Produto "${produto.nome}" - disponibilidade ${disp.tipo} está FORA da janela de datas`)
              continue
            }

            // Verificar tipo de disponibilidade
            if (disp.tipo === 'SEGMENTO' && disp.segmento && segmentos.includes(disp.segmento)) {
              console.log(`[getProdutosDisponiveisParaResponsavel] ✅ Produto "${produto.nome}" disponível por SEGMENTO ${disp.segmento} para aluno ${aluno.nome}`)
              disponivelParaAlgumAluno = true
              break
            } else if (disp.tipo === 'TURMA' && disp.turma_id && turmasIds.length > 0 && turmasIds.includes(disp.turma_id)) {
              console.log(`[getProdutosDisponiveisParaResponsavel] ✅ Produto "${produto.nome}" disponível por TURMA ${disp.turma_id} para aluno ${aluno.nome}`)
              disponivelParaAlgumAluno = true
              break
            } else if (disp.tipo === 'ALUNO' && disp.aluno_id === aluno.id) {
              console.log(`[getProdutosDisponiveisParaResponsavel] ✅ Produto "${produto.nome}" disponível por ALUNO ${aluno.nome}`)
              disponivelParaAlgumAluno = true
              break
            }
          }

          if (disponivelParaAlgumAluno) break
        }
        
        if (!disponivelParaAlgumAluno) {
          console.log(`[getProdutosDisponiveisParaResponsavel] ❌ Produto "${produto.nome}" NÃO está disponível para nenhum aluno`)
        }
      }

      if (disponivelParaAlgumAluno) {
        produtosDisponiveis.push({
          ...produto,
          disponibilidades: disponibilidadesProduto
        })
        produtosProcessados.add(produto.id)
      }
    }

    console.log('[getProdutosDisponiveisParaResponsavel] Sucesso:', produtosDisponiveis.length, 'produtos')
    return produtosDisponiveis
  } catch (error: any) {
    console.error('[getProdutosDisponiveisParaResponsavel] Erro completo:', error)
    console.error('[getProdutosDisponiveisParaResponsavel] Mensagem:', error?.message)
    console.error('[getProdutosDisponiveisParaResponsavel] Stack:', error?.stack)
    // Retornar array vazio em caso de erro ao invés de quebrar
    return []
  }
}

// Função original mantida para compatibilidade (usar no carrinho)
export async function getProdutosDisponiveis(alunoId: string): Promise<ProdutoComDisponibilidade[]> {
  const validatedAlunoId = alunoIdSchema.parse(alunoId)
  if (!validatedAlunoId) {
    throw new Error('Aluno ID é obrigatório')
  }

  const supabase = await createClient()

  // 1. Verificar se o aluno existe e obter dados
  const { data: aluno, error: alunoError } = await supabase
    .from('alunos')
    .select('id, empresa_id, unidade_id, turma_id')
    .eq('id', validatedAlunoId)
    .single()

  if (alunoError || !aluno) {
    throw new Error('Aluno não encontrado')
  }

  // 2. Verificar se o responsável tem acesso a este aluno
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Não autenticado')
  }

  const { data: responsavel } = await supabase
  .from('usuarios')
  .select('id, ativo')
  .eq('auth_user_id', user.id)
  .maybeSingle()

if (!responsavel) {
  throw new Error('Responsável não encontrado')
}

if (!responsavel.ativo) {
  throw new Error('Sua conta está inativa. Entre em contato com a administração.')
}


  const { data: vinculo } = await supabase
    .from('usuario_aluno')
    .select('id')
      .eq('usuario_id', responsavel.id)
    .eq('aluno_id', validatedAlunoId)
    .single()

  if (!vinculo) {
    throw new Error('Acesso negado: aluno não vinculado ao responsável')
  }

  // 3. Obter dados da turma e segmento
  let segmento: string | null = null
  if (aluno.turma_id) {
    const { data: turma } = await supabase
      .from('turmas')
      .select('segmento')
      .eq('id', aluno.turma_id)
      .single()
    
    if (turma) {
      segmento = turma.segmento
    }
  }

  // 4. Buscar produtos da empresa/unidade
  const { data: produtos, error: produtosError } = await supabase
    .from('produtos')
    .select('id, empresa_id, unidade_id, tipo, nome, descricao, preco, estoque, compra_unica, limite_max_compra_unica, permitir_pix, permitir_cartao, ativo, imagem_url, sku, categoria_id, grupo_id, ordem, created_at, updated_at')
    .eq('ativo', true)
    .eq('empresa_id', aluno.empresa_id)
    .or(
      aluno.unidade_id
        ? `unidade_id.is.null,unidade_id.eq.${aluno.unidade_id}`
        : 'unidade_id.is.null'
    )

  if (produtosError) {
    throw new Error('Erro ao buscar produtos')
  }

  if (!produtos || produtos.length === 0) {
    return []
  }

  // 5. Buscar disponibilidades
  const produtoIds = produtos.map(p => p.id)
  const { data: disponibilidades } = await supabase
    .from('produto_disponibilidade')
    .select('*')
    .in('produto_id', produtoIds)

  // 6. Filtrar produtos por disponibilidade
  const agora = new Date()
  const produtosDisponiveis: ProdutoComDisponibilidade[] = []

  for (const produto of produtos) {
    const disponibilidadesProduto = (disponibilidades || []).filter(d => d.produto_id === produto.id)

    // Se não tem disponibilidade definida, produto NÃO está disponível (não aparece para ninguém)
    if (disponibilidadesProduto.length === 0) {
      continue
    }

    // Verificar cada regra de disponibilidade
    let disponivel = false
    for (const disp of disponibilidadesProduto) {
      // Verificar janela de datas
      if (disp.disponivel_de) {
        const dataInicio = new Date(disp.disponivel_de)
        if (agora < dataInicio) continue
      }
      if (disp.disponivel_ate) {
        const dataFim = new Date(disp.disponivel_ate)
        if (agora > dataFim) continue
      }

      // Verificar tipo de disponibilidade
      if (disp.tipo === 'TODOS') {
        disponivel = true
        break
      } else if (disp.tipo === 'SEGMENTO' && disp.segmento && segmento === disp.segmento) {
        disponivel = true
        break
      } else if (disp.tipo === 'TURMA' && disp.turma_id === aluno.turma_id) {
        disponivel = true
        break
      } else if (disp.tipo === 'ALUNO' && disp.aluno_id === aluno.id) {
        disponivel = true
        break
      }
    }

    if (disponivel) {
      produtosDisponiveis.push({
        ...produto,
        disponibilidades: disponibilidadesProduto
      })
    }
  }

  return produtosDisponiveis
}

// Buscar produto completo com variações e opcionais para a loja
export async function obterProdutoCompleto(id: string): Promise<ProdutoCompleto | null> {
  const supabase = await createClient()
  
  // Verificar autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Não autenticado')
  }

  // Buscar produto
  const { data: produto, error: produtoError } = await supabase
    .from('produtos')
    .select(`
      *,
      categoria:categorias(*),
      grupo:grupos_produtos(*)
    `)
    .eq('id', id)
    .eq('ativo', true)
    .single()

  if (produtoError || !produto) {
    return null
  }

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

  // Filtrar valores de variação ativos manualmente
  const variacoesComValores = (variacoes || []).map(v => ({
    ...v,
    valores: (v.valores || []).filter((val: any) => val.ativo).sort((a: any, b: any) => a.ordem - b.ordem)
  })).filter(v => v.valores.length > 0)

  // Filtrar opcionais ativos manualmente
  const gruposComOpcionais = (gruposOpcionais || []).map(g => ({
    ...g,
    opcionais: (g.opcionais || []).filter((o: any) => o.ativo).sort((a: any, b: any) => a.ordem - b.ordem)
  })).filter(g => g.opcionais.length > 0)

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
    variacoes: variacoesComValores,
    grupos_opcionais: gruposComOpcionais,
    disponibilidades: disponibilidades || [],
    kits_itens: kitsItens,
  } as ProdutoCompleto
}
