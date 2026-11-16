(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const els = {
    messages: $("#messages"),
    typing: $("#typing"),
    quick: $("#quickReplies"),
    composer: $("#composer"),
    input: $("#input"),
    mic: $("#micBtn"),
    send: $(".send-btn"),
    voiceToggle: $("#voiceToggle"),
    voiceSelect: $("#voiceSelect"),
    rateRange: $("#rateRange"),
    rateOut: $("#rateOut"),
    soundBtn: $("#soundBtn"),
    soundLabel: $("#soundLabel"),
    soundSlash: $("#soundSlash"),
    soundWave: $("#soundWave"),
    restartBtn: $("#restartBtn"),
    avatarWrap: $("#avatarWrap"),
    chatStatus: $("#chatStatus"),
    ttsHint: $("#ttsHint"),
    progressBar: $("#progressBar"),
    progressLabel: $("#progressLabel"),
    mobileBar: $("#mobileProgressBar"),
    mobileLabel: $("#mobileProgressLabel"),
    slotList: $("#slotList"),
    leadDialog: $("#leadDialog"),
    leadForm: $("#leadForm"),
    leadSuccess: $("#leadSuccess"),
    leadSuccessText: $("#leadSuccessText"),
    leadSituation: $("#leadSituation"),
    leadError: $("#leadError"),
    leadSubmit: $("#leadSubmit"),
    sourcesDialog: $("#sourcesDialog"),
    sourcesList: $("#sourcesList"),
    aboutDialog: $("#aboutDialog"),
    toast: $("#toast"),
  };

  const state = {
    sessionId: null,
    slots: {},
    progress: 0,
    voiceOn: true,
    voice: "ru-RU-SvetlanaNeural",
    rate: 0,
    ttsAvailable: true,
    sttAvailable: true,
    busy: false,
    recording: false,
    recognizing: false,
    recorder: null,
    audio: null,
    audioUrl: null,
    sources: [],
    sourcesLoaded: false,
  };

  const DEFAULT_STATUS = "Арина на связи";

  // --------------------------------------------------------------- helpers
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function nowTime() {
    return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  function toast(message, ms = 3400) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { els.toast.hidden = true; }, ms);
  }

  function setStatus(text) {
    els.chatStatus.textContent = text || DEFAULT_STATUS;
  }

  function setBusy(value) {
    state.busy = value;
    els.send.disabled = value;
    els.input.disabled = false;
  }

  function syncSoundButton() {
    els.soundBtn.classList.toggle("is-off", !state.voiceOn);
    els.soundBtn.setAttribute("aria-label", state.voiceOn ? "Выключить звук" : "Включить звук");
    els.soundBtn.title = state.voiceOn ? "Выключить звук" : "Включить звук";
    if (els.soundLabel) els.soundLabel.textContent = state.voiceOn ? "Звук вкл" : "Звук выкл";
    els.soundSlash.hidden = state.voiceOn;
    els.soundWave.hidden = !state.voiceOn;
  }

  function sourceShort(source) {
    if (!source) return "Источник";
    if (source.kind === "company") {
      return source.title.toLowerCase().includes("политика") ? "Политика конфиденциальности" : "Материалы практики";
    }
    const match = source.title.match(/ст\.\s*[\d.]+/);
    if (match) {
      if (source.title.includes("Налоговый")) return `${match[0]} НК РФ`;
      if (source.title.includes("Гражданский процессуальный")) return `${match[0]} ГПК РФ`;
      return `${match[0]} 127-ФЗ`;
    }
    return source.title.length > 42 ? `${source.title.slice(0, 40)}…` : source.title;
  }

  async function api(path, options = {}) {
    if (window.StaticConsultant) {
      return window.StaticConsultant.api(path, options);
    }
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!response.ok) {
      let detail = "";
      try {
        const payload = await response.json();
        detail = payload.error || "";
      } catch (_) { /* ignore */ }
      throw new Error(detail || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // --------------------------------------------------------------- messages
  function addMessage(role, text, meta = {}) {
    const wrap = document.createElement("div");
    wrap.className = `msg msg--${role}`;

    const avatar = document.createElement("span");
    avatar.className = "msg-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = role === "agent" ? "А" : "Вы";

    const body = document.createElement("div");
    body.className = "msg-body";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    body.appendChild(bubble);

    const metaRow = document.createElement("div");
    metaRow.className = "msg-meta";

    const who = document.createElement("span");
    who.textContent = role === "agent" ? "Арина" : "Вы";
    const time = document.createElement("span");
    time.className = "msg-time";
    time.textContent = nowTime();
    metaRow.append(who, document.createTextNode("·"), time);

    if (role === "agent") {
      const play = document.createElement("button");
      play.type = "button";
      play.className = "msg-speak";
      play.setAttribute("aria-label", "Озвучить ответ");
      play.title = "Озвучить";
      play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
      play.addEventListener("click", () => speak(meta.speech || text, true));
      metaRow.appendChild(play);
    }

    body.appendChild(metaRow);

    if (role === "agent" && Array.isArray(meta.sources) && meta.sources.length) {
      const sources = document.createElement("div");
      sources.className = "msg-sources";
      meta.sources.forEach((source) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "source-chip";
        chip.textContent = sourceShort(source);
        chip.title = source.title;
        chip.addEventListener("click", () => openSources(source.id));
        sources.appendChild(chip);
      });
      body.appendChild(sources);
    }

    if (role === "agent" && meta.action === "lead") {
      const cta = document.createElement("button");
      cta.type = "button";
      cta.className = "msg-cta";
      cta.innerHTML = '<span aria-hidden="true">→</span> Оставить заявку на консультацию';
      cta.addEventListener("click", openLead);
      body.appendChild(cta);
    }

    wrap.append(avatar, body);
    els.messages.appendChild(wrap);
    scrollToBottom();
    return bubble;
  }

  function addUserMessage(text) {
    addMessage("user", text);
  }

  function showStarter() {
    removeStarter();
    const starter = document.createElement("div");
    starter.className = "starter";
    starter.id = "starter";

    const kicker = document.createElement("span");
    kicker.className = "starter-kicker";
    kicker.textContent = "Быстрый старт";

    const title = document.createElement("h3");
    title.textContent = "Разберём вашу ситуацию спокойно";

    const text = document.createElement("p");
    text.textContent = "Расскажите о долге, просрочке, доходе и имуществе. Я задам несколько вопросов, подскажу варианты и передам вашу ситуацию юристу. Без давления и пустых обещаний.";

    const grid = document.createElement("div");
    grid.className = "starter-grid";
    [["01", "Долг и просрочка"], ["02", "Доход и имущество"], ["03", "Передача юристу"]].forEach(([number, label]) => {
      const item = document.createElement("div");
      const num = document.createElement("b");
      num.textContent = number;
      const span = document.createElement("span");
      span.textContent = label;
      item.append(num, span);
      grid.appendChild(item);
    });

    starter.append(kicker, title, text, grid);
    els.messages.appendChild(starter);
    scrollToBottom();
  }

  function removeStarter() {
    const starter = $("#starter");
    if (starter) starter.remove();
  }

  function scrollToBottom() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function showTyping() {
    els.typing.hidden = false;
    setStatus("Арина печатает…");
    scrollToBottom();
  }

  function hideTyping() {
    els.typing.hidden = true;
    setStatus(DEFAULT_STATUS);
  }

  function renderQuick(replies) {
    els.quick.replaceChildren();
    if (!Array.isArray(replies)) return;
    replies.forEach((reply) => {
      if (!reply || !reply.label || !reply.value) return;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = reply.label;
      button.addEventListener("click", () => sendMessage(reply.value, reply.label));
      els.quick.appendChild(button);
    });
  }

  function updateSlots(slots, progress) {
    state.slots = slots && typeof slots === "object" ? slots : {};
    state.progress = Number.isFinite(progress) ? progress : 0;

    const emptyLabels = {
      debt: "не указана",
      overdue: "не указана",
      income: "не указан",
      property: "не указано",
    };

    $$("#slotList li").forEach((row) => {
      const key = row.dataset.slot;
      const value = state.slots[key];
      const target = $("b", row);
      if (value) {
        row.classList.add("is-filled");
        target.textContent = value;
        target.title = value;
      } else {
        row.classList.remove("is-filled");
        target.textContent = emptyLabels[key] || "не указано";
        target.removeAttribute("title");
      }
    });

    const width = `${Math.max(0, Math.min(100, state.progress))}%`;
    els.progressBar.style.width = width;
    els.mobileBar.style.width = width;
    els.progressLabel.textContent = `${state.progress}%`;
    els.mobileLabel.textContent = `${state.progress}%`;
    updateLeadSituation();
  }

  function updateLeadSituation() {
    if (!els.leadSituation) return;
    const labels = { debt: "Долг", overdue: "Просрочка", income: "Доход", property: "Имущество", goal: "Цель" };
    const parts = Object.entries(labels)
      .filter(([key]) => state.slots[key])
      .map(([key, label]) => {
        const item = document.createElement("span");
        const strong = document.createElement("b");
        strong.textContent = `${label}: `;
        item.append(strong, document.createTextNode(state.slots[key]));
        return item;
      });
    els.leadSituation.replaceChildren(...parts);
    els.leadSituation.hidden = parts.length === 0;
  }

  // --------------------------------------------------------------- chat flow
  async function sendMessage(rawText, displayText = null) {
    const text = String(rawText || "").trim();
    if (!text || state.busy) return;

    stopSpeaking();
    removeStarter();
    addUserMessage(displayText || text);
    els.input.value = "";
    resizeInput();
    renderQuick([]);
    setBusy(true);
    showTyping();

    try {
      const data = await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({ session_id: state.sessionId, message: text }),
      });
      state.sessionId = data.session_id || state.sessionId;
      await sleep(320);
      hideTyping();
      addMessage("agent", data.reply, {
        sources: data.sources,
        action: data.action,
        speech: data.speech,
      });
      updateSlots(data.slots, data.progress);
      renderQuick(data.quick_replies);
      if (state.voiceOn) speak(data.speech || data.reply);
    } catch (error) {
      hideTyping();
      addMessage(
        "agent",
        "Не удалось связаться. Проверьте, что сервер запущен, и попробуйте ещё раз. Если проблема повторится, оставьте заявку, и с вами свяжется юрист.",
        { action: "lead" }
      );
      console.error(error);
    } finally {
      setBusy(false);
      els.input.focus();
    }
  }

  async function initChat() {
    els.messages.replaceChildren();
    renderQuick([]);
    updateSlots({}, 0);
    state.sessionId = null;
    setBusy(true);

    try {
      const health = await api("/api/health");
      state.ttsAvailable = Boolean(health.tts);
      state.sttAvailable = Boolean(health.stt);
      if (health.static) {
        state.voice = "browser";
        els.voiceSelect.value = "browser";
        els.ttsHint.textContent = "Демо-версия: озвучка голосом браузера, голосовой ввод недоступен.";
      }
      els.mic.disabled = !state.sttAvailable;
      els.mic.title = state.sttAvailable ? "Говорить" : "В демо-версии голосовой ввод недоступен";
      if (!state.ttsAvailable && !health.static) {
        els.ttsHint.textContent = "Сервер озвучки недоступен, используется голос браузера.";
      }
      const data = await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({ init: true }),
      });
      state.sessionId = data.session_id;
      addMessage("agent", data.reply, { sources: data.sources, speech: data.speech });
      showStarter();
      updateSlots(data.slots, data.progress);
      renderQuick(data.quick_replies);
      setStatus(DEFAULT_STATUS);
    } catch (error) {
      addMessage(
        "agent",
        "Здравствуйте! Меня зовут Арина, я консультант по банкротству. Не удалось загрузить чат, проверьте, что сервер запущен. Пока могу предложить оставить заявку на бесплатную консультацию.",
        { action: "lead" }
      );
      console.error(error);
    } finally {
      setBusy(false);
      els.input.focus();
    }
  }

  // --------------------------------------------------------------- voice output
  function setSpeaking(value) {
    els.avatarWrap.classList.toggle("speaking", value);
    if (value) {
      setStatus("Арина говорит…");
    } else if (!state.busy && !state.recording && !state.recognizing) {
      setStatus(DEFAULT_STATUS);
    }
  }

  function cleanupAudio() {
    if (state.audio) {
      state.audio.pause();
      state.audio.onended = null;
      state.audio.onerror = null;
      state.audio = null;
    }
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
      state.audioUrl = null;
    }
    setSpeaking(false);
  }

  function stopSpeaking() {
    cleanupAudio();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function browserSpeak(text, quiet = false) {
    if (!("speechSynthesis" in window)) {
      if (!quiet) toast("В этом браузере нет синтеза речи. Ответ можно прочитать текстом.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ru-RU";
    utterance.rate = Math.max(0.7, Math.min(1.3, 1 + state.rate / 100));
    const voices = window.speechSynthesis.getVoices();
    const russian = voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("ru"));
    if (russian) utterance.voice = russian;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      if (!quiet) toast("Не удалось озвучить ответ. Нажмите ▶ рядом с сообщением.");
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function speak(text, force = false) {
    const clean = String(text || "").trim();
    if (!clean || (!state.voiceOn && !force)) return;
    stopSpeaking();

    if (state.voice === "browser") {
      browserSpeak(clean, !force);
      return;
    }

    if (state.ttsAvailable) {
      let blob;
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, voice: state.voice, rate: state.rate }),
        });
        if (!response.ok) throw new Error(`TTS ${response.status}`);
        blob = await response.blob();
        if (!blob.size) throw new Error("empty audio");
      } catch (error) {
        console.warn("TTS server unavailable:", error);
        state.ttsAvailable = false;
        els.ttsHint.textContent = "Сервер озвучки недоступен, используется голос браузера.";
        browserSpeak(clean, !force);
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      state.audio = audio;
      state.audioUrl = url;
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => cleanupAudio();
      audio.onerror = () => {
        cleanupAudio();
        browserSpeak(clean, !force);
      };
      try {
        await audio.play();
        return;
      } catch (error) {
        // Это может быть политика автовоспроизведения, а не сбой сервера.
        console.warn("Audio play blocked:", error);
        cleanupAudio();
        browserSpeak(clean, !force);
        return;
      }
    }

    browserSpeak(clean, !force);
  }

  // --------------------------------------------------------------- microphone
  const TARGET_SAMPLE_RATE = 16000;
  const MAX_RECORD_MS = 30000;

  function flattenChunks(chunks) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Float32Array(length);
    let offset = 0;
    chunks.forEach((chunk) => {
      out.set(chunk, offset);
      offset += chunk.length;
    });
    return out;
  }

  function resample(samples, fromRate, toRate) {
    if (fromRate === toRate) return samples;
    const ratio = fromRate / toRate;
    const length = Math.max(1, Math.round(samples.length / ratio));
    const out = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const pos = i * ratio;
      const left = Math.floor(pos);
      const right = Math.min(left + 1, samples.length - 1);
      const mix = pos - left;
      out[i] = samples[left] * (1 - mix) + samples[right] * mix;
    }
    return out;
  }

  function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const write = (offset, text) => {
      for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
    };
    write(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i += 1) {
      const value = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
    return new Blob([view], { type: "audio/wav" });
  }

  function createRecorder() {
    let stream = null;
    let context = null;
    let source = null;
    let processor = null;
    let sink = null;
    let chunks = [];
    let timer = null;

    const recorder = {
      active: false,
      async start() {
        if (recorder.active) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("microphone_unavailable");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error("audio_context_unavailable");
        context = new AudioContextClass();
        if (context.state === "suspended") await context.resume();
        source = context.createMediaStreamSource(stream);
        processor = context.createScriptProcessor(4096, 1, 1);
        sink = context.createGain();
        sink.gain.value = 0;
        chunks = [];
        processor.onaudioprocess = (event) => {
          if (!recorder.active) return;
          chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        };
        source.connect(processor);
        processor.connect(sink);
        sink.connect(context.destination);
        recorder.active = true;
        timer = setTimeout(() => {
          if (recorder.active && state.recording) finishRecording();
        }, MAX_RECORD_MS);
      },
      async stop() {
        if (!recorder.active) return null;
        recorder.active = false;
        clearTimeout(timer);
        timer = null;
        const fromRate = context ? context.sampleRate : TARGET_SAMPLE_RATE;
        try { processor.disconnect(); } catch (_) { /* ignore */ }
        try { source.disconnect(); } catch (_) { /* ignore */ }
        try { sink.disconnect(); } catch (_) { /* ignore */ }
        if (stream) stream.getTracks().forEach((track) => track.stop());
        const samples = resample(flattenChunks(chunks), fromRate, TARGET_SAMPLE_RATE);
        chunks = [];
        const blob = encodeWav(samples, TARGET_SAMPLE_RATE);
        try { await context.close(); } catch (_) { /* ignore */ }
        context = null;
        stream = null;
        return blob;
      },
    };
    return recorder;
  }

  function setRecordingUi(active) {
    state.recording = active;
    els.composer.classList.toggle("is-listening", active);
    els.mic.classList.toggle("is-listening", active);
    els.mic.setAttribute("aria-label", active ? "Остановить запись" : "Говорить");
    els.mic.title = active ? "Остановить запись" : "Говорить";
    if (active) {
      els.input.placeholder = "Слушаю… Нажмите микрофон ещё раз, чтобы отправить";
      setStatus("Слушаю вас…");
    } else if (!state.recognizing) {
      els.input.placeholder = "Напишите или скажите…";
      setStatus(DEFAULT_STATUS);
    }
  }

  async function toggleMic() {
    if (state.recognizing || state.busy) return;
    if (state.recording) {
      await finishRecording();
      return;
    }
    if (!state.sttAvailable) {
      toast("Распознавание речи сейчас недоступно. Напишите вопрос текстом.");
      return;
    }
    stopSpeaking();
    try {
      await state.recorder.start();
      setRecordingUi(true);
    } catch (error) {
      console.warn("Microphone error:", error);
      setRecordingUi(false);
      if (error && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
        toast("Разрешите доступ к микрофону в настройках браузера.");
      } else if (error && error.name === "NotFoundError") {
        toast("Микрофон не найден. Проверьте, что он подключён.");
      } else {
        toast("Не удалось включить микрофон. Попробуйте ещё раз.");
      }
    }
  }

  async function finishRecording() {
    if (!state.recording || !state.recorder) return;
    setRecordingUi(false);
    state.recognizing = true;
    setStatus("Распознаю речь…");
    els.mic.disabled = true;
    try {
      const blob = await state.recorder.stop();
      if (!blob || blob.size < 2000) {
        toast("Запись слишком короткая. Скажите чуть подробнее.");
        return;
      }
      const response = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: blob,
      });
      if (!response.ok) throw new Error(`STT ${response.status}`);
      const data = await response.json();
      const text = String(data.text || "").trim();
      if (!text) {
        toast("Не расслышала. Попробуйте сказать ещё раз или напишите текстом.");
        return;
      }
      await sendMessage(text);
    } catch (error) {
      console.warn("STT error:", error);
      toast("Не удалось распознать речь. Напишите вопрос текстом.");
    } finally {
      state.recognizing = false;
      els.mic.disabled = !state.sttAvailable;
      els.input.placeholder = "Напишите или скажите…";
      setStatus(DEFAULT_STATUS);
    }
  }

  // --------------------------------------------------------------- lead form
  function openLead() {
    els.leadSuccess.hidden = true;
    els.leadForm.hidden = false;
    els.leadError.hidden = true;
    updateLeadSituation();
    if (!els.leadDialog.open) els.leadDialog.showModal();
  }

  async function submitLead(event) {
    event.preventDefault();
    els.leadError.hidden = true;
    const name = $("#leadName").value.trim();
    const contact = $("#leadContact").value.trim();
    const consent = $("#leadConsent").checked;
    if (name.length < 2) {
      showLeadError("Укажите имя, как к вам обращаться.");
      return;
    }
    if (contact.length < 5) {
      showLeadError("Укажите телефон или e-mail для связи.");
      return;
    }
    if (!consent) {
      showLeadError("Нужно согласие на обработку персональных данных.");
      return;
    }

    els.leadSubmit.disabled = true;
    els.leadSubmit.textContent = "Отправляем…";
    try {
      const data = await api("/api/lead", {
        method: "POST",
        body: JSON.stringify({
          name,
          contact,
          preferred_time: $("#leadTime").value,
          comment: $("#leadComment").value.trim(),
          situation: state.slots,
          session_id: state.sessionId,
          consent,
        }),
      });
      els.leadForm.hidden = true;
      els.leadSuccess.hidden = false;
      els.leadSuccessText.textContent = data.demo
        ? "Демо: заявка сохранена в браузере. В полной версии она передаётся юристу."
        : data.id
          ? `Спасибо! Заявка №${data.id} сохранена. Юрист свяжется с вами в удобное время.`
          : "Спасибо! Юрист свяжется с вами в удобное время.";
      els.leadForm.reset();
    } catch (error) {
      showLeadError("Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.");
      console.error(error);
    } finally {
      els.leadSubmit.disabled = false;
      els.leadSubmit.textContent = "Отправить заявку";
    }
  }

  function showLeadError(message) {
    els.leadError.textContent = message;
    els.leadError.hidden = false;
  }

  // --------------------------------------------------------------- sources
  function kindLabel(kind) {
    return { company: "Компания", law: "Закон" }[kind] || "Источник";
  }

  async function loadSources() {
    if (state.sourcesLoaded) return;
    try {
      const data = await api("/api/sources");
      state.sources = data.sources || [];
      state.sourcesLoaded = true;
      els.sourcesList.replaceChildren();
      state.sources.forEach((source) => {
        const link = document.createElement("a");
        link.className = "source-item";
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.dataset.sourceId = source.id;

        const top = document.createElement("div");
        top.className = "source-top";
        const title = document.createElement("b");
        title.textContent = source.title;
        const kind = document.createElement("em");
        kind.textContent = kindLabel(source.kind);
        top.append(title, kind);

        const note = document.createElement("p");
        note.textContent = source.note || "";
        const accessed = document.createElement("small");
        accessed.textContent = `Проверено: ${source.accessed || "16.11.2026"}${source.edition ? ` · ${source.edition}` : ""}`;
        link.append(top, note, accessed);
        els.sourcesList.appendChild(link);
      });
    } catch (error) {
      els.sourcesList.innerHTML = '<p class="muted">Не удалось загрузить источники. Попробуйте позже.</p>';
      console.error(error);
    }
  }

  async function openSources(sourceId = null) {
    if (!els.sourcesDialog.open) els.sourcesDialog.showModal();
    await loadSources();
    if (!sourceId) return;
    const target = els.sourcesList.querySelector(`[data-source-id="${sourceId}"]`);
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.style.borderColor = "#b8892f";
      target.style.background = "#fff8e8";
      setTimeout(() => {
        target.style.borderColor = "";
        target.style.background = "";
      }, 1800);
    }
  }

  // --------------------------------------------------------------- UI events
  function resizeInput() {
    els.input.style.height = "auto";
    els.input.style.height = `${Math.min(els.input.scrollHeight, 118)}px`;
  }

  function bind() {
    els.composer.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = els.input.value.trim();
      if (text) sendMessage(text);
    });

    els.input.addEventListener("input", resizeInput);
    els.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        els.composer.requestSubmit();
      }
    });

    els.mic.addEventListener("click", toggleMic);

    els.voiceToggle.addEventListener("change", () => {
      state.voiceOn = els.voiceToggle.checked;
      syncSoundButton();
      if (!state.voiceOn) stopSpeaking();
      toast(state.voiceOn ? "Голос включён" : "Голос выключен", 1800);
    });

    els.soundBtn.addEventListener("click", () => {
      state.voiceOn = !state.voiceOn;
      els.voiceToggle.checked = state.voiceOn;
      syncSoundButton();
      if (!state.voiceOn) stopSpeaking();
      toast(state.voiceOn ? "Звук включён" : "Звук выключен", 1800);
    });

    els.voiceSelect.addEventListener("change", () => {
      state.voice = els.voiceSelect.value;
      if (state.voiceOn) speak("Голос выбран. Так я буду говорить.");
    });

    els.rateRange.addEventListener("input", () => {
      state.rate = Number(els.rateRange.value);
      els.rateOut.textContent = `${(1 + state.rate / 100).toFixed(2).replace(".", ",")}×`;
    });

    els.restartBtn.addEventListener("click", () => {
      stopSpeaking();
      if (state.recording && state.recorder) {
        state.recording = false;
        state.recorder.stop().catch(() => {});
        setRecordingUi(false);
      }
      initChat();
      toast("Начинаем разговор заново", 1800);
    });

    $$("[data-open-lead]").forEach((button) => button.addEventListener("click", openLead));
    $$("[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => button.closest("dialog")?.close());
    });

    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    });

    $$("[data-topic]").forEach((button) => {
      button.addEventListener("click", () => sendMessage(button.dataset.topic));
    });

    $("#sourcesBtn").addEventListener("click", () => openSources());
    $("#aboutBtn").addEventListener("click", () => els.aboutDialog.showModal());
    els.leadForm.addEventListener("submit", submitLead);

    // На мобильных фокус не должен «прыгать» при открытии чата.
    if (window.matchMedia("(min-width: 861px)").matches) {
      setTimeout(() => els.input.focus({ preventScroll: true }), 500);
    }
  }

  // --------------------------------------------------------------- boot
  function boot() {
    try {
      bind();
    } catch (error) {
      console.error("UI bind failed:", error);
      toast("Часть интерфейса недоступна, но чат продолжит работать.");
    }
    try {
      state.recorder = createRecorder();
    } catch (error) {
      console.warn("Recorder unavailable:", error);
      state.sttAvailable = false;
      els.mic.disabled = true;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      state.sttAvailable = false;
      els.mic.disabled = true;
      els.mic.title = "Микрофон не поддерживается браузером";
    }
    if (!("speechSynthesis" in window)) {
      els.ttsHint.textContent = "Браузерный синтез недоступен, ответы будут текстом.";
    }
    els.rateOut.textContent = "1,00×";
    initChat();
    window.addEventListener("beforeunload", stopSpeaking);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
