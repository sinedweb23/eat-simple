import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const supabase = createAdminClient()

    // Verificar se SERVICE_ROLE_KEY está configurada
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_service_role_key') {
      return NextResponse.json(
        { error: 'SERVICE_ROLE_KEY não configurada. Configure no .env.local' },
        { status: 400 }
      )
    }

    const resultados: any = {}

    // 1. Criar usuário ADMIN
    const { data: adminUser, error: adminUserError } = await supabase.auth.admin.createUser({
      email: 'admin@teste.com',
      password: 'admin123',
      email_confirm: true,
    })

    if (adminUserError) {
      // Se o usuário já existe, buscar ele
      const { data: existingAdmin } = await supabase.auth.admin.listUsers()
      const user = existingAdmin?.users.find(u => u.email === 'admin@teste.com')
      
      if (user) {
        resultados.admin = { email: user.email, id: user.id, status: 'já existia' }
      } else {
        return NextResponse.json({ error: `Erro ao criar admin: ${adminUserError.message}` }, { status: 500 })
      }
    } else {
      resultados.admin = { email: adminUser.user.email, id: adminUser.user.id, status: 'criado' }
    }

    // 2. Obter empresa de teste
    const { data: empresa } = await supabase
      .from('empresas')
      .select('id')
      .limit(1)
      .single()

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada. Execute as migrations primeiro.' }, { status: 500 })
    }

    // 3. Criar/atualizar registro na tabela usuarios (como admin)
    const adminUserId = adminUser?.user?.id || resultados.admin.id
    const { data: admin, error: adminError } = await supabase
      .from('usuarios')
      .upsert({
        auth_user_id: adminUserId,
        nome: 'Admin Teste',
        eh_admin: true,
        empresa_id: empresa.id,
        ativo: true,
        tipo: 'AMBOS'::responsavel_tipo,
      }, {
        onConflict: 'auth_user_id'
      })
      .select()
      .single()

    if (adminError) {
      return NextResponse.json({ error: `Erro ao criar registro admin: ${adminError.message}` }, { status: 500 })
    }

    resultados.admin.registro = 'criado/atualizado'

    // 4. Criar usuário RESPONSÁVEL
    const { data: responsavelUser, error: responsavelUserError } = await supabase.auth.admin.createUser({
      email: 'responsavel@teste.com',
      password: 'resp123',
      email_confirm: true,
    })

    if (responsavelUserError) {
      // Se o usuário já existe, buscar ele
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const user = existingUsers?.users.find(u => u.email === 'responsavel@teste.com')
      
      if (user) {
        resultados.responsavel = { email: user.email, id: user.id, status: 'já existia' }
      } else {
        return NextResponse.json({ error: `Erro ao criar responsável: ${responsavelUserError.message}` }, { status: 500 })
      }
    } else {
      resultados.responsavel = { email: responsavelUser.user.email, id: responsavelUser.user.id, status: 'criado' }
    }

    // 5. Criar/atualizar registro na tabela usuarios (como responsável)
    const responsavelUserId = responsavelUser?.user?.id || resultados.responsavel.id
    const { data: responsavel, error: responsavelError } = await supabase
      .from('usuarios')
      .upsert({
        auth_user_id: responsavelUserId,
        tipo: 'AMBOS',
        eh_admin: false,
        nome_financeiro: 'Responsável Financeiro Teste',
        cpf_financeiro: '12345678900',
        email_financeiro: 'responsavel@teste.com',
        nome_pedagogico: 'Responsável Pedagógico Teste',
        cpf_pedagogico: '12345678900',
        email_pedagogico: 'responsavel@teste.com',
      }, {
        onConflict: 'auth_user_id'
      })
      .select()
      .single()

    if (responsavelError) {
      return NextResponse.json({ error: `Erro ao criar registro responsável: ${responsavelError.message}` }, { status: 500 })
    }

    resultados.responsavel.registro = 'criado/atualizado'

    return NextResponse.json({
      success: true,
      message: 'Usuários criados com sucesso!',
      usuarios: {
        admin: {
          email: 'admin@teste.com',
          senha: 'admin123',
          url: 'http://localhost:3000/admin'
        },
        responsavel: {
          email: 'responsavel@teste.com',
          senha: 'resp123',
          url: 'http://localhost:3000/loja'
        }
      },
      detalhes: resultados
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
