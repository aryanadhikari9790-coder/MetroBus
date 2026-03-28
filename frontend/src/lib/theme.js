/**
 * Returns a set of themed class-name strings based on isDark.
 * Use this inside any page/component to get consistent theming.
 */
export function themeTokens(isDark) {
  return {
    // Page background
    page:       isDark ? "bg-[#0a0e1a] text-white"            : "bg-[#f0f4f8] text-slate-900",
    // Sticky nav
    nav:        isDark ? "bg-[#0a0e1a]/90 border-white/5"     : "bg-[#f0f4f8]/92 border-slate-200 shadow-sm",
    // Logo chip
    logoBg:     (color) => color,   // caller passes the role color, unchanged
    // Glass card
    card:       isDark ? "bg-white/5 border-white/10"          : "bg-white border-slate-200 shadow-sm",
    // Elevated card (hero)
    heroCard:   isDark ? "from-indigo-900 via-[#0d1a4a] to-[#0a0e1a] border-indigo-700/30"
                       : "from-indigo-50 via-white to-[#f0f4f8] border-indigo-200",
    // Inner mini-card inside hero
    heroInner:  isDark ? "bg-white/5 border-white/10"          : "bg-indigo-50 border-indigo-200",
    // Section label
    label:      isDark ? "text-slate-500"                       : "text-slate-400",
    // Body text
    text:       isDark ? "text-white"                           : "text-slate-900",
    textSub:    isDark ? "text-slate-400"                       : "text-slate-500",
    textMuted:  isDark ? "text-slate-600"                       : "text-slate-400",
    // Input / select
    input:      isDark
      ? "border-white/10 bg-white/5 text-white placeholder-slate-600 focus:border-indigo-500"
      : "border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-indigo-400",
    // Dropdown option background
    optionBg:   isDark ? "bg-slate-900 text-white"             : "bg-white text-slate-900",
    // Tab bar container
    tabBar:     isDark ? "bg-white/3 border-white/5"           : "bg-white border-slate-200 shadow-sm",
    // Inactive tab
    tabInactive:isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-700",
    // Divider
    divider:    isDark ? "border-white/5"                       : "border-slate-200",
    // Notification banners
    errBanner:  isDark ? "border-red-500/30 bg-red-500/10 text-red-400"       : "border-red-300 bg-red-50 text-red-700",
    okBanner:   isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-emerald-300 bg-emerald-50 text-emerald-700",
    infoBanner: isDark ? "border-sky-500/30 bg-sky-500/10 text-sky-400"       : "border-sky-300 bg-sky-50 text-sky-700",
    // Timeline dot colours (unchanged, vivid enough for both modes)
    dotDone:    "bg-emerald-500 border-emerald-500",
    dotCurrent: "bg-indigo-400 border-indigo-400",
    dotPending: isDark ? "bg-transparent border-slate-600" : "bg-transparent border-slate-300",
    // Timeline line
    timelineLine: isDark ? "bg-slate-700/60" : "bg-slate-200",
    // Toggle track
    toggleOff:  isDark ? "bg-slate-700" : "bg-slate-300",
    // Dropdown open list
    dropList:   isDark ? "border-white/10 bg-[#111827]"        : "border-slate-200 bg-white shadow-xl",
    dropItem:   isDark ? "text-slate-300 hover:bg-white/5"     : "text-slate-700 hover:bg-slate-50",
    dropSel:    isDark ? "bg-white/10 text-white"              : "bg-indigo-50 text-indigo-800",
    // Breadcrumb/tag pills
    tagBg:      isDark ? "bg-white/5 border-white/10 text-slate-400"  : "bg-slate-100 border-slate-200 text-slate-600",
    // Seat btn states
    seatOpen:   isDark ? "border-white/10 bg-white/5 text-slate-300 hover:border-indigo-400/50 hover:bg-indigo-500/10"
                       : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50",
    seatSel:    isDark ? "border-indigo-400 bg-indigo-500/30 text-indigo-200"  : "border-indigo-500 bg-indigo-100 text-indigo-800",
    seatTaken:  isDark ? "border-white/5 bg-white/5 text-slate-600 opacity-50" : "border-slate-200 bg-slate-100 text-slate-400 opacity-60",
    // Map tile URL
    mapTile:    isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  };
}

/**
 * Returns themed Pill color strings for named semantic states.
 */
export function pillColor(isDark, color) {
  const dark = {
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    sky:     "bg-sky-500/20 text-sky-300 border-sky-500/30",
    amber:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
    red:     "bg-red-500/20 text-red-300 border-red-500/30",
    slate:   "bg-slate-500/20 text-slate-300 border-slate-500/30",
    indigo:  "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  };
  const light = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    sky:     "bg-sky-100 text-sky-700 border-sky-200",
    amber:   "bg-amber-100 text-amber-700 border-amber-200",
    red:     "bg-red-100 text-red-700 border-red-200",
    slate:   "bg-slate-100 text-slate-600 border-slate-200",
    indigo:  "bg-indigo-100 text-indigo-700 border-indigo-200",
  };
  return (isDark ? dark : light)[color] || (isDark ? dark.slate : light.slate);
}
