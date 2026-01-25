'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const adminSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  empresa_id: z.string().uuid().optional().nullable(),
  unidade_id: z.string().uuid().optional().nullable(),
  ativo: z.boolean().default(true),
})

/**
 * Listar todos os usuários (não apenas admins)
 */
export async function listarTodosUsuarios() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id,
      nome,
      nome_financeiro,
      nome_pedagogico,
      email_financeiro,
      email_pedagogico,
      ativo,
      empresa_id,
      unidade_id,
      auth_user_id,
      eh_admin,
      super_admin,
      tipo,
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
    .order('eh_admin', { ascending: false })
    .order('super_admin', { ascending: false })
    .order('nome')

  if (error) {
    console.error('Erro ao listar usuários:', error)
    throw new Error('Erro ao carregar usuários')
  }

  // Buscar emails dos usuários auth
  const adminClient = createAdminClient()
  const { data: users } = await adminClient.auth.admin.listUsers()

  const usuariosComEmail = (data || []).map((usuario: any) => {
    const user = usuario.auth_user_id 
      ? users?.users.find(u => u.id === usuario.auth_user_id)
      : null
    
    // Determinar email principal
    const email = user?.email || usuario.email_financeiro || usuario.email_pedagogico || 'N/A'
    
    // Determinar nome principal
    const nome = usuario.nome || usuario.nome_financeiro || usuario.nome_pedagogico || 'Sem nome'
    
    return {
      ...usuario,
      email,
      nome,
      ja_logou: !!usuario.auth_user_id, // Indica se já fez login alguma vez
    }
  })

  return usuariosComEmail
}

/**
 * Listar todos os admins (mantido para compatibilidade)
 */
export async function listarAdmins() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id,
      nome,
      ativo,
      empresa_id,
      unidade_id,
      auth_user_id,
      eh_admin,
      super_admin,
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
    .eq('eh_admin', true)
    .order('super_admin', { ascending: false })
    .order('nome')

  if (error) {
    console.error('Erro ao listar admins:', error)
    throw new Error('Erro ao carregar admins')
  }

  // Buscar emails dos usuários auth
  const adminClient = createAdminClient()
  const { data: users } = await adminClient.auth.admin.listUsers()

  const adminsComEmail = (data || []).map((admin: any) => {
    const user = users?.users.find(u => u.id === admin.auth_user_id)
    return {
      ...admin,
      email: user?.email || 'N/A',
    }
  })

  return adminsComEmail
}

/**
 * Obter um admin por ID
 */
export async function obterAdmin(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', id)
    .eq('eh_admin', true)
    .single()

  if (error) {
    console.error('Erro ao obter admin:', error)
    throw new Error('Erro ao carregar admin')
  }

  // Buscar email do usuário auth
  const adminClient = createAdminClient()
  if (data.auth_user_id) {
    const { data: user } = await adminClient.auth.admin.getUserById(data.auth_user_id)
    return {
      ...data,
      email: user?.user?.email || '',
    }
  }

  return {
    ...data,
    email: '',
  }
}

/**
 * Tornar um usuário admin (apenas super admins podem fazer isso)
 */
export async function tornarAdmin(
  usuarioId: string, 
  dados: {
    superAdmin?: boolean
    empresa_id?: string | null
    unidade_id?: string | null
  } = {}
) {
  const supabase = await createClient()
  
  // Verificar se quem está fazendo é super admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Não autenticado')
  }

  const { data: currentUser } = await supabase
    .from('usuarios')
    .select('super_admin')
    .eq('auth_user_id', user.id)
    .eq('super_admin', true)
    .single()

  if (!currentUser) {
    throw new Error('Apenas super administradores podem conceder permissões de admin')
  }

  // Buscar usuário atual
  const { data: usuarioAtual } = await supabase
    .from('usuarios')
    .select('auth_user_id, email_financeiro, email_pedagogico')
    .eq('id', usuarioId)
    .single()

  if (!usuarioAtual) {
    throw new Error('Usuário não encontrado')
  }

  // Se o usuário não tem auth_user_id, precisa criar no auth primeiro
  if (!usuarioAtual.auth_user_id) {
    const adminClient = createAdminClient()
    const email = usuarioAtual.email_financeiro || usuarioAtual.email_pedagogico
    
    if (!email) {
      throw new Error('Usuário não tem email cadastrado. É necessário ter email para criar conta de admin.')
    }

    // Criar usuário no auth sem senha (ele precisará fazer primeiro acesso)
    const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
      email: email,
      email_confirm: false,
    })

    if (userError) {
      console.error('Erro ao criar usuário auth:', userError)
      throw new Error('Erro ao criar conta de acesso para o usuário')
    }

    if (!newUser.user) {
      throw new Error('Usuário não foi criado no sistema de autenticação')
    }

    // Atualizar com auth_user_id e tornar admin
    const { error } = await supabase
      .from('usuarios')
      .update({
        auth_user_id: newUser.user.id,
        eh_admin: true,
        super_admin: dados.superAdmin || false,
        empresa_id: dados.empresa_id !== undefined ? dados.empresa_id : null,
        unidade_id: dados.unidade_id !== undefined ? dados.unidade_id : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', usuarioId)

    if (error) {
      console.error('Erro ao tornar admin:', error)
      // Se falhar, deletar usuário auth criado
      await adminClient.auth.admin.deleteUser(newUser.user.id)
      throw new Error('Erro ao conceder permissões de admin')
    }
  } else {
    // Usuário já tem auth_user_id, apenas atualizar permissões
    const { error } = await supabase
      .from('usuarios')
      .update({
        eh_admin: true,
        super_admin: dados.superAdmin !== undefined ? dados.superAdmin : false,
        empresa_id: dados.empresa_id !== undefined ? dados.empresa_id : null,
        unidade_id: dados.unidade_id !== undefined ? dados.unidade_id : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', usuarioId)

    if (error) {
      console.error('Erro ao tornar admin:', error)
      throw new Error('Erro ao conceder permissões de admin')
    }
  }

  return { success: true }
}

/**
 * Remover permissões de admin (apenas super admins podem fazer isso)
 */
export async function removerAdmin(usuarioId: string) {
  const supabase = await createClient()
  
  // Verificar se quem está fazendo é super admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Não autenticado')
  }

  const { data: currentUser } = await supabase
    .from('usuarios')
    .select('super_admin')
    .eq('auth_user_id', user.id)
    .eq('super_admin', true)
    .single()

  if (!currentUser) {
    throw new Error('Apenas super administradores podem remover permissões de admin')
  }

  // Verificar se o usuário tem alunos vinculados
  const { data: vinculos } = await supabase
    .from('usuario_aluno')
    .select('id')
    .eq('usuario_id', usuarioId)
    .limit(1)

  if (vinculos && vinculos.length > 0) {
    // É responsável também, apenas remover flag de admin
    const { error } = await supabase
      .from('usuarios')
      .update({
        eh_admin: false,
        super_admin: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', usuarioId)

    if (error) {
      throw new Error('Erro ao remover permissões de admin')
    }
  } else {
    // Não é responsável, pode deletar o registro
    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', usuarioId)

    if (error) {
      throw new Error('Erro ao remover admin')
    }
  }

  return { success: true }
}

/**
 * Criar admin
 */
export async function criarAdmin(dados: z.infer<typeof adminSchema> & { senha?: string }) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const dadosValidados = adminSchema.parse(dados)

  // Criar usuário no auth
  let authUserId: string

  if (dados.senha) {
    const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
      email: dadosValidados.email,
      password: dados.senha,
      email_confirm: true,
    })

    if (userError) {
      console.error('Erro ao criar usuário auth:', userError)
      throw new Error('Erro ao criar usuário')
    }

    if (!newUser.user) {
      throw new Error('Usuário não foi criado')
    }

    authUserId = newUser.user.id
  } else {
    // Se não tem senha, buscar usuário existente
    const { data: users } = await adminClient.auth.admin.listUsers()
    const existingUser = users?.users.find(u => u.email === dadosValidados.email)

    if (!existingUser) {
      throw new Error('Usuário não encontrado. Informe uma senha para criar novo usuário.')
    }

    authUserId = existingUser.id
  }

  // Criar/atualizar registro na tabela usuarios
  const { data, error } = await supabase
    .from('usuarios')
    .upsert({
      auth_user_id: authUserId,
      nome: dadosValidados.nome,
      eh_admin: true,
      empresa_id: dadosValidados.empresa_id || null,
      unidade_id: dadosValidados.unidade_id || null,
      ativo: dadosValidados.ativo,
      tipo: 'AMBOS' as any, // Default para admins
    }, {
      onConflict: 'auth_user_id'
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar admin:', error)
    // Se falhar, deletar usuário auth criado
    if (dados.senha) {
      await adminClient.auth.admin.deleteUser(authUserId)
    }
    throw new Error('Erro ao criar admin')
  }

  return {
    ...data,
    email: dadosValidados.email,
  }
}

/**
 * Atualizar admin
 */
export async function atualizarAdmin(id: string, dados: Partial<z.infer<typeof adminSchema>> & { senha?: string }) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Buscar usuario atual
  const { data: usuarioAtual } = await supabase
    .from('usuarios')
    .select('auth_user_id')
    .eq('id', id)
    .eq('eh_admin', true)
    .single()

  if (!usuarioAtual) {
    throw new Error('Admin não encontrado')
  }

  // Se tem senha, atualizar senha do usuário auth
  if (dados.senha && usuarioAtual.auth_user_id) {
    await adminClient.auth.admin.updateUserById(usuarioAtual.auth_user_id, {
      password: dados.senha,
    })
  }

  // Atualizar dados do usuario
  const dadosParaAtualizar: any = {}
  if (dados.nome) dadosParaAtualizar.nome = dados.nome
  if (dados.empresa_id !== undefined) dadosParaAtualizar.empresa_id = dados.empresa_id
  if (dados.unidade_id !== undefined) dadosParaAtualizar.unidade_id = dados.unidade_id
  if (dados.ativo !== undefined) dadosParaAtualizar.ativo = dados.ativo
  dadosParaAtualizar.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('usuarios')
    .update(dadosParaAtualizar)
    .eq('id', id)
    .eq('eh_admin', true)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar admin:', error)
    throw new Error('Erro ao atualizar admin')
  }

  return data
}

/**
 * Deletar admin
 */
export async function deletarAdmin(id: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Buscar auth_user_id antes de deletar
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('auth_user_id, eh_admin')
    .eq('id', id)
    .single()

  if (!usuario) {
    throw new Error('Admin não encontrado')
  }

  // Se for apenas admin (não é responsável também), deletar completamente
  // Se for admin E responsável, apenas remover flag de admin
  if (usuario.eh_admin) {
    // Verificar se também é responsável (tem alunos vinculados)
    const { data: vinculos } = await supabase
      .from('usuario_aluno')
      .select('id')
      .eq('usuario_id', id)
      .limit(1)

    if (vinculos && vinculos.length > 0) {
      // É responsável também, apenas remover flag de admin
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ eh_admin: false })
        .eq('id', id)

      if (updateError) {
        console.error('Erro ao remover flag de admin:', updateError)
        throw new Error('Erro ao remover permissões de admin')
      }
    } else {
      // Não é responsável, pode deletar o registro
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Erro ao deletar admin:', error)
        throw new Error('Erro ao deletar admin')
      }

      // Deletar usuário auth (se existir)
      if (usuario.auth_user_id) {
        await adminClient.auth.admin.deleteUser(usuario.auth_user_id)
      }
    }
  }
}
