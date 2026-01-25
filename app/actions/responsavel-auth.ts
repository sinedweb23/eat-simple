'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { enviarEmailPrimeiroAcesso, enviarEmailRecuperacaoSenha } from '@/lib/email'

const emailSchema = z.string().email('Email inválido')

/**
 * Solicita primeiro acesso - verifica email e envia convite
 */
export async function solicitarPrimeiroAcesso(email: string) {
  try {
    const emailValidado = emailSchema.parse(email.trim().toLowerCase())
    const supabase = createAdminClient()

    // 1. Verificar se email existe na tabela responsaveis e está ativo
    // Buscar por email financeiro primeiro
    let responsavel: any = null
    
    const { data: respFin, error: finError } = await supabase
      .from('usuarios')
      .select('id, nome_financeiro, nome_pedagogico, email_financeiro, email_pedagogico, ativo, auth_user_id')
      .eq('email_financeiro', emailValidado)
      .maybeSingle()
    
    if (finError) {
      console.error('Erro ao buscar por email financeiro:', finError)
      throw new Error('Erro ao verificar email')
    } else if (respFin) {
      responsavel = respFin
    }
    
    // Se não encontrou, buscar por email pedagógico
    if (!responsavel) {
      const { data: respPed, error: pedError } = await supabase
        .from('usuarios')
        .select('id, nome_financeiro, nome_pedagogico, email_financeiro, email_pedagogico, ativo, auth_user_id')
        .eq('email_pedagogico', emailValidado)
        .maybeSingle()
      
      if (pedError) {
        console.error('Erro ao buscar por email pedagógico:', pedError)
        throw new Error('Erro ao verificar email')
      } else if (respPed) {
        responsavel = respPed
      }
    }

    if (!responsavel) {
      // Não revelar que o email não existe por segurança
      console.log('⚠️ Email não encontrado na tabela usuarios:', emailValidado)
      return {
        success: true,
        message: 'Se o email estiver cadastrado e ativo, você receberá um email com instruções para criar sua senha.',
      }
    }

    if (!responsavel.ativo) {
      throw new Error('Este email está inativo. Entre em contato com a administração.')
    }

    // 2. Verificar se já tem usuário no auth
    if (responsavel.auth_user_id) {
      // Usuário já existe, enviar email de reset de senha
      const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`
      const { data: linkData, error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: emailValidado,
        options: {
          redirectTo: redirectTo,
        },
      })

      if (resetError) {
        console.error('Erro ao gerar link de recuperação:', resetError)
        throw new Error('Erro ao gerar link de recuperação de senha')
      }

      const recoveryLink = linkData?.properties?.action_link
      console.log('🔗 Link de recuperação gerado:', recoveryLink)

      if (!recoveryLink) {
        throw new Error('Link de recuperação não foi gerado')
      }

      // Enviar email usando nodemailer
      const nomeResponsavel = responsavel.nome_financeiro || responsavel.nome_pedagogico || undefined
      const emailResult = await enviarEmailRecuperacaoSenha(
        emailValidado,
        recoveryLink,
        nomeResponsavel
      )

      if (!emailResult.success) {
        console.error('⚠️ Erro ao enviar email, mas link foi gerado:', emailResult.error)
        // Ainda retornar sucesso, mas mostrar link em desenvolvimento
        return {
          success: true,
          message: 'Link de recuperação gerado. Verifique sua caixa de entrada ou use o link abaixo.',
          ...(process.env.NODE_ENV === 'development' ? { debugLink: recoveryLink } : {}),
        }
      }

      return {
        success: true,
        message: 'Email de recuperação de senha enviado. Verifique sua caixa de entrada.',
        // Em desenvolvimento, retornar o link também
        ...(process.env.NODE_ENV === 'development' && recoveryLink ? { debugLink: recoveryLink } : {}),
      }
    }

    // 3. Criar usuário no auth e enviar email de confirmação
    const nomeResponsavel = responsavel.nome_financeiro || responsavel.nome_pedagogico || 'Responsável'
    
    // Criar usuário sem senha (será definida no primeiro acesso)
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: emailValidado,
      email_confirm: false, // Não confirmar email ainda
      user_metadata: {
        nome: nomeResponsavel,
        usuario_id: responsavel.id,
      },
    })

    if (createError) {
      console.error('Erro ao criar usuário:', createError)
      
      // Se usuário já existe mas não está vinculado, tentar vincular
      if (createError.message.includes('already registered')) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existingUser = existingUsers?.users.find(u => u.email === emailValidado)
        
        if (existingUser) {
          // Vincular usuário existente ao responsável
          const { error: updateError } = await supabase
            .from('usuarios')
            .update({ auth_user_id: existingUser.id })
            .eq('id', responsavel.id)

          if (updateError) {
            throw new Error('Erro ao vincular usuário existente')
          }

          // Enviar email de recuperação
          const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`
          const { data: linkData } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: emailValidado,
            options: {
              redirectTo,
            },
          })

          const recoveryLink = linkData?.properties?.action_link
          console.log('🔗 Link de recuperação gerado (usuário existente):', recoveryLink)

          if (recoveryLink) {
            const nomeResponsavel = responsavel.nome_financeiro || responsavel.nome_pedagogico || undefined
            const emailResult = await enviarEmailRecuperacaoSenha(
              emailValidado,
              recoveryLink,
              nomeResponsavel
            )

            if (!emailResult.success) {
              console.error('⚠️ Erro ao enviar email:', emailResult.error)
            }
          }

          return {
            success: true,
            message: 'Email de recuperação de senha enviado. Verifique sua caixa de entrada.',
            // Em desenvolvimento, retornar o link também
            ...(process.env.NODE_ENV === 'development' && recoveryLink ? { debugLink: recoveryLink } : {}),
          }
        }
      }
      
      throw new Error('Erro ao criar conta. Tente novamente ou entre em contato com o suporte.')
    }

    if (!newUser.user) {
      throw new Error('Erro ao criar usuário')
    }

    // 4. Vincular auth_user_id ao responsável
    const { error: vincularError } = await supabase
      .from('usuarios')
      .update({ auth_user_id: newUser.user.id })
      .eq('id', responsavel.id)

    if (vincularError) {
      console.error('Erro ao vincular usuário:', vincularError)
      // Não falhar aqui, o usuário pode fazer login depois
    }

    // 5. Enviar email de confirmação com link para criar senha
    // Usar 'recovery' que permite definir senha mesmo sem ter uma senha anterior
    // Definir redirect_to para nossa rota de callback que processa o token
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`
    const { data: linkData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: emailValidado,
      options: {
        redirectTo,
      },
    })

    if (recoveryError) {
      console.error('❌ Erro ao gerar link de recuperação:', recoveryError)
      throw new Error('Erro ao enviar email de confirmação')
    }

    const recoveryLink = linkData?.properties?.action_link
    console.log('🔗 Link de recuperação gerado para novo usuário:', recoveryLink)
    console.log('📧 Email:', emailValidado)
    console.log('👤 Usuário criado:', newUser.user.id)

    if (!recoveryLink) {
      throw new Error('Link de recuperação não foi gerado')
    }

    // Enviar email usando nodemailer
    const emailResult = await enviarEmailPrimeiroAcesso(
      emailValidado,
      recoveryLink,
      nomeResponsavel
    )

    if (!emailResult.success) {
      console.error('⚠️ Erro ao enviar email, mas link foi gerado:', emailResult.error)
      // Ainda retornar sucesso, mas mostrar link em desenvolvimento
      return {
        success: true,
        message: 'Link de confirmação gerado. Verifique sua caixa de entrada ou use o link abaixo.',
        ...(process.env.NODE_ENV === 'development' ? { debugLink: recoveryLink } : {}),
      }
    }

    return {
      success: true,
      message: 'Email de confirmação enviado! Verifique sua caixa de entrada e clique no link para criar sua senha.',
      // Em desenvolvimento, retornar o link também para facilitar testes
      ...(process.env.NODE_ENV === 'development' && recoveryLink ? { debugLink: recoveryLink } : {}),
    }
  } catch (error: any) {
    console.error('Erro ao solicitar primeiro acesso:', error)
    
    if (error instanceof z.ZodError) {
      throw new Error('Email inválido')
    }
    
    throw new Error(error.message || 'Erro ao processar solicitação de primeiro acesso')
  }
}

/**
 * Verifica se email está cadastrado (para validação em tempo real)
 */
export async function verificarEmailCadastrado(email: string) {
  try {
    const emailValidado = emailSchema.parse(email.trim().toLowerCase())
    const supabase = await createClient()

    const { data: responsavel } = await supabase
      .from('usuarios')
      .select('id, ativo')
      .or(`email_financeiro.eq.${emailValidado},email_pedagogico.eq.${emailValidado}`)
      .maybeSingle()

    return {
      existe: !!responsavel,
      ativo: responsavel?.ativo ?? false,
    }
  } catch {
    return {
      existe: false,
      ativo: false,
    }
  }
}
