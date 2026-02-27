"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Shield, Eye, EyeOff, AlertCircle, LogIn, ArrowRight } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [showSenha, setShowSenha] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedEmail = localStorage.getItem("auth_remember_email")
    if (savedEmail) {
        setEmail(savedEmail)
        setRememberMe(true)
    }
  }, [])

  const handleLogin = async () => {
    if (loading) return
    
    setError("")
    if (!email.trim() || !senha.trim()) {
      setError("Preencha todos os campos")
      return
    }
    setLoading(true)
    try {
      const result = await login(email, senha)
      if (!result.success) {
        setError(result.error || "Erro ao fazer login")
      } else {
        // Sucesso no login - Salvar preferência
        if (rememberMe) {
            localStorage.setItem("auth_remember_email", email)
        } else {
            localStorage.removeItem("auth_remember_email")
        }
      }
    } catch {
      setError("Erro de conexao com o servidor")
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="flex min-h-screen w-full">
      {/* Lado Esquerdo - Formulário */}
      <div className="flex w-full flex-col justify-center bg-background px-4 py-12 sm:px-6 lg:w-1/2 lg:px-20 xl:px-24 relative overflow-hidden">
        
        {/* Elementos decorativos de fundo sutis */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-600 to-indigo-600" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />

        <div className="mx-auto w-full max-w-sm lg:w-96 relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-xl shadow-indigo-500/20">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              SIS <span className="text-violet-600">-</span> PATRIMÔNIO
            </h2>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              Faça login para acessar o sistema
            </p>
          </div>

          <Card className="border-0 shadow-2xl shadow-indigo-500/10 overflow-hidden bg-card/50 backdrop-blur-sm">
            {/* Header Colorido do Card */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 flex items-center justify-center gap-2">
                <LogIn className="h-5 w-5 text-white/90" />
                <h3 className="text-white font-semibold tracking-wide">Login de Acesso</h3>
            </div>

            <CardContent className="pt-8 pb-8 px-8">
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="flex flex-col gap-5">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 border border-red-500/20">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider ml-1">Usuário / Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Digite seu usuário"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="bg-muted/50 border-muted-foreground/20 focus:bg-background h-11 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="senha" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider ml-1">Senha</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showSenha ? "text" : "password"}
                      placeholder="Sua senha"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="pr-10 bg-muted/50 border-muted-foreground/20 focus:bg-background h-11 transition-all"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-violet-600 transition-colors"
                    >
                      {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">
                        {showSenha ? "Ocultar senha" : "Mostrar senha"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mt-1">
                    <Checkbox 
                        id="remember" 
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <label
                        htmlFor="remember"
                        className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground cursor-pointer select-none"
                    >
                        Lembrar meu usuário
                    </label>
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2 mt-2 h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02]"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                        Entrar
                        <ArrowRight className="h-4 w-4 opacity-70" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <p className="mt-8 text-center text-xs text-muted-foreground/60">
            Prefeitura Municipal &copy; {new Date().getFullYear()} - Todos os direitos reservados
          </p>
        </div>
      </div>

      {/* Lado Direito - Imagem */}
      <div className="hidden lg:block relative w-1/2 bg-muted">
        <div className="absolute inset-0 bg-indigo-900/20 z-10 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10" />
        
        {/* Imagem de Fundo Animada (Zoom lento) */}
        <div className="absolute inset-0 overflow-hidden">
            <img
            src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2070&auto=format&fit=crop"
            alt="Gestão Patrimonial"
            className="h-full w-full object-cover animate-slow-zoom"
            style={{
                animation: "kenburns 20s infinite alternate"
            }}
            />
        </div>

        {/* Texto sobre a imagem */}
        <div className="relative z-20 flex h-full flex-col justify-end p-12 text-white">
          <div className="max-w-md">
            <div className="mb-4 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm font-medium backdrop-blur-md">
              <span className="mr-2 h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
              Sistema Online
            </div>
            <h3 className="mb-2 text-3xl font-bold leading-tight">
              Gestão Eficiente do Patrimônio Público
            </h3>
            <p className="text-lg text-white/80">
              Controle total de bens, frota e almoxarifado com tecnologia e transparência.
            </p>
          </div>
        </div>
      </div>

      {/* Style para animação Ken Burns (Zoom) */}
      <style jsx global>{`
        @keyframes kenburns {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
