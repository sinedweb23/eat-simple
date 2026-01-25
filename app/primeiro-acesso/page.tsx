'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { solicitarPrimeiroAcesso } from '@/app/actions/responsavel-auth'
import Link from 'next/link'

export default function PrimeiroAcessoPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  async function handleSolicitar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!email || !email.trim()) {
      setError('Por favor, informe o email')
      setLoading(false)
      return
    }

    try {
      const resultado = await solicitarPrimeiroAcesso(email)
      
      // Em desenvolvimento, mostrar o link de debug se disponível
      if (resultado.debugLink) {
        console.log('🔗 Link de recuperação (desenvolvimento):', resultado.debugLink)
        setSuccess(
          `${resultado.message}\n\n🔗 Link de desenvolvimento (copie e cole no navegador):\n${resultado.debugLink}`
        )
      } else {
        setSuccess(resultado.message)
      }
      
      setEmail('') // Limpar campo após sucesso
    } catch (err) {
      console.error('Erro ao solicitar primeiro acesso:', err)
      setError(err instanceof Error ? err.message : 'Erro ao processar solicitação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Primeiro Acesso</CardTitle>
          <CardDescription>
            Solicite o envio de email para criar sua senha de acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSolicitar} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={loading}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Informe o email cadastrado na escola
              </p>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 rounded-md text-sm whitespace-pre-line break-words">
                {success}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Email de Confirmação'}
            </Button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-muted-foreground hover:underline">
                ← Voltar para o login
              </Link>
            </div>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-md">
            <h4 className="font-semibold text-sm mb-2">Como funciona:</h4>
            <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
              <li>Informe o email cadastrado na escola</li>
              <li>Verificamos se o email está ativo no sistema</li>
              <li>Você receberá um email com link para criar sua senha</li>
              <li>Clique no link e defina sua senha</li>
              <li>Faça login com seu email e senha</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
