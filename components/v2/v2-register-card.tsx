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
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  MapPin,
  GraduationCap,
  Briefcase,
  BookOpen,
  Compass,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";

export interface V2RegisterCardProps {
  locale?: Locale;
  provinces?: Array<{ plateCode: string; nameTr: string }>;
  inModal?: boolean;
  onAuthenticated?: () => void;
  onSwitchToLogin?: () => void;
}

const USER_ROLES = [
  { id: "STUDENT", label: "Öğrenci (YKS / KPSS)", icon: <GraduationCap className="size-3.5" /> },
  { id: "TEACHER", label: "Öğretmen / Eğitmen", icon: <Briefcase className="size-3.5" /> },
  { id: "ACADEMIC", label: "Akademisyen / Araştırmacı", icon: <BookOpen className="size-3.5" /> },
  { id: "GENERAL", label: "Genel Coğrafya Meraklısı", icon: <Compass className="size-3.5" /> },
];

export function V2RegisterCard({
  locale = "tr",
  provinces = [],
  inModal = false,
  onAuthenticated,
  onSwitchToLogin,
}: V2RegisterCardProps) {
  const router = useRouter();
  const [, setSessionState] = useAuthSession();

  // Step 1: Registration Form, Step 2: Verification Code
  const [step, setStep] = React.useState<"form" | "verify">("form");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState("STUDENT");
  const [selectedPlate, setSelectedPlate] = React.useState("");
  const [verificationCode, setVerificationCode] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Password requirements calculation
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasLetter = /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(password);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setErrorMsg("Lütfen adınızı ve soyadınızı giriniz.");
      return;
    }
    if (!cleanEmail || !EMAIL_SHAPE.test(cleanEmail)) {
      setErrorMsg("Lütfen geçerli bir e-posta adresi yazınız.");
      return;
    }
    if (!hasMinLength || !hasNumber || !hasLetter) {
      setErrorMsg("Şifreniz en az 8 karakter, en az bir harf ve bir rakam içermelidir.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitAuth("register", {
        email: cleanEmail,
        password,
        firstName: cleanName.split(" ")[0] || cleanName,
        lastName: cleanName.split(" ").slice(1).join(" ") || "",
        userType: selectedRole,
        provincePlate: selectedPlate || undefined,
      });

      if (result.ok) {
        setStep("verify");
        setSuccessMsg("Kayıt oluşturuldu! E-posta adresinize gönderilen 6 haneli doğrulama kodunu giriniz.");
      } else {
        if (result.code === "errors.auth.rateLimited" || result.code === "errors.auth.tooManyAttempts") {
          setErrorMsg("Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyiniz.");
        } else if (result.code === "errors.transport.invalidRequest") {
          setErrorMsg("Kayıt bilgileri geçersiz veya bu e-posta adresi zaten kullanılıyor.");
        } else {
          setErrorMsg("Kayıt oluşturulurken bir sorun oluştu. Lütfen bilgilerinizi kontrol ediniz.");
        }
      }
    } catch {
      setErrorMsg("Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol ediniz.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanCode = verificationCode.trim();
    if (!cleanCode || cleanCode.length < 4) {
      setErrorMsg("Lütfen geçerli doğrulama kodunu giriniz.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitAuth("verify-email", {
        email: email.trim(),
        code: cleanCode,
      });

      if (result.ok) {
        setSessionState("authenticated");
        setSuccessMsg("Hesabınız başarıyla doğrulandı ve oturum açıldı! Hoş geldiniz.");
        if (onAuthenticated) {
          onAuthenticated();
        } else {
          router.replace("/v2");
        }
      } else {
        setErrorMsg("Doğrulama kodu hatalı veya süresi dolmuş. Lütfen tekrar kontrol ediniz.");
      }
    } catch {
      setErrorMsg("Doğrulama işlemi sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "verify") {
    return (
      <form onSubmit={handleVerifySubmit} className="space-y-5">
        <div className="space-y-1 pb-2 border-b border-border/80 text-center">
          <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary shadow-xs">
            <Mail className="size-6" />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground mt-2">
            E-posta Doğrulama Kodu
          </h2>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{email}</span> adresine bir aktivasyon kodu gönderdik.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="v2-verify-code" className="text-xs font-bold text-foreground">
            6 Haneli Doğrulama Kodu
          </Label>
          <Input
            id="v2-verify-code"
            type="text"
            maxLength={8}
            placeholder="Örn: 123456"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            className="h-11 rounded-xl bg-card border-border text-center font-mono text-base tracking-widest"
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={loading}
          className="w-full h-11 rounded-xl shadow-md font-bold text-sm"
        >
          Hesabı Doğrula ve Başla
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setStep("form")}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Bilgilerimi Değiştir
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleRegisterSubmit} className="space-y-4">
      {/* Header Info if not in modal */}
      {!inModal && (
        <div className="space-y-1 pb-2 border-b border-border/80">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<UserPlus className="size-3.5" />}>
              Kayıt Portalı v2
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">Hızlı &amp; Ücretsiz</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-[var(--color-primary-dark,#7e3a1e)] tracking-tight">
            Yeni Hesap Oluşturun
          </h2>
          <p className="text-xs text-muted-foreground">
            Tüm interaktif harita testleri, video çözümleri ve CBS araçlarına erişim sağlayın.
          </p>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-xs text-destructive animate-in fade-in-50 duration-200">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Full Name */}
      <div className="space-y-1.5">
        <Label htmlFor="v2-register-name" className="text-xs font-bold text-foreground">
          Adınız ve Soyadınız
        </Label>
        <Input
          id="v2-register-name"
          type="text"
          autoComplete="name"
          placeholder="Örn: Ahmet Yılmaz"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          leftIcon={<User className="size-4 text-muted-foreground" />}
          className="h-10 text-xs"
          disabled={loading}
        />
      </div>

      {/* Email Field */}
      <div className="space-y-1.5">
        <Label htmlFor="v2-register-email" className="text-xs font-bold text-foreground">
          E-posta Adresi
        </Label>
        <Input
          id="v2-register-email"
          type="email"
          autoComplete="email"
          placeholder="ornek@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="size-4 text-muted-foreground" />}
          className="h-10 text-xs"
          disabled={loading}
        />
      </div>

      {/* User Role Selector */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-foreground">Profil Türü / Hedefiniz</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {USER_ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRole(role.id)}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                selectedRole === role.id
                  ? "bg-primary/10 border-primary text-primary font-bold shadow-2xs"
                  : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {role.icon}
              <span className="truncate text-[11px]">{role.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Province Selector */}
      {provinces.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="v2-register-province" className="text-xs font-bold text-foreground">
            Bulunduğunuz İl (İsteğe Bağlı)
          </Label>
          <div className="relative">
            <select
              id="v2-register-province"
              value={selectedPlate}
              onChange={(e) => setSelectedPlate(e.target.value)}
              className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground appearance-none hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150"
            >
              <option value="">İl Seçiniz...</option>
              {provinces.map((p) => (
                <option key={p.plateCode} value={p.plateCode}>
                  {p.plateCode} - {p.nameTr}
                </option>
              ))}
            </select>
            <MapPin className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Password Field */}
      <div className="space-y-1.5">
        <Label htmlFor="v2-register-password" className="text-xs font-bold text-foreground">
          Güçlü Şifre Oluşturun
        </Label>
        <div className="relative">
          <Input
            id="v2-register-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="En az 8 karakter..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="size-4 text-muted-foreground" />}
            className="h-10 pr-10 text-xs"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        {/* Dynamic Password Strength Indicators */}
        <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
          <span className={`inline-flex items-center gap-1 ${hasMinLength ? "text-emerald-600 font-bold" : ""}`}>
            <Check className={`size-3 ${hasMinLength ? "opacity-100" : "opacity-30"}`} /> 8+ karakter
          </span>
          <span className={`inline-flex items-center gap-1 ${hasLetter ? "text-emerald-600 font-bold" : ""}`}>
            <Check className={`size-3 ${hasLetter ? "opacity-100" : "opacity-30"}`} /> Harf
          </span>
          <span className={`inline-flex items-center gap-1 ${hasNumber ? "text-emerald-600 font-bold" : ""}`}>
            <Check className={`size-3 ${hasNumber ? "opacity-100" : "opacity-30"}`} /> Rakam
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={loading}
        leftIcon={<UserPlus className="size-4" />}
        className="w-full h-11 rounded-xl shadow-md font-bold text-sm mt-3"
      >
        Ücretsiz Kayıt Ol
      </Button>

      {/* Switch to Login footer */}
      <div className="text-center pt-2 border-t border-border/80">
        <p className="text-xs text-muted-foreground">
          Zaten bir hesabınız var mı?{" "}
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-bold text-primary hover:underline ml-1"
            >
              Giriş Yapın
            </button>
          ) : (
            <Link href="/v2/giris" className="font-bold text-primary hover:underline ml-1">
              Giriş Yapın
            </Link>
          )}
        </p>
      </div>
    </form>
  );
}
