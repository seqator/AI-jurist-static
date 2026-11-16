(function () {
  "use strict";

  const KB = window.STATIC_KB;
  const SOURCES = window.STATIC_SOURCES;
  if (!KB || !SOURCES) {
    console.error("Static KB is not loaded");
    return;
  }

  const STOP = new Set(("и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между пожалуйста скажите подскажите расскажите хочу хотел хотела хотелось могу можете нужно надо давайте здравствуйте привет добрый день вечер утро спасибо").split(" "));

  const GROUPS = {
    "долг": "долг долги долгов долга задолженность задолженности кредит кредиты кредита займ заем займы ссуда мфо кредитка кредитный",
    "списать": "списать списание спишут списывают простить аннулировать освободить освобождение",
    "жилье": "жилье жильё квартира квартиру квартиры квартирой дом дома недвижимость жилой",
    "машина": "машина машину машины авто автомобиль автомобиля транспорт",
    "деньги": "деньги стоимость цена стоит стоить расходы платеж платежи оплата госпошлина тариф",
    "суд": "суд суда суде судебное судебный арбитраж арбитражный иск",
    "мфц": "мфц внесудебное внесудебный внесудебного многофункциональный",
    "работа": "работа работаю работает трудоустройство официально неофициально",
    "коллекторы": "коллекторы коллектор звонки звонят взыскание приставы",
    "последствия": "последствия ограничения запрет запреты"
  };

  function stemKey(word) {
    return word.length <= 4 ? word : word.slice(0, 5);
  }

  const CONCEPT = new Map();
  Object.entries(GROUPS).forEach(([canon, words]) => {
    words.split(" ").forEach((word) => CONCEPT.set(stemKey(word), canon));
  });

  function normalize(text) {
    return String(text || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function tokens(text) {
    return normalize(text).split(" ").filter((t) => t && !STOP.has(t));
  }

  function conceptKey(token) {
    return CONCEPT.get(stemKey(token)) || stemKey(token);
  }

  const UNITS = { ноль: 0, один: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19 };
  const TENS = { двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90 };
  const HUNDREDS = { сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900 };
  const SCALES = { тысяча: 1000, тысячи: 1000, тысяч: 1000, миллион: 1000000, миллиона: 1000000, миллионов: 1000000 };

  function replaceNumberWords(text) {
    let low = String(text || "").toLowerCase().replace(/ё/g, "е");
    low = low.replace(/полтора миллиона/g, "1500000").replace(/полмиллиона/g, "500000").replace(/полторы тысячи/g, "1500");
    const matches = Array.from(low.matchAll(/[а-я]+/g));
    let out = "";
    let last = 0;
    let i = 0;
    while (i < matches.length) {
      let j = i;
      let total = 0;
      let current = 0;
      let consumed = false;
      while (j < matches.length) {
        const word = matches[j][0];
        if (word in UNITS) current += UNITS[word];
        else if (word in TENS) current += TENS[word];
        else if (word in HUNDREDS) current += HUNDREDS[word];
        else if (word in SCALES) {
          if (current === 0 && total === 0) break;
          total += current * SCALES[word];
          current = 0;
        } else break;
        consumed = true;
        j += 1;
      }
      if (consumed && total + current > 0) {
        out += low.slice(last, matches[i].index) + String(total + current);
        last = matches[j - 1].index + matches[j - 1][0].length;
        i = j;
      } else {
        i += 1;
      }
    }
    return out + low.slice(last);
  }

  function fmtMoney(value) {
    if (value >= 1000000) {
      const s = (value / 1000000).toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
      return `${s} млн ₽`;
    }
    if (value >= 1000) return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₽`;
    return `${Math.round(value)} ₽`;
  }

  function parseAmounts(text) {
    const t = String(text || "").toLowerCase().replace(/ё/g, "е").replace(/\u00a0/g, " ");
    const re = /(\d{1,3}(?:[ \u00a0]\d{3})+|\d+(?:[.,]\d+)?)\s*(млн|миллион[а-я]*|тыс[а-я]*|тысяч[а-я]*|к|руб[а-я]*|р|₽)?/gi;
    const out = [];
    let m;
    while ((m = re.exec(t)) !== null) {
      let value = Number(m[1].replace(/[ \u00a0]/g, "").replace(",", "."));
      const unit = (m[2] || "").toLowerCase();
      if (unit.startsWith("млн") || unit.startsWith("миллион")) value *= 1000000;
      else if (unit.startsWith("тыс") || unit === "к") value *= 1000;
      if (!unit && value >= 1900 && value <= 2100) continue;
      out.push({ value, start: m.index, end: m.index + m[0].length });
    }
    return out;
  }

  function near(text, pos, words, windowSize = 48) {
    const frag = normalize(text.slice(Math.max(0, pos - windowSize), pos + windowSize));
    return words.some((w) => frag.includes(w));
  }

  function moneyPhrase(text, amounts) {
    if (!amounts.length) return { text: "", min: null, max: null };
    const vals = amounts.map((a) => a.value);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const t = normalize(text);
    const hasRange = /–/.test(text) || /\d\s*-\s*\d/.test(text);
    if (vals.length >= 2 && (((t.includes("от ") || t.includes("с ")) && t.includes(" до ")) || hasRange)) {
      return { text: `${fmtMoney(lo)} – ${fmtMoney(hi)}`, min: lo, max: hi };
    }
    if (t.includes("до ") && !t.includes("от ")) return { text: `До ${fmtMoney(hi)}`, min: 0, max: hi };
    if (t.includes("больше") || t.includes("свыше")) return { text: `Больше ${fmtMoney(lo)}`, min: lo, max: null };
    if (t.includes("меньше")) return { text: `Меньше ${fmtMoney(lo)}`, min: 0, max: lo };
    return { text: fmtMoney(vals[vals.length - 1]), min: vals[vals.length - 1], max: vals[vals.length - 1] };
  }

  function parseOverdue(text) {
    const t = normalize(replaceNumberWords(text));
    if (t.includes("полгода")) return { text: "Около 6 месяцев", months: 6 };
    if (t.includes("больше года") || t.includes("более года")) return { text: "Больше года", months: 12 };
    const rng = t.match(/(\d+)\s*[–-]\s*(\d+)\s*(мес[а-я]*|месяц[а-я]*)/);
    if (rng) return { text: `${rng[1]}–${rng[2]} мес.`, months: Number(rng[1]) };
    const m = t.match(/(\d+(?:[.,]\d+)?)\s*(мес[а-я]*|месяц[а-я]*|год[а-я]*|лет)/);
    if (!m) return null;
    let val = Number(m[1].replace(",", "."));
    if (m[2].startsWith("год") || m[2] === "лет") val *= 12;
    const prefix = t.slice(Math.max(0, m.index - 12), m.index);
    if (prefix.includes("больше") || prefix.includes("более")) return { text: `Больше ${Math.round(val)} мес.`, months: val + 1 };
    if (prefix.includes("меньше") || prefix.includes("менее")) return { text: `Меньше ${Math.round(val)} мес.`, months: Math.max(0, val - 1) };
    return { text: `${Math.round(val)} мес.`, months: val };
  }

  function parseIncome(text, amounts, allowAny) {
    const t = normalize(text);
    if (["нет дохода", "не работаю", "безработ", "нет заработка", "дохода нет"].some((x) => t.includes(x))) {
      return { text: "Нет дохода", value: 0, employment: "не работает" };
    }
    let employment = null;
    if (/официально|официальная|белая зарплата/.test(t)) employment = "официально";
    else if (/неофициально|не официально|серая/.test(t)) employment = "неофициально";
    else if (t.includes("пенси")) employment = "пенсия";
    else if (t.includes("пособи")) employment = "пособие";
    let money = amounts.filter((a) => near(text, a.start, ["доход", "зарплат", "получа", "пенси", "пособи", "заработ", "оклад"]));
    if (!money.length && allowAny && amounts.length) money = [amounts[amounts.length - 1]];
    if (money.length) {
      const val = money[money.length - 1].value;
      return { text: `${fmtMoney(val)} в месяц`, value: val, employment };
    }
    if (employment) {
      const labels = { официально: "Официальная работа", неофициально: "Неофициальный доход", пенсия: "Пенсия", пособие: "Пособие" };
      return { text: labels[employment], value: null, employment };
    }
    return null;
  }

  function parseProperty(text) {
    const t = normalize(text);
    if (["имущества нет", "нет имущества", "ничего нет", "только долги", "нет ничего"].some((x) => t.includes(x))) return "Нет имущества";
    if (t.includes("только единственное жилье")) return "Только единственное жильё";
    const parts = [];
    if (t.includes("ипотек")) parts.push("ипотека");
    if (/квартир|жиль|\bдом\b/.test(t)) parts.push("жильё");
    if (/машин|авто|транспорт/.test(t)) parts.push("автомобиль");
    if (/дача|земл|гараж/.test(t)) parts.push("участок/дача");
    if (t.includes("доля")) parts.push("доля");
    if (parts.length) return "Есть " + [...new Set(parts)].join(", ");
    if (/имуществ/.test(t) && /\bнет\b/.test(t)) return "Нет имущества";
    return null;
  }

  function parseGoal(text) {
    const t = normalize(text);
    if (/списать|избавиться|закрыть долг|простить/.test(t)) return "Списать долги";
    if (/звон|коллектор|достали|угроз/.test(t)) return "Остановить звонки";
    if (/платеж|не хватает|нечем|снизить/.test(t)) return "Снизить платежи";
    if (/узнать|подходит|интересно|разобраться/.test(t)) return "Разобраться";
    return null;
  }

  function extractSlots(text, pending) {
    const t = normalize(text);
    const parseText = replaceNumberWords(text);
    const amounts = parseAmounts(parseText);
    const out = {};
    const debtWords = ["долг", "задолж", "кредит", "займ", "заем", "мфо", "банк", "плачу", "не плачу"];
    const incomeWords = ["доход", "зарплат", "получа", "пенси", "пособи", "заработ", "оклад", "работаю", "работа", "официально", "неофициально"];
    const hasDebt = ["долг", "задолж", "кредит", "займ", "заем", "мфо"].some((w) => t.includes(w));
    const hasIncome = ["зарплат", "доход", "получа", "пенси", "пособи", "работаю", "официально", "неофициально", "оклад"].some((w) => t.includes(w));
    let reclassified = false;
    if (pending === "debt" && !hasDebt && hasIncome) {
      pending = "income";
      reclassified = true;
    }
    const amountIsTime = (a) => /^(мес|год|лет|дн|недел)/.test(normalize(parseText.slice(a.end, a.end + 18)));
    const debtAmounts = amounts.filter((a) => !near(parseText, a.start, ["доход", "зарплат", "получа", "пенси", "пособи", "заработ", "оклад"]) && !amountIsTime(a));
    if ((pending === "debt" || debtWords.some((w) => t.includes(w))) && !reclassified && debtAmounts.length) {
      const mp = moneyPhrase(parseText, debtAmounts);
      out.debt = mp.text;
      out.debtMin = mp.min;
      out.debtMax = mp.max;
    }
    if (pending === "overdue" || ["просроч", "не плач", "не внос", "задерж"].some((w) => t.includes(w))) {
      const ov = parseOverdue(text);
      if (ov) {
        out.overdue = ov.text;
        out.overdueMonths = ov.months;
      }
    }
    if (pending === "income" || incomeWords.some((w) => t.includes(w))) {
      const inc = parseIncome(parseText, amounts, pending === "income");
      if (inc) {
        out.income = inc.text;
        out.incomeValue = inc.value;
        if (inc.employment) out.employment = inc.employment;
      }
    }
    if (pending === "property" || /квартир|жиль|\bдом\b|машин|авто|ипотек|имуществ|дача|земл|гараж|доля/.test(t)) {
      const prop = parseProperty(text);
      if (prop) out.property = prop;
    }
    if (pending === "goal" || /списать|избавиться|звон|коллектор|платеж|нечем|узнать|подходит/.test(t)) {
      const goal = parseGoal(text);
      if (goal) out.goal = goal;
    }
    if (pending === "property" && !out.property) {
      if (/\bнет\b/.test(t)) out.property = "Нет имущества";
      else if (t === "да" || t === "есть") out.property = "Есть имущество";
    }
    return out;
  }

  // Поиск по базе
  const entries = KB.entries.map((entry) => {
    const text = [entry.title, ...(entry.patterns || []), ...(entry.keywords || []), ...(entry.tags || [])].join(" ");
    const keys = new Map();
    tokens(text).forEach((tok) => {
      const key = conceptKey(tok);
      keys.set(key, (keys.get(key) || 0) + 1);
    });
    return { data: entry, keys };
  });

  function retrieve(query) {
    const qTokens = tokens(query);
    if (!qTokens.length) return { entry: null, score: 0 };
    const qKeys = new Map();
    qTokens.forEach((tok) => {
      const key = conceptKey(tok);
      qKeys.set(key, (qKeys.get(key) || 0) + 1);
    });
    const qNorm = normalize(query);
    let best = null;
    let bestScore = 0;
    entries.forEach(({ data, keys }) => {
      let overlap = 0;
      qKeys.forEach((count, key) => {
        if (keys.has(key)) overlap += count * Math.min(keys.get(key), 3);
      });
      let score = overlap / Math.sqrt(qKeys.size * Math.max(keys.size, 1));
      (data.patterns || []).some((pattern) => {
        const p = normalize(pattern);
        if (p.length >= 4 && (qNorm.includes(p) || (qNorm.length >= 6 && p.includes(qNorm)))) {
          score += 0.3;
          return true;
        }
        return false;
      });
      if ((data.keywords || []).some((kw) => qNorm.includes(normalize(kw)))) score += 0.08;
      if (score > bestScore) {
        bestScore = score;
        best = data;
      }
    });
    return { entry: best, score: Math.min(1, bestScore) };
  }

  const INTAKE = KB.intake;
  const SLOTS = Object.fromEntries(INTAKE.slots.map((s) => [s.id, s]));
  const CORE = INTAKE.core_slots;

  function progress(session) {
    return Math.round((CORE.filter((id) => session.slots[id]).length / CORE.length) * 100);
  }

  function sourcePayload(ids) {
    return (ids || []).map((id) => SOURCES.sources.find((s) => s.id === id)).filter((s) => s && s.kind !== "company").map((s) => ({ id: s.id, title: s.title, url: s.url, note: s.note || "", kind: s.kind }));
  }

  function response(session, reply, options = {}) {
    return {
      reply,
      speech: options.speech || reply,
      sources: options.sources || (options.entry ? sourcePayload(options.entry.sources) : []),
      slots: session.slots,
      progress: progress(session),
      quick_replies: options.quick || [],
      stage: options.stage || "answer",
      action: options.action || null,
      confidence: options.confidence == null ? 1 : options.confidence,
      grounded: options.grounded !== false,
      agent: KB.agent.name,
      session_id: session.id,
      demo: true
    };
  }

  function nextSlot(session) {
    for (const id of CORE) if (!session.slots[id] && !session.asked.includes(id)) return SLOTS[id];
    for (const id of CORE) if (!session.slots[id]) return SLOTS[id];
    return null;
  }

  function ask(session, slot, prefix) {
    if (!slot) return summary(session);
    session.asked = [...new Set([...session.asked, slot.id])];
    session.pending = slot.id;
    return response(session, (prefix ? prefix + "\n\n" : "") + slot.question, { quick: slot.quick, stage: "intake", speech: slot.question });
  }

  function slotDisplay(key, value) {
    let text = String(value).replace(/\.$/, "");
    if (key === "property" && text.toLowerCase().startsWith("есть ")) text = text.slice(5);
    return text;
  }

  function ack(newSlots) {
    const labels = { debt: "долг", overdue: "просрочка", income: "доход", property: "имущество", goal: "цель" };
    const parts = [];
    ["debt", "overdue", "income", "property", "goal"].forEach((key) => {
      if (newSlots[key]) parts.push(`${labels[key]} ${slotDisplay(key, newSlots[key])}`);
    });
    return parts.length ? "Спасибо, записала: " + parts.join(", ") + "." : "";
  }

  function summary(session) {
    const s = session.slots;
    const lines = ["Спасибо, теперь мне понятна ваша ситуация.", "Смотрите, что получается:", `• Долг: ${s.debt || "не указан"}`, `• Просрочка: ${s.overdue || "не указана"}`, `• Доход: ${s.income || "не указан"}`, `• Имущество: ${s.property ? slotDisplay("property", s.property) : "не указано"}`];
    if (s.goal) lines.push(`• Беспокоит: ${s.goal}`);
    const debtMin = session.facts.debtMin;
    const debtMax = session.facts.debtMax;
    const prop = s.property || "";
    const recoverable = !!prop && prop !== "Нет имущества" && prop !== "Только единственное жильё";
    let route;
    if (debtMin != null && debtMax != null && debtMax <= 1000000 && debtMin >= 25000 && !recoverable) {
      route = "По сумме и имуществу может подойти внесудебное банкротство через МФЦ, если есть одно из оснований: оконченное исполнительное производство, пенсия или участие в СВО, пособие на ребёнка либо исполнительный документ старше 7 лет.";
    } else if (debtMin != null && debtMin >= 500000 && (session.facts.overdueMonths || 0) >= 3) {
      route = "По сумме и просрочке предварительно может подойти судебное банкротство. Но нужно проверить имущество, сделки за 3 года и состав долгов. Окончательно скажет юрист.";
    } else {
      route = "Однозначно сказать нельзя: возможны судебное банкротство или другая стратегия. Нужна проверка документов, имущества и сделок.";
    }
    lines.push("", route, "", "Это предварительно. Точнее скажет юрист после проверки документов. Давайте запишу вас на бесплатную консультацию?");
    session.summarySent = true;
    session.pending = null;
    return response(session, lines.join("\n"), {
      quick: [
        { label: "Записаться на консультацию", value: "Хочу записаться на консультацию" },
        { label: "Уточнить про МФЦ", value: "Расскажите подробнее про МФЦ" },
        { label: "Что будет с имуществом?", value: "Что будет с имуществом?" },
        { label: "Изменить данные", value: "Хочу изменить данные о ситуации" }
      ],
      stage: "summary",
      action: "lead",
      sources: sourcePayload(["S03", "S04", "S10"]),
      speech: "Предварительно: я зафиксировала долг, просрочку, доход и имущество. " + route + " Это не юридическое заключение. Лучше обсудить документы с юристом на бесплатной консультации."
    });
  }

  function unknown(session) {
    session.stage = "unknown";
    return response(session, KB.guardrails.unknown, {
      quick: [
        { label: "Записаться на консультацию", value: "Хочу записаться на консультацию" },
        { label: "Спросить другое", value: "У меня другой вопрос" }
      ],
      stage: "unknown",
      action: "lead",
      confidence: 0,
      grounded: false
    });
  }

  function isQuestion(text) {
    if (text.includes("?")) return true;
    const t = normalize(text);
    return ["как ", "что ", "сколько", "какие", "какой", "какая", "можно", "нужно", "почему", "зачем", "кто ", "где ", "когда ", "чем ", "куда ", "откуда ", "расскаж", "подскаж", "объясн", "правда ли", "есть ли", "будет ли"].some((m) => t.includes(m));
  }

  const GREET_RE = /^(привет|здравствуй|здрасьте|добрый (день|вечер)|доброе утро|хай|салют)/i;
  const THANKS_RE = /^(спасибо|благодар|спс)/i;
  const BYE_RE = /^(пока|до свидания|всего доброго|досвидос)/i;
  const HUMAN_RE = /(позов\w* юриста|хочу юриста|с юристом|оператор|человек|перезвон|свяжитесь|оставить заявку|записаться|консультаци\w* юриста)/i;
  const NEG_RE = /(мошенник|обман|не верю|развод|ужас|достали|надоело|бесполезн)/i;
  const SENSITIVE_RE = /(паспорт\w*.{0,20}\d{4}\s?\d{6}|cvv|cvc|пин[- ]?код|пароль|\b\d{4}\s?\d{6}\b|\b\d{16}\b|\b\d{3}-\d{3}-\d{3}\s?\d{2}\b)/i;

  function newSession() {
    return { id: "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36), slots: {}, facts: {}, asked: [], pending: "debt", lastUser: "", stage: "greeting", summarySent: false, turn: 0 };
  }

  function respond(session, text, init) {
    if (init) {
      session.stage = "intake";
      session.pending = "debt";
      return response(session, KB.agent.greeting, { quick: [
        { label: "Долги по кредитам", value: "У меня долги по кредитам" },
        { label: "Звонят коллекторы", value: "Мне звонят коллекторы" },
        { label: "Нечем платить", value: "Нечем платить по кредитам" },
        { label: "Узнать о банкротстве", value: "Хочу узнать о банкротстве" }
      ], stage: "intake", speech: KB.agent.greeting });
    }
    text = String(text || "").trim().slice(0, 2000);
    session.turn += 1;
    if (SENSITIVE_RE.test(text)) return response(session, KB.guardrails.sensitive, { quick: [{ label: "Продолжить без документов", value: "Хочу продолжить консультацию" }], stage: "guardrail" });

    const pending = session.pending;
    const extracted = extractSlots(text, pending);
    const correction = /вообще[- ]?то|точнее|на самом деле|исправ|поменя|измени/.test(normalize(text));
    const factSlot = { debtMin: "debt", debtMax: "debt", overdueMonths: "overdue", incomeValue: "income" };
    const newSlots = {};
    Object.entries(extracted).forEach(([key, value]) => {
      if (key in factSlot) {
        if (factSlot[key] in newSlots || (session.slots[factSlot[key]] && correction)) session.facts[key] = value;
        return;
      }
      if (!(key in session.slots) || pending === key || correction) {
        session.slots[key] = value;
        newSlots[key] = value;
      }
    });
    session.lastUser = text;

    if (GREET_RE.test(text) && !isQuestion(text)) {
      const prefix = Object.keys(session.slots).length ? ack(newSlots) : "Здравствуйте!";
      return ask(session, nextSlot(session), prefix);
    }
    if (THANKS_RE.test(text) && !isQuestion(text)) {
      if (CORE.every((s) => session.slots[s])) return summary(session);
      return ask(session, nextSlot(session), "Пожалуйста! Рад помочь.");
    }
    if (BYE_RE.test(text)) return response(session, "Спасибо за разговор. Если появятся вопросы, возвращайтесь, я на связи. Берегите себя.", { stage: "bye" });
    const tn = normalize(text);
    if (/подведи|подвести итог|резюме|итог/.test(tn)) {
      if (CORE.every((s) => session.slots[s])) return summary(session);
      return ask(session, nextSlot(session), "Пока данных недостаточно для итога. Уточню ещё пару деталей.");
    }
    if (/изменить данные|поменять данные|исправить данные|начать заново/.test(tn)) {
      session.slots = {};
      session.facts = {};
      session.asked = [];
      session.summarySent = false;
      session.pending = "debt";
      return ask(session, nextSlot(session), "Хорошо, начнём заново. Данные из прошлых ответов я не использую.");
    }
    if (/другой вопрос|спросить другое/.test(tn)) {
      return response(session, "Конечно, спрашивайте. Отвечу, если знаю ответ. Если вопрос сложный, предложу передать его юристу.", { quick: [
        { label: "Что такое банкротство?", value: "Что такое банкротство?" },
        { label: "Сколько стоит?", value: "Сколько стоит банкротство?" },
        { label: "Что с имуществом?", value: "Что будет с имуществом?" }
      ], stage: "answer" });
    }
    if (HUMAN_RE.test(text)) {
      const labels = { debt: "долг", overdue: "просрочка", income: "доход", property: "имущество", goal: "что беспокоит" };
      const summaryText = Object.entries(session.slots).filter(([k]) => labels[k]).map(([k, v]) => `${labels[k]} ${slotDisplay(k, v)}`).join(", ");
      return response(session, "Передам вашу ситуацию юристу. Оставьте имя и удобный контакт в форме, консультация бесплатная." + (summaryText ? ` Кратко по вашим данным: ${summaryText}.` : ""), { quick: [{ label: "Заполнить заявку", value: "Оставить заявку на консультацию" }], stage: "handoff", action: "lead" });
    }
    if (NEG_RE.test(text)) return response(session, KB.guardrails.empathy + " Я не обещаю невозможного. Расскажите, что именно вызывает сомнения, разберём по фактам.", { quick: [{ label: "Откуда ваши ответы?", value: "Откуда вы берёте информацию?" }, { label: "Позвать юриста", value: "Хочу поговорить с юристом" }], stage: "empathy" });

    if (/наследств|завещан|лишени[ея] родительских|ДТП|раздел наследства/.test(tn)) return unknown(session);

    if (isQuestion(text)) {
      const q = text.length < 12 && session.lastUser ? session.lastUser + " " + text : text;
      const found = retrieve(q);
      if (!found.entry || found.score < 0.22) return unknown(session);
      let reply = found.entry.answer;
      const prefix = ack(newSlots);
      if (prefix) reply = prefix + "\n\n" + reply;
      let quick = [
        { label: "Записаться на консультацию", value: "Хочу записаться на консультацию" },
        { label: "Задать свой вопрос", value: "У меня другой вопрос" }
      ];
      const nxt = nextSlot(session);
      if (nxt && !session.summarySent && session.turn <= 7 && session.turn % 2 === 1) {
        reply += "\n\n" + nxt.question;
        quick = nxt.quick;
        session.asked = [...new Set([...session.asked, nxt.id])];
        session.pending = nxt.id;
      }
      if (CORE.every((s) => session.slots[s]) && !session.summarySent) quick = [{ label: "Подвести итог", value: "Подведи итог по моей ситуации" }];
      return response(session, reply, { entry: found.entry, quick, stage: "answer", confidence: found.score, speech: found.entry.answer });
    }

    const objection = retrieve(text);
    const bankJobGuard = objection.entry && objection.entry.id === "objection_bank_job" && !/банк|увол/.test(tn);
    if (objection.entry && objection.entry.section === "Возражения" && objection.score >= 0.55 && !bankJobGuard) {
      const prefix = ack(newSlots);
      return response(session, (prefix ? prefix + "\n\n" : "") + objection.entry.answer, { entry: objection.entry, quick: [
        { label: "Записаться на консультацию", value: "Хочу записаться на консультацию" },
        { label: "Расскажу подробнее", value: "Хочу рассказать подробнее о ситуации" }
      ], stage: "objection", action: "lead", confidence: objection.score, speech: objection.entry.answer });
    }

    if (Object.keys(newSlots).length) {
      if (CORE.every((s) => session.slots[s]) && !session.summarySent) return summary(session);
      return ask(session, nextSlot(session), ack(newSlots));
    }

    const short = normalize(text);
    if (["да", "ага", "верно", "конечно", "хорошо", "ок", "окей"].includes(short)) return ask(session, nextSlot(session), "Хорошо.");
    if (["нет", "не хочу", "не буду", "не знаю", "пока не знаю"].includes(short)) {
      if (pending) {
        session.slots[pending] = "Пока не знаю";
        session.asked = [...new Set([...session.asked, pending])];
        session.pending = null;
        if (CORE.every((s) => session.slots[s])) return summary(session);
        return ask(session, nextSlot(session), "Хорошо, не настаиваю, этот вопрос юрист уточнит на консультации.");
      }
      return unknown(session);
    }
    if (["долг", "кредит", "платить", "денег", "зарплат", "работ"].some((w) => short.includes(w))) {
      const nxt = nextSlot(session);
      if (nxt) return ask(session, nxt, "Понимаю. Чтобы понять, какой путь подходит, мне нужно ещё пара деталей.");
    }
    return unknown(session);
  }

  const sessions = new Map();

  function getSession(id) {
    if (id && sessions.has(id)) return sessions.get(id);
    const s = newSession();
    sessions.set(s.id, s);
    return s;
  }

  function leadId() {
    return "demo-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  async function api(path, options = {}) {
    let body = {};
    if (options.body) {
      try { body = JSON.parse(options.body); } catch (_) { body = {}; }
    }
    if (path === "/api/health") {
      return { ok: true, status: "ready", static: true, entries: KB.entries.length, sources: SOURCES.sources.length, tts: false, stt: false, voices: [], default_voice: "browser", version: "static-demo" };
    }
    if (path === "/api/sources") {
      return { ok: true, sources: SOURCES.sources.filter((s) => s.kind !== "company") };
    }
    if (path === "/api/lead") {
      if (!body.consent) return { ok: false, error: "consent_required" };
      if (!body.name || String(body.name).trim().length < 2) return { ok: false, error: "name_required" };
      if (!body.contact || String(body.contact).trim().length < 5) return { ok: false, error: "contact_required" };
      const id = leadId();
      try {
        const rows = JSON.parse(localStorage.getItem("consultant_demo_leads") || "[]");
        rows.push({ id, created_at: new Date().toISOString(), name: body.name, contact: body.contact, preferred_time: body.preferred_time || "", comment: body.comment || "", situation: body.situation || {}, consent: true });
        localStorage.setItem("consultant_demo_leads", JSON.stringify(rows.slice(-50)));
      } catch (_) { /* localStorage may be unavailable */ }
      return { ok: true, id, demo: true };
    }
    if (path === "/api/chat") {
      const session = getSession(body.session_id);
      if (body.init) return respond(session, "", true);
      if (body.summary) return summary(session);
      return respond(session, body.message || "", false);
    }
    return { ok: false, error: "not_found" };
  }

  window.StaticConsultant = { api, retrieve, extractSlots };
})();
