import { useState, useEffect, useRef } from "react";

const API_URL = "https://api.anthropic.com/v1/messages";

const exercises = [
  { id: 1, name: "Push-ups", category: "Strength", icon: "💪", sets: 3, reps: 12, calories: 50 },
  { id: 2, name: "Squats", category: "Strength", icon: "🦵", sets: 3, reps: 15, calories: 60 },
  { id: 3, name: "Plank", category: "Core", icon: "🧘", sets: 3, reps: "30s", calories: 30 },
  { id: 4, name: "Jumping Jacks", category: "Cardio", icon: "⚡", sets: 3, reps: 20, calories: 70 },
  { id: 5, name: "Lunges", category: "Strength", icon: "🏃", sets: 3, reps: 12, calories: 55 },
  { id: 6, name: "Burpees", category: "Cardio", icon: "🔥", sets: 3, reps: 10, calories: 80 },
];

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWalkMET(speed) {
  if (speed < 3) return 2.5;
  if (speed < 4) return 3.0;
  if (speed < 5) return 3.5;
  if (speed < 6) return 4.3;
  if (speed < 7) return 5.0;
  return 6.0;
}

function calcWalkCalories(distance, speed, weight = 70) {
  if (!speed || speed === 0) return 0;
  const timeHours = distance / speed;
  const met = getWalkMET(speed);
  return Math.round(met * weight * timeHours);
}

function getSpeedLabel(speed) {
  if (speed < 3) return { label: "Stroll", color: "#3ba7f5" };
  if (speed < 4.5) return { label: "Casual Walk", color: "#5bc47a" };
  if (speed < 5.5) return { label: "Brisk Walk", color: "#e8ff47" };
  if (speed < 7) return { label: "Power Walk", color: "#ff9f3a" };
  return { label: "Race Walk", color: "#ff5252" };
}

export default function FitnessApp() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [completedExercises, setCompletedExercises] = useState([]);
  const [streak, setStreak] = useState(5);
  // status: true=completed, false=missed, "today"=today, null=future
  const [weekProgress, setWeekProgress] = useState([
    { status: true, label: "Mon" },
    { status: true, label: "Tue" },
    { status: false, label: "Wed" },
    { status: true, label: "Thu" },
    { status: true, label: "Fri" },
    { status: "today", label: "Sat" },
    { status: null, label: "Sun" },
  ]);
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { role: "assistant", content: "👋 Hey! I'm your AI fitness coach. Ask me anything about workouts, walking tips, recovery, or get a personalized plan!" }
  ]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [waterIntake, setWaterIntake] = useState(4);

  // Walk tracker
  const [walkActive, setWalkActive] = useState(false);
  const [walkSeconds, setWalkSeconds] = useState(0);
  const [walkDistance, setWalkDistance] = useState(0);
  const [walkSpeed, setWalkSpeed] = useState(0);
  const [walkWeight, setWalkWeight] = useState(70);
  const [walkHistory, setWalkHistory] = useState([
    { id: 1, date: "Mon", distance: 2.4, speed: 4.2, duration: 34, calories: 128 },
    { id: 2, date: "Tue", distance: 3.1, speed: 4.8, duration: 38, calories: 176 },
    { id: 3, date: "Thu", distance: 1.8, speed: 3.9, duration: 27, calories: 95 },
  ]);
  const [manualDist, setManualDist] = useState("");
  const [manualSpeed, setManualSpeed] = useState("");
  const walkIntervalRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const cal = completedExercises.reduce((sum, id) => {
      const ex = exercises.find(e => e.id === id);
      return sum + (ex ? ex.calories : 0);
    }, 0);
    setTotalCalories(cal);
  }, [completedExercises]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  useEffect(() => {
    if (walkActive) {
      walkIntervalRef.current = setInterval(() => {
        setWalkSeconds(s => s + 1);
        if (walkSpeed > 0) {
          setWalkDistance(d => parseFloat((d + walkSpeed / 3600).toFixed(4)));
        }
      }, 1000);
    } else {
      clearInterval(walkIntervalRef.current);
    }
    return () => clearInterval(walkIntervalRef.current);
  }, [walkActive, walkSpeed]);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const stopWalk = () => {
    setWalkActive(false);
    if (walkDistance > 0.01) {
      const entry = {
        id: Date.now(),
        date: "Today",
        distance: parseFloat(walkDistance.toFixed(2)),
        speed: parseFloat(walkSpeed.toFixed(1)),
        duration: Math.round(walkSeconds / 60),
        calories: calcWalkCalories(walkDistance, walkSpeed, walkWeight),
      };
      setWalkHistory(prev => [entry, ...prev]);
    }
    setWalkSeconds(0);
    setWalkDistance(0);
  };

  const logManualWalk = () => {
    const d = parseFloat(manualDist);
    const s = parseFloat(manualSpeed);
    if (!d || !s || d <= 0 || s <= 0) return;
    const entry = {
      id: Date.now(),
      date: "Today",
      distance: d,
      speed: s,
      duration: Math.round((d / s) * 60),
      calories: calcWalkCalories(d, s, walkWeight),
    };
    setWalkHistory(prev => [entry, ...prev]);
    setManualDist("");
    setManualSpeed("");
  };

  const liveWalkCals = calcWalkCalories(walkDistance, walkSpeed, walkWeight);
  const speedInfo = getSpeedLabel(walkSpeed);
  const totalWalkCals = walkHistory.reduce((s, w) => s + w.calories, 0);
  const totalWalkDist = walkHistory.reduce((s, w) => s + w.distance, 0);

  const toggleExercise = (id) => {
    setCompletedExercises(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const sendMessage = async () => {
    if (!userInput.trim()) return;
    const newMsg = { role: "user", content: userInput };
    const updatedHistory = [...chatHistory, newMsg];
    setChatHistory(updatedHistory);
    setUserInput("");
    setAiLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an expert AI fitness coach. The user has completed ${completedExercises.length}/${exercises.length} exercises today, burned ${totalCalories} workout calories, walked ${totalWalkDist.toFixed(1)}km burning ${totalWalkCals} walk calories, and is on a ${streak}-day streak. Give concise, motivating, practical advice. Use emojis. Keep replies to 2-4 sentences max unless a workout plan is requested.`,
          messages: updatedHistory.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      const reply = data.content?.map(b => b.text || "").join("") || "Sorry, couldn't get a response.";
      setChatHistory(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setChatHistory(prev => [...prev, { role: "assistant", content: "⚠️ Connection issue. Please try again!" }]);
    }
    setAiLoading(false);
  };

  const getAiInsight = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `I've completed ${completedExercises.length}/${exercises.length} exercises today, burned ${totalCalories} workout calories, walked ${totalWalkDist.toFixed(1)}km (${totalWalkCals} calories), and I'm on a ${streak}-day streak. Give me a short punchy motivational insight and one specific tip. Max 2 sentences. Use emojis.`
          }]
        })
      });
      const data = await res.json();
      setAiMessage(data.content?.map(b => b.text || "").join("") || "Keep pushing — every step counts! 💪");
    } catch {
      setAiMessage("Stay consistent — your future self will thank you! 🔥");
    }
    setAiLoading(false);
  };

  const completionPct = Math.round((completedExercises.length / exercises.length) * 100);

  const tabStyle = (tab) => ({
    padding: "8px 14px",
    border: "none",
    borderRadius: "30px",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 600,
    fontSize: "13px",
    transition: "all 0.2s",
    background: activeTab === tab ? "#e8ff47" : "transparent",
    color: activeTab === tab ? "#0d0d0d" : "#888",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)",
        borderBottom: "1px solid #222", padding: "20px 24px 0",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#e8ff47" }}>
              ZenFit
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>Wednesday, March 11</div>
          </div>
          <div style={{
            background: "#1a1a1a", border: "1px solid #333", borderRadius: "20px",
            padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px",
          }}>
            <span>🔥</span>
            <span style={{ fontWeight: 700, fontSize: "16px", color: "#e8ff47" }}>{streak}</span>
            <span style={{ fontSize: "12px", color: "#666" }}>day streak</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "0" }}>
          {[["dashboard", "📊 Dashboard"], ["walk", "🚶 Walk"], ["workout", "🏋️ Workout"], ["ai", "🤖 AI Coach"]].map(([tab, label]) => (
            <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px", maxWidth: "480px", margin: "0 auto" }}>

        {/* ── DASHBOARD ── */}
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              background: "linear-gradient(135deg,#1a1a1a,#222)", borderRadius: "20px",
              padding: "24px", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: "20px",
            }}>
              <div style={{ position: "relative", width: "90px", height: "90px", flexShrink: 0 }}>
                <svg width="90" height="90" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="45" cy="45" r="38" fill="none" stroke="#333" strokeWidth="8" />
                  <circle cx="45" cy="45" r="38" fill="none" stroke="#e8ff47" strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 38}`}
                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - completionPct / 100)}`}
                    strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
                </svg>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#e8ff47" }}>{completionPct}%</div>
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>Today's Progress</div>
                <div style={{ color: "#888", fontSize: "13px" }}>{completedExercises.length} of {exercises.length} exercises</div>
                <div style={{ marginTop: "6px", color: "#666", fontSize: "12px" }}>🚶 {totalWalkDist.toFixed(1)} km walked today</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: "Workout Cal", value: totalCalories, unit: "kcal", icon: "🔥", color: "#ff6b35" },
                { label: "Walk Calories", value: totalWalkCals, unit: "kcal", icon: "🚶", color: "#5bc47a" },
                { label: "Total Distance", value: totalWalkDist.toFixed(1), unit: "km", icon: "📍", color: "#3ba7f5" },
                { label: "Water Intake", value: waterIntake, unit: "/ 8 glasses", icon: "💧", color: "#3ba7f5" },
              ].map(s => (
                <div key={s.label} style={{ background: "#1a1a1a", borderRadius: "16px", padding: "18px", border: "1px solid #2a2a2a" }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>{s.icon}</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{s.unit}</div>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#1a1a1a", borderRadius: "16px", padding: "18px", border: "1px solid #2a2a2a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontWeight: 600 }}>💧 Water Intake</span>
                <span style={{ color: "#3ba7f5", fontWeight: 700 }}>{waterIntake}/8</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {Array.from({ length: 8 }, (_, i) => (
                  <button key={i} onClick={() => setWaterIntake(i + 1)} style={{
                    flex: 1, height: "32px", borderRadius: "8px", border: "none", cursor: "pointer",
                    background: i < waterIntake ? "#3ba7f5" : "#2a2a2a", transition: "all 0.2s",
                  }} />
                ))}
              </div>
            </div>

            <div style={{ background: "#1a1a1a", borderRadius: "16px", padding: "18px", border: "1px solid #2a2a2a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontWeight: 600 }}>📅 This Week</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "18px" }}>🔥</span>
                  <span style={{ fontWeight: 800, fontSize: "16px", color: "#e8ff47" }}>{streak}</span>
                  <span style={{ fontSize: "11px", color: "#666" }}>day streak</span>
                  <button onClick={() => setStreak(s => Math.max(0, s - 1))} style={{ background: "#2a2a2a", border: "none", borderRadius: "6px", color: "#888", cursor: "pointer", padding: "2px 7px", fontSize: "14px" }}>−</button>
                  <button onClick={() => setStreak(s => s + 1)} style={{ background: "#2a2a2a", border: "none", borderRadius: "6px", color: "#888", cursor: "pointer", padding: "2px 7px", fontSize: "14px" }}>+</button>
                </div>
              </div>

              {/* Color legend */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                {[
                  { color: "#e8ff47", label: "Completed" },
                  { color: "#3ba7f5", label: "Today" },
                  { color: "#ff5252", label: "Missed" },
                  { color: "#2a2a2a", label: "Upcoming" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: l.color }} />
                    <span style={{ fontSize: "11px", color: "#666" }}>{l.label}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                {weekProgress.map((day, i) => {
                  const bg = day.status === true ? "#e8ff47"
                    : day.status === "today" ? "#3ba7f5"
                      : day.status === false ? "#ff5252"
                        : "#2a2a2a";
                  const icon = day.status === true ? "✓"
                    : day.status === "today" ? "●"
                      : day.status === false ? "✕"
                        : "";
                  const textColor = day.status === true ? "#0d0d0d"
                    : day.status === "today" ? "#fff"
                      : day.status === false ? "#fff"
                        : "#444";
                  return (
                    <div key={day.label} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{
                        width: "100%", aspectRatio: "1", borderRadius: "10px", background: bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: textColor,
                        border: day.status === "today" ? "2px solid #6dc8ff" : "none",
                        boxSizing: "border-box",
                        transition: "all 0.2s",
                      }}>{icon}</div>
                      <div style={{ fontSize: "10px", color: day.status === "today" ? "#3ba7f5" : "#666", fontWeight: day.status === "today" ? 700 : 400 }}>{day.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "linear-gradient(135deg,#1a1f0a,#1a1a1a)", borderRadius: "16px", padding: "18px", border: "1px solid #2d3a10" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontWeight: 600, color: "#e8ff47" }}>🤖 AI Insight</span>
                <button onClick={getAiInsight} disabled={aiLoading} style={{
                  background: "#e8ff47", color: "#0d0d0d", border: "none",
                  borderRadius: "20px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                }}>{aiLoading ? "..." : "Refresh"}</button>
              </div>
              <p style={{ color: "#ccc", fontSize: "14px", lineHeight: "1.5", margin: 0 }}>
                {aiMessage || "Tap Refresh to get your personalized AI fitness insight! 💡"}
              </p>
            </div>
          </div>
        )}

        {/* ── WALK TRACKER ── */}
        {activeTab === "walk" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800 }}>Walk Tracker</div>
              <div style={{ color: "#666", fontSize: "13px" }}>Speed · Distance · Calories</div>
            </div>

            {/* Live card */}
            <div style={{
              background: walkActive ? "linear-gradient(135deg,#0f2a0f,#1a1a1a)" : "linear-gradient(135deg,#1a1a1a,#222)",
              borderRadius: "20px", padding: "24px",
              border: walkActive ? "1px solid #4a8a20" : "1px solid #2a2a2a",
              transition: "all 0.3s",
            }}>
              {/* Timer */}
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{
                  fontFamily: "'Syne', sans-serif", fontSize: "52px", fontWeight: 800,
                  color: walkActive ? "#e8ff47" : "#333", letterSpacing: "2px", transition: "color 0.3s",
                }}>{formatTime(walkSeconds)}</div>
                <div style={{ color: "#666", fontSize: "13px", marginTop: "2px" }}>
                  {walkActive ? "🟢 Walk in progress..." : "Press Start to begin"}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
                {[
                  { label: "Distance", value: walkDistance.toFixed(2), unit: "km", color: "#3ba7f5" },
                  { label: "Speed", value: walkSpeed.toFixed(1), unit: "km/h", color: speedInfo.color },
                  { label: "Calories", value: liveWalkCals, unit: "kcal", color: "#ff6b35" },
                ].map(s => (
                  <div key={s.label} style={{
                    background: "#111", borderRadius: "14px", padding: "14px 8px",
                    textAlign: "center", border: "1px solid #2a2a2a",
                  }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>{s.unit}</div>
                    <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Speed badge */}
              {walkSpeed > 0 && (
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <span style={{
                    background: speedInfo.color + "22", color: speedInfo.color,
                    border: `1px solid ${speedInfo.color}55`,
                    borderRadius: "20px", padding: "5px 16px", fontSize: "13px", fontWeight: 700,
                  }}>{speedInfo.label}</span>
                </div>
              )}

              {/* Speed slider */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#888" }}>Walking Speed</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: speedInfo.color }}>{walkSpeed.toFixed(1)} km/h</span>
                </div>
                <input type="range" min="0" max="10" step="0.1" value={walkSpeed}
                  onChange={e => setWalkSpeed(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#e8ff47", cursor: "pointer" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  <span style={{ fontSize: "10px", color: "#444" }}>0 km/h</span>
                  <span style={{ fontSize: "10px", color: "#444" }}>10 km/h</span>
                </div>
              </div>

              {/* Weight */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <span style={{ fontSize: "13px", color: "#888", flex: 1 }}>Your weight (kg)</span>
                <button onClick={() => setWalkWeight(w => Math.max(40, w - 5))} style={{
                  background: "#2a2a2a", border: "none", borderRadius: "8px",
                  width: "30px", height: "30px", color: "#fff", cursor: "pointer", fontSize: "18px",
                }}>−</button>
                <span style={{ fontWeight: 700, minWidth: "50px", textAlign: "center" }}>{walkWeight} kg</span>
                <button onClick={() => setWalkWeight(w => Math.min(150, w + 5))} style={{
                  background: "#2a2a2a", border: "none", borderRadius: "8px",
                  width: "30px", height: "30px", color: "#fff", cursor: "pointer", fontSize: "18px",
                }}>+</button>
              </div>

              {/* Start/Stop */}
              <div style={{ display: "flex", gap: "10px" }}>
                {!walkActive ? (
                  <button onClick={() => setWalkActive(true)} style={{
                    flex: 1, background: "#e8ff47", color: "#0d0d0d", border: "none",
                    borderRadius: "14px", padding: "16px", fontSize: "16px",
                    fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif",
                  }}>▶ Start Walk</button>
                ) : (
                  <>
                    <button onClick={() => setWalkActive(false)} style={{
                      flex: 1, background: "#2a2a2a", color: "#fff", border: "none",
                      borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer",
                    }}>⏸ Pause</button>
                    <button onClick={stopWalk} style={{
                      flex: 1, background: "#ff5252", color: "#fff", border: "none",
                      borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer",
                    }}>⏹ Save & Stop</button>
                  </>
                )}
              </div>
            </div>

            {/* Manual log */}
            <div style={{ background: "#1a1a1a", borderRadius: "16px", padding: "18px", border: "1px solid #2a2a2a" }}>
              <div style={{ fontWeight: 600, marginBottom: "12px" }}>📝 Log Past Walk</div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>Distance (km)</div>
                  <input value={manualDist} onChange={e => setManualDist(e.target.value)} placeholder="e.g. 2.5"
                    style={{
                      width: "100%", background: "#111", border: "1px solid #333", borderRadius: "10px",
                      padding: "10px 12px", color: "#f0f0f0", fontSize: "14px", outline: "none",
                      fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
                    }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>Speed (km/h)</div>
                  <input value={manualSpeed} onChange={e => setManualSpeed(e.target.value)} placeholder="e.g. 4.5"
                    style={{
                      width: "100%", background: "#111", border: "1px solid #333", borderRadius: "10px",
                      padding: "10px 12px", color: "#f0f0f0", fontSize: "14px", outline: "none",
                      fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
                    }} />
                </div>
              </div>
              {manualDist && manualSpeed && parseFloat(manualDist) > 0 && parseFloat(manualSpeed) > 0 && (
                <div style={{ fontSize: "12px", color: "#5bc47a", marginBottom: "10px" }}>
                  ≈ {calcWalkCalories(parseFloat(manualDist), parseFloat(manualSpeed), walkWeight)} kcal
                  · {Math.round((parseFloat(manualDist) / parseFloat(manualSpeed)) * 60)} min
                </div>
              )}
              <button onClick={logManualWalk} style={{
                width: "100%", background: "#e8ff47", color: "#0d0d0d", border: "none",
                borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer",
              }}>+ Log Walk</button>
            </div>

            {/* History */}
            {walkHistory.length > 0 && (
              <div style={{ background: "#1a1a1a", borderRadius: "16px", padding: "18px", border: "1px solid #2a2a2a" }}>
                <div style={{ fontWeight: 600, marginBottom: "12px" }}>🏅 Walk History</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {walkHistory.map(w => (
                    <div key={w.id} style={{
                      background: "#111", borderRadius: "12px", padding: "14px",
                      display: "flex", alignItems: "center", gap: "12px", border: "1px solid #222",
                    }}>
                      <div style={{
                        width: "44px", height: "44px", background: "#1a2a0a",
                        borderRadius: "12px", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: "20px", flexShrink: 0,
                      }}>🚶</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{w.date} · {w.distance} km</div>
                        <div style={{ color: "#666", fontSize: "12px", marginTop: "2px" }}>
                          {w.speed} km/h · {w.duration} min · {getSpeedLabel(w.speed).label}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#ff6b35", fontWeight: 700, fontSize: "15px" }}>{w.calories}</div>
                        <div style={{ color: "#666", fontSize: "11px" }}>kcal</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: "14px", background: "#0f1f0f", borderRadius: "12px",
                  padding: "14px", display: "flex", justifyContent: "space-around",
                  border: "1px solid #2a3a1a",
                }}>
                  {[
                    { label: "Total Dist", value: totalWalkDist.toFixed(1) + " km", color: "#3ba7f5" },
                    { label: "Total Cals", value: totalWalkCals + " kcal", color: "#ff6b35" },
                    { label: "Sessions", value: walkHistory.length, color: "#e8ff47" },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 800, fontSize: "16px", color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WORKOUT ── */}
        {activeTab === "workout" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800 }}>Today's Workout</div>
                <div style={{ color: "#666", fontSize: "13px" }}>Full Body · Beginner Friendly</div>
              </div>
              <div style={{
                background: "#e8ff47", color: "#0d0d0d", borderRadius: "20px",
                padding: "6px 14px", fontSize: "13px", fontWeight: 700,
              }}>{completedExercises.length}/{exercises.length}</div>
            </div>
            {exercises.map(ex => {
              const done = completedExercises.includes(ex.id);
              return (
                <button key={ex.id} onClick={() => toggleExercise(ex.id)} style={{
                  background: done ? "linear-gradient(135deg,#1a2a0a,#1f2e0f)" : "#1a1a1a",
                  border: done ? "1px solid #4a6a20" : "1px solid #2a2a2a",
                  borderRadius: "16px", padding: "18px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "14px",
                  textAlign: "left", transition: "all 0.2s", width: "100%",
                }}>
                  <div style={{
                    width: "50px", height: "50px", background: done ? "#e8ff47" : "#2a2a2a",
                    borderRadius: "14px", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "24px", flexShrink: 0, transition: "all 0.2s",
                  }}>{done ? "✓" : ex.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: done ? "#e8ff47" : "#f0f0f0" }}>{ex.name}</div>
                    <div style={{ color: "#666", fontSize: "12px", marginTop: "2px" }}>{ex.sets} sets × {ex.reps}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#ff6b35", fontWeight: 700, fontSize: "14px" }}>~{ex.calories}</div>
                    <div style={{ color: "#666", fontSize: "11px" }}>kcal</div>
                  </div>
                </button>
              );
            })}
            {completedExercises.length === exercises.length && (
              <div style={{
                background: "linear-gradient(135deg,#1a3a0a,#1f2e0f)", border: "1px solid #4a8a20",
                borderRadius: "16px", padding: "20px", textAlign: "center",
              }}>
                <div style={{ fontSize: "40px", marginBottom: "8px" }}>🎉</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#e8ff47" }}>Workout Complete!</div>
                <div style={{ color: "#aaa", fontSize: "13px", marginTop: "4px" }}>You crushed it! {totalCalories} kcal burned.</div>
              </div>
            )}
          </div>
        )}

        {/* ── AI COACH ── */}
        {activeTab === "ai" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800 }}>🤖 AI Fitness Coach</div>
              <div style={{ color: "#666", fontSize: "13px" }}>Powered by Claude AI</div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {["Give me a warm-up routine", "Best walking pace to burn fat?", "Post-workout meals?"].map(p => (
                <button key={p} onClick={() => setUserInput(p)} style={{
                  background: "#1a1a1a", border: "1px solid #333", borderRadius: "20px",
                  padding: "6px 12px", fontSize: "12px", color: "#aaa", cursor: "pointer", whiteSpace: "nowrap",
                }}>{p}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
              {chatHistory.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "85%", padding: "12px 16px",
                    borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: msg.role === "user" ? "#e8ff47" : "#1a1a1a",
                    color: msg.role === "user" ? "#0d0d0d" : "#f0f0f0",
                    fontSize: "14px", lineHeight: "1.5",
                    border: msg.role === "assistant" ? "1px solid #2a2a2a" : "none",
                  }}>{msg.content}</div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{
                    padding: "12px 16px", borderRadius: "18px 18px 18px 4px",
                    background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#666", fontSize: "14px",
                  }}>Thinking... ⏳</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <input value={userInput} onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Ask your AI coach..."
                style={{
                  flex: 1, background: "#1a1a1a", border: "1px solid #333", borderRadius: "14px",
                  padding: "14px 16px", color: "#f0f0f0", fontSize: "14px", outline: "none",
                  fontFamily: "'DM Sans', sans-serif",
                }} />
              <button onClick={sendMessage} disabled={aiLoading || !userInput.trim()} style={{
                background: "#e8ff47", border: "none", borderRadius: "14px",
                padding: "14px 18px", fontSize: "18px", cursor: "pointer",
                fontWeight: 700, opacity: !userInput.trim() ? 0.5 : 1,
              }}>→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
