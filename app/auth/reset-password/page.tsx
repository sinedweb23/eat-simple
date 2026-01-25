'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    // Verificar hash da URL primeiro (Supabase pode passar tokens via hash)
    const hash = window.location.hash
    if (hash) {
      console.log('🔍 Hash encontrado na URL, processando...')
      const hashParams = new URLSearchParams(hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const typeFromHash = hashParams.get('type')
      const hashToken = hashParams.get('token')
      
      if (accessToken && refreshToken) {
        console.log('✅ Tokens encontrados no hash, criando sessão...')
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ data: { session }, error: sessionError }) => {
          if (sessionError) {
            console.error('❌ Erro ao criar sessão a partir do hash:', sessionError)
            setError('Erro ao processar link de recuperação. Solicite um novo link.')
            return
          }
          
          if (session) {
            console.log('✅ Sessão criada a partir do hash')
            setToken('session_active')
            // Limpar hash da URL
            window.history.replaceState({}, '', window.location.pathname)
            return
          }
        })
        return
      }
      
      if (hashToken && typeFromHash === 'recovery') {
        console.log('🔑 Token encontrado no hash da URL')
        setToken(hashToken)
        // Limpar hash da URL
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
    }

    // Verificar se há sessão ativa (token já foi processado pelo Supabase)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (session) {
        // Se tem sessão, o token já foi processado pelo Supabase
        console.log('✅ Sessão encontrada, token já foi processado')
        setToken('session_active')
        return
      }

      // Se não tem sessão, verificar se há token na URL
      const tokenParam = searchParams.get('token')
      
      if (tokenParam) {
        console.log('🔑 Token encontrado na query string')
        setToken(tokenParam)
      } else {
        console.log('⚠️ Nenhum token encontrado e nenhuma sessão ativa')
        setError('Token inválido ou expirado. Solicite um novo link em "Primeiro Acesso".')
      }
    })
  }, [searchParams, supabase])

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!password || password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      setLoading(false)
      return
    }

    try {
      // Verificar se há sessão ativa primeiro (token já foi processado pelo Supabase)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // Se já tem sessão (token foi processado pelo Supabase), apenas atualizar senha
        console.log('✅ Sessão encontrada, atualizando senha...')
        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        })

        if (updateError) {
          console.error('❌ Erro ao atualizar senha:', updateError)
          throw updateError
        }

        console.log('✅ Senha atualizada com sucesso!')
        setSuccess(true)
        setTimeout(() => {
          router.push('/login?message=senha_criada')
        }, 2000)
        return
      }

      // Se não tem sessão, precisamos verificar o token primeiro
      if (!token || token === 'session_active') {
        throw new Error('Token inválido ou expirado. Solicite um novo link em "Primeiro Acesso".')
      }

      console.log('🔍 Verificando token de recuperação...')
      console.log('🔑 Token:', token.substring(0, 20) + '...')
      
      // O token precisa ser verificado via verifyOtp
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery',
      })

      if (verifyError) {
        console.error('❌ Erro ao verificar token:', verifyError)
        
        // Se o erro for de token inválido/expirado, dar mensagem clara
        if (verifyError.message.includes('token') || verifyError.message.includes('expired') || verifyError.message.includes('invalid') || verifyError.message.includes('has already been used')) {
          throw new Error('Token inválido ou expirado. Solicite um novo link em "Primeiro Acesso".')
        }
        
        throw verifyError
      }

      console.log('✅ Token verificado com sucesso')

      // Após verificar, atualizar senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        console.error('❌ Erro ao atualizar senha:', updateError)
        throw updateError
      }

      console.log('✅ Senha atualizada com sucesso!')

      setSuccess(true)
      setTimeout(() => {
        router.push('/login?message=senha_criada')
      }, 2000)
    } catch (err: any) {
      console.error('Erro ao resetar senha:', err)
      setError(err.message || 'Erro ao definir senha. O token pode ter expirado.')
    } finally {
      setLoading(false)
    }
  }

  // Se não tem token e não tem erro ainda, mostrar loading
  if (!token && !error) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Verificando...</CardTitle>
            <CardDescription>
              Aguarde enquanto verificamos seu link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Se tem erro e não tem token válido, mostrar erro
  if (error && (!token || token === 'session_active')) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Token Inválido</CardTitle>
            <CardDescription>
              {error || 'O link de recuperação é inválido ou expirou.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/primeiro-acesso">
              <Button className="w-full">Solicitar Novo Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Senha Criada com Sucesso!</CardTitle>
            <CardDescription>
              Redirecionando para o login...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-green-600">
              ✅ Sua senha foi criada com sucesso!
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Criar Senha</CardTitle>
          <CardDescription>
            Defina sua senha de acesso ao portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <Label htmlFor="password">Nova Senha *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                disabled={loading}
                minLength={6}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A senha deve ter pelo menos 6 caracteres
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a senha novamente"
                required
                disabled={loading}
                minLength={6}
                className="w-full"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando senha...' : 'Criar Senha'}
            </Button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-muted-foreground hover:underline">
                ← Voltar para o login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
