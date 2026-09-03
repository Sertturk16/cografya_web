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
import type { GradeLevel, StudyStream, University, Department } from "@/lib/api/types";
import { GRADE_LEVEL_LABELS, STUDY_STREAM_LABELS } from "@/lib/auth/profile-labels";
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
  School,
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
  { id: "secondary", label: "Ortaöğretim / Lise", icon: <GraduationCap className="size-3.5" /> },
  { id: "undergraduate", label: "Lisans Öğrencisi", icon: <BookOpen className="size-3.5" /> },
  { id: "graduate", label: "Lisansüstü", icon: <Compass className="size-3.5" /> },
  { id: "teacher", label: "Öğretmen / Eğitmen", icon: <Briefcase className="size-3.5" /> },
];

type FieldKey =
  | "firstName"
  | "lastName"
  | "phone"
  | "email"
  | "provincePlateCode"
  | "districtId"
  | "password"
  | "gradeLevel"
  | "studyStream"
  | "universityName"
  | "departmentName";

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

  // Conditional profile fields
  const [selectedGradeLevel, setSelectedGradeLevel] = React.useState<GradeLevel | "">("GRADE_12");
  const [selectedStudyStream, setSelectedStudyStream] = React.useState<StudyStream | "">("TYT");
  const [selectedUniversityName, setSelectedUniversityName] = React.useState("");
  const [selectedDepartmentName, setSelectedDepartmentName] = React.useState("");
  const [universities, setUniversities] = React.useState<University[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);

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

  // Fetch universities and departments for higher education roles
  React.useEffect(() => {
    if (selectedRole === "undergraduate" || selectedRole === "graduate") {
      if (universities.length === 0) {
        fetch("/api/reference/universities")
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) setUniversities(data);
          })
          .catch(() => {});
      }
      if (departments.length === 0) {
        fetch("/api/reference/departments")
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) setDepartments(data);
          })
          .catch(() => {});
      }
    }
  }, [selectedRole, universities.length, departments.length]);

  // Password requirements calculation
  const hasMinLength = password.length >= 8;
  const hasLower = /[a-zğüşıöç]/.test(password);
  const hasUpper = /[A-ZĞÜŞİÖÇ]/.test(password);
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

    // Role-specific field validation
    if (selectedRole === "secondary") {
      if (!selectedGradeLevel) {
        errors.gradeLevel = "Lütfen sınıf seviyeni seç.";
      }
      if (!selectedStudyStream) {
        errors.studyStream = "Lütfen alanını seç.";
      }
    } else if (selectedRole === "undergraduate") {
      if (!selectedUniversityName.trim()) {
        errors.universityName = "Lütfen üniversiteni belirt.";
      }
      if (!selectedDepartmentName.trim()) {
        errors.departmentName = "Lütfen bölümünü belirt.";
      }
    } else if (selectedRole === "graduate") {
      if (!selectedUniversityName.trim()) {
        errors.universityName = "Lütfen üniversiteni belirt.";
      }
    }

    // Canonical password policy validation
    if (!isPasswordPolicyCompliant(password)) {
      errors.password =
        "Şifren en az 6-128 karakter olmalı; en az bir büyük harf, bir küçük harf ve bir rakam içermelidir.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
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
        gradeLevel: selectedRole === "secondary" ? (selectedGradeLevel as GradeLevel) : "",
        studyStream: selectedRole === "secondary" ? (selectedStudyStream as StudyStream) : "",
        universityName:
          selectedRole === "undergraduate" || selectedRole === "graduate"
            ? selectedUniversityName.trim()
            : "",
        departmentName:
          selectedRole === "undergraduate" || selectedRole === "graduate"
            ? selectedDepartmentName.trim()
            : "",
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
      setGeneralError("Lütfen geçerli doğrulama kodunu gir.");
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
        setSuccessMsg("Hesabın başarıyla doğrulandı ve oturum açıldı! Hoş geldin.");
        if (onAuthenticated) {
          onAuthenticated();
        } else {
          router.replace("/v2");
        }
      } else {
        setGeneralError("Doğrulama kodu hatalı veya süresi dolmuş. Lütfen tekrar kontrol et.");
      }
    } catch {
      setGeneralError("Doğrulama işlemi sırasında hata oluştu.");
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
            <span className="font-semibold text-foreground">{email}</span> adresine bir aktivasyon
            kodu gönderdik.
          </p>
        </div>

        {generalError && (
          <div
            id="v2-verify-error"
            role="alert"
            aria-live="polite"
            className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-xs text-destructive"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span className="font-medium">{generalError}</span>
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
            aria-invalid={Boolean(generalError)}
            aria-describedby={generalError ? "v2-verify-error" : undefined}
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

      {/* General Error Alert */}
      {generalError && (
        <div
          id="v2-register-error"
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
          {fieldErrors.firstName && (
            <p id="v2-error-firstname" className="text-[11px] text-destructive font-medium">
              {fieldErrors.firstName}
            </p>
          )}
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
          {fieldErrors.lastName && (
            <p id="v2-error-lastname" className="text-[11px] text-destructive font-medium">
              {fieldErrors.lastName}
            </p>
          )}
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
        {fieldErrors.phone && (
          <p id="v2-error-phone" className="text-[11px] text-destructive font-medium">
            {fieldErrors.phone}
          </p>
        )}
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
        {fieldErrors.email && (
          <p id="v2-error-email" className="text-[11px] text-destructive font-medium">
            {fieldErrors.email}
          </p>
        )}
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

      {/* Conditional: Secondary School (Grade & Stream) */}
      {selectedRole === "secondary" && (
        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/30 border border-border/80 animate-in fade-in-50 duration-200">
          <div className="space-y-1.5">
            <Label htmlFor="v2-register-grade" className="text-xs font-bold text-foreground">
              Sınıf Seviyesi
            </Label>
            <select
              id="v2-register-grade"
              value={selectedGradeLevel}
              onChange={(e) => setSelectedGradeLevel(e.target.value as GradeLevel)}
              aria-invalid={Boolean(fieldErrors.gradeLevel)}
              aria-describedby={fieldErrors.gradeLevel ? "v2-error-grade" : undefined}
              className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground appearance-none hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150"
            >
              {Object.entries(GRADE_LEVEL_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label.tr}
                </option>
              ))}
            </select>
            {fieldErrors.gradeLevel && (
              <p id="v2-error-grade" className="text-[11px] text-destructive font-medium">
                {fieldErrors.gradeLevel}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v2-register-stream" className="text-xs font-bold text-foreground">
              Sınav / Alan
            </Label>
            <select
              id="v2-register-stream"
              value={selectedStudyStream}
              onChange={(e) => setSelectedStudyStream(e.target.value as StudyStream)}
              aria-invalid={Boolean(fieldErrors.studyStream)}
              aria-describedby={fieldErrors.studyStream ? "v2-error-stream" : undefined}
              className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground appearance-none hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150"
            >
              {Object.entries(STUDY_STREAM_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label.tr}
                </option>
              ))}
            </select>
            {fieldErrors.studyStream && (
              <p id="v2-error-stream" className="text-[11px] text-destructive font-medium">
                {fieldErrors.studyStream}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Conditional: Higher Education (University & Department) */}
      {(selectedRole === "undergraduate" || selectedRole === "graduate") && (
        <div className="space-y-2.5 p-3 rounded-xl bg-muted/30 border border-border/80 animate-in fade-in-50 duration-200">
          <div className="space-y-1.5">
            <Label htmlFor="v2-register-university" className="text-xs font-bold text-foreground">
              Üniversite
            </Label>
            <div className="relative">
              <input
                id="v2-register-university"
                list="v2-universities-list"
                placeholder="Üniversite ara veya yaz..."
                value={selectedUniversityName}
                onChange={(e) => setSelectedUniversityName(e.target.value)}
                aria-invalid={Boolean(fieldErrors.universityName)}
                aria-describedby={fieldErrors.universityName ? "v2-error-university" : undefined}
                className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150"
              />
              <datalist id="v2-universities-list">
                {universities.map((u) => (
                  <option key={u.nameTr} value={u.nameTr}>
                    {u.nameTr}
                  </option>
                ))}
              </datalist>
              <School className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {fieldErrors.universityName && (
              <p id="v2-error-university" className="text-[11px] text-destructive font-medium">
                {fieldErrors.universityName}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v2-register-department" className="text-xs font-bold text-foreground">
              Bölüm {selectedRole === "graduate" && "(Opsiyonel)"}
            </Label>
            <div className="relative">
              <input
                id="v2-register-department"
                list="v2-departments-list"
                placeholder="Bölüm ara veya yaz..."
                value={selectedDepartmentName}
                onChange={(e) => setSelectedDepartmentName(e.target.value)}
                aria-invalid={Boolean(fieldErrors.departmentName)}
                aria-describedby={fieldErrors.departmentName ? "v2-error-department" : undefined}
                className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150"
              />
              <datalist id="v2-departments-list">
                {departments.map((d) => (
                  <option key={d.nameTr} value={d.nameTr}>
                    {d.nameTr}
                  </option>
                ))}
              </datalist>
            </div>
            {fieldErrors.departmentName && (
              <p id="v2-error-department" className="text-[11px] text-destructive font-medium">
                {fieldErrors.departmentName}
              </p>
            )}
          </div>
        </div>
      )}

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
              aria-invalid={Boolean(fieldErrors.provincePlateCode)}
              aria-describedby={fieldErrors.provincePlateCode ? "v2-error-province" : undefined}
              className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground appearance-none hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150"
            >
              <option value="">İl Seç...</option>
              {activeProvinces.map((p) => (
                <option key={p.plateCode} value={p.plateCode}>
                  {p.plateCode} - {p.nameTr}
                </option>
              ))}
            </select>
            <MapPin className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {fieldErrors.provincePlateCode && (
            <p id="v2-error-province" className="text-[11px] text-destructive font-medium">
              {fieldErrors.provincePlateCode}
            </p>
          )}
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
              disabled={districts.length === 0}
              aria-invalid={Boolean(fieldErrors.districtId)}
              aria-describedby={fieldErrors.districtId ? "v2-error-district" : undefined}
              className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground appearance-none hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150 disabled:opacity-50"
            >
              {districts.length === 0 ? (
                <option value="">Önce il seç</option>
              ) : (
                districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nameTr}
                  </option>
                ))
              )}
            </select>
            <MapPin className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {fieldErrors.districtId && (
            <p id="v2-error-district" className="text-[11px] text-destructive font-medium">
              {fieldErrors.districtId}
            </p>
          )}
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
            placeholder="En az 8 karakter..."
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
        {fieldErrors.password && (
          <p id="v2-error-password" className="text-[11px] text-destructive font-medium">
            {fieldErrors.password}
          </p>
        )}

        {/* Dynamic Password Strength Indicators */}
        <div className="grid grid-cols-4 gap-1 pt-1 text-[11px] text-muted-foreground">
          <span
            className={`inline-flex items-center gap-0.5 ${hasMinLength ? "text-emerald-600 font-bold" : ""}`}
          >
            <Check className={`size-3 ${hasMinLength ? "opacity-100" : "opacity-30"}`} /> 8+
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
              className="font-bold text-primary hover:underline ml-1"
            >
              Giriş Yap
            </button>
          ) : (
            <Link href="/v2/giris" className="font-bold text-primary hover:underline ml-1">
              Giriş Yap
            </Link>
          )}
        </p>
      </div>
    </form>
  );
}
