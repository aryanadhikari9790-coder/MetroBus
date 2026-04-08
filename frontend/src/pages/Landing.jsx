import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf3f6,#f5ebf2)] text-[#27133f]">
      <div className="mx-auto max-w-md px-5 py-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[linear-gradient(135deg,#34155d,#ff6b73)]" />
          <div>
            <h1 className="text-2xl font-bold text-[#34155d]">Metro<span className="text-[#ff6b73]">Bus</span></h1>
            <p className="text-sm text-[#7d6b93]">
              Public bus booking & tracking (Pokhara)
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-[#eddff2] bg-white/95 p-5 shadow-[0_18px_40px_rgba(46,18,79,0.08)]">
          <p className="text-sm text-[#6f6284]">
            Login is required to search routes, view buses, and book seats.
          </p>

          <div className="mt-5 flex gap-3">
            <Link
              to="/auth/login"
              className="flex-1 rounded-2xl bg-[linear-gradient(135deg,#ff6b73,#ff8a5b)] px-4 py-3 text-center font-semibold text-white"
            >
              Login
            </Link>
            <Link
              to="/auth/register"
              className="flex-1 rounded-2xl border border-[#eddff2] px-4 py-3 text-center font-semibold text-[#34155d]"
            >
              Register
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Link to="/passenger" className="rounded-2xl border border-[#eddff2] p-3">
              Passenger (demo)
            </Link>
            <Link to="/driver" className="rounded-2xl border border-[#eddff2] p-3">
              Driver (demo)
            </Link>
            <Link to="/helper" className="rounded-2xl border border-[#eddff2] p-3">
              Helper (demo)
            </Link>
            <Link to="/admin" className="rounded-2xl border border-[#eddff2] p-3">
              Admin (demo)
            </Link>
          </div>
        </div>

        <button
          className="mt-6 w-full rounded-2xl border border-[#eddff2] px-4 py-3 text-sm font-semibold text-[#34155d]"
          onClick={() => {
            document.documentElement.classList.toggle("dark");
          }}
        >
          Toggle Dark Mode
        </button>
      </div>
    </div>
  );
}
