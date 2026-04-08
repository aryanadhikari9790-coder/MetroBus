/**
 * Returns a set of themed class-name strings based on isDark.
 * Use this inside any page/component to get consistent theming.
 */
export function themeTokens(isDark) {
  return {
    // Page background
    page:       isDark ? "bg-[#241043] text-white"            : "bg-[#f7eef4] text-[#27133f]",
    // Sticky nav
    nav:        isDark ? "bg-[#241043]/92 border-white/5"     : "bg-[#fbf3f6]/92 border-[#ecdff0] shadow-[0_12px_28px_rgba(46,18,79,0.08)]",
    // Logo chip
    logoBg:     (color) => color,   // caller passes the role color, unchanged
    // Glass card
    card:       isDark ? "bg-white/6 border-white/10"          : "bg-white border-[#ecdff0] shadow-[0_18px_36px_rgba(46,18,79,0.08)]",
    // Elevated card (hero)
    heroCard:   isDark ? "from-[#2e124f] via-[#4a1e77] to-[#ff6b73] border-white/10"
                       : "from-[#fff6f5] via-white to-[#fbf0f4] border-[#f5d9df]",
    // Inner mini-card inside hero
    heroInner:  isDark ? "bg-white/10 border-white/10"         : "bg-[#fff0ef] border-[#f3d7dd]",
    // Section label
    label:      isDark ? "text-[#bcaed1]"                       : "text-[#8e7aa9]",
    // Body text
    text:       isDark ? "text-white"                           : "text-[#27133f]",
    textSub:    isDark ? "text-[#c4b6d7]"                       : "text-[#6f6284]",
    textMuted:  isDark ? "text-[#8f7fa8]"                       : "text-[#9b8bad]",
    // Input / select
    input:      isDark
      ? "border-white/10 bg-white/5 text-white placeholder-[#8f7fa8] focus:border-[#ff8a5b]"
      : "border-[#ecdff0] bg-white text-[#27133f] placeholder-[#b9abc8] focus:border-[#ff6b73]",
    // Dropdown option background
    optionBg:   isDark ? "bg-[#241043] text-white"             : "bg-white text-[#27133f]",
    // Tab bar container
    tabBar:     isDark ? "bg-white/4 border-white/5"           : "bg-white border-[#ecdff0] shadow-[0_16px_32px_rgba(46,18,79,0.08)]",
    // Inactive tab
    tabInactive:isDark ? "text-[#bcaed1] hover:text-white"     : "text-[#9b8bad] hover:text-[#34155d]",
    // Divider
    divider:    isDark ? "border-white/5"                       : "border-[#ecdff0]",
    // Notification banners
    errBanner:  isDark ? "border-red-500/30 bg-red-500/10 text-red-400"       : "border-red-300 bg-red-50 text-red-700",
    okBanner:   isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-emerald-300 bg-emerald-50 text-emerald-700",
    infoBanner: isDark ? "border-sky-500/30 bg-sky-500/10 text-sky-400"       : "border-sky-300 bg-sky-50 text-sky-700",
    // Timeline dot colours (unchanged, vivid enough for both modes)
    dotDone:    "bg-emerald-500 border-emerald-500",
    dotCurrent: "bg-[#ff6b73] border-[#ff6b73]",
    dotPending: isDark ? "bg-transparent border-slate-600" : "bg-transparent border-slate-300",
    // Timeline line
    timelineLine: isDark ? "bg-slate-700/60" : "bg-slate-200",
    // Toggle track
    toggleOff:  isDark ? "bg-slate-700" : "bg-slate-300",
    // Dropdown open list
    dropList:   isDark ? "border-white/10 bg-[#241043]"        : "border-[#ecdff0] bg-white shadow-xl",
    dropItem:   isDark ? "text-[#f7efff] hover:bg-white/5"     : "text-[#4e3e67] hover:bg-[#fff4f2]",
    dropSel:    isDark ? "bg-white/10 text-white"              : "bg-[#fff0ef] text-[#ff6b73]",
    // Breadcrumb/tag pills
    tagBg:      isDark ? "bg-white/5 border-white/10 text-[#d7c9ea]"  : "bg-[#f7edf4] border-[#ecdff0] text-[#6f6284]",
    // Seat btn states
    seatOpen:   isDark ? "border-white/10 bg-white/5 text-[#f7efff] hover:border-[#ff8a5b]/50 hover:bg-[#ff8a5b]/10"
                       : "border-[#ecdff0] bg-[#fff8f9] text-[#4e3e67] hover:border-[#ff6b73] hover:bg-[#fff0ef]",
    seatSel:    isDark ? "border-[#ff8a5b] bg-[#ff8a5b]/30 text-[#fff1ed]"  : "border-[#ff6b73] bg-[#fff0ef] text-[#9e2f4b]",
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
    indigo:  "bg-[#ff8a5b]/20 text-[#ffd8c9] border-[#ff8a5b]/30",
  };
  const light = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    sky:     "bg-sky-100 text-sky-700 border-sky-200",
    amber:   "bg-amber-100 text-amber-700 border-amber-200",
    red:     "bg-red-100 text-red-700 border-red-200",
    slate:   "bg-slate-100 text-slate-600 border-slate-200",
    indigo:  "bg-[#fff0ef] text-[#ff6b73] border-[#f3d7dd]",
  };
  return (isDark ? dark : light)[color] || (isDark ? dark.slate : light.slate);
}
