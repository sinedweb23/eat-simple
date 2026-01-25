'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { obterMeuPerfil } from '@/app/actions/responsavel'
import { LojaHeader } from '@/components/loja/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PerfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [usuario, setUsuario] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      carregarPerfil()
    } catch (err) {
      console.error('Erro ao verificar autenticação:', err)
      router.push('/login')
    }
  }

  async function carregarPerfil() {
    try {
      setLoading(true)
      setError(null)
      const dados = await obterMeuPerfil()
      setUsuario(dados)
    } catch (err) {
      console.error('Erro ao carregar perfil:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }

  function formatCPF(cpf: string | null) {
    if (!cpf) return 'Não informado'
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  function formatPhone(phone: string | null) {
    if (!phone) return 'Não informado'
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  if (loading) {
    return (
      <>
        <LojaHeader />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Carregando perfil...</p>
          </div>
        </div>
      </>
    )
  }

  if (error || !usuario) {
    return (
      <>
        <LojaHeader />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-destructive">{error || 'Erro ao carregar perfil'}</p>
              <Button onClick={carregarPerfil} className="mt-4">Tentar Novamente</Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <LojaHeader />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Meu Perfil</h1>
          <p className="text-muted-foreground">
            Seus dados pessoais e informações dos seus filhos
          </p>
        </div>

        <div className="grid gap-6">
          {/* Dados Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Pessoais</CardTitle>
              <CardDescription>Suas informações de contato</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome</label>
                  <p className="text-base font-semibold">
                    {usuario.nome || usuario.nome_financeiro || usuario.nome_pedagogico || 'Não informado'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tipo de Responsável</label>
                  <p className="text-base font-semibold">
                    {usuario.tipo === 'FINANCEIRO' && '💰 Financeiro'}
                    {usuario.tipo === 'PEDAGOGICO' && '📚 Pedagógico'}
                    {usuario.tipo === 'AMBOS' && '💰📚 Ambos'}
                  </p>
                </div>
              </div>

              {(usuario.tipo === 'FINANCEIRO' || usuario.tipo === 'AMBOS') && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">Responsável Financeiro</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Nome</label>
                      <p className="text-base">{usuario.nome_financeiro || 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">CPF</label>
                      <p className="text-base">{formatCPF(usuario.cpf_financeiro)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="text-base">{usuario.email_financeiro || 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Celular</label>
                      <p className="text-base">{formatPhone(usuario.celular_financeiro)}</p>
                    </div>
                  </div>
                </div>
              )}

              {(usuario.tipo === 'PEDAGOGICO' || usuario.tipo === 'AMBOS') && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">Responsável Pedagógico</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Nome</label>
                      <p className="text-base">{usuario.nome_pedagogico || 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">CPF</label>
                      <p className="text-base">{formatCPF(usuario.cpf_pedagogico)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="text-base">{usuario.email_pedagogico || 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Celular</label>
                      <p className="text-base">{formatPhone(usuario.celular_pedagogico)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filhos (Alunos) */}
          <Card>
            <CardHeader>
              <CardTitle>Meus Filhos</CardTitle>
              <CardDescription>
                {usuario.alunos?.length || 0} {usuario.alunos?.length === 1 ? 'filho vinculado' : 'filhos vinculados'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usuario.alunos && usuario.alunos.length > 0 ? (
                <div className="space-y-4">
                  {usuario.alunos.map((aluno: any) => (
                    <div
                      key={aluno.id}
                      className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{aluno.nome}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Prontuário:</span> {aluno.prontuario}
                            </div>
                            {aluno.turmas && (
                              <div>
                                <span className="font-medium">Turma:</span> {aluno.turmas.descricao}
                              </div>
                            )}
                            {aluno.turmas?.segmento && (
                              <div>
                                <span className="font-medium">Segmento:</span>{' '}
                                {aluno.turmas.segmento === 'EDUCACAO_INFANTIL' && 'Educação Infantil'}
                                {aluno.turmas.segmento === 'FUNDAMENTAL' && 'Fundamental'}
                                {aluno.turmas.segmento === 'MEDIO' && 'Médio'}
                                {aluno.turmas.segmento === 'OUTRO' && 'Outro'}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Situação:</span>{' '}
                              <span className={`px-2 py-1 rounded text-xs ${
                                aluno.situacao === 'ATIVO'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {aluno.situacao}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum filho vinculado ao seu perfil.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
