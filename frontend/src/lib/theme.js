/**
 * Returns a set of themed class-name strings based on isDark.
 * Use this inside any page/component to get consistent theming.
 */
export function themeTokens(isDark) {
  return {
    // Page background
    page:       isDark ? "bg-[linear-gradient(180deg,#2e124f,#241043)] text-[#fff7fb]" : "bg-[linear-gradient(180deg,#fbf3f6,#f5ebf2)] text-[#27133f]",
    // Sticky nav
    nav:        isDark ? "bg-[rgba(46,18,79,0.94)] border-white/10 shadow-[0_12px_28px_rgba(12,3,29,0.28)]" : "bg-[rgba(252,245,248,0.96)] border-[rgba(52,21,93,0.08)] shadow-[0_12px_28px_rgba(46,18,79,0.08)]",
    // Logo chip
    logoBg:     (color) => color,   // caller passes the role color, unchanged
    // Glass card
    card:       isDark ? "bg-[rgba(64,32,102,0.88)] border-white/10 shadow-[0_18px_34px_rgba(12,3,29,0.24)]" : "bg-[rgba(255,255,255,0.96)] border-[rgba(52,21,93,0.08)] shadow-[0_12px_28px_rgba(46,18,79,0.08)]",
    // Elevated card (hero)
    heroCard:   isDark ? "from-[#34155d] via-[#552681] to-[#ff8a5b] border-white/10"
                       : "from-[#34155d] via-[#552681] to-[#ff8a5b] border-transparent text-white",
    // Inner mini-card inside hero
    heroInner:  isDark ? "bg-white/10 border-white/10"         : "bg-[rgba(255,255,255,0.2)] border-white/20",
    // Section label
    label:      isDark ? "text-[#d6c8e7]"                       : "text-[#8e7aa9]",
    // Body text
    text:       isDark ? "text-[#fff7fb]"                       : "text-[#27133f]",
    textSub:    isDark ? "text-[#d7c5e6]"                       : "text-[#6f6284]",
    textMuted:  isDark ? "text-[#a998bd]"                       : "text-[#9b8bad]",
    // Input / select
    input:      isDark
      ? "border-white/10 bg-white/8 text-[#fff7fb] placeholder-[#a998bd] focus:border-[#ff6b73]"
      : "border-[rgba(52,21,93,0.08)] bg-white text-[#27133f] placeholder-[#b9abc8] focus:border-[#34155d]",
    // Dropdown option background
    optionBg:   isDark ? "bg-[#34155d] text-[#fff7fb]"         : "bg-white text-[#27133f]",
    // Tab bar container
    tabBar:     isDark ? "bg-[rgba(64,32,102,0.72)] border-white/10 shadow-[0_16px_32px_rgba(12,3,29,0.22)]" : "bg-[rgba(255,255,255,0.92)] border-[rgba(52,21,93,0.08)] shadow-[0_10px_24px_rgba(46,18,79,0.08)]",
    // Inactive tab
    tabInactive:isDark ? "text-[#cbb7df] hover:text-white"     : "text-[#9b8bad] hover:text-[#34155d]",
    // Divider
    divider:    isDark ? "border-white/10"                      : "border-[rgba(52,21,93,0.08)]",
    // Notification banners
    errBanner:  isDark ? "border-[#c53b56]/40 bg-[#c53b56]/12 text-[#ffd4dc]" : "border-[#f3bcc7] bg-[#fff4f6] text-[#b12f49]",
    okBanner:   isDark ? "border-[#16a34a]/35 bg-[#16a34a]/10 text-[#c8ffd9]" : "border-[#b6e8c9] bg-[#f4fff7] text-[#127a39]",
    infoBanner: isDark ? "border-[#552681]/40 bg-[#552681]/15 text-[#eadbff]" : "border-[#d8c4ef] bg-[#fbf5ff] text-[#552681]",
    // Timeline dot colours (unchanged, vivid enough for both modes)
    dotDone:    "bg-emerald-500 border-emerald-500",
    dotCurrent: "bg-[#34155d] border-[#34155d]",
    dotPending: isDark ? "bg-transparent border-[#7e69a3]" : "bg-transparent border-[#d4c4de]",
    // Timeline line
    timelineLine: isDark ? "bg-[#7e69a3]/45" : "bg-[#eaddeb]",
    // Toggle track
    toggleOff:  isDark ? "bg-[#6d5a87]" : "bg-[#d9c6df]",
    // Dropdown open list
    dropList:   isDark ? "border-white/10 bg-[#34155d]"        : "border-[rgba(52,21,93,0.08)] bg-white shadow-xl",
    dropItem:   isDark ? "text-[#f7efff] hover:bg-white/8"     : "text-[#4e3e67] hover:bg-[#fbf3f6]",
    dropSel:    isDark ? "bg-white/10 text-white"              : "bg-[#f8f2f6] text-[#34155d]",
    // Breadcrumb/tag pills
    tagBg:      isDark ? "bg-white/6 border-white/10 text-[#e4d6f4]"  : "bg-[#f8f2f6] border-[rgba(52,21,93,0.08)] text-[#6f6284]",
    // Seat btn states
    seatOpen:   isDark ? "border-white/10 bg-white/6 text-[#f7efff] hover:border-[#ff6b73]/50 hover:bg-[#ff6b73]/10"
                       : "border-[rgba(52,21,93,0.08)] bg-[#fff8f9] text-[#4e3e67] hover:border-[#34155d] hover:bg-[#f8f2f6]",
    seatSel:    isDark ? "border-[#ff6b73] bg-[#ff6b73]/25 text-[#fff4f5]"  : "border-[#34155d] bg-[#f8f2f6] text-[#34155d]",
    seatTaken:  isDark ? "border-white/8 bg-white/6 text-[#8f7fa8] opacity-55" : "border-[#e7d8df] bg-[#f3e8ed] text-[#b29eaf] opacity-70",
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
    sky:     "bg-[#552681]/28 text-[#eadbff] border-[#8f68c2]/40",
    amber:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
    red:     "bg-[#c53b56]/20 text-[#ffd6df] border-[#c53b56]/30",
    slate:   "bg-white/10 text-[#d7c5e6] border-white/10",
    indigo:  "bg-[#ff6b73]/22 text-[#fff0f2] border-[#ff6b73]/28",
  };
  const light = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    sky:     "bg-[#f0e6fb] text-[#552681] border-[#dac7ee]",
    amber:   "bg-amber-100 text-amber-700 border-amber-200",
    red:     "bg-[#fff1f4] text-[#b12f49] border-[#f4c6d0]",
    slate:   "bg-slate-100 text-slate-600 border-slate-200",
    indigo:  "bg-[#f8f2f6] text-[#34155d] border-[rgba(52,21,93,0.08)]",
  };
  return (isDark ? dark : light)[color] || (isDark ? dark.slate : light.slate);
}
