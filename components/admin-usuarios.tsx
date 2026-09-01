"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Users, Plus, Search, Shield, Eye, UserCog, Building2, Mail, Calendar,
  CheckCircle2, XCircle, Edit, Briefcase, Loader2, Trash2, Pencil,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { roleLabels, roleColors, roleDescriptions, type UserRole } from "@/lib/auth"
import { formatDate } from "@/lib/data"
import { fetcher, api } from "@/lib/api-client"

export function AdminUsuarios() {
  const { user: currentUser } = useAuth()
  const { data: usersData, mutate } = useSWR("/usuarios", fetcher)
  const users = Array.isArray(usersData) ? usersData : (usersData?.data || [])
  const { data: secretariasData } = useSWR("/secretarias?all=true", fetcher)
  const secretariasList = Array.isArray(secretariasData) ? secretariasData : (secretariasData?.data || [])

  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("todos")
  const [statusFilter, setStatusFilter] = useState<string>("todos")
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [newNome, setNewNome] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newSenha, setNewSenha] = useState("")
  const [newCargo, setNewCargo] = useState("")
  const [newUserRole, setNewUserRole] = useState<UserRole | "">("")
  const [newUserSecretaria, setNewUserSecretaria] = useState("")
  const [newUserDepartamentos, setNewUserDepartamentos] = useState<string[]>([])
  const [newUserSecretariasGerenciadas, setNewUserSecretariasGerenciadas] = useState<string[]>([])
  const [newAcessoApp, setNewAcessoApp] = useState(false)
  const [newPodeCadastrarBem, setNewPodeCadastrarBem] = useState(false)
  const [newPodeCadastroProvisorioUnidade, setNewPodeCadastroProvisorioUnidade] = useState(false)

  const filtered = users.filter((u: any) => {
    const matchSearch = search === "" || u.nome?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.cargo?.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === "todos" || u.role === roleFilter
    const matchStatus = statusFilter === "todos" || (statusFilter === "ativo" && u.ativo) || (statusFilter === "inativo" && !u.ativo)
    return matchSearch && matchRole && matchStatus
  })

  const selectedSecretaria = secretariasList.find((s: any) => s.nome === newUserSecretaria)

  const stats = useMemo(() => ({
    total: users.length,
    ativos: users.filter((u: any) => u.ativo).length,
    admins: users.filter((u: any) => u.role === "administrador").length,
    gestores: users.filter((u: any) => u.role === "gestor").length,
    assistentes: users.filter((u: any) => u.role === "assistente").length,
  }), [users])

  const resetForm = () => {
    setNewNome("")
    setNewEmail("")
    setNewSenha("")
    setNewCargo("")
    setNewUserRole("")
    setNewUserSecretaria("")
    setNewUserDepartamentos([])
    setNewUserSecretariasGerenciadas([])
    setNewAcessoApp(false)
    setNewPodeCadastrarBem(false)
    setNewPodeCadastroProvisorioUnidade(false)
    setEditingId(null)
  }

  const handleCreateUser = () => {
    resetForm()
    setShowUserForm(true)
  }

  const handleEditUser = (user: any) => {
    setEditingId(user.id)
    setNewNome(user.nome)
    setNewEmail(user.email)
    setNewSenha("") // Don't fill password
    setNewCargo(user.cargo)
    setNewUserRole(user.role as UserRole)
    if (user.unidade) {
      setNewUserSecretaria(user.unidade.secretaria)
      setNewUserDepartamentos(user.unidade.departamentos || (user.unidade.departamento ? [user.unidade.departamento] : []))
    } else {
      setNewUserSecretaria("")
      setNewUserDepartamentos([])
    }
    if (user.secretariasGerenciadas) {
      setNewUserSecretariasGerenciadas(user.secretariasGerenciadas)
    } else {
      setNewUserSecretariasGerenciadas([])
    }
    setNewAcessoApp(user.acessoApp || false)
    setNewPodeCadastrarBem(Boolean(user.podeCadastrarBem))
    setNewPodeCadastroProvisorioUnidade(Boolean(user.podeCadastroProvisorioUnidade))
    setShowUserForm(true)
  }

  const handleDeleteUser = async (user: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuario ${user.nome}? Esta ação não pode ser desfeita.`)) return
    try {
      await api.deleteUsuario(user.id)
      await mutate()
    } catch (e) {
      console.error(e)
      alert("Erro ao excluir usuario")
    }
  }

  const handleSaveUser = async () => {
    if (!newNome || !newEmail || !newCargo || !newUserRole) return
    if (!editingId && !newSenha) return // Password required for new users

    setSaving(true)
    try {
      const userData = {
        nome: newNome, email: newEmail, cargo: newCargo, role: newUserRole,
        secretaria: newUserSecretaria || undefined,
        departamentosAssistente: newUserDepartamentos,
        secretariasGerenciadas: newUserSecretariasGerenciadas,
        acessoApp: newAcessoApp,
        podeCadastrarBem: newUserRole === "assistente" ? newPodeCadastrarBem : null,
        podeCadastroProvisorioUnidade: newUserRole === "assistente" ? newPodeCadastroProvisorioUnidade : null,
        senha: newSenha || undefined // Only send if provided
      }

      if (editingId) {
        await api.updateUsuario(editingId, userData)
      } else {
        await api.createUsuario({ ...userData, senha: newSenha })
      }
      
      await mutate()
      setShowUserForm(false)
      resetForm()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleToggleStatus = async (u: any) => {
    try {
      await api.patchUsuario(u.id, { ativo: !u.ativo })
      await mutate()
      if (selectedUser?.id === u.id) {
        setSelectedUser({ ...selectedUser, ativo: !u.ativo })
      }
    } catch (e) { console.error(e) }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Gerenciamento de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastre e gerencie os usuarios do sistema</p>
        </div>
        <Dialog open={showUserForm} onOpenChange={(open) => { setShowUserForm(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild><Button className="gap-2" onClick={handleCreateUser}><Plus className="h-4 w-4" />Novo Usuario</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Usuario" : "Cadastrar Novo Usuario"}</DialogTitle>
              <DialogDescription>{editingId ? "Edite os dados do usuário abaixo." : "Preencha os dados abaixo para cadastrar um novo usuário no sistema."}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2"><Label required>Nome Completo</Label><Input placeholder="Ex: Maria Silva" value={newNome} onChange={(e) => setNewNome(e.target.value)} /></div>
                <div className="flex flex-col gap-2"><Label required>Cargo</Label><Input placeholder="Ex: Coordenador" value={newCargo} onChange={(e) => setNewCargo(e.target.value)} /></div>
              </div>
              <div className="flex flex-col gap-2"><Label required>Email</Label><Input type="email" placeholder="email@prefeitura.gov.br" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
              <div className="flex flex-col gap-2">
                <Label required={!editingId}>Senha {editingId && "(deixe em branco para manter)"}</Label>
                <Input type="text" placeholder={editingId ? "Nova senha (opcional)" : "Senha temporaria"} value={newSenha} onChange={(e) => setNewSenha(e.target.value)} />
              </div>
              <div className="flex items-center space-x-2 py-2">
                <Checkbox 
                  id="acessoApp" 
                  checked={newAcessoApp} 
                  onCheckedChange={(checked) => setNewAcessoApp(!!checked)} 
                />
                <Label htmlFor="acessoApp">Permitir acesso ao aplicativo móvel</Label>
              </div>
              {newUserRole === "assistente" && (
                <div className="flex items-center space-x-2 py-2">
                  <Checkbox
                    id="podeCadastrarBem"
                    checked={newPodeCadastrarBem}
                    onCheckedChange={(checked) => setNewPodeCadastrarBem(!!checked)}
                  />
                  <Label htmlFor="podeCadastrarBem">Permitir cadastrar novos bens</Label>
                </div>
              )}
              {newUserRole === "assistente" && (
                <div className="flex items-center space-x-2 py-2">
                  <Checkbox
                    id="podeCadastroProvisorioUnidade"
                    checked={newPodeCadastroProvisorioUnidade}
                    onCheckedChange={(checked) => setNewPodeCadastroProvisorioUnidade(!!checked)}
                  />
                  <Label htmlFor="podeCadastroProvisorioUnidade">Permitir cadastro provisório da unidade</Label>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label required>Perfil de Acesso</Label>
                <div className="flex flex-col gap-2">
                  {(["administrador", "gestor", "assistente"] as UserRole[]).map((role) => (
                    <button key={role} type="button" onClick={() => setNewUserRole(role)} className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${newUserRole === role ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}>
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${newUserRole === role ? "bg-primary/10" : "bg-muted"}`}>
                        <Shield className={`h-4 w-4 ${newUserRole === role ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{roleLabels[role]}</p>
                          <Badge className={`text-[10px] ${roleColors[role]}`}>{role === "administrador" ? "Total" : role === "gestor" ? "Gestao" : "Unidade"}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{roleDescriptions[role]}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              {newUserRole === "gestor" && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-3"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Secretarias Gerenciadas</CardTitle></div><CardDescription className="text-xs">Selecione as secretarias que este gestor pode acessar</CardDescription></CardHeader>
                  <CardContent className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                    {secretariasList.map((s: any) => (
                      <div key={s.nome} className="flex items-center space-x-2 p-1 hover:bg-background/50 rounded">
                        <Checkbox id={`sec-${s.nome}`} 
                          checked={newUserSecretariasGerenciadas.includes(s.nome)}
                          onCheckedChange={(checked) => {
                            if (checked) setNewUserSecretariasGerenciadas([...newUserSecretariasGerenciadas, s.nome])
                            else setNewUserSecretariasGerenciadas(newUserSecretariasGerenciadas.filter(n => n !== s.nome))
                          }}
                        />
                        <Label htmlFor={`sec-${s.nome}`} className="text-sm font-normal cursor-pointer flex-1">{s.nome}</Label>
                      </div>
                    ))}
                    {secretariasList.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma secretaria cadastrada.</p>}
                  </CardContent>
                </Card>
              )}

              {newUserRole === "assistente" && (
                <Card className="border-accent/30 bg-accent/5">
                  <CardHeader className="pb-3"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-accent" /><CardTitle className="text-sm">Unidade Vinculada</CardTitle></div><CardDescription className="text-xs">O assistente tera acesso apenas a esta secretaria e aos departamentos marcados abaixo</CardDescription></CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2"><Label required>Secretaria</Label><Select value={newUserSecretaria} onValueChange={(v) => { setNewUserSecretaria(v); setNewUserDepartamentos([]); }}><SelectTrigger><SelectValue placeholder="Selecione a secretaria" /></SelectTrigger><SelectContent>{secretariasList.map((s: any) => (<SelectItem key={s.nome} value={s.nome}>{s.nome}</SelectItem>))}</SelectContent></Select></div>
                    <div className="flex flex-col gap-2">
                      <Label required>Departamentos Permitidos</Label>
                      <div className="rounded-lg border bg-background p-3 max-h-48 overflow-y-auto">
                        {selectedSecretaria?.departamentos?.length ? selectedSecretaria.departamentos.map((d: any) => (
                          <div key={d.nome} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded">
                            <Checkbox
                              id={`assist-dep-${d.nome}`}
                              checked={newUserDepartamentos.includes(d.nome)}
                              onCheckedChange={(checked) => {
                                if (checked) setNewUserDepartamentos([...newUserDepartamentos, d.nome])
                                else setNewUserDepartamentos(newUserDepartamentos.filter((name) => name !== d.nome))
                              }}
                            />
                            <Label htmlFor={`assist-dep-${d.nome}`} className="text-sm font-normal cursor-pointer flex-1">{d.nome}</Label>
                          </div>
                        )) : (
                          <p className="text-xs text-muted-foreground">{newUserSecretaria ? "Nenhum departamento encontrado nesta secretaria." : "Selecione uma secretaria primeiro."}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowUserForm(false); resetForm(); }}>Cancelar</Button>
                <Button onClick={handleSaveUser} disabled={saving || !newNome || !newEmail || (!editingId && !newSenha) || !newCargo || !newUserRole || (newUserRole === "assistente" && (!newUserSecretaria || newUserDepartamentos.length === 0))} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {editingId ? "Salvar Alteracoes" : "Cadastrar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Users className="h-5 w-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{stats.total}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10"><CheckCircle2 className="h-5 w-5 text-success" /></div><div><p className="text-xs text-muted-foreground">Ativos</p><p className="text-xl font-bold">{stats.ativos}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10"><Shield className="h-5 w-5 text-destructive" /></div><div><p className="text-xs text-muted-foreground">Admins</p><p className="text-xl font-bold">{stats.admins}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><UserCog className="h-5 w-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">Gestores</p><p className="text-xl font-bold">{stats.gestores}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10"><Briefcase className="h-5 w-5 text-accent" /></div><div><p className="text-xs text-muted-foreground">Assistentes</p><p className="text-xl font-bold">{stats.assistentes}</p></div></CardContent></Card>
      </div>

      <Card><CardContent className="p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-end"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar por nome, email ou cargo..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="flex flex-wrap gap-3"><Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger className="w-44"><SelectValue placeholder="Perfil" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os Perfis</SelectItem><SelectItem value="administrador">Administrador</SelectItem><SelectItem value="gestor">Gestor</SelectItem><SelectItem value="assistente">Assistente</SelectItem></SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="ativo">Ativos</SelectItem><SelectItem value="inativo">Inativos</SelectItem></SelectContent></Select></div></div></CardContent></Card>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Perfil</TableHead><TableHead className="hidden md:table-cell">Unidade/Area</TableHead><TableHead className="hidden lg:table-cell">Ultimo Acesso</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Acoes</TableHead></TableRow></TableHeader><TableBody>
        {filtered.map((u: any) => (
          <TableRow key={u.id} className={!u.ativo ? "opacity-60" : ""}>
            <TableCell><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{u.avatar}</div><div><p className="text-sm font-medium">{u.nome}</p><p className="text-xs text-muted-foreground">{u.email}</p></div></div></TableCell>
            <TableCell><Badge className={`text-xs ${roleColors[u.role as UserRole] || ""}`}>{roleLabels[u.role as UserRole] || u.role}</Badge></TableCell>
            <TableCell className="hidden md:table-cell">
              {u.role === "assistente" && u.unidade ? (<div className="flex flex-col"><span className="text-xs text-muted-foreground">{u.unidade.secretaria?.replace("Secretaria de ", "Sec. ")}</span><span className="text-xs font-medium">{u.unidade.departamentos?.length || (u.unidade.departamento ? 1 : 0)} departamento(s)</span></div>) : u.role === "gestor" ? (<span className="text-xs text-muted-foreground">{u.secretariasGerenciadas?.length || 0} secretarias</span>) : (<span className="text-xs text-muted-foreground">Acesso global</span>)}
            </TableCell>
            <TableCell className="hidden lg:table-cell"><span className="text-xs text-muted-foreground">{u.ultimoAcesso ? formatDate(u.ultimoAcesso) : "Nunca"}</span></TableCell>
            <TableCell>{u.ativo ? (<Badge variant="outline" className="text-xs border-success/50 text-success"><CheckCircle2 className="h-3 w-3 mr-1" />Ativo</Badge>) : (<Badge variant="outline" className="text-xs border-destructive/50 text-destructive"><XCircle className="h-3 w-3 mr-1" />Inativo</Badge>)}</TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditUser(u)} title="Editar"><Pencil className="h-4 w-4" /><span className="sr-only">Editar</span></Button>
                {u.id !== currentUser?.id && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteUser(u)} title="Excluir"><Trash2 className="h-4 w-4" /><span className="sr-only">Excluir</span></Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setSelectedUser(u)} title="Ver Detalhes"><Eye className="h-4 w-4" /><span className="sr-only">Ver detalhes</span></Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {filtered.length === 0 && (<TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum usuario encontrado.</TableCell></TableRow>)}
      </TableBody></Table></div></CardContent></Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle>Detalhes do Usuario</DialogTitle>
                <DialogDescription className="sr-only">Detalhes do usuário selecionado.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{selectedUser.avatar}</div>
                  <div><p className="text-lg font-semibold">{selectedUser.nome}</p><p className="text-sm text-muted-foreground">{selectedUser.cargo}</p><Badge className={`text-xs mt-1 ${roleColors[selectedUser.role as UserRole] || ""}`}>{roleLabels[selectedUser.role as UserRole] || selectedUser.role}</Badge></div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3"><Mail className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium">{selectedUser.email}</p></div></div>
                  <div className="flex items-start gap-3"><Shield className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Acesso ao App</p><p className="text-sm font-medium">{selectedUser.acessoApp ? "Sim" : "Não"}</p></div></div>
                  <div className="flex items-start gap-3"><Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Criado em</p><p className="text-sm font-medium">{formatDate(selectedUser.criadoEm)}</p></div></div>
                  {selectedUser.ultimoAcesso && (<div className="flex items-start gap-3"><Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Ultimo Acesso</p><p className="text-sm font-medium">{formatDate(selectedUser.ultimoAcesso)}</p></div></div>)}
                  {selectedUser.role === "assistente" && selectedUser.unidade && (<div className="flex items-start gap-3"><Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Unidade Vinculada</p><p className="text-sm font-medium">{selectedUser.unidade.secretaria}</p><div className="flex flex-wrap gap-1.5 mt-1">{(selectedUser.unidade.departamentos || (selectedUser.unidade.departamento ? [selectedUser.unidade.departamento] : [])).map((d: string) => (<Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>))}</div></div></div>)}
                  {selectedUser.role === "gestor" && selectedUser.secretariasGerenciadas && (<div className="flex items-start gap-3"><Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Secretarias Gerenciadas</p><div className="flex flex-wrap gap-1.5 mt-1">{selectedUser.secretariasGerenciadas.map((s: string) => (<Badge key={s} variant="secondary" className="text-[10px]">{s.replace("Secretaria de ", "")}</Badge>))}</div></div></div>)}
                </div>
                <div className="rounded-lg border border-border p-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resumo de Permissoes</p><p className="text-xs text-muted-foreground leading-relaxed">{roleDescriptions[selectedUser.role as UserRole] || ""}</p></div>
                <div className="flex justify-end gap-2">
                  {selectedUser.id !== currentUser?.id && (
                    <Button variant={selectedUser.ativo ? "destructive" : "default"} size="sm" className="gap-2" onClick={() => handleToggleStatus(selectedUser)}>
                      {selectedUser.ativo ? (<><XCircle className="h-4 w-4" />Desativar</>) : (<><CheckCircle2 className="h-4 w-4" />Ativar</>)}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => { setSelectedUser(null); handleEditUser(selectedUser); }}>
                    <Edit className="h-4 w-4" /> Editar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
