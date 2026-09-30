import { HEALTH_TIPS, PET_NAME, QUESTIONS, RESULT_BANDS, STORAGE_KEY, ZONES } from "./data.js";

const emptyAnswers = () => Object.fromEntries(QUESTIONS.map((q) => [q.id, null]));
const emptyTasks = () =>
  Object.fromEntries(QUESTIONS.map((q) => [q.id, { completed: false, completedAt: null }]));

function uid() {
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function inviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function todayLabel(iso = new Date().toISOString()) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function blankInspection() {
  return { answers: emptyAnswers(), tasks: emptyTasks(), previous: null };
}

function blankState() {
  return {
    ...blankInspection(),
    groups: [],
    activeGroupId: null,
    activeMemberId: null,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("home-fall-map-v2");
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    return {
      ...blankState(),
      answers: { ...emptyAnswers(), ...parsed.answers },
      tasks: { ...emptyTasks(), ...parsed.tasks },
      previous: parsed.previous ?? null,
      groups: parsed.groups ?? [],
      activeGroupId: parsed.activeGroupId ?? null,
      activeMemberId: parsed.activeMemberId ?? null,
    };
  } catch {
    return blankState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function zoneById(id) {
  return ZONES.find((z) => z.id === id);
}

function zoneQuestions(zoneId) {
  return QUESTIONS.filter((q) => q.zoneId === zoneId);
}

function zoneStatus(answers, zoneId) {
  const values = zoneQuestions(zoneId).map((q) => answers[q.id]);
  if (values.every((v) => v == null)) return "empty";
  if (values.some((v) => v == null)) return "partial";
  if (values.some((v) => v === "yes")) return "yes";
  if (values.some((v) => v === "unk")) return "unk";
  return "no";
}

function stamped(answers, zoneId) {
  return zoneQuestions(zoneId).every((q) => answers[q.id] != null);
}

function stampCount(answers) {
  return ZONES.filter((z) => stamped(answers, z.id)).length;
}

function statusLabel(status) {
  if (status === "yes") return "우선 개선";
  if (status === "unk") return "확인 필요";
  if (status === "partial") return "탐험 중";
  if (status === "no") return "도장 완료";
  return "아직 안 함";
}

function pointsOf(answer) {
  if (answer === "yes") return 2;
  if (answer === "unk") return 1;
  return 0;
}

function scoreOf(answers) {
  return QUESTIONS.reduce((sum, q) => sum + pointsOf(answers[q.id]), 0);
}

function riskCount(answers) {
  return QUESTIONS.filter((q) => answers[q.id] === "yes").length;
}

function allAnswered(answers) {
  return QUESTIONS.every((q) => answers[q.id] != null);
}

function yesItems(answers) {
  return QUESTIONS.filter((q) => answers[q.id] === "yes").sort(
    (a, b) => Number(b.urgent) - Number(a.urgent)
  );
}

function unkItems(answers) {
  return QUESTIONS.filter((q) => answers[q.id] === "unk");
}

function openItems(answers) {
  return QUESTIONS.filter((q) => answers[q.id] == null);
}

function bandFor(answers) {
  const yes = riskCount(answers);
  const unknown = unkItems(answers).length + openItems(answers).length;
  const urgent = yesItems(answers).some((q) => q.urgent);
  if (yes === 0 && unknown === 0) return RESULT_BANDS[0];
  if (yes >= 6 || urgent) return RESULT_BANDS[3];
  if (yes >= 3) return RESULT_BANDS[2];
  return RESULT_BANDS[1];
}

function applyAnswer(state, questionId, value) {
  const answers = { ...state.answers, [questionId]: value };
  const tasks = { ...state.tasks };
  if (value === "yes") {
    tasks[questionId] = tasks[questionId] ?? { completed: false, completedAt: null };
  } else {
    tasks[questionId] = { completed: false, completedAt: null };
  }
  return { ...state, answers, tasks };
}

function stopSpeech() {
  window.speechSynthesis?.cancel();
}

function speak(text) {
  stopSpeech();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ko-KR";
  window.speechSynthesis.speak(utter);
}

function burstStars(event) {
  navigator.vibrate?.(12);
  const x = event.clientX;
  const y = event.clientY;
  for (let i = 0; i < 7; i += 1) {
    const star = document.createElement("span");
    star.className = "star-pop";
    star.textContent = i % 2 ? "★" : "✦";
    const angle = (Math.PI * 2 * i) / 7;
    star.style.left = `${x}px`;
    star.style.top = `${y}px`;
    star.style.setProperty("--dx", `${Math.cos(angle) * (28 + Math.random() * 36)}px`);
    star.style.setProperty("--dy", `${Math.sin(angle) * (28 + Math.random() * 36) - 12}px`);
    document.body.appendChild(star);
    window.setTimeout(() => star.remove(), 680);
  }
}

function petSvg() {
  return `
    <span class="pet-wrap">
      <img class="pet-svg house-fairy" src="${import.meta.env.BASE_URL}house-fairy.png?v=4" alt="" />
      <span class="pet-ground" aria-hidden="true"></span>
    </span>
  `;
}

function petRow(text) {
  return `
    <div class="pet-row">
      ${petSvg()}
      <p class="bubble"><strong>${PET_NAME}</strong>${text}</p>
    </div>
  `;
}

function isTaskDone(tasks, questionId) {
  return Boolean(tasks?.[questionId]?.completed);
}

function resultShareText(name, answers, tasks) {
  const band = bandFor(answers);
  const risks = yesItems(answers);
  const remaining = risks.filter((q) => !isTaskDone(tasks, q.id));
  const completed = risks.filter((q) => isTaskDone(tasks, q.id));
  const remainingTop = remaining.slice(0, 3);
  const rest = remaining.slice(3);
  const lines = [
    `[우리집 낙상지도] ${name} 점검 결과`,
    `공유 시각 ${todayLabel()} ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`,
    band.title,
    `환경 개선 우선도 ${scoreOf(answers)}점 · 위험항목 ${risks.length}개 중 ${completed.length}개 개선 완료 · 남은 할 일 ${remaining.length}개 · 확인 필요 ${unkItems(answers).length}개`,
    "",
    "아직 남은 개선",
    ...(remainingTop.length
      ? remainingTop.map((q, i) => `${i + 1}. [${zoneById(q.zoneId).name}] ${q.finding} → ${q.action} (미완료)`)
      : ["남은 미완료 항목이 없습니다."]),
    ...(rest.length
      ? ["", "나머지 미완료", ...rest.map((q) => `- [${zoneById(q.zoneId).name}] ${q.finding} (미완료)`)]
      : []),
    ...(completed.length
      ? [
          "",
          "개선 완료",
          ...completed.map(
            (q) =>
              `- [${zoneById(q.zoneId).name}] ${q.finding} · ${todayLabel(tasks[q.id].completedAt)} 완료`
          ),
        ]
      : []),
    "",
    "의학적 진단이나 낙상 예측이 아닙니다. 최근 낙상·어지럼·보행 문제가 있으면 전문가와 상담하세요.",
  ];
  return lines.join("\n");
}

async function shareText(title, text) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return "ok";
    }
  } catch (error) {
    if (error?.name === "AbortError") return "cancel";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copy";
  } catch {
    window.prompt("아래 내용을 복사해 공유하세요.", text);
    return "prompt";
  }
}

function pickTip() {
  return HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)];
}

function pickTips(count, excludeTitles = []) {
  const pool = HEALTH_TIPS.filter((tip) => !excludeTitles.includes(tip.title));
  const source = pool.length >= count ? pool : HEALTH_TIPS;
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function createApp(root) {
  let screen = sessionStorage.getItem("fall-map-splashed") ? "start" : "splash";
  let state = loadState();
  let activeZone = null;
  let questionIndex = 0;
  let celebrateZone = null;
  let healthTip = pickTip();
  let newsTips = pickTips(2);
  let toast = "";
  let questionZoomed = false;

  function showToast(message) {
    toast = message;
    root.querySelector(".toast")?.remove();
    document.querySelectorAll(".toast").forEach((el) => el.remove());
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);
    window.setTimeout(() => {
      el.remove();
      if (toast === message) toast = "";
    }, 1800);
  }

  function activeGroup() {
    return state.groups.find((g) => g.id === state.activeGroupId) ?? null;
  }

  function activeMember() {
    const group = activeGroup();
    if (!group) return null;
    return group.members.find((m) => m.id === state.activeMemberId) ?? null;
  }

  function persist(next) {
    const group = next.groups.find((g) => g.id === next.activeGroupId);
    const member = group?.members.find((m) => m.id === next.activeMemberId);
    if (member) {
      member.answers = next.answers;
      member.tasks = next.tasks;
      member.previous = next.previous;
      member.updatedAt = new Date().toISOString();
    }
    state = next;
    saveState(state);
  }

  function openZone(zoneId) {
    activeZone = zoneId;
    const qs = zoneQuestions(zoneId);
    const firstOpen = qs.findIndex((q) => state.answers[q.id] == null);
    questionIndex = firstOpen === -1 ? 0 : firstOpen;
    screen = "mission";
    render();
  }

  function beginChecklist() {
    healthTip = pickTip();
    screen = "health";
    render();
  }

  function closeHealth() {
    screen = "map";
    render();
  }

  function startQuestions() {
    questionZoomed = false;
    screen = "question";
    render();
  }

  function prevQuestion() {
    stopSpeech();
    questionZoomed = false;
    if (questionIndex > 0) {
      questionIndex -= 1;
      screen = "question";
      render();
      return;
    }
    screen = "mission";
    render();
  }

  function answer(value) {
    stopSpeech();
    questionZoomed = false;
    const qs = zoneQuestions(activeZone);
    const current = qs[questionIndex];
    persist(applyAnswer(state, current.id, value));
    if (questionIndex < qs.length - 1) {
      questionIndex += 1;
      render();
      return;
    }
    celebrateZone = activeZone;
    screen = "stamp";
    render();
  }

  function finishStamp() {
    screen = "map";
    activeZone = null;
    celebrateZone = null;
    render();
  }

  function toggleTask(id) {
    const current = state.tasks[id] ?? { completed: false, completedAt: null };
    const completed = !current.completed;
    persist({
      ...state,
      tasks: {
        ...state.tasks,
        [id]: {
          completed,
          completedAt: completed ? new Date().toISOString() : null,
        },
      },
    });
    render();
  }

  function newInspection() {
    if (!confirm("지금 점검을 저장하고 처음부터 다시 탐험할까요?")) return;
    persist({
      ...state,
      answers: emptyAnswers(),
      tasks: state.tasks,
      previous: {
        riskCount: riskCount(state.answers),
        unknownCount: unkItems(state.answers).length,
        score: scoreOf(state.answers),
        finishedAt: new Date().toISOString(),
      },
    });
    screen = "map";
    render();
  }

  function hardReset() {
    if (!confirm("이 점검 답만 지울까요? 모임은 그대로 둡니다.")) return;
    persist({ ...state, ...blankInspection() });
    screen = "map";
    render();
  }

  function createGroup() {
    const name = root.querySelector("[data-group-name]")?.value.trim();
    const leader = root.querySelector("[data-leader-name]")?.value.trim();
    if (!name || !leader) {
      showToast("모임 이름과 모임장 이름을 적어 주세요.");
      return;
    }
    const leaderMember = {
      id: uid(),
      name: leader,
      role: "leader",
      answers: { ...state.answers },
      tasks: { ...state.tasks },
      previous: state.previous,
      updatedAt: new Date().toISOString(),
    };
    const group = {
      id: uid(),
      name,
      code: inviteCode(),
      members: [leaderMember],
    };
    persist({
      ...state,
      groups: [...state.groups, group],
      activeGroupId: group.id,
      activeMemberId: leaderMember.id,
    });
    render();
    showToast("모임을 만들었어요.");
  }

  function addMember() {
    const group = activeGroup();
    if (!group) return;
    const name = root.querySelector("[data-member-name]")?.value.trim();
    if (!name) {
      showToast("참여자 이름을 적어 주세요.");
      return;
    }
    const member = {
      id: uid(),
      name,
      role: "member",
      ...blankInspection(),
      updatedAt: null,
    };
    const groups = state.groups.map((item) =>
      item.id === group.id ? { ...item, members: [...item.members, member] } : item
    );
    persist({ ...state, groups });
    render();
    showToast(`${name} 님을 추가했어요.`);
  }

  function removeMember(memberId) {
    const group = activeGroup();
    const member = group?.members.find((item) => item.id === memberId);
    if (!member) return;
    if (member.role === "leader") {
      showToast("모임장은 지울 수 없어요.");
      return;
    }
    if (!confirm(`${member.name} 님을 모임에서 지울까요?`)) return;
    const leftover = group.members.filter((item) => item.id !== memberId);
    const groups = state.groups.map((item) =>
      item.id === group.id ? { ...item, members: leftover } : item
    );
    const switching = state.activeMemberId === memberId;
    const nextMember = switching ? leftover.find((item) => item.role === "leader") ?? leftover[0] : null;
    persist({
      ...state,
      groups,
      activeMemberId: switching ? nextMember?.id ?? null : state.activeMemberId,
      ...(switching && nextMember
        ? {
            answers: { ...emptyAnswers(), ...nextMember.answers },
            tasks: { ...emptyTasks(), ...nextMember.tasks },
            previous: nextMember.previous ?? null,
          }
        : {}),
    });
    render();
    showToast(`${member.name} 님을 지웠어요.`);
  }

  function selectMember(memberId) {
    const group = activeGroup();
    const member = group?.members.find((item) => item.id === memberId);
    if (!member) return;
    persist({
      ...state,
      activeMemberId: memberId,
      answers: { ...emptyAnswers(), ...member.answers },
      tasks: { ...emptyTasks(), ...member.tasks },
      previous: member.previous ?? null,
    });
    screen = "map";
    render();
  }

  function openGroup(groupId) {
    const group = state.groups.find((item) => item.id === groupId);
    if (!group) return;
    persist({ ...state, activeGroupId: groupId, activeMemberId: group.members[0]?.id ?? null });
    const member = group.members[0];
    if (member) {
      persist({
        ...state,
        activeGroupId: groupId,
        activeMemberId: member.id,
        answers: { ...emptyAnswers(), ...member.answers },
        tasks: { ...emptyTasks(), ...member.tasks },
        previous: member.previous ?? null,
      });
    }
    screen = "group";
    render();
  }

  function joinGroup() {
    const code = root.querySelector("[data-join-code]")?.value.trim().toUpperCase();
    const name = root.querySelector("[data-join-name]")?.value.trim();
    if (!code || !name) {
      showToast("모임 코드와 내 이름을 적어 주세요.");
      return;
    }
    const found = state.groups.find((item) => item.code === code);
    if (!found) {
      showToast("이 휴대폰에 없는 코드예요. 모임장이 먼저 모임을 만들거나, 공유받은 결과를 가져오세요.");
      return;
    }
    if (found.members.some((item) => item.name === name)) {
      persist({ ...state, activeGroupId: found.id });
      showToast("이미 있는 이름이에요. 그 모임으로 이동했어요.");
      screen = "group";
      render();
      return;
    }
    const member = {
      id: uid(),
      name,
      role: "member",
      ...blankInspection(),
      updatedAt: null,
    };
    const groups = state.groups.map((item) =>
      item.id === found.id ? { ...item, members: [...item.members, member] } : item
    );
    persist({
      ...state,
      groups,
      activeGroupId: found.id,
      activeMemberId: member.id,
      ...blankInspection(),
    });
    showToast("모임에 참여했어요.");
    screen = "group";
    render();
  }

  async function shareCurrentResult() {
    const member = activeMember();
    const name = member?.name ?? "우리 집";
    const text = resultShareText(name, state.answers, state.tasks);
    const left = yesItems(state.answers).filter((q) => !isTaskDone(state.tasks, q.id)).length;
    const done = yesItems(state.answers).filter((q) => isTaskDone(state.tasks, q.id)).length;
    const result = await shareText(`우리집 낙상지도 · 남은 일 ${left}개 · 완료 ${done}개`, text);
    if (result === "copy") showToast("결과를 복사했어요. 카카오톡에 붙여 보내세요.");
  }

  async function shareGroupSummary() {
    const group = activeGroup();
    if (!group) return;
    const rows = group.members.map((member) => {
      const answers = member.answers ?? emptyAnswers();
      const tasks = member.tasks ?? emptyTasks();
      const done = allAnswered(answers);
      const risks = yesItems(answers);
      const finished = risks.filter((q) => isTaskDone(tasks, q.id)).length;
      const left = risks.length - finished;
      return `- ${member.name}${member.role === "leader" ? "(모임장)" : ""}: ${
        done ? `위험 ${risks.length}개 · 완료 ${finished}개 · 남은 일 ${left}개` : "아직 점검 전"
      }`;
    });
    const text = [
      `[우리집 낙상지도] ${group.name}`,
      `공유 시각 ${todayLabel()} ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`,
      `모임 코드 ${group.code}`,
      `참여자 ${group.members.length}명`,
      "",
      ...rows,
      "",
      "의학적 진단이 아닙니다. 같은 휴대폰에서 대상자를 바꿔가며 점검할 수 있어요.",
    ].join("\n");
    const result = await shareText(`${group.name} 모임 결과`, text);
    if (result === "copy") showToast("모임 결과를 복사했어요.");
  }

  async function shareMemberResult(memberId) {
    const group = activeGroup();
    const member = group?.members.find((item) => item.id === memberId);
    if (!member) return;
    const result = await shareText(
      `${member.name} 점검 결과`,
      resultShareText(member.name, member.answers ?? emptyAnswers(), member.tasks ?? emptyTasks())
    );
    if (result === "copy") showToast("복사했어요. 가족이나 복지사에게 보내세요.");
  }

  function tabbar(active) {
    return `
      <nav class="tabbar" aria-label="하단 메뉴">
        <button class="${active === "map" || active === "result" || active === "tasks" ? "on" : ""}" data-go="map">탐험</button>
        <button class="${active === "news" || active === "health" ? "on" : ""}" data-go="news">소식</button>
        <button class="${active === "group" ? "on" : ""}" data-go="group">모임</button>
      </nav>
    `;
  }

  function whoLine() {
    const member = activeMember();
    const group = activeGroup();
    if (!member || !group) return "";
    return `<p class="who">지금 점검: ${esc(group.name)} · ${esc(member.name)}${member.role === "leader" ? " 모임장" : ""}</p>`;
  }

  function render() {
    const views = {
      splash: splashView,
      start: startView,
      health: healthView,
      map: mapView,
      mission: missionView,
      question: questionView,
      stamp: stampView,
      result: resultView,
      tasks: taskView,
      group: groupView,
      news: newsView,
    };
    const tabScreens = new Set(["map", "news", "group", "result", "tasks"]);
    const view = (views[screen] ?? startView)();
    root.innerHTML = `
      <div class="shell">
        ${view}
        ${tabScreens.has(screen) ? tabbar(screen) : ""}
      </div>
    `;
    bind();
    if (screen === "splash") {
      sessionStorage.setItem("fall-map-splashed", "1");
      window.setTimeout(() => {
        if (screen === "splash") {
          screen = "start";
          render();
        }
      }, 1700);
    }
  }

  function splashView() {
    return `
      <main class="phone splash">
        <p class="kicker light">HOME SAFETY PROJECT</p>
        ${petSvg()}
        <h1>우리집<br />낙상지도</h1>
        <p class="splash-sub">집 안 안전 탐험을 준비하고 있어요</p>
        <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
      </main>
    `;
  }

  function startView() {
    const stamps = stampCount(state.answers);
    return `
      <main class="phone">
        <div class="blob"></div>
        <p class="kicker">HOME SAFETY PROJECT</p>
        <h1>우리집<br />낙상지도</h1>
        <div class="rule"></div>
        <p class="lead">넘어지기 쉬운 곳을<br />우리 집 지도에서 먼저 찾아요.</p>
        <section class="card">
          <h2>우리 집 평면도</h2>
          <p class="hint">구역을 선택해 점검을 시작해 보세요</p>
          <div class="floorplan" aria-hidden="true">
            <div class="cell bedroom">침실</div>
            <div class="cell bath">화장실</div>
            <div class="cell living">거실</div>
            <div class="cell hall"><span class="pin"></span>현관</div>
            <div class="cell kitchen">부엌</div>
          </div>
          <div class="steps">
            <span><b>1</b>공간 선택</span>
            <span><b>2</b>질문에 답하기</span>
            <span><b>3</b>먼저 고칠 곳 확인</span>
          </div>
        </section>
        ${petRow("답하면 위험요인을 찾아 고칠 일을 자동으로 적어 둘게요. 방마다 도장도 모아요!")}
        ${stamps ? `<p class="resume">이어서 탐험 중 · 도장 ${stamps}/6</p>` : ""}
        <button class="cta" data-begin>${stamps ? "이어서 탐험하기" : "우리 집 안전 점검 시작하기"}</button>
        <p class="fineprint">주거환경 점검 안내용 시제품 · 의학적 진단이나 낙상 예측 도구가 아닙니다</p>
      </main>
    `;
  }

  function healthCard(tip, closer) {
    return `
      <article class="news-card big">
        <span class="news-tag">${esc(tip.tag)}</span>
        <h2>${esc(tip.title)}</h2>
        <p>${esc(tip.body)}</p>
        <p class="news-source">${esc(tip.source)}</p>
        ${closer}
      </article>
    `;
  }

  function healthView() {
    return `
      <main class="phone">
        <p class="kicker">오늘의 안전 소식</p>
        <h1 class="news-title">잠깐, 알고 가면 좋아요</h1>
        ${healthCard(
          healthTip,
          `<button class="cta" data-close-health>닫고 점검 시작하기</button>`
        )}
        <p class="fineprint">진단이 아니라 집 안을 살필 때 참고용입니다.</p>
      </main>
    `;
  }

  function newsView() {
    return `
      <main class="phone has-nav">
        <div class="topbar">
          <button class="icon-btn" data-go="map" aria-label="탐험으로">←</button>
        </div>
        <p class="kicker">안전 소식</p>
        <h1 class="news-title">낙상 예방 한 줄 뉴스</h1>
        <button class="cta ghost refresh-bar" data-refresh-news>
          <span class="spin-icon" aria-hidden="true">↻</span>
          새로고침
        </button>
        ${newsTips.map((tip) => healthCard(tip, "")).join("")}
      </main>
    `;
  }

  function zoneCell(id, extraClass) {
    const zone = zoneById(id);
    const status = zoneStatus(state.answers, id);
    const done = stamped(state.answers, id);
    return `
      <button class="cell ${extraClass} status-${status}" data-zone="${id}">
        ${id === "entrance" ? '<span class="pin"></span>' : ""}
        ${id === "path" ? "침실 → 화장실 길" : zone.name}
        <span class="sub">${done ? "도장 완료" : statusLabel(status)}</span>
        ${done ? `<span class="stamp-mark" aria-hidden="true">${zone.emoji}</span>` : ""}
      </button>
    `;
  }

  function comparisonBanner() {
    if (!state.previous) return "";
    const now = riskCount(state.answers);
    return `
      <div class="compare">
        지난 점검 위험항목 ${state.previous.riskCount}개 → 지금 ${now}개
      </div>
    `;
  }

  function mapView() {
    const done = allAnswered(state.answers);
    const stamps = stampCount(state.answers);
    return `
      <main class="phone has-nav">
        <div class="topbar">
          <button class="icon-btn" data-go="start" aria-label="뒤로">←</button>
          <div class="stamp-meter">도장 ${stamps}/6</div>
          <button class="icon-btn" data-hard-reset aria-label="초기화">↺</button>
        </div>
        <div class="title-block">
          <h1>우리 집 탐험</h1>
        </div>
        ${whoLine()}
        ${petRow("확인하고 싶은 우리집 공간을 꾹 눌러주세요!")}
        ${comparisonBanner()}
        <div class="floorplan live">
          ${zoneCell("bedroom", "bedroom")}
          ${zoneCell("bath", "bath")}
          ${zoneCell("living", "living")}
          ${zoneCell("entrance", "hall")}
          ${zoneCell("kitchen", "kitchen")}
          ${zoneCell("path", "path-cell")}
        </div>
        <div class="stamp-board">
          ${ZONES.map((zone) => {
            const got = stamped(state.answers, zone.id);
            return `<div class="stamp-chip ${got ? "on" : ""}">
              <span class="stamp-face" aria-hidden="true">${zone.emoji}</span>
              <span class="stamp-name">${zone.stamp}</span>
            </div>`;
          }).join("")}
        </div>
        <div class="legend">
          <span><i class="swatch" style="background:#c45c4a"></i>우선 개선</span>
          <span><i class="swatch" style="background:#d4a017"></i>확인 필요</span>
          <span><i class="swatch" style="background:#3d7a5a"></i>문제 없음</span>
        </div>
        <button class="cta ghost" data-go="tasks">개선할 일 보기</button>
        <button class="cta" data-go="result" ${done ? "" : "disabled"} style="${done ? "" : "opacity:.45"}">
          결과 확인하기
        </button>
      </main>
    `;
  }

  function missionView() {
    const zone = zoneById(activeZone);
    const qs = zoneQuestions(activeZone);
    return `
      <main class="phone">
        <div class="topbar">
          <button class="icon-btn" data-go="map" aria-label="평면도">✕</button>
        </div>
        ${petRow(zone.pet)}
        <section class="mission-card">
          <p class="mission-kicker">방별 미션</p>
          <h1>${zone.mission}</h1>
          <p>질문 ${qs.length}개에 답하면 <strong>${zone.stamp}</strong>을 받아요.</p>
          <p class="mission-note">예는 문제가 있다는 뜻, 아니요는 지금 괜찮다는 뜻이에요. 답하면 고칠 일이 자동으로 저장됩니다.</p>
        </section>
        <button class="cta" data-start-questions>미션 시작</button>
      </main>
    `;
  }

  function questionView() {
    const zone = zoneById(activeZone);
    const qs = zoneQuestions(activeZone);
    const q = qs[questionIndex];
    const saved = state.answers[q.id];
    return `
      <main class="phone question-phone">
        <div class="question-head">
          <div class="topbar">
            <button class="icon-btn" data-prev-question aria-label="이전">←</button>
            <button class="icon-btn" data-go="map" aria-label="평면도">✕</button>
          </div>
          <p class="progress">${zone.mission} · ${questionIndex + 1} / ${qs.length}</p>
          <button class="speak" data-speak>소리로 질문 듣기</button>
        </div>
        <div class="question-stage">
          <div class="question-block">
            <p class="question">${q.text}</p>
            <button class="q-zoom" data-zoom-question aria-label="질문 크게 보기">🔍</button>
          </div>
        </div>
        <div class="answers dock">
          <button class="back-q" data-prev-question>${questionIndex > 0 ? "이전 질문" : "미션 안내로"}</button>
          <button class="yes ${saved === "yes" ? "picked" : ""}" data-answer="yes">예 · 위험 발견</button>
          <button class="no ${saved === "no" ? "picked" : ""}" data-answer="no">아니요 · 괜찮아요</button>
          <button class="unk ${saved === "unk" ? "picked" : ""}" data-answer="unk">잘 모르겠어요</button>
          <p class="fineprint dock-note">예: 개선할 일에 저장 · 잘 모르겠어요: 가족과 확인할 목록</p>
        </div>
        ${
          questionZoomed
            ? `<div class="q-zoom-layer">
                <button class="icon-btn q-zoom-close" data-close-zoom aria-label="닫기">✕</button>
                <p class="q-zoom-text">${q.text}</p>
              </div>`
            : ""
        }
      </main>
    `;
  }

  function stampView() {
    const zone = zoneById(celebrateZone);
    const found = zoneQuestions(celebrateZone).filter((q) => state.answers[q.id] === "yes").length;
    const unknown = zoneQuestions(celebrateZone).filter((q) => state.answers[q.id] === "unk").length;
    const line =
      found > 0
        ? `${zone.name}에서 위험요인 ${found}개를 찾았어요. 고칠 일을 저장해 두었어요.`
        : unknown
          ? `${zone.name}에서 확인이 필요한 항목이 있어요. 가족과 함께 보면 좋아요.`
          : `${zone.name}은 지금 확인된 위험요인이 없어요.`;
    return `
      <main class="phone stamp-screen">
        <div class="stamp-burst">${zone.emoji}</div>
        <h1>${zone.stamp} 획득!</h1>
        ${petRow(line)}
        <button class="cta" data-finish-stamp>지도로 돌아가기</button>
      </main>
    `;
  }

  function taskCard(q, kind) {
    const zone = zoneById(q.zoneId);
    const task = state.tasks[q.id];
    const done = Boolean(task?.completed);
    if (kind === "yes") {
      return `
        <article class="item ${done ? "done" : ""}">
          <span class="tag">${zone.name}${q.urgent ? " · 바로 손보기" : ""}${done ? " · 완료" : " · 미완료"}</span>
          <h3>${q.finding}</h3>
          <p>${q.action}</p>
          <button class="task-btn" data-task="${q.id}">
            ${done ? `완료됨 · ${todayLabel(task.completedAt)}` : "개선 완료"}
          </button>
        </article>
      `;
    }
    return `
      <article class="item">
        <span class="tag warn">${zone.name} · 가족과 확인</span>
        <h3>${q.text}</h3>
        <p>직접 다시 보고 답을 바꿔 주세요. 복지사와 함께 확인해도 좋아요.</p>
      </article>
    `;
  }

  function resultView() {
    const score = scoreOf(state.answers);
    const band = bandFor(state.answers);
    const risks = yesItems(state.answers);
    const actions = risks.filter((q) => !state.tasks[q.id]?.completed).slice(0, 3);
    const rest = risks.filter((q) => !actions.includes(q));
    const unknowns = unkItems(state.answers);
    const mini = ZONES.map((zone) => {
      const status = zoneStatus(state.answers, zone.id);
      return `<div class="mini status-${status}">${zone.shortName ?? zone.name}<small>${stamped(state.answers, zone.id) ? "도장" : statusLabel(status)}</small></div>`;
    }).join("");

    return `
      <main class="phone has-nav">
        <div class="topbar">
          <button class="icon-btn" data-go="map" aria-label="평면도">←</button>
        </div>
        ${whoLine()}
        <section class="result-head">
          <h1>${band.title}</h1>
          <p>${band.body}</p>
          <p class="score-note">환경 개선 우선도 ${score}점 · 예 2점, 잘 모르겠어요 1점, 아니요 0점. 시제품용 임시 분류이며 임상 기준이 아닙니다.</p>
        </section>
        ${comparisonBanner()}
        ${petRow("답변에서 찾은 위험요인과 고칠 일을 모아 두었어요. 끝난 일은 개선 완료를 눌러 주세요.")}
        <p class="section-label">우리 집 지도</p>
        <div class="mini-map">${mini}</div>
        <p class="section-label">먼저 개선할 항목</p>
        <div class="list">${
          actions.length
            ? actions.map((q) => taskCard(q, "yes")).join("")
            : `<article class="item"><h3>지금 바로 고칠 미완료 항목은 없습니다</h3><p>모르는 항목만 다시 한번 살펴보면 됩니다.</p></article>`
        }</div>
        ${rest.length ? `<p class="section-label">나머지 확인된 항목</p><div class="list">${rest.map((q) => taskCard(q, "yes")).join("")}</div>` : ""}
        ${unknowns.length ? `<p class="section-label">가족·복지사와 확인할 목록</p><div class="list">${unknowns.map((q) => taskCard(q, "unk")).join("")}</div>` : ""}
        <p class="fineprint">최근 낙상, 어지럼, 보행 문제가 있다면 전문가와 상담하세요. 이 앱은 진단이나 낙상 예측 도구가 아닙니다.</p>
        <button class="cta" data-share-result>결과 공유하기</button>
        <button class="cta ghost" data-go="map">평면도 다시 보기</button>
        <button class="cta ghost" data-new-inspection>다음 점검 시작</button>
      </main>
    `;
  }

  function taskView() {
    const risks = yesItems(state.answers);
    const unknowns = unkItems(state.answers);
    return `
      <main class="phone has-nav">
        <div class="topbar">
          <button class="icon-btn" data-go="map" aria-label="뒤로">←</button>
        </div>
        <h1>개선할 일</h1>
        ${whoLine()}
        ${petRow("예라고 답한 항목은 자동으로 여기 저장돼요. 끝나면 개선 완료를 눌러 주세요.")}
        ${comparisonBanner()}
        <p class="section-label">우선 개선 목록</p>
        <div class="list">${
          risks.length ? risks.map((q) => taskCard(q, "yes")).join("") : `<article class="item"><p>아직 저장된 위험요인이 없어요.</p></article>`
        }</div>
        <p class="section-label">가족·복지사와 확인할 목록</p>
        <div class="list">${
          unknowns.length ? unknowns.map((q) => taskCard(q, "unk")).join("") : `<article class="item"><p>확인할 항목이 없어요.</p></article>`
        }</div>
        <button class="cta" data-share-result>이 목록 공유하기</button>
      </main>
    `;
  }

  function groupView() {
    const group = activeGroup();
    if (!group) {
      return `
        <main class="phone has-nav">
          <h1>모임</h1>
          ${petRow("복지사가 모임을 만들고, 대상자 이름을 추가한 뒤 한 명씩 점검을 진행하면 돼요.")}
          <div class="list group-forms">
          <section class="item">
            <h3>새 모임 만들기</h3>
            <p>모임장은 복지사, 참여자는 점검 대상자예요.</p>
            <label class="field"><span>모임 이름</span><input data-group-name placeholder="예: 행복복지관 화요반" autocomplete="name" /></label>
            <label class="field"><span>모임장 이름</span><input data-leader-name placeholder="예: 집요정" autocomplete="name" /></label>
            <button class="cta" data-create-group>모임 만들기</button>
          </section>
          <section class="item">
            <h3>코드로 참여</h3>
            <label class="field"><span>모임 코드</span><input data-join-code placeholder="예: 7K2P" maxlength="8" autocapitalize="characters" /></label>
            <label class="field"><span>내 이름</span><input data-join-name placeholder="예: 집요정" autocomplete="name" /></label>
            <button class="cta ghost" data-join-group>참여하기</button>
          </section>
          </div>
          ${
            state.groups.length
              ? `<p class="section-label">내 모임</p>${state.groups
                  .map(
                    (item) => `
                <button class="zone wide" data-open-group="${item.id}">
                  <div class="name">${esc(item.name)}</div>
                  <div class="status group-code-line">코드 ${item.code} · ${item.members.length}명</div>
                </button>`
                  )
                  .join("")}`
              : ""
          }
          <p class="fineprint">시제품은 같은 휴대폰에서 대상자를 바꿔가며 씁니다. 주소·생년월일은 받지 않아요. 결과는 카카오톡으로 공유할 수 있습니다.</p>
        </main>
      `;
    }

    return `
      <main class="phone has-nav">
        <div class="topbar">
          <button class="icon-btn" data-leave-group aria-label="모임 목록">←</button>
        </div>
        <p class="group-code">모임 코드 ${esc(group.code)}</p>
        <h1>${esc(group.name)}</h1>
        ${petRow("참여자를 먼저 추가하고, 아래 쌓인 이름 중에서 점검할 사람을 고르면 돼요.")}
        <section class="item">
          <h3>참여자 추가</h3>
          <p>모임장 아래에 참가자가 차례로 쌓여요.</p>
          <label class="field"><span>이름만 적어요</span><input data-member-name type="text" enterkeyhint="done" autocomplete="name" placeholder="예: 집요정" /></label>
          <button class="cta" data-add-member>추가하기</button>
        </section>
        <p class="section-label">참가자 ${group.members.length}명</p>
        <div class="list">
          ${group.members
            .map((member) => {
              const answers = member.answers ?? emptyAnswers();
              const done = allAnswered(answers);
              const risks = riskCount(answers);
              const selected = member.id === state.activeMemberId;
              return `
                <article class="item member-card ${selected ? "selected" : ""}">
                  <span class="tag">${member.role === "leader" ? "모임장" : "참여자"}${selected ? " · 지금 점검" : ""}</span>
                  <h3>${esc(member.name)} 참가자</h3>
                  <p>${done ? `점검 완료 · 위험항목 ${risks}개 · 우선도 ${scoreOf(answers)}점` : `아직 점검 전 · 도장 ${stampCount(answers)}/6`}</p>
                  <div class="row-btns">
                    <button class="task-btn" data-select-member="${member.id}">이 사람으로 점검</button>
                    <button class="task-btn ghost" data-share-member="${member.id}">결과 공유</button>
                    ${
                      member.role === "leader"
                        ? ""
                        : `<button class="task-btn danger" data-remove-member="${member.id}">지우기</button>`
                    }
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
        <button class="cta ghost" data-share-group>모임 전체 결과 공유</button>
      </main>
    `;
  }

  function bind() {
    root.querySelectorAll("button").forEach((el) => {
      el.addEventListener("click", burstStars);
    });
    root.querySelectorAll("[data-go]").forEach((el) => {
      el.addEventListener("click", () => {
        stopSpeech();
        questionZoomed = false;
        screen = el.getAttribute("data-go");
        render();
      });
    });
    root.querySelectorAll("[data-zone]").forEach((el) => {
      el.addEventListener("click", () => openZone(el.getAttribute("data-zone")));
    });
    root.querySelectorAll("[data-answer]").forEach((el) => {
      el.addEventListener("click", () => answer(el.getAttribute("data-answer")));
    });
    root.querySelector("[data-begin]")?.addEventListener("click", beginChecklist);
    root.querySelector("[data-close-health]")?.addEventListener("click", closeHealth);
    root.querySelector("[data-refresh-news]")?.addEventListener("click", (event) => {
      const btn = event.currentTarget;
      btn.classList.remove("spinning");
      void btn.offsetWidth;
      btn.classList.add("spinning");
      newsTips = pickTips(2, newsTips.map((tip) => tip.title));
      window.setTimeout(() => render(), 420);
    });
    root.querySelector("[data-start-questions]")?.addEventListener("click", startQuestions);
    root.querySelector("[data-finish-stamp]")?.addEventListener("click", finishStamp);
    root.querySelectorAll("[data-prev-question]").forEach((el) => {
      el.addEventListener("click", prevQuestion);
    });
    root.querySelector("[data-speak]")?.addEventListener("click", () => {
      const qs = zoneQuestions(activeZone);
      speak(qs[questionIndex].text);
    });
    root.querySelector("[data-zoom-question]")?.addEventListener("click", () => {
      questionZoomed = true;
      render();
    });
    root.querySelector("[data-close-zoom]")?.addEventListener("click", () => {
      questionZoomed = false;
      render();
    });
    root.querySelectorAll("[data-task]").forEach((el) => {
      el.addEventListener("click", () => toggleTask(el.getAttribute("data-task")));
    });
    root.querySelector("[data-new-inspection]")?.addEventListener("click", newInspection);
    root.querySelector("[data-hard-reset]")?.addEventListener("click", hardReset);
    root.querySelector("[data-share-result]")?.addEventListener("click", () => {
      shareCurrentResult();
    });
    root.querySelector("[data-create-group]")?.addEventListener("click", createGroup);
    root.querySelector("[data-join-group]")?.addEventListener("click", joinGroup);
    root.querySelector("[data-add-member]")?.addEventListener("click", addMember);
    root.querySelector("[data-share-group]")?.addEventListener("click", () => {
      shareGroupSummary();
    });
    root.querySelector("[data-leave-group]")?.addEventListener("click", () => {
      persist({ ...state, activeGroupId: null, activeMemberId: null });
      render();
    });
    root.querySelectorAll("[data-open-group]").forEach((el) => {
      el.addEventListener("click", () => openGroup(el.getAttribute("data-open-group")));
    });
    root.querySelectorAll("[data-select-member]").forEach((el) => {
      el.addEventListener("click", () => selectMember(el.getAttribute("data-select-member")));
    });
    root.querySelectorAll("[data-share-member]").forEach((el) => {
      el.addEventListener("click", () => shareMemberResult(el.getAttribute("data-share-member")));
    });
    root.querySelectorAll("[data-remove-member]").forEach((el) => {
      el.addEventListener("click", () => removeMember(el.getAttribute("data-remove-member")));
    });
  }

  render();
}
