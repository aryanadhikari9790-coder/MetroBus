import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import LocationPicker from "../../components/LocationPicker";
import { useTheme } from "../../ThemeContext";
import { themeTokens } from "../../lib/theme";

export default function Register() {
  const nav = useNavigate();
  const { isDark } = useTheme();
  const t = themeTokens(isDark);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpNote, setOtpNote] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCorporateEmployee, setIsCorporateEmployee] = useState(false);
  const [homeLocation, setHomeLocation] = useState({ label: "", lat: null, lng: null });
  const [officeLocation, setOfficeLocation] = useState({ label: "", lat: null, lng: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const requestOtp = async () => {
    setErr("");
    setOk("");
    setOtpNote("");
    setDevOtp("");
    setOtpBusy(true);
    try {
      const res = await api.post("/api/auth/otp/request/", { phone });
      setOtpRequested(true);
      setOtpNote(res.data?.detail || res.data?.message || "OTP sent.");
      setDevOtp(res.data?.dev_code || "");
    } catch (error) {
      const detail = error?.response?.data?.phone?.[0] || error?.response?.data?.detail;
      setErr(detail || "Unable to send OTP right now.");
    } finally {
      setOtpBusy(false);
    }
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
      });
      setOk("Passenger account created. Please log in with your phone number and password.");
      setTimeout(() => nav("/auth/login"), 900);
    } catch (error) {
      const data = error?.response?.data || {};
      setErr(
        data?.otp_code?.[0] ||
          data?.phone?.[0] ||
          data?.email?.[0] ||
          data?.office_location_label?.[0] ||
          data?.detail ||
          "Registration failed. Please review the form and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`min-h-screen ${t.page}`}>
      <div className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.22),transparent_34%)] ${isDark ? "opacity-100" : "opacity-80"}`} />

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-8 lg:px-8 lg:py-10">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_1.3fr]">
            <section className={`rounded-[32px] border p-6 lg:p-8 ${t.card}`}>
              <p className={`text-xs font-bold uppercase tracking-[0.35em] ${t.label}`}>MetroBus Pokhara</p>
              <h1 className={`mt-4 text-3xl font-black leading-tight ${t.text}`}>
                Passenger registration with verified Nepal mobile numbers.
              </h1>
              <p className={`mt-4 text-sm leading-6 ${t.textSub}`}>
                This page is for passengers only. Drivers, helpers, and admins are created by the MetroBus admin team.
              </p>

              <div className={`mt-6 rounded-[28px] border p-5 ${isDark ? "border-sky-400/20 bg-sky-500/10" : "border-sky-200 bg-sky-50"}`}>
                <p className={`text-sm font-semibold ${t.text}`}>What you will need</p>
                <ul className={`mt-3 space-y-2 text-sm ${t.textSub}`}>
                  <li>Full name split into first, middle, and last name.</li>
                  <li>Nepal mobile number in +977 or 98XXXXXXXX format.</li>
                  <li>Home location pinned by search or by tapping the map.</li>
                  <li>Office location too, if you travel as a corporate employee.</li>
                </ul>
              </div>

              <div className={`mt-6 rounded-[28px] border p-5 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/80"}`}>
                <p className={`text-sm font-semibold ${t.text}`}>Account policy</p>
                <p className={`mt-2 text-sm leading-6 ${t.textSub}`}>
                  Staff accounts do not register here. If you are a driver, helper, or admin, please contact the operations admin for account creation.
                </p>
                <Link
                  className={`mt-4 inline-flex rounded-2xl px-4 py-3 text-sm font-semibold transition ${isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                  to="/auth/login"
                >
                  Go to login
                </Link>
              </div>
            </section>

            <section className={`rounded-[32px] border p-6 lg:p-8 ${t.card}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-[0.35em] ${t.label}`}>Passenger Sign Up</p>
                  <h2 className={`mt-3 text-2xl font-black ${t.text}`}>Create your MetroBus account</h2>
                </div>
                <Link className={`text-sm font-semibold ${isDark ? "text-sky-300" : "text-sky-700"}`} to="/auth/login">
                  Already have an account?
                </Link>
              </div>

              {err ? <div className={`mt-5 rounded-3xl border px-4 py-3 text-sm ${t.errBanner}`}>{err}</div> : null}
              {ok ? <div className={`mt-5 rounded-3xl border px-4 py-3 text-sm ${t.okBanner}`}>{ok}</div> : null}

              <div className="mt-6 space-y-6">
                <section>
                  <p className={`text-xs font-bold uppercase tracking-[0.25em] ${t.label}`}>1. Personal details</p>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <input
                      className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${t.input}`}
                      placeholder="First name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                    <input
                      className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${t.input}`}
                      placeholder="Middle name (optional)"
                      value={middleName}
                      onChange={(event) => setMiddleName(event.target.value)}
                    />
                    <input
                      className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${t.input}`}
                      placeholder="Last name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr]">
                    <input
                      className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${t.input}`}
                      placeholder="Phone number (+977 98XXXXXXXX)"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />

                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <input
                        className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${t.input}`}
                        placeholder="4-digit OTP"
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                        inputMode="numeric"
                        maxLength={4}
                      />
                      <button
                        type="button"
                        onClick={requestOtp}
                        disabled={otpBusy}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${isDark ? "bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:bg-sky-500/60" : "bg-sky-600 text-white hover:bg-sky-500 disabled:bg-sky-300"}`}
                      >
                        {otpBusy ? "Sending..." : otpRequested ? "Resend OTP" : "Send OTP"}
                      </button>
                    </div>
                  </div>

                  {otpNote ? (
                    <p className={`mt-3 text-xs ${isDark ? "text-sky-300" : "text-sky-700"}`}>{otpNote}</p>
                  ) : null}
                  {devOtp ? (
                    <p className={`mt-1 text-xs ${isDark ? "text-amber-300" : "text-amber-700"}`}>
                      Dev OTP: <span className="font-mono font-bold">{devOtp}</span>
                    </p>
                  ) : null}

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input
                      className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${t.input}`}
                      placeholder="Email address"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <input
                      className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${t.input}`}
                      placeholder="Password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                </section>

                <section>
                  <p className={`text-xs font-bold uppercase tracking-[0.25em] ${t.label}`}>2. Home location</p>
                  <div className="mt-3">
                    <LocationPicker
                      label="Home location"
                      value={homeLocation}
                      onChange={setHomeLocation}
                      isDark={isDark}
                      required
                      helperText="Search your home area or tap your exact pickup neighborhood on the map."
                    />
                  </div>
                </section>

                <section>
                  <div className={`rounded-[28px] border p-5 ${isDark ? "border-white/10 bg-[#10192b]" : "border-slate-200 bg-slate-50"}`}>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isCorporateEmployee}
                        onChange={(event) => setIsCorporateEmployee(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span>
                        <span className={`block text-sm font-semibold ${t.text}`}>I am a corporate employee</span>
                        <span className={`mt-1 block text-sm ${t.textSub}`}>
                          Turn this on if your travel is linked to a fixed office location so we can capture that destination too.
                        </span>
                      </span>
                    </label>
                  </div>

                  {isCorporateEmployee ? (
                    <div className="mt-3">
                      <LocationPicker
                        label="Office location"
                        value={officeLocation}
                        onChange={setOfficeLocation}
                        isDark={isDark}
                        required
                        helperText="Search your office or pin the exact building directly on the map."
                      />
                    </div>
                  ) : null}
                </section>

                <button
                  type="button"
                  className={`w-full rounded-[24px] px-5 py-4 text-sm font-bold transition ${isDark ? "bg-white text-slate-950 hover:bg-slate-100 disabled:bg-slate-500" : "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400"}`}
                  onClick={onRegister}
                  disabled={busy}
                >
                  {busy ? "Creating passenger account..." : "Create passenger account"}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
