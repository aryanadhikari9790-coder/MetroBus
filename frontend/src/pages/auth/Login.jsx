import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { setToken } from "../../auth";
import { useAuth } from "../../AuthContext";
import { Icon, MetroBusMark, MetroBusWordmark } from "../../components/passenger/PassengerUI";
import { PASSENGER_THEME } from "../passenger/passengerUtils";

const roleToHome = {
  PASSENGER: "/passenger",
  DRIVER: "/driver",
  HELPER: "/helper",
  ADMIN: "/admin",
};

export default function Login() {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetPhone, setResetPhone] = useState("");
  const [resetOtp, setResetOtp] = useState(["", "", "", ""]);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [resetDevCode, setResetDevCode] = useState("");

  const onLogin = async () => {
    setErr("");
    setMsg("");
    try {
      const response = await api.post("/api/auth/login/", { phone, password });
      setToken(response.data.access);
      const me = await refreshMe();
      navigate(roleToHome[me?.role] || "/passenger", { replace: true });
    } catch (error) {
      setErr(error?.response?.data?.detail || "Login failed. Check your phone number and password.");
    }
  };

  const openReset = () => {
    setShowReset(true);
    setErr("");
    setMsg("");
    setResetDevCode("");
    setResetRequested(false);
    setResetOtp(["", "", "", ""]);
    setResetPassword("");
    setResetPasswordConfirm("");
    setResetPhone((phone || "").trim());
  };

  const closeReset = () => {
    setShowReset(false);
    setResetBusy(false);
    setResetRequested(false);
    setResetOtp(["", "", "", ""]);
    setResetPassword("");
    setResetPasswordConfirm("");
    setResetDevCode("");
    setMsg("");
    setErr("");
  };

  const updateResetOtpDigit = (index, value) => {
    const next = value.replace(/\D/g, "").slice(-1);
    setResetOtp((current) => current.map((digit, digitIndex) => (digitIndex === index ? next : digit)));
  };

  const requestResetOtp = async () => {
    if (!resetPhone.trim()) {
      setErr("Enter your passenger phone number first.");
      return;
    }
    setResetBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post("/api/auth/password-reset/request/", { phone: resetPhone.trim() });
      setResetRequested(true);
      setResetDevCode(response.data.dev_code || "");
      setMsg(response.data.message || "Password reset OTP sent.");
    } catch (error) {
      const detail = error?.response?.data?.phone?.[0] || error?.response?.data?.detail || "Unable to send password reset OTP.";
      setErr(detail);
    } finally {
      setResetBusy(false);
    }
  };

  const confirmResetPassword = async () => {
    if (resetOtp.join("").length !== 4) {
      setErr("Enter the 4-digit OTP.");
      return;
    }
    if (!resetPassword.trim() || resetPassword.length < 6) {
      setErr("Enter a new password with at least 6 characters.");
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      setErr("Password confirmation does not match.");
      return;
    }

    setResetBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await api.post("/api/auth/password-reset/confirm/", {
        phone: resetPhone.trim(),
        otp_code: resetOtp.join(""),
        password: resetPassword,
        password_confirm: resetPasswordConfirm,
      });
      setPhone(resetPhone.trim());
      setPassword("");
      setShowReset(false);
      setResetRequested(false);
      setResetOtp(["", "", "", ""]);
      setResetPassword("");
      setResetPasswordConfirm("");
      setResetDevCode("");
      setMsg(response.data.message || "Password reset complete. Sign in with your new password.");
    } catch (error) {
      const detail =
        error?.response?.data?.otp_code?.[0]
        || error?.response?.data?.password_confirm?.[0]
        || error?.response?.data?.phone?.[0]
        || error?.response?.data?.detail
        || "Unable to reset your password.";
      setErr(detail);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div
      style={PASSENGER_THEME}
      className="min-h-screen bg-[linear-gradient(180deg,var(--mb-bg),var(--mb-bg-alt)_48%,#fff7f4)] text-[var(--mb-text)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,115,0.14),transparent_36%),radial-gradient(circle_at_bottom,rgba(52,21,93,0.12),transparent_36%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[29rem] flex-col justify-center px-5 py-8">
        <div className="text-center">
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-[1.5rem] bg-[linear-gradient(180deg,var(--mb-purple),var(--mb-accent))] shadow-[var(--mb-shadow-strong)]">
            <MetroBusMark className="h-14 w-14" />
          </div>
          <div className="mt-7 flex justify-center">
            <MetroBusWordmark />
          </div>
          <p className="mt-3 text-[1.05rem] font-medium text-[#4e475c]">Your premium urban transit portal</p>
        </div>

        <section className="mt-10 rounded-[2rem] bg-white/95 px-6 py-7 shadow-[0_18px_44px_rgba(125,55,193,0.1)]">
          <h1 className="text-[2.7rem] font-black leading-[0.95] tracking-[-0.04em] text-[#17131d]">Welcome Back</h1>
          <p className="mt-4 text-[1.05rem] leading-8 text-[#544d61]">
            Please enter your credentials to continue your journey.
          </p>

          {err ? (
            <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {err}
            </div>
          ) : null}
          {msg ? (
            <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {msg}
            </div>
          ) : null}

          <div className="mt-8 space-y-6">
            <label className="block">
              <span className="mb-3 block text-sm font-black uppercase tracking-[0.28em] text-[#241828]">Phone Number</span>
              <div className="flex items-center gap-3 rounded-[1.35rem] bg-[#f3f0ff] px-5 py-4 shadow-[inset_0_0_0_1px_rgba(109,62,193,0.05)]">
                <span className="shrink-0 border-r border-[#d8d0ef] pr-4 text-[1.05rem] font-semibold text-[#3f364d]">+977</span>
                <input
                  className="min-w-0 flex-1 bg-transparent text-[1.05rem] font-medium text-[#2b2236] outline-none placeholder:text-[#b0a8bf]"
                  placeholder="98XXXXXXXX"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onLogin();
                  }}
                />
              </div>
            </label>

            <label className="block">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-black uppercase tracking-[0.28em] text-[#241828]">Password</span>
                <button type="button" onClick={openReset} className="text-sm font-bold text-[#4b22d3]">
                  Forgot Password?
                </button>
              </div>
              <div className="flex items-center gap-3 rounded-[1.35rem] bg-[#f3f0ff] px-5 py-4 shadow-[inset_0_0_0_1px_rgba(109,62,193,0.05)]">
                <Icon name="lock" className="h-6 w-6 text-[#5f566f]" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-[1.05rem] font-medium text-[#2b2236] outline-none placeholder:text-[#b0a8bf]"
                  placeholder="Enter your password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onLogin();
                  }}
                />
              </div>
            </label>

            <button
              type="button"
              onClick={onLogin}
              className="flex w-full items-center justify-center gap-3 rounded-[1.2rem] bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] px-6 py-5 text-[1.05rem] font-black text-white shadow-[var(--mb-shadow-strong)] transition hover:translate-y-[-1px]"
            >
              <span>Log In</span>
              <Icon name="chevron" className="h-5 w-5" />
            </button>
          </div>

          {showReset ? (
            <div className="mt-6 rounded-[1.5rem] border border-[rgba(104,13,255,0.12)] bg-[#f6f2ff] px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-[#5b20dd]">Passenger Password Reset</p>
                  <h2 className="mt-2 text-[1.5rem] font-black leading-tight text-[#17131d]">Reset with phone OTP</h2>
                  <p className="mt-2 text-sm leading-6 text-[#544d61]">
                    This reset flow is only for passenger accounts. Staff and admin passwords are managed by MetroBus admin.
                  </p>
                </div>
                <button type="button" onClick={closeReset} className="rounded-[0.9rem] bg-white px-3 py-2 text-xs font-black text-[#4b22d3]">
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.24em] text-[#241828]">Passenger Phone</span>
                  <div className="flex items-center gap-3 rounded-[1.15rem] bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(109,62,193,0.07)]">
                    <span className="shrink-0 border-r border-[#ddd5f1] pr-3 text-sm font-semibold text-[#3f364d]">+977</span>
                    <input
                      className="min-w-0 flex-1 bg-transparent text-[1rem] font-medium text-[#2b2236] outline-none placeholder:text-[#b0a8bf]"
                      placeholder="98XXXXXXXX"
                      value={resetPhone}
                      onChange={(event) => setResetPhone(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={requestResetOtp}
                      disabled={resetBusy}
                      className="rounded-[0.9rem] border border-[#5b20dd] px-4 py-2 text-sm font-black text-[#5b20dd] transition disabled:opacity-60"
                    >
                      {resetBusy && !resetRequested ? "Sending..." : "Send OTP"}
                    </button>
                  </div>
                </label>

                <div className="rounded-[1.15rem] bg-white px-4 py-4 shadow-[inset_0_0_0_1px_rgba(109,62,193,0.06)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#4b22d3]">Verify Mobile</p>
                      <p className="mt-1 text-xs leading-5 text-[#61586e]">Enter the 4-digit code sent to your passenger phone.</p>
                    </div>
                    {resetDevCode ? <span className="rounded-[0.85rem] bg-[#efe5ff] px-3 py-1 text-[0.7rem] font-black text-[#5b20dd]">Dev OTP: {resetDevCode}</span> : null}
                  </div>
                  <div className="mt-4 flex gap-3">
                    {resetOtp.map((digit, index) => (
                      <input
                        key={index}
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(event) => updateResetOtpDigit(index, event.target.value)}
                        className="h-14 w-14 rounded-[0.95rem] border border-[#d7d0eb] bg-[#fbfaff] text-center text-xl font-black text-[#2b2236] outline-none transition focus:border-[#5b20dd]"
                      />
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.24em] text-[#241828]">New Password</span>
                  <div className="flex items-center gap-3 rounded-[1.15rem] bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(109,62,193,0.07)]">
                    <Icon name="lock" className="h-5 w-5 text-[#5f566f]" />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-[1rem] font-medium text-[#2b2236] outline-none placeholder:text-[#b0a8bf]"
                      placeholder="Enter a new password"
                      type="password"
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.24em] text-[#241828]">Confirm Password</span>
                  <div className="flex items-center gap-3 rounded-[1.15rem] bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(109,62,193,0.07)]">
                    <Icon name="lock" className="h-5 w-5 text-[#5f566f]" />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-[1rem] font-medium text-[#2b2236] outline-none placeholder:text-[#b0a8bf]"
                      placeholder="Repeat the new password"
                      type="password"
                      value={resetPasswordConfirm}
                      onChange={(event) => setResetPasswordConfirm(event.target.value)}
                    />
                  </div>
                </label>

                <button
                  type="button"
                  onClick={confirmResetPassword}
                  disabled={resetBusy || !resetRequested}
                  className="flex w-full items-center justify-center gap-3 rounded-[1.2rem] bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] px-6 py-4 text-[1rem] font-black text-white shadow-[var(--mb-shadow-strong)] transition disabled:opacity-60"
                >
                  <span>{resetBusy && resetRequested ? "Resetting..." : "Reset Password"}</span>
                  <Icon name="chevron" className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-8 rounded-[1.5rem] bg-[#f2effa] px-5 py-5 text-left">
            <div className="flex gap-4">
              <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[rgba(104,13,255,0.12)] text-[#5e17eb]">
                <Icon name="info" className="h-5 w-5" />
              </div>
              <p className="text-[1rem] leading-8 text-[#3f364d]">
                <span className="font-black text-[#241828]">Staff Notice:</span> Admin and staff accounts are pre-created by the
                system administrator. If you need access, please contact the central operations office.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              className="inline-flex rounded-[1rem] bg-[#efe5ff] px-5 py-3 text-sm font-black text-[#6218ea] transition hover:bg-[#e4d4ff]"
              to="/auth/register"
            >
              Create passenger account
            </Link>
          </div>
        </section>

        <div className="mt-7 flex items-center justify-center gap-6 text-sm font-medium text-[#5c5669]">
          <button type="button">Privacy Policy</button>
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4cade]" />
          <button type="button">Terms of Service</button>
        </div>
      </div>
    </div>
  );
}
