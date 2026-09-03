"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { submitAuth } from "@/lib/auth/submit.client";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { EMAIL_SHAPE } from "@/lib/auth/form-rules";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  LogOut,
} from "lucide-react";

export interface V2LoginCardProps {
  locale?: Locale;
  inModal?: boolean;
  onAuthenticated?: () => void;
  onSwitchToRegister?: () => void;
}

export function V2LoginCard({
  locale: _locale = "tr",
  inModal = false,
  onAuthenticated,
  onSwitchToRegister,
}: V2LoginCardProps) {
  const router = useRouter();
  const [sessionState, setSessionState] = useAuthSession();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const isAlreadyLoggedIn = sessionState === "authenticated";

  const handleLogout = async () => {
    setLoading(true);
    await submitAuth("logout", {});
    setSessionState("anonymous");
    setLoading(false);
    setSuccessMsg("Başarıyla çıkış yapıldı.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg("Lütfen e-posta adresini gir.");
      return;
    }
    if (!EMAIL_SHAPE.test(cleanEmail)) {
      setErrorMsg("Lütfen geçerli bir e-posta adresi yaz (örn: isim@domain.com).");
      return;
    }
    if (!password) {
      setErrorMsg("Lütfen şifreni gir.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitAuth(
        "login",
        { email: cleanEmail, password },
        inModal ? {} : { returnTo: "/v2" },
      );

      if (result.ok) {
        setSessionState("authenticated");
        setSuccessMsg("Giriş başarılı! Yönlendiriliyorsun...");
        if (onAuthenticated) {
          onAuthenticated();
        } else if (result.redirectTo) {
          router.replace(result.redirectTo);
        } else {
          router.replace("/v2");
        }
      } else {
        if (result.code === "errors.auth.invalidCredentials") {
          setErrorMsg("E-posta adresi veya şifre hatalı. Lütfen kontrol et.");
        } else if (result.code === "errors.auth.emailNotVerified") {
          setErrorMsg("E-posta adresin henüz doğrulanmamış. Lütfen e-postanı kontrol et.");
        } else if (
          result.code === "errors.auth.rateLimited" ||
          result.code === "errors.auth.tooManyAttempts"
        ) {
          setErrorMsg(
            "Çok fazla başarısız deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.",
          );
        } else {
          setErrorMsg("Giriş yapılırken bir sorun oluştu. Lütfen tekrar dene.");
        }
      }
    } catch {
      setErrorMsg("Sunucuya bağlanılamadı. Lütfen internet bağlantını kontrol et.");
    } finally {
      setLoading(false);
    }
  };

  if (isAlreadyLoggedIn) {
    return (
      <div className="space-y-6 text-center py-4">
        <div className="size-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
          <ShieldCheck className="size-8" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-heading text-xl font-bold text-foreground">Oturumunuz Açık</h3>
          <p className="text-xs text-muted-foreground">
            Şu anda Coğrafya Platformu v2 hesabınızla aktif olarak giriş yapmış durumdasınız.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/v2" className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              className="w-full sm:w-auto shadow-xs"
              rightIcon={<ArrowRight className="size-4" />}
            >
              Atlasa Devam Et
            </Button>
          </Link>
          <Button
            variant="outline"
            size="md"
            onClick={handleLogout}
            isLoading={loading}
            leftIcon={<LogOut className="size-4" />}
            className="w-full sm:w-auto"
          >
            Çıkış Yap
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header Info if not in modal */}
      {!inModal && (
        <div className="space-y-1 pb-2 border-b border-border/80">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<LogIn className="size-3.5" />}>
              Giriş Portalı v2
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              Kişiselleştirilmiş Atlas
            </span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-[var(--color-primary-dark,#7e3a1e)] tracking-tight">
            Hesabınıza Giriş Yapın
          </h2>
          <p className="text-xs text-muted-foreground">
            Favorilerinize, sınav geçmişinize ve kayıtlı CBS ölçümlerinize erişin.
          </p>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div
          id="v2-login-error"
          role="alert"
          aria-live="polite"
          className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-xs text-destructive animate-in fade-in-50 duration-200"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in-50 duration-200">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{successMsg}</span>
        </div>
      )}

      {/* Email Field */}
      <div className="space-y-1.5">
        <Label htmlFor="v2-login-email" className="text-xs font-bold text-foreground">
          E-posta Adresi
        </Label>
        <Input
          id="v2-login-email"
          type="email"
          autoComplete="email"
          placeholder="ornek@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="size-4 text-muted-foreground" />}
          className="h-11 text-xs"
          disabled={loading}
          aria-invalid={Boolean(errorMsg)}
          aria-describedby={errorMsg ? "v2-login-error" : undefined}
        />
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="v2-login-password" className="text-xs font-bold text-foreground">
            Şifre
          </Label>
          <button
            type="button"
            className="text-[11px] font-semibold text-primary hover:underline transition-colors"
            onClick={() => alert("Şifre sıfırlama bağlantısı e-posta adresinize gönderilecektir.")}
          >
            Şifremi Unuttum?
          </button>
        </div>
        <div className="relative">
          <Input
            id="v2-login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="size-4 text-muted-foreground" />}
            className="h-11 pr-10 text-xs"
            disabled={loading}
            aria-invalid={Boolean(errorMsg)}
            aria-describedby={errorMsg ? "v2-login-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={loading}
        leftIcon={<LogIn className="size-4" />}
        className="w-full h-11 rounded-xl shadow-md font-bold text-sm mt-2"
      >
        Giriş Yap
      </Button>

      {/* Switch to Register footer */}
      <div className="text-center pt-2 border-t border-border/80">
        <p className="text-xs text-muted-foreground">
          Henüz hesabınız yok mu?{" "}
          {onSwitchToRegister ? (
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-bold text-primary hover:underline ml-1"
            >
              Ücretsiz Üye Olun
            </button>
          ) : (
            <Link href="/v2/kayit" className="font-bold text-primary hover:underline ml-1">
              Ücretsiz Üye Olun
            </Link>
          )}
        </p>
      </div>
    </form>
  );
}
