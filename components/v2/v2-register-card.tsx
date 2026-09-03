"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { submitAuth } from "@/lib/auth/submit.client";
import { useAuthSession } from "@/lib/auth/use-session.client";
import {
  EMAIL_SHAPE,
  canonicalizePhone,
  buildRegisterPayload,
  isPasswordPolicyCompliant,
  type RegisterFormState,
  type UserType,
} from "@/lib/auth/form-rules";
import { USER_TYPE_LABELS } from "@/lib/auth/profile-labels";
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
  MapPin,
  GraduationCap,
  Briefcase,
  BookOpen,
  Compass,
  Check,
  Phone,
} from "lucide-react";

export interface V2RegisterCardProps {
  locale?: Locale;
  provinces?: Array<{ plateCode: string; nameTr: string }>;
  inModal?: boolean;
  onAuthenticated?: () => void;
  onSwitchToLogin?: () => void;
}

const USER_ROLES: Array<{
  id: UserType;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: "secondary",
    label: USER_TYPE_LABELS.secondary.tr,
    icon: <GraduationCap className="size-3.5" />,
  },
  {
    id: "undergraduate",
    label: USER_TYPE_LABELS.undergraduate.tr,
    icon: <BookOpen className="size-3.5" />,
  },
  {
    id: "graduate",
    label: USER_TYPE_LABELS.graduate.tr,
    icon: <Compass className="size-3.5" />,
  },
  {
    id: "teacher",
    label: USER_TYPE_LABELS.teacher.tr,
    icon: <Briefcase className="size-3.5" />,
  },
];

type FieldKey =
  "firstName" | "lastName" | "phone" | "email" | "provincePlateCode" | "districtId" | "password";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="text-[11px] text-destructive font-medium animate-in fade-in-50 duration-150"
    >
      {message}
    </p>
  );
}

export function V2RegisterCard({
  locale: _locale = "tr",
  provinces = [],
  inModal = false,
  onAuthenticated,
  onSwitchToLogin,
}: V2RegisterCardProps) {
  const router = useRouter();
  const [, setSessionState] = useAuthSession();

  // Step 1: Registration Form, Step 2: Verification Code
  const [step, setStep] = React.useState<"form" | "verify">("form");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState<UserType>("secondary");
  const [selectedPlate, setSelectedPlate] = React.useState("");
  const [districts, setDistricts] = React.useState<Array<{ id: string; nameTr: string }>>([]);
  const [selectedDistrictId, setSelectedDistrictId] = React.useState("");
  const [fetchedProvinces, setFetchedProvinces] = React.useState<
    Array<{ plateCode: string; nameTr: string }>
  >([]);

  const [verificationCode, setVerificationCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Fetch provinces if not passed as prop
  React.useEffect(() => {
    if (provinces.length === 0) {
      let active = true;
      fetch("/api/reference/provinces")
        .then((res) => res.json())
        .then((data) => {
          if (active && Array.isArray(data)) setFetchedProvinces(data);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [provinces.length]);

  const activeProvinces = provinces.length > 0 ? provinces : fetchedProvinces;

  // Load districts when province selection changes
  React.useEffect(() => {
    if (!selectedPlate) return;
    let active = true;
    fetch(`/api/reference/districts/${encodeURIComponent(selectedPlate)}`)
      .then((res) => res.json())
      .then((data) => {
        if (active && Array.isArray(data)) {
          setDistricts(data);
          if (data.length > 0) {
            setSelectedDistrictId(data[0].id);
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedPlate]);

  // Canonical password policy requirements (lib/auth/form-rules.ts PASSWORD_MIN = 6, ASCII letters)
  const hasMinLength = password.length >= 6;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});
    setSuccessMsg(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim();
    const errors: Partial<Record<FieldKey, string>> = {};

    if (!cleanFirst) {
      errors.firstName = "Lütfen adını gir.";
    }
    if (!cleanLast) {
      errors.lastName = "Lütfen soyadını gir.";
    }
    const cleanPhone = canonicalizePhone(phone);
    if (!cleanPhone) {
      errors.phone = "Lütfen geçerli bir cep telefonu numarası gir (örn: 05xx xxx xx xx).";
    }
    if (!cleanEmail || !EMAIL_SHAPE.test(cleanEmail)) {
      errors.email = "Lütfen geçerli bir e-posta adresi yaz.";
    }
    if (!selectedPlate) {
      errors.provincePlateCode = "Lütfen bulunduğun ili seç.";
    }
    if (!selectedDistrictId) {
      errors.districtId = "Lütfen ilçeni seç.";
    }

    // Canonical password policy validation
    if (!isPasswordPolicyCompliant(password)) {
      errors.password =
        "Şifren en az 6-128 karakter olmalı; en az bir büyük harf, bir küçük harf ve bir rakam içermelidir.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstErrorKey = Object.keys(errors)[0] as FieldKey;
      const el = document.getElementById(`v2-register-${firstErrorKey.toLowerCase()}`);
      if (el) el.focus();
      return;
    }

    setLoading(true);
    try {
      const formState: RegisterFormState = {
        firstName: cleanFirst,
        lastName: cleanLast,
        phone: cleanPhone!,
        email: cleanEmail,
        password,
        passwordConfirm: password,
        userType: selectedRole,
        provincePlateCode: selectedPlate,
        districtId: selectedDistrictId,
      };

      const payload = buildRegisterPayload(formState, _locale);
      const result = await submitAuth("register", payload);

      if (result.ok) {
        setStep("verify");
        setSuccessMsg(
          "Kayıt oluşturuldu! E-posta adresine gönderilen 6 haneli doğrulama kodunu gir.",
        );
      } else {
        if (
          result.code === "errors.auth.rateLimited" ||
          result.code === "errors.auth.tooManyAttempts"
        ) {
          setGeneralError("Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene.");
        } else if (result.code === "errors.transport.invalidRequest") {
          setGeneralError("Kayıt bilgileri geçersiz veya bu e-posta adresi zaten kullanılıyor.");
        } else {
          setGeneralError("Kayıt oluşturulurken bir sorun oluştu. Lütfen bilgilerini kontrol et.");
        }
      }
    } catch {
      setGeneralError("Sunucuya bağlanılamadı. Lütfen internet bağlantını kontrol et.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMsg(null);

    const cleanCode = verificationCode.trim();
    if (!cleanCode || cleanCode.length < 4) {
      setGeneralError("Lütfen geçerli bir doğrulama kodu giriniz.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitAuth(
        "verify-email",
        {
          email: email.trim(),
          code: cleanCode,
        },
        inModal ? {} : { returnTo: "/v2" },
      );

      if (result.ok) {
        setSuccessMsg("E-posta adresin doğrulandı! Oturum açılıyor...");
        setSessionState("authenticated");

        if (onAuthenticated) {
          onAuthenticated();
        } else if (result.redirectTo) {
          router.replace(result.redirectTo);
        } else {
          setTimeout(() => {
            router.push("/v2");
          }, 1000);
        }
      } else {
        setGeneralError("Geçersiz veya süresi dolmuş doğrulama kodu.");
      }
    } catch {
      setGeneralError("Doğrulama işlemi başarısız oldu. Lütfen tekrar dene.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (loading) return;
    setGeneralError(null);
    setSuccessMsg(null);
    try {
      const res = await submitAuth("verify-email/resend", { email: email.trim() });
      if (res.ok) {
        setSuccessMsg("Yeni doğrulama kodu e-posta adresine gönderildi.");
      } else {
        setGeneralError("Doğrulama kodu yeniden gönderilemedi. Lütfen biraz bekle.");
      }
    } catch {
      setGeneralError("Bağlantı hatası oluştu.");
    }
  };

  return (
    <div
      className={`relative w-full rounded-3xl border border-border bg-card/95 backdrop-blur-md p-6 sm:p-8 shadow-2xl transition-all ${
        inModal ? "border-none shadow-none p-0 bg-transparent" : "max-w-md mx-auto"
      }`}
    >
      {/* Decorative Aura */}
      {!inModal && (
        <div
          className="absolute -top-12 -left-12 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none -z-10"
          aria-hidden="true"
        />
      )}

      {/* Header Info */}
      <div className="text-center space-y-2 mb-6">
        <Badge variant="primary" size="sm" className="mb-1">
          {step === "form" ? "Yeni Nesil Coğrafya v2" : "Doğrulama Adımı"}
        </Badge>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {step === "form" ? "Hesap Oluştur" : "E-posta Doğrulama"}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {step === "form"
            ? "Müfredat haritaları, soru bankası ve interaktif araçlara anında erişin."
            : `${email} adresine gönderilen 6 haneli kodu giriniz.`}
        </p>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in-50 duration-200"
        >
          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
          <span className="leading-relaxed font-medium">{successMsg}</span>
        </div>
      )}

      {/* STEP 1: Registration Form */}
      {step === "form" && (
        <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
          {/* Accessible Status Announcement for Client Validation Errors */}
          <div role="status" aria-live="polite" className="sr-only">
            {Object.keys(fieldErrors).length > 0 &&
              `Kayıt formunda ${Object.keys(fieldErrors).length} adet düzeltilmesi gereken hata var.`}
          </div>

          {/* General Error Banner */}
          {generalError && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-xs text-destructive animate-in fade-in-50 duration-200"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{generalError}</span>
            </div>
          )}

          {/* Ad ve Soyad */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="v2-register-firstname" className="text-xs font-bold text-foreground">
                Ad
              </Label>
              <Input
                id="v2-register-firstname"
                type="text"
                autoComplete="given-name"
                placeholder="Ahmet"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                leftIcon={<User className="size-4 text-muted-foreground" />}
                className="h-10 text-xs"
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.firstName)}
                aria-describedby={fieldErrors.firstName ? "v2-error-firstname" : undefined}
              />
              <FieldError id="v2-error-firstname" message={fieldErrors.firstName} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v2-register-lastname" className="text-xs font-bold text-foreground">
                Soyad
              </Label>
              <Input
                id="v2-register-lastname"
                type="text"
                autoComplete="family-name"
                placeholder="Yılmaz"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-10 text-xs"
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.lastName)}
                aria-describedby={fieldErrors.lastName ? "v2-error-lastname" : undefined}
              />
              <FieldError id="v2-error-lastname" message={fieldErrors.lastName} />
            </div>
          </div>

          {/* Telefon Numarası */}
          <div className="space-y-1.5">
            <Label htmlFor="v2-register-phone" className="text-xs font-bold text-foreground">
              Telefon Numarası
            </Label>
            <Input
              id="v2-register-phone"
              type="tel"
              autoComplete="tel"
              placeholder="05xx xxx xx xx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<Phone className="size-4 text-muted-foreground" />}
              className="h-10 text-xs"
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? "v2-error-phone" : undefined}
            />
            <FieldError id="v2-error-phone" message={fieldErrors.phone} />
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
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "v2-error-email" : undefined}
            />
            <FieldError id="v2-error-email" message={fieldErrors.email} />
          </div>

          {/* User Role Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Profil Türü / Hedefin</Label>
            <div
              className="grid grid-cols-2 gap-1.5"
              role="radiogroup"
              aria-label="Profil Türü / Hedefin"
            >
              {USER_ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedRole === role.id}
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

          {/* İl ve İlçe Seçimi */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="v2-register-province" className="text-xs font-bold text-foreground">
                İl
              </Label>
              <div className="relative">
                <select
                  id="v2-register-province"
                  value={selectedPlate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedPlate(next);
                    setSelectedDistrictId("");
                    if (!next) setDistricts([]);
                  }}
                  disabled={loading}
                  aria-invalid={Boolean(fieldErrors.provincePlateCode)}
                  aria-describedby={fieldErrors.provincePlateCode ? "v2-error-province" : undefined}
                  className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground appearance-none hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150"
                >
                  <option value="">İl Seç...</option>
                  {activeProvinces.map((p) => (
                    <option key={p.plateCode} value={p.plateCode}>
                      {p.nameTr}
                    </option>
                  ))}
                </select>
                <MapPin className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <FieldError id="v2-error-province" message={fieldErrors.provincePlateCode} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="v2-register-district" className="text-xs font-bold text-foreground">
                İlçe
              </Label>
              <div className="relative">
                <select
                  id="v2-register-district"
                  value={selectedDistrictId}
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  disabled={!selectedPlate || districts.length === 0 || loading}
                  aria-invalid={Boolean(fieldErrors.districtId)}
                  aria-describedby={fieldErrors.districtId ? "v2-error-district" : undefined}
                  className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground appearance-none hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150 disabled:opacity-50"
                >
                  <option value="">{!selectedPlate ? "Önce İl Seçin" : "İlçe Seç..."}</option>
                  {districts.length > 0 &&
                    districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nameTr}
                      </option>
                    ))}
                </select>
                <MapPin className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <FieldError id="v2-error-district" message={fieldErrors.districtId} />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <Label htmlFor="v2-register-password" className="text-xs font-bold text-foreground">
              Güçlü Şifre Oluştur
            </Label>
            <div className="relative">
              <Input
                id="v2-register-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="En az 6 karakter, büyük/küçük harf ve rakam..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="size-4 text-muted-foreground" />}
                className="h-10 pr-10 text-xs"
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "v2-error-password" : undefined}
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
            <FieldError id="v2-error-password" message={fieldErrors.password} />

            {/* Dynamic Password Strength Indicators */}
            <div className="grid grid-cols-4 gap-1 pt-1 text-[11px] text-muted-foreground">
              <span
                className={`inline-flex items-center gap-0.5 ${hasMinLength ? "text-emerald-600 font-bold" : ""}`}
              >
                <Check className={`size-3 ${hasMinLength ? "opacity-100" : "opacity-30"}`} /> 6+
                karakter
              </span>
              <span
                className={`inline-flex items-center gap-0.5 ${hasUpper ? "text-emerald-600 font-bold" : ""}`}
              >
                <Check className={`size-3 ${hasUpper ? "opacity-100" : "opacity-30"}`} /> Büyük harf
              </span>
              <span
                className={`inline-flex items-center gap-0.5 ${hasLower ? "text-emerald-600 font-bold" : ""}`}
              >
                <Check className={`size-3 ${hasLower ? "opacity-100" : "opacity-30"}`} /> Küçük harf
              </span>
              <span
                className={`inline-flex items-center gap-0.5 ${hasNumber ? "text-emerald-600 font-bold" : ""}`}
              >
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
              Zaten bir hesabın var mı?{" "}
              {onSwitchToLogin ? (
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="font-bold text-primary hover:underline"
                >
                  Giriş Yap
                </button>
              ) : (
                <Link href="/v2/giris" className="font-bold text-primary hover:underline">
                  Giriş Yap
                </Link>
              )}
            </p>
          </div>
        </form>
      )}

      {/* STEP 2: Email Verification */}
      {step === "verify" && (
        <form onSubmit={handleVerifySubmit} className="space-y-4" noValidate>
          {generalError && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-xs text-destructive animate-in fade-in-50 duration-200"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{generalError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="v2-register-code" className="text-xs font-bold text-foreground">
              6 Haneli Doğrulama Kodu
            </Label>
            <Input
              id="v2-register-code"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="h-12 text-center text-lg font-mono font-bold tracking-widest"
              autoFocus
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={loading}
            className="w-full h-11 rounded-xl shadow-md font-bold text-sm mt-2"
          >
            Kodu Doğrula ve Başla
          </Button>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="hover:text-foreground transition-colors"
            >
              ← Bilgileri Düzenle
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading}
              className="text-primary font-semibold hover:underline"
            >
              Kodu Tekrar Gönder
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
