'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { obterConfiguracaoSMTP, atualizarConfiguracaoSMTP } from '@/app/actions/configuracoes'
import { obterConfiguracaoAparencia, atualizarConfiguracaoAparencia } from '@/app/actions/configuracoes'

export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('aparencia')
  
  // Configurações de aparência
  const [aparenciaConfig, setAparenciaConfig] = useState({
    loja_nome: '',
    loja_logo_url: '',
    loja_favicon_url: '',
  })

  // Configurações SMTP
  const [smtpConfig, setSmtpConfig] = useState({
    smtp_enabled: false,
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_sender_email: '',
    smtp_sender_name: '',
  })

  useEffect(() => {
    carregarConfiguracoes()
  }, [])

  async function carregarConfiguracoes() {
    try {
      setLoading(true)
      setError(null)
      
      const [aparencia, smtp] = await Promise.all([
        obterConfiguracaoAparencia(),
        obterConfiguracaoSMTP(),
      ])

      setAparenciaConfig({
        loja_nome: aparencia.loja_nome || '',
        loja_logo_url: aparencia.loja_logo_url || '',
        loja_favicon_url: aparencia.loja_favicon_url || '',
      })

      setSmtpConfig({
        smtp_enabled: smtp.enabled ?? false,
        smtp_host: smtp.host || '',
        smtp_port: smtp.port?.toString() || '587',
        smtp_user: smtp.user || '',
        smtp_password: smtp.password || '',
        smtp_sender_email: smtp.sender_email || '',
        smtp_sender_name: smtp.sender_name || '',
      })
    } catch (err) {
      console.error('Erro ao carregar configurações:', err)
      setError('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  async function handleSalvarAparencia(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await atualizarConfiguracaoAparencia(aparenciaConfig)
      setSuccess('Configurações de aparência salvas com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Erro ao salvar configurações de aparência:', err)
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  async function handleSalvarSMTP(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await atualizarConfiguracaoSMTP(smtpConfig)
      setSuccess('Configurações SMTP salvas com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Erro ao salvar configurações SMTP:', err)
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Carregando configurações...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Configurações do Sistema</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações gerais da loja, aparência e email
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 rounded-md text-sm">
          {success}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="aparencia">Aparência</TabsTrigger>
          <TabsTrigger value="email">Email (SMTP)</TabsTrigger>
        </TabsList>

        {/* Aba de Aparência */}
        <TabsContent value="aparencia">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Aparência</CardTitle>
              <CardDescription>
                Personalize a aparência da loja: nome, logo e favicon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSalvarAparencia} className="space-y-6">
                {/* Nome da Loja */}
                <div>
                  <Label htmlFor="loja_nome">Nome da Loja *</Label>
                  <Input
                    id="loja_nome"
                    type="text"
                    value={aparenciaConfig.loja_nome}
                    onChange={(e) => setAparenciaConfig({ ...aparenciaConfig, loja_nome: e.target.value })}
                    placeholder="Ex: Loja da Escola"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Nome que aparece no header da loja e nos emails
                  </p>
                </div>

                {/* Logo */}
                <div>
                  <Label htmlFor="loja_logo_url">URL do Logo</Label>
                  <Input
                    id="loja_logo_url"
                    type="url"
                    value={aparenciaConfig.loja_logo_url}
                    onChange={(e) => setAparenciaConfig({ ...aparenciaConfig, loja_logo_url: e.target.value })}
                    placeholder="https://exemplo.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL completa da imagem do logo (recomendado: PNG transparente, 200x50px)
                  </p>
                  {aparenciaConfig.loja_logo_url && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                      <img 
                        src={aparenciaConfig.loja_logo_url} 
                        alt="Logo preview" 
                        className="max-h-16 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Favicon */}
                <div>
                  <Label htmlFor="loja_favicon_url">URL do Favicon</Label>
                  <Input
                    id="loja_favicon_url"
                    type="url"
                    value={aparenciaConfig.loja_favicon_url}
                    onChange={(e) => setAparenciaConfig({ ...aparenciaConfig, loja_favicon_url: e.target.value })}
                    placeholder="https://exemplo.com/favicon.ico"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL completa do favicon (recomendado: ICO ou PNG, 32x32px)
                  </p>
                  {aparenciaConfig.loja_favicon_url && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                      <img 
                        src={aparenciaConfig.loja_favicon_url} 
                        alt="Favicon preview" 
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 rounded-md text-sm">
                  <p className="font-semibold mb-1">💡 Dica:</p>
                  <p>
                    Para fazer upload de imagens, você pode usar o Supabase Storage ou qualquer serviço de hospedagem de imagens.
                    Depois, cole a URL completa aqui.
                  </p>
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Configurações de Aparência'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Email */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Email (SMTP)</CardTitle>
              <CardDescription>
                Configure as credenciais SMTP para envio de emails do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSalvarSMTP} className="space-y-6">
                {/* Habilitar SMTP */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="smtp_enabled"
                    checked={smtpConfig.smtp_enabled}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="smtp_enabled" className="cursor-pointer">
                    Habilitar SMTP customizado
                  </Label>
                </div>

                {smtpConfig.smtp_enabled && (
                  <>
                    {/* Host SMTP */}
                    <div>
                      <Label htmlFor="smtp_host">Servidor SMTP *</Label>
                      <Input
                        id="smtp_host"
                        type="text"
                        value={smtpConfig.smtp_host}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                        placeholder="smtp.gmail.com"
                        required
                      />
                    </div>

                    {/* Porta */}
                    <div>
                      <Label htmlFor="smtp_port">Porta SMTP *</Label>
                      <Input
                        id="smtp_port"
                        type="text"
                        value={smtpConfig.smtp_port}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: e.target.value })}
                        placeholder="587"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Geralmente 587 (TLS) ou 465 (SSL)
                      </p>
                    </div>

                    {/* Usuário/Email */}
                    <div>
                      <Label htmlFor="smtp_user">Email/Usuário SMTP *</Label>
                      <Input
                        id="smtp_user"
                        type="email"
                        value={smtpConfig.smtp_user}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                        placeholder="portalmsul@morumbisul.com.br"
                        required
                      />
                    </div>

                    {/* Senha */}
                    <div>
                      <Label htmlFor="smtp_password">Senha SMTP (App Password) *</Label>
                      <Input
                        id="smtp_password"
                        type="password"
                        value={smtpConfig.smtp_password}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_password: e.target.value })}
                        placeholder="ybvlkcrskgzgcqms"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use App Password do Gmail, não a senha normal
                      </p>
                    </div>

                    {/* Email Remetente */}
                    <div>
                      <Label htmlFor="smtp_sender_email">Email Remetente *</Label>
                      <Input
                        id="smtp_sender_email"
                        type="email"
                        value={smtpConfig.smtp_sender_email}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_sender_email: e.target.value })}
                        placeholder="portalmsul@morumbisul.com.br"
                        required
                      />
                    </div>

                    {/* Nome Remetente */}
                    <div>
                      <Label htmlFor="smtp_sender_name">Nome do Remetente *</Label>
                      <Input
                        id="smtp_sender_name"
                        type="text"
                        value={smtpConfig.smtp_sender_name}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_sender_name: e.target.value })}
                        placeholder="Portal Morumbi Sul"
                        required
                      />
                    </div>
                  </>
                )}

                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Configurações SMTP'}
                </Button>
              </form>

              <div className="mt-6 p-4 bg-muted rounded-md">
                <h4 className="font-semibold text-sm mb-2">⚠️ Importante</h4>
                <p className="text-xs text-muted-foreground">
                  Após salvar as configurações aqui, você precisa configurar manualmente no Supabase Dashboard:
                </p>
                <ol className="text-xs text-muted-foreground mt-2 list-decimal list-inside space-y-1">
                  <li>Acesse: <a href="https://supabase.com/dashboard/project/jznhaioobvjwjdmigxja/settings/auth" target="_blank" rel="noopener noreferrer" className="underline">Settings &gt; Auth &gt; SMTP Settings</a></li>
                  <li>Preencha os campos com as credenciais configuradas acima</li>
                  <li>Salve as configurações no Supabase</li>
                  <li>Os emails serão enviados automaticamente após a configuração</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
