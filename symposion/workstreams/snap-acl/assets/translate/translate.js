/* Symposion translations panel (release 0.18). Shared by every Symposion portal; loaded on demand.
   SymposionTranslate.mount(root, { slug, rpc, auth, canPost, isAdmin })
     root     element to render into (emptied first)
     rpc      (name, args) => Promise   the page's own database caller (throws Error(code) on an error reply)
     auth     () => ({ id, pass })       the signed-in person and passcode, read at each call
     canPost  boolean                    false for read-only viewers
   Requests, the three tools' outputs, item checks and the agreement report live in the symposion_translation_* tables
   (migration 0018); translation itself runs on the Symposion Project Administrator's computer (oghma_translate). */
(function () {
  if (window.SymposionTranslate) return;
  const TOOLS = [["google", "Google Translate", "review"], ["argos", "Argos Translate", "review"], ["translategemma", "TranslateGemma", "exploratory"]];
  const LANGS = [["de", "German"], ["fr", "French"], ["nl", "Dutch"], ["es", "Spanish"], ["it", "Italian"], ["pt", "Portuguese"], ["sv", "Swedish"],
    ["da", "Danish"], ["nb", "Norwegian"], ["fi", "Finnish"], ["pl", "Polish"], ["cs", "Czech"], ["el", "Greek"], ["tr", "Turkish"], ["ru", "Russian"],
    ["zh-hans", "Chinese (simplified)"], ["zh-hant", "Chinese (traditional)"], ["ja", "Japanese"], ["ko", "Korean"], ["ar", "Arabic"], ["he", "Hebrew"], ["fa", "Persian"]];
  const LNAME = Object.fromEntries(LANGS);
  const ALWAYS_READER = (l) => /^(zh|ja|ko)/.test(l || "");
  const STATUS = { queued: "Queued", running: "Translating", done: "Translated", failed: "Not translated", withdrawn: "Withdrawn" };
  const JUDGE = [["supports", "Supports"], ["differs", "Differs"], ["unclear", "Unclear"]];
  const BASIS = { google: "Google Translate", official_english: "Official English version", fluent_reader: "Fluent reader" };
  const ERR = { bad_request: "The request is incomplete: give the source, its language, and its text or a link.", too_many: "Too many in a short time. Wait a little and try again.",
    no_job: "That request could not be found.", not_ready: "Item checks open once the translations are in.", bad_item: "The item check is incomplete or does not fit this source.",
    not_yours: "Only the person who asked, or the administrator, can withdraw a request.", not_queued: "Only a request still waiting can be withdrawn.",
    bad_passcode: "Your passcode was not accepted. Sign in again.", person_gone: "Your registration could not be found.",
    server: "Translations are not available on this review yet.", offline: "Symposion cannot be reached. Check the connection and try again." };
  const say = (e) => ERR[e && e.message] || ERR[e] || "Something went wrong. Try again.";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  const pct = (x) => (x == null ? "not estimable" : (100 * x).toFixed(1) + "%");
  const num = (x, d = 2) => (x == null ? "not estimable" : Number(x).toFixed(d));
  const ci = (c) => (c && c[0] != null ? ` (95% CI ${(100 * c[0]).toFixed(1)} to ${(100 * c[1]).toFixed(1)})` : "");
  const kci = (c) => (c && c[0] != null ? ` (${Number(c[0]).toFixed(2)} to ${Number(c[1]).toFixed(2)})` : "");

  const CSS = `
.tr-rules{background:var(--ivory);border:1px solid var(--rule);border-left:3px solid var(--umber);padding:12px 16px;margin:14px 0 18px}
.tr-rules p{margin:0 0 6px}.tr-rules ul{margin:0;padding-left:20px}.tr-rules li{margin:3px 0}
.tr-form{background:var(--ivory);border:1px solid var(--rule);padding:16px 18px;margin:0 0 18px}
.tr-form label{display:block;font-weight:500;margin:10px 0 4px}.tr-form .help{display:block;font-weight:400;font-size:13px;color:var(--muted)}
.tr-form input,.tr-form select,.tr-form textarea{width:100%;font:inherit;padding:7px 9px;border:1px solid var(--rule);border-radius:2px;background:#fff;box-sizing:border-box}
.tr-form textarea{min-height:110px}.tr-form .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tr-form .judge{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.tr-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 0}
.tr-msg{margin:8px 0;font-size:14px}.tr-msg.bad{color:#8a2b1f}.tr-msg.ok{color:var(--teal)}
.tr-list{width:100%;border-collapse:collapse;font-size:14px}.tr-list th,.tr-list td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--rule);vertical-align:top}
.tr-list th{border-bottom:2px solid var(--navy);font-weight:600}.tr-list tr.open-row{cursor:pointer}.tr-list tr.open-row:hover td{background:var(--bone)}
.tr-pill{display:inline-block;font-size:12.5px;padding:1px 7px;border:1px solid var(--rule);border-radius:10px;margin:0 3px 3px 0;white-space:nowrap}
.tr-pill.ok{border-color:var(--teal);color:var(--teal)}.tr-pill.warn{border-color:#a8742a;color:#7a5418}.tr-pill.off{color:var(--muted)}
.tr-side{overflow-x:auto;margin:10px 0 18px}.tr-side table{border-collapse:collapse;width:100%;min-width:760px;font-size:13.5px;line-height:1.45}
.tr-side th,.tr-side td{border:1px solid var(--rule);padding:7px 9px;vertical-align:top;text-align:left}.tr-side th{background:var(--bone);font-weight:600}
.tr-side td.n{width:34px;color:var(--umber);font-family:var(--display);font-weight:600;text-align:right}
.tr-side .flag{display:block;margin-top:5px;font-size:12px;color:#7a5418}
.tr-side .explo{color:var(--muted);font-weight:400;font-size:12px;display:block}
.tr-report dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:8px 0 0}.tr-report dt{color:var(--muted)}.tr-report dd{margin:0}
.tr-items li{margin:0 0 10px}.tr-items .superseded{opacity:.6}
@media (max-width:760px){.tr-form .row,.tr-form .judge{grid-template-columns:1fr}.tr-report dl{grid-template-columns:1fr}}
`;

  function h(tag, attrs, html) { const e = document.createElement(tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }

  function mount(root, o) {
    if (!document.getElementById("tr-css")) { const st = h("style", { id: "tr-css" }); st.textContent = CSS; document.head.appendChild(st); }
    const A = () => o.auth();
    const base = () => ({ p_slug: o.slug, p_person: A().id, p_pass: A().pass });
    const call = (fn, extra) => o.rpc(fn, Object.assign(base(), extra || {}));
    let LIST = null;

    function frame(title, lede) {
      root.innerHTML = "";
      const m = h("div", { class: "board" });
      m.appendChild(h("p", { class: "kicker" }, "Translations"));
      m.appendChild(h("h2", {}, esc(title)));
      if (lede) m.appendChild(h("p", { class: "lede" }, lede));
      root.appendChild(m);
      return m;
    }

    function rules() {
      return h("div", { class: "tr-rules" }, `<p><b>How translation is done in this review</b></p><ul>
        <li>Non-English sources are translated here only, so that every version, check and number is recorded.</li>
        <li>Each source is translated by three tools fixed in advance: Google Translate and Argos Translate for the review, and TranslateGemma for an exploratory evaluation pre-specified in the protocol. Tool versions and dates are recorded with each translation.</li>
        <li>Charting is from Google Translate, read beside Argos Translate. Where an official English version exists, or the source is published in a bilingual journal, the English version is charted and serves as the reference for the evaluation.</li>
        <li>Every number in the original is checked against each translation automatically.</li>
        <li>Each charted item is checked here against each tool. An item on which the tools disagree, or whose number check fails, is confirmed by a fluent reader before it is charted. For Chinese, Japanese and Korean sources every item is confirmed by a fluent reader.</li>
      </ul>`);
    }

    async function list(msg) {
      const m = frame("Translation of non-English sources", "Translation runs on the Symposion Project Administrator's computer; a request is usually completed within a day.");
      m.appendChild(rules());
      const info = h("p", { class: "integrity" }); m.appendChild(info);
      if (msg) m.appendChild(h("p", { class: "tr-msg ok" }, esc(msg)));
      const tools = h("div", { class: "tr-actions" });
      if (o.canPost) { const b = h("button", { class: "btn live", type: "button" }, "Request a translation"); b.onclick = requestForm; tools.appendChild(b); }
      const rf = h("button", { class: "small-btn", type: "button" }, "Refresh"); rf.onclick = () => list(); tools.appendChild(rf);
      m.appendChild(tools);
      const box = h("div", {}); m.appendChild(box);
      if (!o.canPost) { box.appendChild(h("p", { class: "hint" }, "Translations are open to signed-in authors. Read only access does not include them.")); return; }
      box.appendChild(h("p", { class: "hint" }, "Loading."));
      try { LIST = await call("symposion_translation_list"); } catch (e) { box.innerHTML = `<p class="tr-msg bad">${esc(say(e))}</p>`; return; }
      info.innerHTML = LIST.intact ? `<span class="okk">Record intact</span><span>Requests, translations and item checks were checked against their SHA-512 chain at ${esc(when(LIST.checked_at))}.</span>`
        : `<span class="bad">The record failed its integrity check. Contact the Symposion Project Administrator (AJH).</span>`;
      box.innerHTML = "";
      if (!LIST.jobs.length) box.appendChild(h("p", { class: "hint" }, "No translations have been requested yet."));
      else {
        const t = h("table", { class: "tr-list" });
        t.innerHTML = `<thead><tr><th>No.</th><th>Source</th><th>Language</th><th>Asked by</th><th>Status</th><th>Tools</th><th>Item checks</th></tr></thead>`;
        const tb = h("tbody");
        for (const j of LIST.jobs) {
          const tr = h("tr", { class: "open-row", tabindex: "0", "data-seq": j.seq });
          tr.innerHTML = `<td>${j.seq}</td><td>${esc(j.ref)}${j.reference_kind !== "none" ? '<br><span class="tr-pill">English version given</span>' : ""}</td>
            <td>${esc(LNAME[j.lang] || j.lang)}</td><td>${esc(j.by)}<br><span class="hint">${esc(when(j.at))}</span></td><td>${esc(STATUS[j.status] || j.status)}</td>
            <td>${TOOLS.map(([k, n]) => `<span class="tr-pill ${j.tools[k] === "ok" ? "ok" : j.tools[k] ? "warn" : "off"}" title="${esc(n)}">${esc(n.split(" ")[0])}</span>`).join("")}</td><td>${j.items}</td>`;
          tr.onclick = () => detail(j.seq); tr.onkeydown = (e) => { if (e.key === "Enter") detail(j.seq); };
          tb.appendChild(tr);
        }
        t.appendChild(tb); const wrap = h("div", { class: "tbl" }); wrap.appendChild(t); box.appendChild(wrap);
      }
      box.appendChild(report(LIST.report));
    }

    function report(r) {
      const d = h("div", { class: "tr-report" });
      d.appendChild(h("h3", {}, "Agreement and accuracy"));
      if (!r) { d.appendChild(h("p", { class: "hint" }, "Calculated on the administrator's computer after each run, once item checks have been recorded.")); return d; }
      const R = r.report, p = R.pairs["google|argos"] || {}, g3 = R.three_way || {};
      const acc = (t) => ["official_english", "fluent_reader"].map((b) => { const a = (R.accuracy[t] || {})[b] || {}; return a.n ? `${BASIS[b]}: ${a.supports} of ${a.n}${ci(a.ci)}` : ""; }).filter(Boolean).join("; ") || "no reference items yet";
      const nm = (t) => { const x = R.numbers[t] || {}; return x.numbers_in_source ? `${pct(x.preserved)} of ${x.numbers_in_source} numbers kept; ${x.segments_flagged} segment(s) flagged` : "no numbers checked yet"; };
      const rows = [
        ["Sources translated", `${R.sources}; ${Object.entries(R.languages).map(([k, v]) => `${k} ${v}`).join(", ")}`],
        ["Item checks", `${R.items}; ${R.reader_needed} awaiting or needing a fluent reader`],
        ["Google Translate and Argos Translate (review)", p.n ? `agreement on ${p.agree} of ${p.n} items, ${pct(p.po)}${ci(p.po_ci)}; Cohen's kappa ${num(p.kappa)}${kci(p.kappa_ci)}; Gwet's AC1 ${num(p.ac1)}${kci(p.ac1_ci)}` : "no items judged on both yet"],
        ["All three tools (exploratory)", g3.n ? `all agree on ${g3.all_agree} of ${g3.n} items; Fleiss' kappa ${num(g3.fleiss_kappa)}` : "no items judged on all three yet"],
        ...TOOLS.map(([k, n, pur]) => [`${n} against a reference${pur === "exploratory" ? " (exploratory)" : ""}`, acc(k)]),
        ...TOOLS.map(([k, n]) => [`${n}: numbers`, nm(k)]),
      ];
      const dl = h("dl"); for (const [a, b] of rows) { dl.appendChild(h("dt", {}, esc(a))); dl.appendChild(h("dd", {}, esc(b))); } d.appendChild(dl);
      d.appendChild(h("p", { class: "hint" }, `Calculated by ${esc(R.engine)} at ${esc(when(r.at))}; SHA-512 ${esc(r.sha512.slice(0, 16))}. Descriptive: numbers in a single review are small.`));
      return d;
    }

    function requestForm() {
      const m = frame("Request a translation", "Give the source, its language, and either its text or a link to it. If an English version exists, give it too.");
      const f = h("form", { class: "tr-form" });
      f.innerHTML = `
        <label>Source<span class="help">Record number or full citation, as on the screening record.</span><input name="ref" maxlength="500" required></label>
        <div class="row"><label>Language<select name="lang" required><option value="">Choose</option>${LANGS.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("")}<option value="other">Other</option></select></label>
          <label>Other language<span class="help">Its code, for example hu or is.</span><input name="other" maxlength="10" pattern="[a-z]{2,3}(-[a-z]{2,4})?"></label></div>
        <label>Original text<span class="help">Paste the passages that may be charted (or the whole source). Leave empty if a link is given.</span><textarea name="text" maxlength="200000"></textarea></label>
        <label>Link to the original<span class="help">A web page or PDF. If the text cannot be read from the link, the administrator will ask for the file.</span><input name="url" type="url" maxlength="1000" placeholder="https://"></label>
        <label>English version<select name="rk"><option value="none">None known</option><option value="official_english">Official English version published by the same body</option><option value="bilingual_journal">Published in a bilingual journal</option></select></label>
        <div class="row"><label>Link to the English version<input name="rurl" type="url" maxlength="1000" placeholder="https://"></label>
          <label>English text<span class="help">Or paste the corresponding English passages.</span><textarea name="rtext" maxlength="200000"></textarea></label></div>
        <label>Note<span class="help">Optional: which sections matter, or anything the administrator should know.</span><input name="note" maxlength="2000"></label>
        <p class="tr-msg" data-msg></p>
        <div class="tr-actions"><button class="btn live" type="submit">Request translation</button><button class="btn quiet" type="button" data-back>Back to the list</button></div>`;
      f.querySelector("[data-back]").onclick = () => list();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const v = (n) => f.querySelector(`[name="${n}"]`).value.trim(), msg = f.querySelector("[data-msg]");
        const lang = v("lang") === "other" ? v("other").toLowerCase() : v("lang");
        if (!v("ref") || !lang || (!v("text") && !v("url"))) { msg.className = "tr-msg bad"; msg.textContent = ERR.bad_request; return; }
        if (v("rk") !== "none" && !v("rurl") && !v("rtext")) { msg.className = "tr-msg bad"; msg.textContent = "Give the link or the text of the English version, or choose None known."; return; }
        const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
        try {
          const r = await call("symposion_translation_request", { p_ref: v("ref"), p_lang: lang, p_url: v("url"), p_text: v("text"), p_reference_kind: v("rk"),
            p_reference_url: v("rurl"), p_reference_text: v("rtext"), p_note: v("note") });
          list(`Request ${r.job.seq} recorded. It will be translated at the next run.`);
        } catch (er) { msg.className = "tr-msg bad"; msg.textContent = say(er); btn.disabled = false; }
      };
      m.appendChild(f);
    }

    async function detail(seq, note) {
      const m = frame("Translation " + seq, "");
      let d; try { d = await call("symposion_translation_get", { p_seq: seq }); } catch (e) { m.appendChild(h("p", { class: "tr-msg bad" }, esc(say(e)))); return; }
      const j = d.job, out = Object.fromEntries(d.outputs.map((x) => [x.tool, x]));
      m.querySelector("h2").textContent = j.ref;
      m.appendChild(h("p", { class: "lede" }, `${esc(LNAME[j.lang] || j.lang)}. Asked by ${esc(j.by)}, ${esc(when(j.at))}. ${esc(STATUS[j.status] || j.status)}${j.status_note ? ": " + esc(j.status_note) : ""}.`
        + (j.url ? ` <a href="${esc(j.url)}" target="_blank" rel="noopener">Original</a>.` : "") + (j.reference_url ? ` <a href="${esc(j.reference_url)}" target="_blank" rel="noopener">English version</a>.` : "")));
      if (note) m.appendChild(h("p", { class: "tr-msg ok" }, esc(note)));
      const acts = h("div", { class: "tr-actions" });
      const back = h("button", { class: "btn quiet", type: "button" }, "Back to the list"); back.onclick = () => list(); acts.appendChild(back);
      if (j.status === "queued") {
        const w = h("button", { class: "small-btn", type: "button" }, "Withdraw this request");
        w.onclick = async () => { try { await call("symposion_translation_withdraw", { p_seq: seq }); list(`Request ${seq} withdrawn.`); } catch (e) { acts.appendChild(h("span", { class: "tr-msg bad" }, esc(say(e)))); } };
        acts.appendChild(w);
      }
      m.appendChild(acts);
      if (!j.segments) { m.appendChild(h("p", { class: "hint" }, j.status === "queued" ? "Waiting for the next run on the administrator's computer." : "No translation is available.")); return; }
      // tools used
      m.appendChild(h("p", { class: "hint" }, TOOLS.map(([k, n, pur]) => { const x = out[k]; return `${n}${pur === "exploratory" ? " (exploratory)" : ""}: ` + (x ? (x.status === "ok" ? `${esc(x.version)} ${esc(x.model)}, ${esc(when(x.ran_at))}` : `not available (${esc(x.status_note || x.status)})`) : "not run"); }).join("<br>")));
      // side by side
      const side = h("div", { class: "tr-side" });
      const t = h("table");
      t.innerHTML = `<thead><tr><th>#</th><th>Original</th>${TOOLS.map(([k, n, pur]) => `<th>${esc(n)}${pur === "exploratory" ? '<span class="explo">exploratory</span>' : ""}</th>`).join("")}</tr></thead>`;
      const tb = h("tbody");
      j.segments.forEach((s, i) => {
        const tr = h("tr");
        tr.innerHTML = `<td class="n">${i + 1}</td><td lang="${esc(j.lang)}">${esc(s)}</td>` + TOOLS.map(([k]) => {
          const x = out[k]; if (!x || x.status !== "ok") return '<td class="hint">Not available</td>';
          const f = (x.number_flags || [])[i] || {};
          const fl = [f.missing && f.missing.length ? `Number not found in translation: ${f.missing.join(", ")}` : "", f.extra && f.extra.length ? `Number not in original: ${f.extra.join(", ")}` : "",
            f.characters ? "Numbers written in characters: check by eye" : ""].filter(Boolean).map((z) => `<span class="flag">${esc(z)}</span>`).join("");
          return `<td lang="en">${esc(x.segments[i])}${fl}</td>`;
        }).join("");
        tb.appendChild(tr);
      });
      t.appendChild(tb); side.appendChild(t); m.appendChild(side);
      if (j.reference_segments) {
        const det = h("details"); det.appendChild(h("summary", {}, j.reference_kind === "bilingual_journal" ? "English version (bilingual journal)" : "Official English version"));
        const ol = h("ol"); j.reference_segments.forEach((s) => ol.appendChild(h("li", {}, esc(s)))); det.appendChild(ol); m.appendChild(det);
      }
      // item checks
      m.appendChild(h("h3", {}, "Item checks"));
      const lst = h("ol", { class: "tr-items" });
      const sup = new Set(d.items.filter((i) => i.supersedes != null).map((i) => i.supersedes));
      for (const i of d.items) {
        const needs = !sup.has(i.seq) && i.basis === "google" && (ALWAYS_READER(j.lang) || ["google", "argos"].some((k) => i[k] !== "supports" && i[k] !== "not_run"));
        const li = h("li", { class: i.superseded ? "superseded" : "", value: i.seq });
        li.innerHTML = `<b>${esc(i.item)}</b>: ${esc(i.value)}${i.segment != null ? ` (segment ${i.segment + 1})` : ""}. Charted from ${esc(BASIS[i.basis])}${i.reader ? " (" + esc(i.reader) + ")" : ""}.
          ${TOOLS.map(([k, n]) => `<span class="tr-pill ${i[k] === "supports" ? "ok" : i[k] === "not_run" ? "off" : "warn"}">${esc(n.split(" ")[0])}: ${esc(i[k].replace("_", " "))}</span>`).join("")}
          ${needs ? '<span class="tr-pill warn">Fluent reader needed before charting</span>' : ""}${i.superseded ? '<span class="tr-pill off">Corrected by a later check</span>' : ""}
          ${i.supersedes != null ? `<span class="hint">Corrects check ${i.supersedes}.</span>` : ""}${i.note ? `<br><span class="hint">${esc(i.note)}</span>` : ""}
          <br><span class="hint">${esc(i.by)}, ${esc(when(i.at))}</span>`;
        lst.appendChild(li);
      }
      m.appendChild(d.items.length ? lst : h("p", { class: "hint" }, "No item checks yet."));
      if (j.status === "done" && o.canPost) m.appendChild(itemForm(j, out, d.items, sup));
    }

    function itemForm(j, out, items, sup) {
      const f = h("form", { class: "tr-form" });
      const open = items.filter((i) => !sup.has(i.seq));
      f.innerHTML = `<p><b>Record an item check</b></p>
        <div class="row"><label>Item<span class="help">What is charted, for example Time from injury to surgery.</span><input name="itemlabel" maxlength="300" required></label>
          <label>Value charted<span class="help">As it will appear in the charting form.</span><input name="value" maxlength="1000" required></label></div>
        <div class="row"><label>Segment<select name="seg"><option value="">Not tied to one segment</option>${j.segments.map((_, i) => `<option value="${i}">${i + 1}</option>`).join("")}</select></label>
          <label>Charted from<select name="basis">${out.google && out.google.status === "ok" ? '<option value="google">Google Translate</option>' : ""}${j.reference_kind !== "none" ? '<option value="official_english">English version</option>' : ""}<option value="fluent_reader">Fluent reader</option></select></label></div>
        <label data-reader hidden>Fluent reader<span class="help">Initials of the person who confirmed the item from the original.</span><input name="reader" maxlength="100"></label>
        <p class="help" style="margin:12px 0 0">Does each translation support the value charted?</p>
        <div class="judge">${TOOLS.map(([k, n, pur]) => `<label>${esc(n)}${pur === "exploratory" ? " (exploratory)" : ""}${out[k] && out[k].status === "ok" ? `<select name="${k}">${JUDGE.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>` : `<input value="Not run" disabled>`}</label>`).join("")}</div>
        <label>Note<input name="note" maxlength="2000"></label>
        <label>Corrects an earlier check<select name="sup"><option value="">No</option>${open.map((i) => `<option value="${i.seq}">${i.seq}: ${esc(i.item)}</option>`).join("")}</select></label>
        <p class="tr-msg" data-msg></p>
        <div class="tr-actions"><button class="btn live" type="submit">Record item check</button></div>`;
      const basis = f.querySelector("[name=basis]"), rd = f.querySelector("[data-reader]");
      const sync = () => { rd.hidden = basis.value !== "fluent_reader"; }; basis.onchange = sync; sync();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const v = (n) => (f.querySelector(`[name="${n}"]`) ? f.querySelector(`[name="${n}"]`).value.trim() : ""), msg = f.querySelector("[data-msg]");
        if (!v("itemlabel") || !v("value") || (v("basis") === "fluent_reader" && !v("reader"))) { msg.className = "tr-msg bad"; msg.textContent = ERR.bad_item; return; }
        const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
        try {
          const r = await call("symposion_translation_item_post", { p_job: j.seq, p_item: v("itemlabel"), p_value: v("value"), p_segment: v("seg") === "" ? null : Number(v("seg")),
            p_basis: v("basis"), p_reader: v("reader"), p_google: v("google") || "not_run", p_argos: v("argos") || "not_run", p_translategemma: v("translategemma") || "not_run",
            p_note: v("note"), p_supersedes: v("sup") === "" ? null : Number(v("sup")) });
          detail(j.seq, `Item check ${r.item.seq} recorded.`);
        } catch (er) { msg.className = "tr-msg bad"; msg.textContent = say(er); btn.disabled = false; }
      };
      return f;
    }

    list();
  }
  window.SymposionTranslate = { mount, version: "0.18" };
})();
