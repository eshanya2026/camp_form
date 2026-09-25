import { useEffect, useMemo, useState } from "react";
import {
  Armchair,
  BriefcaseBusiness,
  Building2,
  BusFront,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  Globe2,
  Heart,
  LoaderCircle,
  MapPin,
  Phone,
  Search,
  Send,
  UserRound,
  Users,
} from "lucide-react";
import { copy } from "./i18n.js";

const initialForm = {
  requesterName: "",
  requesterAge: "",
  designation: "",
  otherDesignation: "",
  requesterPhone: "",
  village: "",
  taluk: "",
  personCount: "",
  campDate: "",
  busRequired: "yes",
  spaceAvailable: "",
  parkingLocation: "",
  spaceLength: "",
  spaceWidth: "",
  seatingRequired: "no",
  seatingCapacity: "",
  seatingRequirements: "",
  additionalRemarks: "",
  consent: false,
};

function localDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function Section({ number, color, icon: Icon, title, description, children }) {
  return (
    <section className="form-section">
      <div className="section-header">
        <span className={`section-number ${color}`}>{number}</span>
        <span className={`section-icon ${color}`} aria-hidden="true"><Icon /></span>
        <div><h2>{title}</h2><p>{description}</p></div>
      </div>
      {children}
    </section>
  );
}

function Field({ id, name, label, icon: Icon, required, error, children, helper, className = "" }) {
  return (
    <div className={`field ${error ? "invalid" : ""} ${className}`.trim()}>
      <label htmlFor={id}>{Icon && <Icon aria-hidden="true" />}{label}{required && <span> *</span>}</label>
      {children}
      {helper && <p className="helper-text">{helper}</p>}
      <p className="error-message" id={`${name}-error`} role="alert">{error || ""}</p>
    </div>
  );
}

function RadioGroup({ name, legend, value, onChange, yes, no, required, error }) {
  return (
    <fieldset className={`field radio-field ${error ? "invalid" : ""}`}>
      <legend>{legend}{required && <span> *</span>}</legend>
      <div className="radio-options">
        <label><input type="radio" name={name} value="yes" checked={value === "yes"} onChange={onChange} /> {yes}</label>
        <label><input type="radio" name={name} value="no" checked={value === "no"} onChange={onChange} /> {no}</label>
      </div>
      <p className="group-error" role="alert">{error || ""}</p>
    </fieldset>
  );
}

function AwarenessSidebar() {
  return (
    <aside className="awareness-sidebar" aria-label="Breast cancer awareness information">
      <div className="awareness-card">
        <svg className="awareness-ribbon" viewBox="0 0 90 130" aria-hidden="true">
          <defs><linearGradient id="sideRibbon" x1="0" x2="1"><stop stopColor="#ff8eb3" /><stop offset=".52" stopColor="#d81b4e" /><stop offset="1" stopColor="#ffb4cc" /></linearGradient></defs>
          <path d="M45 7C24 7 17 23 22 40c6 20 29 47 50 80l13-26C64 63 48 44 40 31c-5-9-1-18 5-24Z" fill="url(#sideRibbon)" />
          <path d="M45 7c21 0 28 16 23 33-6 20-29 47-50 80L6 94c21-31 37-50 45-63 5-9 1-18-6-24Z" fill="#f45c8b" opacity=".9" />
        </svg>
        <h2>Early Detection<br />Saves Lives</h2><span className="hand-line" />
        <p>This camp supports breast cancer screening and awareness for a healthier tomorrow.</p>
        <ul className="feature-list">
          <li><span><Search /></span><div><strong>Early Detection</strong><small>Better Treatment</small></div></li>
          <li><span><Heart /></span><div><strong>Healthier</strong><small>Communities</small></div></li>
          <li><span><Users /></span><div><strong>Stronger</strong><small>Together</small></div></li>
        </ul>
        <div className="help-card">
          <div className="help-heading"><ClipboardList /><h3>Camp Request<br />Helps Us</h3></div>
          <ul><li>Estimate attendance</li><li>Confirm bus access</li><li>Plan seating &amp; logistics</li><li>Serve your village better</li></ul>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem("campFormLanguage") === "ta" ? "ta" : "en"; } catch { return "en"; }
  });
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const t = useMemo(() => copy[language], [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "ta" ? "நடமாடும் மேமோகிராஃபி முகாம் கோரிக்கை" : "Mobile Mammography Camp Request";
    try { localStorage.setItem("campFormLanguage", language); } catch { /* Storage is optional. */ }
  }, [language]);

  const update = (event) => {
    const { name, value, type, checked } = event.target;
    let nextValue = type === "checkbox" ? checked : value;
    if (name === "requesterPhone") nextValue = value.replace(/\D/g, "").slice(0, 10);

    setForm((current) => {
      const next = { ...current, [name]: nextValue };
      if (name === "designation" && nextValue !== "other") next.otherDesignation = "";
      if (name === "busRequired" && nextValue === "no") Object.assign(next, { spaceAvailable: "", parkingLocation: "", spaceLength: "", spaceWidth: "" });
      if (name === "spaceAvailable" && nextValue === "no") Object.assign(next, { parkingLocation: "", spaceLength: "", spaceWidth: "" });
      if (name === "seatingRequired" && nextValue === "no") Object.assign(next, { seatingCapacity: "", seatingRequirements: "" });
      return next;
    });
    setErrors((current) => ({ ...current, [name]: "", ...(name === "designation" ? { otherDesignation: "" } : {}) }));
    setServerError("");
  };

  const validate = () => {
    const next = {};
    const required = ["requesterName", "requesterAge", "designation", "requesterPhone", "village", "personCount", "campDate"];
    required.forEach((name) => { if (!String(form[name]).trim()) next[name] = t.validation.required; });
    if (form.designation === "other" && !form.otherDesignation.trim()) next.otherDesignation = t.validation.required;
    if (form.requesterAge && (!Number.isInteger(Number(form.requesterAge)) || Number(form.requesterAge) < 18 || Number(form.requesterAge) > 120)) next.requesterAge = t.validation.number;
    if (form.requesterPhone && !/^[6-9]\d{9}$/.test(form.requesterPhone)) next.requesterPhone = t.validation.phone;
    if (form.personCount && (!Number.isInteger(Number(form.personCount)) || Number(form.personCount) < 1 || Number(form.personCount) > 10000)) next.personCount = t.validation.number;
    if (form.campDate && form.campDate < localDateString()) next.campDate = t.validation.date;

    if (form.busRequired === "yes") {
      if (!form.spaceAvailable) next.spaceAvailable = t.validation.select;
      if (form.spaceAvailable !== "no" && !form.parkingLocation.trim()) next.parkingLocation = t.validation.required;
    }
    if (form.seatingRequired === "yes" && (!form.seatingCapacity || Number(form.seatingCapacity) < 1 || Number(form.seatingCapacity) > 10000)) next.seatingCapacity = t.validation.number;
    if (!form.consent) next.consent = t.validation.consent;
    return next;
  };

  const numberOrNull = (value) => value === "" ? null : Number(value);

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setServerError("");

    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => document.querySelector(".invalid input, .invalid select, .invalid textarea")?.focus());
      return;
    }

    const payload = {
      requesterName: form.requesterName.trim(), requesterAge: Number(form.requesterAge), designation: (form.designation === "other" ? form.otherDesignation : form.designation).trim(), requesterPhone: form.requesterPhone,
      village: form.village.trim(), taluk: form.taluk || null, personCount: Number(form.personCount), campDate: form.campDate,
      busRequired: form.busRequired === "yes", spaceAvailable: form.busRequired === "yes" ? form.spaceAvailable === "yes" : null,
      parkingLocation: form.busRequired === "yes" && form.spaceAvailable === "yes" ? form.parkingLocation.trim() : null,
      spaceLength: form.busRequired === "yes" && form.spaceAvailable === "yes" ? numberOrNull(form.spaceLength) : null,
      spaceWidth: form.busRequired === "yes" && form.spaceAvailable === "yes" ? numberOrNull(form.spaceWidth) : null,
      seatingRequired: form.seatingRequired === "yes", seatingCapacity: form.seatingRequired === "yes" ? numberOrNull(form.seatingCapacity) : null,
      seatingRequirements: form.seatingRequired === "yes" ? form.seatingRequirements.trim() || null : null,
      additionalRemarks: form.additionalRemarks.trim() || null, consent: form.consent, language,
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/camp-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (Array.isArray(result.errors)) setErrors(Object.fromEntries(result.errors.map((error) => [error.field, error.message])));
        throw new Error(result.message || t.serverError);
      }
      setRequestId(result.requestId);
      setModalOpen(true);
    } catch (error) {
      setServerError(error.message || t.serverError);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(initialForm);
    setErrors({});
    setRequestId("");
    setTimeout(() => document.getElementById("requesterName")?.focus(), 0);
  };

  return (
    <>
      <header className="hero"><img src="/hero-banner.png" alt="Mobile Mammography Camp campaign with partner logos, awareness ribbon, woman and screening bus" /></header>

      <main className="page-shell">
        <div className="language-toolbar">
          <span>{t.language}</span>
          <button type="button" aria-pressed={language === "ta"} onClick={() => setLanguage(language === "en" ? "ta" : "en")}>
            <Globe2 /><span>{t.switchLanguage}</span>
          </button>
        </div>

        <div className="content-layout">
          <form id="camp-form" noValidate onSubmit={submit}>
            <Section number="1" color="pink" icon={UserRound} title={t.sections.requester[0]} description={t.sections.requester[1]}>
              <div className="form-grid grid-2">
                <Field id="requesterName" name="requesterName" label={t.fields.name} icon={UserRound} required error={errors.requesterName}><input id="requesterName" name="requesterName" value={form.requesterName} onChange={update} placeholder={t.fields.namePlaceholder} autoComplete="name" aria-invalid={Boolean(errors.requesterName)} /></Field>
                <Field id="requesterAge" name="requesterAge" label={t.fields.age} icon={CalendarDays} required error={errors.requesterAge}><input id="requesterAge" name="requesterAge" type="number" min="18" max="120" step="1" value={form.requesterAge} onChange={update} placeholder={t.fields.agePlaceholder} aria-invalid={Boolean(errors.requesterAge)} /></Field>
                <Field id="designation" name="designation" label={t.fields.designation} icon={BriefcaseBusiness} required error={errors.designation}><select id="designation" name="designation" value={form.designation} onChange={update} aria-invalid={Boolean(errors.designation)}><option value="">{t.fields.designationPlaceholder}</option>{t.fields.designationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field id="requesterPhone" name="requesterPhone" label={t.fields.phone} icon={Phone} required error={errors.requesterPhone}><input id="requesterPhone" name="requesterPhone" type="tel" inputMode="numeric" maxLength="10" value={form.requesterPhone} onChange={update} placeholder={t.fields.phonePlaceholder} autoComplete="tel" aria-invalid={Boolean(errors.requesterPhone)} /></Field>
                {form.designation === "other" && <Field id="otherDesignation" name="otherDesignation" label={t.fields.otherDesignation} icon={BriefcaseBusiness} required error={errors.otherDesignation} className="field-wide"><input id="otherDesignation" name="otherDesignation" value={form.otherDesignation} onChange={update} maxLength="120" placeholder={t.fields.otherDesignationPlaceholder} autoComplete="organization-title" aria-invalid={Boolean(errors.otherDesignation)} /></Field>}
              </div>
            </Section>

            <Section number="2" color="blue" icon={Building2} title={t.sections.camp[0]} description={t.sections.camp[1]}>
              <div className="form-grid grid-2">
                <Field id="village" name="village" label={t.fields.village} icon={MapPin} required error={errors.village}><input id="village" name="village" value={form.village} onChange={update} placeholder={t.fields.villagePlaceholder} aria-invalid={Boolean(errors.village)} /></Field>
                <Field id="taluk" name="taluk" label={t.fields.taluk} icon={Building2} error={errors.taluk}><select id="taluk" name="taluk" value={form.taluk} onChange={update}><option value="">{t.fields.talukPlaceholder}</option><option value="other">{t.fields.talukOther}</option></select></Field>
                <Field id="personCount" name="personCount" label={t.fields.people} icon={Users} required error={errors.personCount} helper={t.fields.peopleHelp}><input id="personCount" name="personCount" type="number" min="1" max="10000" step="1" value={form.personCount} onChange={update} placeholder={t.example50} aria-invalid={Boolean(errors.personCount)} /></Field>
                <Field id="campDate" name="campDate" label={t.fields.date} icon={CalendarDays} required error={errors.campDate}><input id="campDate" name="campDate" type="date" min={localDateString()} value={form.campDate} onChange={update} aria-invalid={Boolean(errors.campDate)} /></Field>
              </div>
            </Section>

            <Section number="3" color="pink" icon={BusFront} title={t.sections.bus[0]} description={t.sections.bus[1]}>
              <div className="question-row"><RadioGroup name="busRequired" legend={t.fields.busQuestion} value={form.busRequired} onChange={update} yes={t.yes} no={t.no} required /></div>
              {form.busRequired === "yes" && <div className="conditional-panel">
                <div className="conditional-heading"><BusFront /><div><h3>{t.fields.busSpace}</h3><p>{t.fields.busSpaceHelp}</p></div></div>
                <div className="form-grid grid-2">
                  <RadioGroup name="spaceAvailable" legend={t.fields.spaceQuestion} value={form.spaceAvailable} onChange={update} yes={t.yes} no={t.no} required error={errors.spaceAvailable} />
                  {form.spaceAvailable !== "no" && <>
                    <Field id="parkingLocation" name="parkingLocation" label={t.fields.parking} icon={MapPin} required error={errors.parkingLocation}><input id="parkingLocation" name="parkingLocation" value={form.parkingLocation} onChange={update} placeholder={t.fields.parkingPlaceholder} aria-invalid={Boolean(errors.parkingLocation)} /></Field>
                    <div className="field dimensions-field"><label>{t.fields.dimensions} <span className="optional-label">{t.fields.optional}</span></label><div className="dimension-inputs"><div><input name="spaceLength" type="number" min="1" max="1000" value={form.spaceLength} onChange={update} placeholder={t.fields.length} /><span>ft</span></div><div><input name="spaceWidth" type="number" min="1" max="1000" value={form.spaceWidth} onChange={update} placeholder={t.fields.width} /><span>ft</span></div></div></div>
                  </>}
                </div>
              </div>}
            </Section>

            <Section number="4" color="blue" icon={Armchair} title={t.sections.seating[0]} description={t.sections.seating[1]}>
              <div className="question-row"><RadioGroup name="seatingRequired" legend={t.fields.seatingQuestion} value={form.seatingRequired} onChange={update} yes={t.yes} no={t.no} /></div>
              {form.seatingRequired === "yes" && <div className="conditional-panel"><div className="form-grid grid-2">
                <Field id="seatingCapacity" name="seatingCapacity" label={t.fields.capacity} icon={Armchair} required error={errors.seatingCapacity}><input id="seatingCapacity" name="seatingCapacity" type="number" min="1" max="10000" value={form.seatingCapacity} onChange={update} placeholder={t.example30} aria-invalid={Boolean(errors.seatingCapacity)} /></Field>
                <Field id="seatingRequirements" name="seatingRequirements" label={t.fields.requirements} icon={FileText}><textarea id="seatingRequirements" name="seatingRequirements" rows="3" value={form.seatingRequirements} onChange={update} placeholder={t.fields.requirementsPlaceholder} /></Field>
              </div></div>}

              <Field id="additionalRemarks" name="additionalRemarks" label={t.fields.remarks} icon={FileText} className="remarks-field">
                <textarea id="additionalRemarks" name="additionalRemarks" rows="5" maxLength="500" value={form.additionalRemarks} onChange={update} placeholder={t.fields.remarksPlaceholder} />
                <div className="textarea-meta"><span>{t.fields.remarksHelp}</span><span><b>{form.additionalRemarks.length}</b>/500</span></div>
              </Field>

              <div className="form-actions">
                <div><div className="consent-row"><input id="consent" name="consent" type="checkbox" checked={form.consent} onChange={update} /><label htmlFor="consent">{t.fields.consent} <span>*</span></label></div><p className="consent-error" role="alert">{errors.consent || ""}</p></div>
                <button className="submit-button" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spinner" /> : <Send />}<span>{submitting ? t.submitting : t.submit}</span></button>
                {serverError && <p className="form-status error" role="alert">{serverError}</p>}
              </div>
            </Section>
          </form>
          <AwarenessSidebar />
        </div>

        <footer className="page-footer"><div className="footer-message"><span /><p>A Healthier Community <b>|</b> Together</p><span /></div></footer>
      </main>

      {modalOpen && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="success-title">
        <button className="modal-backdrop" aria-label="Close" onClick={closeModal} />
        <div className="modal-card"><div className="success-icon"><Check /></div><p className="modal-kicker">{t.success.kicker}</p><h2 id="success-title">{t.success.title}</h2><p>{t.success.body}</p><p className="request-reference"><span>{t.success.requestId}</span><strong>{requestId}</strong></p><button type="button" onClick={closeModal}>{t.success.done}</button></div>
      </div>}
    </>
  );
}
