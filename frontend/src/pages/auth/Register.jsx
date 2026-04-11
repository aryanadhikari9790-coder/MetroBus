import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import LocationPicker from "../../components/LocationPicker";
import { Icon, MetroBusWordmark } from "../../components/passenger/PassengerUI";
import { PASSENGER_THEME } from "../passenger/passengerUtils";

function OtpSlots({ value, onChange }) {
  const digits = value.padEnd(4, " ").slice(0, 4).split("");

  return (
    <div className="flex items-center gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          value={digit.trim()}
          inputMode="numeric"
          maxLength={1}
          className="h-14 w-14 rounded-[0.95rem] border border-[#dad3ec] bg-white text-center text-xl font-black text-[#26172f] outline-none transition focus:border-[#6f18f8] focus:ring-2 focus:ring-[#e8d9ff]"
          onChange={(event) => {
            const nextDigit = event.target.value.replace(/\D/g, "").slice(-1);
            const next = value.padEnd(4, " ").slice(0, 4).split("");
            next[index] = nextDigit || " ";
            onChange(next.join("").trim());
          }}
        />
      ))}
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpNote, setOtpNote] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [otpReady, setOtpReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCorporateEmployee, setIsCorporateEmployee] = useState(false);
  const [homeLocation, setHomeLocation] = useState({ label: "", lat: null, lng: null });
  const [officeLocation, setOfficeLocation] = useState({ label: "", lat: null, lng: null });
  const [schoolLocation, setSchoolLocation] = useState({ label: "", lat: null, lng: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const fullName = useMemo(
    () => [firstName, middleName, lastName].map((part) => part.trim()).filter(Boolean).join(" "),
    [firstName, lastName, middleName],
  );

  const requestOtp = async () => {
    setErr("");
    setOk("");
    setOtpNote("");
    setDevOtp("");
    setOtpBusy(true);
    try {
      const response = await api.post("/api/auth/otp/request/", { phone });
      setOtpRequested(true);
      setOtpNote(response.data?.detail || response.data?.message || "OTP sent.");
      setDevOtp(response.data?.dev_code || "");
    } catch (error) {
      const detail = error?.response?.data?.phone?.[0] || error?.response?.data?.detail;
      setErr(detail || "Unable to send OTP right now.");
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyOtpLocally = () => {
    if (otpCode.length !== 4) {
      setErr("Enter the 4-digit OTP before continuing.");
      setOtpReady(false);
      return;
    }
    setErr("");
    setOtpReady(true);
    setOtpNote("OTP captured. MetroBus will confirm it when you register.");
  };

  const onRegister = async () => {
    setErr("");
    setOk("");
    setBusy(true);
    try {
      await api.post("/api/auth/register/", {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        phone,
        otp_code: otpCode,
        email: email || null,
        password,
        home_location_label: homeLocation.label,
        home_lat: homeLocation.lat,
        home_lng: homeLocation.lng,
        is_corporate_employee: isCorporateEmployee,
        office_location_label: isCorporateEmployee ? officeLocation.label : "",
        office_lat: isCorporateEmployee ? officeLocation.lat : null,
        office_lng: isCorporateEmployee ? officeLocation.lng : null,
        school_location_label: schoolLocation.label || "",
        school_lat: schoolLocation.lat,
        school_lng: schoolLocation.lng,
      });
      setOk("Passenger account created. Please log in with your phone number and password.");
      setTimeout(() => navigate("/auth/login"), 900);
    } catch (error) {
      const data = error?.response?.data || {};
      setErr(
        data?.otp_code?.[0]
          || data?.phone?.[0]
          || data?.email?.[0]
          || data?.office_location_label?.[0]
          || data?.school_location_label?.[0]
          || data?.detail
          || "Registration failed. Please review the form and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={PASSENGER_THEME}
      className="min-h-screen bg-[linear-gradient(180deg,var(--mb-bg),var(--mb-bg-alt)_46%,#fff7f4)] text-[var(--mb-text)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,115,0.12),transparent_38%),radial-gradient(circle_at_bottom,rgba(52,21,93,0.1),transparent_34%)]" />

      <div className="relative mx-auto max-w-[29rem] px-4 py-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/auth/login"
              className="grid h-11 w-11 place-items-center rounded-[1rem] bg-white text-[#4f21d1] shadow-[0_12px_24px_rgba(95,59,171,0.1)]"
            >
              <Icon name="arrow-left" className="h-5 w-5" />
            </Link>
            <div>
              <MetroBusWordmark compact />
              <p className="mt-1 text-xs font-medium text-[#6e6780]">Passenger onboarding</p>
            </div>
          </div>
          <div className="pt-1 text-right text-xs leading-4 text-[#5b5569]">
            <p>Already have an account?</p>
            <Link className="mt-1 block text-sm font-black text-[#4f21d1]" to="/auth/login">
              Log In
            </Link>
          </div>
        </header>

        <div className="mt-8">
          <h1 className="text-[2.5rem] font-black leading-[0.94] tracking-[-0.04em] text-[#121019]">
            Create Passenger Profile
          </h1>
        </div>

        {err ? <p className="mt-5 text-sm font-semibold text-red-600">{err}</p> : null}
        {ok ? <p className="mt-5 text-sm font-semibold text-emerald-600">{ok}</p> : null}

        <section className="mt-6 rounded-[2rem] bg-white/96 px-5 py-6 shadow-[0_18px_42px_rgba(123,53,190,0.1)]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#241828]">Full Name</span>
              <input
                className="w-full rounded-[1.25rem] bg-[#f2efff] px-5 py-4 text-[1rem] font-medium text-[#241828] outline-none placeholder:text-[#b1a8c5]"
                placeholder="John Doe"
                value={fullName}
                onChange={(event) => {
                  const parts = event.target.value.split(" ");
                  setFirstName(parts[0] || "");
                  setMiddleName(parts.length > 2 ? parts.slice(1, -1).join(" ") : "");
                  setLastName(parts.length > 1 ? parts.at(-1) || "" : "");
                }}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#241828]">Email Address</span>
              <input
                className="w-full rounded-[1.25rem] bg-[#f2efff] px-5 py-4 text-[1rem] font-medium text-[#241828] outline-none placeholder:text-[#b1a8c5]"
                placeholder="john@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#241828]">Phone Number</span>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <input
                  className="rounded-[1.25rem] bg-[#f2efff] px-5 py-4 text-[1rem] font-medium text-[#241828] outline-none placeholder:text-[#b1a8c5]"
                  placeholder="+977 98XXXXXXXX"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <button
                  type="button"
                  onClick={requestOtp}
                  disabled={otpBusy}
                  className="rounded-[1rem] border-2 border-[#5021d8] px-5 py-4 text-sm font-black text-[#5021d8] transition hover:bg-[#f5f0ff] disabled:opacity-60"
                >
                  {otpBusy ? "Sending..." : otpRequested ? "Resend OTP" : "Send OTP"}
                </button>
              </div>
            </label>

            <div className="rounded-[1.35rem] border border-[#ded6ef] bg-[#f7f2ff] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-[#4721d1]">Verify Mobile</p>
                </div>
                <button
                  type="button"
                  onClick={verifyOtpLocally}
                  className="rounded-[1rem] bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] px-4 py-3 text-sm font-black text-white shadow-[var(--mb-shadow-strong)]"
                >
                  {otpReady ? "Verified" : "Verify OTP"}
                </button>
              </div>
              <div className="mt-4">
                <OtpSlots
                  value={otpCode}
                  onChange={(next) => {
                    setOtpCode(next.replace(/\D/g, "").slice(0, 4));
                    if (otpReady) setOtpReady(false);
                  }}
                />
              </div>
              {otpNote ? <p className="mt-3 text-xs font-medium text-[#4f21d1]">{otpNote}</p> : null}
              {devOtp ? (
                <p className="mt-1 text-xs font-medium text-[#85640c]">
                  Dev OTP: <span className="font-mono font-black">{devOtp}</span>
                </p>
              ) : null}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#241828]">Security Password</span>
              <input
                className="w-full rounded-[1.25rem] bg-[#f2efff] px-5 py-4 text-[1rem] font-medium text-[#241828] outline-none placeholder:text-[#b1a8c5]"
                placeholder="Create a secure password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <label className="flex items-start gap-4 rounded-[1.2rem] bg-[#f7f4fb] px-4 py-4">
              <input
                type="checkbox"
                checked={isCorporateEmployee}
                onChange={(event) => setIsCorporateEmployee(event.target.checked)}
                className="mt-1 h-5 w-5 rounded border-[#d5cced] text-[#5c18eb] focus:ring-[#8e4eff]"
              />
              <span>
                <span className="block text-lg font-bold text-[#241828]">Corporate Account</span>
                <span className="mt-1 block text-sm leading-6 text-[#635d73]">
                  Link with your company for business trip reimbursements.
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] bg-white/96 px-5 py-6 shadow-[0_18px_42px_rgba(123,53,190,0.1)]">
          <div>
            <h2 className="text-[1.7rem] font-black text-[#1c1723]">Frequent Destinations</h2>
          </div>

          <div className="mt-5 space-y-4">
            <LocationPicker
              label="Home location"
              value={homeLocation}
              onChange={setHomeLocation}
              isDark={false}
              required
            />

            {isCorporateEmployee ? (
              <LocationPicker
                label="Work location"
                value={officeLocation}
                onChange={setOfficeLocation}
                isDark={false}
                required
              />
            ) : null}

            <LocationPicker
              label="School / College location"
              value={schoolLocation}
              onChange={setSchoolLocation}
              isDark={false}
            />
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] bg-white/96 px-5 py-6 shadow-[0_18px_42px_rgba(123,53,190,0.1)]">
          <p className="text-center text-sm leading-6 text-[#6b647a]">
            By clicking Register, you agree to our <button type="button" className="font-bold text-[#4f21d1]">Terms of Service</button> and{" "}
            <button type="button" className="font-bold text-[#4f21d1]">Privacy Policy</button>.
          </p>

          <button
            type="button"
            onClick={onRegister}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-[1.2rem] bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] px-6 py-5 text-[1.05rem] font-black text-white shadow-[var(--mb-shadow-strong)] transition hover:translate-y-[-1px] disabled:opacity-60"
          >
            <span>{busy ? "Registering..." : "Register"}</span>
            <Icon name="chevron" className="h-5 w-5" />
          </button>
        </section>

        <footer className="pb-6 pt-10 text-center">
          <p className="text-xl font-black text-[#baaff0]">MetroBus</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-[#4f475f]">
            <button type="button">Safety Center</button>
            <button type="button">Accessibility</button>
            <button type="button">Partner Program</button>
            <button type="button">Contact Support</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
